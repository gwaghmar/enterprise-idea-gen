"use client";

import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";

interface FlowNode {
  id: string;
  label: string;
  type: string;
  description: string;
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

const nodeColors: Record<string, { bg: string; border: string; text: string }> = {
  start: { bg: "#16a34a", border: "#22c55e", text: "#fff" },
  end: { bg: "#dc2626", border: "#ef4444", text: "#fff" },
  decision: { bg: "#d97706", border: "#f59e0b", text: "#fff" },
  process: { bg: "#1d4ed8", border: "#3b82f6", text: "#fff" },
};

function buildLayout(nodes: FlowNode[]): Node[] {
  const cols = 2;
  const xGap = 280;
  const yGap = 120;

  return nodes.map((n, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const colors = nodeColors[n.type] || nodeColors.process;

    return {
      id: n.id,
      position: { x: col * xGap + (row % 2 === 0 ? 0 : 40), y: row * yGap },
      data: {
        label: (
          <div className="text-center px-1">
            <div className="font-semibold text-sm leading-tight">{n.label}</div>
            {n.description && (
              <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{n.description}</div>
            )}
          </div>
        ),
      },
      style: {
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        color: colors.text,
        borderRadius: n.type === "decision" ? "8px" : "12px",
        padding: "8px 12px",
        width: 200,
        fontSize: 13,
      },
    };
  });
}

export default function FlowChart({ nodes, edges }: Props) {
  const rfNodes = buildLayout(nodes);
  const rfEdges: Edge[] = edges.map((e, i) => ({
    id: `e${i}`,
    source: e.from,
    target: e.to,
    label: e.label || "",
    labelStyle: { fill: "#fff", fontSize: 11 },
    labelBgStyle: { fill: "#333" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#666" },
    style: { stroke: "#555", strokeWidth: 2 },
    animated: false,
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
      fitViewOptions={{ padding: 0.3 }}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#333" gap={20} />
      <Controls style={{ background: "#111", border: "1px solid #333" }} />
    </ReactFlow>
  );
}
