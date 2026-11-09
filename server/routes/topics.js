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
  countUnseenTopics,
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

  try {
    let unseenCount = 0;

    // 1. Check unseen count (short-lived connection)
    const countClient = await pool.connect();
    try {
      if (userId) {
        unseenCount = await countUnseenTopics(countClient, track, difficulty, userId);
        log.info(`User: ${userId} has ${unseenCount} unseen topics for ${track}/${difficulty}`);
      }
    } finally {
      countClient.release();
    }

    // 2. Proactive Refill: If unseenCount is less than 3, trigger Gemini to generate 5 more
    if (unseenCount < 3) {
      log.info(`Low unseen topics count (${unseenCount}) for ${track}/${difficulty}. Proactively refilling cache...`);
      await refillTopicCache(track, difficulty);
    }

    // 3. Get topic and return (short-lived connection)
    const client = await pool.connect();
    try {
      let topic = null;
      if (userId) {
        topic = await getUnseenTopic(client, track, difficulty, userId);
      }

      // If user has seen all topics or DB cache is empty, synthesize a fresh novel topic LIVE on-demand!
      if (!topic) {
        log.info(`[Topic Engine] Generating fresh, unique prompt on-demand for ${track}/${difficulty}...`);
        try {
          const onDemandPrompt = `Track: "${track}", Difficulty: "${difficulty}". Generate 1 BRAND NEW, creative, challenging, impromptu speaking question.
JSON ONLY format: {"text": "the prompt text", "isBehavioral": boolean}.
isBehavioral must be true if past work/life experience is needed, false otherwise.`;

          const rawJson = await generateContent(onDemandPrompt);
          let cleanJson = (rawJson || '').trim();
          const match = cleanJson.match(/\{[\s\S]*\}/);
          if (match) cleanJson = match[0];
          const parsed = JSON.parse(cleanJson);

          if (parsed && (parsed.text || parsed.topic)) {
            const promptText = (parsed.text || parsed.topic).trim();
            const isBehavioral = Boolean(parsed.isBehavioral);

            // Insert into DB and mark used
            const insertRes = await client.query(
              `INSERT INTO generated_topics(track_name, difficulty, topic_text, is_behavioral, is_used)
               VALUES($1, $2, $3, $4, true)
               ON CONFLICT (topic_text) DO UPDATE SET is_used = true
               RETURNING id, topic_text, is_behavioral`,
              [track, difficulty, promptText, isBehavioral]
            );
            topic = insertRes.rows[0] || { id: null, topic_text: promptText, is_behavioral: isBehavioral };
            log.info(`[Topic Engine] Successfully synthesized on-demand topic: "${promptText.substring(0, 35)}..."`);
          }
        } catch (synthErr) {
          log.warn(`[Topic Engine] On-demand live synthesis failed (${synthErr.message}). Attempting DB fallback...`);
        }
      }

      // Secondary fallback to LRU or random if live synthesis had an error
      if (!topic && userId) {
        topic = await getLruTopic(client, track, difficulty, userId);
      }
      if (!topic) {
        topic = await getRandomTopic(client, track, difficulty);
      }

      // 4. Return the selected topic
      if (topic) {
        log.info(`Found topic: "${topic.topic_text.substring(0, 30)}..."`);
        if (topic.id) await markTopicUsed(client, topic.id);
        return res.json({
          topic: topic.topic_text,
          track,
          difficulty,
          isBehavioral: topic.is_behavioral || false,
        });
      }

      res.status(503).json({ error: 'Forge is busy. Falling back to local data.' });
    } finally {
      client.release();
    }

  } catch (error) {
    log.error("Topic generation failed:", error.message);
    res.status(503).json({ error: 'Forge is busy. Falling back to local data.' });
  }
});

export default router;
