// Router for the "Something changed?" refine box.
//
// One input, two machines behind it:
//   - "patch"      → /api/edit: fast in-place tweak, no re-research
//   - "regenerate" → /api/generate: full fresh report with new research
//
// Bias is deliberately toward "regenerate". Mis-routing a big change down to
// a patch produces a stale, half-updated report (the harmful failure); mis-
// routing a small change up to a regenerate merely costs one extra ~60s run
// (the harmless failure). So we only return "patch" when we're confident the
// change is a small, single-target tweak with no scenario-level signals.

export type RefineRoute = "patch" | "regenerate";

// Signals that the *scenario itself* changed — these always force a rebuild,
// because they ripple through tools, costs, research, and compliance.
const SCENARIO_SIGNALS: RegExp[] = [
  /\b(aws|azure|gcp|google cloud|on[-\s]?prem|multi[-\s]?cloud)\b/i,      // cloud/infra shift
  /\b(hipaa|gdpr|soc\s?2|pci|iso\s?27001|fedramp|ccpa|compliance|regulat)/i, // compliance
  /\$\s?\d|\b\d+\s?(k|m)\b|\bbudget\b|\bcheaper\b|\bmore expensive\b/i,   // money/budget
  /\b(confirmed|decided|we are now|we're now|actually|instead of|turns out|update:|correction)\b/i, // new facts
  /\b(migrat|switch(ing|ed)? to|moving to|move to|replace our|rip and replace)\b/i, // migration
  /\b(everything|whole thing|entire|from scratch|rebuild|redo|start over|overhaul|re[-\s]?architect)\b/i, // scope
  /\b(industry|healthcare|fintech|manufactur|retail|enterprise now|startup now)\b/i, // industry shift
  /\b(team (is|of|size)|\d+\s?(people|employees|engineers|users|seats)|no[-\s]?code|full eng)\b/i, // team/scale
  /\b(timeline|deadline|asap|by (q[1-4]|next|end of)|\d+\s?(weeks?|months?|days?))\b/i, // timeline
];

// Signals of a small, in-place tweak — only trusted when NO scenario signal fired.
const PATCH_SIGNALS: RegExp[] = [
  /\b(swap|replace)\b.{0,40}\bwith\b/i,   // "replace X with Y"
  /\b(rename|reword|rephrase|shorten|trim|expand|clarify|fix the wording)\b/i,
  /\b(remove|delete|drop|take out)\b.{0,30}\b(phase|tool|step|row|question|section|line)\b/i,
  /\b(add|include)\b.{0,30}\b(question|note|line|step|column|caveat)\b/i,
  /\bmake (phase|step|it) \d?\s?(shorter|longer|clearer|simpler)\b/i,
];

export function classifyRefine(instruction: string): RefineRoute {
  const text = (instruction || "").trim();
  if (!text) return "patch"; // empty won't be submitted, but never regenerate on nothing

  // Any scenario-level signal → rebuild, no matter how it's phrased.
  if (SCENARIO_SIGNALS.some((re) => re.test(text))) return "regenerate";

  // Long, discursive instructions almost always describe a scenario change
  // even without an explicit keyword — treat as regenerate.
  if (text.length > 140) return "regenerate";

  // Confident small tweak: a patch phrase AND short AND no scenario signal.
  if (text.length <= 140 && PATCH_SIGNALS.some((re) => re.test(text))) return "patch";

  // Unsure → the safe (expensive) path.
  return "regenerate";
}
