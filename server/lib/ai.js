/**
 * ai.js — Gemini LLM Helpers (using @google/genai SDK)
 * 
 * Exports: generateContent, withExponentialBackoff, refillTopicCache
 */

import { GoogleGenAI } from '@google/genai';
import { log } from './logger.js';
import pool from '../db/pool.js';

const keys = [
  process.env.GEMINI_API_KEY_PRIMARY,
  process.env.GEMINI_API_KEY_FALLBACK
].filter(Boolean);

let currentKeyIndex = 0;
let ai = new GoogleGenAI({ apiKey: keys[currentKeyIndex] });

const rotateKey = () => {
  if (keys.length < 2) return false;
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  ai = new GoogleGenAI({ apiKey: keys[currentKeyIndex] });
  log.warn(`API Quota hit. Rotating to Gemini Key #${currentKeyIndex + 1}...`);
  return true;
};

// Default model — gemini-3.5-flash-lite
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

/**
 * Generate content using Gemini with automatic key rotation on quota limits.
 * Native JSON mode (responseMimeType: 'application/json') is enabled by default.
 */
export const generateContent = async (prompt, modelName = DEFAULT_MODEL, config = {}) => {
  const requestConfig = {
    responseMimeType: "application/json",
    ...config,
  };

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: requestConfig,
    });
    return response.text;
  } catch (error) {
    const status = error.status || error.code || 500;
    const msg = error.message || "";
    
    // If Quota Exceeded, attempt rotation
    if (status === 429 || msg.includes("Quota") || msg.includes("limit")) {
      if (rotateKey()) {
        // Re-attempt with new key
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: requestConfig,
        });
        return response.text;
      }
    }
    throw error;
  }
};

/**
 * Generate 768-dimensional text embedding for RAG semantic search.
 */
export const embedContent = async (text, modelName = "gemini-embedding-001") => {
  const cleanText = (text || '').trim();
  if (!cleanText) return [];

  const callEmbed = async () => {
    const response = await ai.models.embedContent({
      model: modelName,
      contents: cleanText,
      config: {
        outputDimensionality: 768,
      },
    });
    return response.embeddings?.[0]?.values || [];
  };

  try {
    return await callEmbed();
  } catch (error) {
    const status = error.status || error.code || 500;
    const msg = error.message || "";
    if (status === 429 || msg.includes("Quota") || msg.includes("limit")) {
      if (rotateKey()) {
        return await callEmbed();
      }
    }
    throw error;
  }
};

/**
 * Exponential backoff wrapper for API calls.
 */
export const withExponentialBackoff = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      const msg = error.message || '';
      const status = error.status || error.code || 500;
      if (status === 429 || status === 503 || msg.includes('429') || msg.includes('503') || msg.includes('high demand')) {
        log.warn(`Gemini API busy (${status}). Retrying ${i + 1}/${retries} in ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
};

/**
 * Background topic cache refill with lock.
 */
const refillLock = new Set();

export const refillTopicCache = async (track, difficulty) => {
  const lockKey = `${track}-${difficulty}`;
  if (refillLock.has(lockKey)) return;
  refillLock.add(lockKey);

  log.info(`[Background] Refilling cache for ${track} - ${difficulty}`);
  const client = await pool.connect();
  try {
    const prompt = `Track: "${track}", Difficulty: "${difficulty}". Generate 5 UNIQUE, creative, impromptu speaking questions. JSON array of objects ONLY. Format: [{"text": "...", "isBehavioral": boolean}]. isBehavioral=true ONLY if past life/work example required.`;
    log.info(`[API Call] Gemini triggered (refillTopicCache)`);
    const text = await withExponentialBackoff(() => generateContent(prompt));

    let cleanText = text.trim();
    // Regex extraction fallback: extract JSON array [...] or object {} if surrounded by backticks or text
    const jsonMatch = cleanText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    }

    let topics = [];
    try {
      topics = JSON.parse(cleanText);
      if (!Array.isArray(topics)) throw new Error();
    } catch(e) {
      topics = cleanText.split('\n').map(t => t.replace(/^[0-9.\-"'\s]+/, '').trim()).filter(t => t.length > 10).map(t => ({text: t, isBehavioral: false}));
    }
    
    for (const t of topics) {
      await client.query(
        `INSERT INTO generated_topics(track_name, difficulty, topic_text, is_behavioral, is_used) VALUES($1, $2, $3, $4, false) ON CONFLICT (topic_text) DO NOTHING`,
        [track, difficulty, t.text || t, t.isBehavioral || false]
      );
    }
    log.info("[Background Cache] Successfully refilled topics");
  } catch (err) {
    log.error("[Background Cache] Refill failed:", err.message);
  } finally {
    client.release();
    refillLock.delete(lockKey);
  }
};
