"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const SIZES = ["Startup", "SMB", "Enterprise"];
const STACKS = ["Google Workspace", "Microsoft 365", "Recommend for me", "Custom"];
const BUDGETS = ["< $500/mo", "$500–2k/mo", "$2k+/mo"];
const TIMELINES = ["ASAP", "1–3 months", "3–6 months"];

const STEP_LABELS = [
  { step: 1, label: "Web search", icon: "◎" },
  { step: 2, label: "Reading sources", icon: "◎" },
  { step: 3, label: "AI reasoning", icon: "◎" },
  { step: 4, label: "Building solution", icon: "◎" },
];

function VoiceButton({ onTranscript }: { onTranscript: (t: string) => void }) {
  const [state, setState] = useState<"idle" | "listening" | "unsupported">("idle");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const interimRef = useRef("");

  const start = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { setState("unsupported"); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    interimRef.current = "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (final) interimRef.current += final;
      onTranscript((interimRef.current + " " + interim).trim());
    };

    rec.onerror = () => setState("idle");
    rec.start();
    recRef.current = rec;
    setState("listening");
  }, [onTranscript]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setState("idle");
  }, []);

  if (state === "unsupported") return null;

  return (
    <button
      type="button"
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={(e) => { e.preventDefault(); start(); }}
      onTouchEnd={(e) => { e.preventDefault(); stop(); }}
      className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium select-none transition-all ${
        state === "listening"
          ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
          : "bg-white/10 text-white/60 hover:bg-white/15 hover:text-white border border-white/15"
      }`}
    >
      {state === "listening" && (
        <span className="absolute inset-0 rounded-xl animate-ping bg-red-500 opacity-30" />
      )}
      <svg
        viewBox="0 0 24 24" fill="currentColor"
        className={`w-4 h-4 shrink-0 ${state === "listening" ? "animate-pulse" : ""}`}
      >
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
      </svg>
      {state === "listening" ? "Listening..." : "Hold to speak"}
    </button>
  );
}

function Chips({ options, selected, onSelect }: {
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onSelect(o)}
          className={`px-4 py-1.5 rounded-full text-sm border transition-all ${
            selected === o
              ? "bg-white text-black border-white font-medium"
              : "bg-transparent text-white/50 border-white/20 hover:border-white/50 hover:text-white/80"
          }`}>
          {o}
        </button>
      ))}
    </div>
  );
}

function ProgressRing({ progress }: { progress: number }) {
  const r = 80;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;

  return (
    <div className="relative w-52 h-52 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx="100" cy="100" r={r} fill="none"
          stroke="white" strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold text-white tabular-nums">{progress}<span className="text-2xl text-white/50">%</span></span>
      </div>
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
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepMessage, setStepMessage] = useState("");
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [error, setError] = useState("");
  const router = useRouter();

  const isReady = problem.trim() && size && stack && budget && timeline;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady) return;

    setLoading(true);
    setProgress(1);
    setCurrentStep(1);
    setCompletedSteps([]);
    setStepMessage("Starting...");
    setError("");

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

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            setProgress(data.progress ?? 0);
            if (data.message) setStepMessage(data.message);
            if (data.step) {
              setCurrentStep(data.step);
              setCompletedSteps((prev) => {
                const next = [...prev];
                for (let s = 1; s < data.step; s++) {
                  if (!next.includes(s)) next.push(s);
                }
                return next;
              });
            }

            if (data.done) {
              if (data.error) {
                setError(data.error);
                setLoading(false);
              } else {
                setProgress(100);
                setCompletedSteps([1, 2, 3, 4]);
                setStepMessage("Solution ready!");
                await new Promise((r) => setTimeout(r, 600));
                sessionStorage.setItem("solution", JSON.stringify(data));
                router.push("/solution");
              }
            }
          } catch {
            // skip malformed chunk
          }
        }
      }
    } catch {
      setError("Failed to generate. Try again.");
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-10">
          <ProgressRing progress={progress} />

          <div className="space-y-1">
            <p className="text-white font-medium text-lg">{stepMessage}</p>
            <p className="text-white/30 text-sm">Do not close this tab</p>
          </div>

          <div className="space-y-2 text-left">
            {STEP_LABELS.map(({ step, label }) => {
              const done = completedSteps.includes(step);
              const active = currentStep === step && !done;
              return (
                <div key={step} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                  active ? "bg-white/10 border border-white/20" :
                  done ? "opacity-60" : "opacity-30"
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    done ? "bg-green-500 text-white" :
                    active ? "border-2 border-white animate-pulse" :
                    "border border-white/30"
                  }`}>
                    {done ? "✓" : step}
                  </span>
                  <span className={`text-sm ${active ? "text-white font-medium" : "text-white/60"}`}>
                    {label}
                  </span>
                  {active && (
                    <span className="ml-auto flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="w-1 h-1 bg-white rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
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
          <div className="relative">
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="e.g. We need to automate invoice processing and sync it with our CRM..."
              className="w-full bg-white/5 border border-white/15 rounded-2xl p-5 pb-14 text-white placeholder:text-white/30 resize-none h-36 focus:outline-none focus:border-white/40 text-base transition-colors"
            />
            <div className="absolute bottom-3 left-3">
              <VoiceButton onTranscript={(t) => setProblem(t)} />
            </div>
            {problem && (
              <button
                type="button"
                onClick={() => setProblem("")}
                className="absolute bottom-3 right-3 text-white/30 hover:text-white/60 text-xs px-2 py-1 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          <div className="space-y-4 bg-white/3 border border-white/10 rounded-2xl p-5">
            <div className="space-y-2">
              <p className="text-white/40 text-xs uppercase tracking-wider">Company size</p>
              <Chips options={SIZES} selected={size} onSelect={setSize} />
            </div>
            <div className="space-y-2">
              <p className="text-white/40 text-xs uppercase tracking-wider">Current stack</p>
              <Chips options={STACKS} selected={stack} onSelect={setStack} />
              {stack === "Custom" && (
                <input type="text" value={customStack}
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

          <button type="submit" disabled={!isReady}
            className="w-full bg-white text-black font-semibold rounded-2xl py-4 text-base hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            Generate Solution — Free Preview
          </button>
        </form>

        <p className="text-center text-white/30 text-sm mt-6">
          Preview is free · Pay $1 only after you approve
        </p>
      </div>
    </main>
  );
}
