"use client";

import { useMemo, useState } from "react";
import { Copy, FileDown, Check } from "lucide-react";
import ArchDiagram from "@/components/ArchDiagram";
import { buildArchModel } from "@/lib/arch-stages";
import { buildArchitectureFlow } from "@/lib/generate-architecture";
import { flowToMermaid } from "@/lib/generate-flow";

// System Architecture — pipeline-lane rendering (Sources → Ingestion →
// Platform → Consumers) with ELK layered layout, product logos, status/
// sensitivity badges, environment tint zones and a security band.
// The Mermaid export still comes from the environment-grouped builder,
// which suits Mermaid's subgraph model better than lanes do.
export default function ArchitectureMap({ solution }: { solution: any }) {
  const model = useMemo(() => buildArchModel(solution), [solution]);
  const mermaidCode = useMemo(() => {
    const flow = buildArchitectureFlow(solution);
    return flowToMermaid(flow.nodes, flow.edges, flow.groups);
  }, [solution]);
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
          How data moves: sources → ingestion → platform → consumers. Cloud zones tinted; 🔒 marks where sensitive data lives.
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
      <ArchDiagram model={model} />
    </div>
  );
}
