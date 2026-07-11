"use client";

import { useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  Handle,
  Position,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import type { ArchModel, ArchSystem } from "@/lib/arch-stages";
import { LANES } from "@/lib/arch-stages";

// Professional system-design rendering:
//   - pipeline lanes (Sources → Ingestion → Platform → Consumers) enforced
//     via ELK layered layout with partitions — the diagram reads as a flow
//   - elkjs (the layout engine real diagram tools use) computes positions;
//     lazy-loaded (~150KB gz) only when this diagram mounts
//   - custom nodes: product logo (favicon of the tool's source domain, with
//     a lettermark fallback), name, status chip, sensitivity + cost badges
//   - environment (Azure/AWS/SaaS) as tinted background zones, not groups
//   - security controls as a full-width band along the bottom, no edge soup

const NODE_W = 200;
const NODE_H = 74;

const STATUS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  new:      { label: "NEW",      bg: "#DBEAFE", text: "#1D4ED8", border: "#3B82F6" },
  existing: { label: "EXISTING", bg: "#F1F5F9", text: "#475569", border: "#94A3B8" },
  replaced: { label: "RETIRED",  bg: "#FEE2E2", text: "#B91C1C", border: "#EF4444" },
};

const ENV_TINT: Record<string, { fill: string; border: string; text: string }> = {
  Azure:          { fill: "rgba(59,130,246,0.05)",  border: "rgba(59,130,246,0.35)",  text: "#3B82F6" },
  AWS:            { fill: "rgba(245,158,11,0.05)",  border: "rgba(245,158,11,0.40)",  text: "#B45309" },
  "Google Cloud": { fill: "rgba(34,197,94,0.05)",   border: "rgba(34,197,94,0.35)",   text: "#15803D" },
  "On-Prem":      { fill: "rgba(100,116,139,0.06)", border: "rgba(100,116,139,0.35)", text: "#475569" },
  "Multi-cloud":  { fill: "rgba(168,85,247,0.05)",  border: "rgba(168,85,247,0.35)",  text: "#7E22CE" },
  SaaS:           { fill: "rgba(14,165,233,0.05)",  border: "rgba(14,165,233,0.35)",  text: "#0369A1" },
};

function domainOf(url?: string): string | null {
  try { return url ? new URL(url).hostname.replace(/^www\./, "") : null; } catch { return null; }
}

function SystemNode({ data }: { data: { sys: ArchSystem } }) {
  const s = data.sys;
  const st = STATUS[s.status] ?? STATUS.new;
  const domain = domainOf(s.sourceUrl);
  const initials = s.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <div
      style={{
        width: NODE_W, minHeight: NODE_H,
        background: "#fff",
        border: `1.5px solid ${st.border}`,
        borderRadius: 10,
        boxShadow: "0 1px 3px rgba(15,23,42,0.10)",
        padding: "8px 10px",
        opacity: s.status === "replaced" ? 0.75 : 1,
        fontFamily: "var(--font-geist-sans), sans-serif",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "#94A3B8", width: 6, height: 6 }} />
      <Handle type="source" position={Position.Right} style={{ background: "#94A3B8", width: 6, height: 6 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {domain ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" width={22} height={22}
            style={{ borderRadius: 5, flexShrink: 0 }} />
        ) : (
          <div style={{
            width: 22, height: 22, borderRadius: 5, flexShrink: 0,
            background: st.bg, color: st.text, border: `1px solid ${st.border}`,
            fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
          }}>{initials}</div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 11.5, fontWeight: 600, color: "#0F172A", lineHeight: 1.25,
            textDecoration: s.status === "replaced" ? "line-through" : "none",
          }}>{s.name}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6, alignItems: "center" }}>
        <span style={{
          fontSize: 8, fontWeight: 700, letterSpacing: 0.4, padding: "1.5px 6px",
          borderRadius: 999, background: st.bg, color: st.text,
        }}>{st.label}</span>
        {s.dataSensitivity && (
          <span style={{
            fontSize: 8, fontWeight: 700, padding: "1.5px 6px", borderRadius: 999,
            background: "#FEF3C7", color: "#92400E",
          }}>🔒 {s.dataSensitivity}</span>
        )}
        {s.cost && (
          <span style={{ fontSize: 9, color: "#64748B", fontWeight: 600 }}>{s.cost}</span>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { system: SystemNode };

interface Positioned { id: string; x: number; y: number; }

function ArchDiagramInner({ model }: { model: ArchModel }) {
  const [pos, setPos] = useState<Positioned[] | null>(null);

  // ELK layered layout: partitions pin each system to its pipeline lane,
  // the engine handles crossing minimization + spacing within/between lanes.
  useEffect(() => {
    let alive = true;
    (async () => {
      const ELK = (await import("elkjs/lib/elk.bundled.js")).default;
      const elk = new ELK();
      const graph = {
        id: "root",
        layoutOptions: {
          "elk.algorithm": "layered",
          "elk.direction": "RIGHT",
          // Without this, a system with no dataFlow edges (e.g. the retired
          // warehouse) is laid out as a separate component and escapes its
          // pipeline lane, dragging lane headers with it.
          "elk.separateConnectedComponents": "false",
          "elk.partitioning.activate": "true",
          "elk.layered.spacing.nodeNodeBetweenLayers": "110",
          "elk.spacing.nodeNode": "28",
          "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
        },
        children: model.systems.map((s) => ({
          id: s.id, width: NODE_W, height: NODE_H,
          layoutOptions: { "elk.partitioning.partition": String(s.lane) },
        })),
        edges: model.links.map((l, i) => ({ id: `e${i}`, sources: [l.from], targets: [l.to] })),
      };
      try {
        const out = await elk.layout(graph as never);
        if (!alive) return;
        setPos((out.children ?? []).map((c: { id: string; x?: number; y?: number }) => ({ id: c.id, x: c.x ?? 0, y: c.y ?? 0 })));
      } catch {
        if (alive) setPos(model.systems.map((s, i) => ({ id: s.id, x: s.lane * 280, y: i * 90 })));
      }
    })();
    return () => { alive = false; };
  }, [model]);

  const { nodes, edges } = useMemo(() => {
    if (!pos) return { nodes: [] as Node[], edges: [] as Edge[] };
    const byId = new Map(pos.map((p) => [p.id, p]));
    const sysById = new Map(model.systems.map((s) => [s.id, s]));

    const maxY = Math.max(...pos.map((p) => p.y + NODE_H), 0);
    const minY = Math.min(...pos.map((p) => p.y), 0);

    // Lane headers above the columns
    const laneX = new Map<number, { min: number; max: number }>();
    pos.forEach((p) => {
      const lane = sysById.get(p.id)?.lane ?? 0;
      const cur = laneX.get(lane) ?? { min: Infinity, max: -Infinity };
      laneX.set(lane, { min: Math.min(cur.min, p.x), max: Math.max(cur.max, p.x + NODE_W) });
    });
    // Header width = the lane's actual column width, so adjacent middle
    // lanes can't overlap each other's titles.
    const headerNodes: Node[] = [...laneX.entries()].map(([lane, r]) => {
      const w = Math.max(120, r.max - r.min);
      return {
        id: `lane-${lane}`,
        position: { x: r.min + (r.max - r.min) / 2 - w / 2, y: minY - 36 },
        data: { label: (
          <div style={{ width: w, textAlign: "center", fontSize: 9.5, fontWeight: 800, letterSpacing: 1, color: "#94A3B8", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {LANES[lane as 0 | 1 | 2 | 3]}
          </div>
        ) },
        draggable: false, selectable: false,
        style: { background: "transparent", border: "none", width: w, padding: 0 },
      };
    });

    // Environment tint zones: bounding box per env over its systems
    const envBoxes = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>();
    pos.forEach((p) => {
      const env = sysById.get(p.id)?.environment;
      if (!env) return;
      const b = envBoxes.get(env) ?? { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      b.minX = Math.min(b.minX, p.x - 14); b.minY = Math.min(b.minY, p.y - 14);
      b.maxX = Math.max(b.maxX, p.x + NODE_W + 14); b.maxY = Math.max(b.maxY, p.y + NODE_H + 14);
      envBoxes.set(env, b);
    });
    const zoneNodes: Node[] = [...envBoxes.entries()].map(([env, b]) => {
      const tint = ENV_TINT[env] ?? ENV_TINT["On-Prem"];
      return {
        id: `zone-${env}`,
        position: { x: b.minX, y: b.minY },
        data: { label: (
          <div style={{ position: "absolute", top: 3, right: 10, fontSize: 9, fontWeight: 700, color: tint.text, letterSpacing: 0.5 }}>☁ {env}</div>
        ) },
        draggable: false, selectable: false,
        style: {
          width: b.maxX - b.minX, height: b.maxY - b.minY,
          background: tint.fill, border: `1.5px dashed ${tint.border}`, borderRadius: 14, zIndex: -1,
        },
      };
    });

    // Security band, full width under everything
    const allMinX = Math.min(...pos.map((p) => p.x), 0) - 14;
    const allMaxX = Math.max(...pos.map((p) => p.x + NODE_W)) + 14;
    const bandNodes: Node[] = model.controls.length ? [{
      id: "security-band",
      position: { x: allMinX, y: maxY + 34 },
      data: { label: (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 12px" }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "#7E22CE" }}>🛡 SECURITY & ACCESS</span>
          {model.controls.map((c, i) => (
            <span key={i} style={{ fontSize: 9.5, fontWeight: 600, color: "#6B21A8", background: "#F3E8FF", border: "1px solid #D8B4FE", borderRadius: 999, padding: "2px 9px" }}>{c}</span>
          ))}
        </div>
      ) },
      draggable: false, selectable: false,
      style: {
        width: allMaxX - allMinX, minHeight: 38,
        background: "rgba(168,85,247,0.05)", border: "1.5px dashed rgba(168,85,247,0.4)",
        borderRadius: 12, padding: 0,
      },
    }] : [];

    const sysNodes: Node[] = pos.map((p) => ({
      id: p.id, type: "system",
      position: { x: p.x, y: p.y },
      data: { sys: sysById.get(p.id)! },
    }));

    const rfEdges: Edge[] = model.links.map((l, i) => ({
      id: `e${i}`,
      source: l.from, target: l.to,
      label: l.via + (l.note ? ` · ${l.note}` : ""),
      type: "smoothstep",
      pathOptions: { borderRadius: 6 },
      labelStyle: { fill: "#475569", fontSize: 9.5, fontWeight: 600 },
      labelBgStyle: { fill: "#fff", fillOpacity: 0.95 },
      labelBgPadding: [3, 5] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#64748B", width: 16, height: 16 },
      style: { stroke: "#94A3B8", strokeWidth: 1.6 },
    }));

    return { nodes: [...zoneNodes, ...headerNodes, ...bandNodes, ...sysNodes], edges: rfEdges };
  }, [pos, model]);

  if (!pos) {
    return <div style={{ height: 420 }} className="flex items-center justify-center text-white/30 text-sm">Laying out the architecture…</div>;
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.08, maxZoom: 1.05, minZoom: 0.45 }}
      minZoom={0.2}
      maxZoom={1.6}
      nodesDraggable
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#E2E8F0" gap={22} variant={BackgroundVariant.Dots} style={{ background: "#FAFBFD" }} />
      <Controls style={{ background: "#fff", border: "1px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }} />
    </ReactFlow>
  );
}

export default function ArchDiagram({ model }: { model: ArchModel }) {
  return (
    <div style={{ height: 440 }} className="rounded-2xl overflow-hidden border border-black/5">
      <ReactFlowProvider>
        <ArchDiagramInner model={model} />
      </ReactFlowProvider>
    </div>
  );
}
