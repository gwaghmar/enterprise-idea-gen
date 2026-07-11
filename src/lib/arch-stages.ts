// Pipeline-stage assignment for the System Architecture diagram.
//
// Professional architecture diagrams read as a flow: SOURCES → INGESTION →
// PLATFORM → CONSUMERS, left to right. The stage of each system is derived
// deterministically from the dataFlow topology — no AI:
//   - nothing flows INTO it  → source
//   - nothing flows OUT of it → consumer
//   - otherwise → graph depth orders the middle lanes
// Systems that appear in tools[] but not in any dataFlow edge fall back to a
// category heuristic so they still land in a sensible lane.

/* eslint-disable @typescript-eslint/no-explicit-any */

export const LANES = ["Sources", "Ingestion & Integration", "Data Platform", "Consumers"] as const;
export type Lane = 0 | 1 | 2 | 3;

export interface ArchSystem {
  id: string;
  name: string;
  lane: Lane;
  environment?: string;   // Azure | AWS | ... | SaaS
  status: "existing" | "new" | "replaced";
  dataSensitivity?: string;
  cost?: string;
  sourceUrl?: string;     // for the logo favicon
  external: boolean;      // referenced by dataFlow but not in tools[]
}
export interface ArchLink { from: string; to: string; via: string; note?: string; }
export interface ArchModel {
  systems: ArchSystem[];
  links: ArchLink[];
  controls: string[];     // security/access layer band
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 32) || "n";

function laneFromCategory(category: string): Lane {
  const c = (category || "").toLowerCase();
  if (/integration|automation/.test(c)) return 1;
  if (/analytics|storage|infrastructure|security/.test(c)) return 2;
  if (/crm|communication/.test(c)) return 3;
  return 2;
}

export function buildArchModel(solution: any): ArchModel {
  const tools: any[] = solution?.tools ?? [];
  const flows: any[] = solution?.dataFlow ?? [];
  const lineItems: any[] = solution?.tco?.lineItems ?? [];

  const byName = new Map<string, ArchSystem>();
  const idOf = (name: string) => `n_${slug(name)}`;

  const costFor = (name: string): string | undefined => {
    const n = name.toLowerCase().trim();
    if (n.length < 4) return undefined;
    const hit = lineItems.find((li) => String(li?.item ?? "").toLowerCase().includes(n));
    return hit?.cost ? String(hit.cost).slice(0, 16) : undefined;
  };

  tools.forEach((t) => {
    const name = String(t?.name ?? "").trim();
    if (!name) return;
    byName.set(name.toLowerCase(), {
      id: idOf(name), name,
      lane: laneFromCategory(t.category),
      environment: t.environment || undefined,
      status: t.status === "replaced" ? "replaced" : t.status === "existing" ? "existing" : "new",
      dataSensitivity: t.dataSensitivity || undefined,
      cost: costFor(name),
      sourceUrl: t.sourceUrl || undefined,
      external: false,
    });
  });

  // dataFlow endpoints not in tools[] are external/existing systems.
  const links: ArchLink[] = [];
  flows.forEach((d) => {
    const from = String(d?.from ?? "").trim();
    const to = String(d?.to ?? "").trim();
    if (!from || !to) return;
    for (const name of [from, to]) {
      if (!byName.has(name.toLowerCase())) {
        byName.set(name.toLowerCase(), {
          id: idOf(name), name, lane: 0, status: "existing", external: true,
        });
      }
    }
    links.push({ from: idOf(from), to: idOf(to), via: String(d?.via ?? "").slice(0, 24), note: d?.note ? String(d.note).slice(0, 24) : undefined });
  });

  // Topology overrides category: in-degree 0 → source; out-degree 0 → consumer;
  // middle systems ordered by longest-path depth (1 hop → ingestion, deeper → platform).
  const systems = [...byName.values()];
  const inDeg = new Map(systems.map((s) => [s.id, 0]));
  const outDeg = new Map(systems.map((s) => [s.id, 0]));
  links.forEach((l) => {
    inDeg.set(l.to, (inDeg.get(l.to) ?? 0) + 1);
    outDeg.set(l.from, (outDeg.get(l.from) ?? 0) + 1);
  });
  const inFlow = new Set(links.flatMap((l) => [l.from, l.to]));

  // longest-path depth from any source, bounded to avoid cycles
  const adj = new Map<string, string[]>();
  links.forEach((l) => adj.set(l.from, [...(adj.get(l.from) ?? []), l.to]));
  const depth = new Map<string, number>();
  const sources = systems.filter((s) => inFlow.has(s.id) && (inDeg.get(s.id) ?? 0) === 0);
  const queue: [string, number][] = sources.map((s) => [s.id, 0]);
  let guard = 0;
  while (queue.length && guard++ < 500) {
    const [id, d] = queue.shift()!;
    if ((depth.get(id) ?? -1) >= d) continue;
    depth.set(id, d);
    (adj.get(id) ?? []).forEach((next) => queue.push([next, d + 1]));
  }

  systems.forEach((s) => {
    if (!inFlow.has(s.id)) return; // keep category lane
    const din = inDeg.get(s.id) ?? 0;
    const dout = outDeg.get(s.id) ?? 0;
    if (din === 0) s.lane = 0;
    else if (dout === 0) s.lane = 3;
    else s.lane = (depth.get(s.id) ?? 1) <= 1 ? 1 : 2;
  });

  const controls = (solution?.approvals?.itControls ?? [])
    .slice(0, 4)
    .map((c: any) => String(c?.name ?? "").trim())
    .filter(Boolean);

  return { systems, links, controls };
}
