"use client";

import { useMemo, useState } from "react";
import { Copy, FileDown, Check } from "lucide-react";
import BigFlowChart from "@/components/BigFlowChart";
import { buildArchitectureFlow } from "@/lib/generate-architecture";
import { flowToMermaid } from "@/lib/generate-flow";

// System Architecture — a different question from the journey map: not
// "who does what, when" but "how do the systems actually connect, where are
// the cloud boundaries, and what's existing vs new vs being replaced."
// Same ReactFlow renderer as the journey map (BigFlowChart) for visual
// consistency; groups here are cloud/environment boundaries instead of
// rollout phases.
export default function ArchitectureMap({ solution }: { solution: any }) {
  const flow = useMemo(() => buildArchitectureFlow(solution), [solution]);
  const mermaidCode = useMemo(() => flowToMermaid(flow.nodes, flow.edges, flow.groups), [flow]);
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(mermaidCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  function downloadMmd() {
    const blob = new Blob([mermaidCode], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "architecture.mmd";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div data-architecture-map>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-white/40 text-xs">
          Systems, connections, cloud boundaries, and what&apos;s existing vs new vs replaced. 🔒 marks where sensitive data lives.
        </p>
        <div className="flex gap-2">
          <button onClick={copyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-all">
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied!" : "Copy as Mermaid"}
          </button>
          <button onClick={downloadMmd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-all">
            <FileDown className="w-3 h-3" /> .mmd
          </button>
        </div>
      </div>
      <BigFlowChart nodes={flow.nodes} edges={flow.edges} groups={flow.groups} minimap={false} />
      <p className="text-white/25 text-[11px] mt-2 flex flex-wrap gap-x-3">
        <span>🆕 New</span><span>🔹 Existing</span><span>🗑️ Being replaced</span><span>🛡️ Security control</span>
      </p>
    </div>
  );
}
