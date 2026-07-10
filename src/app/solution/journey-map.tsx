"use client";

import { useMemo, useState } from "react";
import { Copy, FileDown, Check } from "lucide-react";
import BigFlowChart from "@/components/BigFlowChart";
import { buildJourneyFlow } from "@/lib/generate-flow";
import { generateMermaid } from "@/lib/generate-mermaid";

// The end-to-end journey — rendered natively with ReactFlow (same visual
// language as the per-phase FlowChart already in the report: white card,
// dotted background, Material palette), not a separately-styled diagram.
// Mermaid text is still generated from the same underlying report data and
// offered as a secondary "copy as portable code" export for pasting into
// Notion/GitHub/Confluence/draw.io — it just isn't the primary renderer.
export default function JourneyMap({ solution, problem, context }: {
  solution: any; problem: string; context?: { stack?: string };
}) {
  const flow = useMemo(() => buildJourneyFlow(solution, problem, context), [solution, problem, context]);
  const mermaidCode = useMemo(() => generateMermaid(solution, problem, context), [solution, problem, context]);
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
    a.download = "journey-map.mmd";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div data-journey-map>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-white/40 text-xs">
          Problem → tools → phases → adoption → outcomes, with owners, gates, cost and risks — one picture. Drag, scroll, and zoom to explore.
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
      <BigFlowChart nodes={flow.nodes} edges={flow.edges} groups={flow.groups} />
      <p className="text-white/25 text-[11px] mt-2">
        Portable version: &quot;Copy as Mermaid&quot; pastes into Notion, GitHub, Confluence or draw.io as the same diagram.
      </p>
    </div>
  );
}
