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
import { analyzeTranscript } from '../lib/analysis.js';
import { calculateDeliveryMetrics } from '../lib/deliveryMetrics.js';
import { retrieveUserSessionMemories, storeSessionMemory } from '../lib/ragMemory.js';
import { insertSession, insertRecording, insertAnalytics } from '../db/queries.js';

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.post('/', verifyToken, upload.single('audio'), async (req, res) => {
  const { track, difficulty, topic, isBehavioral, visualMetrics: rawVisualMetrics } = req.body;
  const userId = req.user.id;
  const isBehavioralBool = isBehavioral === 'true' || isBehavioral === true;
  const audioFile = req.file;

  let visualMetrics = null;
  if (rawVisualMetrics) {
    try {
      visualMetrics = typeof rawVisualMetrics === 'string' ? JSON.parse(rawVisualMetrics) : rawVisualMetrics;
    } catch (e) {
      log.warn("Failed to parse visualMetrics from request body");
    }
  }

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

    // ─── 1 & 2. CONCURRENT: SUPABASE STORAGE UPLOAD & GROQ WHISPER STT ───
    const tempId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const fileName = `${tempId}.webm`;

    log.info(`[Pipeline] Running Supabase upload and Groq Whisper STT concurrently...`);

    const uploadToSupabase = async () => {
      const { error } = await supabase.storage
        .from('recordings')
        .upload(fileName, audioFile.buffer, {
          contentType: audioFile.mimetype || 'audio/webm',
        });

      if (error) {
        throw new Error(`Supabase upload failed: ${error.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from('recordings')
        .getPublicUrl(fileName);
      return publicUrlData.publicUrl;
    };

    const transcribeWithGroq = async () => {
      const transcription = await groq.audio.transcriptions.create({
        file: await toFile(audioFile.buffer, fileName),
        model: "whisper-large-v3",
        response_format: "verbose_json",
      });
      return transcription;
    };

    const retrievePastMemories = async () => {
      try {
        return await retrieveUserSessionMemories(pool, userId, `${track}: ${topic}`);
      } catch (e) {
        log.warn("[RAG] Past memory retrieval skipped:", e.message);
        return [];
      }
    };

    const [s3Url, transcriptionData, pastMemories] = await Promise.all([
      uploadToSupabase(),
      transcribeWithGroq(),
      retrievePastMemories(),
    ]);

    const transcriptText = (transcriptionData?.text || '').trim();
    const deliveryMetrics = calculateDeliveryMetrics(transcriptionData);

    log.info(`Audio uploaded to Supabase: ${fileName}`);
    log.info(`Transcription complete: ${transcriptText.length} chars | Pace: ${deliveryMetrics.wpm} WPM (${deliveryMetrics.pacing}) | Pauses: ${deliveryMetrics.awkwardPausesCount}`);
    log.info(`[RAG] Retrieved ${pastMemories.length} historical performance memories for habit comparison.`);

    // ─── 3. PRE-FILTER & FALLBACK FILLER COUNT ───
    const explicitFillerRegex = /\b(u[hm]+|uh|er|you know|I mean)\b/gi;
    const fallbackFillerCount = (transcriptText.match(explicitFillerRegex) || []).length;

    // ─── 4. GEMINI LLM ANALYSIS (The 'Brutal Truth' Layer with RAG Memory) ───
    const { analysisJson } = await analyzeTranscript({
      topic,
      track,
      transcriptText,
      isBehavioral: isBehavioralBool,
      deliveryMetrics,
      visualMetrics,
      memories: pastMemories,
      fallbackFillerCount,
    });
    const finalFillerCount = analysisJson.fillerWordsCount;

    /* ═══════════════════════════════════════════════
       PHASE 2: SQL TRANSACTION (~50ms DB hold time)
       ═══════════════════════════════════════════════ */

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const sessionId = await insertSession(client, track, difficulty, topic, userId);
      await insertRecording(client, sessionId, s3Url, transcriptText, analysisJson);
      await insertAnalytics(
        client, sessionId, userId, finalFillerCount,
        analysisJson.confidenceScore || null,
        analysisJson.clarityScore || null,
        analysisJson.structureScore || null
      );

      await client.query('COMMIT');
      log.info(`Session ${sessionId} committed successfully.`);

      // Asynchronously store this session into the user's vector memory bank
      storeSessionMemory(pool, {
        sessionId,
        userId,
        trackName: track,
        topicText: topic,
        transcriptSummary: analysisJson.overallFeedback || '',
        strengths: analysisJson.strengths || [],
        weaknesses: analysisJson.weaknesses || [],
        fillerWordCount: finalFillerCount,
        wpm: deliveryMetrics?.wpm,
        awkwardPauses: deliveryMetrics?.awkwardPausesCount,
        eyeContactPercent: visualMetrics?.eyeContactPercent,
        presenceScore: visualMetrics?.presenceScore,
        confidenceScore: analysisJson.confidenceScore,
        clarityScore: analysisJson.clarityScore,
        structureScore: analysisJson.structureScore,
      }).catch(err => log.error("[RAG] Background memory save failed:", err.message));

      res.json({
        success: true,
        sessionId,
        transcript: transcriptText,
        analysis: analysisJson,
        deliveryMetrics,
        visualMetrics,
        habitTrends: analysisJson.habitTrends,
        pastMemoriesCount: pastMemories.length,
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
