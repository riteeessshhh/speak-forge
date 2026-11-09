/**
 * routes/upload.js — Upload & Analysis Route (Async Queue-Driven Architecture)
 * 
 * 1. POST /api/upload: Uploads audio to Supabase Storage, creates session record, 
 *    dispatches job to BullMQ / Queue, and returns HTTP 202 Accepted immediately (<300ms).
 * 2. GET /api/upload/status/:sessionId: Polls real-time job progress ('transcribing' -> 'evaluating' -> 'storing' -> 'ready').
 * 3. POST /api/upload/reanalyze/:sessionId: Re-enqueues failed or past sessions for re-analysis.
 */

import { Router } from 'express';
import multer from 'multer';
import { log } from '../lib/logger.js';
import pool from '../db/pool.js';
import supabase from '../lib/supabase.js';
import { verifyToken } from '../middleware/auth.js';
import { addAnalysisJob, getInMemoryJobStatus } from '../lib/queue.js';
import { 
  insertSession, 
  getSessionWithAnalysis, 
  updateSessionStatus 
} from '../db/queries.js';

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * Enqueue a new audio session for background processing.
 */
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

  if (!track || !difficulty || !topic) {
    return res.status(400).json({ error: 'Track, difficulty, and topic are required.' });
  }

  log.info(`Received audio: ${audioFile.originalname} | Size: ${audioFile.size} bytes for user ${userId}`);

  try {
    // 1. Upload audio to Supabase Storage immediately (~150-200ms)
    const tempId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const fileName = `${tempId}.webm`;

    const { error: uploadErr } = await supabase.storage
      .from('recordings')
      .upload(fileName, audioFile.buffer, {
        contentType: audioFile.mimetype || 'audio/webm',
      });

    if (uploadErr) {
      throw new Error(`Supabase upload failed: ${uploadErr.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('recordings')
      .getPublicUrl(fileName);
    const s3Url = publicUrlData.publicUrl;

    // 2. Insert session with initial status 'processing' and progressStep 'transcribing'
    const client = await pool.connect();
    let sessionId;
    try {
      sessionId = await insertSession(client, track, difficulty, topic, userId, 'processing', 'transcribing');
    } finally {
      client.release();
    }

    // 3. Dispatch to BullMQ / In-Process Queue
    const jobInfo = await addAnalysisJob({
      sessionId,
      userId,
      track,
      difficulty,
      topic,
      isBehavioral: isBehavioralBool,
      visualMetrics,
      s3Url,
      fileName,
      audioBuffer: audioFile.buffer,
    });

    log.info(`[Queue] Session ${sessionId} enqueued successfully (Job: ${jobInfo.jobId})`);

    // 4. Return HTTP 202 Accepted immediately (<300ms)
    return res.status(202).json({
      status: 'processing',
      progressStep: 'transcribing',
      sessionId,
      jobId: jobInfo.jobId,
      s3Url,
      message: 'Audio received and enqueued for analysis.'
    });

  } catch (error) {
    log.error('Upload route error:', error.message);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Poll job status and fetch analysis result when complete.
 */
router.get('/status/:sessionId', verifyToken, async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;

  try {
    const client = await pool.connect();
    let sessionData;
    try {
      sessionData = await getSessionWithAnalysis(client, sessionId, userId);
    } finally {
      client.release();
    }

    if (!sessionData) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check fast in-memory tracker if available
    const memJob = getInMemoryJobStatus(sessionId);
    const progressStep = memJob?.progressStep || sessionData.progress_step || 'ready';

    return res.json({
      status: sessionData.status,
      progressStep,
      sessionId: sessionData.session_id,
      track: sessionData.track_name,
      difficulty: sessionData.difficulty,
      topic: sessionData.topic_text,
      s3Url: sessionData.s3_url,
      transcriptText: sessionData.transcript,
      analysisJson: sessionData.analysis_json,
      errorMessage: sessionData.error_message,
      createdAt: sessionData.created_at,
    });
  } catch (err) {
    log.error(`Failed to fetch status for session ${sessionId}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch session status' });
  }
});

/**
 * Re-analyze a failed or past session.
 */
router.post('/reanalyze/:sessionId', verifyToken, async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;

  try {
    const client = await pool.connect();
    let sessionData;
    try {
      sessionData = await getSessionWithAnalysis(client, sessionId, userId);
    } finally {
      client.release();
    }

    if (!sessionData) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!sessionData.s3_url) {
      return res.status(400).json({ error: 'No audio recording found for this session to re-analyze' });
    }

    // Mark session as processing
    const client2 = await pool.connect();
    try {
      await updateSessionStatus(client2, sessionId, 'processing', 'transcribing', null);
    } finally {
      client2.release();
    }

    const jobInfo = await addAnalysisJob({
      sessionId,
      userId,
      track: sessionData.track_name,
      difficulty: sessionData.difficulty,
      topic: sessionData.topic_text,
      isBehavioral: false,
      s3Url: sessionData.s3_url,
      fileName: `${sessionId}.webm`,
    });

    return res.status(202).json({
      status: 'processing',
      progressStep: 'transcribing',
      sessionId,
      jobId: jobInfo.jobId,
      message: 'Session enqueued for re-analysis.'
    });
  } catch (err) {
    log.error(`Failed to reanalyze session ${sessionId}:`, err.message);
    res.status(500).json({ error: 'Failed to reanalyze session' });
  }
});

export default router;
