"use client";

import ReactFlow, {
  Node,
  Edge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import Dagre from "@dagrejs/dagre";
import type { FNode, FEdge, FGroup } from "@/lib/generate-flow";

// Same visual language as the existing per-phase FlowChart (Material,
// white background) — this is the "big version" of that component, not a
// different look. Renders many small groups (one per report section) laid
// out left-to-right, each as its own local flowchart inside a labeled panel.

const NW = 190;
const NH = 62;
const GROUP_PAD = 20;
const GROUP_TITLE_H = 30;
const GROUP_GAP = 50;
const LOOSE_GAP = 18;

const nodeStyle: Record<string, { bg: string; border: string; text: string }> = {
  problem:  { bg: "#FFEBEE", border: "#E53935", text: "#B71C1C" },
  risk:     { bg: "#FFEBEE", border: "#E53935", text: "#B71C1C" },
  stack:    { bg: "#F1F5F9", border: "#64748B", text: "#334155" },
  tool:     { bg: "#E3F2FD", border: "#1E88E5", text: "#0D47A1" },
  action:   { bg: "#E3F2FD", border: "#1E88E5", text: "#0D47A1" },
  gate:     { bg: "#FFF3E0", border: "#FB8C00", text: "#E65100" },
  team:     { bg: "#F3E8FF", border: "#A855F7", text: "#6B21A8" },
  cost:     { bg: "#FEF3C7", border: "#F59E0B", text: "#92400E" },
  adopt:    { bg: "#E0F2FE", border: "#0EA5E9", text: "#075985" },
  outcome:  { bg: "#E8F5E9", border: "#43A047", text: "#1B5E20" },
};

const groupAccent: Record<string, string> = {
  red: "#EF4444", blue: "#3B82F6", slate: "#94A3B8", green: "#22C55E",
};

interface Props { nodes: FNode[]; edges: FEdge[]; groups: FGroup[]; }

function layout(nodes: FNode[], edges: FEdge[], groups: FGroup[]) {
  const pos: Record<string, { x: number; y: number }> = {};
  const boxes: { id: string; label: string; accent: string; x: number; y: number; w: number; h: number }[] = [];
  let xCursor = 0;
  let maxGroupH = 0;

  for (const g of groups) {
    const gNodes = nodes.filter((n) => n.group === g.id);
    if (!gNodes.length) continue;
    const ids = new Set(gNodes.map((n) => n.id));
    const gEdges = edges.filter((e) => ids.has(e.from) && ids.has(e.to));

    const dg = new Dagre.graphlib.Graph();
    dg.setDefaultEdgeLabel(() => ({}));
    dg.setGraph({ rankdir: "TB", nodesep: 14, ranksep: 26 });
    gNodes.forEach((n) => dg.setNode(n.id, { width: NW, height: NH }));
    gEdges.forEach((e) => dg.setEdge(e.from, e.to));
    Dagre.layout(dg);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    gNodes.forEach((n) => {
      const p = dg.node(n.id);
      minX = Math.min(minX, p.x - NW / 2); maxX = Math.max(maxX, p.x + NW / 2);
      minY = Math.min(minY, p.y - NH / 2); maxY = Math.max(maxY, p.y + NH / 2);
    });
    const w = maxX - minX, h = maxY - minY;
    const offX = xCursor + GROUP_PAD - minX;
    const offY = GROUP_TITLE_H + GROUP_PAD - minY;
    gNodes.forEach((n) => {
      const p = dg.node(n.id);
      pos[n.id] = { x: p.x + offX - NW / 2, y: p.y + offY - NH / 2 };
    });
    const boxW = w + GROUP_PAD * 2;
    const boxH = h + GROUP_PAD * 2 + GROUP_TITLE_H;
    boxes.push({ id: g.id, label: g.label, accent: groupAccent[g.accent] || "#94A3B8", x: xCursor, y: 0, w: boxW, h: boxH });
    maxGroupH = Math.max(maxGroupH, boxH);
    xCursor += boxW + GROUP_GAP;
  }

  // Loose nodes (cost, risk) stack to the right of the last group, vertically centered.
  const loose = nodes.filter((n) => !n.group);
  const looseH = loose.length * (NH + LOOSE_GAP) - LOOSE_GAP;
  let yLoose = Math.max(0, (maxGroupH - looseH) / 2);
  loose.forEach((n) => {
    pos[n.id] = { x: xCursor, y: yLoose };
    yLoose += NH + LOOSE_GAP;
  });

  return { pos, boxes, totalW: xCursor + NW + GROUP_PAD, totalH: maxGroupH };
}

function BigFlowChartInner({ nodes, edges, groups }: Props) {
  const { pos, boxes } = layout(nodes, edges, groups);

  const rfNodes: Node[] = [
    ...boxes.map((b) => ({
      id: `group-${b.id}`,
      position: { x: b.x, y: b.y },
      data: { label: <div className="w-full h-full" /> },
      draggable: false,
      selectable: false,
      style: {
        width: b.w, height: b.h,
        background: "rgba(248,250,252,0.6)",
        border: `1.5px dashed ${b.accent}`,
        borderRadius: 14,
        zIndex: 0,
      } as React.CSSProperties,
    })),
    ...boxes.map((b) => ({
      id: `label-${b.id}`,
      position: { x: b.x + 10, y: b.y + 6 },
      data: { label: <div className="text-xs font-bold whitespace-nowrap" style={{ color: b.accent }}>{b.label}</div> },
      draggable: false, selectable: false,
      style: { background: "transparent", border: "none", width: "auto", padding: 0, zIndex: 0 } as React.CSSProperties,
    })),
    ...nodes.map((n) => {
      const c = nodeStyle[n.type] || nodeStyle.action;
      const p = pos[n.id] || { x: 0, y: 0 };
      return {
        id: n.id,
        position: p,
        data: {
          label: (
            <div className="text-center px-1 whitespace-pre-line">
              <div className="font-semibold leading-tight" style={{ color: c.text, fontSize: 11.5 }}>{n.label}</div>
            </div>
          ),
        },
        style: {
          background: c.bg, border: `2px solid ${c.border}`,
          borderRadius: n.type === "gate" ? 6 : 12,
          padding: "6px 10px", width: NW, minHeight: NH,
          fontFamily: "var(--font-geist-sans), sans-serif",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)", zIndex: 1,
        } as React.CSSProperties,
      };
    }),
  ];

  const rfEdges: Edge[] = edges.map((e, i) => ({
    id: `e${i}`,
    source: e.from, target: e.to,
    label: e.label || "",
    labelStyle: { fill: "#5F6368", fontSize: 10, fontWeight: 500 },
    labelBgStyle: { fill: "#fff", fillOpacity: 0.9 },
    markerEnd: { type: MarkerType.ArrowClosed, color: e.dashed ? "#A855F7" : "#9E9E9E" },
    style: { stroke: e.dashed ? "#A855F7" : "#BDBDBD", strokeWidth: e.dashed ? 1.5 : 2, strokeDasharray: e.dashed ? "5 4" : undefined },
    type: "smoothstep",
  }));

  const [rNodes, , onNodesChange] = useNodesState(rfNodes);
  const [rEdges, , onEdgesChange] = useEdgesState(rfEdges);

  return (
    <ReactFlow
      nodes={rNodes}
      edges={rEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
      minZoom={0.15}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#E0E0E0" gap={20} variant={BackgroundVariant.Dots} style={{ background: "#FFFFFF" }} />
      <Controls style={{ background: "#fff", border: "1px solid #E0E0E0", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }} />
      <MiniMap style={{ background: "#fff", border: "1px solid #E0E0E0" }} nodeColor={() => "#93C5FD"} maskColor="rgba(240,240,240,0.6)" />
    </ReactFlow>
  );
}

export default function BigFlowChart(props: Props) {
  return (
    <div style={{ height: 360 }} className="rounded-2xl overflow-hidden border border-black/5">
      <ReactFlowProvider>
        <BigFlowChartInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
