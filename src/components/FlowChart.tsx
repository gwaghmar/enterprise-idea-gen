"use client";

import ReactFlow, {
  Node,
  Edge,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import Dagre from "@dagrejs/dagre";

interface FlowNode {
  id: string;
  label: string;
  type: string;
}

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

interface Props {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;

// Google Material Design — muted, not too bright
const nodeColors: Record<string, { bg: string; border: string; text: string }> = {
  start:    { bg: "#E8F5E9", border: "#43A047", text: "#1B5E20" },
  end:      { bg: "#FFEBEE", border: "#E53935", text: "#B71C1C" },
  decision: { bg: "#FFF3E0", border: "#FB8C00", text: "#E65100" },
  process:  { bg: "#E3F2FD", border: "#1E88E5", text: "#0D47A1" },
};

function buildDagreLayout(nodes: FlowNode[], edges: FlowEdge[]): Node[] {
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 90 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => g.setEdge(e.from, e.to));

  Dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    const colors = nodeColors[n.type] || nodeColors.process;

    return {
      id: n.id,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
      data: {
        label: (
          <div className="text-center px-1">
            <div className="font-semibold text-sm leading-tight" style={{ color: colors.text }}>
              {n.label}
            </div>
          </div>
        ),
      },
      style: {
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: n.type === "decision" ? "6px" : "12px",
        padding: "8px 12px",
        width: NODE_WIDTH,
        fontSize: 13,
        fontFamily: "var(--font-inter), Inter, sans-serif",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      },
    };
  });
}

export default function FlowChart({ nodes, edges }: Props) {
  const rfNodes = buildDagreLayout(nodes, edges);
  const rfEdges: Edge[] = edges.map((e, i) => ({
    id: `e${i}`,
    source: e.from,
    target: e.to,
    label: e.label || "",
    labelStyle: { fill: "#5F6368", fontSize: 11, fontWeight: 500, fontFamily: "var(--font-inter), Inter, sans-serif" },
    labelBgStyle: { fill: "#fff", fillOpacity: 0.9 },
    labelBgPadding: [4, 6] as [number, number],
    labelBgBorderRadius: 4,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#9E9E9E" },
    style: { stroke: "#BDBDBD", strokeWidth: 2 },
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
      fitViewOptions={{ padding: 0.35 }}
      minZoom={0.2}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        color="#E0E0E0"
        gap={20}
        variant={BackgroundVariant.Dots}
        style={{ background: "#FFFFFF" }}
      />
      <Controls style={{ background: "#fff", border: "1px solid #E0E0E0", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }} />
    </ReactFlow>
  );
}
