"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const FlowChart = dynamic(() => import("@/components/FlowChart"), { ssr: false });

interface Tool {
  name: string; purpose: string; category: string;
  whyForYou: string; vendorQuestions?: string[];
}
interface FlowNode { id: string; label: string; type: string; }
interface FlowEdge { from: string; to: string; label?: string; }
interface Phase { title: string; actions: string[]; nodes?: FlowNode[]; edges?: FlowEdge[]; }
interface Solution {
  title: string; summary: string; tools: Tool[];
  phases: Phase[]; estimatedCost: string; timeToImplement: string;
}
interface Context { size: string; stack: string; budget: string; timeline: string; }
interface SelectedItem { label: string; itemType: string; }

const categoryColors: Record<string, string> = {
  Integration: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Automation: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  CRM: "bg-green-500/20 text-green-300 border-green-500/30",
  Analytics: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Storage: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  default: "bg-white/10 text-white/60 border-white/20",
};

// ─── Explain Popup ────────────────────────────────────────────────────────────
function ExplainPopup({ item, solutionContext, onClose }: {
  item: SelectedItem; solutionContext: string; onClose: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "explaining" | "asking">("choose");
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const streamExplain = useCallback(async (q?: string) => {
    setLoading(true); setResponse("");
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: item.label, itemType: item.itemType, question: q, solutionContext }),
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try { const d = JSON.parse(line.slice(6)); if (d.text) setResponse((p) => p + d.text); } catch { /* skip */ }
        }
      }
    } finally { setLoading(false); }
  }, [item, solutionContext]);

  useEffect(() => { if (mode === "asking" && inputRef.current) inputRef.current.focus(); }, [mode]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative bg-[#0d0d0d] border border-white/15 rounded-2xl p-6 max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">{item.itemType}</p>
            <p className="text-white font-semibold">{item.label}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 ml-4 text-2xl leading-none">×</button>
        </div>
        {mode === "choose" && (
          <div className="flex flex-col gap-3 mt-2">
            <button onClick={() => { setMode("explaining"); streamExplain(); }} className="w-full bg-white text-black font-semibold rounded-xl py-3 text-sm hover:bg-white/90 transition-all">Explain this to me</button>
            <button onClick={() => setMode("asking")} className="w-full bg-white/8 border border-white/15 text-white font-medium rounded-xl py-3 text-sm hover:bg-white/12 transition-all">I have a question</button>
          </div>
        )}
        {mode === "asking" && !response && (
          <form onSubmit={(e) => { e.preventDefault(); if (question.trim()) streamExplain(question.trim()); }} className="mt-2 space-y-3">
            <input ref={inputRef} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What do you want to know?" className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/40" />
            <button type="submit" disabled={!question.trim()} className="w-full bg-white text-black font-semibold rounded-xl py-3 text-sm hover:bg-white/90 disabled:opacity-40 transition-all">Ask</button>
          </form>
        )}
        {(mode === "explaining" || (mode === "asking" && response)) && (
          <div className="mt-3">
            {loading && !response && <div className="flex gap-1 py-2">{[0,1,2].map((i) => <span key={i} className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</div>}
            {response && <p className="text-white/80 text-sm leading-relaxed">{response}</p>}
            {!loading && response && <button onClick={() => { setMode("asking"); setResponse(""); setQuestion(""); }} className="mt-4 text-xs text-white/40 hover:text-white/70 transition-colors">Ask a follow-up</button>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ROI Calculator ───────────────────────────────────────────────────────────
function ROICalculator({ estimatedCost }: { estimatedCost: string }) {
  const [hours, setHours] = useState("");
  const [team, setTeam] = useState("");
  const [rate, setRate] = useState("");

  const costNum = parseFloat(estimatedCost.replace(/[^0-9.]/g, "")) || 0;
  const h = parseFloat(hours) || 0;
  const t = parseFloat(team) || 1;
  const r = parseFloat(rate) || 0;
  const monthly = h * 4.3 * t * r;
  const savings = monthly - costNum;
  const payback = costNum > 0 && savings > 0 ? (costNum / (savings / 12)).toFixed(1) : null;
  const hasResult = h > 0 && r > 0;

  return (
    <div className="bg-white/3 border border-white/10 rounded-2xl p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40 mb-4">ROI Calculator</h2>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Hours/week lost to this problem", value: hours, set: setHours, placeholder: "e.g. 10" },
          { label: "Team members affected", value: team, set: setTeam, placeholder: "e.g. 5" },
          { label: "Avg. hourly rate (USD)", value: rate, set: setRate, placeholder: "e.g. 75" },
        ].map((f) => (
          <div key={f.label}>
            <p className="text-white/40 text-xs mb-1.5">{f.label}</p>
            <input value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.placeholder} type="number" min="0"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40 placeholder:text-white/20" />
          </div>
        ))}
      </div>
      {hasResult && (
        <div className="grid grid-cols-3 gap-3 mt-2">
          {[
            { label: "Monthly problem cost", value: `$${Math.round(monthly).toLocaleString()}`, sub: "team × hours × rate" },
            { label: "Monthly savings", value: savings > 0 ? `$${Math.round(savings).toLocaleString()}` : "—", sub: "after solution cost", highlight: savings > 0 },
            { label: "Payback period", value: payback ? `${payback} months` : "—", sub: "to break even", highlight: !!payback },
          ].map((m) => (
            <div key={m.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <p className="text-white/40 text-xs mb-1">{m.label}</p>
              <p className={`text-lg font-bold ${m.highlight ? "text-emerald-400" : "text-white"}`}>{m.value}</p>
              <p className="text-white/25 text-xs mt-0.5">{m.sub}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Solution Page ───────────────────────────────────────────────────────
export default function SolutionPage() {
  const [solution, setSolution] = useState<Solution | null>(null);
  const [problem, setProblem] = useState("");
  const [context, setContext] = useState<Context | null>(null);
  const [citations, setCitations] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [tokens, setTokens] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [expandedTool, setExpandedTool] = useState<number | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [roiData, setRoiData] = useState<{ weeklyHours: number; teamSize: number; hourlyRate: number } | null>(null);
  const router = useRouter();
  const rawDataRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    const raw = sessionStorage.getItem("solution");
    if (!raw) { router.push("/"); return; }
    const data = JSON.parse(raw);
    rawDataRef.current = data;
    setSolution(data.solution);
    setProblem(data.problem);
    setContext(data.context ?? null);
    setCitations(data.citations ?? []);
    setModel(data.model ?? "");
    setTokens(data.tokens ?? null);
  }, [router]);

  const solutionContext = solution
    ? `Title: ${solution.title}\nSummary: ${solution.summary}\nTools: ${solution.tools.map((t) => t.name).join(", ")}\nCost: ${solution.estimatedCost}\nTimeline: ${solution.timeToImplement}`
    : "";

  function pick(label: string, itemType: string) { setSelectedItem({ label, itemType }); }

  async function handleShare() {
    if (shareUrl) { navigator.clipboard.writeText(shareUrl); return; }
    setSharing(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawDataRef.current),
      });
      const data = await res.json();
      if (data.id) {
        const url = `${window.location.origin}/share/${data.id}`;
        setShareUrl(url);
        navigator.clipboard.writeText(url);
      }
    } catch { /* silently fail */ }
    finally { setSharing(false); }
  }

  async function handleExport() {
    if (!solution || !context) return;
    setExporting(true);
    try {
      // Collect ROI from the DOM inputs if filled
      const roi = roiData ?? undefined;
      const { generatePDF } = await import("@/lib/generate-pdf");
      await generatePDF(solution, problem, context, citations, roi);
    } catch (e) {
      console.error("PDF export failed", e);
    } finally {
      setExporting(false);
    }
  }

  async function handleApprove() {
    setPaying(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { setPaying(false); }
  }

  if (!solution) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {selectedItem && <ExplainPopup item={selectedItem} solutionContext={solutionContext} onClose={() => setSelectedItem(null)} />}

      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* Top nav */}
        <div className="flex items-center justify-between mb-8">
          <a href="/" className="text-white/40 text-sm hover:text-white/70 transition-colors">← New solution</a>
          <div className="flex gap-2">
            <button onClick={handleShare} disabled={sharing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm border border-white/15 text-white/60 hover:text-white hover:border-white/30 disabled:opacity-50 transition-all">
              {sharing ? "Saving..." : shareUrl ? "Link copied!" : "Share"}
            </button>
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-50 transition-all">
              {exporting ? "Exporting..." : "Export PDF"}
            </button>
          </div>
        </div>

        {/* Context badges */}
        {context && (
          <div className="flex flex-wrap gap-2 mb-8">
            {[context.size, context.stack, context.budget, context.timeline].map((v, i) => (
              <span key={i} className="text-xs bg-white/8 border border-white/15 rounded-full px-3 py-1 text-white/50">{v}</span>
            ))}
          </div>
        )}

        {/* Problem */}
        <div className="mb-6">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Your problem</p>
          <p className="text-white/70 italic border-l-2 border-white/20 pl-4">{problem}</p>
        </div>

        {/* Title + summary */}
        <h1 className="text-4xl font-bold mb-3">{solution.title}</h1>
        <p className="text-white/60 text-lg mb-10 max-w-3xl">{solution.summary}</p>

        {/* Executive Summary */}
        <div className="mb-12 bg-gradient-to-br from-white/5 to-white/2 border border-white/15 rounded-2xl p-6">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-4">Executive Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Est. Monthly Cost", value: solution.estimatedCost },
              { label: "Time to Implement", value: solution.timeToImplement },
              { label: "Tools Recommended", value: `${solution.tools.length} tools` },
              { label: "Implementation Phases", value: `${solution.phases.length} phases` },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <p className="text-white/40 text-xs mb-1">{m.label}</p>
                <p className="text-white font-bold text-base">{m.value}</p>
              </div>
            ))}
          </div>
          <p className="text-white/60 text-sm leading-relaxed border-t border-white/10 pt-4">{solution.summary}</p>
        </div>

        {/* ROI Calculator */}
        <div className="mb-12">
          <ROICalculator estimatedCost={solution.estimatedCost} />
        </div>

        {/* Tools */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Recommended Tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {solution.tools.map((tool, i) => {
              const colorClass = categoryColors[tool.category] || categoryColors.default;
              const isExpanded = expandedTool === i;
              return (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all hover:border-white/20">
                  <button onClick={() => pick(tool.name, "Tool")} className="w-full p-4 text-left space-y-2 group">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-white">{tool.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${colorClass}`}>{tool.category}</span>
                    </div>
                    <p className="text-white/50 text-sm">{tool.purpose}</p>
                    {tool.whyForYou && (
                      <div className="border-t border-white/8 pt-2">
                        <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Why for you</p>
                        <p className="text-white/70 text-sm">{tool.whyForYou}</p>
                      </div>
                    )}
                    <p className="text-xs text-white/25 group-hover:text-white/50 transition-colors pt-1">Click to learn more →</p>
                  </button>
                  {/* Vendor questions toggle */}
                  {tool.vendorQuestions && tool.vendorQuestions.length > 0 && (
                    <div className="border-t border-white/8">
                      <button onClick={() => setExpandedTool(isExpanded ? null : i)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-white/40 hover:text-white/70 transition-colors">
                        <span>Questions to ask this vendor</span>
                        <span className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
                      </button>
                      {isExpanded && (
                        <ul className="px-4 pb-4 space-y-2">
                          {tool.vendorQuestions.map((q, j) => (
                            <li key={j} className="flex gap-2 text-xs text-white/60">
                              <span className="text-white/30 shrink-0">{j + 1}.</span>
                              <span>{q}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Implementation phases with per-phase flowcharts */}
        {solution.phases && solution.phases.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-6">How to implement</h2>
            <div className="space-y-6">
              {solution.phases.map((phase, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8">
                    <span className="w-7 h-7 rounded-full bg-white/15 text-white text-xs flex items-center justify-center font-semibold shrink-0">{i + 1}</span>
                    <h3 className="font-semibold text-white">{phase.title}</h3>
                  </div>
                  <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Actions</p>
                      <ul className="space-y-2">
                        {phase.actions.map((action, j) => (
                          <li key={j}>
                            <button onClick={() => pick(action, `Phase ${i + 1} action`)}
                              className="w-full text-left flex items-start gap-2 text-white/60 text-sm hover:text-white/90 transition-colors group">
                              <span className="text-white/25 mt-0.5 group-hover:text-white/50 transition-colors shrink-0">—</span>
                              <span>{action}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {phase.nodes && phase.nodes.length > 0 && (
                      <div>
                        <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Workflow</p>
                        <div className="border border-white/10 rounded-xl overflow-hidden" style={{ height: 200 }}>
                          <FlowChart nodes={phase.nodes} edges={phase.edges ?? []} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How AI built this */}
        <div className="mb-12 bg-white/3 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">How AI built this</h2>
            {citations.length > 0 && (
              <button onClick={() => setShowSources(!showSources)} className="text-xs text-white/40 hover:text-white/70 transition-colors">
                {showSources ? "Hide" : "Show"} {citations.length} sources
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-white/50 mb-3">
            {model && <span>Pipeline: <span className="text-white/70">{model}</span></span>}
            {tokens && <span>Tokens used: <span className="text-white/70">{tokens.toLocaleString()}</span></span>}
          </div>
          {showSources && citations.length > 0 && (
            <ul className="space-y-1 border-t border-white/10 pt-3">
              {citations.map((url, i) => (
                <li key={i}><a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 truncate block">{url}</a></li>
              ))}
            </ul>
          )}
        </div>

        {/* Approve */}
        <div className="border border-white/10 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Happy with this solution?</h2>
          <p className="text-white/50 mb-6">Pay $1 to save and own this workflow. No subscription.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={handleApprove} disabled={paying}
              className="bg-white text-black font-semibold rounded-xl px-8 py-3 hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {paying ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Redirecting...</span> : "Approve & Pay $1"}
            </button>
            <button onClick={() => { if (confirm("This will clear your current solution. Start a new one?")) { sessionStorage.removeItem("solution"); router.push("/"); } }}
              className="border border-white/20 text-white/60 font-medium rounded-xl px-8 py-3 hover:border-white/40 hover:text-white/80 transition-all">
              Try a different problem
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
