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

    // ─── 3. DETERMINISTIC FILLER WORD COUNT & PRE-FILTER ───
    const fillerRegex = /\b(u[hm]+|like|you know|basically|actually|literally|so+|well|I mean|right)\b/gi;
    const fillerMatches = transcriptText.match(fillerRegex) || [];
    const fillerCount = fillerMatches.length;

    const wordCount = transcriptText?.trim().split(/\s+/).filter(w => w.length > 0).length || 0;
    const isInvalidSession = wordCount < 3;

    // ─── 4. GEMINI LLM ANALYSIS (The 'Brutal Truth' Layer) ───
    const prompt = `Analyze this interview response.
Topic: "${topic}"
Track: ${track}
Transcript: "${isInvalidSession ? "[INVALID_SESSION: NO VALID SPEECH DETECTED]" : transcriptText}"

STRICT EVALUATION RULES:
1. IF TRANSCRIPT IS "[INVALID_SESSION: NO VALID SPEECH DETECTED]":
   - Set confidenceScore, clarityScore, and structureScore to 0.
   - Set overallFeedback to: "SpeakForge couldn't hear you clearly. Please ensure your microphone is working and you are answering the prompt."
   - Set idealAnswer to a STANDARD, simple sample answer for the prompt.
   - Return EMPTY arrays [] for strengths and weaknesses.
2. RELEVANCE AUDIT: If transcript is irrelevant noise or "potato salad":
   - Set all scores to 0.
   - Set overallFeedback to: "The input provided is irrelevant to the topic. Please stay on track."
   - Set idealAnswer to a STANDARD sample answer.
   - Return EMPTY arrays [] for strengths.
3. SCORING & POLISH (Normal Case):
   - confidenceScore (1-10), clarityScore (1-10), structureScore (1-10).
   - idealAnswer: A 10% refactored version of user words using simple vocabulary.

JSON Structure ONLY:
{
  "confidenceScore": number,
  "clarityScore": number,
  "structureScore": number,
  "answerLogic": "string",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "overallFeedback": "string",
  "idealAnswer": "string",
  "starMethodUsed": boolean|null
}`;
    let analysisText;
    // Models prioritized by user preference (1500 RPD tier)
    const modelsToTry = ["gemini-1.5-flash", "gemini-flash-latest", "gemini-2.0-flash"];
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
        const status = err.status || err.code || 500;
        if (status === 404 || status === 429 || status === 503 || msg.includes('high demand')) {
          const reason = status === 404 ? 'Not Found' : (status === 429 ? 'Quota' : 'High Demand');
          log.warn(`${modelName} unavailable (${reason}). Trying next model...`);
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
