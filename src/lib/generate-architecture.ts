// System Architecture diagram builder — a different question from the
// journey map: not "who does what, when" but "how do the actual systems
// connect, where do the boundaries sit, and what's existing vs new."
//
// Reuses the exact same {id,label,type,group}/{from,to,label} shape as
// generate-flow.ts, so it renders through the same BigFlowChart component —
// same visual language, no new renderer needed. Groups here are cloud/
// environment boundaries (Azure, AWS, On-Prem, ...) instead of rollout phases.
//
// Needs data the schema didn't capture before this diagram was proposed:
// tools[].environment / .status / .dataSensitivity, and top-level dataFlow[]
// (see generate/route.ts + normalize-solution.ts). Reports generated before
// that schema addition simply won't have it — callers should check
// hasArchitectureData() and hide the section rather than render an empty one.

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { FNode, FEdge, FGroup } from "./generate-flow";

export interface ArchitectureFlow { nodes: FNode[]; edges: FEdge[]; groups: FGroup[]; }

function clip(s: unknown, max = 60): string {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24) || "n";
}

const ENV_ORDER = ["Azure", "AWS", "Google Cloud", "On-Prem", "Multi-cloud", "SaaS"];
const ENV_ACCENT: Record<string, string> = {
  Azure: "blue", AWS: "slate", "Google Cloud": "green", "On-Prem": "slate", "Multi-cloud": "blue", SaaS: "slate",
};

// A report only has enough structured data for this diagram if the synthesis
// actually filled in environment/status tags or real connections — otherwise
// this would render an empty or misleading box.
export function hasArchitectureData(solution: any): boolean {
  const tools: any[] = solution?.tools ?? [];
  const hasEnv = tools.some((t) => t?.environment);
  const hasFlow = Array.isArray(solution?.dataFlow) && solution.dataFlow.length > 0;
  return hasEnv || hasFlow;
}

// Best-effort $ figure for a tool from the TCO line items — reuses cost data
// the report already has instead of asking twice. Requires the line item to
// contain the FULL tool name: a first-word match wrongly attributed "Azure
// Data Factory data movement" costs to "Azure Synapse" (both start "Azure"),
// caught in the E2E run. No match on the full name = no cost badge, which is
// honest — a replaced/retired tool usually has no line item at all.
function costFor(name: string, lineItems: any[]): string | undefined {
  const n = name.toLowerCase().trim();
  if (n.length < 4) return undefined;
  const hit = (lineItems || []).find((li) => String(li?.item ?? "").toLowerCase().includes(n));
  return hit?.cost ? clip(hit.cost, 16) : undefined;
}

export function buildArchitectureFlow(solution: any): ArchitectureFlow {
  const nodes: FNode[] = [];
  const edges: FEdge[] = [];
  const groups: FGroup[] = [];

  const tools: any[] = solution?.tools ?? [];
  const lineItems: any[] = solution?.tco?.lineItems ?? [];

  // Group tools by environment, in a stable, sensible order; anything
  // untagged falls into a catch-all "Your Stack" group rather than vanishing.
  const envs = ENV_ORDER.filter((e) => tools.some((t) => t?.environment === e));
  const untaggedTools = tools.filter((t) => !t?.environment);
  const envList = [...envs, ...(untaggedTools.length ? ["Your Stack"] : [])];

  const idByName = new Map<string, string>();

  envList.forEach((env) => {
    const gid = slug(env);
    groups.push({ id: gid, label: env, accent: ENV_ACCENT[env] || "slate" });
    const envTools = env === "Your Stack" ? untaggedTools : tools.filter((t) => t.environment === env);
    envTools.forEach((t) => {
      const id = `n_${slug(t.name)}`;
      idByName.set(t.name.toLowerCase(), id);
      const badge = t.status === "existing" ? "🔹" : t.status === "replaced" ? "🗑️" : "🆕";
      const sensitivity = t.dataSensitivity ? ` [${clip(t.dataSensitivity, 14)}]` : "";
      const cost = costFor(t.name, lineItems);
      const label = `${badge} ${clip(t.name, 28)}${sensitivity}${cost ? `\n${cost}` : ""}`;
      const type = t.status === "existing" ? "stack" : t.status === "replaced" ? "risk" : "tool";
      nodes.push({ id, label, type, group: gid });
    });
  });

  // Connections — the actual "how do these talk to each other" edges.
  // Endpoints not in tools[] (e.g. an existing ERP kept in place) go into a
  // dedicated "External / Existing" group so they lay out as a tidy column
  // instead of loose nodes colliding with controls (the E2E clutter finding).
  const dataFlow: any[] = solution?.dataFlow ?? [];
  let externalGroupAdded = false;
  const ensureExternal = (name: string): string => {
    const id = `ext_${slug(name)}`;
    if (!nodes.some((n) => n.id === id)) {
      if (!externalGroupAdded) { groups.push({ id: "external", label: "🏢 External / Existing systems", accent: "slate" }); externalGroupAdded = true; }
      nodes.push({ id, label: `🏢 ${clip(name, 26)}`, type: "stack", group: "external" });
    }
    return id;
  };
  dataFlow.forEach((d) => {
    const fromId = idByName.get(String(d.from ?? "").toLowerCase()) ?? ensureExternal(String(d.from));
    const toId = idByName.get(String(d.to ?? "").toLowerCase()) ?? ensureExternal(String(d.to));
    edges.push({ from: fromId, to: toId, label: clip(d.via, 20) + (d.note ? ` (${clip(d.note, 16)})` : "") });
  });

  // Security / access layer — its own labeled group, NO fan-out edges: the
  // dashed lines from every control to every environment were pure clutter.
  const controls: any[] = (solution?.approvals?.itControls ?? []).slice(0, 3);
  if (controls.length) {
    groups.push({ id: "security", label: "Security & Access (applies to all)", accent: "slate" });
    controls.forEach((c, i) => {
      nodes.push({ id: `sec${i}`, label: clip(c.name, 30), type: "team", group: "security" });
    });
  }

  return { nodes, edges, groups };
}
