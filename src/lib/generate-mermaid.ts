// End-to-end journey map in real Mermaid syntax.
//
// Not a stitch of the per-phase mini-flowcharts — a full map with a distinct
// subgraph for EVERY section of the report:
//
//   TODAY (problem + current stack) → NEW TOOLS (by category) →
//   PHASE 1..N (each action with its owner, exit criteria as a gate) →
//   ADOPTION → OUTCOMES (KPIs baseline→target)
//   plus TEAM (dashed lines into the phases they staff), INVESTMENT, RISKS.
//
// Deterministic — built from data the report already has, zero extra AI cost.
// Output is valid `flowchart LR` Mermaid: rendered live on the report page and
// copy-pasteable into Notion, GitHub, Confluence, Obsidian, draw.io.

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mermaid label: strip characters that break its parser, keep it readable.
function lbl(s: unknown, max = 60): string {
  const t = String(s ?? "")
    .replace(/["`]/g, "'")
    .replace(/[[\]{}<>|#;]/g, " ")
    .replace(/\(/g, "(").replace(/\)/g, ")")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

// Owner for a phase, matched from teamRequired[].phases ("Phase 1-3" etc).
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

export function generateMermaid(solution: any, problem: string, context?: { stack?: string }): string {
  const L: string[] = [];
  const push = (s: string) => L.push(s);

  push("flowchart LR");

  // ── Styling ────────────────────────────────────────────────────────────────
  push("  classDef problem fill:#7f1d1d,stroke:#ef4444,color:#fff");
  push("  classDef stack fill:#1e293b,stroke:#64748b,color:#e2e8f0");
  push("  classDef tool fill:#1e3a8a,stroke:#3b82f6,color:#fff");
  push("  classDef action fill:#0f172a,stroke:#475569,color:#e2e8f0");
  push("  classDef gate fill:#14532d,stroke:#22c55e,color:#dcfce7");
  push("  classDef outcome fill:#064e3b,stroke:#10b981,color:#d1fae5");
  push("  classDef team fill:#3b0764,stroke:#a855f7,color:#f3e8ff");
  push("  classDef cost fill:#451a03,stroke:#f59e0b,color:#fef3c7");
  push("  classDef risk fill:#450a0a,stroke:#f87171,color:#fee2e2");
  push("  classDef adopt fill:#172554,stroke:#60a5fa,color:#dbeafe");

  // ── TODAY: the problem + current stack ────────────────────────────────────
  push('  subgraph TODAY["TODAY — Where you are"]');
  push(`    P0["Problem: ${lbl(problem, 80)}"]:::problem`);
  const stack = String(context?.stack ?? "").split(",").map((s) => s.trim()).filter((s) => s && !/recommend for me/i.test(s)).slice(0, 6);
  if (stack.length) {
    push(`    ST["Current stack: ${lbl(stack.join(" · "), 70)}"]:::stack`);
    push("    P0 --- ST");
  }
  if (solution?.costOfInaction?.annualCost) {
    push(`    CI["Cost of doing nothing: ${lbl(solution.costOfInaction.annualCost, 30)}/yr"]:::risk`);
    push("    P0 --- CI");
  }
  push("  end");

  // ── NEW TOOLS: the architecture being added ───────────────────────────────
  const tools: any[] = (solution?.tools ?? []).slice(0, 8);
  if (tools.length) {
    push('  subgraph TOOLS["NEW TOOLS — What gets added"]');
    tools.forEach((t, i) => {
      push(`    T${i}["${lbl(t.name, 30)}<br/><i>${lbl(t.category, 20)} — ${lbl(t.purpose, 40)}</i>"]:::tool`);
    });
    push("  end");
    push("  TODAY --> TOOLS");
  }

  // ── PHASES: each action with owner, exit criteria as gates ────────────────
  const phases: any[] = solution?.phases ?? [];
  const team: any[] = solution?.teamRequired ?? [];
  let prevBlock = tools.length ? "TOOLS" : "TODAY";
  phases.forEach((ph, pi) => {
    const owners = ownersFor(pi, String(ph.title ?? ""), team);
    push(`  subgraph PH${pi}["${lbl(ph.title, 50)}"]`);
    if (ph.objective) push(`    PH${pi}O["Goal: ${lbl(ph.objective, 60)}"]:::action`);
    const actions: string[] = (ph.actions ?? []).slice(0, 5);
    actions.forEach((a: string, ai: number) => {
      push(`    PH${pi}A${ai}["${lbl(a, 60)}"]:::action`);
      if (ai === 0 && ph.objective) push(`    PH${pi}O --> PH${pi}A0`);
      if (ai > 0) push(`    PH${pi}A${ai - 1} --> PH${pi}A${ai}`);
    });
    const exit: string[] = (ph.exitCriteria ?? []).slice(0, 3);
    if (exit.length && actions.length) {
      push(`    PH${pi}G{"Done when:<br/>${exit.map((e) => lbl(e, 45)).join("<br/>")}"}:::gate`);
      push(`    PH${pi}A${actions.length - 1} --> PH${pi}G`);
    }
    push("  end");
    push(`  ${prevBlock} --> PH${pi}`);
    prevBlock = exit.length && actions.length ? `PH${pi}G` : `PH${pi}`;
    // Team lanes: who staffs this phase (dashed)
    owners.slice(0, 3).forEach((o) => {
      const tid = `TM${o.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;
      push(`  ${tid}(["${lbl(o, 28)}"]):::team`);
      push(`  ${tid} -.-> PH${pi}`);
    });
  });

  // ── ADOPTION: change management ───────────────────────────────────────────
  const adoption: any[] = (solution?.adoptionPlan ?? []).slice(0, 4);
  if (adoption.length) {
    push('  subgraph ADOPT["ADOPTION — Making it stick"]');
    adoption.forEach((a, i) => push(`    AD${i}["${lbl(a.title, 45)}"]:::adopt`));
    push("  end");
    push(`  ${prevBlock} --> ADOPT`);
    prevBlock = "ADOPT";
  }

  // ── OUTCOMES: KPIs baseline → target ──────────────────────────────────────
  const kpis: any[] = (solution?.kpis ?? []).slice(0, 5);
  push('  subgraph WIN["OUTCOMES — Where you end up"]');
  if (kpis.length) {
    kpis.forEach((k, i) => {
      const from = k.baseline ? `${lbl(k.baseline, 15)} → ` : "";
      push(`    K${i}["${lbl(k.metric, 45)}<br/><b>${from}${lbl(k.target, 20)}</b>"]:::outcome`);
    });
  } else {
    push(`    K0["${lbl(solution?.summary, 80)}"]:::outcome`);
  }
  push("  end");
  push(`  ${prevBlock} --> WIN`);

  // ── INVESTMENT ────────────────────────────────────────────────────────────
  const firstYear = solution?.tco?.firstYearTotal || solution?.estimatedCost;
  if (firstYear) {
    const monthly = solution?.tco?.monthlyRecurring ? ` · ${lbl(solution.tco.monthlyRecurring, 18)} recurring` : "";
    push(`  COST["INVESTMENT: ${lbl(firstYear, 20)} first year${monthly} · ${lbl(solution?.timeToImplement, 25)}"]:::cost`);
    push("  COST -.-> WIN");
  }

  // ── TOP RISKS ─────────────────────────────────────────────────────────────
  const risks: any[] = (solution?.approvals?.riskAssessment ?? []).slice(0, 3);
  if (risks.length) {
    push('  subgraph RISKS["WATCH OUT — Top risks"]');
    risks.forEach((r, i) => push(`    R${i}["${lbl(r.severity ? `[${r.severity}] ` : "", 10)}${lbl(r.risk ?? r.name ?? r, 55)}"]:::risk`));
    push("  end");
    push("  RISKS -.-> WIN");
  }

  return L.join("\n");
}
