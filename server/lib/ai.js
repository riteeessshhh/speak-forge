/**
 * ai.js — Resilient Multi-Provider LLM Engine (Gemini + Groq Failover)
 * 
 * Exports: generateContent, generateWithGemini, generateWithGroq, embedContent, withExponentialBackoff, refillTopicCache
 */

import './env.js';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import { log } from './logger.js';
import pool from '../db/pool.js';

const geminiKeys = [
  process.env.GEMINI_API_KEY_PRIMARY,
  process.env.GEMINI_API_KEY_FALLBACK,
  process.env.GEMINI_API_KEY,
  process.env.GOOGLE_API_KEY,
].filter((k, idx, arr) => typeof k === 'string' && k.trim().length > 0 && arr.indexOf(k) === idx);

const aiClients = geminiKeys.map((apiKey) => new GoogleGenAI({ apiKey }));
let keyCursor = 0;

// Initialize Groq as ultra-fast, high-quota provider
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

log.info(`[AI Engine] Ready with ${aiClients.length} Gemini key(s) | Groq ${groq ? 'ENABLED' : 'DISABLED'}`);

// Verified operational Google models (ordered by live reliability & latency)
const DEFAULT_MODEL = "gemini-3-flash-preview";
const VERIFIED_GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
];

// Short-term circuit breaker cache for failing/hanging (model, keyIndex) endpoints
const unhealthyEndpoints = new Map();

function markUnhealthy(model, keyIdx, ttlMs) {
  unhealthyEndpoints.set(`${model}#${keyIdx}`, Date.now() + ttlMs);
}

function isHealthy(model, keyIdx) {
  const until = unhealthyEndpoints.get(`${model}#${keyIdx}`);
  if (!until) return true;
  if (Date.now() >= until) {
    unhealthyEndpoints.delete(`${model}#${keyIdx}`);
    return true;
  }
  return false;
}

function withTimeout(promise, ms, label = 'LLM request') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * High-performance Groq generation (gpt-oss-120b / gpt-oss-20b / qwen3.8-27b) with cooldown circuit breaker.
 */
export const generateWithGroq = async (prompt, config = {}) => {
  if (!groq) throw new Error("GROQ_API_KEY not configured");

  let baseModels;
  if (config.preferFast) {
    baseModels = ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b'];
  } else if (config.preferBalanced) {
    baseModels = ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b'];
  } else {
    baseModels = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
  }

  const healthyModels = baseModels.filter((m) => isHealthy('groq:' + m, 0));
  const groqModels = healthyModels.length > 0 ? healthyModels : baseModels.slice(0, 2);

  const timeoutMs = config.timeoutMs || 11000;
  let lastError = null;

  for (const model of groqModels) {
    try {
      log.info(`[Groq AI] Generating with model: ${model}`);
      const completion = await withTimeout(
        groq.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert AI speaking coach and assessment specialist. Always respond with strictly valid JSON matching the requested schema.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: 'json_object' },
          temperature: config.temperature ?? 0.7,
        }),
        timeoutMs,
        `Groq(${model})`
      );

      const content = completion.choices?.[0]?.message?.content;
      if (content) {
        unhealthyEndpoints.delete(`groq:${model}#0`);
        log.info(`[Groq AI] Success with ${model}`);
        return content;
      }
    } catch (err) {
      lastError = err;
      const msg = err.message || '';
      const ttl = msg.includes('429') || msg.includes('timed out') ? 35000 : 20000;
      markUnhealthy('groq:' + model, 0, ttl);
      log.warn(`[Groq AI] Model ${model} failed (${msg}). Trying next Groq model...`);
    }
  }

  throw lastError || new Error("All Groq models failed");
};

/**
 * Generate content via Gemini with round-robin key rotation, circuit-breaker skipping, and strict timeouts.
 */
export const generateWithGemini = async (prompt, modelName = DEFAULT_MODEL, config = {}) => {
  if (aiClients.length === 0) {
    throw new Error("No Gemini API keys configured");
  }

  const {
    preferProvider,
    preferFast,
    preferBalanced,
    timeoutMs = 6000,
    geminiDeadlineMs = groq ? 11000 : 24000,
    ...geminiExtraConfig
  } = config;

  const requestConfig = {
    responseMimeType: "application/json",
    ...geminiExtraConfig,
  };

  // Spread concurrent requests fairly across keys
  const startKeyIdx = keyCursor;
  keyCursor = (keyCursor + 1) % aiClients.length;

  const modelsToTry = [modelName, ...VERIFIED_GEMINI_MODELS.filter((m) => m !== modelName)];
  const candidates = [];
  for (const model of modelsToTry) {
    for (let offset = 0; offset < aiClients.length; offset++) {
      const idx = (startKeyIdx + offset) % aiClients.length;
      if (isHealthy(model, idx)) {
        candidates.push({ model, idx });
      }
    }
  }

  // If every endpoint is temporarily cooled down and Groq is ready, fail immediately to Groq (0ms wasted)
  if (candidates.length === 0) {
    if (groq) {
      throw new Error("All Gemini endpoints temporarily in cooldown; switching directly to Groq.");
    }
    for (let offset = 0; offset < Math.min(2, aiClients.length); offset++) {
      candidates.push({ model: DEFAULT_MODEL, idx: (startKeyIdx + offset) % aiClients.length });
    }
  }

  const startedAt = Date.now();
  let lastError = null;

  for (const { model, idx } of candidates) {
    const elapsed = Date.now() - startedAt;
    const remainingBudget = geminiDeadlineMs - elapsed;
    if (remainingBudget < 1200) {
      lastError = lastError || new Error(`Gemini overall deadline (${geminiDeadlineMs}ms) reached`);
      break;
    }

    const effectiveTimeout = Math.min(timeoutMs, remainingBudget);
    const client = aiClients[idx];

    try {
      const response = await withTimeout(
        client.models.generateContent({
          model,
          contents: prompt,
          config: requestConfig,
        }),
        effectiveTimeout,
        `Gemini(${model}#${idx + 1})`
      );
      unhealthyEndpoints.delete(`${model}#${idx}`);
      return response.text;
    } catch (err) {
      lastError = err;
      const msg = err.message || '';
      const status = err.status || err.code || '';
      log.warn(`[Gemini AI] ${model} (Key #${idx + 1}) failed (${status}): ${msg.slice(0, 140)}`);

      if (status === 404 || msg.includes('404') || msg.includes('NOT_FOUND')) {
        markUnhealthy(model, idx, 6 * 60 * 60 * 1000); // 6h cooldown for retired models
      } else if (status === 429 || msg.includes('429') || msg.includes('Quota') || msg.includes('limit') || msg.includes('RESOURCE_EXHAUSTED')) {
        markUnhealthy(model, idx, 60 * 1000); // 60s cooldown for quota
      } else {
        markUnhealthy(model, idx, 45 * 1000); // 45s cooldown for 503/timeout/transient failure
      }
    }
  }

  throw lastError || new Error("All Gemini models and keys failed");
};

/**
 * Unified AI content generator with automatic provider orchestration.
 * Supports `config.preferProvider = 'groq' | 'gemini'`.
 */
export const generateContent = async (prompt, modelName = DEFAULT_MODEL, config = {}) => {
  const preferGroq = config.preferProvider === 'groq' || aiClients.length === 0;

  if (preferGroq) {
    if (groq) {
      try {
        return await generateWithGroq(prompt, config);
      } catch (groqErr) {
        log.warn(`[AI Engine] Preferred Groq failed (${groqErr.message}). Failing over to Gemini...`);
      }
    }
    return await generateWithGemini(prompt, modelName, config);
  }

  // Default: Gemini first, instant seamless failover to Groq
  try {
    return await generateWithGemini(prompt, modelName, config);
  } catch (geminiErr) {
    if (groq) {
      log.warn(`[AI Engine] Gemini unavailable (${geminiErr.message.slice(0, 100)}). Seamlessly failing over to Groq...`);
      return await generateWithGroq(prompt, config);
    }
    throw geminiErr;
  }
};

/**
 * Generate 768-dimensional text embedding for RAG semantic search.
 */
export const embedContent = async (text, modelName = "gemini-embedding-001") => {
  const cleanText = (text || '').trim();
  if (!cleanText || aiClients.length === 0) return [];

  let lastError = null;
  for (let offset = 0; offset < aiClients.length; offset++) {
    const idx = (keyCursor + offset) % aiClients.length;
    try {
      const response = await withTimeout(
        aiClients[idx].models.embedContent({
          model: modelName,
          contents: cleanText,
          config: { outputDimensionality: 768 },
        }),
        6000,
        `Embed(${modelName}#${idx + 1})`
      );
      return response.embeddings?.[0]?.values || [];
    } catch (error) {
      lastError = error;
      log.warn(`[Embed] Key #${idx + 1} failed (${error.message?.slice(0, 100)})`);
    }
  }
  throw lastError || new Error("Embedding generation failed");
};

/**
 * Exponential backoff wrapper for API calls.
 */
export const withExponentialBackoff = async (fn, retries = 2, delay = 600) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      const msg = error.message || '';
      const status = error.status || error.code || 500;
      if (status === 429 || status === 503 || msg.includes('429') || msg.includes('503') || msg.includes('high demand') || msg.includes('timed out')) {
        log.warn(`AI API busy (${status}). Retrying ${i + 1}/${retries} in ${delay}ms...`);
        await new Promise((res) => setTimeout(res, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
};

/**
 * Parse topics flexibly from JSON object wrappers ({"topics": [...]}) or raw arrays.
 */
function extractTopicItems(rawText) {
  let cleanText = (rawText || '').trim();
  const jsonMatch = cleanText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) cleanText = jsonMatch[0];

  const parsed = JSON.parse(cleanText);
  let list = [];
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const candidate = parsed.topics?.topics || parsed.topics || parsed.questions || parsed.prompts || parsed.items;
    if (Array.isArray(candidate)) {
      list = candidate;
    } else if (typeof parsed.text === 'string') {
      list = [parsed];
    }
  }

  return list
    .map((item) => {
      if (typeof item === 'string') return { text: item.trim(), isBehavioral: false };
      if (item && typeof item === 'object') {
        const text = (item.text || item.topic || item.question || item.prompt || '').trim();
        return { text, isBehavioral: Boolean(item.isBehavioral) };
      }
      return null;
    })
    .filter((item) => item && item.text.length >= 15 && !item.text.startsWith('{') && !item.text.startsWith('['));
}

/**
 * Background topic cache refill with lock.
 * Uses Groq primary (ultra-fast, high quota) with Gemini failover, and releases DB promptly.
 */
const refillLock = new Set();

export const refillTopicCache = async (track, difficulty) => {
  const lockKey = `${track}-${difficulty}`;
  if (refillLock.has(lockKey)) return;
  refillLock.add(lockKey);

  log.info(`[Background] Refilling cache for ${track} - ${difficulty}`);
  try {
    const prompt = `Track: "${track}", Difficulty: "${difficulty}".
Generate 5 UNIQUE, creative, realistic impromptu speaking prompts tailored to this track and difficulty.
Return ONLY a valid JSON object matching this exact schema:
{"topics": [{"text": "prompt string", "isBehavioral": boolean}]}
Rule: Set isBehavioral=true ONLY if answering requires recounting a specific past personal/work story (STAR method).`;

    const text = await generateContent(prompt, DEFAULT_MODEL, {
      preferProvider: 'groq',
      preferFast: true,
      temperature: 0.85,
    });

    const topics = extractTopicItems(text);
    if (topics.length === 0) {
      log.warn(`[Background Cache] No valid topics parsed for ${track}/${difficulty}`);
      return;
    }

    const client = await pool.connect();
    try {
      for (const t of topics) {
        await client.query(
          `INSERT INTO generated_topics(track_name, difficulty, topic_text, is_behavioral, is_used) VALUES($1, $2, $3, $4, false) ON CONFLICT (topic_text) DO NOTHING`,
          [track, difficulty, t.text, t.isBehavioral]
        );
      }
      log.info(`[Background Cache] Inserted ${topics.length} topics for ${track}/${difficulty}`);
    } finally {
      client.release();
    }
  } catch (err) {
    log.error("[Background Cache] Refill failed:", err.message);
  } finally {
    refillLock.delete(lockKey);
  }
};
