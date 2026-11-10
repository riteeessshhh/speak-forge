/**
 * routes/topics.js — Live AI Topic Generation Route
 * 
 * POST / (mounted at /api/generate-topic)
 * Generates a fresh, non-repeating AI prompt on every call using Groq (primary, ~200-700ms)
 * with automatic Gemini fallback, and falls back to PostgreSQL unseen/LRU topics if APIs are offline.
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { log } from '../lib/logger.js';
import pool from '../db/pool.js';
import { verifyToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { topicSchema } from '../schemas/index.js';
import { generateContent, refillTopicCache } from '../lib/ai.js';
import {
  getUnseenTopic,
  getLruTopic,
  getRandomTopic,
  markTopicUsed,
} from '../db/queries.js';

const router = Router();

// Per-user in-memory recent topic tracker (prevents back-to-back repeats)
const recentUserTopics = new Map();

function recordRecentTopic(userId, text) {
  if (!userId || !text) return;
  const list = recentUserTopics.get(userId) || [];
  list.unshift(text);
  if (list.length > 20) list.pop();
  recentUserTopics.set(userId, list);
}

const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.user?.id || req.ip,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  message: { error: "Too many prompt requests. Please wait a moment." },
  standardHeaders: true,
  legacyHeaders: false,
});

function getTrackPromptGuidance(track, difficulty) {
  const t = (track || '').toLowerCase();
  if (t.includes('hr') || t.includes('behavioral')) {
    return `Arena: HR & Behavioral Interviews (Difficulty: ${difficulty}).
Focus: ${difficulty === 'easy'
      ? 'HR personality screening, career motivation, work ethic, strengths/weaknesses, teamwork basics.'
      : difficulty === 'medium'
        ? 'STAR behavioral scenarios: resolving team conflict, missing a deadline, handling tough feedback, taking ownership.'
        : 'Executive & leadership behavioral dilemmas: disagreeing with senior leadership, ethical gray areas, managing crisis/ambiguity.'}`;
  }
  if (t.includes('tech') || t.includes('cs')) {
    return `Arena: Core Computer Science & Software Engineering (Difficulty: ${difficulty}).
Focus: ${difficulty === 'easy'
      ? 'Core OOP concepts, basic SQL vs NoSQL/DBMS, HTTP/TCP networking basics, arrays/hashmaps, clean code analogies.'
      : difficulty === 'medium'
        ? 'OS processes/threads/deadlocks, DBMS indexing/ACID transactions, REST vs WebSockets, DSA trade-offs, caching strategies.'
        : 'Fresher System Design (URL shortener, rate limiter, chat app, feed), distributed consistency, database sharding, latency bottlenecks.'}`;
  }
  if (t.includes('story') || t.includes('social')) {
    return `Arena: Storytelling & Social Charisma (Difficulty: ${difficulty}).
Focus: ${difficulty === 'easy'
      ? 'Relatable everyday moments, hobbies, travel mishaps, memorable conversations, turning small talk into genuine connection.'
      : difficulty === 'medium'
        ? 'Turning failures into funny or meaningful stories, unexpected kindness, vivid descriptive storytelling with an emotional arc.'
        : 'Deep vulnerable or inspiring narratives, philosophical social prompts, captivating a skeptical dinner table in 60 seconds.'}`;
  }
  return `Arena: Never-Go-Blank Spontaneous Speaking Drill (Difficulty: ${difficulty}).
Focus: ${difficulty === 'easy'
    ? 'Fun, concrete everyday objects or quirky prompts where the speaker connects a simple thing to a personal viewpoint.'
    : difficulty === 'medium'
      ? 'Creative juxtapositions, unconventional scenarios, surprising analogies, defending an interesting perspective on the fly.'
      : 'Abstract metaphors, paradoxes, or high-pressure curveballs designed to test poise and zero-hesitation improv speaking.'}`;
}

function parseSingleTopic(rawJson) {
  let cleanJson = (rawJson || '').trim();
  const match = cleanJson.match(/\{[\s\S]*\}/);
  if (match) cleanJson = match[0];
  const parsed = JSON.parse(cleanJson);
  const text = (parsed?.text || parsed?.topic || parsed?.question || parsed?.prompt || '').trim();
  if (!text || text.length < 10) return null;
  return {
    text,
    isBehavioral: Boolean(parsed?.isBehavioral),
  };
}

router.post('/', verifyToken, generateLimiter, validate(topicSchema), async (req, res) => {
  const { track, difficulty, excludeTopics = [] } = req.validated;
  const userId = req.user.id;

  log.info(`Generating live topic for: ${track} (${difficulty}) | User: ${userId}`);

  const recentList = [...new Set([...(recentUserTopics.get(userId) || []), ...excludeTopics])].slice(0, 12);
  const avoidBlock = recentList.length > 0
    ? `\nDO NOT repeat or closely paraphrase any of these recent topics:\n- ${recentList.slice(0, 6).join('\n- ')}`
    : '';

  // Randomize creative angle slightly so consecutive live prompts stay super diverse
  const seedAngle = Math.floor(Math.random() * 100000);

  // 1. Live AI Synthesis FIRST (Groq primary ~200-700ms -> automatic Gemini fallback)
  try {
    const prompt = `${getTrackPromptGuidance(track, difficulty)}
Variation Seed: #${seedAngle}
Generate 1 BRAND NEW, engaging, crisp spoken prompt/question (1-2 sentences max, natural to answer in 60-90 seconds).${avoidBlock}

Return JSON ONLY matching this schema:
{"text": "the prompt or question", "isBehavioral": boolean}
Set isBehavioral=true ONLY if it specifically asks for a past personal/work example ("Tell me about a time...").`;

    const rawJson = await generateContent(prompt, undefined, {
      preferProvider: 'groq',
      preferFast: true,
      temperature: 0.9,
      timeoutMs: 9000,
    });

    const parsed = parseSingleTopic(rawJson);
    if (parsed) {
      recordRecentTopic(userId, parsed.text);
      log.info(`[Topic Engine] Live prompt ready: "${parsed.text.substring(0, 45)}..."`);

      // Persist asynchronously without blocking user response or holding DB lock
      pool.query(
        `INSERT INTO generated_topics(track_name, difficulty, topic_text, is_behavioral, is_used)
         VALUES($1, $2, $3, $4, true)
         ON CONFLICT (topic_text) DO UPDATE SET is_used = true`,
        [track, difficulty, parsed.text, parsed.isBehavioral]
      ).catch((dbErr) => log.warn(`[Topic Engine] Async topic persist skipped: ${dbErr.message}`));

      return res.json({
        topic: parsed.text,
        track,
        difficulty,
        isBehavioral: parsed.isBehavioral,
        source: 'live-ai',
      });
    }
  } catch (aiErr) {
    log.warn(`[Topic Engine] Live AI synthesis failed (${aiErr.message}). Checking DB cache...`);
  }

  // 2. Fallback: Query PostgreSQL DB cache if live AI synthesis couldn't complete
  let client;
  try {
    client = await pool.connect();
    let topic = null;
    if (userId) {
      topic = await getUnseenTopic(client, track, difficulty, userId);
      if (!topic) {
        topic = await getLruTopic(client, track, difficulty, userId);
      }
    }
    if (!topic) {
      topic = await getRandomTopic(client, track, difficulty);
    }

    if (topic) {
      recordRecentTopic(userId, topic.topic_text);
      if (topic.id) await markTopicUsed(client, topic.id);
      log.info(`[Topic Engine] Served DB cached topic: "${topic.topic_text.substring(0, 40)}..."`);

      // Trigger background refill cleanly
      refillTopicCache(track, difficulty).catch(() => {});

      return res.json({
        topic: topic.topic_text,
        track,
        difficulty,
        isBehavioral: topic.is_behavioral || false,
        source: 'db-cache',
      });
    }

    return res.status(503).json({ error: 'Forge is busy. Falling back to local data.' });
  } catch (dbError) {
    log.error("Topic route failed:", dbError.message);
    return res.status(503).json({ error: 'Forge is busy. Falling back to local data.' });
  } finally {
    if (client) client.release();
  }
});

export default router;
