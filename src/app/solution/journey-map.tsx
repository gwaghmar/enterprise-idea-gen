"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, FileDown, Check } from "lucide-react";

// Live-rendered end-to-end journey map (Mermaid). The diagram source comes
// from generate-mermaid.ts — deterministic, built from the report data.
// Mermaid is heavy (~1.5MB), so it's imported only when this section mounts.
export default function JourneyMap({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState("");
  const [err, setErr] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          darkMode: true,
          securityLevel: "strict",
          flowchart: { curve: "basis", nodeSpacing: 30, rankSpacing: 45, padding: 8 },
          themeVariables: { fontFamily: "var(--font-geist-sans), sans-serif", fontSize: "13px" },
        });
        // Validate first so a malformed diagram degrades to the copy-only view
        await mermaid.parse(code);
        const { svg } = await mermaid.render(`journey-${Date.now() % 1e6}`, code);
        if (alive) setSvg(svg);
      } catch {
        if (alive) setErr(true);
      }
    })();
    return () => { alive = false; };
  }, [code]);

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  function downloadMmd() {
    const blob = new Blob([code], { type: "text/plain" });
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
          Problem → tools → phases → adoption → outcomes, with owners, gates, cost and risks — one picture.
        </p>
        <div className="flex gap-2">
          <button onClick={copyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-all">
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied!" : "Copy Mermaid"}
          </button>
          <button onClick={downloadMmd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-all">
            <FileDown className="w-3 h-3" /> .mmd
          </button>
        </div>
      </div>
      {svg ? (
        <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-4 overflow-x-auto"
          // Mermaid emits sanitized SVG (securityLevel: strict)
          dangerouslySetInnerHTML={{ __html: svg }} />
      ) : err ? (
        <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-4">
          <p className="text-white/40 text-sm mb-2">Diagram preview unavailable — the Mermaid source still works:</p>
          <pre className="text-xs text-white/60 overflow-x-auto max-h-64">{code}</pre>
        </div>
      ) : (
        <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-10 text-center text-white/30 text-sm">
          Drawing the journey…
        </div>
      )}
      <p className="text-white/25 text-[11px] mt-2">
        Paste the Mermaid into Notion, GitHub, Confluence or draw.io — it renders as this diagram.
      </p>
    </div>
  );
}
