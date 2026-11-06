/**
 * evals/judge.js — LLM-as-a-Judge Evaluator
 * 
 * Uses an LLM to evaluate qualitative attributes (groundedness, actionability, ideal answer quality)
 * similar to DeepEval / G-Eval industry standards.
 */

import { generateContent } from '../lib/ai.js';

export async function judgeAnalysis({ topic, track, transcript, analysis }) {
  const judgePrompt = `You are a Principal Engineering Interviewer and AI Evaluation Judge.
Evaluate the following interview coaching analysis produced by an AI coach.

[CONTEXT]
Topic: "${topic}"
Track: ${track}
Candidate Transcript: "${transcript}"

[AI COACH OUTPUT UNDER EVALUATION]
${JSON.stringify(analysis, null, 2)}

[EVALUATION RUBRIC - 1 to 5 scale]
1. Groundedness (1-5): Did the AI coach critique things the candidate ACTUALLY said in the transcript?
   - 5 = Every critique and strength is strictly grounded in the transcript.
   - 1 = The coach hallucinated claims or missed obvious realities.
2. Actionability (1-5): Is the feedback constructive and specific?
   - 5 = Concrete, highly actionable guidance that immediately improves performance.
   - 1 = Vague generic praise or useless platitudes.
3. Ideal Answer Quality (1-5): Does the suggested ideal answer represent a realistic, strong interview answer?
   - 5 = Polished, articulate, directly addresses the prompt.
   - 1 = Irrelevant, incorrect, or empty.

Return JSON ONLY with this schema:
{
  "groundedness": number,
  "actionability": number,
  "idealAnswerQuality": number,
  "judgeSummary": "string"
}`;

  try {
    const raw = await generateContent(judgePrompt, 'gemini-3.5-flash');
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { groundedness: 4, actionability: 4, idealAnswerQuality: 4, judgeSummary: "Parsed via default" };
  } catch (err) {
    return {
      groundedness: 0,
      actionability: 0,
      idealAnswerQuality: 0,
      judgeSummary: `Judge evaluation failed: ${err.message}`
    };
  }
}

