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

interface Tool {
  name: string; purpose: string; category: string;
  whyForYou: string; vendorQuestions?: string[];
}
interface FlowNode { id: string; label: string; type: string; }
interface FlowEdge { from: string; to: string; label?: string; }
interface Phase { title: string; actions: string[]; nodes?: FlowNode[]; edges?: FlowEdge[]; }
interface Stakeholder { role: string; team: string; responsibility: string; whenToContact: string; }
interface Ticket { system: string; type: string; title: string; assignTo: string; }
interface Permission { name: string; owner: string; why: string; }
interface ITControl { name: string; action: string; }
interface Risk { risk: string; severity: string; mitigation: string; }
interface RolloutPlaybook { stakeholders?: Stakeholder[]; tickets?: Ticket[]; }
interface Approvals { permissions?: Permission[]; itControls?: ITControl[]; riskAssessment?: Risk[]; }
interface VendorOutreach { howToReach?: string; email?: string; demoChecklist?: string[]; }
interface TcoLineItem { item: string; type: string; cost: string; }
interface Tco { lineItems?: TcoLineItem[]; oneTimeSetup?: string; monthlyRecurring?: string; firstYearTotal?: string; hiddenCosts?: string[]; }
interface Kpi { metric: string; baseline?: string; target: string; timeframe?: string; }
interface AdoptionStep { title: string; detail: string; }
interface Alternative { name: string; summary: string; tools?: string[]; estimatedCost?: string; tradeoff?: string; }
interface Solution {
  title: string; insight?: string; summary: string; tools: Tool[];
  phases: Phase[]; estimatedCost: string; timeToImplement: string;
  rolloutPlaybook?: RolloutPlaybook; approvals?: Approvals; vendorOutreach?: VendorOutreach;
  tco?: Tco; kpis?: Kpi[]; adoptionPlan?: AdoptionStep[]; alternative?: Alternative;
}
interface Context {
  size: string; stack: string; budget: string; timeline: string;
  industry?: string; team?: string; seats?: string; techLevel?: string; compliance?: string;
}
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
              <p className={`text-lg font-bold ${m.highlight ? "text-emerald-400" : "text-white"}`}>{m.value}</p>
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
                {a.url
                  ? <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-blue-300/90 hover:text-blue-200 leading-snug break-all">{a.text}</a>
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
  const [exporting, setExporting] = useState(false);
  const [roiData, setRoiData] = useState<{ weeklyHours: number; teamSize: number; hourlyRate: number } | null>(null);
  const [askBtn, setAskBtn] = useState<{ text: string; top: number; left: number } | null>(null);
  const [sid, setSid] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [copiedTicket, setCopiedTicket] = useState<number | null>(null);
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
    setActivity(data.activity ?? []);
    setSid(data.sid ?? null);
    setUnlocked(Boolean(data.paid) || isPaid(data.sid));
    if (data.solution?.title) document.title = `${data.solution.title} — ERPHigh`;
    setModel(data.model ?? "");
    setTokens(data.tokens ?? null);
  }, [router]);

  const solutionContext = solution
    ? `Title: ${solution.title}\nSummary: ${solution.summary}\nTools: ${solution.tools.map((t) => t.name).join(", ")}\nCost: ${solution.estimatedCost}\nTimeline: ${solution.timeToImplement}`
    : "";

  function pick(label: string, itemType: string) { setSelectedItem({ label, itemType }); }

  function handleSolutionEdit(updated: Solution) {
    setSolution(updated);
    rawDataRef.current = { ...rawDataRef.current, solution: updated };
    try { sessionStorage.setItem("solution", JSON.stringify(rawDataRef.current)); } catch { /* ignore quota */ }
    if (sid) updateHistory(sid, { title: updated.title }, rawDataRef.current);
    setShareUrl(null); // invalidate any prior share link — content changed
  }

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
            <button onClick={handleShare} disabled={sharing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm border border-white/15 text-white/60 hover:text-white hover:border-white/30 disabled:opacity-50 transition-all">
              {sharing ? "Saving..." : shareUrl ? "Link copied!" : "Share"}
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
            {[context.industry, context.size, context.team, context.seats ? `${context.seats} seats` : "", context.stack, context.budget, context.timeline, context.techLevel, context.compliance]
              .filter((v) => v && v !== "Not specified" && v !== "Not provided")
              .map((v, i) => (
                <span key={i} className="text-xs bg-white/8 border border-white/15 rounded-full px-3 py-1 text-white/50">{v}</span>
              ))}
          </div>
        )}

        {/* Problem */}
        <div className="mb-6">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Your problem</p>
          <p className="text-white/70 italic border-l-2 border-white/20 pl-4">{problem}</p>
        </div>

        {/* Title + insight + summary */}
        <h1 className="text-3xl sm:text-4xl font-bold mb-4">{solution.title}</h1>
        {solution.insight && (
          <div className="flex gap-3 bg-white/5 border border-white/15 rounded-xl px-5 py-4 mb-6 max-w-3xl">
            <Lightbulb className="w-5 h-5 text-yellow-400/70 shrink-0" />
            <p className="text-white/80 text-sm leading-relaxed italic">{solution.insight}</p>
          </div>
        )}
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
                    <li key={f} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400/80 shrink-0" />{f}</li>
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
                          <td className="px-4 py-2.5 text-white/80">{li.item}</td>
                          <td className="px-4 py-2.5 text-white/45">{li.type}</td>
                          <td className="px-4 py-2.5 text-white/80 text-right tabular-nums">{li.cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: "One-time setup", value: solution.tco.oneTimeSetup },
                  { label: "Monthly recurring", value: solution.tco.monthlyRecurring },
                  { label: "First-year total", value: solution.tco.firstYearTotal, highlight: true },
                ].filter((m) => m.value).map((m) => (
                  <div key={m.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <p className="text-white/40 text-xs mb-1">{m.label}</p>
                    <p className={`font-bold text-base ${m.highlight ? "text-emerald-400" : "text-white"}`}>{m.value}</p>
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
                    <p className="text-xs text-white/25 group-hover:text-white/50 transition-colors pt-1 flex items-center gap-1">Click to learn more <ArrowRight className="w-3 h-3" /></p>
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
                    <span className="text-emerald-400 font-semibold">{k.target}</span>
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
                      <p className="text-sm text-white/80 group-hover:text-white truncate">{host}</p>
                      <p className="text-xs text-white/35 truncate">{url.replace(/^https?:\/\//, "")}</p>
                    </div>
                    {activity.length > 0 && <span className="ml-auto text-white/25 group-hover:text-white/60 text-xs transition-colors shrink-0">trace</span>}
                    <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                      className="text-white/20 group-hover:text-white/50 transition-colors shrink-0" title="Open source"><ArrowUpRight className="w-4 h-4" /></a>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Approve / owned */}
        <div className="border border-white/10 rounded-2xl p-8 text-center">
          {unlocked ? (
            <>
              <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2"><CheckCircle2 className="w-6 h-6 text-emerald-400" /> You own this solution</h2>
              <p className="text-white/50 mb-6">The full report is unlocked — export it, share it, or find it later in My Solutions.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={handleExport} disabled={exporting}
                  className="bg-white text-black font-semibold rounded-xl px-8 py-3 hover:bg-white/90 disabled:opacity-50 transition-all">
                  {exporting ? "Exporting..." : "Export PDF"}
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
