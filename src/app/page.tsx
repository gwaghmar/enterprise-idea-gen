"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, FileText, Brain, CheckCircle2, Circle, Check, History, Lightbulb } from "lucide-react";
import { newSid, saveToHistory, listHistory } from "@/lib/history";
import { FREE_MODE } from "@/lib/config";
import { LOADING_FACTS, quipFor, type ErrorKind } from "@/lib/quips";

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
  "Slack",
  "Jira / Atlassian",
  "AWS",
  "Azure",
  "SAP",
  "Recommend for me",
];
// Searchable catalog for the stack autocomplete — anything not listed can be
// typed and added as a custom entry
const STACK_CATALOG = [
  "HubSpot", "Notion", "Shopify", "Stripe",
  "NetSuite", "Oracle ERP", "Workday", "QuickBooks", "Xero", "Zoho", "Sage",
  "Monday.com", "Asana", "Trello", "ClickUp", "Airtable", "Smartsheet", "Basecamp",
  "Zendesk", "Freshdesk", "Intercom", "ServiceNow", "PagerDuty",
  "Okta", "Auth0", "Ping Identity", "OneLogin",
  "GitHub", "GitLab", "Bitbucket", "Jenkins", "CircleCI", "Docker", "Kubernetes", "Terraform",
  "Google Cloud (GCP)", "Snowflake", "Databricks", "BigQuery", "Redshift",
  "Tableau", "Power BI", "Looker", "Qlik", "Segment", "Amplitude", "Mixpanel", "Google Analytics",
  "Zapier", "Make (Integromat)", "Workato", "MuleSoft", "Boomi",
  "Twilio", "SendGrid", "Mailchimp", "Marketo", "Pardot", "Braze", "Klaviyo",
  "Microsoft Dynamics 365", "Microsoft Teams", "Confluence", "SharePoint",
  "Dropbox", "Box", "DocuSign", "Adobe Acrobat Sign",
  "Figma", "Miro", "Canva",
  "Datadog", "Splunk", "New Relic", "Grafana",
  "MongoDB", "PostgreSQL", "MySQL", "Redis", "Supabase", "Firebase",
  "Vercel", "Netlify", "Heroku", "DigitalOcean",
  "Workday HCM", "BambooHR", "Gusto", "ADP", "Rippling", "Deel",
  "Coupa", "SAP Ariba", "Ironclad", "LinkSquares",
];
// Budget tiers scale with company size — "$2k+" gives the AI zero signal
// on an enterprise program that might be $200k/mo
const BUDGETS_BY_SIZE: Record<string, string[]> = {
  Startup: ["< $500/mo", "$500–2k/mo", "$2k+/mo"],
  SMB: ["< $500/mo", "$500–2k/mo", "$2k–10k/mo", "$10k+/mo"],
  Enterprise: ["< $10k/mo", "$10–50k/mo", "$50k+/mo", "Help me size it"],
};
const DEFAULT_BUDGETS = BUDGETS_BY_SIZE.Startup;
const TIMELINES = ["ASAP", "1–3 months", "3–6 months", "Help me time it"];
const TEAMS = ["Executive / Strategy", "Finance", "Operations", "Marketing", "Sales", "IT / Eng", "HR", "Product", "Legal"];
const TECH_LEVELS = ["No-code only", "Some developers", "Full eng team"];
const COMPLIANCE = ["GDPR", "HIPAA", "SOC 2", "PCI-DSS", "ISO 27001", "None / Not sure"];
const INDUSTRIES = [
  "SaaS / Software", "Financial Services", "Banking", "Insurance", "Healthcare", "Pharma / Biotech",
  "Retail / E-commerce", "Manufacturing", "Logistics / Supply Chain", "Real Estate", "Construction",
  "Legal Services", "Consulting / Professional Services", "Education / EdTech", "Government / Public Sector",
  "Non-profit", "Media / Entertainment", "Telecommunications", "Energy / Utilities", "Automotive",
  "Travel / Hospitality", "Agriculture", "Marketing / Advertising", "Human Resources / Staffing",
];

// One-click example problems — real situations enterprise teams hit.
// Clicking fills the whole form so users can generate immediately.
interface ExampleProblem {
  label: string;
  problem: string;
  industry: string;
  size: string;
  team: string;
  techLevel: string;
  stacks: string[];      // must exist in STACKS
  extraStacks: string[]; // free-form tools
  budget: string;
  timeline: string;
  compliance: string[];
}
const EXAMPLES: ExampleProblem[] = [
  {
    label: "CEO wants AI everywhere — no plan",
    problem: "The CEO has mandated AI adoption across the whole company — engineering, operations, supply chain, sales, support, HR. Right now everyone experiments with ChatGPT individually: no governance, no priorities, and security is worried about data leaks. We need a company-wide AI adoption plan: where to start, which tools, how to govern them, and how to show measurable ROI to the board within two quarters.",
    industry: "Manufacturing", size: "Enterprise", team: "Executive / Strategy", techLevel: "Some developers",
    stacks: ["Microsoft 365", "Slack", "Azure"], extraStacks: ["Netskope"], budget: "$10–50k/mo", timeline: "3–6 months", compliance: ["SOC 2", "GDPR"],
  },
  {
    label: "Invoices are typed in by hand",
    problem: "Our AP team manually keys supplier invoices from email PDFs into NetSuite. It takes days, creates errors, and month-end close is always late. We want automated invoice capture, approval routing, and posting.",
    industry: "Manufacturing", size: "SMB", team: "Finance", techLevel: "Some developers",
    stacks: ["Microsoft 365"], extraStacks: ["NetSuite"], budget: "$500–2k/mo", timeline: "1–3 months", compliance: ["SOC 2"],
  },
  {
    label: "Sales team ignores the CRM",
    problem: "Reps track deals in spreadsheets and Slack, so Salesforce is always stale and forecasting is guesswork. We need CRM updates to be automatic or effortless so pipeline data is trustworthy.",
    industry: "SaaS / Software", size: "SMB", team: "Sales", techLevel: "Some developers",
    stacks: ["Salesforce", "Slack"], extraStacks: [], budget: "$500–2k/mo", timeline: "ASAP", compliance: [],
  },
];

const STEP_LABELS = [
  { step: 1, label: "Web search", icon: "◎" },
  { step: 2, label: "Reading sources", icon: "◎" },
  { step: 3, label: "AI reasoning", icon: "◎" },
  { step: 4, label: "Building solution", icon: "◎" },
];

function VoiceButton({ onTranscript, currentText }: { onTranscript: (t: string) => void; currentText: string }) {
  const [state, setState] = useState<"idle" | "listening" | "unsupported">("idle");
  const [micError, setMicError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const interimRef = useRef("");
  const activeRef = useRef(false);

  const start = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { setState("unsupported"); return; }
    setMicError("");
    activeRef.current = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    // Append to whatever is already typed instead of overwriting it
    interimRef.current = currentText.trim() ? currentText.trim() + " " : "";

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      const code = e?.error ?? "";
      if (code === "not-allowed" || code === "service-not-allowed") {
        setMicError("Microphone blocked — allow mic access for this site and try again.");
        activeRef.current = false;
        setState("idle");
      } else if (code === "network") {
        setMicError("Speech service unavailable — check your connection and try again.");
        activeRef.current = false;
        setState("idle");
      }
      // "no-speech" and "aborted" are benign — onend handles recovery
    };

    // Chrome ends recognition on its own after silences/timeouts. Without
    // this, the UI kept saying "Listening..." while the mic was dead —
    // restart while the mic is toggled on so dictation never silently dies.
    rec.onend = () => {
      if (activeRef.current && recRef.current === rec) {
        try { rec.start(); } catch { activeRef.current = false; setState("idle"); }
      } else if (recRef.current === rec || !recRef.current) {
        setState("idle");
      }
    };

    try {
      rec.start();
    } catch {
      setMicError("Could not start the microphone.");
      activeRef.current = false;
      return;
    }
    recRef.current = rec;
    setState("listening");
  }, [onTranscript, currentText]);

  const stop = useCallback(() => {
    activeRef.current = false;
    recRef.current?.stop();
    recRef.current = null;
    setState("idle");
  }, []);

  if (state === "unsupported") return null;

  return (
    <>
    <button
      type="button"
      onClick={() => (state === "listening" ? stop() : start())}
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
      {state === "listening" ? "Listening — tap to stop" : "Tap to speak"}
    </button>
    {micError && <span className="ml-2 text-red-400 text-xs self-center max-w-[260px]">{micError}</span>}
    </>
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

// Searchable multi-select: type to filter the catalog, click (or Enter) to add;
// unlisted tools are added verbatim as custom entries
function MultiCombobox({ options, selected, onAdd, onRemove, placeholder }: {
  options: string[];
  selected: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = options.filter((o) => !selected.includes(o) && (!q || o.toLowerCase().includes(q)));
  const exactMatch = options.some((o) => o.toLowerCase() === q);
  const canAddCustom = q.length > 1 && !exactMatch && !selected.some((s) => s.toLowerCase() === q);

  function add(v: string) {
    onAdd(v);
    setQuery("");
    // Close after adding — an open full-catalog dropdown covers the fields
    // below; typing again reopens it for the next pick
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      {/* Chips sit above the input so the open dropdown never covers them */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selected.map((s) => (
            <span key={s} className="flex items-center gap-1.5 bg-white text-black text-sm font-medium rounded-full pl-4 pr-2 py-1.5">
              {s}
              <button type="button" onClick={() => onRemove(s)} aria-label={`Remove ${s}`}
                className="text-black/40 hover:text-black transition-colors leading-none text-base">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 bg-white/5 border border-white/15 rounded-xl px-3 focus-within:border-white/40 transition-colors">
        <Search className="w-4 h-4 text-white/30 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (filtered.length > 0) add(filtered[0]);
            else if (canAddCustom) add(query.trim());
          }}
          placeholder={placeholder}
          className="w-full bg-transparent py-2.5 text-white placeholder:text-white/30 text-sm focus:outline-none"
        />
      </div>
      {open && (filtered.length > 0 || canAddCustom) && (
        <ul className="absolute z-20 mt-1 w-full max-h-52 overflow-auto bg-[#121212] border border-white/15 rounded-xl py-1 shadow-2xl">
          {filtered.slice(0, 30).map((o) => (
            <li key={o}>
              <button type="button" onClick={() => add(o)}
                className="w-full text-left px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white">
                {o}
              </button>
            </li>
          ))}
          {canAddCustom && (
            <li>
              <button type="button" onClick={() => add(query.trim())}
                className="w-full text-left px-4 py-2 text-sm text-white/50 italic transition-colors hover:bg-white/10 hover:text-white">
                Add &ldquo;{query.trim()}&rdquo;
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function MultiChips({ options, selected, onToggle, exclusive = [], detected = [] }: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  exclusive?: string[];
  detected?: string[]; // auto-selected from the problem text — green, tap to remove
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const isSelected = selected.includes(o);
        const isExclusive = exclusive.includes(o);
        const isDetected = detected.includes(o);
        return (
          <button key={o} type="button" onClick={() => onToggle(o)}
            title={isDetected ? "Detected from your problem text — tap to remove" : undefined}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm border transition-all ${
              isSelected
                ? isDetected
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/50 font-medium"
                  : isExclusive
                    ? "bg-white/20 text-white border-white/50 font-medium"
                    : "bg-white text-black border-white font-medium"
                : "bg-transparent text-white/50 border-white/20 hover:border-white/50 hover:text-white/80"
            }`}>
            {isSelected && !isExclusive && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
            {o}{isDetected && <span className="text-[10px] uppercase tracking-wider opacity-70 ml-0.5">auto</span>}
          </button>
        );
      })}
    </div>
  );
}

function ProgressRing({ progress, elapsed }: { progress: number; elapsed: number }) {
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
          style={{
            transition: "stroke-dashoffset 0.3s linear",
            filter: "drop-shadow(0 0 6px rgba(255,255,255,0.35))",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold text-white tabular-nums">{Math.floor(progress)}<span className="text-2xl text-white/50">%</span></span>
        <span className="text-white/30 text-xs mt-1 tabular-nums">{elapsed}s · typically 60–90s</span>
      </div>
    </div>
  );
}

// A refine handoff from the /solution page: regenerate the report with the
// prior context + a free-form change note, reusing the full generate pipeline.
type RefineRun = {
  context: Record<string, unknown> & { problem?: string };
  refineNote: string;
  priorSummary: string;
  priorTitle: string;
};

export default function Home() {
  const [problem, setProblem] = useState("");
  const [size, setSize] = useState("");
  const [stacks, setStacks] = useState<string[]>([]);
  const [extraStacks, setExtraStacks] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [industry, setIndustry] = useState("");
  const [team, setTeam] = useState("");
  const [seats, setSeats] = useState("");
  const [techLevel, setTechLevel] = useState("");
  const [compliance, setCompliance] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);        // latest value from the server
  const [smoothProgress, setSmoothProgress] = useState(0); // what the ring displays
  const [elapsed, setElapsed] = useState(0);
  const targetRef = useRef(0);
  const startedAtRef = useRef(0);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const runIdRef = useRef<string | null>(null);

  // Auto-grow the problem box with its content (capped, then scrolls)
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(120, Math.min(el.scrollHeight + 2, 400))}px`;
  }, [problem]);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepMessage, setStepMessage] = useState("");
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [activityFeed, setActivityFeed] = useState<{ type: string; text: string; url?: string }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [preview, setPreview] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [errorQuip, setErrorQuip] = useState("");
  const [resumable, setResumable] = useState(false);
  const [clarify, setClarify] = useState<{ question: string; options: string[] } | null>(null);
  const [clarifyChoice, setClarifyChoice] = useState<string[]>([]);
  const [clarifyExtra, setClarifyExtra] = useState("");
  const [clarifying, setClarifying] = useState(false);
  // Was the AI's clarifying question actually relevant? Feedback here tells us
  // when the question-asking model misfires — data to make it ask better ones.
  const [clarifyRating, setClarifyRating] = useState<"up" | "down" | null>(null);
  const [clarifyFbComment, setClarifyFbComment] = useState("");
  const [clarifyFbSent, setClarifyFbSent] = useState(false);
  const [preferCloud, setPreferCloud] = useState(false);
  const [factIdx, setFactIdx] = useState(0);
  const [hasHistory, setHasHistory] = useState(false);
  const router = useRouter();

  function showError(message: string, kind: ErrorKind, canResume = false) {
    setError(message);
    setErrorQuip(quipFor(kind));
    setResumable(canResume);
    setLoading(false);
  }

  // Rotate "did you know" facts on the loading screen
  useEffect(() => {
    if (!loading) return;
    setFactIdx(Math.floor(Math.random() * LOADING_FACTS.length));
    const t = setInterval(() => setFactIdx((i) => i + 1), 6000);
    return () => clearInterval(t);
  }, [loading]);

  // Smooth the ring: glide toward the latest server value and trickle a few
  // points past it while waiting, so long steps never look frozen
  useEffect(() => { targetRef.current = progress; }, [progress]);
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => {
      setSmoothProgress((s) => {
        const target = targetRef.current;
        if (target >= 100) return 100;
        const ceiling = Math.min(target + 7, 97); // trickle headroom, hard cap
        if (s >= ceiling) return s;
        const step = Math.max(0.12, (ceiling - s) * 0.055);
        return Math.min(ceiling, s + step);
      });
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 120);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => { setHasHistory(listHistory().length > 0); }, []);

  // Refine handoff: the /solution page stashed a "big change" request and routed
  // here. Pick it up once, show the original problem on the loading screen, and
  // run the full generate pipeline with the diff-aware refine payload.
  useEffect(() => {
    let raw: string | null = null;
    try { raw = sessionStorage.getItem("pendingRefine"); } catch { /* unavailable */ }
    if (!raw) return;
    try { sessionStorage.removeItem("pendingRefine"); } catch { /* ignore */ }
    let payload: RefineRun;
    try { payload = JSON.parse(raw); } catch { return; }
    if (!payload?.context || !payload.refineNote) return;
    if (typeof payload.context.problem === "string") setProblem(payload.context.problem);
    runGeneration(false, payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Auto stack detection was removed: silently adding chips as the user
  // typed caused surprise selections — tools mentioned as candidates, not
  // deployed stack — and fought with manual edits. Users pick their stack.)

  // After a failed run the user lands back on the form — bring the error
  // (and its Continue button) into view instead of leaving them at the top
  useEffect(() => {
    if (!error) return;
    setTimeout(() => document.querySelector("[data-error]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }, [error]);

  // Desktop/Android notification when the report finishes while the tab is
  // in the background (generation takes a minute — people switch tabs)
  function notifyIfHidden(title: string, body: string) {
    try {
      if (!document.hidden || !("Notification" in window) || Notification.permission !== "granted") return;
      // /icon is the generated brand favicon — there is no favicon.ico file
      const n = new Notification(title, { body, icon: "/icon" });
      n.onclick = () => { window.focus(); n.close(); };
    } catch { /* notifications unavailable */ }
  }

  function toggleStack(v: string) {
    // "Recommend for me" is exclusive — selecting it clears everything else
    if (v === "Recommend for me") {
      setStacks((prev) => (prev.includes(v) ? [] : ["Recommend for me"]));
      setExtraStacks([]);
      return;
    }
    // Any other selection clears "Recommend for me"
    setStacks((prev) => {
      const without = prev.filter((s) => s !== "Recommend for me");
      return without.includes(v) ? without.filter((s) => s !== v) : [...without, v];
    });
  }

  function addExtraStack(v: string) {
    setExtraStacks((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setStacks((prev) => prev.filter((s) => s !== "Recommend for me"));
  }

  function applyExample(e: ExampleProblem) {
    setProblem(e.problem);
    setIndustry(e.industry);
    setSize(e.size);
    setTeam(e.team);
    setTechLevel(e.techLevel);
    setStacks(e.stacks);
    setExtraStacks(e.extraStacks);
    setBudget(e.budget);
    setTimeline(e.timeline);
    setCompliance(e.compliance);
    setError("");
    setErrorQuip("");
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

  const resolvedStack = [...stacks, ...extraStacks].join(", ");
  const CLOUDS = ["AWS", "Azure", "Google Cloud (GCP)"];
  const detectedClouds = CLOUDS.filter((c) => stacks.includes(c) || extraStacks.includes(c));
  const detectedCloud = detectedClouds.map((c) => c.replace(" (GCP)", "")).join(" + ");

  const isReady = problem.trim() && size && (stacks.length > 0 || extraStacks.length > 0) && budget && timeline && industry.trim() && team;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady) return;
    // One sharp follow-up with tappable choices makes the report far more
    // accurate — best-effort, generation starts regardless
    setClarifying(true);
    setError("");
    try {
      const res = await fetch("/api/clarify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem: problem.trim(), industry: industry.trim(), size, team }),
      });
      const data = await res.json();
      if (res.ok && data.question && Array.isArray(data.options) && data.options.length >= 2) {
        setClarify({ question: data.question, options: data.options });
        setClarifyChoice([]);
        setClarifyRating(null); setClarifyFbComment(""); setClarifyFbSent(false);
        setClarifyExtra("");
        setClarifying(false);
        return; // wait for the user's answer (or skip)
      }
    } catch { /* proceed without clarification */ }
    setClarifying(false);
    await runGeneration(false);
  }

  function sendClarifyFeedback(rating: "up" | "down", comment: string) {
    // Best-effort; never blocks the flow. Logged as kind "clarify" so the
    // learning loop / analysis can see when the question model misses.
    try {
      fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "clarify", rating, comment,
          detail: clarify?.question ?? "",
          problem: problem.trim().slice(0, 400),
        }),
      }).catch(() => {});
    } catch { /* never block */ }
  }

  function onClarifyThumb(rating: "up" | "down") {
    setClarifyRating(rating);
    if (rating === "up") { sendClarifyFeedback("up", ""); setClarifyFbSent(true); }
    // For 👎 we wait for the optional comment before sending, so the "why" rides along.
  }

  function clarificationText() {
    const parts = [];
    if (clarify && clarifyChoice.length) parts.push(`${clarify.question} ${clarifyChoice.join(", ")}`);
    if (clarifyExtra.trim()) parts.push(clarifyExtra.trim());
    return parts.join(". ");
  }

  // resume=true keeps the already-streamed preview on screen so a retry after
  // a dropped connection feels like continuing, not starting over
  async function runGeneration(resume: boolean, refine?: RefineRun) {
    setClarify(null);
    // Same runId across resumes lets the server skip completed stages
    if (!resume || !runIdRef.current) {
      runIdRef.current = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/[^a-z0-9-]/gi, "").slice(0, 36);
    }
    setLoading(true);
    setProgress(1);
    setSmoothProgress(1);
    setElapsed(0);
    startedAtRef.current = Date.now();
    setCurrentStep(1);
    setCompletedSteps([]);
    setActivityFeed([]);
    if (!resume) setPreview({});
    setStepMessage(resume ? "Reconnecting — picking up your report..." : "Starting...");
    setError("");
    setErrorQuip("");
    setResumable(false);

    // Ask for notification permission on the submit gesture (browsers require
    // a user action) so we can ping them when the report is ready
    try {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    } catch { /* unavailable */ }

    // A refine run carries the prior report's own context verbatim (so we don't
    // depend on hydrating every form field back into state first), plus the
    // change note and prior summary that drive the diff-aware regeneration.
    const context = refine
      ? {
          ...refine.context,
          clarification: "",
          refineNote: refine.refineNote,
          priorSummary: refine.priorSummary,
          runId: runIdRef.current,
        }
      : {
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
          clarification: clarificationText().slice(0, 500),
          preferCloud: preferCloud && detectedCloud ? detectedCloud : "",
          runId: runIdRef.current,
        };

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
      });

      if (res.status === 429) {
        const j = await res.json().catch(() => ({}));
        showError(j.error ?? "You've hit the hourly limit — try again in a bit.", "ratelimit");
        return;
      }
      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotDone = false;

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
            // Completed report sections stream in as partials for the live preview
            if (data.partial && !data.done) { setPreview((prev) => ({ ...prev, [data.partial.key]: data.partial.value })); continue; }
            // Never let a progress-less event or an out-of-order chunk yank the
            // ring backwards — it reads as "stuck" or "restarted" to the user
            if (typeof data.progress === "number") setProgress((p) => Math.max(p, data.progress));
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
              gotDone = true;
              if (data.error) {
                showError(data.error, "ai", true);
                notifyIfHidden("Generation failed", "Something went wrong — come back and try again.");
              } else {
                setProgress(100);
                setCompletedSteps([1, 2, 3, 4]);
                setStepMessage("Solution ready!");
                notifyIfHidden("Your solution is ready 🎉", data.solution?.title ?? "Open the tab to view your report.");

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

      // Stream ended without a done event (server timeout / dropped
      // connection) — without this the loading screen hung forever
      if (!gotDone) {
        showError("The report took too long or the connection dropped.", "timeout", true);
        notifyIfHidden("Generation didn't finish", "The report timed out — come back and try again.");
      }
    } catch {
      showError("Couldn't reach the server. Check your connection.", "network", true);
    }
  }

  // One follow-up question between submit and generation — tap an answer,
  // add anything extra, or skip straight to the report
  if (clarify) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-16">
        <div data-clarify className="w-full max-w-xl space-y-6">
          <p className="text-white/40 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> One quick question — makes your report far more accurate
          </p>
          <h2 className="text-2xl font-bold">{clarify.question}</h2>

          {/* Relevance feedback on the AI's question itself — helps us learn
              when the question-asking model picks a bad follow-up. */}
          <div data-clarify-feedback className="flex flex-wrap items-center gap-2 text-xs text-white/40">
            {clarifyFbSent ? (
              <span className="text-white/50">Thanks — this helps us ask better questions.</span>
            ) : (
              <>
                <span>Is this question relevant to your prompt?</span>
                <button type="button" aria-label="Relevant" onClick={() => onClarifyThumb("up")}
                  className={`px-2 py-1 rounded-lg border transition-all ${clarifyRating === "up" ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300" : "border-white/15 hover:border-white/40 hover:text-white/70"}`}>👍</button>
                <button type="button" aria-label="Not relevant" onClick={() => onClarifyThumb("down")}
                  className={`px-2 py-1 rounded-lg border transition-all ${clarifyRating === "down" ? "border-red-500/60 bg-red-500/10 text-red-300" : "border-white/15 hover:border-white/40 hover:text-white/70"}`}>👎</button>
              </>
            )}
          </div>
          {clarifyRating === "down" && !clarifyFbSent && (
            <div className="flex gap-2">
              <input
                value={clarifyFbComment}
                onChange={(e) => setClarifyFbComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { sendClarifyFeedback("down", clarifyFbComment.trim()); setClarifyFbSent(true); } }}
                placeholder="What's off about it? (optional)"
                className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
              />
              <button type="button" onClick={() => { sendClarifyFeedback("down", clarifyFbComment.trim()); setClarifyFbSent(true); }}
                className="px-3 py-2 rounded-lg text-xs border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-all">Send</button>
            </div>
          )}

          <p className="text-white/35 text-xs">Select all that apply</p>
          <div className="flex flex-col gap-2">
            {clarify.options.map((o) => {
              const selected = clarifyChoice.includes(o);
              return (
                <button key={o} type="button"
                  onClick={() => setClarifyChoice(selected ? clarifyChoice.filter((c) => c !== o) : [...clarifyChoice, o])}
                  className={`text-left px-4 py-3 rounded-xl border text-sm transition-all ${selected ? "border-blue-500/60 bg-blue-500/10 text-white" : "border-white/15 bg-white/5 text-white/60 hover:border-white/40 hover:text-white"}`}>
                  {selected && <Check className="w-3.5 h-3.5 inline mr-2 text-blue-400" />}{o}
                </button>
              );
            })}
          </div>
          <input
            value={clarifyExtra}
            onChange={(e) => setClarifyExtra(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runGeneration(false); }}
            placeholder="Anything else worth knowing? (optional)"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
          />
          <div className="flex gap-3">
            <button type="button" onClick={() => runGeneration(false)}
              className="flex-1 bg-white text-black font-semibold rounded-xl py-3.5 text-sm hover:bg-white/90 transition-all">
              {clarifyChoice.length || clarifyExtra.trim() ? "Continue — generate my report" : "Skip — generate anyway"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-3xl space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div className="w-full max-w-sm mx-auto text-center space-y-10">
          <ProgressRing progress={smoothProgress} elapsed={elapsed} />

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

          {/* Rotating fact to keep the wait interesting */}
          <div data-fact className="bg-white/3 border border-white/10 rounded-xl px-4 py-3 text-left flex gap-2.5">
            <Lightbulb className="w-4 h-4 text-yellow-400/60 shrink-0 mt-0.5" />
            <p key={factIdx} className="text-white/50 text-sm leading-snug animate-in fade-in duration-500">
              {LOADING_FACTS[factIdx % LOADING_FACTS.length]}
            </p>
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

        {/* Live report preview — sections appear the moment they're written */}
        {(preview.title || preview.tools || preview.phases) && (
          <div data-preview className="bg-white/3 border border-white/10 rounded-2xl p-5 animate-in fade-in text-left">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Your report so far
            </p>
            {preview.title && <h2 className="text-xl font-bold text-white mb-1">{preview.title}</h2>}
            {Array.isArray(preview.evaluated) && preview.evaluated.length > 0 && (
              <p data-evaluated className="text-blue-400/90 text-xs font-medium mb-2">
                {preview.evaluated.length} candidate solutions evaluated against your scenario
              </p>
            )}
            {preview.insight && <p className="text-white/55 text-sm italic mb-2">{preview.insight}</p>}
            {preview.summary && <p className="text-white/60 text-sm mb-3">{preview.summary}</p>}
            {Array.isArray(preview.tools) && preview.tools.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {preview.tools.map((t: any, i: number) => (
                  <span key={i} className="text-xs bg-white/8 border border-white/15 rounded-full px-3 py-1 text-white/60">{t?.name}</span>
                ))}
              </div>
            )}
            {Array.isArray(preview.phases) && preview.phases.length > 0 && (
              <ul className="space-y-1">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {preview.phases.map((p: any, i: number) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-white/55">
                    <span className="w-4 h-4 rounded-full bg-white/10 text-white/60 text-[10px] flex items-center justify-center shrink-0">{i + 1}</span>
                    {p?.title}
                  </li>
                ))}
              </ul>
            )}
            {preview.estimatedCost && <p className="text-white text-sm font-medium mt-3">{preview.estimatedCost}</p>}
          </div>
        )}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center px-4 pt-8 sm:pt-10 pb-16">
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
            PilotPlan — AI Solution Architect
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-3">
            &ldquo;Figure out a solution and have a plan by Friday.&rdquo;
          </h1>
          <p className="text-white/70 text-lg font-medium mb-4">
            Sound familiar? Paste it here — exactly like your boss said it.
          </p>
          <p className="text-white/50 text-base sm:text-lg">
            PilotPlan finds the solution — the right tools for <em>your</em>{" "}stack, budget, and team — and hands you
            the complete plan to implement it: rollout phases, real costs with sources, the people you&apos;ll need.
            Researched live, not recalled from memory. <span className="text-white/80 font-medium">Two minutes, not a week.</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Controls live BELOW the text, not overlaid on it — text can never
              run underneath the mic button (it did on iOS) */}
          <div className="bg-white/5 border border-white/15 rounded-2xl focus-within:border-white/40 transition-colors">
            <textarea
              ref={taRef}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="e.g. We need to automate invoice processing and sync it with our CRM..."
              className="w-full bg-transparent p-5 pb-2 text-white placeholder:text-white/30 resize-none overflow-y-auto focus:outline-none text-base"
              style={{ height: 120 }}
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <VoiceButton onTranscript={(t) => setProblem(t)} currentText={problem} />
              {problem && (
                <button
                  type="button"
                  onClick={() => setProblem("")}
                  className="text-white/30 hover:text-white/60 text-xs px-2 py-1 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* One-click example problems */}
          {(!problem.trim() || EXAMPLES.some((ex) => ex.problem === problem)) && (
          <div data-examples className="space-y-2">
            <p className="text-white/35 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Sound familiar? One click fills everything
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <button key={e.label} type="button" onClick={() => applyExample(e)}
                  className="px-3.5 py-1.5 rounded-full text-sm border border-white/15 bg-white/5 text-white/55 hover:border-white/40 hover:text-white hover:bg-white/10 transition-all">
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          )}

          <div className="space-y-4 bg-white/3 border border-white/10 rounded-2xl p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-white/40 text-xs uppercase tracking-wider">Industry</p>
                <Combobox options={INDUSTRIES} value={industry} onChange={setIndustry} placeholder="Type or pick an industry…" />
              </div>
              <div className="space-y-2">
                <p className="text-white/40 text-xs uppercase tracking-wider">Users / seats <span className="text-white/25 normal-case tracking-normal">(end users of the solution — optional)</span></p>
                <input type="number" min="1" value={seats} onChange={(e) => setSeats(e.target.value)}
                  placeholder="e.g. 25"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/40" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-white/40 text-xs uppercase tracking-wider">Company size</p>
              <Chips options={SIZES} selected={size} onSelect={(v) => {
                setSize(v);
                // Budget tiers change with size — clear a selection that no longer exists
                if (budget && !(BUDGETS_BY_SIZE[v] ?? DEFAULT_BUDGETS).includes(budget)) setBudget("");
              }} />
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
              <p className="text-white/40 text-xs uppercase tracking-wider">
                Current stack <span className="text-white/25 normal-case tracking-normal">(pick all that apply)</span>
                {(stacks.filter((s) => s !== "Recommend for me").length + extraStacks.length) > 0 && (
                  <span className="ml-2 text-blue-400/90 normal-case tracking-normal font-medium">
                    {stacks.filter((s) => s !== "Recommend for me").length + extraStacks.length} selected
                  </span>
                )}
              </p>
              <MultiChips
                options={STACKS}
                selected={stacks}
                onToggle={toggleStack}
                exclusive={["Recommend for me"]}
              />
              <MultiCombobox
                options={STACK_CATALOG}
                selected={extraStacks}
                onAdd={addExtraStack}
                onRemove={(v) => setExtraStacks((prev) => prev.filter((s) => s !== v))}
                placeholder="Search any other tool — NetSuite, Workday, Zendesk… or type your own"
              />
              {detectedCloud && (
                <button
                  type="button"
                  data-cloudpin
                  onClick={() => setPreferCloud((v) => !v)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                    preferCloud
                      ? "border-blue-500/60 bg-blue-500/15 text-blue-300 font-medium"
                      : "border-dashed border-blue-500/40 text-blue-400/70 hover:text-blue-300 hover:border-blue-400"
                  }`}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  {preferCloud
                    ? `Optimizing for ${detectedCloud} — native services, zero egress`
                    : `Prefer building on ${detectedCloud}? Our data lives there`}
                </button>
              )}
              {stacks.includes("Recommend for me") && (
                <p className="text-white/35 text-xs">
                  The AI will pick the best-fit tools with no assumptions about what you already run — recommendations won&apos;t be constrained to integrate with an existing stack.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-white/40 text-xs uppercase tracking-wider">Monthly budget</p>
              <Chips options={size ? BUDGETS_BY_SIZE[size] ?? DEFAULT_BUDGETS : DEFAULT_BUDGETS} selected={budget} onSelect={setBudget} />
            </div>
            <div className="space-y-2">
              <p className="text-white/40 text-xs uppercase tracking-wider">Implementation timeline</p>
              <Chips options={TIMELINES} selected={timeline} onSelect={setTimeline} />
            </div>
            <div className="space-y-2">
              <p className="text-white/40 text-xs uppercase tracking-wider">
                Compliance <span className="text-white/25 normal-case tracking-normal">(pick all that apply)</span>
                {compliance.filter((c) => c !== "None / Not sure").length > 0 && (
                  <span className="ml-2 text-blue-400/90 normal-case tracking-normal font-medium">
                    {compliance.filter((c) => c !== "None / Not sure").length} selected
                  </span>
                )}
              </p>
              <MultiChips
                options={COMPLIANCE}
                selected={compliance}
                onToggle={toggleCompliance}
                exclusive={["None / Not sure"]}
              />
            </div>
          </div>

          {error && (
            <div data-error className={`rounded-xl px-4 py-3 space-y-2 border ${resumable ? "bg-blue-500/10 border-blue-500/25" : "bg-red-500/10 border-red-500/25"}`}>
              {resumable ? (
                <>
                  <p className="text-white text-sm font-medium">Looks like the connection hiccuped — don&apos;t worry, your solution is saved and almost complete.</p>
                  <p className="text-white/50 text-xs">{error}</p>
                  {errorQuip && <p data-quip className="text-white/40 text-xs italic">{errorQuip}</p>}
                  <button
                    type="button"
                    onClick={() => runGeneration(true)}
                    className="w-full bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
                  >
                    Continue where we left off
                  </button>
                </>
              ) : (
                <>
                  <p className="text-red-400 text-sm">{error}</p>
                  {errorQuip && <p data-quip className="text-white/40 text-xs italic">{errorQuip}</p>}
                </>
              )}
            </div>
          )}

          <button type="submit" disabled={!isReady || clarifying}
            className="w-full bg-white text-black font-semibold rounded-2xl py-4 text-base hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            {clarifying ? "One moment…" : "Get my plan — free"}
          </button>
        </form>

        <p className="text-center text-white/30 text-sm mt-6">
          {FREE_MODE ? "Every number links to its source · Free during beta · Reports auto-save to My Solutions" : "Preview is free · Pay $1 only after you approve"}
        </p>
      </div>
    </main>
  );
}
