/**
 * queries.js — Named Database Query Functions
 * 
 * All parameterized SQL queries as reusable functions.
 * Each function accepts a pool client and returns query results.
 */

import pool from './pool.js';

/* ── USER QUERIES ── */

export const findUserByEmail = async (client, email) => {
  const result = await client.query(
    'SELECT id, email, password_hash, created_at FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
};

export const createUser = async (client, email, passwordHash) => {
  const result = await client.query(
    'INSERT INTO users(email, password_hash) VALUES($1, $2) RETURNING id, email, created_at',
    [email.toLowerCase(), passwordHash]
  );
  return result.rows[0];
};

export const findUserById = async (client, id) => {
  const result = await client.query(
    'SELECT id, email, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};

/* ── TOPIC QUERIES ── */

export const countCachedTopics = async (client, track, difficulty) => {
  const result = await client.query(
    'SELECT COUNT(*) FROM generated_topics WHERE track_name = $1 AND difficulty = $2',
    [track, difficulty]
  );
  return parseInt(result.rows[0].count);
};

export const countUnseenTopics = async (client, track, difficulty, userId) => {
  const result = await client.query(
    `SELECT COUNT(*)::int as count
     FROM generated_topics g
     LEFT JOIN sessions s 
       ON g.topic_text = s.topic_text 
       AND s.user_id = $3
     WHERE g.track_name = $1 
       AND g.difficulty = $2 
       AND s.session_id IS NULL`,
    [track, difficulty, userId]
  );
  return result.rows[0].count;
};

export const getUnseenTopic = async (client, track, difficulty, userId) => {
  const result = await client.query(
    `SELECT g.id, g.topic_text, g.is_behavioral
     FROM generated_topics g
     LEFT JOIN sessions s 
       ON g.topic_text = s.topic_text 
       AND s.user_id = $3
     WHERE g.track_name = $1 
       AND g.difficulty = $2 
       AND s.session_id IS NULL
     ORDER BY RANDOM() LIMIT 1`,
    [track, difficulty, userId]
  );
  return result.rows[0] || null;
};

export const getLruTopic = async (client, track, difficulty, userId) => {
  const result = await client.query(
    `SELECT g.id, g.topic_text, g.is_behavioral
     FROM generated_topics g
     JOIN sessions s ON g.topic_text = s.topic_text
     WHERE g.track_name = $1 AND g.difficulty = $2 AND s.user_id = $3
     ORDER BY s.created_at ASC
     LIMIT 1`,
    [track, difficulty, userId]
  );
  return result.rows[0] || null;
};

export const getRandomTopic = async (client, track, difficulty) => {
  const result = await client.query(
    'SELECT id, topic_text, is_behavioral FROM generated_topics WHERE track_name = $1 AND difficulty = $2 ORDER BY RANDOM() LIMIT 1',
    [track, difficulty]
  );
  return result.rows[0] || null;
};

export const markTopicUsed = async (client, id) => {
  await client.query('UPDATE generated_topics SET is_used = true WHERE id = $1', [id]);
};

/* ── SESSION & RECORDING QUERIES ── */

export const insertSession = async (client, track, difficulty, topic, userId, status = 'completed', progressStep = 'ready', audioUrl = null) => {
  const result = await client.query(
    `INSERT INTO sessions(track_name, difficulty, topic_text, user_id, status, progress_step, audio_url) 
     VALUES($1, $2, $3, $4, $5, $6, $7) 
     RETURNING session_id`,
    [track, difficulty, topic, userId, status, progressStep, audioUrl]
  );
  return result.rows[0].session_id;
};

export const updateSessionStatus = async (client, sessionId, status, progressStep, errorMessage = null) => {
  await client.query(
    `UPDATE sessions 
     SET status = $1, progress_step = $2, error_message = $3 
     WHERE session_id = $4`,
    [status, progressStep, errorMessage, sessionId]
  );
};

export const getSessionWithAnalysis = async (client, sessionId, userId) => {
  const result = await client.query(
    `SELECT s.session_id, s.track_name, s.difficulty, s.topic_text, s.status, s.progress_step, s.error_message, s.created_at,
            COALESCE(r.s3_url, s.audio_url) AS s3_url, r.transcript, r.analysis_json,
            a.filler_word_count, a.confidence_score, a.clarity_score, a.structure_score
     FROM sessions s
     LEFT JOIN recordings r ON s.session_id = r.session_id
     LEFT JOIN analytics a ON s.session_id = a.session_id
     WHERE s.session_id = $1 AND s.user_id = $2`,
    [sessionId, userId]
  );
  return result.rows[0] || null;
};

export const insertRecording = async (client, sessionId, s3Url, transcript, analysisJson) => {
  const result = await client.query(
    `INSERT INTO recordings(session_id, s3_url, transcript, analysis_json) 
     VALUES($1, $2, $3, $4) 
     ON CONFLICT (session_id) DO UPDATE 
     SET s3_url = EXCLUDED.s3_url, transcript = EXCLUDED.transcript, analysis_json = EXCLUDED.analysis_json
     RETURNING recording_id`,
    [sessionId, s3Url, transcript, JSON.stringify(analysisJson)]
  );
  return result.rows[0]?.recording_id;
};

export const insertAnalytics = async (client, sessionId, userId, fillers, confidence, clarity, structure) => {
  await client.query(
    `INSERT INTO analytics(session_id, user_id, filler_word_count, confidence_score, clarity_score, structure_score)
     VALUES($1, $2, $3, $4, $5, $6)
     ON CONFLICT (session_id) DO UPDATE 
     SET filler_word_count = EXCLUDED.filler_word_count,
         confidence_score = EXCLUDED.confidence_score,
         clarity_score = EXCLUDED.clarity_score,
         structure_score = EXCLUDED.structure_score`,
    [sessionId, userId, fillers, confidence, clarity, structure]
  );
};

/* ── ANALYTICS QUERIES ── */

export const getRecentSessions = async (client, userId) => {
  const result = await client.query(
    `SELECT s.session_id, s.track_name, s.difficulty, s.topic_text, s.status, s.progress_step, s.error_message, s.created_at,
            a.filler_word_count, a.confidence_score, a.clarity_score, a.structure_score
     FROM sessions s
     LEFT JOIN analytics a ON s.session_id = a.session_id
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC
     LIMIT 10`,
    [userId]
  );
  return result.rows;
};

export const getAnalyticsSummary = async (client, userId) => {
  const result = await client.query(
    `SELECT 
       COUNT(*) as total_sessions,
       ROUND(AVG(a.confidence_score), 1) as avg_confidence,
       ROUND(AVG(a.clarity_score), 1) as avg_clarity,
       ROUND(AVG(a.structure_score), 1) as avg_structure,
       ROUND(AVG(a.filler_word_count), 1) as avg_fillers
     FROM analytics a
     WHERE a.user_id = $1`,
    [userId]
  );
  return result.rows[0];
};
