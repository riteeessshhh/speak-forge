/**
 * routes/upload.js — Upload & Analysis Route (Transaction-Optimized)
 * 
 * PHASE 1: External AI calls (Supabase, Groq, Gemini) — NO DB connection held
 * PHASE 2: SQL transaction (session, recording, analytics) — DB held ~50ms
 */

import { Router } from 'express';
import multer from 'multer';
import Groq, { toFile } from 'groq-sdk';
import { log } from '../lib/logger.js';
import pool from '../db/pool.js';
import supabase from '../lib/supabase.js';
import { verifyToken } from '../middleware/auth.js';
import { generateContent, withExponentialBackoff } from '../lib/ai.js';
import { insertSession, insertRecording, insertAnalytics } from '../db/queries.js';

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.post('/', verifyToken, upload.single('audio'), async (req, res) => {
  const { track, difficulty, topic, isBehavioral } = req.body;
  const userId = req.user.id;
  const isBehavioralBool = isBehavioral === 'true' || isBehavioral === true;
  const audioFile = req.file;

  if (!audioFile) {
    return res.status(400).json({ error: 'No audio file provided' });
  }
  log.info(`Received audio: ${audioFile.originalname} | Size: ${audioFile.size} bytes | Type: ${audioFile.mimetype}`);

  if (!track || !difficulty || !topic) {
    return res.status(400).json({ error: 'Track, difficulty, and topic are required.' });
  }

  try {
    /* ═══════════════════════════════════════════════
       PHASE 1: EXTERNAL AI CALLS (No DB connection)
       ═══════════════════════════════════════════════ */

    // ─── 1. UPLOAD AUDIO TO SUPABASE STORAGE ───
    const tempId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const fileName = `${tempId}.webm`;
    const { data: storageData, error: storageError } = await supabase.storage
      .from('recordings')
      .upload(fileName, audioFile.buffer, {
        contentType: audioFile.mimetype || 'audio/webm',
      });

    if (storageError) {
      throw new Error(`Supabase upload failed: ${storageError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('recordings')
      .getPublicUrl(fileName);
    const s3Url = publicUrlData.publicUrl;
    log.info(`Audio uploaded to Supabase: ${fileName}`);

    // ─── 2. GROQ STT (WHISPER) ───
    const transcription = await groq.audio.transcriptions.create({
      file: await toFile(audioFile.buffer, fileName),
      model: "whisper-large-v3",
      response_format: "json",
    });
    const transcriptText = transcription.text;
    log.info(`Transcription complete: ${transcriptText.length} chars`);

    if (!transcriptText || transcriptText.trim().length < 5) {
      throw new Error("Forge couldn't hear you clearly. Please ensure your microphone is working and try speaking again.");
    }

    // ─── 3. DETERMINISTIC FILLER WORD COUNT (Regex Ground Truth) ───
    const fillerRegex = /\b(u[hm]+|like|you know|basically|actually|literally|so+|well|I mean|right)\b/gi;
    const fillerMatches = transcriptText.match(fillerRegex) || [];
    const fillerCount = fillerMatches.length;

    // ─── 4. GEMINI LLM ANALYSIS ───
    const prompt = `Analyze transcript. Track: ${track}, Topic: "${topic}", Transcript: "${transcriptText}". JSON format ONLY.
1. Vocabulary Baseline: Identify user proficiency (Basic, Mid, or Advanced).
2. Incremental Polish (10% Rule): 'idealAnswer' must be a direct refactor of user's words (no generic corporate-speak).
3. Constraints: Swap 2-3 weak verbs (e.g. 'made'->'developed'), tighten 1-2 rambling sentences. Maintain user's original voice.
4. feedback: In overallFeedback, explain the "Why" behind your specific polish choices.
5. isBehavioral: ${isBehavioralBool}. If TRUE: use STAR. If FALSE: focus on Flow/Articulation.
6. Return clarityScore (1-10) and structureScore (1-10) as separate fields.

Structure:
{
  "starMethodUsed": boolean|null (true/false ONLY if isBehavioral=TRUE),
  "confidenceScore": 1-10,
  "clarityScore": 1-10,
  "structureScore": 1-10,
  "answerLogic": "string (incl. detected proficiency level)",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "overallFeedback": "string (incl. explanation of polish choices)",
  "idealAnswer": "string (the 10% refactored version)"
}`;
    let analysisText;
    // Models confirmed available via ListModels (each has separate per-model quota)
    const modelsToTry = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash"];
    let lastError;
    for (const modelName of modelsToTry) {
      try {
        log.info(`[API Call] Gemini triggered (analysis) — model: ${modelName}`);
        analysisText = await withExponentialBackoff(() => generateContent(prompt, modelName), 2, 1000);
        log.info(`[API Call] Success with model: ${modelName}`);
        break;
      } catch (err) {
        lastError = err;
        const msg = err.message || '';
        if (msg.includes('404') || msg.includes('429')) {
          log.warn(`${modelName} unavailable (${msg.includes('404') ? '404 Not Found' : '429 Quota/Rate Limit'}). Trying next model...`);
        } else {
          throw err;
        }
      }
    }
    if (!analysisText) throw lastError;

    analysisText = analysisText.trim();

    if (analysisText.startsWith('```json')) {
      analysisText = analysisText.replace(/```json\n?/, '').replace(/```\n?$/, '');
    } else if (analysisText.startsWith('```')) {
      analysisText = analysisText.replace(/```\n?/, '').replace(/```\n?$/, '');
    }

    let analysisJson;
    try {
      analysisJson = JSON.parse(analysisText);
    } catch (e) {
      log.warn("Failed to parse Gemini output, creating fallback JSON");
      analysisJson = {
        starMethodUsed: null,
        confidenceScore: 1,
        clarityScore: 1,
        structureScore: 1,
        answerLogic: "Could not parse answer logic.",
        strengths: ["Audio received"],
        weaknesses: ["AI parsing failed"],
        overallFeedback: analysisText,
        idealAnswer: ""
      };
    }

    // Override fillerWordsCount with deterministic Regex ground truth
    analysisJson.fillerWordsCount = fillerCount;

    /* ═══════════════════════════════════════════════
       PHASE 2: SQL TRANSACTION (~50ms DB hold time)
       ═══════════════════════════════════════════════ */

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const sessionId = await insertSession(client, track, difficulty, topic, userId);
      await insertRecording(client, sessionId, s3Url, transcriptText, analysisJson);
      await insertAnalytics(
        client, sessionId, userId, fillerCount,
        analysisJson.confidenceScore || null,
        analysisJson.clarityScore || null,
        analysisJson.structureScore || null
      );

      await client.query('COMMIT');
      log.info(`Session ${sessionId} committed successfully.`);

      res.json({
        success: true,
        sessionId,
        transcript: transcriptText,
        analysis: analysisJson,
        audioUrl: s3Url,
      });
    } catch (dbError) {
      await client.query('ROLLBACK');
      log.error("DB transaction failed:", dbError.message);
      throw dbError;
    } finally {
      client.release();
    }

  } catch (error) {
    log.error("Upload pipeline failed:", error.message);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
