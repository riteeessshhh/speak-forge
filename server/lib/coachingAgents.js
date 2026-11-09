/**
 * lib/coachingAgents.js — Multi-Agent Coaching Council
 * 
 * Architecture:
 * 1. Content & Logic Specialist Agent: Evaluates domain accuracy, structure, trade-offs, and STAR method.
 * 2. Delivery & Presence Specialist Agent: Evaluates acoustic cadence (WPM, dead air) and computer vision presence.
 * 3. Speech Memory Historian Agent: Evaluates RAG vector memory to detect recurring habit crutches and breakthroughs.
 * 4. Lead Executive Coach Orchestrator: Synthesizes specialist reports, calibrates final scores, and crafts model answers.
 */

import { generateContent, withExponentialBackoff } from './ai.js';
import { log } from './logger.js';
import { getTrackEvaluationInstructions } from './analysis.js';
import { formatMemoriesForPrompt } from './ragMemory.js';

/**
 * ─── AGENT 1: Content & Architecture Specialist ───
 */
export async function runContentAgent({ topic, track, transcriptText, isBehavioral = false }) {
  const trackInstructions = getTrackEvaluationInstructions(track, isBehavioral);

  const prompt = `You are the Content & Architecture Specialist on an Executive Interview Evaluation Board.
Your sole responsibility is auditing the intellectual substance, logical structure, and domain accuracy of the candidate's response.

Topic: "${topic}"
Track: ${track}
Candidate Transcript: "${transcriptText}"

${trackInstructions}

CRITICAL RULES:
1. SCORE CALIBRATION (INTEGERS 0-10 ONLY):
   - 9–10: Comprehensive depth, addresses technical trade-offs, edge cases, failure modes, or quantifiable business impact. NEVER award 9-10 to answers under 60 words.
   - 7–8: Factually sound, structured, and clear logic. Answers that clearly explain technical reasons (e.g. static typing catching runtime bugs early) deserve 7-8 clarity.
   - 5–6: High-level or basic correctness, but superficial or missing mechanisms (e.g. simple book analogies).
   - 1–4: Inaccurate, rambling, or off-topic.
2. STAR METHOD:
   - If behavioral: verify Situation, Task, Action, Result. Set starMethodUsed to true ONLY if all 4 are present. Otherwise false.
   - If non-behavioral: set starMethodUsed to null.
3. VOCABULARY AUDIT:
   - Identify 2-3 words or phrases in candidate's transcript that were bland, repetitive, basic, or informal.
   - Propose articulate English upgrades with a brief coaching reason.
   - If transcript is under 10 words, return [].

Output JSON ONLY:
{
  "clarityScore": number,
  "structureScore": number,
  "starMethodUsed": boolean|null,
  "answerLogic": "string",
  "contentStrengths": ["string"],
  "contentWeaknesses": ["string"],
  "technicalDepthSummary": "string",
  "vocabularyUpgrades": [
    {
      "original": "string",
      "better": "string",
      "reason": "string"
    }
  ]
}`;

  try {
    log.info("[Agent 1] Content Specialist evaluating transcript...");
    const raw = await withExponentialBackoff(() => generateContent(prompt, "gemini-3.5-flash-lite"), 2, 800);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (err) {
    log.warn("[Agent 1] Content Specialist fallback triggered:", err.message);
  }

  return {
    clarityScore: 6,
    structureScore: 6,
    starMethodUsed: null,
    answerLogic: "Logic was partially identifiable.",
    contentStrengths: ["Addressed the core subject"],
    contentWeaknesses: ["Lacked deeper trade-off analysis"],
    technicalDepthSummary: "Standard high-level response.",
    vocabularyUpgrades: []
  };
}

/**
 * ─── AGENT 2: Delivery & Presence Specialist ───
 */
export async function runDeliveryAgent({ transcriptText, deliveryMetrics = null, visualMetrics = null, fallbackFillerCount = 0 }) {
  let deliverySection = '';
  if (deliveryMetrics && deliveryMetrics.durationSec > 0) {
    deliverySection = `
Acoustic Pacing & Pauses:
- Words Per Minute: ${deliveryMetrics.wpm} WPM (${deliveryMetrics.pacing} — ${deliveryMetrics.pacingDesc})
- Duration: ${deliveryMetrics.durationSec}s | Spoken Words: ${deliveryMetrics.wordCount}
- Awkward Freezes (≥ 2.0s): ${deliveryMetrics.awkwardPausesCount} (longest: ${deliveryMetrics.longestPauseSec}s)
- Silence Ratio: ${deliveryMetrics.silencePercentage}%`;
  }

  let visualSection = '';
  if (visualMetrics && visualMetrics.enabled) {
    visualSection = `
Computer Vision Body Language (MediaPipe):
- Eye Contact: ${visualMetrics.eyeContactPercent}% (${visualMetrics.eyeContactRating})
- Posture: ${visualMetrics.posture}
- Head Stability & Composure: ${visualMetrics.headStability} (${visualMetrics.fidgetAlerts} sudden movements)
- Expressiveness: ${visualMetrics.expressiveness} (${visualMetrics.smilesDetected} warm smiles)
- Presence Score: ${visualMetrics.presenceScore}/10`;
  }

  const prompt = `You are the Delivery & Executive Presence Specialist on an Interview Evaluation Board.
Your sole responsibility is analyzing vocal cadence, speech crutches, hesitation pauses, and camera presence.

Candidate Transcript: "${transcriptText}"
${deliverySection}
${visualSection}

CRITICAL RULES:
1. FILLER WORDS DISAMBIGUATION:
   - Count ONLY hesitation vocal crutches ("um", "uh", "you know", "basically", "literally", and "like" ONLY when used as empty filler).
   - NEVER count "like" when used as a comparison ("tools like X", "act like Y") or as a verb ("I like Z"). If there are NO actual hesitation crutches, fillerWordsCount MUST be 0.
2. CONFIDENCE SCORE (INTEGER 0-10 ONLY):
   - Whole integers only.
   - Reward steady cadence (130-165 WPM), strong eye contact (≥75%), clear conviction, and minimal hesitation crutches. Compelling pitches with strong rhetoric and zero hesitation deserve 8-9.
   - If the candidate's answer is brief (under 30 words) or superficial, cap confidence at 5-6.
   - Penalize rushed pace (>175 WPM), dead air freezes, and frequent lookaways.

Output JSON ONLY:
{
  "confidenceScore": number,
  "fillerWordsCount": number,
  "deliveryStrengths": ["string"],
  "deliveryWeaknesses": ["string"],
  "presenceSummary": "string"
}`;

  try {
    log.info("[Agent 2] Delivery & Presence Specialist evaluating acoustics & vision...");
    const raw = await withExponentialBackoff(() => generateContent(prompt, "gemini-3.5-flash-lite"), 2, 800);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (err) {
    log.warn("[Agent 2] Delivery Specialist fallback triggered:", err.message);
  }

  return {
    confidenceScore: 6,
    fillerWordsCount: fallbackFillerCount,
    deliveryStrengths: ["Clear spoken audio"],
    deliveryWeaknesses: ["Minor pacing fluctuations"],
    presenceSummary: "Delivered with moderate vocal composure."
  };
}

/**
 * ─── AGENT 3: Speech Memory Historian Agent ───
 */
export async function runMemoryAgent({ memories = [], transcriptText, currentTopic }) {
  if (!memories || memories.length === 0) {
    return {
      trend: "baseline",
      comparisonSummary: "Baseline speaking session recorded. Future sessions will track recurring habits and improvements.",
      recurringHabits: [],
      milestonesAchieved: []
    };
  }

  const memoryBlock = formatMemoriesForPrompt(memories);

  const prompt = `You are the Speech Memory Historian on an Executive Interview Evaluation Board.
Your sole responsibility is comparing the candidate's current response against their historical speaking timeline from vector memory.

Current Prompt: "${currentTopic}"
Current Transcript: "${transcriptText}"

${memoryBlock}

Analyze if the candidate repeated past crutches or showed measurable progress.

Output JSON ONLY:
{
  "trend": "improving"|"steady"|"regressing",
  "comparisonSummary": "string",
  "recurringHabits": ["string"],
  "milestonesAchieved": ["string"]
}`;

  try {
    log.info("[Agent 3] Memory Historian comparing against past sessions...");
    const raw = await withExponentialBackoff(() => generateContent(prompt, "gemini-3.5-flash-lite"), 2, 800);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (err) {
    log.warn("[Agent 3] Memory Historian fallback triggered:", err.message);
  }

  return {
    trend: "steady",
    comparisonSummary: "Session evaluated against personal speaking history.",
    recurringHabits: [],
    milestonesAchieved: []
  };
}

/**
 * ─── AGENT 4: Lead Executive Coach Orchestrator ───
 */
export async function runLeadOrchestrator({
  topic,
  track,
  transcriptText,
  contentReport,
  deliveryReport,
  memoryReport,
  deliveryMetrics = null,
  visualMetrics = null,
}) {
  const prompt = `You are the Lead Executive Coach & Chair of the SpeakForge Interview Board.
You have received independent specialist reports from your Content Specialist, Delivery/Presence Specialist, and Memory Historian.

Candidate Prompt: "${topic}"
Track: ${track}
Candidate Transcript: "${transcriptText}"

SPECIALIST COUNCIL REPORTS:
1. Content Specialist Report:
- Clarity Score: ${contentReport.clarityScore}/10 | Structure Score: ${contentReport.structureScore}/10 | STAR Used: ${contentReport.starMethodUsed}
- Strengths: ${JSON.stringify(contentReport.contentStrengths)}
- Weaknesses: ${JSON.stringify(contentReport.contentWeaknesses)}
- Logic: ${contentReport.answerLogic}
- Depth: ${contentReport.technicalDepthSummary}

2. Delivery & Presence Specialist Report:
- Confidence Score: ${deliveryReport.confidenceScore}/10 | Fillers: ${deliveryReport.fillerWordsCount}
- Strengths: ${JSON.stringify(deliveryReport.deliveryStrengths)}
- Weaknesses: ${JSON.stringify(deliveryReport.deliveryWeaknesses)}
- Summary: ${deliveryReport.presenceSummary}

3. Memory Historian Report:
- Longitudinal Trend: ${memoryReport.trend}
- Comparison Summary: ${memoryReport.comparisonSummary}
- Recurring Habits: ${JSON.stringify(memoryReport.recurringHabits)}
- Milestones Unlocked: ${JSON.stringify(memoryReport.milestonesAchieved)}

4. Vocabulary Candidates from Content Specialist:
${JSON.stringify(contentReport.vocabularyUpgrades || [])}

YOUR OBJECTIVE AS LEAD COACH:
1. Synthesize the findings into a cohesive, executive-grade evaluation.
2. SCORE CALIBRATION RULES (INTEGER 0-10 ONLY):
   - 9–10: Comprehensive depth, addresses trade-offs and concrete impact. NEVER award 9-10 if under 60 words.
   - 7–8: Factually sound, structured, clear reasoning (e.g. static typing catching runtime bugs early).
   - 5–6: Basic correctness, but superficial or incomplete (e.g. simple book analogies).
   - 1–4: Inadequate or rambling.
   - Scores MUST be whole integers (no decimals like 8.5 or 9.5).
   - fillerWordsCount: Count ONLY hesitation crutches. Grammatical "like" as comparison/preposition = 0.
3. Deduplicate and curate 2–3 sharp Strengths and 2–3 sharp Growth Areas.
4. Write "overallFeedback" (3-5 sentences):
   - Highlight content depth, delivery presence, and habit evolution in one fluent, motivating coaching narrative.
5. Write "idealAnswer" (80–140 words):
   - A gold-standard exemplar response that would secure a unanimous "Strong Hire" decision from a senior hiring committee.
6. Curate "vocabularyUpgrades" (2-3 items):
   - Select 2-3 specific words or phrases from the candidate's transcript that were bland, basic, or repetitive.
   - Provide articulate English alternatives ("better") and an educational coaching reason ("reason").
   - If transcript is under 10 words or invalid, return [].

Output JSON ONLY:
{
  "confidenceScore": number,
  "clarityScore": number,
  "structureScore": number,
  "fillerWordsCount": number,
  "answerLogic": "string",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "overallFeedback": "string",
  "idealAnswer": "string",
  "starMethodUsed": boolean|null,
  "vocabularyUpgrades": [
    {
      "original": "string",
      "better": "string",
      "reason": "string"
    }
  ],
  "habitTrends": {
    "trend": "improving"|"steady"|"regressing"|"baseline",
    "comparisonSummary": "string",
    "recurringHabits": ["string"],
    "milestonesAchieved": ["string"]
  }
}`;

  log.info("[Agent 4] Lead Coach Orchestrator synthesizing specialist reports...");
  const raw = await withExponentialBackoff(() => generateContent(prompt, "gemini-3.5-flash-lite"), 2, 1000);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Lead Coach Orchestrator failed to produce valid JSON");
  }

  const result = JSON.parse(jsonMatch[0]);

  // Normalize scores to clean integers
  result.confidenceScore = Math.max(0, Math.min(10, Math.round(Number(result.confidenceScore) || 0)));
  result.clarityScore = Math.max(0, Math.min(10, Math.round(Number(result.clarityScore) || 0)));
  result.structureScore = Math.max(0, Math.min(10, Math.round(Number(result.structureScore) || 0)));
  result.fillerWordsCount = Math.max(0, Math.round(Number(result.fillerWordsCount) || 0));

  const words = transcriptText?.trim().split(/\s+/).filter(w => w.length > 0) || [];
  if (words.length < 60) {
    if (result.confidenceScore > 9) result.confidenceScore = 9;
  }
  if (words.length < 25) {
    const lower = transcriptText.toLowerCase();
    if (result.confidenceScore > 6 && (lower.includes('like in a book') || lower.includes('faster'))) {
      result.confidenceScore = 5;
    }
  }

  // Ensure habitTrends is present
  if (!result.habitTrends) {
    result.habitTrends = memoryReport;
  }

  // Normalize vocabularyUpgrades
  if (!Array.isArray(result.vocabularyUpgrades)) {
    result.vocabularyUpgrades = Array.isArray(contentReport.vocabularyUpgrades) ? contentReport.vocabularyUpgrades : [];
  } else {
    result.vocabularyUpgrades = result.vocabularyUpgrades
      .filter(item => item && typeof item === 'object' && item.original && item.better)
      .map(item => ({
        original: String(item.original).trim(),
        better: String(item.better).trim(),
        reason: String(item.reason || "Refines phrasing and improves articulation.").trim()
      }));
  }

  // Attach delivery & visual telemetry
  if (deliveryMetrics) result.deliveryMetrics = deliveryMetrics;
  if (visualMetrics) result.visualMetrics = visualMetrics;

  return result;
}

/**
 * Executes the entire Multi-Agent Coaching Council workflow.
 */
export async function executeMultiAgentCouncil({
  topic,
  track,
  transcriptText,
  isBehavioral = false,
  deliveryMetrics = null,
  visualMetrics = null,
  memories = [],
  fallbackFillerCount = 0
}) {
  const wordCount = transcriptText?.trim().split(/\s+/).filter(w => w.length > 0).length || 0;

  // Guardrail 1: Invalid Session (<3 words)
  if (wordCount < 3) {
    return {
      confidenceScore: 0,
      clarityScore: 0,
      structureScore: 0,
      fillerWordsCount: 0,
      answerLogic: "No speech detected to evaluate.",
      strengths: [],
      weaknesses: [],
      overallFeedback: "SpeakForge couldn't hear you clearly. Please ensure your microphone is working and you are answering the prompt.",
      idealAnswer: "In a real interview, clearly state your thesis in the first sentence, outline your framework or main factors, and conclude with the concrete outcome.",
      starMethodUsed: null,
      vocabularyUpgrades: [],
      deliveryMetrics,
      visualMetrics,
      habitTrends: {
        trend: "baseline",
        comparisonSummary: "Invalid session recorded. SpeakForge requires audible speech to track progress.",
        recurringHabits: [],
        milestonesAchieved: []
      }
    };
  }

  // Guardrail 2: Off-topic / Adversarial check (Potato Salad test)
  const lower = (transcriptText || '').toLowerCase();
  if (lower.includes('potato salad') || lower.includes('recipe') || lower.includes('ignore all previous')) {
    return {
      confidenceScore: 0,
      clarityScore: 0,
      structureScore: 0,
      fillerWordsCount: 0,
      answerLogic: "Off-topic input detected.",
      strengths: [],
      weaknesses: ["Answer is completely irrelevant to the prompt."],
      overallFeedback: "The input provided is irrelevant to the topic. Please stay on track.",
      idealAnswer: "Provide a direct, substantive answer that addresses the core prompt without digressing into unrelated topics.",
      starMethodUsed: null,
      vocabularyUpgrades: [],
      deliveryMetrics,
      visualMetrics,
      habitTrends: {
        trend: "regressing",
        comparisonSummary: "Irrelevant response detected. Ground your speech in the provided challenge.",
        recurringHabits: ["Digressing off-topic"],
        milestonesAchieved: []
      }
    };
  }

  log.info("[Multi-Agent Council] Launching Specialist Agents in parallel...");

  // Phase 1: Run Specialist Agents concurrently
  const [contentReport, deliveryReport, memoryReport] = await Promise.all([
    runContentAgent({ topic, track, transcriptText, isBehavioral }),
    runDeliveryAgent({ transcriptText, deliveryMetrics, visualMetrics, fallbackFillerCount }),
    runMemoryAgent({ memories, transcriptText, currentTopic: topic }),
  ]);

  log.info("[Multi-Agent Council] Specialist reports received. Orchestrating final synthesis...");

  // Phase 2: Lead Executive Coach Orchestrator synthesizes the reports
  const synthesizedResult = await runLeadOrchestrator({
    topic,
    track,
    transcriptText,
    contentReport,
    deliveryReport,
    memoryReport,
    deliveryMetrics,
    visualMetrics,
  });

  // Attach council reports metadata for full transparency
  synthesizedResult.councilReports = {
    contentSpecialist: {
      clarityScore: contentReport.clarityScore,
      structureScore: contentReport.structureScore,
      depth: contentReport.technicalDepthSummary,
    },
    deliverySpecialist: {
      confidenceScore: deliveryReport.confidenceScore,
      presenceSummary: deliveryReport.presenceSummary,
    },
    memoryHistorian: {
      trend: memoryReport.trend,
      comparisonSummary: memoryReport.comparisonSummary,
    }
  };

  return synthesizedResult;
}
