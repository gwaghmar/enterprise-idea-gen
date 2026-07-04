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
];
// Searchable catalog for the stack autocomplete — anything not listed can be
// typed and added as a custom entry
const STACK_CATALOG = [
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
  {
    label: "Onboarding a hire takes 3 weeks",
    problem: "Every new hire needs a dozen accounts provisioned manually across our tools. Onboarding takes weeks, steps get missed, and offboarding is worse — accounts stay active after people leave. We want automated provisioning and deprovisioning.",
    industry: "Consulting / Professional Services", size: "Enterprise", team: "HR", techLevel: "No-code only",
    stacks: ["Google Workspace", "Slack"], extraStacks: ["Okta"], budget: "$2k+/mo", timeline: "1–3 months", compliance: ["ISO 27001"],
  },
  {
    label: "Support runs out of a shared inbox",
    problem: "Customer support is a shared Gmail inbox. Response times are 2+ days, nothing is tracked or prioritized, and we have no idea what customers complain about most. We need a real helpdesk with automation and SLAs.",
    industry: "Retail / E-commerce", size: "Startup", team: "Operations", techLevel: "No-code only",
    stacks: ["Google Workspace", "Shopify"], extraStacks: [], budget: "< $500/mo", timeline: "ASAP", compliance: [],
  },
  {
    label: "Monthly reports take 3 days to build",
    problem: "Every month ops exports CSVs from five different systems and stitches the exec dashboard together in Excel. It takes three days, breaks constantly, and nobody trusts the numbers. We want automated reporting with a live dashboard.",
    industry: "Logistics / Supply Chain", size: "SMB", team: "Operations", techLevel: "Some developers",
    stacks: ["Microsoft 365", "SAP"], extraStacks: ["Power BI"], budget: "$500–2k/mo", timeline: "1–3 months", compliance: [],
  },
  {
    label: "Contracts get lost in email threads",
    problem: "Sales contracts are negotiated as email attachments with no visibility into status, versions, or renewal dates — we recently missed an auto-renewal that cost us. We need contract lifecycle management with e-signature and renewal alerts.",
    industry: "Legal Services", size: "SMB", team: "Legal", techLevel: "No-code only",
    stacks: ["Google Workspace", "Salesforce"], extraStacks: ["DocuSign"], budget: "$500–2k/mo", timeline: "1–3 months", compliance: ["GDPR"],
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
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm border transition-all ${
              isSelected
                ? isExclusive
                  ? "bg-white/20 text-white border-white/50 font-medium"
                  : "bg-white text-black border-white font-medium"
                : "bg-transparent text-white/50 border-white/20 hover:border-white/50 hover:text-white/80"
            }`}>
            {isSelected && !isExclusive && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
            {o}
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

  // Auto-grow the problem box with its content (capped, then scrolls)
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(144, Math.min(el.scrollHeight + 2, 400))}px`;
  }, [problem]);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepMessage, setStepMessage] = useState("");
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [activityFeed, setActivityFeed] = useState<{ type: string; text: string; url?: string }[]>([]);
  const [error, setError] = useState("");
  const [errorQuip, setErrorQuip] = useState("");
  const [factIdx, setFactIdx] = useState(0);
  const [hasHistory, setHasHistory] = useState(false);
  const router = useRouter();

  function showError(message: string, kind: ErrorKind) {
    setError(message);
    setErrorQuip(quipFor(kind));
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

  // Desktop/Android notification when the report finishes while the tab is
  // in the background (generation takes a minute — people switch tabs)
  function notifyIfHidden(title: string, body: string) {
    try {
      if (!document.hidden || !("Notification" in window) || Notification.permission !== "granted") return;
      const n = new Notification(title, { body, icon: "/favicon.ico" });
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

  const isReady = problem.trim() && size && (stacks.length > 0 || extraStacks.length > 0) && budget && timeline && industry.trim() && team;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady) return;

    setLoading(true);
    setProgress(1);
    setSmoothProgress(1);
    setElapsed(0);
    startedAtRef.current = Date.now();
    setCurrentStep(1);
    setCompletedSteps([]);
    setActivityFeed([]);
    setStepMessage("Starting...");
    setError("");
    setErrorQuip("");

    // Ask for notification permission on the submit gesture (browsers require
    // a user action) so we can ping them when the report is ready
    try {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    } catch { /* unavailable */ }

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
              gotDone = true;
              if (data.error) {
                showError(data.error, "ai");
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
        showError("The report took too long or the connection dropped. Please try again — it usually works on a second run.", "timeout");
        notifyIfHidden("Generation didn't finish", "The report timed out — come back and try again.");
      }
    } catch {
      showError("Couldn't reach the server. Check your connection and try again.", "network");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-3xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
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
            ERPHigh — AI Solution Architect for your business
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Describe a business problem.<br />
            <span className="text-white/40">Get the tools, costs & rollout plan.</span>
          </h1>
          <p className="text-white/50 text-lg">
            {FREE_MODE
              ? "An AI consultant that researches live sources and builds your implementation plan — which tools to buy, what they'll really cost, how to roll them out, and the email to send the vendor. Free while in beta."
              : "An AI consultant that researches live sources and builds your implementation plan — tools, real costs, rollout steps, and the vendor email. Review free — pay $1 only if you like it."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <textarea
              ref={taRef}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="e.g. We need to automate invoice processing and sync it with our CRM..."
              className="w-full bg-white/5 border border-white/15 rounded-2xl p-5 pb-14 text-white placeholder:text-white/30 resize-none overflow-y-auto focus:outline-none focus:border-white/40 text-base transition-colors"
              style={{ height: 144 }}
            />
            <div className="absolute bottom-3 left-3 flex items-center">
              <VoiceButton onTranscript={(t) => setProblem(t)} currentText={problem} />
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

          {/* One-click example problems */}
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
              <p className="text-white/40 text-xs uppercase tracking-wider">
                Current stack <span className="text-white/25 normal-case tracking-normal">(pick all that apply)</span>
                {(stacks.filter((s) => s !== "Recommend for me").length + extraStacks.length) > 0 && (
                  <span className="ml-2 text-emerald-400/80 normal-case tracking-normal font-medium">
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
              <p className="text-white/40 text-xs uppercase tracking-wider">
                Compliance / data sensitivity <span className="text-white/25 normal-case tracking-normal">(pick all that apply)</span>
                {compliance.filter((c) => c !== "None / Not sure").length > 0 && (
                  <span className="ml-2 text-emerald-400/80 normal-case tracking-normal font-medium">
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
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 space-y-1">
              <p className="text-red-400 text-sm">{error}</p>
              {errorQuip && <p data-quip className="text-white/40 text-xs italic">{errorQuip}</p>}
            </div>
          )}

          <button type="submit" disabled={!isReady}
            className="w-full bg-white text-black font-semibold rounded-2xl py-4 text-base hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            Generate Solution — Free Preview
          </button>
        </form>

        <p className="text-center text-white/30 text-sm mt-6">
          {FREE_MODE ? "Free during beta · Your reports auto-save to My Solutions" : "Preview is free · Pay $1 only after you approve"}
        </p>
      </div>
    </main>
  );
}
