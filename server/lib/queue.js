/**
 * lib/queue.js — Asynchronous Analysis Queue (Redis + BullMQ with Graceful In-Memory Fallback)
 * 
 * Features:
 * 1. Distributed Job Processing via BullMQ + Redis when REDIS_URL is provided.
 * 2. Automatic exponential backoff retries (3 attempts).
 * 3. Graceful in-process async worker fallback for local development if Redis is unavailable.
 * 4. Granular progress tracking: 'transcribing' -> 'evaluating' -> 'storing' -> 'ready'.
 */

import './env.js';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import Groq, { toFile } from 'groq-sdk';
import pool from '../db/pool.js';
import { log } from './logger.js';
import supabase from './supabase.js';
import { analyzeTranscript } from './analysis.js';
import { calculateDeliveryMetrics } from './deliveryMetrics.js';
import { retrieveUserSessionMemories, storeSessionMemory } from './ragMemory.js';
import { 
  updateSessionStatus, 
  insertRecording, 
  insertAnalytics 
} from '../db/queries.js';

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const QUEUE_NAME = 'analysis-queue';

let analysisQueue = null;
let analysisWorker = null;
let redisConnection = null;
let isRedisAvailable = false;

// In-memory job state tracker (for dev or fast status lookups)
const inMemoryJobs = new Map();

/**
 * Core async job execution pipeline.
 */
export async function processAnalysisJob(jobData) {
  const { 
    sessionId, 
    userId, 
    track, 
    difficulty, 
    topic, 
    isBehavioral, 
    visualMetrics, 
    s3Url, 
    fileName,
    audioBuffer: rawBuffer 
  } = jobData;

  log.info(`[Job ${sessionId}] Starting background analysis pipeline...`);
  inMemoryJobs.set(sessionId, { status: 'processing', progressStep: 'transcribing', error: null });

  const client = await pool.connect();

  try {
    // ─── STEP 1: TRANSCRIBING ───
    await updateSessionStatus(client, sessionId, 'processing', 'transcribing');

    let audioBuffer = rawBuffer;
    if (!audioBuffer && s3Url) {
      log.info(`[Job ${sessionId}] Fetching audio buffer from Supabase storage: ${s3Url}`);
      const resp = await fetch(s3Url);
      if (!resp.ok) throw new Error(`Failed to fetch audio from storage: ${resp.statusText}`);
      audioBuffer = Buffer.from(await resp.arrayBuffer());
    }

    if (!groq) {
      throw new Error("GROQ_API_KEY is not configured on the server for speech transcription.");
    }

    const transcription = await groq.audio.transcriptions.create({
      file: await toFile(audioBuffer, fileName || `${sessionId}.webm`),
      model: "whisper-large-v3",
      response_format: "verbose_json",
    });

    const transcriptText = (transcription?.text || '').trim();
    const deliveryMetrics = calculateDeliveryMetrics(transcription);

    log.info(`[Job ${sessionId}] Transcription complete: ${transcriptText.length} chars | Pace: ${deliveryMetrics.wpm} WPM`);
    inMemoryJobs.set(sessionId, { status: 'processing', progressStep: 'evaluating', transcriptText });

    // ─── STEP 2: MULTI-AGENT COUNCIL EVALUATING ───
    await updateSessionStatus(client, sessionId, 'processing', 'evaluating');

    // Retrieve longitudinal RAG memories
    let pastMemories = [];
    try {
      pastMemories = await retrieveUserSessionMemories(pool, userId, `${track}: ${topic}`);
    } catch (e) {
      log.warn(`[Job ${sessionId}] RAG memory lookup skipped:`, e.message);
    }

    const explicitFillerRegex = /\b(u[hm]+|uh|er|you know|I mean)\b/gi;
    const fallbackFillerCount = (transcriptText.match(explicitFillerRegex) || []).length;

    const { analysisJson } = await analyzeTranscript({
      topic,
      track,
      transcriptText,
      isBehavioral: Boolean(isBehavioral),
      deliveryMetrics,
      visualMetrics,
      memories: pastMemories,
      fallbackFillerCount,
    });

    const finalFillerCount = analysisJson.fillerWordsCount ?? fallbackFillerCount;
    inMemoryJobs.set(sessionId, { status: 'processing', progressStep: 'storing', transcriptText, analysisJson });

    // ─── STEP 3: STORING RESULTS ───
    await updateSessionStatus(client, sessionId, 'processing', 'storing');

    await client.query('BEGIN');
    await insertRecording(client, sessionId, s3Url, transcriptText, analysisJson);
    await insertAnalytics(
      client, 
      sessionId, 
      userId, 
      finalFillerCount,
      analysisJson.confidenceScore ?? null,
      analysisJson.clarityScore ?? null,
      analysisJson.structureScore ?? null
    );
    await updateSessionStatus(client, sessionId, 'completed', 'ready', null);
    await client.query('COMMIT');

    log.info(`[Job ${sessionId}] Analysis persisted to database successfully.`);

    // Store in vector memory bank asynchronously
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
    }).catch(err => log.warn(`[Job ${sessionId}] Vector memory insert deferred:`, err.message));

    inMemoryJobs.set(sessionId, { 
      status: 'completed', 
      progressStep: 'ready', 
      transcriptText, 
      analysisJson, 
      s3Url 
    });

    return { sessionId, status: 'completed', analysisJson, transcriptText };

  } catch (err) {
    log.error(`[Job ${sessionId}] Processing error:`, err.message);
    try {
      await client.query('ROLLBACK');
      await updateSessionStatus(client, sessionId, 'failed', 'failed', err.message);
    } catch (dbErr) {
      log.error(`[Job ${sessionId}] Failed to mark session as failed in DB:`, dbErr.message);
    }

    inMemoryJobs.set(sessionId, { 
      status: 'failed', 
      progressStep: 'failed', 
      error: err.message 
    });

    throw err;
  } finally {
    client.release();
  }
}

/**
 * Initialize BullMQ with Redis connection if configured.
 */
export function initQueue() {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      log.info("[Queue] Connecting to Redis at:", redisUrl.replace(/\/\/[^@]*@/, '//***@'));
      redisConnection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy(times) {
          if (times > 5) {
            log.warn("[Queue] Redis connection attempts exceeded. Falling back to in-process async runner.");
            return null;
          }
          return Math.min(times * 1000, 3000);
        }
      });

      redisConnection.on('connect', () => {
        log.info("[Queue] Redis connection established. Enabling BullMQ cluster.");
        isRedisAvailable = true;
      });

      redisConnection.on('error', (err) => {
        log.warn("[Queue] Redis connection issue:", err.message);
      });

      analysisQueue = new Queue(QUEUE_NAME, {
        connection: redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 100 },
        }
      });

      analysisWorker = new Worker(
        QUEUE_NAME,
        async (job) => {
          log.info(`[BullMQ Worker] Picked up job ${job.id} for session ${job.data.sessionId}`);
          return await processAnalysisJob(job.data);
        },
        { 
          connection: redisConnection,
          concurrency: 3,
        }
      );

      analysisWorker.on('completed', (job) => {
        log.info(`[BullMQ Worker] Job ${job.id} completed successfully.`);
      });

      analysisWorker.on('failed', (job, err) => {
        log.error(`[BullMQ Worker] Job ${job?.id} failed on attempt ${job?.attemptsMade}:`, err.message);
      });

    } catch (e) {
      log.warn("[Queue] Redis/BullMQ initialization skipped, using resilient in-process queue:", e.message);
      isRedisAvailable = false;
    }
  } else {
    log.info("[Queue] REDIS_URL not configured. Running resilient in-process async queue (zero external dependencies).");
    isRedisAvailable = false;
  }
}

/**
 * Enqueue a new analysis job.
 */
export async function addAnalysisJob(jobData) {
  const { sessionId } = jobData;
  inMemoryJobs.set(sessionId, { status: 'queued', progressStep: 'transcribing', error: null });

  if (isRedisAvailable && analysisQueue) {
    try {
      const job = await analysisQueue.add('analyze', jobData, {
        jobId: sessionId,
      });
      log.info(`[Queue] Session ${sessionId} enqueued in BullMQ (Job ID: ${job.id})`);
      return { type: 'bullmq', jobId: job.id };
    } catch (err) {
      log.warn(`[Queue] Failed to enqueue to Redis, switching to in-process execution:`, err.message);
    }
  }

  // Resilient in-process async execution (non-blocking)
  setImmediate(async () => {
    try {
      await processAnalysisJob(jobData);
    } catch (err) {
      log.error(`[In-Process Job ${sessionId}] Execution failed:`, err.message);
    }
  });

  return { type: 'in-process', jobId: sessionId };
}

/**
 * Get job status from memory or DB.
 */
export function getInMemoryJobStatus(sessionId) {
  return inMemoryJobs.get(sessionId) || null;
}
