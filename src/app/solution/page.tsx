"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const FlowChart = dynamic(() => import("@/components/FlowChart"), { ssr: false });

interface Tool {
  name: string;
  purpose: string;
  category: string;
  whyForYou: string;
}

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

interface Phase {
  title: string;
  actions: string[];
}

interface Solution {
  title: string;
  summary: string;
  tools: Tool[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  phases: Phase[];
  estimatedCost: string;
  timeToImplement: string;
}

interface Context {
  size: string;
  stack: string;
  budget: string;
  timeline: string;
}

const categoryColors: Record<string, string> = {
  Integration: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Automation: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  CRM: "bg-green-500/20 text-green-300 border-green-500/30",
  Analytics: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Storage: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  default: "bg-white/10 text-white/60 border-white/20",
};

export default function SolutionPage() {
  const [solution, setSolution] = useState<Solution | null>(null);
  const [problem, setProblem] = useState("");
  const [context, setContext] = useState<Context | null>(null);
  const [citations, setCitations] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [tokens, setTokens] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const raw = sessionStorage.getItem("solution");
    if (!raw) { router.push("/"); return; }
    const data = JSON.parse(raw);
    setSolution(data.solution);
    setProblem(data.problem);
    setContext(data.context ?? null);
    setCitations(data.citations ?? []);
    setModel(data.model ?? "");
    setTokens(data.tokens ?? null);
  }, [router]);

  async function handleApprove() {
    setPaying(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setPaying(false);
    }
  }

  if (!solution) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* Back */}
        <a href="/" className="text-white/40 text-sm hover:text-white/70 transition-colors">← New solution</a>

        {/* Context badges */}
        {context && (
          <div className="flex flex-wrap gap-2 mt-6 mb-8">
            {[context.size, context.stack, context.budget, context.timeline].map((v, i) => (
              <span key={i} className="text-xs bg-white/8 border border-white/15 rounded-full px-3 py-1 text-white/50">{v}</span>
            ))}
          </div>
        )}

        {/* Problem */}
        <div className="mb-8">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Your problem</p>
          <p className="text-white/70 italic border-l-2 border-white/20 pl-4">{problem}</p>
        </div>

        {/* Title + summary */}
        <h1 className="text-4xl font-bold mb-3">{solution.title}</h1>
        <p className="text-white/60 text-lg mb-10 max-w-3xl">{solution.summary}</p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-12">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="text-white/40 text-xs uppercase tracking-wider mb-1">Est. Monthly Cost</div>
            <div className="text-white font-semibold">{solution.estimatedCost}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="text-white/40 text-xs uppercase tracking-wider mb-1">Time to Implement</div>
            <div className="text-white font-semibold">{solution.timeToImplement}</div>
          </div>
        </div>

        {/* Tools */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Recommended Tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {solution.tools.map((tool, i) => {
              const colorClass = categoryColors[tool.category] || categoryColors.default;
              return (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-white">{tool.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${colorClass}`}>
                      {tool.category}
                    </span>
                  </div>
                  <p className="text-white/50 text-sm">{tool.purpose}</p>
                  {tool.whyForYou && (
                    <div className="border-t border-white/8 pt-2">
                      <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Why for you</p>
                      <p className="text-white/70 text-sm">{tool.whyForYou}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Workflow */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Workflow</h2>
          <div className="border border-white/10 rounded-2xl overflow-hidden" style={{ height: 480 }}>
            <FlowChart nodes={solution.nodes} edges={solution.edges} />
          </div>
        </div>

        {/* Implementation roadmap */}
        {solution.phases && solution.phases.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-4">How to implement</h2>
            <div className="space-y-3">
              {solution.phases.map((phase, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-6 h-6 rounded-full bg-white/15 text-white text-xs flex items-center justify-center font-semibold shrink-0">{i + 1}</span>
                    <h3 className="font-semibold text-white">{phase.title}</h3>
                  </div>
                  <ul className="space-y-1.5 pl-9">
                    {phase.actions.map((action, j) => (
                      <li key={j} className="text-white/60 text-sm flex items-start gap-2">
                        <span className="text-white/30 mt-0.5">—</span>
                        {action}
                      </li>
                    ))}
                  </ul>
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
                <li key={i}>
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 truncate block">
                    {url}
                  </a>
                </li>
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
              {paying ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Redirecting...
                </span>
              ) : "Approve & Pay $1"}
            </button>
            <button
              onClick={() => {
                if (confirm("This will clear your current solution. Start a new one?")) {
                  sessionStorage.removeItem("solution");
                  router.push("/");
                }
              }}
              className="border border-white/20 text-white/60 font-medium rounded-xl px-8 py-3 hover:border-white/40 hover:text-white/80 transition-all text-center"
            >
              Try a different problem
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
