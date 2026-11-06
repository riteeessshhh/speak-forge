/**
 * evals/runner.js — Automated Evaluation Runner for SpeakForge
 * 
 * Usage:
 *   node evals/runner.js           # Fast deterministic & schema evals
 *   node evals/runner.js --judge   # Includes LLM-as-a-Judge qualitative ratings
 */

import '../lib/env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeTranscript, analysisResultSchema } from '../lib/analysis.js';
import { judgeAnalysis } from './judge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

async function runEvals() {
  const args = process.argv.slice(2);
  const includeJudge = args.includes('--judge');
  const filterArg = args.find(a => a.startsWith('--filter='));
  const filterId = filterArg ? filterArg.split('=')[1] : null;

  console.log(`\n${colors.bright}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  ⚡ SPEAKFORGE PRODUCTION EVALUATION HARNESS ⚡  ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.gray}Mode: ${includeJudge ? 'Full (Deterministic + LLM-as-a-Judge)' : 'Fast (Schema & Rule Assertions)'}${colors.reset}\n`);

  const datasetPath = path.join(__dirname, 'golden_dataset.json');
  if (!fs.existsSync(datasetPath)) {
    console.error(`${colors.red}Dataset not found at ${datasetPath}${colors.reset}`);
    process.exit(1);
  }

  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  const testCases = filterId ? dataset.filter(tc => tc.id === filterId) : dataset;

  if (testCases.length === 0) {
    console.error(`${colors.yellow}No test cases found matching filter: ${filterId}${colors.reset}`);
    process.exit(1);
  }

  const results = [];
  let passedCount = 0;
  let schemaValidCount = 0;
  let totalLatencyMs = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`${colors.bright}[${i + 1}/${testCases.length}] Testing: ${tc.name} (${tc.id})${colors.reset}`);
    console.log(`${colors.gray}  Track: ${tc.track} | Topic: "${tc.topic.slice(0, 50)}..."${colors.reset}`);

    const startTime = Date.now();
    let analysisOutput;
    let runError = null;

    try {
      analysisOutput = await analyzeTranscript({
        topic: tc.topic,
        track: tc.track,
        transcriptText: tc.transcript,
        isBehavioral: tc.isBehavioral || false,
      });
    } catch (err) {
      runError = err;
    }

    const latencyMs = Date.now() - startTime;
    totalLatencyMs += latencyMs;

    if (runError) {
      console.log(`  ${colors.red}✖ RUN ERROR:${colors.reset} ${runError.message} (${latencyMs}ms)\n`);
      results.push({
        id: tc.id,
        name: tc.name,
        passed: false,
        latencyMs,
        errors: [`Execution failed: ${runError.message}`],
      });
      continue;
    }

    const { analysisJson, usedModel } = analysisOutput;
    const failures = [];

    // 1. Schema Conformance
    const schemaResult = analysisResultSchema.safeParse(analysisJson);
    if (!schemaResult.success) {
      failures.push(`Schema Error: ${schemaResult.error.message}`);
    } else {
      schemaValidCount++;
    }

    // 2. Deterministic Assertions
    const exp = tc.expected;
    if (exp.confidenceScore !== undefined && analysisJson.confidenceScore !== exp.confidenceScore) {
      failures.push(`confidenceScore expected ${exp.confidenceScore}, got ${analysisJson.confidenceScore}`);
    }
    if (exp.minConfidenceScore !== undefined && analysisJson.confidenceScore < exp.minConfidenceScore) {
      failures.push(`confidenceScore expected >= ${exp.minConfidenceScore}, got ${analysisJson.confidenceScore}`);
    }
    if (exp.maxConfidenceScore !== undefined && analysisJson.confidenceScore > exp.maxConfidenceScore) {
      failures.push(`confidenceScore expected <= ${exp.maxConfidenceScore}, got ${analysisJson.confidenceScore}`);
    }

    if (exp.clarityScore !== undefined && analysisJson.clarityScore !== exp.clarityScore) {
      failures.push(`clarityScore expected ${exp.clarityScore}, got ${analysisJson.clarityScore}`);
    }
    if (exp.minClarityScore !== undefined && analysisJson.clarityScore < exp.minClarityScore) {
      failures.push(`clarityScore expected >= ${exp.minClarityScore}, got ${analysisJson.clarityScore}`);
    }
    if (exp.maxClarityScore !== undefined && analysisJson.clarityScore > exp.maxClarityScore) {
      failures.push(`clarityScore expected <= ${exp.maxClarityScore}, got ${analysisJson.clarityScore}`);
    }

    if (exp.structureScore !== undefined && analysisJson.structureScore !== exp.structureScore) {
      failures.push(`structureScore expected ${exp.structureScore}, got ${analysisJson.structureScore}`);
    }
    if (exp.minStructureScore !== undefined && analysisJson.structureScore < exp.minStructureScore) {
      failures.push(`structureScore expected >= ${exp.minStructureScore}, got ${analysisJson.structureScore}`);
    }
    if (exp.maxStructureScore !== undefined && analysisJson.structureScore > exp.maxStructureScore) {
      failures.push(`structureScore expected <= ${exp.maxStructureScore}, got ${analysisJson.structureScore}`);
    }

    if (exp.fillerWordsCount !== undefined && analysisJson.fillerWordsCount !== exp.fillerWordsCount) {
      failures.push(`fillerWordsCount expected ${exp.fillerWordsCount}, got ${analysisJson.fillerWordsCount}`);
    }
    if (exp.minFillerWords !== undefined && analysisJson.fillerWordsCount < exp.minFillerWords) {
      failures.push(`fillerWordsCount expected >= ${exp.minFillerWords}, got ${analysisJson.fillerWordsCount}`);
    }
    if (exp.maxFillerWords !== undefined && analysisJson.fillerWordsCount > exp.maxFillerWords) {
      failures.push(`fillerWordsCount expected <= ${exp.maxFillerWords}, got ${analysisJson.fillerWordsCount}`);
    }

    if (exp.starMethodUsed !== undefined && analysisJson.starMethodUsed !== exp.starMethodUsed) {
      failures.push(`starMethodUsed expected ${exp.starMethodUsed}, got ${analysisJson.starMethodUsed}`);
    }

    if (exp.feedbackContains && !analysisJson.overallFeedback.toLowerCase().includes(exp.feedbackContains.toLowerCase())) {
      failures.push(`overallFeedback should contain "${exp.feedbackContains}"`);
    }
    if (exp.feedbackMustNotContain && analysisJson.overallFeedback.toLowerCase().includes(exp.feedbackMustNotContain.toLowerCase())) {
      failures.push(`overallFeedback should NOT contain "${exp.feedbackMustNotContain}"`);
    }

    if (exp.minStrengthsCount !== undefined && (!analysisJson.strengths || analysisJson.strengths.length < exp.minStrengthsCount)) {
      failures.push(`strengths length expected >= ${exp.minStrengthsCount}, got ${analysisJson.strengths?.length || 0}`);
    }
    if (exp.minWeaknessesCount !== undefined && (!analysisJson.weaknesses || analysisJson.weaknesses.length < exp.minWeaknessesCount)) {
      failures.push(`weaknesses length expected >= ${exp.minWeaknessesCount}, got ${analysisJson.weaknesses?.length || 0}`);
    }

    if (exp.weaknessesMentionFiller) {
      const mentionsFiller = analysisJson.weaknesses.some(w => /filler|crutch|hesitation|pause/i.test(w)) ||
                             /filler|crutch/i.test(analysisJson.overallFeedback);
      if (!mentionsFiller) {
        failures.push(`Expected weaknesses or feedback to mention filler words`);
      }
    }

    // 3. Optional LLM Judge
    let judgeResult = null;
    if (includeJudge) {
      process.stdout.write(`  ${colors.gray}Evaluating with LLM Judge...${colors.reset}`);
      judgeResult = await judgeAnalysis({
        topic: tc.topic,
        track: tc.track,
        transcript: tc.transcript,
        analysis: analysisJson,
      });
      console.log(` Done.`);
    }

    const passed = failures.length === 0;
    if (passed) passedCount++;

    const badge = passed ? `${colors.green}✔ PASS${colors.reset}` : `${colors.red}✖ FAIL${colors.reset}`;
    console.log(`  ${badge} (${latencyMs}ms | model: ${usedModel})`);
    console.log(`  Scores -> Confidence: ${analysisJson.confidenceScore}, Clarity: ${analysisJson.clarityScore}, Structure: ${analysisJson.structureScore}, Fillers: ${analysisJson.fillerWordsCount}, STAR: ${analysisJson.starMethodUsed}`);

    if (judgeResult) {
      console.log(`  Judge  -> Groundedness: ${judgeResult.groundedness}/5 | Actionability: ${judgeResult.actionability}/5 | Quality: ${judgeResult.idealAnswerQuality}/5`);
      console.log(`  Summary: "${judgeResult.judgeSummary}"`);
    }

    if (!passed) {
      failures.forEach(f => console.log(`    ${colors.red}↳ ${f}${colors.reset}`));
    }
    console.log('');

    results.push({
      id: tc.id,
      name: tc.name,
      passed,
      latencyMs,
      usedModel,
      scores: {
        confidence: analysisJson.confidenceScore,
        clarity: analysisJson.clarityScore,
        structure: analysisJson.structureScore,
        fillers: analysisJson.fillerWordsCount,
        starMethodUsed: analysisJson.starMethodUsed,
      },
      failures,
      judgeResult,
    });
  }

  // Summary Metrics
  const passRate = Math.round((passedCount / testCases.length) * 100);
  const schemaRate = Math.round((schemaValidCount / testCases.length) * 100);
  const avgLatency = Math.round(totalLatencyMs / testCases.length);

  console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bright}  EVALUATION SUMMARY${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}`);
  console.log(`  Total Test Cases:    ${testCases.length}`);
  console.log(`  Passed:              ${passedCount === testCases.length ? colors.green : colors.yellow}${passedCount}/${testCases.length} (${passRate}%)${colors.reset}`);
  console.log(`  Schema Conformance:  ${schemaRate === 100 ? colors.green : colors.red}${schemaRate}%${colors.reset}`);
  console.log(`  Average Latency:     ${avgLatency} ms`);
  console.log(`${colors.cyan}====================================================${colors.reset}\n`);

  // Write Results
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    total: testCases.length,
    passed: passedCount,
    failed: testCases.length - passedCount,
    passRate,
    schemaConformanceRate: schemaRate,
    averageLatencyMs: avgLatency,
    results,
  };

  fs.writeFileSync(path.join(resultsDir, 'latest-report.json'), JSON.stringify(report, null, 2));

  // Write Markdown Report
  const mdReport = `# ⚡ SpeakForge LLM Evaluation Report
**Timestamp**: ${report.timestamp}  
**Overall Pass Rate**: ${passRate}% (${passedCount}/${testCases.length})  
**Schema Conformance**: ${schemaRate}%  
**Average Latency**: ${avgLatency}ms  

| ID | Name | Status | Latency | Conf | Clar | Struct | Fillers | STAR | Failures |
|---|---|---|---|---|---|---|---|---|---|
${results.map(r => `| \`${r.id}\` | ${r.name} | ${r.passed ? '✅ PASS' : '❌ FAIL'} | ${r.latencyMs}ms | ${r.scores?.confidence ?? '-'} | ${r.scores?.clarity ?? '-'} | ${r.scores?.structure ?? '-'} | ${r.scores?.fillers ?? '-'} | ${r.scores?.starMethodUsed ?? '-'} | ${r.failures.length ? r.failures.join('<br>') : 'None'} |`).join('\n')}
`;

  fs.writeFileSync(path.join(resultsDir, 'latest-report.md'), mdReport);
  console.log(`${colors.gray}Results saved to: evals/results/latest-report.json & latest-report.md${colors.reset}\n`);

  process.exit(passedCount === testCases.length ? 0 : 1);
}

runEvals();

