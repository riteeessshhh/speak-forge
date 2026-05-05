/**
 * ai.js — Gemini LLM Helpers (using @google/genai SDK)
 * 
 * Exports: generateContent, withExponentialBackoff, refillTopicCache
 */

import { GoogleGenAI } from '@google/genai';
import { log } from './logger.js';
import pool from '../db/pool.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Default model — gemini-1.5-flash (1500 RPD / 15 RPM free tier)
const DEFAULT_MODEL = "gemini-1.5-flash";

// Startup verification (no API call — zero quota usage)
log.info(`Gemini SDK initialized. Default model: '${DEFAULT_MODEL}'`);

/**
 * Generate content using Gemini.
 * @param {string} prompt - The prompt text
 * @param {string} [modelName] - Model to use (defaults to DEFAULT_MODEL)
 * @returns {Promise<string>} - The generated text
 */
export const generateContent = async (prompt, modelName = DEFAULT_MODEL) => {
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
  });
  return response.text;
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
    const prompt = `Track: "${track}", Difficulty: "${difficulty}". Generate 5 UNIQUE, creative, impromptu speaking questions. JSON array of objects ONLY. No markdown. Format: [{"text": "...", "isBehavioral": boolean}]. isBehavioral=true ONLY if past life/work example required.`;
    log.info(`[API Call] Gemini triggered (refillTopicCache)`);
    const text = await withExponentialBackoff(() => generateContent(prompt));

    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) cleanText = cleanText.replace(/```json\n?/, '').replace(/```\n?$/, '');
    else if (cleanText.startsWith('```')) cleanText = cleanText.replace(/```\n?/, '').replace(/```\n?$/, '');

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
