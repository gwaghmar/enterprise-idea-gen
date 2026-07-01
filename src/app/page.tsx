"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, FileText, Brain, CheckCircle2, Circle, Check, History } from "lucide-react";
import { newSid, saveToHistory, listHistory } from "@/lib/history";

const ACTIVITY_ICONS: Record<string, typeof Search> = {
  search: Search, found: Sparkles, read: FileText, synth: Brain, done: CheckCircle2,
};
function ActivityIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ACTIVITY_ICONS[type] ?? Circle;
  return <Icon className={className} strokeWidth={2} />;
}

// Favicon lookups need a bare hostname — activity text can be a phrase like "Reading workato.com"
function faviconDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

const SIZES = ["Startup", "SMB", "Enterprise"];
const STACKS = [
  "Google Workspace",
  "Microsoft 365",
  "Salesforce",
  "HubSpot",
  "Slack",
  "Notion",
  "Jira / Atlassian",
  "AWS",
  "Azure",
  "SAP",
  "Shopify",
  "Stripe",
  "Recommend for me",
  "Custom",
];
const BUDGETS = ["< $500/mo", "$500–2k/mo", "$2k+/mo"];
const TIMELINES = ["ASAP", "1–3 months", "3–6 months"];
const TEAMS = ["Finance", "Operations", "Marketing", "Sales", "IT / Eng", "HR", "Product", "Legal"];
const TECH_LEVELS = ["No-code only", "Some developers", "Full eng team"];
const COMPLIANCE = ["GDPR", "HIPAA", "SOC 2", "PCI-DSS", "ISO 27001", "None / Not sure"];
const INDUSTRIES = [
  "SaaS / Software", "Financial Services", "Banking", "Insurance", "Healthcare", "Pharma / Biotech",
  "Retail / E-commerce", "Manufacturing", "Logistics / Supply Chain", "Real Estate", "Construction",
  "Legal Services", "Consulting / Professional Services", "Education / EdTech", "Government / Public Sector",
  "Non-profit", "Media / Entertainment", "Telecommunications", "Energy / Utilities", "Automotive",
  "Travel / Hospitality", "Agriculture", "Marketing / Advertising", "Human Resources / Staffing",
];

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

function Combobox({ options, value, onChange, placeholder }: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={open ? query : value}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => { setQuery(value); setOpen(true); }}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/40"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-52 overflow-auto bg-[#121212] border border-white/15 rounded-xl py-1 shadow-2xl">
          {filtered.map((o) => (
            <li key={o}>
              <button type="button"
                onClick={() => { onChange(o); setQuery(""); setOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/10 ${
                  value === o ? "text-white bg-white/5" : "text-white/70"
                }`}>
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MultiChips({ options, selected, onToggle, exclusive = [] }: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  exclusive?: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const isSelected = selected.includes(o);
        const isExclusive = exclusive.includes(o);
        return (
          <button key={o} type="button" onClick={() => onToggle(o)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-all ${
              isSelected
                ? isExclusive
                  ? "bg-white/20 text-white border-white/50 font-medium"
                  : "bg-white text-black border-white font-medium"
                : "bg-transparent text-white/50 border-white/20 hover:border-white/50 hover:text-white/80"
            }`}>
            {o}
          </button>
        );
      })}
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
  const [stacks, setStacks] = useState<string[]>([]);
  const [customStack, setCustomStack] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [industry, setIndustry] = useState("");
  const [team, setTeam] = useState("");
  const [seats, setSeats] = useState("");
  const [techLevel, setTechLevel] = useState("");
  const [compliance, setCompliance] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepMessage, setStepMessage] = useState("");
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [activityFeed, setActivityFeed] = useState<{ type: string; text: string; url?: string }[]>([]);
  const [error, setError] = useState("");
  const [hasHistory, setHasHistory] = useState(false);
  const router = useRouter();

  useEffect(() => { setHasHistory(listHistory().length > 0); }, []);

  function toggleStack(v: string) {
    // "Recommend for me" is exclusive — selecting it clears everything else
    if (v === "Recommend for me") {
      setStacks((prev) => (prev.includes(v) ? [] : ["Recommend for me"]));
      return;
    }
    // Any other selection clears "Recommend for me"
    setStacks((prev) => {
      const without = prev.filter((s) => s !== "Recommend for me");
      return without.includes(v) ? without.filter((s) => s !== v) : [...without, v];
    });
  }

  function toggleCompliance(v: string) {
    if (v === "None / Not sure") {
      setCompliance((prev) => (prev.includes(v) ? [] : ["None / Not sure"]));
      return;
    }
    setCompliance((prev) => {
      const without = prev.filter((s) => s !== "None / Not sure");
      return without.includes(v) ? without.filter((s) => s !== v) : [...without, v];
    });
  }

  const resolvedStack = stacks.includes("Custom")
    ? [...stacks.filter((s) => s !== "Custom"), customStack || "Custom stack"].join(", ")
    : stacks.join(", ");

  const isReady = problem.trim() && size && stacks.length > 0 && budget && timeline && industry.trim() && team;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady) return;

    setLoading(true);
    setProgress(1);
    setCurrentStep(1);
    setCompletedSteps([]);
    setActivityFeed([]);
    setStepMessage("Starting...");
    setError("");

    const context = {
      problem: problem.trim(),
      size,
      stack: resolvedStack,
      budget,
      timeline,
      industry: industry.trim(),
      team,
      seats: seats.trim(),
      techLevel,
      compliance: compliance.join(", ") || "Not specified",
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

            // Live feed events are {activity: {...}}; the final done payload also
            // carries the full trace as {activity: [...]} — don't swallow that one.
            if (data.activity && !data.done) { setActivityFeed((prev) => [...prev, data.activity]); continue; }
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

                // Persist: local history always; Blob mirror when configured
                const sid = newSid();
                const payload = { ...data, sid };
                let shareId: string | undefined;
                try {
                  const saveRes = await fetch("/api/share", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });
                  if (saveRes.ok) shareId = (await saveRes.json()).id;
                } catch { /* blob not configured — local cache still works */ }
                saveToHistory({
                  sid,
                  title: data.solution?.title ?? "Untitled solution",
                  problem: (data.problem ?? "").slice(0, 140),
                  date: new Date().toISOString(),
                  shareId,
                }, payload);

                await new Promise((r) => setTimeout(r, 600));
                // A storage throw here would be swallowed by the per-line catch
                // and strand the user on the loading screen
                try { sessionStorage.setItem("solution", JSON.stringify(payload)); } catch { /* storage unavailable */ }
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
      <div className="min-h-screen bg-black flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-3xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div className="w-full max-w-sm mx-auto text-center space-y-10">
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
                    {done ? <Check className="w-3 h-3" strokeWidth={3} /> : step}
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

        {/* Live activity feed */}
        <div className="w-full">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-white/40 text-xs uppercase tracking-wider">Activity</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="bg-white/3 border border-white/10 rounded-2xl p-4 h-72 overflow-hidden relative">
            <div className="space-y-2.5 overflow-y-auto h-full pr-1 flex flex-col-reverse">
              <div className="space-y-2.5">
                {activityFeed.length === 0 && (
                  <p className="text-white/25 text-sm">Waiting for the first step…</p>
                )}
                {activityFeed.map((a, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm animate-in fade-in slide-in-from-bottom-1">
                    {a.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`https://www.google.com/s2/favicons?domain=${faviconDomain(a.url)}&sz=64`} alt="" width={16} height={16}
                        className="w-4 h-4 rounded mt-0.5 shrink-0 bg-white/10"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
                    ) : (
                      <ActivityIcon type={a.type} className="w-4 h-4 mt-0.5 shrink-0 text-white/45" />
                    )}
                    <span className={`${a.url ? "text-blue-300/80" : "text-white/60"} leading-snug`}>{a.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none rounded-b-2xl" />
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-2xl w-full">
        <div className="mb-10 text-center">
          {hasHistory && (
            <div className="flex justify-end mb-2">
              <a href="/history" className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors">
                <History className="w-4 h-4" /> My solutions
              </a>
            </div>
          )}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-white/40 text-xs uppercase tracking-wider">Industry</p>
                <Combobox options={INDUSTRIES} value={industry} onChange={setIndustry} placeholder="Type or pick an industry…" />
              </div>
              <div className="space-y-2">
                <p className="text-white/40 text-xs uppercase tracking-wider">Users / seats <span className="text-white/25 normal-case tracking-normal">(optional)</span></p>
                <input type="number" min="1" value={seats} onChange={(e) => setSeats(e.target.value)}
                  placeholder="e.g. 25"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/40" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-white/40 text-xs uppercase tracking-wider">Company size</p>
              <Chips options={SIZES} selected={size} onSelect={setSize} />
            </div>
            <div className="space-y-2">
              <p className="text-white/40 text-xs uppercase tracking-wider">Requesting team</p>
              <Chips options={TEAMS} selected={team} onSelect={setTeam} />
            </div>
            <div className="space-y-2">
              <p className="text-white/40 text-xs uppercase tracking-wider">Team technical level <span className="text-white/25 normal-case tracking-normal">(optional)</span></p>
              <Chips options={TECH_LEVELS} selected={techLevel} onSelect={setTechLevel} />
            </div>
            <div className="space-y-2">
              <p className="text-white/40 text-xs uppercase tracking-wider">Current stack <span className="text-white/25 normal-case tracking-normal">(pick all that apply)</span></p>
              <MultiChips
                options={STACKS}
                selected={stacks}
                onToggle={toggleStack}
                exclusive={["Recommend for me"]}
              />
              {stacks.includes("Custom") && (
                <input type="text" value={customStack}
                  onChange={(e) => setCustomStack(e.target.value)}
                  placeholder="e.g. custom Python backend, legacy ERP..."
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
            <div className="space-y-2">
              <p className="text-white/40 text-xs uppercase tracking-wider">Compliance / data sensitivity <span className="text-white/25 normal-case tracking-normal">(pick all that apply)</span></p>
              <MultiChips
                options={COMPLIANCE}
                selected={compliance}
                onToggle={toggleCompliance}
                exclusive={["None / Not sure"]}
              />
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
