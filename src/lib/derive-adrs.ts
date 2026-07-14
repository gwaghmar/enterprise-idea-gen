// Architecture Decision Records, derived — not generated. The evaluated
// verdicts, their reasons, and each chosen tool's lock-in already contain a
// full ADR (decision / context / alternatives / consequences); reformatting
// them here costs zero extra model tokens and can never contradict the report.

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Adr {
  decision: string;
  context: string;
  alternatives: { name: string; reason: string }[];
  consequences: string[];
}

export function deriveAdrs(solution: any): Adr[] {
  const evaluated: any[] = Array.isArray(solution?.evaluated) ? solution.evaluated : [];
  const tools: any[] = Array.isArray(solution?.tools) ? solution.tools : [];
  const chosen = evaluated.filter((c) => c?.verdict === "chosen" && c?.name);
  const rejected = evaluated.filter((c) => c?.verdict !== "chosen" && c?.name && c?.reason);
  if (chosen.length === 0) return [];

  return chosen.map((c) => {
    const consequences: string[] = [];
    // The matching tool's lock-in verdict is the honest cost of the decision
    const tool = tools.find((t) => {
      const a = String(t?.name ?? "").toLowerCase();
      const b = String(c.name).toLowerCase();
      return a && (a.includes(b) || b.includes(a));
    });
    if (tool?.lockIn?.level && tool?.lockIn?.reason) {
      consequences.push(`Lock-in ${tool.lockIn.level}: ${tool.lockIn.reason}`);
    }
    if (solution?.alternative?.name && solution?.alternative?.tradeoff) {
      consequences.push(`Fallback exists (${solution.alternative.name}) — tradeoff: ${solution.alternative.tradeoff}`);
    }
    return {
      decision: c.name,
      context: String(c.reason ?? ""),
      alternatives: rejected.map((r) => ({ name: String(r.name), reason: String(r.reason) })),
      consequences,
    };
  });
}
