// The golden set — real problems (from production logs) with known-good
// expectations and known failure modes encoded as assertions. This is the
// regression harness: every prompt/pipeline change replays against it.
//
// Each case:
//   id, description
//   input      — the exact body POSTed to /api/generate (live mode)
//   fixture     — path to a captured solution JSON, for offline engine tests
//   assertions  — see eval/score.mjs for kinds
//
// To add a case: capture a real problem, write down what a good report MUST
// and MUST NOT contain, and encode each as an assertion. Prefer "excludes"
// error-assertions for bugs you've actually seen — those are the guards that
// stop a fixed bug from silently coming back.

export const CASES = [
  {
    id: "omnicom-bakeoff",
    description: "Databricks vs Snowflake to replace Synapse; Azure today, maybe AWS. The losing candidate must NOT be written up as deployed infrastructure.",
    input: {
      problem: "We are evaluating Databricks versus Snowflake to replace Microsoft Synapse. Our stack is Azure databases, Dynamics F&O, Azure Synapse pipelines, and Cognos Analytics for reporting. We may migrate to AWS. Primary drivers are real-time analytics and low-latency reporting.",
      size: "Enterprise", stack: "Azure, Databricks, Snowflake, cognos analytics",
      budget: "Help me size it", timeline: "1–3 months",
      industry: "Media / Entertainment", team: "Finance", techLevel: "Some developers",
    },
    fixtures: { good: "eval/fixtures/omnicom-good.json", bad: "eval/fixtures/omnicom-bad.json" },
    assertions: [
      { kind: "chosenOne", severity: "error", note: "Exactly one candidate is chosen (not both sides of the bake-off)" },
      { kind: "includes", scope: "report", pattern: "aws", flags: "i", severity: "error", note: "Engages the potential AWS migration" },
      { kind: "excludes", scope: "approvals", pattern: "\\b(USAGE|CREATE STAGE)\\b", severity: "error", note: "No raw SQL-grant jargon in approvals — the losing tool wrongly written up as deployed" },
      { kind: "minCount", path: "evaluated", min: 4, severity: "error", note: "Evaluated a real field of candidates" },
      { kind: "nonEmpty", path: "tools", severity: "error", note: "Recommends at least one tool" },
    ],
  },
  {
    id: "smb-tight-budget",
    description: "SMB with a hard sub-$10k/mo budget — must not blow past it or push enterprise-only tooling.",
    input: {
      problem: "We're a 20-person accounting firm drowning in manual client onboarding and document collection. We want to automate intake and reminders.",
      size: "SMB", stack: "Google Workspace, QuickBooks",
      budget: "< $10k/mo", timeline: "1–3 months",
      industry: "Professional Services", team: "Operations", techLevel: "No-code only",
    },
    fixtures: { good: "eval/fixtures/smb-good.json" },
    assertions: [
      { kind: "moneyUnder", path: "tco.monthlyRecurring", maxUsd: 10000, severity: "error", note: "Monthly recurring cost fits the sub-$10k budget" },
      { kind: "nonEmpty", path: "tools", severity: "error", note: "Recommends tools" },
      { kind: "excludes", scope: "team", pattern: "full eng|dedicated engineering team|platform team", flags: "i", severity: "warn", note: "Doesn't assume an eng org a 20-person firm doesn't have" },
    ],
  },
  {
    id: "healthcare-hipaa",
    description: "Healthcare with HIPAA — the plan must actually address compliance, not hand-wave it.",
    input: {
      problem: "Our clinic wants to automate patient appointment reminders and intake forms across three locations.",
      size: "SMB", stack: "Recommend for me",
      budget: "$10-50k/mo", timeline: "3-6 months",
      industry: "Healthcare", team: "Operations", techLevel: "Some developers",
      compliance: "HIPAA",
    },
    assertions: [
      { kind: "includes", scope: "report", pattern: "hipaa|baa|phi|protected health", flags: "i", severity: "error", note: "Addresses HIPAA / BAA / PHI explicitly" },
      { kind: "nonEmpty", path: "tools", severity: "error", note: "Recommends tools" },
      { kind: "chosenOne", severity: "warn", note: "Converges on a single approach" },
    ],
  },
];
