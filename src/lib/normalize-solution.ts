// Format guard: the LAST step before a solution reaches the UI/PDF.
// Deterministic code, no model call — whatever shape the synthesis model
// produced (any provider, any future swap), the report always comes out in
// the exact structure the web page, PDF, and OG cards were built for.

/* eslint-disable @typescript-eslint/no-explicit-any */

const str = (v: unknown, max = 4000): string =>
  typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "";

const arr = (v: unknown): any[] => (Array.isArray(v) ? v.filter((x) => x != null) : []);

const strArr = (v: unknown, maxItems: number, maxLen = 500): string[] =>
  arr(v).map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems);

const httpUrl = (v: unknown): string | undefined => {
  const u = str(v, 500);
  return /^https?:\/\//i.test(u) ? u : undefined;
};

// Metric fields must be short — pull the headline figure out of a rambling
// value (prefer the number adjacent to "total", else the last one)
function shortValue(v: unknown, maxLen: number): string {
  const val = str(v, 1000);
  if (val.length <= maxLen) return val;
  const prices = [...val.matchAll(/[~≈]?[$€£]\s?\d[\d,.]*\s?(k|K|M)?(\s?\/\s?(mo|month|yr|year))?/g)];
  if (prices.length > 0) {
    const nearTotal = [...prices].reverse().find((pm) => {
      const end = (pm.index ?? 0) + pm[0].length;
      return /^\s*(total|est)/i.test(val.slice(end, end + 12));
    });
    return (nearTotal ?? prices[prices.length - 1])[0].replace(/\s+/g, " ").trim();
  }
  const t = val.match(/\d+\s?[–-]\s?\d+\s?(weeks?|months?|days?)/i) || val.match(/\d+\s?(weeks?|months?|days?)/i);
  if (t) return t[0].replace(/\s+/g, " ").trim();
  return val.slice(0, maxLen - 1) + "…";
}

export function normalizeSolution(raw: any): any {
  const s = raw && typeof raw === "object" ? raw : {};

  const tools = arr(s.tools).map((t: any) => ({
    name: str(t?.name, 80) || "Unnamed tool",
    purpose: str(t?.purpose, 300),
    category: str(t?.category, 40) || "Integration",
    whyForYou: str(t?.whyForYou, 500),
    sourceUrl: httpUrl(t?.sourceUrl),
    vendorQuestions: strArr(t?.vendorQuestions, 5, 200),
  })).filter((t: any) => t.name !== "Unnamed tool" || t.purpose).slice(0, 8);

  const phases = arr(s.phases).map((p: any, i: number) => ({
    title: str(p?.title, 90) || `Phase ${i + 1}`,
    objective: str(p?.objective, 400),
    actions: strArr(p?.actions, 8, 400),
    exitCriteria: strArr(p?.exitCriteria, 6, 250),
    nodes: arr(p?.nodes).map((n: any, j: number) => ({
      id: str(n?.id, 30) || `p${i + 1}_n${j}`,
      label: str(n?.label, 40) || `Step ${j + 1}`,
    })).slice(0, 8),
    edges: arr(p?.edges)
      .map((e: any) => ({ from: str(e?.from, 30), to: str(e?.to, 30) }))
      .filter((e: any) => e.from && e.to).slice(0, 12),
  })).filter((p: any) => p.actions.length > 0 || p.objective).slice(0, 6);

  const lineItems = arr(s.tco?.lineItems).map((li: any) => ({
    item: str(li?.item, 120),
    type: /(one[\s-]?time|once|onetime|upfront|setup|1[\s-]?time)/i.test(str(li?.type, 30)) ? "One-time" : "Recurring",
    cost: str(li?.cost, 40),
    sourceUrl: httpUrl(li?.sourceUrl),
    sourceQuote: str(li?.sourceQuote, 120) || undefined,
  })).filter((li: any) => li.item && li.cost).slice(0, 10);

  const verdictOf = (v: unknown) => (/chosen|selected|winner|pick/i.test(str(v, 30)) ? "chosen" : "rejected");

  return {
    ...s,
    title: str(s.title, 90) || "Implementation Plan",
    insight: str(s.insight, 500),
    insightSourceUrl: httpUrl(s.insightSourceUrl),
    insightSourceUrls: arr(s.insightSourceUrls).map(httpUrl).filter(Boolean).slice(0, 3),
    insightSourceQuote: str(s.insightSourceQuote, 120) || undefined,
    summary: str(s.summary, 800),
    // The two fields that wrecked the mobile layout — hard-shortened here
    estimatedCost: shortValue(s.estimatedCost, 40),
    timeToImplement: shortValue(s.timeToImplement, 60),
    tools,
    phases,
    evaluated: arr(s.evaluated).map((c: any) => ({
      name: str(c?.name, 80),
      verdict: verdictOf(c?.verdict),
      reason: str(c?.reason, 300),
      sourceUrl: httpUrl(c?.sourceUrl),
    })).filter((c: any) => c.name && c.reason).slice(0, 10),
    teamRequired: arr(s.teamRequired).map((r: any) => ({
      role: str(r?.role, 80),
      skills: strArr(r?.skills, 4, 80),
      commitment: str(r?.commitment, 90),
      phases: str(r?.phases, 60),
      staffing: /contract|hire|external|consult/i.test(str(r?.staffing, 40)) ? "contractor"
        : /upskill|train|learn/i.test(str(r?.staffing, 40)) ? "upskill" : "internal",
    })).filter((r: any) => r.role).slice(0, 6),
    assumptions: strArr(s.assumptions, 6, 300),
    showHoursRoi: s.showHoursRoi !== false,
    kpis: arr(s.kpis).map((k: any) => ({
      metric: str(k?.metric, 120), baseline: str(k?.baseline, 60) || undefined,
      target: str(k?.target, 60), timeframe: str(k?.timeframe, 40) || undefined,
    })).filter((k: any) => k.metric && k.target).slice(0, 6),
    adoptionPlan: arr(s.adoptionPlan).map((a: any) => ({
      title: str(a?.title, 90), detail: str(a?.detail, 300),
    })).filter((a: any) => a.title).slice(0, 6),
    tco: s.tco && typeof s.tco === "object" ? {
      ...s.tco,
      lineItems,
      oneTimeSetup: shortValue(s.tco.oneTimeSetup, 40),
      monthlyRecurring: shortValue(s.tco.monthlyRecurring, 40),
      firstYearTotal: shortValue(s.tco.firstYearTotal, 40),
      hiddenCosts: strArr(s.tco.hiddenCosts, 5, 250),
    } : undefined,
    alternative: s.alternative && typeof s.alternative === "object" && str(s.alternative.name, 90) ? {
      name: str(s.alternative.name, 90),
      summary: str(s.alternative.summary, 500),
      tools: strArr(s.alternative.tools, 5, 60),
      estimatedCost: shortValue(s.alternative.estimatedCost, 40) || undefined,
      tradeoff: str(s.alternative.tradeoff, 400) || undefined,
    } : undefined,
  };
}
