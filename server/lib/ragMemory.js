/**
 * lib/ragMemory.js — Long-Term Speech Memory & Habit Retrieval (RAG)
 * 
 * Uses PostgreSQL pgvector (HNSW) and Gemini embeddings (768-dim) to retrieve
 * a user's relevant past speaking performances, habits, and recurring blind spots.
 */

import { embedContent } from './ai.js';
import { log } from './logger.js';

/**
 * Retrieves top-k semantically relevant past sessions for a specific user.
 */
export async function retrieveUserSessionMemories(client, userId, queryText, limit = 3) {
  if (!userId || !queryText) return [];

  try {
    const embedding = await embedContent(queryText);
    if (!embedding || embedding.length === 0) {
      log.warn("[RAG] Failed to generate embedding for memory search");
      return [];
    }

    const vectorStr = `[${embedding.join(',')}]`;

    const result = await client.query(
      `SELECT 
         id,
         session_id,
         track_name,
         topic_text,
         transcript_summary,
         strengths,
         weaknesses,
         filler_word_count,
         wpm,
         awkward_pauses,
         eye_contact_percent,
         presence_score,
         confidence_score,
         clarity_score,
         structure_score,
         created_at,
         1 - (embedding <=> $2::vector) AS similarity
       FROM session_memories
       WHERE user_id = $1
       ORDER BY embedding <=> $2::vector ASC
       LIMIT $3`,
      [userId, vectorStr, limit]
    );

    log.info(`[RAG] Retrieved ${result.rows.length} relevant historical session memories for user ${userId}`);
    return result.rows;
  } catch (error) {
    log.error("[RAG] Error querying session memories:", error.message);
    return [];
  }
}

/**
 * Stores a completed session into the user's vector memory bank for future retrieval.
 */
export async function storeSessionMemory(client, {
  sessionId,
  userId,
  trackName,
  topicText,
  transcriptSummary,
  strengths = [],
  weaknesses = [],
  fillerWordCount = 0,
  wpm = null,
  awkwardPauses = 0,
  eyeContactPercent = null,
  presenceScore = null,
  confidenceScore = null,
  clarityScore = null,
  structureScore = null
}) {
  if (!sessionId || !userId || !topicText) return null;

  try {
    const semanticText = `Track: ${trackName}. Topic: ${topicText}. Performance: Confidence ${confidenceScore}/10, Clarity ${clarityScore}/10, Structure ${structureScore}/10. Delivery: ${wpm || 'normal'} WPM with ${fillerWordCount} fillers. Weaknesses noted: ${weaknesses.join('; ')}. Strengths: ${strengths.join('; ')}. Summary: ${transcriptSummary || 'N/A'}`;

    const embedding = await embedContent(semanticText);
    if (!embedding || embedding.length === 0) {
      log.warn("[RAG] Skipping memory storage — embedding failed");
      return null;
    }

    const vectorStr = `[${embedding.join(',')}]`;

    const result = await client.query(
      `INSERT INTO session_memories(
         session_id, user_id, track_name, topic_text, transcript_summary,
         strengths, weaknesses, filler_word_count, wpm, awkward_pauses,
         eye_contact_percent, presence_score, confidence_score, clarity_score, structure_score,
         embedding
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::vector)
       RETURNING id`,
      [
        sessionId,
        userId,
        trackName,
        topicText,
        transcriptSummary || '',
        strengths,
        weaknesses,
        fillerWordCount || 0,
        wpm,
        awkwardPauses || 0,
        eyeContactPercent,
        presenceScore,
        confidenceScore,
        clarityScore,
        structureScore,
        vectorStr
      ]
    );

    log.info(`[RAG] Session memory stored successfully (ID: ${result.rows[0].id})`);
    return result.rows[0].id;
  } catch (error) {
    log.error("[RAG] Failed to store session memory:", error.message);
    return null;
  }
}

/**
 * Formats retrieved memories into markdown instructions for Gemini's prompt.
 */
export function formatMemoriesForPrompt(memories = []) {
  if (!memories || memories.length === 0) {
    return `
════════════════════════════════════════════════════════════════
RAG LONG-TERM MEMORY (Session #1 Baseline):
════════════════════════════════════════════════════════════════
This is the candidate's baseline session (no previous sessions found in vector memory).
- Set habitTrends.trend to "baseline".
- Set habitTrends.comparisonSummary to: "This is your baseline session. SpeakForge has established your speaking profile and will track habit evolution in your upcoming sessions."
- Set habitTrends.recurringHabits to [].
- Set habitTrends.milestonesAchieved to [].`;
  }

  const memoryBlocks = memories.map((m, idx) => {
    const dateStr = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const simPct = Math.round((m.similarity || 0) * 100);
    const wpmStr = m.wpm ? `${m.wpm} WPM` : 'normal pace';
    const weaknessesStr = (m.weaknesses && m.weaknesses.length > 0) ? m.weaknesses.join('; ') : 'None documented';
    const strengthsStr = (m.strengths && m.strengths.length > 0) ? m.strengths.join('; ') : 'None documented';

    return `[Past Session #${idx + 1} (${simPct}% relevance | ${m.track_name} | ${dateStr})]:
- Topic: "${m.topic_text}"
- Scores: Confidence ${m.confidence_score}/10, Clarity ${m.clarity_score}/10, Structure ${m.structure_score}/10
- Delivery: ${wpmStr} | ${m.filler_word_count} filler words | ${m.awkward_pauses} awkward freezes
- Vision: Eye contact ${m.eye_contact_percent ? `${m.eye_contact_percent}%` : 'N/A'}, Presence ${m.presence_score ? `${m.presence_score}/10` : 'N/A'}
- Weaknesses Identified Then: ${weaknessesStr}
- Strengths Identified Then: ${strengthsStr}`;
  }).join('\n\n');

  return `
════════════════════════════════════════════════════════════════
RAG LONG-TERM SPEECH MEMORY & HABIT TRACKING:
════════════════════════════════════════════════════════════════
SpeakForge retrieved the candidate's previous relevant speaking sessions from PostgreSQL vector memory:

${memoryBlocks}

LONG-TERM HABIT COACHING RULES:
1. Compare today's performance directly against the candidate's historical habits above:
   - Did they eliminate or repeat past speech crutches (e.g. specific filler words, rushed pace, eye contact lapses)?
   - Did they address past structural blind spots (e.g. omitting trade-offs, weak closing hooks)?
2. Populate the "habitTrends" field in your JSON output:
   - "trend": MUST be one of "improving", "steady", or "regressing".
   - "comparisonSummary": 1–2 punchy, highly personalized coaching sentences highlighting specific improvements or regressions compared to their past sessions.
   - "recurringHabits": List of specific habits/weaknesses observed in both past sessions and today (e.g. ["Repeated 'basically' crutch", "Skipped trade-off analysis"]). Return [] if none repeated.
   - "milestonesAchieved": List of positive milestones unlocked today (e.g. ["Zero-Filler Session", "Stabilized pace from 180 to 142 WPM", "Improved eye contact from 50% to 85%"]). Return [] if none.`;
}
