// Feedback failure analysis.
//
//   node eval/analyze-feedback.mjs --fixtures
//       Classify the sample feedback file. Offline, deterministic — proves the
//       taxonomy + aggregation work.
//
//   node eval/analyze-feedback.mjs --live
//       Pull real feedback events from Blob (feedback/ prefix) and classify
//       them. Requires BLOB_READ_WRITE_TOKEN. Read-only.
//
// Output: failure classes ranked by frequency, plus candidate golden cases for
// recurring classes — the pipe that grows the golden set from real failures
// instead of hand-written ones.

import { readFileSync } from "node:fs";
import { aggregate, FAILURE_CLASSES } from "./classify.mjs";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const AS_JSON = has("--json");
const LIVE = has("--live");
const THRESHOLD = Number(val("--threshold") || 2);

async function loadEvents() {
  if (!LIVE) {
    const path = val("--fixtures-file") || "eval/fixtures/feedback-sample.json";
    return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
  }
  // Live: list + fetch feedback blobs. Imported lazily so offline mode needs
  // no @vercel/blob token.
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: "feedback/", limit: 500 });
  const events = [];
  for (const b of blobs) {
    try { events.push(await (await fetch(b.url)).json()); } catch { /* skip */ }
  }
  return events;
}

const events = await loadEvents();
// Only negative signal drives failure analysis: thumbs-down + behavioral swaps.
const negative = events.filter((e) => e.rating === "down" || e.kind === "swap" || e.kind === "tech");
const report = aggregate(negative, { recurringThreshold: THRESHOLD });

if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const bar = "─".repeat(62);
  console.log(`\n${bar}\nFEEDBACK FAILURE ANALYSIS — ${LIVE ? "LIVE (Blob)" : "FIXTURES"}\n${bar}`);
  console.log(`${negative.length} negative events (of ${events.length} total) · ${report.unclassified} unclassified\n`);
  if (!report.classes.length) {
    console.log("No failure classes matched. Either all good, or the taxonomy needs a new class.");
  }
  for (const c of report.classes) {
    const def = FAILURE_CLASSES.find((f) => f.id === c.id);
    console.log(`  ${String(c.count).padStart(2)}×  ${def.label}  [${c.id}]`);
    for (const ex of c.examples) console.log(`        “${ex.text}”`);
  }
  if (report.candidates.length) {
    console.log(`\n${bar}\nCANDIDATE GOLDEN CASES (recurring ≥ ${THRESHOLD})\n${bar}`);
    for (const cand of report.candidates) {
      console.log(`\n  • ${cand.label} (${cand.count}×) — ${cand.readyToRun ? "READY (input captured)" : "needs input capture"}`);
      console.log(`    guard: ${cand.suggestedGuard}`);
      if (cand.capturedInput) console.log(`    problem: "${cand.capturedInput}"`);
      else console.log(`    example report: "${cand.exampleTitle}" — capture its problem input to make it runnable`);
    }
  }
  console.log(`\n${bar}\n`);
}
