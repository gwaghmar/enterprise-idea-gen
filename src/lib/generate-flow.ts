// Builds the end-to-end journey as a grouped node/edge graph — the same
// {id,label,type}/{from,to,label} shape the existing per-phase FlowChart
// already renders, so the big diagram reuses the proven ReactFlow (web) +
// jsPDF (PDF) rendering pair instead of introducing a third visual style.
//
// Deterministic — built entirely from data the report already has, zero
// extra AI cost. Mirrors generate-mermaid.ts section-for-section (that file
// stays as the "copy as portable text" export of the same underlying shape).

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface FNode { id: string; label: string; type: string; group?: string; }
export interface FEdge { from: string; to: string; label?: string; dashed?: boolean; }
export interface FGroup { id: string; label: string; accent: string; }
export interface JourneyFlow { nodes: FNode[]; edges: FEdge[]; groups: FGroup[]; }

function clip(s: unknown, max = 70): string {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function ownersFor(phaseIdx: number, phaseTitle: string, team: any[]): string[] {
  const m = phaseTitle.match(/Phase\s*(\d+)/i);
  const n = m ? parseInt(m[1], 10) : phaseIdx + 1;
  return (team || [])
    .filter((r) => {
      const nums = [...String(r?.phases ?? "").matchAll(/\d+/g)].map((x) => parseInt(x[0], 10));
      return nums.length ? n >= Math.min(...nums) && n <= Math.max(...nums) : true;
    })
    .map((r) => String(r?.role ?? "").split("(")[0].trim())
    .filter(Boolean);
}

export function buildJourneyFlow(solution: any, problem: string, context?: { stack?: string }): JourneyFlow {
  const nodes: FNode[] = [];
  const edges: FEdge[] = [];
  const groups: FGroup[] = [];
  let chainTail = ""; // id of the last node to chain the next group's entry from

  // ── TODAY ──────────────────────────────────────────────────────────────
  groups.push({ id: "today", label: "📍 TODAY", accent: "red" });
  nodes.push({ id: "p0", label: `🔥 ${clip(problem, 90)}`, type: "problem", group: "today" });
  chainTail = "p0";
  const stack = String(context?.stack ?? "").split(",").map((s) => s.trim()).filter((s) => s && !/recommend for me/i.test(s)).slice(0, 5);
  if (stack.length) {
    nodes.push({ id: "stack", label: `🖥 ${clip(stack.join(" · "), 60)}`, type: "stack", group: "today" });
    edges.push({ from: "p0", to: "stack" });
  }
  if (solution?.costOfInaction?.annualCost) {
    nodes.push({ id: "inaction", label: `💸 Costs ${clip(solution.costOfInaction.annualCost, 25)}/yr to leave unsolved`, type: "risk", group: "today" });
    edges.push({ from: stack.length ? "stack" : "p0", to: "inaction" });
    chainTail = "inaction";
  }

  // ── TOOLS ──────────────────────────────────────────────────────────────
  const tools: any[] = (solution?.tools ?? []).slice(0, 6);
  if (tools.length) {
    groups.push({ id: "tools", label: "🧰 NEW TOOLS", accent: "blue" });
    tools.forEach((t, i) => {
      const id = `tool${i}`;
      nodes.push({ id, label: `${clip(t.name, 26)}\n${clip(t.category, 18)}`, type: "tool", group: "tools" });
      if (i > 0) edges.push({ from: `tool${i - 1}`, to: id });
    });
    edges.push({ from: chainTail, to: "tool0" });
    chainTail = `tool${tools.length - 1}`;
  }

  // ── PHASES (team roles live inside each phase's own group) ────────────
  const phases: any[] = solution?.phases ?? [];
  const team: any[] = solution?.teamRequired ?? [];
  phases.forEach((ph, pi) => {
    const gid = `ph${pi}`;
    groups.push({ id: gid, label: `🚀 ${clip(ph.title, 46)}`, accent: "slate" });
    let prev = "";
    if (ph.objective) {
      const id = `${gid}o`;
      nodes.push({ id, label: `🎯 ${clip(ph.objective, 55)}`, type: "action", group: gid });
      prev = id;
    }
    const actions: string[] = (ph.actions ?? []).slice(0, 5);
    actions.forEach((a: string, ai: number) => {
      const id = `${gid}a${ai}`;
      nodes.push({ id, label: clip(a, 55), type: "action", group: gid });
      if (prev) edges.push({ from: prev, to: id });
      prev = id;
    });
    const exit: string[] = (ph.exitCriteria ?? []).slice(0, 3);
    let exitId = prev;
    if (exit.length && prev) {
      exitId = `${gid}g`;
      nodes.push({ id: exitId, label: `✅ ${clip(exit.join(" · "), 55)}`, type: "gate", group: gid });
      edges.push({ from: prev, to: exitId });
    }
    // team roles as extra nodes inside the same group, dashed into the gate
    ownersFor(pi, String(ph.title ?? ""), team).slice(0, 3).forEach((o, oi) => {
      const id = `${gid}t${oi}`;
      nodes.push({ id, label: `👤 ${clip(o, 24)}`, type: "team", group: gid });
      if (exitId) edges.push({ from: id, to: exitId, dashed: true });
    });
    if (chainTail && (ph.objective || actions.length)) {
      edges.push({ from: chainTail, to: ph.objective ? `${gid}o` : `${gid}a0` });
    }
    chainTail = exitId || chainTail;
  });

  // ── ADOPTION ───────────────────────────────────────────────────────────
  const adoption: any[] = (solution?.adoptionPlan ?? []).slice(0, 4);
  if (adoption.length) {
    groups.push({ id: "adopt", label: "🤝 ADOPTION", accent: "blue" });
    adoption.forEach((a, i) => {
      const id = `ad${i}`;
      nodes.push({ id, label: clip(a.title, 45), type: "adopt", group: "adopt" });
      if (i > 0) edges.push({ from: `ad${i - 1}`, to: id });
    });
    edges.push({ from: chainTail, to: "ad0" });
    chainTail = `ad${adoption.length - 1}`;
  }

  // ── OUTCOMES ───────────────────────────────────────────────────────────
  groups.push({ id: "win", label: "🏁 OUTCOMES", accent: "green" });
  const kpis: any[] = (solution?.kpis ?? []).slice(0, 5);
  if (kpis.length) {
    kpis.forEach((k, i) => {
      const id = `k${i}`;
      const from = k.baseline ? `${clip(k.baseline, 12)}→` : "";
      nodes.push({ id, label: `📈 ${clip(k.metric, 40)}\n${from}${clip(k.target, 18)}`, type: "outcome", group: "win" });
      if (i > 0) edges.push({ from: `k${i - 1}`, to: id });
    });
    edges.push({ from: chainTail, to: "k0" });
  } else {
    nodes.push({ id: "k0", label: `📈 ${clip(solution?.summary, 70)}`, type: "outcome", group: "win" });
    edges.push({ from: chainTail, to: "k0" });
  }

  // ── loose nodes: investment + top risks, dashed into outcomes ─────────
  const firstYear = solution?.tco?.firstYearTotal || solution?.estimatedCost;
  if (firstYear) {
    const monthly = solution?.tco?.monthlyRecurring ? ` · ${clip(solution.tco.monthlyRecurring, 16)} rec.` : "";
    nodes.push({ id: "cost", label: `💰 ${clip(firstYear, 18)} yr1${monthly} · ${clip(solution?.timeToImplement, 20)}`, type: "cost" });
    edges.push({ from: "cost", to: "k0", dashed: true });
  }
  const risks: any[] = (solution?.approvals?.riskAssessment ?? []).slice(0, 2);
  risks.forEach((r, i) => {
    const id = `risk${i}`;
    nodes.push({ id, label: `⚠️ ${clip(r.risk ?? r.name ?? r, 45)}`, type: "risk" });
    edges.push({ from: id, to: "k0", dashed: true });
  });

  return { nodes, edges, groups };
}

// Generic {nodes,edges,groups} -> Mermaid flowchart-LR text. Used for
// diagrams (e.g. System Architecture) that don't have a hand-authored
// Mermaid export like the journey map's generate-mermaid.ts does — this
// keeps the "copy as portable code" bonus without duplicating that file's
// bespoke per-section logic.
function mLbl(s: string): string {
  return s.replace(/["`]/g, "'").replace(/[[\]{}<>|#;]/g, " ").replace(/\n/g, "<br/>").replace(/\s+/g, " ").trim();
}
export function flowToMermaid(nodes: FNode[], edges: FEdge[], groups: FGroup[]): string {
  const L: string[] = ["flowchart LR"];
  groups.forEach((g) => {
    const gNodes = nodes.filter((n) => n.group === g.id);
    if (!gNodes.length) return;
    L.push(`  subgraph ${g.id}["${mLbl(g.label)}"]`);
    gNodes.forEach((n) => L.push(`    ${n.id}["${mLbl(n.label)}"]`));
    L.push("  end");
  });
  const loose = nodes.filter((n) => !n.group);
  loose.forEach((n) => L.push(`  ${n.id}["${mLbl(n.label)}"]`));
  edges.forEach((e) => {
    const arrow = e.dashed ? "-.->" : "-->";
    L.push(e.label ? `  ${e.from} ${arrow}|${mLbl(e.label)}| ${e.to}` : `  ${e.from} ${arrow} ${e.to}`);
  });
  return L.join("\n");
}
