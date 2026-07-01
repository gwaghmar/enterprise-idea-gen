"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SIZES = ["Startup", "SMB", "Enterprise"];
const STACKS = ["Google Workspace", "Microsoft 365", "Recommend for me", "Custom"];
const BUDGETS = ["< $500/mo", "$500–2k/mo", "$2k+/mo"];
const TIMELINES = ["ASAP", "1–3 months", "3–6 months"];

function Chips({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onSelect(o)}
          className={`px-4 py-1.5 rounded-full text-sm border transition-all ${
            selected === o
              ? "bg-white text-black border-white font-medium"
              : "bg-transparent text-white/50 border-white/20 hover:border-white/50 hover:text-white/80"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const [problem, setProblem] = useState("");
  const [size, setSize] = useState("");
  const [stack, setStack] = useState("");
  const [customStack, setCustomStack] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const router = useRouter();

  const steps = [
    "Searching the web with Perplexity...",
    "Reading source documents...",
    "DeepSeek R1 reasoning through your solution...",
    "Finalizing your workflow...",
  ];

  const isReady = problem.trim() && size && stack && budget && timeline;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady) return;
    setLoading(true);
    setStep(0);
    setError("");

    // Step progress ticker
    const stepTimings = [0, 4000, 9000, 18000];
    const timers = stepTimings.map((delay, i) =>
      setTimeout(() => setStep(i), delay)
    );

    const context = {
      problem: problem.trim(),
      size,
      stack: stack === "Custom" ? customStack || "Custom stack" : stack,
      budget,
      timeline,
    };

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        sessionStorage.setItem("solution", JSON.stringify(data));
        router.push("/solution");
      }
    } catch {
      setError("Failed to generate. Try again.");
    } finally {
      timers.forEach(clearTimeout);
      setLoading(false);
      setStep(0);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-2xl w-full">
        <div className="mb-10 text-center">
          <div className="inline-block bg-white/10 border border-white/20 rounded-full px-4 py-1 text-sm mb-6 text-white/60">
            Enterprise Solution Generator
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            Describe your problem.<br />
            <span className="text-white/40">Get a full solution.</span>
          </h1>
          <p className="text-white/50 text-lg">
            AI researches, reasons, and builds you a visual workflow. Review free — pay $1 only if you like it.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <textarea
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="e.g. We need to automate invoice processing and sync it with our CRM..."
            className="w-full bg-white/5 border border-white/15 rounded-2xl p-5 text-white placeholder:text-white/30 resize-none h-32 focus:outline-none focus:border-white/40 text-base transition-colors"
          />

          <div className="space-y-4 bg-white/3 border border-white/10 rounded-2xl p-5">
            <div className="space-y-2">
              <p className="text-white/40 text-xs uppercase tracking-wider">Company size</p>
              <Chips options={SIZES} selected={size} onSelect={setSize} />
            </div>

            <div className="space-y-2">
              <p className="text-white/40 text-xs uppercase tracking-wider">Current stack</p>
              <Chips options={STACKS} selected={stack} onSelect={setStack} />
              {stack === "Custom" && (
                <input
                  type="text"
                  value={customStack}
                  onChange={(e) => setCustomStack(e.target.value)}
                  placeholder="e.g. Salesforce, SAP, custom Python backend..."
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/40 mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <p className="text-white/40 text-xs uppercase tracking-wider">Monthly budget</p>
              <Chips options={BUDGETS} selected={budget} onSelect={setBudget} />
            </div>

            <div className="space-y-2">
              <p className="text-white/40 text-xs uppercase tracking-wider">Timeline</p>
              <Chips options={TIMELINES} selected={timeline} onSelect={setTimeline} />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !isReady}
            className="w-full bg-white text-black font-semibold rounded-2xl py-4 text-base hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                {steps[step]}
              </span>
            ) : (
              "Generate Solution — Free Preview"
            )}
          </button>
        </form>

        <p className="text-center text-white/30 text-sm mt-6">
          Preview is free · Pay $1 only after you approve
        </p>
      </div>
    </main>
  );
}
