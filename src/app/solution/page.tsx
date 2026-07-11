"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Search, Sparkles, FileText, Brain, CheckCircle2, Circle,
  Lightbulb, Target, Clock, ArrowRight, ArrowUpRight, ArrowLeft, AlertTriangle, Square, Wand2,
  Lock, Mail, Copy, FileDown, History,
} from "lucide-react";
import { isPaid, updateHistory } from "@/lib/history";
import { FREE_MODE } from "@/lib/config";
import { classifyRefine } from "@/lib/refine-classify";
import JourneyMap from "./journey-map";
import ArchitectureMap from "./architecture-map";
import { hasArchitectureData } from "@/lib/generate-architecture";

// Citations/activity URLs come from external sources — only render links for
// http(s) URLs so a crafted share payload can't smuggle javascript: links
// One quiet pill labeled "Source" per block. Clicking it opens a small panel
// listing every citation that backs the claim — favicon, domain, and a
// deep-link (#:~:text=) that scrolls supporting browsers to the exact quote.
function SourcePill({ url, urls, quote }: { url?: string; urls?: string[]; quote?: string }) {
  const [open, setOpen] = useState(false);
  const all = [url, ...(urls ?? [])]
    .map((u) => safeHttpUrl(u))
    .filter((u, i, a) => u && a.indexOf(u) === i) as string[];
  if (all.length === 0) return null;
  const withQuote = (base: string, q?: string) =>
    q && q.trim().length > 4 && !base.includes("#")
      ? `${base}#:~:text=${encodeURIComponent(q.trim().slice(0, 80))}`
      : base;
  return (
    <span className="relative inline-block align-middle" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={all.length > 1 ? `${all.length} sources — click to view` : "View source"}
        className={`inline-flex items-center gap-1 rounded-full pl-2 pr-2 py-0.5 text-[10px] border transition-colors ${open ? "bg-white/15 border-white/30 text-white/80" : "bg-white/[0.06] border-white/10 text-white/45 hover:text-white/80 hover:border-white/25"}`}
      >
        Source{all.length > 1 ? `s · ${all.length}` : ""}
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <span className="absolute left-0 top-full mt-1.5 z-50 w-72 max-w-[80vw] bg-[#101420] border border-white/15 rounded-xl shadow-xl p-2 flex flex-col gap-1">
            {all.map((u, i) => (
              <a key={u} href={withQuote(u, i === 0 ? quote : undefined)} target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-white/8 transition-colors">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://www.google.com/s2/favicons?domain=${faviconDomain(u)}&sz=32`} alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-sm shrink-0 mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-xs text-white/85 font-medium">{faviconDomain(u)}</span>
                  <span className="block text-[10px] text-white/40 truncate">{u.replace(/^https?:\/\//, "")}</span>
                  {i === 0 && quote && <span className="block text-[10px] text-blue-300/70 italic truncate">jumps to: &ldquo;{quote.slice(0, 50)}&rdquo;</span>}
                </span>
              </a>
            ))}
          </span>
        </>
      )}
    </span>
  );
}

const SourcePills = SourcePill;

// The exec metric boxes are built for short values; older reports sometimes
// carry a whole cost breakdown in estimatedCost. Pull out the headline figure
// and tuck the rest behind an expandable detail line.
function shortMetric(v: string | undefined): { short: string; detail?: string } {
  const val = (v ?? "").trim();
  if (val.length <= 34) return { short: val };
  // Several prices may appear ("$150 + $400 = $1,010/mo total") — prefer the
  // one adjacent to "total", else the last (usually the sum)
  const prices = [...val.matchAll(/[~≈]?[$€£]\s?\d[\d,.]*\s?(k|K|M)?(\s?\/\s?(mo|month|yr|year))?/g)];
  if (prices.length > 0) {
    const nearTotal = [...prices].reverse().find((pm) => {
      const end = (pm.index ?? 0) + pm[0].length;
      return /^\s*(total|est)/i.test(val.slice(end, end + 12)) || /total[:\s]*$/i.test(val.slice(Math.max(0, (pm.index ?? 0) - 12), pm.index ?? 0));
    });
    const best = nearTotal ?? prices[prices.length - 1];
    return { short: best[0].replace(/\s+/g, " ").trim(), detail: val };
  }
  const m = val.match(/\d+\s?[–-]\s?\d+\s?(weeks?|months?|days?)/i) || val.match(/\d+\s?(weeks?|months?|days?|phases?)/i);
  if (m) return { short: m[0].replace(/\s+/g, " ").trim(), detail: val };
  return { short: val.slice(0, 30) + "…", detail: val };
}

function MetricBox({ label, value }: { label: string; value?: string }) {
  const [open, setOpen] = useState(false);
  const { short, detail } = shortMetric(value);
  return (
    <div className="text-center min-w-0">
      <p className="text-white/40 text-xs mb-1">{label}</p>
      <p className="text-white font-bold text-sm sm:text-base break-words">{short}</p>
      {detail && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-[10px] text-white/35 hover:text-white/70 transition-colors">
          {open ? "hide" : "details"}
        </button>
      )}
      {detail && open && <p className="text-white/50 text-xs mt-1 text-left">{detail}</p>}
    </div>
  );
}

function safeHttpUrl(u: string | undefined): string | null {
  if (!u) return null;
  try {
    const p = new URL(u);
    return p.protocol === "http:" || p.protocol === "https:" ? u : null;
  } catch { return null; }
}

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

// Turn the AI-drafted "Subject: ...\n\n<body>" email into a mailto: link
function mailtoFromEmail(email: string): string {
  const match = email.match(/^Subject:\s*(.+)\r?\n+/i);
  const subject = match ? match[1].trim() : "Vendor inquiry";
  const body = match ? email.slice(match[0].length) : email;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function downloadKpiCsv(kpis: Kpi[], title: string) {
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["Metric", "Baseline", "Target", "Timeframe"],
    ...kpis.map((k) => [k.metric, k.baseline ?? "", k.target, k.timeframe ?? ""]),
  ];
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}_KPIs.csv`;
  a.click();
  // Revoking synchronously can cancel the download in some browsers
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ticketText(t: Ticket, problem: string): string {
  const lines = [`Title: ${t.title}`, `Type: ${t.type}`, `System: ${t.system}`];
  if (t.assignTo) lines.push(`Assign to: ${t.assignTo}`);
  lines.push("", `Context: ${problem}`);
  return lines.join("\n");
}

const FlowChart = dynamic(() => import("@/components/FlowChart"), { ssr: false });

interface LockIn { level: string; reason: string; }
interface Tool {
  name: string; purpose: string; category: string;
  whyForYou: string; vendorQuestions?: string[]; sourceUrl?: string; lockIn?: LockIn;
  environment?: string; status?: "existing" | "new" | "replaced"; dataSensitivity?: string;
}
interface DataFlowLink { from: string; to: string; via: string; note?: string; }
interface FlowNode { id: string; label: string; type: string; }
interface FlowEdge { from: string; to: string; label?: string; }
interface Phase { title: string; objective?: string; actions: string[]; exitCriteria?: string[]; nodes?: FlowNode[]; edges?: FlowEdge[]; }
interface Stakeholder { role: string; team: string; responsibility: string; whenToContact: string; }
interface Ticket { system: string; type: string; title: string; assignTo: string; }
interface Permission { name: string; owner: string; why: string; }
interface ITControl { name: string; action: string; }
interface Risk { risk: string; severity: string; mitigation: string; }
interface RolloutPlaybook { stakeholders?: Stakeholder[]; tickets?: Ticket[]; }
interface Approvals { permissions?: Permission[]; itControls?: ITControl[]; riskAssessment?: Risk[]; }
interface VendorOutreach { howToReach?: string; email?: string; demoChecklist?: string[]; }
interface TcoLineItem { item: string; type: string; cost: string; sourceUrl?: string; sourceQuote?: string; }
interface Tco { lineItems?: TcoLineItem[]; oneTimeSetup?: string; monthlyRecurring?: string; firstYearTotal?: string; yearTwoRunRate?: string; hiddenCosts?: string[]; }
interface CaseStudy { org: string; problem: string; approach: string; outcome: string; lesson: string; sourceUrl?: string; }
interface Operations { monitoring?: string[]; scalability?: string; }
interface Kpi { metric: string; baseline?: string; target: string; timeframe?: string; }
interface AdoptionStep { title: string; detail: string; }
interface Alternative { name: string; summary: string; tools?: string[]; estimatedCost?: string; tradeoff?: string; }
interface Evaluated { name: string; verdict: string; reason: string; sourceUrl?: string; }
interface TeamRole { role: string; skills?: string[]; commitment?: string; phases?: string; staffing?: string; }
interface Solution {
  title: string; insight?: string; insightSourceUrl?: string; insightSourceUrls?: string[]; insightSourceQuote?: string; summary: string; tools: Tool[];
  phases: Phase[]; estimatedCost: string; timeToImplement: string;
  rolloutPlaybook?: RolloutPlaybook; approvals?: Approvals; vendorOutreach?: VendorOutreach;
  tco?: Tco; kpis?: Kpi[]; adoptionPlan?: AdoptionStep[]; alternative?: Alternative;
  assumptions?: string[]; showHoursRoi?: boolean; evaluated?: Evaluated[]; teamRequired?: TeamRole[];
  dataFlow?: DataFlowLink[];
  staffingSummary?: { buildFte: string; runFte?: string };
  caseStudies?: CaseStudy[];
  operations?: Operations;
  beforeYouStart?: string[];
  costOfInaction?: { annualCost: string; basis: string; paybackPeriod?: string };
}
interface Context {
  size: string; stack: string; budget: string; timeline: string;
  industry?: string; team?: string; seats?: string; techLevel?: string; compliance?: string;
  preferCloud?: string;
}
interface SelectedItem { label: string; itemType: string; }

// Geist-style: categories are metadata, not a rainbow — one quiet chip style
const categoryColors: Record<string, string> = {
  default: "bg-white/[0.06] text-white/60 border-white/10",
};

// ─── Explain Popup ────────────────────────────────────────────────────────────
function ExplainPopup({ item, solutionContext, fullSolution, onEdit, onClose }: {
  item: SelectedItem; solutionContext: string;
  fullSolution: Solution; onEdit: (s: Solution) => void; onClose: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "explaining" | "asking" | "editing">("choose");
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [editInstruction, setEditInstruction] = useState("");
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState("");
  const [editDone, setEditDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  async function applyEdit() {
    if (!editInstruction.trim()) return;
    setEditing(true); setEditError("");
    try {
      const res = await fetch("/api/edit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solution: fullSolution, instruction: editInstruction.trim(), selectedText: item.label }),
      });
      const data = await res.json();
      if (!res.ok || !data.solution) throw new Error(data.error || "Edit failed");
      onEdit(data.solution);
      setEditDone(true);
      setTimeout(onClose, 700);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Could not apply that change.");
    } finally {
      setEditing(false);
    }
  }

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
  useEffect(() => { if (mode === "editing" && editRef.current) editRef.current.focus(); }, [mode]);

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
            <button onClick={() => setMode("editing")} className="w-full bg-white/8 border border-white/15 text-white font-medium rounded-xl py-3 text-sm hover:bg-white/12 transition-all flex items-center justify-center gap-2">
              <Wand2 className="w-4 h-4" />
              Change this with AI
            </button>
          </div>
        )}
        {mode === "editing" && (
          <div className="mt-2 space-y-3">
            {editDone ? (
              <div className="flex items-center gap-2 text-emerald-400 text-sm py-3"><CheckCircle2 className="w-4 h-4" /> Applied — updating your solution…</div>
            ) : (
              <>
                <p className="text-white/50 text-xs">Describe the change — e.g. &ldquo;swap this for a cheaper tool&rdquo;, &ldquo;add a fourth phase&rdquo;, &ldquo;cut the cost estimate in half&rdquo;.</p>
                <form onSubmit={(e) => { e.preventDefault(); applyEdit(); }} className="space-y-3">
                  <input ref={editRef} value={editInstruction} onChange={(e) => setEditInstruction(e.target.value)} placeholder="What should change?" disabled={editing}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/40 disabled:opacity-50" />
                  {editError && <p className="text-red-400 text-xs">{editError}</p>}
                  <button type="submit" disabled={!editInstruction.trim() || editing} className="w-full bg-white text-black font-semibold rounded-xl py-3 text-sm hover:bg-white/90 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                    {editing ? <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Applying…</> : "Apply change"}
                  </button>
                </form>
                <p className="text-white/25 text-xs">Updates this solution in place. Re-export or re-share to save the change.</p>
              </>
            )}
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
          {[
            { label: "Monthly problem cost", value: `$${Math.round(monthly).toLocaleString()}`, sub: "team × hours × rate" },
            { label: "Monthly savings", value: savings > 0 ? `$${Math.round(savings).toLocaleString()}` : "—", sub: "after solution cost", highlight: savings > 0 },
            { label: "Payback period", value: payback ? `${payback} months` : "—", sub: "to break even", highlight: !!payback },
          ].map((m) => (
            <div key={m.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <p className="text-white/40 text-xs mb-1">{m.label}</p>
              <p className={`text-lg font-bold ${m.highlight ? "text-blue-400" : "text-white"}`}>{m.value}</p>
              <p className="text-white/25 text-xs mt-0.5">{m.sub}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Activity Trace Modal ─────────────────────────────────────────────────────
function ActivityModal({ activity, focusUrl, onClose }: {
  activity: { type: string; text: string; url?: string }[]; focusUrl: string | null; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative bg-[#0d0d0d] border border-white/15 rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">How AI built this</p>
            <p className="text-white font-semibold">Research activity</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 ml-4 text-2xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto space-y-2.5 pr-1">
          {activity.map((a, i) => {
            const focused = focusUrl && a.url === focusUrl;
            return (
              <div key={i} className={`flex items-start gap-2.5 text-sm rounded-lg px-2 py-1.5 ${focused ? "bg-blue-500/15 border border-blue-500/30" : ""}`}>
                {a.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`https://www.google.com/s2/favicons?domain=${faviconDomain(a.url)}&sz=64`} alt="" width={16} height={16}
                    className="w-4 h-4 rounded mt-0.5 shrink-0 bg-white/10"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
                ) : (
                  <ActivityIcon type={a.type} className="w-4 h-4 mt-0.5 shrink-0 text-white/45" />
                )}
                {safeHttpUrl(a.url)
                  ? <a href={safeHttpUrl(a.url)!} target="_blank" rel="noopener noreferrer" className="text-blue-300/90 hover:text-blue-200 leading-snug break-all">{a.text}</a>
                  : <span className="text-white/70 leading-snug">{a.text}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Solution Page ───────────────────────────────────────────────────────
export default function SolutionPage() {
  const [solution, setSolution] = useState<Solution | null>(null);
  const [problem, setProblem] = useState("");
  const [context, setContext] = useState<Context | null>(null);
  const [citations, setCitations] = useState<string[]>([]);
  const [sourceMeta, setSourceMeta] = useState<Record<string, string>>({});
  const [remixing, setRemixing] = useState<string | null>(null);
  const [swapTool, setSwapTool] = useState<number | null>(null);
  const [techSwapOpen, setTechSwapOpen] = useState(false);
  const [askSel, setAskSel] = useState<{ text: string; x: number; y: number } | null>(null);
  const [techSwapText, setTechSwapText] = useState("");
  const [swapText, setSwapText] = useState("");
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [activity, setActivity] = useState<{ type: string; text: string; url?: string }[]>([]);
  const [activityFocus, setActivityFocus] = useState<string | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [model, setModel] = useState("");
  const [tokens, setTokens] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [expandedTool, setExpandedTool] = useState<number | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [roiData, setRoiData] = useState<{ weeklyHours: number; teamSize: number; hourlyRate: number } | null>(null);
  const [askBtn, setAskBtn] = useState<{ text: string; top: number; left: number } | null>(null);
  const [sid, setSid] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [paidReal, setPaidReal] = useState(false);
  const [copiedTicket, setCopiedTicket] = useState<number | null>(null);
  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState("");
  const [refinedWith, setRefinedWith] = useState("");
  const router = useRouter();
  const rawDataRef = useRef<Record<string, unknown>>({});
  const contentRef = useRef<HTMLDivElement>(null);

  // Show a floating "Ask AI" button when the user selects text inside the report
  useEffect(() => {
    function onSelect() {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!sel || text.length < 3 || text.length > 600 || sel.rangeCount === 0) { setAskBtn(null); return; }
      const range = sel.getRangeAt(0);
      const container = contentRef.current;
      if (!container || !container.contains(range.commonAncestorContainer)) { setAskBtn(null); return; }
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) { setAskBtn(null); return; }
      setAskBtn({ text, top: rect.top + window.scrollY - 44, left: rect.left + window.scrollX + rect.width / 2 });
    }
    function onSelectionChange() { if (!window.getSelection()?.toString().trim()) setAskBtn(null); }
    document.addEventListener("mouseup", onSelect);
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("mouseup", onSelect);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem("solution");
    if (!raw) { router.push("/"); return; }
    const data = JSON.parse(raw);
    rawDataRef.current = data;
    setSolution(data.solution);
    setProblem(data.problem);
    setContext(data.context ?? null);
    setCitations(data.citations ?? []);
    setSourceMeta(data.sourceMeta ?? {});
    setActivity(data.activity ?? []);
    setSid(data.sid ?? null);
    setPaidReal(Boolean(data.paid) || isPaid(data.sid));
    setUnlocked(FREE_MODE || Boolean(data.paid) || isPaid(data.sid));
    if (data.solution?.title) document.title = `${data.solution.title} — PilotPlan`;
    setModel(data.model ?? "");
    setTokens(data.tokens ?? null);
    setRefinedWith(typeof data.refineNote === "string" ? data.refineNote : "");
  }, [router]);

  const solutionContext = solution
    ? `Title: ${solution.title}\nSummary: ${solution.summary}\nTools: ${solution.tools.map((t) => t.name).join(", ")}\nCost: ${solution.estimatedCost}\nTimeline: ${solution.timeToImplement}`
    : "";

  function pick(label: string, itemType: string) { setSelectedItem({ label, itemType }); }

  // Select any sentence -> a floating "Ask AI" chip appears near the selection
  // (mouseup on desktop, selectionchange covers mobile long-press)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim() ?? "";
        if (!sel || sel.isCollapsed || text.length < 8 || text.length > 400) { setAskSel(null); return; }
        try {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) { setAskSel(null); return; }
          setAskSel({
            text,
            x: Math.min(Math.max(rect.left + rect.width / 2, 60), window.innerWidth - 60),
            y: rect.top,
          });
        } catch { setAskSel(null); }
      }, 180);
    };
    document.addEventListener("selectionchange", update);
    return () => { clearTimeout(t); document.removeEventListener("selectionchange", update); };
  }, []);

  function handleSolutionEdit(updated: Solution) {
    setSolution(updated);
    rawDataRef.current = { ...rawDataRef.current, solution: updated };
    try { sessionStorage.setItem("solution", JSON.stringify(rawDataRef.current)); } catch { /* ignore quota */ }
    if (sid) updateHistory(sid, { title: updated.title }, rawDataRef.current);
    setShareUrl(null); // invalidate any prior share link — content changed
  }

  // "Something changed?" box — one input, two machines behind it. A small tweak
  // is patched in place via /api/edit; a scenario-level change is handed off to
  // the homepage's full generate pipeline (fresh research, progress, history).
  async function handleRefine() {
    const note = refineText.trim();
    if (!note || refining || !solution) return;
    setRefineError("");
    const route = classifyRefine(note);
    logEvent("refine", `${route}: ${note.slice(0, 80)}`);

    if (route === "patch") {
      setRefining(true);
      try {
        const res = await fetch("/api/edit", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ solution, instruction: note }),
        });
        const data = await res.json();
        if (!res.ok || !data.solution) throw new Error(data.error || "Edit failed");
        handleSolutionEdit(data.solution);
        setRefineText("");
      } catch (e) {
        setRefineError(e instanceof Error ? e.message : "Could not apply that change.");
      } finally {
        setRefining(false);
      }
      return;
    }

    // Big change: stash the prior context + change note and route to the full
    // generate pipeline. The current report is already saved in history, so this
    // is non-destructive — the user can always reopen the previous version.
    const priorSummary = `${solution.title}. ${solution.summary}`.slice(0, 800);
    const payload = {
      context: { ...(context ?? {}), problem: problem },
      refineNote: note,
      priorSummary,
      priorTitle: solution.title,
    };
    try {
      sessionStorage.setItem("pendingRefine", JSON.stringify(payload));
    } catch {
      setRefineError("Couldn't start the update. Try again.");
      return;
    }
    router.push("/");
  }

  async function ensureShareUrl(): Promise<string | null> {
    if (shareUrl) return shareUrl;
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
        return url;
      }
    } catch { /* not configured */ }
    return null;
  }

  function summaryHtml(url: string | null): { html: string; text: string } {
    if (!solution) return { html: "", text: "" };
    const first = solution.tco?.firstYearTotal ?? solution.estimatedCost;
    const teamN = solution.teamRequired?.length ?? 0;
    const rejected = solution.evaluated?.filter((c) => c.verdict !== "chosen").length ?? 0;
    const tools = solution.tools.map((t) => t.name).join(" · ");
    const html = `<p>Hi,</p>
<p>Sharing an implementation plan for our problem — generated with live vendor and community research.</p>
<p><strong>${solution.title}</strong><br/>${solution.summary}</p>
<p><strong>First-year total:</strong> ${first} · <strong>Timeline:</strong> ${solution.timeToImplement}${teamN ? ` · <strong>Team needed:</strong> ${teamN} roles` : ""}<br/>
<strong>Tools:</strong> ${tools}${solution.evaluated?.length ? ` — ${solution.evaluated.length} candidates evaluated${rejected ? `, ${rejected} rejected (reasons in report)` : ""}` : ""}</p>
${url ? `<p>Full interactive report: <a href="${url}">${url}</a></p>` : ""}
<p><em>(PDF attached)</em></p>`;
    const text = html.replace(/<br\/>/g, "\n").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n");
    return { html, text };
  }

  async function handleShare() {
    // Native share sheet with the actual PDF attached, where the platform
    // supports it (iOS/Android/most Windows+macOS Safari). Everywhere else:
    // formatted summary to the clipboard + PDF download.
    if (solution && context) {
      try {
        const { generatePDF } = await import("@/lib/generate-pdf");
        const blob = await generatePDF(solution, problem, context, citations, roiData ?? undefined, { returnBlob: true }) as Blob;
        const file = new File([blob], `${solution.title.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}.pdf`, { type: "application/pdf" });
        const url = await ensureShareUrl();
        if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: solution.title, text: `Implementation plan: ${solution.title}`, ...(url ? { url } : {}) });
          return;
        }
        // Desktop fallback: rich summary to clipboard + download the PDF
        const { html, text } = summaryHtml(url);
        try {
          await navigator.clipboard.write([new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          })]);
        } catch { await navigator.clipboard.writeText(text); }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
        setShareMsg("Formatted summary copied — paste into your email. PDF downloaded to attach.");
        setTimeout(() => setShareMsg(""), 6000);
        return;
      } catch { /* fall through to plain link copy */ }
    }
    await handleShareLink();
  }

  async function handleShareLink() {
    if (shareUrl) { navigator.clipboard.writeText(shareUrl); return; }
    setSharing(true);
    const url = await ensureShareUrl();
    if (url) navigator.clipboard.writeText(url);
    setSharing(false);
  }

  async function handleEmailMe() {
    if (!solution || !context) return;
    setEmailing(true);
    // mailto can't attach files — download the PDF alongside the draft so the
    // user can drop it in (the body tells them it's in Downloads)
    try {
      const { generatePDF } = await import("@/lib/generate-pdf");
      await generatePDF(solution, problem, context, citations, roiData ?? undefined);
    } catch { /* PDF is a bonus — the email still works without it */ }
    const url = await ensureShareUrl();
    const evalCount = solution.evaluated?.length ?? 0;
    const firstYear = solution.tco?.firstYearTotal ?? solution.estimatedCost;
    const subject = encodeURIComponent(`Implementation plan: ${solution.title}`);
    const body = encodeURIComponent(
      `Hi,\n\nHere's the implementation plan for: ${problem.slice(0, 160)}\n\n` +
      `RECOMMENDATION\n${solution.title} — ${solution.summary}\n\n` +
      `KEY NUMBERS\n` +
      `- First-year total: ${firstYear}\n` +
      `- Timeline: ${solution.timeToImplement}\n` +
      `- Tools: ${solution.tools.map((t) => t.name).join(", ")}\n` +
      (evalCount ? `- Candidates evaluated: ${evalCount}\n` : "") +
      (url ? `\nFull interactive report: ${url}\n` : "") +
      `\nThe PDF version was just downloaded to this device — attach it to this email before sending.\n\n` +
      `Generated with PilotPlan (pilotplan.vercel.app)`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setEmailing(false);
  }

  const REMIXES: { key: string; label: string; instruction: string }[] = [
    { key: "cheaper", label: "Make it cheaper", instruction: "Rework this solution to cost significantly less: prefer cheaper tiers, open-source or existing-stack options, and cut nice-to-haves. Update tools, costs, TCO, phases and the alternative accordingly. Keep the same problem and quality bar." },
    { key: "faster", label: "Make it faster", instruction: "Compress this plan to deliver value in half the time: fewer tools, self-serve setup where possible, aggressive but realistic phase timelines. Update phases, exit criteria, costs and rollout accordingly." },
    { key: "execs", label: "Explain for execs", instruction: "Rewrite the summary, insight, phase objectives, and adoption plan in plain business language for a non-technical executive: lead with money, time, and risk; no jargon or tool-internals; keep every number, tool name, cost, and the JSON structure exactly the same." },
    { key: "enterprise", label: "More enterprise-grade", instruction: "Upgrade this solution for a stricter enterprise environment: stronger compliance and security controls, SSO everywhere, vendor SLAs, formal change management. Update tools, approvals, risks, TCO and phases accordingly." },
  ];

  async function handleRemix(r: { key: string; instruction: string }) {
    if (!solution || remixing) return;
    logEvent("remix", r.key);
    setRemixing(r.key);
    try {
      const res = await fetch("/api/edit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solution, instruction: r.instruction }),
      });
      const data = await res.json();
      if (res.ok && data.solution) handleSolutionEdit(data.solution);
    } catch { /* leave the report as-is */ }
    finally { setRemixing(null); }
  }

  function logEvent(kind: string, detail: string) {
    // Behavioral feedback for the learning loop — best-effort
    try {
      fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, detail, title: solution?.title ?? "", problem }) }).catch(() => {});
    } catch { /* never block the action */ }
  }

  async function handleSwap(target: string, preference: string) {
    if (!solution || remixing) return;
    logEvent("swap", `replaced ${target} -> ${preference}`);
    setRemixing(`swap:${target}`);
    try {
      const res = await fetch("/api/edit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solution,
          instruction: `Replace or de-emphasize "${target}" in this solution per the user's preference: "${preference}". Rebuild the affected tools, whyForYou reasoning, phases, costs, TCO, approvals, and vendor outreach around the new choice. Keep the problem and everything unrelated unchanged. If the preference is a bad fit, keep the plan workable but honor the user's tool choice and flag the tradeoff in riskAssessment or hiddenCosts.`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.solution) handleSolutionEdit(data.solution);
    } catch { /* leave the report as-is */ }
    finally { setRemixing(null); setSwapTool(null); setSwapText(""); }
  }

  async function sendFeedback(rating: "up" | "down" | null, comment: string) {
    setFeedbackSent(true);
    try {
      await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment, title: solution?.title ?? "", problem }),
      });
    } catch { /* feedback is best-effort */ }
  }

  async function handleExport() {
    if (!solution || !context) return;
    if (!unlocked) { handleApprove(); return; }
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

  async function handleExportExcel() {
    if (!solution) return;
    if (!unlocked) { handleApprove(); return; }
    setExportingExcel(true);
    try {
      const { generateExcel } = await import("@/lib/generate-excel");
      const buf = await generateExcel(solution, problem);
      const blob = new Blob([buf as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(solution.title || "implementation-plan").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-tracker.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error("Excel export failed", e);
    } finally {
      setExportingExcel(false);
    }
  }

  async function handleApprove() {
    setPaying(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem, sid }),
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
      {selectedItem && <ExplainPopup item={selectedItem} solutionContext={solutionContext} fullSolution={solution} onEdit={handleSolutionEdit} onClose={() => setSelectedItem(null)} />}
      {showActivity && <ActivityModal activity={activity} focusUrl={activityFocus} onClose={() => { setShowActivity(false); setActivityFocus(null); }} />}

      {/* Floating "Ask AI" button on text selection */}
      {askBtn && (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { pick(askBtn.text, "Selected text"); setAskBtn(null); window.getSelection()?.removeAllRanges(); }}
          style={{ position: "absolute", top: askBtn.top, left: askBtn.left, transform: "translateX(-50%)" }}
          className="z-40 flex items-center gap-1.5 bg-white text-black text-xs font-semibold rounded-full px-3 py-1.5 shadow-xl shadow-black/40 hover:bg-white/90 transition-all animate-in fade-in"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Ask AI
        </button>
      )}

      <div ref={contentRef} className="max-w-5xl mx-auto px-6 py-12">

        {/* Top nav */}
        <div className="flex flex-wrap items-center justify-between gap-y-3 mb-8">
          <div className="flex items-center gap-5">
            <a href="/" className="text-white/40 text-sm hover:text-white/70 transition-colors flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> New solution</a>
            <a href="/history" className="text-white/40 text-sm hover:text-white/70 transition-colors flex items-center gap-1.5"><History className="w-4 h-4" /> My solutions</a>
          </div>
          <div className="flex gap-2">
            <button onClick={handleEmailMe} disabled={emailing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm border border-white/15 text-white/60 hover:text-white hover:border-white/30 disabled:opacity-50 transition-all">
              <Mail className="w-3.5 h-3.5" /> {emailing ? "Preparing..." : "Email me"}
            </button>
            <button onClick={handleShare} disabled={sharing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm border border-white/15 text-white/60 hover:text-white hover:border-white/30 disabled:opacity-50 transition-all">
              {sharing ? "Saving..." : shareUrl ? "Link copied!" : "Share"}
            </button>
            <button onClick={handleExportExcel} disabled={exportingExcel}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm border border-white/15 text-white/60 hover:text-white hover:border-white/30 disabled:opacity-50 transition-all">
              {!unlocked && <Lock className="w-3.5 h-3.5" />}
              {exportingExcel ? "Building..." : "Download Tracker (Excel)"}
            </button>
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-50 transition-all">
              {!unlocked && <Lock className="w-3.5 h-3.5" />}
              {exporting ? "Exporting..." : "Export PDF"}
            </button>
          </div>
        </div>

        {/* Context badges */}
        {context && (
          <div className="flex flex-wrap gap-2 mb-8">
            {refinedWith && (
              <span data-refinedwith className="text-xs bg-emerald-500/10 border border-emerald-500/40 rounded-full px-3 py-1 text-emerald-300 font-medium">
                🔄 Updated: {refinedWith}
              </span>
            )}
            {context.preferCloud && (
              <span data-cloudbadge className="text-xs bg-blue-500/10 border border-blue-500/40 rounded-full px-3 py-1 text-blue-300 font-medium">
                ⚡ Optimized for your {context.preferCloud} environment
              </span>
            )}
            {[context.industry, context.size, context.team, context.seats ? `${context.seats} seats` : "", context.stack, context.budget, context.timeline, context.techLevel, context.compliance]
              .filter((v) => v && v !== "Not specified" && v !== "Not provided")
              .map((v, i) => (
                <span key={i} className="text-xs bg-white/8 border border-white/15 rounded-full px-3 py-1 text-white/50">{v}</span>
              ))}
          </div>
        )}

        {/* Refine box — "something changed?" One input, smart routing: small
            tweaks patch in place, scenario changes trigger a full fresh report. */}
        <div data-refine className="mb-8 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
          <label className="flex items-center gap-2 text-sm text-white/70 mb-2">
            <Wand2 className="w-4 h-4 text-blue-400" />
            Something changed, or forgot to mention something? Tell us and we&apos;ll update the plan.
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={refineText}
              onChange={(e) => { setRefineText(e.target.value); setRefineError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleRefine(); }}
              disabled={refining}
              placeholder="e.g. we confirmed the AWS migration · budget is now $5k/mo · we need HIPAA"
              className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 disabled:opacity-50"
            />
            <button
              onClick={handleRefine}
              disabled={refining || !refineText.trim()}
              className="bg-white text-black font-semibold rounded-xl px-5 py-2.5 text-sm hover:bg-white/90 disabled:opacity-40 transition-all whitespace-nowrap">
              {refining ? "Updating..." : "Update plan"}
            </button>
          </div>
          {refineText.trim() && !refining && (
            <p className="text-white/35 text-xs mt-2">
              {classifyRefine(refineText) === "regenerate"
                ? "This looks like a scenario change — we'll re-research and rebuild the plan (~1 min). Your current version stays in history."
                : "Small tweak — we'll update this in place in a few seconds."}
            </p>
          )}
          {refineError && <p className="text-red-400/80 text-xs mt-2">{refineError}</p>}
        </div>

        {shareMsg && (
          <div data-sharetoast className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-blue-500 text-white text-sm font-medium rounded-xl px-5 py-3 shadow-xl max-w-[90vw]">
            {shareMsg}
          </div>
        )}

        {askSel && (
          <button
            type="button"
            data-askai
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { pick(askSel.text.slice(0, 300), "Selected text"); setAskSel(null); window.getSelection()?.removeAllRanges(); }}
            style={{ left: askSel.x, top: Math.max(askSel.y - 40, 8) }}
            className="fixed z-50 -translate-x-1/2 flex items-center gap-1.5 bg-blue-500 hover:bg-blue-400 text-white text-xs font-semibold rounded-full px-3.5 py-2 shadow-lg transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" /> Ask AI
          </button>
        )}

        {/* Remix — one-click re-plans via the edit endpoint */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <span className="text-white/35 text-xs uppercase tracking-wider mr-1 flex items-center gap-1.5"><Wand2 className="w-3.5 h-3.5" /> Remix</span>
          {REMIXES.map((r) => (
            <button key={r.key} onClick={() => handleRemix(r)} disabled={!!remixing}
              className="px-3.5 py-1.5 rounded-full text-sm border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:border-blue-400 hover:bg-blue-500/20 hover:text-blue-200 disabled:opacity-40 transition-all">
              {remixing === r.key ? (
                <span className="flex items-center gap-2"><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Reworking…</span>
              ) : r.label}
            </button>
          ))}
          {techSwapOpen ? (
            <span className="flex items-center gap-2">
              <input
                autoFocus
                value={techSwapText}
                onChange={(e) => setTechSwapText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && techSwapText.trim()) { handleSwap("the current technology choices", `Build the implementation plan around ${techSwapText.trim()}`); setTechSwapOpen(false); } }}
                placeholder="e.g. Power Automate, n8n, Salesforce Flow…"
                className="bg-white/5 border border-white/15 rounded-full px-3.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 w-64 max-w-[70vw]"
              />
              <button onClick={() => { if (techSwapText.trim()) { handleSwap("the current technology choices", `Build the implementation plan around ${techSwapText.trim()}`); setTechSwapOpen(false); } }}
                disabled={!techSwapText.trim() || !!remixing}
                className="px-3.5 py-1.5 rounded-full text-sm bg-blue-500 hover:bg-blue-400 disabled:opacity-40 text-white font-medium transition-colors">
                {remixing === "swap:the current technology choices" ? "Reworking…" : "Rebuild"}
              </button>
              <button onClick={() => setTechSwapOpen(false)} className="text-white/40 hover:text-white/70 text-xs transition-colors">✕</button>
            </span>
          ) : (
            <button onClick={() => { setTechSwapOpen(true); setTechSwapText(""); }} disabled={!!remixing}
              className="px-3.5 py-1.5 rounded-full text-sm border border-dashed border-blue-500/40 text-blue-400/80 hover:border-blue-400 hover:text-blue-300 disabled:opacity-40 transition-all">
              Use a specific tech…
            </button>
          )}
        </div>

        {/* Problem */}
        <div className="mb-6">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Your problem</p>
          <p className="text-white/70 italic border-l-2 border-white/20 pl-4 break-words">{problem}</p>
        </div>

        {/* Title + insight + summary */}
        <h1 className="text-3xl sm:text-4xl font-bold mb-4 break-words">{solution.title}</h1>
        {solution.insight && (
          <div className="flex gap-3 bg-white/5 border border-white/15 rounded-xl px-5 py-4 mb-6 max-w-3xl">
            <Lightbulb className="w-5 h-5 text-yellow-400/70 shrink-0" />
            <p className="text-white/80 text-sm leading-relaxed italic">{solution.insight} <SourcePills url={solution.insightSourceUrl} urls={solution.insightSourceUrls} quote={solution.insightSourceQuote} /></p>
          </div>
        )}
        <p className="text-white/60 text-lg mb-6 max-w-3xl break-words">{solution.summary}</p>

        {/* Cost of inaction — the line that gets budget approved */}
        {solution.costOfInaction && (
          <div data-cost-of-inaction className="mb-10 max-w-3xl bg-red-500/[0.06] border border-red-500/25 rounded-2xl px-5 py-4">
            <p className="text-red-400/90 text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> What doing nothing costs you
            </p>
            <p className="text-white text-2xl font-bold mb-1">{solution.costOfInaction.annualCost}</p>
            <p className="text-white/50 text-sm mb-2">{solution.costOfInaction.basis}</p>
            {solution.costOfInaction.paybackPeriod && (
              <p className="text-white/70 text-sm">
                vs. this plan: <span className="text-white font-semibold">{solution.tco?.firstYearTotal ?? solution.estimatedCost}</span> first year
                → pays for itself in <span className="text-emerald-400 font-semibold">{solution.costOfInaction.paybackPeriod}</span>
              </p>
            )}
          </div>
        )}

        {/* Executive Summary */}
        <div className="mb-12 bg-gradient-to-br from-white/5 to-white/2 border border-white/15 rounded-2xl p-6">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-4">Executive Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Est. Monthly Cost", value: solution.estimatedCost },
              { label: "First-Year Total", value: solution.tco?.firstYearTotal ?? `${solution.tools.length} tools` },
              { label: "Time to Implement", value: solution.timeToImplement },
              { label: "Implementation Phases", value: `${solution.phases.length} phases` },
            ].map((m) => (
              <MetricBox key={m.label} label={m.label} value={m.value} />
            ))}
          </div>
        </div>

        {/* Assumptions — the AI's honest guesses, each fixable */}
        {solution.assumptions && solution.assumptions.length > 0 && (
          <div className="mb-12 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-5">
            <p className="text-yellow-400/80 text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> We assumed — correct anything that&apos;s off
            </p>
            <ul className="mt-3 space-y-2">
              {solution.assumptions.map((a, i) => (
                <li key={i}>
                  <button onClick={() => pick(a, "Assumption")}
                    className="w-full text-left flex items-start gap-2 text-sm text-white/65 hover:text-white transition-colors group">
                    <span className="text-yellow-500/50 shrink-0 mt-0.5">•</span>
                    <span>{a}</span>
                    <span className="ml-auto shrink-0 text-xs text-white/25 group-hover:text-white/60 transition-colors flex items-center gap-1"><Wand2 className="w-3 h-3" /> fix</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Before you start — decisions to settle before day 1 */}
        {solution.beforeYouStart && solution.beforeYouStart.length > 0 && (
          <div data-beforeyoustart className="mb-12 bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5">
            <p className="text-blue-400/80 text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" /> Settle these before you start
            </p>
            <ul className="mt-3 space-y-2">
              {solution.beforeYouStart.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/65">
                  <span className="text-blue-400/60 shrink-0 mt-0.5 font-semibold">{i + 1}.</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Unlock banner — the implementation kit sits behind the $1 */}
        {!unlocked && (
          <div className="mb-12 border border-white/20 bg-gradient-to-br from-white/8 to-white/3 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                <Lock className="w-4.5 h-4.5 text-white/70" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold mb-1">Unlock the full implementation kit — $1</h2>
                <p className="text-white/50 text-sm mb-4">The preview above is free. Paying once unlocks the parts you&apos;ll actually execute with:</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-white/65 mb-5">
                  {[
                    "Total Cost of Ownership breakdown",
                    "Internal rollout playbook + tickets to file",
                    "Approvals, IT controls & risk assessment",
                    "Vendor outreach kit with ready-to-send email",
                    "PDF export of the complete report",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-white/40 shrink-0" />{f}</li>
                  ))}
                </ul>
                <button onClick={handleApprove} disabled={paying}
                  className="bg-white text-black font-semibold rounded-xl px-6 py-2.5 text-sm hover:bg-white/90 disabled:opacity-50 transition-all">
                  {paying ? "Redirecting…" : "Unlock for $1"}
                </button>
                <span className="text-white/30 text-xs ml-3">One-time. No subscription.</span>
              </div>
            </div>
          </div>
        )}

        {/* Total Cost of Ownership */}
        {unlocked && solution.tco && (solution.tco.lineItems?.length || solution.tco.firstYearTotal) && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-1">Total Cost of Ownership</h2>
            <p className="text-white/40 text-sm mb-4">The real number — setup, recurring, and the costs most teams forget.</p>
            <div className="bg-white/3 border border-white/10 rounded-2xl p-5">
              {solution.tco.lineItems && solution.tco.lineItems.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-white/10 mb-5">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="bg-white/5 text-white/40 text-xs uppercase tracking-wider">
                        <th className="text-left font-medium px-4 py-2.5">Item</th>
                        <th className="text-left font-medium px-4 py-2.5">Type</th>
                        <th className="text-right font-medium px-4 py-2.5">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {solution.tco.lineItems.map((li, i) => (
                        <tr key={i} className="border-t border-white/8">
                          <td className="px-4 py-2.5 text-white/80">{li.item} <SourcePill url={li.sourceUrl} quote={li.sourceQuote} /></td>
                          <td className="px-4 py-2.5 text-white/45">{li.type}</td>
                          <td className="px-4 py-2.5 text-white/80 text-right tabular-nums">{li.cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${solution.tco.yearTwoRunRate ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3`}>
                {[
                  { label: "CAPEX — one-time setup", value: solution.tco.oneTimeSetup },
                  { label: "OPEX — monthly recurring", value: solution.tco.monthlyRecurring },
                  { label: "First-year total", value: solution.tco.firstYearTotal, highlight: true },
                  { label: "Year-2 run rate", value: solution.tco.yearTwoRunRate },
                ].filter((m) => m.value).map((m) => (
                  <div key={m.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <p className="text-white/40 text-xs mb-1">{m.label}</p>
                    <p className={`font-bold text-base ${m.highlight ? "text-blue-400" : "text-white"}`}>{m.value}</p>
                  </div>
                ))}
              </div>
              {solution.tco.hiddenCosts && solution.tco.hiddenCosts.length > 0 && (
                <div className="mt-4 border-t border-white/10 pt-3">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Hidden costs to budget for</p>
                  <ul className="space-y-1">
                    {solution.tco.hiddenCosts.map((c, i) => (
                      <li key={i} className="flex gap-2 text-sm text-white/60"><AlertTriangle className="w-4 h-4 text-yellow-500/70 shrink-0 mt-0.5" /><span>{c}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* End-to-end journey map — the whole solution in one picture */}
        {solution.phases && solution.phases.length > 0 && (
          <div data-journey className="mb-12">
            <h2 className="text-xl font-semibold mb-1">Rollout Timeline</h2>
            <JourneyMap solution={solution} problem={problem} context={context ?? undefined} />
          </div>
        )}

        {/* System Architecture — how the systems actually connect. Only shows
            when the synthesis produced environment/dataFlow data; older
            reports generated before this schema addition simply won't have it. */}
        {hasArchitectureData(solution) && (
          <div data-architecture className="mb-12">
            <h2 className="text-xl font-semibold mb-1">System Architecture</h2>
            <ArchitectureMap solution={solution} />
          </div>
        )}

        {/* Operations — monitoring & scale. Rendered independently of the
            architecture diagram so it survives when env/dataFlow is absent. */}
        {solution.operations && ((solution.operations.monitoring?.length ?? 0) > 0 || solution.operations.scalability) && (
          <div data-operations className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-3">
            {solution.operations.monitoring && solution.operations.monitoring.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-white/40 text-xs uppercase tracking-wider mb-2">📟 How you&apos;ll know it&apos;s working</p>
                <ul className="space-y-1.5">
                  {solution.operations.monitoring.map((m, i) => (
                    <li key={i} className="flex gap-2 text-sm text-white/60"><CheckCircle2 className="w-4 h-4 text-emerald-400/70 shrink-0 mt-0.5" /><span>{m}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {solution.operations.scalability && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-white/40 text-xs uppercase tracking-wider mb-2">📈 What happens at 10x scale</p>
                <p className="text-sm text-white/60">{solution.operations.scalability}</p>
              </div>
            )}
          </div>
        )}

        {/* Team & skills — the first real user question: who builds this? */}
        {solution.teamRequired && solution.teamRequired.length > 0 && (
          <div data-team className="mb-12">
            <h2 className="text-xl font-semibold mb-1">Team & Skills Required</h2>
            <p className="text-white/40 text-sm mb-4">Who you need to build this — and who keeps it running after go-live.</p>
            {solution.staffingSummary && (
              <div data-staffing-summary className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs bg-blue-500/10 border border-blue-500/30 rounded-full px-3 py-1.5 text-blue-300 font-medium">
                  🔨 Build: {solution.staffingSummary.buildFte}
                </span>
                {solution.staffingSummary.runFte && (
                  <span className="text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1.5 text-emerald-300 font-medium">
                    ⚙️ Run: {solution.staffingSummary.runFte}
                  </span>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {solution.teamRequired.map((r, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-semibold text-white text-sm">{r.role}</span>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
                      r.staffing === "contractor" ? "border-amber-500/40 text-amber-400/90"
                      : r.staffing === "upskill" ? "border-blue-500/40 text-blue-400/90"
                      : "border-emerald-500/30 text-emerald-400/80"}`}>
                      {r.staffing === "contractor" ? "Hire / contractor" : r.staffing === "upskill" ? "Upskill your team" : "Your team covers it"}
                    </span>
                  </div>
                  {r.skills && r.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {r.skills.map((sk, j) => (
                        <span key={j} className="text-[11px] bg-white/[0.06] border border-white/10 rounded-full px-2 py-0.5 text-white/55">{sk}</span>
                      ))}
                    </div>
                  )}
                  <p className="text-white/45 text-xs">
                    {[r.commitment, r.phases].filter(Boolean).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Candidates evaluated — the rejected options build trust in the picks */}
        {solution.evaluated && solution.evaluated.length > 0 && (
          <div data-evaluated className="mb-12">
            <h2 className="text-xl font-semibold mb-1">Solutions Evaluated</h2>
            <p className="text-white/40 text-sm mb-4">{solution.evaluated.length} real candidates assessed against your stack, budget, and team — here&apos;s why each won or lost.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {solution.evaluated.map((c, i) => (
                <div key={i} className={`rounded-xl border px-4 py-3 ${c.verdict === "chosen" ? "border-blue-500/30 bg-blue-500/5" : "border-white/10 bg-white/3"}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    {c.verdict === "chosen"
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      : <Circle className="w-3.5 h-3.5 text-white/25 shrink-0" />}
                    <span className="text-sm font-medium text-white">{c.name}</span>
                    <span className={`ml-auto text-[10px] uppercase tracking-wider ${c.verdict === "chosen" ? "text-blue-400" : "text-white/30"}`}>{c.verdict}</span>
                  </div>
                  <p className="text-white/50 text-xs">{c.reason} <SourcePill url={c.sourceUrl} /></p>
                  {c.verdict !== "chosen" && (
                    <button onClick={() => handleSwap("the currently chosen tools it lost to", `Use ${c.name} as the primary solution instead`)}
                      disabled={!!remixing}
                      className="mt-1.5 text-[11px] text-blue-400/80 hover:text-blue-300 disabled:opacity-40 transition-colors">
                      {remixing === "swap:the currently chosen tools it lost to" ? "Rebuilding…" : `Try ${c.name} instead →`}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Case studies — real orgs that solved this; only grounded, sourced
            examples survive the normalizer, so this section self-hides when
            the research produced nothing usable. */}
        {solution.caseStudies && solution.caseStudies.length > 0 && (
          <div data-casestudies className="mb-12">
            <h2 className="text-xl font-semibold mb-1">Who Else Has Done This</h2>
            <p className="text-white/40 text-sm mb-4">Real implementations from the research — what they did, what happened, and what to steal.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {solution.caseStudies.map((cs, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white text-sm">{cs.org}</span>
                    <SourcePill url={cs.sourceUrl} />
                  </div>
                  <p className="text-white/55 text-xs"><span className="text-white/35 uppercase tracking-wider text-[10px]">Problem</span><br />{cs.problem}</p>
                  <p className="text-white/55 text-xs"><span className="text-white/35 uppercase tracking-wider text-[10px]">Approach</span><br />{cs.approach}</p>
                  <p className="text-emerald-300/80 text-xs"><span className="text-white/35 uppercase tracking-wider text-[10px]">Outcome</span><br />{cs.outcome}</p>
                  <p className="text-blue-300/80 text-xs mt-auto border-t border-white/10 pt-2"><span className="text-white/35 uppercase tracking-wider text-[10px]">Lesson for you</span><br />{cs.lesson}</p>
                </div>
              ))}
            </div>
          </div>
        )}

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
                      <span className="font-semibold text-white flex items-center gap-2 break-all min-w-0">
                        {tool.name}
                        {safeHttpUrl(tool.sourceUrl) && (
                          <a href={safeHttpUrl(tool.sourceUrl)!} target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()} title={`Source: ${faviconDomain(tool.sourceUrl!)}`}
                            className="opacity-60 hover:opacity-100 transition-opacity">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`https://www.google.com/s2/favicons?domain=${faviconDomain(tool.sourceUrl!)}&sz=64`} alt="source" width={14} height={14} className="w-3.5 h-3.5 rounded" />
                          </a>
                        )}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${colorClass}`}>{tool.category}</span>
                    </div>
                    <p className="text-white/50 text-sm">{tool.purpose}</p>
                    {tool.whyForYou && (
                      <div className="border-t border-white/8 pt-2">
                        <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Why for you</p>
                        <p className="text-white/70 text-sm">{tool.whyForYou}</p>
                      </div>
                    )}
                    {tool.lockIn && (
                      <p className={`text-xs flex items-start gap-1.5 pt-1 ${
                        tool.lockIn.level === "high" ? "text-red-400/80" : tool.lockIn.level === "medium" ? "text-amber-400/80" : "text-emerald-400/80"
                      }`}>
                        <span className="shrink-0">{tool.lockIn.level === "high" ? "🔐" : tool.lockIn.level === "medium" ? "🔒" : "🔓"}</span>
                        <span>Exit difficulty: {tool.lockIn.level.toUpperCase()} — {tool.lockIn.reason}</span>
                      </p>
                    )}
                    <p className="text-xs text-white/25 group-hover:text-white/50 transition-colors pt-1 flex items-center gap-1">Click to learn more <ArrowRight className="w-3 h-3" /></p>
                  </button>
                  {/* Swap this tool for something else — one box, full re-plan */}
                  <div className="border-t border-white/8">
                    {swapTool === i ? (
                      <div className="p-3 space-y-2">
                        <input
                          autoFocus
                          value={swapText}
                          onChange={(e) => setSwapText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && swapText.trim()) handleSwap(tool.name, swapText.trim()); }}
                          placeholder={`e.g. Use Zapier instead — we already pay for it`}
                          className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => swapText.trim() && handleSwap(tool.name, swapText.trim())}
                            disabled={!swapText.trim() || !!remixing}
                            className="flex-1 bg-blue-500 hover:bg-blue-400 disabled:opacity-40 text-white text-xs font-semibold rounded-lg py-2 transition-colors">
                            {remixing === `swap:${tool.name}` ? "Rebuilding the plan…" : "Rebuild plan with this"}
                          </button>
                          <button onClick={() => { setSwapTool(null); setSwapText(""); }}
                            className="text-white/40 hover:text-white/70 text-xs px-3 transition-colors">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setSwapTool(i); setSwapText(""); }}
                        className="w-full text-left px-4 py-2.5 text-xs text-white/40 hover:text-white/70 transition-colors flex items-center gap-1.5">
                        <Wand2 className="w-3 h-3" /> Swap this tool — use something else instead
                      </button>
                    )}
                  </div>
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

        {/* Alternative — Option B */}
        {solution.alternative && solution.alternative.name && (
          <div className="mb-12">
            <div className="bg-white/3 border border-dashed border-white/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 rounded-full border border-white/20 text-white/50">Alternative</span>
                <h2 className="text-lg font-semibold">{solution.alternative.name}</h2>
              </div>
              <p className="text-white/60 text-sm mb-3">{solution.alternative.summary}</p>
              {solution.alternative.tools && solution.alternative.tools.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {solution.alternative.tools.map((t, i) => (
                    <span key={i} className="text-xs bg-white/8 border border-white/15 rounded-full px-3 py-1 text-white/60">{t}</span>
                  ))}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3 text-sm">
                {solution.alternative.estimatedCost && (
                  <div className="flex-1"><span className="text-white/40 text-xs uppercase tracking-wider">Cost</span><p className="text-white/70">{solution.alternative.estimatedCost}</p></div>
                )}
                {solution.alternative.tradeoff && (
                  <div className="flex-1"><span className="text-white/40 text-xs uppercase tracking-wider">Tradeoff</span><p className="text-white/70">{solution.alternative.tradeoff}</p></div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Implementation phases with per-phase flowcharts */}
        {solution.phases && solution.phases.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-6">How to implement</h2>
            <div className="space-y-6">
              {solution.phases.map((phase, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/8">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-white/15 text-white text-xs flex items-center justify-center font-semibold shrink-0">{i + 1}</span>
                      <h3 className="font-semibold text-white">{phase.title}</h3>
                    </div>
                    {phase.objective && <p className="text-white/50 text-sm mt-2 ml-10">{phase.objective}</p>}
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
                      {phase.exitCriteria && phase.exitCriteria.length > 0 && (
                        <div className="mt-4 border-t border-white/8 pt-3">
                          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Done when</p>
                          <ul className="space-y-1.5">
                            {phase.exitCriteria.map((c, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm text-white/60">
                                <CheckCircle2 className="w-3.5 h-3.5 text-white/30 shrink-0 mt-0.5" />
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
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

        {/* Success Metrics / KPIs */}
        {solution.kpis && solution.kpis.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-semibold">Success Metrics</h2>
              <button onClick={() => downloadKpiCsv(solution.kpis!, solution.title)}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors">
                <FileDown className="w-3.5 h-3.5" /> Download CSV
              </button>
            </div>
            <p className="text-white/40 text-sm mb-4">How you&apos;ll know it worked — measurable, with a baseline and a deadline.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {solution.kpis.map((k, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-white font-medium text-sm mb-2">{k.metric}</p>
                  <div className="flex items-center gap-2 text-sm">
                    {k.baseline && <span className="text-white/40 line-through">{k.baseline}</span>}
                    {k.baseline && <ArrowRight className="w-3.5 h-3.5 text-white/30 shrink-0" />}
                    <span className="text-blue-400 font-semibold">{k.target}</span>
                  </div>
                  {k.timeframe && <p className="text-white/35 text-xs mt-2 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> {k.timeframe}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Adoption Plan */}
        {solution.adoptionPlan && solution.adoptionPlan.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-1">Adoption Plan</h2>
            <p className="text-white/40 text-sm mb-4">Stop it becoming shelfware — how to get your team actually using it.</p>
            <div className="space-y-2">
              {solution.adoptionPlan.map((a, i) => (
                <div key={i} className="flex gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                  <span className="w-6 h-6 rounded-full bg-white/15 text-white text-xs flex items-center justify-center font-semibold shrink-0">{i + 1}</span>
                  <div>
                    <p className="text-white text-sm font-medium">{a.title}</p>
                    <p className="text-white/55 text-sm mt-0.5">{a.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Internal Rollout Playbook */}
        {unlocked && solution.rolloutPlaybook && (
          (solution.rolloutPlaybook.stakeholders?.length || solution.rolloutPlaybook.tickets?.length) ? (
            <div className="mb-12">
              <h2 className="text-xl font-semibold mb-1">Internal Rollout Playbook</h2>
              <p className="text-white/40 text-sm mb-4">Who to loop in and what to file to get this approved inside your company.</p>

              {solution.rolloutPlaybook.stakeholders && solution.rolloutPlaybook.stakeholders.length > 0 && (
                <div className="mb-4">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Who to involve</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {solution.rolloutPlaybook.stakeholders.map((s, i) => (
                      <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-white text-sm">{s.role}</span>
                          {s.team && <span className="text-xs px-2 py-0.5 rounded-full border border-white/20 text-white/50 shrink-0">{s.team}</span>}
                        </div>
                        <p className="text-white/60 text-sm">{s.responsibility}</p>
                        {s.whenToContact && <p className="text-white/35 text-xs mt-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {s.whenToContact}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {solution.rolloutPlaybook.tickets && solution.rolloutPlaybook.tickets.length > 0 && (
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Tickets to file</p>
                  <div className="space-y-2">
                    {solution.rolloutPlaybook.tickets.map((t, i) => (
                      <div key={i} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                        <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0 mt-0.5">{t.system}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm font-medium">{t.title}</p>
                          <p className="text-white/45 text-xs mt-0.5 flex items-center gap-1">{t.type}{t.assignTo && <><span className="text-white/25">·</span><ArrowRight className="w-3 h-3" />{t.assignTo}</>}</p>
                        </div>
                        <button
                          onClick={() => { navigator.clipboard.writeText(ticketText(t, problem)); setCopiedTicket(i); setTimeout(() => setCopiedTicket(null), 1500); }}
                          title="Copy ticket — paste into Jira/ServiceNow"
                          className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/80 transition-colors shrink-0 mt-0.5">
                          {copiedTicket === i ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy ticket</>}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null
        )}

        {/* Approvals & Red Tape */}
        {unlocked && solution.approvals && (
          (solution.approvals.permissions?.length || solution.approvals.itControls?.length || solution.approvals.riskAssessment?.length) ? (
            <div className="mb-12">
              <h2 className="text-xl font-semibold mb-1">Approvals & IT Red Tape</h2>
              <p className="text-white/40 text-sm mb-4">Permissions, IT controls, and the risk review you&apos;ll need to clear.</p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {solution.approvals.permissions && solution.approvals.permissions.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Permissions to secure</p>
                    <ul className="space-y-3">
                      {solution.approvals.permissions.map((p, i) => (
                        <li key={i} className="text-sm">
                          <p className="text-white font-medium">{p.name}</p>
                          <p className="text-white/50 text-xs mt-0.5">{p.why}{p.owner ? ` · Owner: ${p.owner}` : ""}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {solution.approvals.itControls && solution.approvals.itControls.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-3">IT controls (Netskope, IP allow-list, SSO…)</p>
                    <ul className="space-y-3">
                      {solution.approvals.itControls.map((c, i) => (
                        <li key={i} className="text-sm">
                          <p className="text-white font-medium">{c.name}</p>
                          <p className="text-white/50 text-xs mt-0.5">{c.action}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {solution.approvals.riskAssessment && solution.approvals.riskAssessment.length > 0 && (
                <div className="mt-4">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Risk assessment</p>
                  <div className="space-y-2">
                    {solution.approvals.riskAssessment.map((r, i) => {
                      const sev = (r.severity || "").toLowerCase();
                      const sevClass = sev.includes("high") ? "bg-red-500/20 text-red-300 border-red-500/30"
                        : sev.includes("med") ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                        : "bg-green-500/20 text-green-300 border-green-500/30";
                      return (
                        <div key={i} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${sevClass}`}>{r.severity || "—"}</span>
                          <div>
                            <p className="text-white text-sm">{r.risk}</p>
                            <p className="text-white/50 text-xs mt-1"><span className="text-white/35">Mitigation:</span> {r.mitigation}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : null
        )}

        {/* Vendor Outreach Kit */}
        {unlocked && solution.vendorOutreach && (solution.vendorOutreach.howToReach || solution.vendorOutreach.email || solution.vendorOutreach.demoChecklist?.length) && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-1">Vendor Outreach Kit</h2>
            <p className="text-white/40 text-sm mb-4">How to reach the vendor and what to pin down before you buy.</p>

            {solution.vendorOutreach.howToReach && (
              <p className="text-white/60 text-sm mb-4">{solution.vendorOutreach.howToReach}</p>
            )}

            {solution.vendorOutreach.email && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white/40 text-xs uppercase tracking-wider">Ready-to-send intro email</p>
                  <div className="flex items-center gap-4">
                    <a href={mailtoFromEmail(solution.vendorOutreach.email)}
                      className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors">
                      <Mail className="w-3.5 h-3.5" /> Open in email app
                    </a>
                    <button onClick={() => navigator.clipboard.writeText(solution.vendorOutreach!.email!)}
                      className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors">
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                  </div>
                </div>
                <pre className="text-white/70 text-sm whitespace-pre-wrap break-words font-sans leading-relaxed">{solution.vendorOutreach.email}</pre>
              </div>
            )}

            {solution.vendorOutreach.demoChecklist && solution.vendorOutreach.demoChecklist.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Demo-call checklist</p>
                <ul className="space-y-2">
                  {solution.vendorOutreach.demoChecklist.map((q, i) => (
                    <li key={i} className="flex gap-2 text-sm text-white/60">
                      <Square className="w-3.5 h-3.5 text-white/25 shrink-0 mt-0.5" /><span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* How AI built this */}
        <div className="mb-12 bg-white/3 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">How AI built this</h2>
            <div className="flex items-center gap-4">
              {activity.length > 0 && (
                <button onClick={() => { setActivityFocus(null); setShowActivity(true); }} className="text-xs text-white/40 hover:text-white/70 transition-colors">
                  View activity
                </button>
              )}
              {citations.length > 0 && (
                <button onClick={() => setShowSources(!showSources)} className="text-xs text-white/40 hover:text-white/70 transition-colors">
                  {showSources ? "Hide" : "Show"} {citations.length} sources
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-white/50 mb-3">
            {model && <span>Pipeline: <span className="text-white/70">{model}</span></span>}
            {tokens && <span>Tokens used: <span className="text-white/70">{tokens.toLocaleString()}</span></span>}
          </div>
          {showSources && citations.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-white/10 pt-3">
              {citations.map((url, i) => {
                let host = url;
                try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep raw */ }
                const openTrace = () => { setActivityFocus(url); setShowActivity(true); };
                return (
                  <div key={i}
                    onClick={activity.length > 0 ? openTrace : undefined}
                    className={`group flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 hover:border-white/25 hover:bg-white/8 transition-all ${activity.length > 0 ? "cursor-pointer" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`} alt="" width={20} height={20}
                      className="w-5 h-5 rounded shrink-0 bg-white/10"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
                    <div className="min-w-0">
                      <p className="text-sm text-white/80 group-hover:text-white truncate flex items-center gap-2">
                        {host}
                        {sourceMeta[url] && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${
                            sourceMeta[url] === "community" ? "border-orange-500/40 text-orange-300/80"
                            : sourceMeta[url] === "docs" ? "border-blue-500/40 text-blue-300/80"
                            : "border-white/20 text-white/40"
                          }`}>{sourceMeta[url]}</span>
                        )}
                      </p>
                      <p className="text-xs text-white/35 truncate">{url.replace(/^https?:\/\//, "")}</p>
                    </div>
                    {activity.length > 0 && <span className="ml-auto text-white/25 group-hover:text-white/60 text-xs transition-colors shrink-0">trace</span>}
                    {safeHttpUrl(url) && (
                      <a href={safeHttpUrl(url)!} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        className="text-white/20 group-hover:text-white/50 transition-colors shrink-0" title="Open source"><ArrowUpRight className="w-4 h-4" /></a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ROI Calculator — an interactive extra, so it lives at the end
            instead of interrupting the report flow */}
        {solution.showHoursRoi !== false && (
          <div className="mb-8">
            <ROICalculator estimatedCost={solution.estimatedCost} />
          </div>
        )}

        {/* Feedback loop — judged at the moment of judgment */}
        <div data-feedback className="mb-8 border border-white/10 rounded-2xl p-5">
          {feedbackSent ? (
            <p className="text-white/60 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Thanks — this directly shapes what gets improved next.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <p className="text-white/70 text-sm font-medium">Did this report nail it?</p>
                <button onClick={() => setFeedback("up")}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${feedback === "up" ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "border-white/15 text-white/50 hover:text-white/80"}`}>👍</button>
                <button onClick={() => setFeedback("down")}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${feedback === "down" ? "border-red-500/50 bg-red-500/10 text-red-400" : "border-white/15 text-white/50 hover:text-white/80"}`}>👎</button>
              </div>
              {feedback && (
                <div className="flex gap-2">
                  <input
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") sendFeedback(feedback, feedbackComment.trim()); }}
                    placeholder={feedback === "down" ? "What was off — wrong tools, prices, missing detail?" : "What made it useful? (optional)"}
                    className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
                  />
                  <button onClick={() => sendFeedback(feedback, feedbackComment.trim())}
                    className="bg-white text-black text-sm font-semibold rounded-lg px-4 transition-all hover:bg-white/90">Send</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Approve / owned */}
        <div className="border border-white/10 rounded-2xl p-8 text-center">
          {unlocked ? (
            <>
              <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2"><CheckCircle2 className="w-6 h-6 text-emerald-400" /> {paidReal ? "You own this solution" : "Free during beta"}</h2>
              <p className="text-white/50 mb-6">The full report is unlocked — export it, share it, or find it later in My Solutions.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={handleExport} disabled={exporting}
                  className="bg-white text-black font-semibold rounded-xl px-8 py-3 hover:bg-white/90 disabled:opacity-50 transition-all">
                  {exporting ? "Exporting..." : "Export PDF"}
                </button>
                <button onClick={handleExportExcel} disabled={exportingExcel}
                  className="border border-white/20 text-white/80 font-semibold rounded-xl px-8 py-3 hover:border-white/40 hover:text-white disabled:opacity-50 transition-all">
                  {exportingExcel ? "Building..." : "Download Tracker (Excel)"}
                </button>
                <button onClick={() => router.push("/")}
                  className="border border-white/20 text-white/60 font-medium rounded-xl px-8 py-3 hover:border-white/40 hover:text-white/80 transition-all">
                  Generate another solution
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-2">Happy with this solution?</h2>
              <p className="text-white/50 mb-6">Pay $1 to unlock the full implementation kit and PDF export. No subscription.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={handleApprove} disabled={paying}
                  className="bg-white text-black font-semibold rounded-xl px-8 py-3 hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  {paying ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Redirecting...</span> : "Unlock for $1"}
                </button>
                <button onClick={() => router.push("/")}
                  className="border border-white/20 text-white/60 font-medium rounded-xl px-8 py-3 hover:border-white/40 hover:text-white/80 transition-all">
                  Try a different problem
                </button>
              </div>
              <p className="text-white/30 text-xs mt-4">Your preview is auto-saved to My Solutions either way.</p>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
