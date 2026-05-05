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
    // 1. Check if we have any topics in the database
    let topic = null;

    // Try unseen topic for this user
    if (userId) {
      topic = await getUnseenTopic(client, track, difficulty, userId);
      // Try LRU fallback if no unseen ones
      if (!topic) {
        topic = await getLruTopic(client, track, difficulty, userId);
      }
    }

    // Random fallback if still no topic
    if (!topic) {
      topic = await getRandomTopic(client, track, difficulty);
    }

    // 2. If we found a topic in DB, use it and RETURN immediately
    if (topic) {
      log.info(`Found topic in DB: "${topic.topic_text.substring(0, 30)}..."`);
      await markTopicUsed(client, topic.id);
      return res.json({
        topic: topic.topic_text,
        track,
        difficulty,
        isBehavioral: topic.is_behavioral || false,
      });
    }

    // 3. ONLY if DB is completely empty, call Gemini to generate fresh ones
    log.warn(`No topics found in DB for ${track}/${difficulty}. Generating fresh via Gemini...`);
    const prompt = `Generate 5 unique impromptu speaking questions for "${track}" at "${difficulty}". JSON array: [{"text": "...", "isBehavioral": boolean}].`;
    log.info("[API Call] Gemini triggered (fresh-generation)");
    let text = await withExponentialBackoff(() => generateContent(prompt, "gemini-1.5-flash"), 2, 1000);
    text = text.trim();
    if (text.startsWith('```json')) text = text.replace(/```json\n?/, '').replace(/```\n?$/, '');
    else if (text.startsWith('```')) text = text.replace(/```\n?/, '').replace(/```\n?$/, '');

    let fallbackTopics = [];
    try {
      fallbackTopics = JSON.parse(text);
      if (!Array.isArray(fallbackTopics)) throw new Error();
      
      // Save all 5 generated topics to the database for future use
      for (const t of fallbackTopics) {
        await client.query(
          `INSERT INTO generated_topics(track_name, difficulty, topic_text, is_behavioral, is_used) 
           VALUES($1, $2, $3, $4, false) ON CONFLICT (topic_text) DO NOTHING`,
          [track, difficulty, t.text || t, t.isBehavioral || false]
        );
      }
    } catch(e) {
      fallbackTopics = [{text: text, isBehavioral: false}];
    }

    const finalTopic = fallbackTopics[0];
    return res.json({
      topic: finalTopic?.text || text,
      track,
      difficulty,
      isBehavioral: finalTopic?.isBehavioral || false,
    });

  } catch (error) {
    log.error("Topic generation failed:", error.message);
    res.status(503).json({ error: 'Forge is busy. Falling back to local data.' });
  } finally {
    client.release();
  }
});

export default router;
