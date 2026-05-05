/**
 * routes/analytics.js — Analytics Summary Routes
 * 
 * GET /summary (mounted at /api/analytics)
 */

import { Router } from 'express';
import { log } from '../lib/logger.js';
import pool from '../db/pool.js';
import { verifyToken } from '../middleware/auth.js';
import { getRecentSessions, getAnalyticsSummary } from '../db/queries.js';

const router = Router();

/**
 * GET /summary
 * Returns the last 10 sessions with atomic metrics for the authenticated user.
 */
router.get('/summary', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const client = await pool.connect();
  try {
    const sessions = await getRecentSessions(client, userId);
    const summary = await getAnalyticsSummary(client, userId);

    res.json({
      sessions,
      summary
    });
  } catch (err) {
    log.error('Analytics fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch analytics.' });
  } finally {
    client.release();
  }
});

export default router;
