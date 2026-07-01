"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const FlowChart = dynamic(() => import("@/components/FlowChart"), { ssr: false });

interface Tool {
  name: string;
  purpose: string;
  category: string;
}

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

interface Solution {
  title: string;
  summary: string;
  tools: Tool[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  estimatedCost: string;
  timeToImplement: string;
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
  const [paying, setPaying] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const raw = sessionStorage.getItem("solution");
    if (!raw) {
      router.push("/");
      return;
    }
    const data = JSON.parse(raw);
    setSolution(data.solution);
    setProblem(data.problem);
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
        sessionStorage.removeItem("solution");
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
      <div className="max-w-6xl mx-auto px-6 py-12">
        <a href="/" className="text-white/40 text-sm hover:text-white/70 transition-colors">← New solution</a>

        <div className="mt-8 mb-10">
          <div className="text-white/40 text-xs uppercase tracking-wider mb-2">Your problem</div>
          <p className="text-white/70 text-base italic border-l-2 border-white/20 pl-4">{problem}</p>
        </div>

        <h1 className="text-4xl font-bold mb-3">{solution.title}</h1>
        <p className="text-white/60 text-lg mb-10 max-w-3xl">{solution.summary}</p>

        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="text-white/40 text-xs uppercase tracking-wider mb-1">Est. Monthly Cost</div>
            <div className="text-white font-semibold text-lg">{solution.estimatedCost}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="text-white/40 text-xs uppercase tracking-wider mb-1">Time to Implement</div>
            <div className="text-white font-semibold text-lg">{solution.timeToImplement}</div>
          </div>
        </div>

        <div className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Recommended Tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {solution.tools.map((tool, i) => {
              const colorClass = categoryColors[tool.category] || categoryColors.default;
              return (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-semibold text-white">{tool.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${colorClass}`}>
                      {tool.category}
                    </span>
                  </div>
                  <p className="text-white/50 text-sm">{tool.purpose}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Workflow</h2>
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden" style={{ height: 500 }}>
            <FlowChart nodes={solution.nodes} edges={solution.edges} />
          </div>
        </div>

        <div className="border border-white/10 rounded-2xl p-8 bg-white/3 text-center">
          <h2 className="text-2xl font-bold mb-2">Happy with this solution?</h2>
          <p className="text-white/50 mb-6">Pay $1 to save and own this workflow. No subscription, one-time charge.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleApprove}
              disabled={paying}
              className="bg-white text-black font-semibold rounded-xl px-8 py-3 hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {paying ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Redirecting...
                </span>
              ) : (
                "Approve & Pay $1"
              )}
            </button>
            <a
              href="/"
              className="border border-white/20 text-white/60 font-medium rounded-xl px-8 py-3 hover:border-white/40 hover:text-white/80 transition-all text-center"
            >
              Try a different problem
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
