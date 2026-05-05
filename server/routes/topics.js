/**
 * routes/topics.js — Topic Generation Route
 * 
 * POST / (mounted at /api/generate-topic)
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { log } from '../lib/logger.js';
import pool from '../db/pool.js';
import { verifyToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { topicSchema } from '../schemas/index.js';
import { generateContent, withExponentialBackoff, refillTopicCache } from '../lib/ai.js';
import {
  countCachedTopics,
  getUnseenTopic,
  getLruTopic,
  getRandomTopic,
  markTopicUsed,
} from '../db/queries.js';

const router = Router();

const generateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: { error: "Forge is busy. Falling back to local data." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', verifyToken, generateLimiter, validate(topicSchema), async (req, res) => {
  const { track, difficulty } = req.validated;
  const userId = req.user.id;

  log.info(`Generating topic for: ${track} | User: ${userId}`);
  const client = await pool.connect();

  try {
    // 1. Check cache size — trigger background refill if low
    const count = await countCachedTopics(client, track, difficulty);
    if (count < 5) {
      refillTopicCache(track, difficulty);
    }

    let topic = null;

    // 2. Try unseen topic for this user
    if (userId) {
      topic = await getUnseenTopic(client, track, difficulty, userId);
      // 3. LRU fallback
      if (!topic) {
        topic = await getLruTopic(client, track, difficulty, userId);
      }
    }

    // 4. Random fallback
    if (!topic) {
      topic = await getRandomTopic(client, track, difficulty);
    }

    if (topic) {
      await markTopicUsed(client, topic.id);
      return res.json({
        topic: topic.topic_text,
        track,
        difficulty,
        isBehavioral: topic.is_behavioral || false,
      });
    }

    // 5. Synchronous Gemini fallback (cache completely empty or forced)
    log.warn("Cache low or empty, synchronous fallback generation...");
    const prompt = `Generate 1 unique, highly specific impromptu speaking question for "${track}" at "${difficulty}". JSON array: [{"text": "...", "isBehavioral": boolean}].`;
    log.info("[API Call] Gemini triggered (fallback-generate)");
    let text = await withExponentialBackoff(() => generateContent(prompt), 2, 1000);
    text = text.trim();
    if (text.startsWith('```json')) text = text.replace(/```json\n?/, '').replace(/```\n?$/, '');
    else if (text.startsWith('```')) text = text.replace(/```\n?/, '').replace(/```\n?$/, '');

    let fallbackTopics = [];
    try {
      fallbackTopics = JSON.parse(text);
    } catch(e) {
      fallbackTopics = [{text: text, isBehavioral: false}];
    }
    return res.json({
      topic: fallbackTopics[0]?.text || text,
      track,
      difficulty,
      isBehavioral: fallbackTopics[0]?.isBehavioral || false,
    });

  } catch (error) {
    log.error("Topic generation failed:", error.message);
    res.status(503).json({ error: 'Forge is busy. Falling back to local data.' });
  } finally {
    client.release();
  }
});

export default router;
