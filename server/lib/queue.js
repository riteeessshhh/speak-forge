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
let queueRedisConnection = null;
let workerRedisConnection = null;
let isRedisAvailable = false;

// In-memory job state tracker (for dev or fast status lookups)
const inMemoryJobs = new Map();

function withTimeout(promise, ms, label) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Core async job execution pipeline.
 * Avoids holding PostgreSQL pool clients open during long external HTTP calls (Supabase, Groq, LLMs).
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
    storagePath,
    audioBuffer: rawBuffer 
  } = jobData;

  log.info(`[Job ${sessionId}] Starting background analysis pipeline...`);
  inMemoryJobs.set(sessionId, { status: 'processing', progressStep: 'transcribing', error: null });

  try {
    // ─── STEP 1: TRANSCRIBING ───
    await updateSessionStatus(pool, sessionId, 'processing', 'transcribing');

    let audioBuffer = Buffer.isBuffer(rawBuffer)
      ? rawBuffer
      : (rawBuffer?.type === 'Buffer' && Array.isArray(rawBuffer?.data) ? Buffer.from(rawBuffer.data) : null);

    if (!audioBuffer && (storagePath || s3Url)) {
      let objectPath = storagePath;
      if (!objectPath && s3Url) {
        const cleanUrl = s3Url.split('?')[0];
        const marker = '/recordings/';
        const markerIdx = cleanUrl.lastIndexOf(marker);
        objectPath = markerIdx >= 0
          ? cleanUrl.slice(markerIdx + marker.length)
          : cleanUrl.split('/').pop();
      }

      if (objectPath) {
        log.info(`[Job ${sessionId}] Downloading audio via Supabase SDK: ${objectPath}`);
        const { data: blobData, error: dlErr } = await withTimeout(
          supabase.storage.from('recordings').download(objectPath),
          25000,
          'Supabase storage download'
        );

        if (!dlErr && blobData) {
          audioBuffer = Buffer.from(await blobData.arrayBuffer());
        } else {
          log.warn(`[Job ${sessionId}] Supabase SDK download failed (${dlErr?.message}), trying direct URL fetch...`);
        }
      }

      if (!audioBuffer && s3Url) {
        const resp = await withTimeout(fetch(s3Url), 25000, 'Direct audio URL fetch');
        if (!resp.ok) throw new Error(`Failed to fetch audio from storage: ${resp.statusText}`);
        audioBuffer = Buffer.from(await resp.arrayBuffer());
      }
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error("Audio buffer is missing or empty.");
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
    await updateSessionStatus(pool, sessionId, 'processing', 'evaluating');

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

    // ─── STEP 3: STORING RESULTS (Short-lived DB transaction) ───
    await updateSessionStatus(pool, sessionId, 'processing', 'storing');

    const client = await pool.connect();
    try {
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
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

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
      await updateSessionStatus(pool, sessionId, 'failed', 'failed', err.message);
    } catch (dbErr) {
      log.error(`[Job ${sessionId}] Failed to mark session as failed in DB:`, dbErr.message);
    }

    inMemoryJobs.set(sessionId, { 
      status: 'failed', 
      progressStep: 'failed', 
      error: err.message 
    });

    throw err;
  }
}

/**
 * Initialize BullMQ with dedicated Queue + Worker Redis connections if configured.
 */
export function initQueue() {
  const redisUrl = (process.env.REDIS_URL || '').trim();

  if (redisUrl) {
    try {
      log.info("[Queue] Connecting to Redis at:", redisUrl.replace(/\/\/[^@]*@/, '//***@'));
      const useTls = redisUrl.startsWith('rediss://');
      const retryStrategy = (times) => {
        if (times > 5) {
          log.warn("[Queue] Redis connection attempts exceeded. Using resilient in-process async runner.");
          isRedisAvailable = false;
          return null;
        }
        return Math.min(times * 1000, 3000);
      };

      // Queue connection: fail fast without offline queuing so POST /api/upload never hangs on stalled Redis
      queueRedisConnection = new IORedis(redisUrl, {
        connectTimeout: 5000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        enableReadyCheck: true,
        tls: useTls ? { rejectUnauthorized: false } : undefined,
        retryStrategy,
      });

      // Separate Worker connection: BullMQ blocks on BZPOPMIN so Worker must NEVER share Queue's socket
      workerRedisConnection = new IORedis(redisUrl, {
        connectTimeout: 5000,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        tls: useTls ? { rejectUnauthorized: false } : undefined,
        retryStrategy,
      });

      queueRedisConnection.on('ready', () => {
        log.info("[Queue] Redis connection ready. Enabling BullMQ cluster.");
        isRedisAvailable = true;
      });
      queueRedisConnection.on('close', () => {
        isRedisAvailable = false;
      });
      queueRedisConnection.on('end', () => {
        isRedisAvailable = false;
      });
      queueRedisConnection.on('error', (err) => {
        isRedisAvailable = false;
        log.warn("[Queue] Redis queue connection issue:", err.message);
      });

      workerRedisConnection.on('error', (err) => {
        log.warn("[Queue] Redis worker connection issue:", err.message);
      });

      analysisQueue = new Queue(QUEUE_NAME, {
        connection: queueRedisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 100 },
        }
      });
      analysisQueue.on('error', (err) => {
        isRedisAvailable = false;
        log.warn("[BullMQ Queue] Error:", err.message);
      });

      analysisWorker = new Worker(
        QUEUE_NAME,
        async (job) => {
          log.info(`[BullMQ Worker] Picked up job ${job.id} for session ${job.data.sessionId}`);
          return await processAnalysisJob(job.data);
        },
        { 
          connection: workerRedisConnection,
          concurrency: 3,
        }
      );

      analysisWorker.on('error', (err) => {
        log.warn("[BullMQ Worker] Error:", err.message);
      });
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
 * Enqueue a new analysis job with fail-fast 2.5s Redis guard.
 */
export async function addAnalysisJob(jobData) {
  const { sessionId, isReanalyze } = jobData;
  inMemoryJobs.set(sessionId, { status: 'queued', progressStep: 'transcribing', error: null });

  if (isRedisAvailable && analysisQueue && queueRedisConnection?.status === 'ready') {
    try {
      // Omit binary audioBuffer in Redis JSON payload; worker downloads cleanly from Supabase s3Url
      const { audioBuffer, ...serializableJobData } = jobData;
      const bullJobId = isReanalyze ? `${sessionId}-re-${Date.now()}` : sessionId;
      const job = await withTimeout(
        analysisQueue.add('analyze', serializableJobData, { jobId: bullJobId }),
        2500,
        'Redis BullMQ enqueue'
      );
      log.info(`[Queue] Session ${sessionId} enqueued in BullMQ (Job ID: ${job.id})`);
      return { type: 'bullmq', jobId: job.id };
    } catch (err) {
      log.warn(`[Queue] Failed/timed out enqueueing to Redis (${err.message}), switching to in-process execution.`);
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

/**
 * Non-sensitive queue readiness string for /health diagnostics.
 */
export function getQueueHealth() {
  if (!process.env.REDIS_URL) return 'in-process';
  return isRedisAvailable && queueRedisConnection?.status === 'ready'
    ? 'bullmq-ready'
    : 'in-process-fallback';
}
