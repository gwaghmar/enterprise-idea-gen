"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [problem, setProblem] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!problem.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem: problem.trim() }),
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
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
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
            AI researches the best tools, thinks through the architecture, and builds you a visual workflow. Review it free — pay $1 only if you like it.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="e.g. We need to automate our invoice processing and sync it with our CRM and accounting software..."
            className="w-full bg-white/5 border border-white/15 rounded-2xl p-5 text-white placeholder:text-white/30 resize-none h-40 focus:outline-none focus:border-white/40 text-base transition-colors"
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !problem.trim()}
            className="w-full bg-white text-black font-semibold rounded-2xl py-4 text-base hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                AI is building your solution...
              </span>
            ) : (
              "Generate Solution — Free Preview"
            )}
          </button>
        </form>

        <p className="text-center text-white/30 text-sm mt-6">
          Preview is free · Pay $1 only after you approve the solution
        </p>
      </div>
    </main>
  );
}
