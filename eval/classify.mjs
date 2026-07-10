// Failure taxonomy + a pure, deterministic classifier.
//
// Turns a free-form thumbs-down comment (and behavioral events like tool
// swaps) into one or more NAMED failure classes. Named classes are what let
// the loop go from "users are unhappy" to "18% of enterprise reports hit
// bake-off-confusion" — countable, trackable, and each mapped to a golden-set
// guard that stops it from regressing once fixed.
//
// Keyword-first (free, deterministic, testable). An LLM pass can enrich the
// "other" bucket later, but the taxonomy below already covers what we've
// actually seen in production feedback.

export const FAILURE_CLASSES = [
  {
    id: "bakeoff-confusion",
    label: "Bake-off treated as deployed",
    description: "Tools the user is choosing BETWEEN get written up as already-installed infrastructure (permissions, integrations, costs).",
    signals: [/\bvs\b|versus|deciding between|both .*(selected|deployed|in stack)/i, /didn'?t? (create|make) two|why is \w+ (in|mentioned).*(approval|permission)/i],
    guard: "excludes on approvals for the losing candidate's admin/privilege terms; chosenOne assertion",
  },
  {
    id: "jargon-unexplained",
    label: "Unexplained jargon",
    description: "Raw technical terms (SQL grants, privilege names, acronyms) with no plain-language 'why'.",
    signals: [/what does this mean|too technical|don'?t understand|confusing|jargon/i, /\b(USAGE|CREATE STAGE|GRANT|CASB|SAML)\b/],
    guard: "excludes on raw privilege/grant tokens in approvals; require plain-language why fields",
  },
  {
    id: "stale-pricing",
    label: "Stale or wrong pricing",
    description: "Prices that are outdated, wrong, or don't match current vendor pricing.",
    signals: [/pric(e|ing)|cost/i, /(wrong|old|stale|outdated|not right|out of date|expensive now)/i],
    guard: "live-mode check that pricing cites a fresh research source",
    requireAll: true, // both a price word AND a wrongness word
  },
  {
    id: "budget-mismatch",
    label: "Over budget",
    description: "The recommended plan costs more than the stated budget.",
    signals: [/over budget|too expensive|can'?t afford|out of (our )?budget|way more than/i],
    guard: "moneyUnder on tco.monthlyRecurring against the stated budget ceiling",
  },
  {
    id: "compliance-gap",
    label: "Compliance not addressed",
    description: "A stated compliance requirement (HIPAA, GDPR, SOC2, PCI) is ignored or hand-waved.",
    signals: [/\b(hipaa|gdpr|soc ?2|pci|iso ?27001|fedramp)\b/i, /(ignored|missing|not (addressed|covered|mentioned)|hand.?wav)/i],
    guard: "includes on report for the compliance term + concrete controls",
    requireAll: true,
  },
  {
    id: "wrong-tool",
    label: "Wrong tool pick",
    description: "The recommended tool is a bad fit; user would pick something else.",
    signals: [/wrong tool|wouldn'?t use|bad (fit|recommendation|pick|choice)|we (use|prefer) \w+ (instead|not)/i],
    guard: "add the preferred tool to a golden case's expected set",
  },
  {
    id: "too-generic",
    label: "Too generic",
    description: "Vague, surface-level advice not grounded in the company's actual scenario.",
    signals: [/generic|vague|not specific|too high.?level|obvious|surface.?level|boilerplate/i],
    guard: "includes on report for scenario-specific nouns (their stack/industry terms)",
  },
];

const CLASS_BY_ID = Object.fromEntries(FAILURE_CLASSES.map((c) => [c.id, c]));

/** Classify one feedback text into zero-or-more failure class ids. */
export function classifyFeedback(text) {
  const t = String(text || "");
  if (!t.trim()) return [];
  const hits = [];
  for (const c of FAILURE_CLASSES) {
    const matched = c.requireAll
      ? c.signals.every((re) => re.test(t))
      : c.signals.some((re) => re.test(t));
    if (matched) hits.push(c.id);
  }
  return hits;
}

/** Aggregate classified events → counts, examples, and candidate golden cases. */
export function aggregate(events, { recurringThreshold = 2 } = {}) {
  const byClass = new Map();
  let unclassified = 0;

  for (const e of events) {
    const text = [e.comment, e.detail].filter(Boolean).join(" — ");
    const classes = classifyFeedback(text);
    if (!classes.length) { unclassified++; continue; }
    for (const id of classes) {
      if (!byClass.has(id)) byClass.set(id, { id, count: 0, examples: [] });
      const bucket = byClass.get(id);
      bucket.count++;
      if (bucket.examples.length < 3 && text) {
        bucket.examples.push({ title: e.title || "", problem: e.problem || "", text: text.slice(0, 160) });
      }
    }
  }

  const classes = [...byClass.values()].sort((a, b) => b.count - a.count);

  // Recurring classes become candidate golden cases — a scaffold a human
  // finishes by pasting in the real problem input if it wasn't captured.
  const candidates = classes
    .filter((c) => c.count >= recurringThreshold)
    .map((c) => {
      const def = CLASS_BY_ID[c.id];
      const withInput = c.examples.find((e) => e.problem);
      return {
        failureClass: c.id,
        label: def.label,
        count: c.count,
        suggestedGuard: def.guard,
        exampleTitle: c.examples[0]?.title || "",
        capturedInput: withInput?.problem || null,
        readyToRun: Boolean(withInput?.problem),
      };
    });

  return { classes, candidates, unclassified, total: events.length };
}
