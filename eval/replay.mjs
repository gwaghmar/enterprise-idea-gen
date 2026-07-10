// Golden-set replay harness.
//
//   node eval/replay.mjs --fixtures
//       Score the captured fixtures for each case. Fast, offline, no API cost.
//       Proves the scoring engine + assertions work, and is the regression
//       guard for the harness itself. Runs in CI.
//
//   node eval/replay.mjs --live --url https://pilotplan.vercel.app [--case <id>]
//       Run each case's input through the REAL /api/generate pipeline, parse
//       the SSE stream, score the final report. This is the true regression
//       check before shipping a prompt/pipeline change. Costs real API calls
//       (~$0.05 and ~60s per case), so run it on demand, not on every commit.
//
// Exit code is 1 if any error-severity assertion fails, so it can gate a
// deploy. --json prints machine-readable results.

import { readFileSync } from "node:fs";
import { CASES } from "./cases.mjs";
import { scoreCase, scoreSuite } from "./score.mjs";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

const MODE_LIVE = has("--live");
const BASE_URL = val("--url") || process.env.EVAL_URL || "http://localhost:3000";
const ONLY = val("--case");
const AS_JSON = has("--json");
const CONCURRENCY = Number(val("--concurrency") || 3);

const cases = ONLY ? CASES.filter((c) => c.id === ONLY) : CASES;
if (!cases.length) { console.error(`No case matched --case ${ONLY}`); process.exit(2); }

// ── Fixture mode ────────────────────────────────────────────────────────────
function loadFixture(path) {
  return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
}

function runFixtures() {
  const scored = [];
  const extras = []; // "bad" fixtures we expect to FAIL — proves the guard bites
  for (const c of cases) {
    if (!c.fixtures) continue;
    if (c.fixtures.good) scored.push(scoreCase(c, loadFixture(c.fixtures.good)));
    if (c.fixtures.bad) {
      const badScore = scoreCase({ ...c, id: `${c.id} (bad fixture — expected to FAIL)` }, loadFixture(c.fixtures.bad));
      extras.push({ score: badScore, caughtRegression: !badScore.passed });
    }
  }
  return { scored, extras };
}

// ── Live mode ───────────────────────────────────────────────────────────────
async function runOneLive(c) {
  const runId = `eval-${c.id}-${Math.abs(hash(c.id + BASE_URL)).toString(36)}`.slice(0, 40);
  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...c.input, runId }),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${c.id}`);

  let buffer = "";
  let solution = null;
  const decoder = new TextDecoder();
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const d = JSON.parse(line.slice(6));
        if (d.done && d.solution) solution = d.solution;
        if (d.done && d.error) throw new Error(d.error);
      } catch { /* skip partial/malformed */ }
    }
  }
  if (!solution) throw new Error(`No solution returned for ${c.id}`);
  return scoreCase(c, solution);
}

// deterministic-ish id -> number (no Math.random / Date so runs are stable)
function hash(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; }

async function runLive() {
  const scored = [];
  const queue = [...cases];
  async function worker() {
    while (queue.length) {
      const c = queue.shift();
      process.stderr.write(`  running ${c.id}...\n`);
      try { scored.push(await runOneLive(c)); }
      catch (e) {
        scored.push({ id: c.id, description: c.description, passed: false,
          errorFails: [{ note: "pipeline error", detail: String(e).slice(0, 200) }], warnFails: [], results: [] });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, cases.length) }, worker));
  return { scored, extras: [] };
}

// ── Report ────────────────────────────────────────────────────────────────
function printHuman({ scored, extras }, suite) {
  const bar = "─".repeat(60);
  console.log(`\n${bar}\nGOLDEN SET — ${MODE_LIVE ? `LIVE @ ${BASE_URL}` : "FIXTURES"}\n${bar}`);
  for (const c of scored) {
    console.log(`\n${c.passed ? "✓ PASS" : "✗ FAIL"}  ${c.id}`);
    for (const r of c.results) {
      const icon = r.passed ? "  ✓" : r.severity === "warn" ? "  ⚠" : "  ✗";
      console.log(`${icon} [${r.severity}] ${r.note}${r.passed ? "" : ` — ${r.detail}`}`);
    }
  }
  if (extras.length) {
    console.log(`\n${bar}\nNEGATIVE CONTROLS (bad fixtures — the guard SHOULD catch these)\n${bar}`);
    for (const e of extras) {
      console.log(`${e.caughtRegression ? "✓ caught" : "✗ MISSED"}  ${e.score.id}`);
      if (!e.caughtRegression) console.log("     WARNING: a known-bad report passed — the guard is not biting.");
    }
  }
  console.log(`\n${bar}`);
  console.log(`SCORE: ${suite.passed}/${suite.total} cases passed  (${Math.round(suite.score * 100)}%)`);
  if (suite.regressions.length) {
    console.log(`\nREGRESSIONS (${suite.regressions.length}):`);
    for (const r of suite.regressions) console.log(`  • [${r.case}] ${r.note} — ${r.detail}`);
  }
  console.log(bar + "\n");
}

const result = MODE_LIVE ? await runLive() : runFixtures();
const suite = scoreSuite(result.scored);

// A missed negative control (a bad fixture that passed) is itself a failure.
const missedControls = result.extras.filter((e) => !e.caughtRegression);

if (AS_JSON) {
  console.log(JSON.stringify({ suite, cases: result.scored, negativeControls: result.extras }, null, 2));
} else {
  printHuman(result, suite);
}

const failed = suite.failed > 0 || missedControls.length > 0;
process.exit(failed ? 1 : 0);
