import { jsPDF } from "jspdf";
import Dagre from "@dagrejs/dagre";

interface FlowNode { id: string; label: string; type: string; }
interface FlowEdge { from: string; to: string; label?: string; }
interface Tool { name: string; purpose: string; category: string; whyForYou: string; vendorQuestions?: string[]; }
interface Phase { title: string; objective?: string; actions: string[]; exitCriteria?: string[]; nodes?: FlowNode[]; edges?: FlowEdge[]; }
interface Stakeholder { role: string; team: string; responsibility: string; whenToContact: string; }
interface Ticket { system: string; type: string; title: string; assignTo: string; }
interface Permission { name: string; owner: string; why: string; }
interface ITControl { name: string; action: string; }
interface Risk { risk: string; severity: string; mitigation: string; }
interface TcoLineItem { item: string; type: string; cost: string; }
interface Kpi { metric: string; baseline?: string; target: string; timeframe?: string; }
interface AdoptionStep { title: string; detail: string; }
interface Solution {
  title: string; insight?: string; summary: string; tools: Tool[]; assumptions?: string[];
  evaluated?: { name: string; verdict: string; reason: string }[];
  phases: Phase[]; estimatedCost: string; timeToImplement: string;
  rolloutPlaybook?: { stakeholders?: Stakeholder[]; tickets?: Ticket[] };
  approvals?: { permissions?: Permission[]; itControls?: ITControl[]; riskAssessment?: Risk[] };
  vendorOutreach?: { howToReach?: string; email?: string; demoChecklist?: string[] };
  tco?: { lineItems?: TcoLineItem[]; oneTimeSetup?: string; monthlyRecurring?: string; firstYearTotal?: string; hiddenCosts?: string[] };
  kpis?: Kpi[];
  adoptionPlan?: AdoptionStep[];
  alternative?: { name: string; summary: string; tools?: string[]; estimatedCost?: string; tradeoff?: string };
}
interface Context {
  size: string; stack: string; budget: string; timeline: string;
  industry?: string; team?: string; seats?: string; techLevel?: string; compliance?: string;
}
interface ROI { weeklyHours: number; teamSize: number; hourlyRate: number; }

// Palette
const C = {
  cover:   [7, 11, 27] as [number,number,number],
  accent:  [37, 99, 235] as [number,number,number],
  white:   [255, 255, 255] as [number,number,number],
  dark:    [15, 23, 42] as [number,number,number],
  mid:     [71, 85, 105] as [number,number,number],
  light:   [148, 163, 184] as [number,number,number],
  rule:    [226, 232, 240] as [number,number,number],
  bgLight: [248, 250, 252] as [number,number,number],
  nodeProcess:  { fill: [219,234,254] as [number,number,number], stroke: [59,130,246] as [number,number,number], text: [29,78,216] as [number,number,number] },
  nodeStart:    { fill: [209,250,229] as [number,number,number], stroke: [16,185,129] as [number,number,number], text: [5,150,105] as [number,number,number] },
  nodeEnd:      { fill: [254,226,226] as [number,number,number], stroke: [239,68,68] as [number,number,number], text: [185,28,28] as [number,number,number] },
  nodeDecision: { fill: [254,243,199] as [number,number,number], stroke: [245,158,11] as [number,number,number], text: [180,83,9] as [number,number,number] },
};

const W = 210, H = 297, ML = 22, MR = 22, MT = 20;
const CW = W - ML - MR;

function addPageNum(doc: jsPDF, n: number) {
  doc.setFontSize(8);
  doc.setTextColor(...C.light);
  doc.setFont("helvetica", "normal");
  doc.text(`${n}`, W / 2, H - 10, { align: "center" });
  doc.text("CONFIDENTIAL", W - MR, H - 10, { align: "right" });
}

function rule(doc: jsPDF, y: number, color = C.rule) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.line(ML, y, W - MR, y);
}

function sectionLabel(doc: jsPDF, label: string, y: number) {
  doc.setFontSize(7.5);
  doc.setTextColor(...C.light);
  doc.setFont("helvetica", "normal");
  doc.text(label.toUpperCase(), ML, y);
  rule(doc, y + 2);
  return y + 8;
}

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxW: number, size: number, color: [number,number,number], style = "normal"): number {
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.setFont("helvetica", style);
  const lines = doc.splitTextToSize(text, maxW);
  doc.text(lines, x, y);
  return y + lines.length * (size * 0.4 + 1.2);
}

function nodeColor(type: string) {
  if (type === "start") return C.nodeStart;
  if (type === "end") return C.nodeEnd;
  if (type === "decision") return C.nodeDecision;
  return C.nodeProcess;
}

function drawFlowChart(doc: jsPDF, nodes: FlowNode[], edges: FlowEdge[], originX: number, originY: number, areaW: number, areaH: number) {
  if (!nodes || nodes.length === 0) return;

  const NW = 46, NH = 17;
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 18, ranksep: 24 });
  nodes.forEach((n) => g.setNode(n.id, { width: NW, height: NH }));
  edges.forEach((e) => { try { g.setEdge(e.from, e.to); } catch { /* skip */ } });
  Dagre.layout(g);

  // Scale to fit area
  const positions = nodes.map((n) => {
    try { return { n, pos: g.node(n.id) }; } catch { return null; }
  }).filter(Boolean) as { n: FlowNode; pos: { x: number; y: number } }[];

  if (positions.length === 0) return;

  const minX = Math.min(...positions.map((p) => p.pos.x - NW / 2));
  const maxX = Math.max(...positions.map((p) => p.pos.x + NW / 2));
  const minY = Math.min(...positions.map((p) => p.pos.y - NH / 2));
  const maxY = Math.max(...positions.map((p) => p.pos.y + NH / 2));
  const scaleX = (areaW - 4) / Math.max(maxX - minX, 1);
  const scaleY = (areaH - 4) / Math.max(maxY - minY, 1);
  const scale = Math.min(scaleX, scaleY, 1);

  function tx(x: number) { return originX + 2 + (x - minX) * scale; }
  function ty(y: number) { return originY + 2 + (y - minY) * scale; }

  // Draw edges first
  doc.setLineWidth(0.4);
  edges.forEach((e) => {
    const fromNode = positions.find((p) => p.n.id === e.from);
    const toNode = positions.find((p) => p.n.id === e.to);
    if (!fromNode || !toNode) return;
    const x1 = tx(fromNode.pos.x) + (NW * scale) / 2;
    const y1 = ty(fromNode.pos.y);
    const x2 = tx(toNode.pos.x) - (NW * scale) / 2;
    const y2 = ty(toNode.pos.y);
    doc.setDrawColor(...C.light);
    doc.line(x1, y1, x2, y2);
    // Arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const al = 2.5;
    doc.setFillColor(...C.light);
    doc.triangle(
      x2, y2,
      x2 - al * Math.cos(angle - 0.4), y2 - al * Math.sin(angle - 0.4),
      x2 - al * Math.cos(angle + 0.4), y2 - al * Math.sin(angle + 0.4),
      "F"
    );
  });

  // Draw nodes
  positions.forEach(({ n, pos }) => {
    const x = tx(pos.x) - (NW * scale) / 2;
    const y = ty(pos.y) - (NH * scale) / 2;
    const nw = NW * scale;
    const nh = NH * scale;
    const c = nodeColor(n.type);
    doc.setFillColor(...c.fill);
    doc.setDrawColor(...c.stroke);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, nw, nh, 2, 2, "FD");
    // Size the label to the node's RENDERED width (post-scale), up to 2 lines,
    // so text never spills out or breaks mid-word
    const fontSize = Math.max(4.8, Math.min(6.5, nw * 0.17));
    doc.setFontSize(fontSize);
    doc.setTextColor(...c.text);
    doc.setFont("helvetica", "bold");
    const lines = (doc.splitTextToSize(n.label, nw - 3) as string[]).slice(0, 2);
    const lineH = fontSize * 0.42;
    const startY = y + nh / 2 + fontSize * 0.15 - ((lines.length - 1) * lineH) / 2;
    lines.forEach((ln, li) => doc.text(ln, x + nw / 2, startY + li * lineH, { align: "center" }));
  });
}

// jsPDF's standard Helvetica uses WinAnsi (CP1252). Glyphs outside it (arrows,
// checkboxes, etc.) render as garbage, so map the common ones the AI can emit
// to ASCII. CP1252-supported chars (em/en dash, curly quotes, bullet, ellipsis)
// are left alone.
function sanitizeText(s: string): string {
  return s
    .replace(/[→⟶➔➙➜]/g, "->")
    .replace(/←/g, "<-")
    .replace(/[↔↕]/g, "<->")
    .replace(/⇒/g, "=>")
    .replace(/[☐☑☒]/g, "[ ]")
    .replace(/[✓✔✅]/g, "v")
    .replace(/[▶►▸]/g, ">")
    .replace(/[●■▪]/g, "*");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepSanitize<T>(v: T): T {
  if (typeof v === "string") return sanitizeText(v) as unknown as T;
  if (Array.isArray(v)) return v.map(deepSanitize) as unknown as T;
  if (v && typeof v === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any = {};
    for (const k of Object.keys(v)) out[k] = deepSanitize((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}

export async function generatePDF(
  solutionRaw: Solution,
  problemRaw: string,
  context: Context,
  citations: string[],
  roi?: ROI
): Promise<void> {
  const solution = deepSanitize(solutionRaw);
  const problem = sanitizeText(problemRaw);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  let page = 1;
  // Section → page map, backfilled onto the exec page as a mini contents list
  const toc: { label: string; page: number }[] = [];

  // ══════════════════════════════════════════════
  // PAGE 1 — COVER
  // ══════════════════════════════════════════════
  doc.setFillColor(...C.cover);
  doc.rect(0, 0, W, H, "F");

  // Accent top bar
  doc.setFillColor(...C.accent);
  doc.rect(0, 0, W, 3, "F");

  // Accent left sidebar
  doc.setFillColor(...C.accent);
  doc.rect(0, 0, 3, H, "F");

  // CONFIDENTIAL
  doc.setFontSize(7.5);
  doc.setTextColor(...C.light);
  doc.setFont("helvetica", "normal");
  doc.text("CONFIDENTIAL — INTERNAL USE ONLY", W - MR, 14, { align: "right" });

  // Label
  doc.setFontSize(9);
  doc.setTextColor(...C.light);
  doc.text("ENTERPRISE IMPLEMENTATION PLAN", ML + 4, 52);

  // Title rule
  doc.setDrawColor(...C.accent);
  doc.setLineWidth(0.6);
  doc.line(ML + 4, 56, W - MR, 56);

  // Title
  doc.setFontSize(26);
  doc.setTextColor(...C.white);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(solution.title, CW - 4);
  doc.text(titleLines, ML + 4, 70);

  // Problem
  let py = 70 + titleLines.length * 12 + 8;
  doc.setFontSize(11);
  doc.setTextColor(...C.light);
  doc.setFont("helvetica", "italic");
  const pLines = doc.splitTextToSize(`"${problem}"`, CW - 4);
  doc.text(pLines, ML + 4, py);
  py += pLines.length * 6 + 16;

  // Summary
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 210, 225);
  const sLines = doc.splitTextToSize(solution.summary, CW - 4);
  doc.text(sLines, ML + 4, py);

  // Context grid (bottom section) — every profile field the user gave us
  const ctxItems = [
    { label: "INDUSTRY", value: context.industry },
    { label: "SIZE", value: context.size },
    { label: "REQUESTING TEAM", value: context.team },
    { label: "USERS / SEATS", value: context.seats },
    { label: "STACK", value: context.stack },
    { label: "BUDGET", value: context.budget },
    { label: "TIMELINE", value: context.timeline },
    { label: "COMPLIANCE", value: context.compliance },
  ].filter((i) => i.value && i.value !== "Not specified");

  const ctxRows = Math.ceil(ctxItems.length / 2);
  const rowStep = 17;
  const gridY = H - (ctxRows * rowStep + 32);
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.3);
  doc.line(ML + 4, gridY, W - MR, gridY);

  doc.setFontSize(7.5);
  doc.setTextColor(...C.light);
  doc.text("COMPANY CONTEXT", ML + 4, gridY + 8);

  const colW = CW / 2;
  ctxItems.forEach((item, i) => {
    const cx = ML + 4 + (i % 2) * colW;
    const cy = gridY + 17 + Math.floor(i / 2) * rowStep;
    doc.setFontSize(7);
    doc.setTextColor(...C.light);
    doc.setFont("helvetica", "normal");
    doc.text(item.label, cx, cy);
    doc.setFontSize(9);
    doc.setTextColor(...C.white);
    doc.setFont("helvetica", "bold");
    const vLines = (doc.splitTextToSize(item.value!, colW - 12) as string[]).slice(0, 2);
    doc.text(vLines, cx, cy + 5);
  });

  // Generated date
  doc.setFontSize(8);
  doc.setTextColor(...C.mid);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated ${today}`, ML + 4, H - 14);
  doc.text("Page 1", W - MR, H - 14, { align: "right" });

  // ══════════════════════════════════════════════
  // PAGE 2 — EXECUTIVE SUMMARY
  // ══════════════════════════════════════════════
  doc.addPage();
  page++;
  doc.setFillColor(...C.bgLight);
  doc.rect(0, 0, W, H, "F");

  const numbered = new Set<number>();
  const pageNum = (n: number) => { if (numbered.has(n)) return; numbered.add(n); addPageNum(doc, n); };

  let y = MT;

  // Header bar
  doc.setFillColor(...C.accent);
  doc.rect(0, 0, W, 1.5, "F");

  doc.setFontSize(8);
  doc.setTextColor(...C.light);
  doc.setFont("helvetica", "normal");
  doc.text(solution.title.toUpperCase(), ML, y + 4);
  y += 10;

  // Reserve a line for the contents strip (backfilled once page numbers are known)
  const tocSlotY = y + 2;
  y += 8;

  y = sectionLabel(doc, "Executive Summary", y);

  // Summary text
  y = wrapText(doc, solution.summary, ML, y, CW, 11, C.dark, "normal");
  y += 4;

  // Key insight callout
  if (solution.insight) {
    const insightLines = doc.splitTextToSize(solution.insight, CW - 14) as string[];
    const boxH = insightLines.length * 4.6 + 9;
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(...C.accent);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, y, CW, boxH, 2, 2, "FD");
    doc.setFillColor(...C.accent);
    doc.rect(ML, y, 1.4, boxH, "F");
    doc.setFontSize(7);
    doc.setTextColor(...C.accent);
    doc.setFont("helvetica", "bold");
    doc.text("KEY INSIGHT", ML + 5, y + 5);
    doc.setFontSize(9);
    doc.setTextColor(...C.dark);
    doc.setFont("helvetica", "italic");
    doc.text(insightLines, ML + 5, y + 10);
    y += boxH + 6;
  } else {
    y += 2;
  }

  // Key metrics — 3 boxes. Long itemized cost strings get reduced to their
  // total (the itemization lives in the TCO table) so the box can't overflow.
  const shortCost = (v: string) => {
    if (v.length <= 45) return v;
    const total = v.split("=").pop()?.trim();
    return total && total.length < v.length ? total : v;
  };
  const boxW = (CW - 8) / 3;
  const boxes = [
    { label: "ESTIMATED MONTHLY COST", value: shortCost(solution.estimatedCost) },
    { label: "FIRST-YEAR TOTAL", value: solution.tco?.firstYearTotal ?? `${solution.tools.length} tools` },
    { label: "TIME TO IMPLEMENT", value: solution.timeToImplement },
  ];
  const boxLines = boxes.map((b) => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    return (doc.splitTextToSize(b.value, boxW - 5) as string[]).slice(0, 3);
  });
  const boxH = 13 + Math.max(...boxLines.map((l) => l.length)) * 4.3;
  boxes.forEach((b, i) => {
    const bx = ML + i * (boxW + 4);
    doc.setFillColor(...C.white);
    doc.setDrawColor(...C.rule);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, y, boxW, boxH, 2, 2, "FD");
    doc.setFillColor(...C.accent);
    doc.roundedRect(bx, y, boxW, 2.5, 1, 1, "F");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.light);
    doc.setFont("helvetica", "normal");
    doc.text(b.label, bx + boxW / 2, y + 8, { align: "center" });
    doc.setFontSize(10);
    doc.setTextColor(...C.dark);
    doc.setFont("helvetica", "bold");
    doc.text(boxLines[i], bx + boxW / 2, y + 14.5, { align: "center" });
  });
  y += boxH + 8;

  // ROI section if provided
  if (roi && roi.weeklyHours > 0) {
    const monthly = roi.weeklyHours * 4.3 * roi.teamSize * roi.hourlyRate;
    const costNum = parseFloat(solution.estimatedCost.replace(/[^0-9.]/g, "")) || 0;
    const savings = monthly - costNum;
    const payback = costNum > 0 ? (costNum / Math.max(savings / 12, 1)).toFixed(1) : "—";

    y = sectionLabel(doc, "Return on Investment", y);
    const roiBoxes = [
      { label: "MONTHLY PROBLEM COST", value: `$${Math.round(monthly).toLocaleString()}` },
      { label: "MONTHLY SAVINGS", value: `$${Math.round(savings).toLocaleString()}` },
      { label: "PAYBACK PERIOD", value: `${payback} months` },
    ];
    roiBoxes.forEach((b, i) => {
      const bx = ML + i * (boxW + 4);
      doc.setFillColor(...C.white);
      doc.setDrawColor(...C.rule);
      doc.setLineWidth(0.3);
      doc.roundedRect(bx, y, boxW, 22, 2, 2, "FD");
      doc.setFontSize(6.5);
      doc.setTextColor(...C.light);
      doc.setFont("helvetica", "normal");
      doc.text(b.label, bx + boxW / 2, y + 8, { align: "center" });
      doc.setFontSize(12);
      doc.setTextColor(...C.accent);
      doc.setFont("helvetica", "bold");
      doc.text(b.value, bx + boxW / 2, y + 17, { align: "center" });
    });
    y += 30;
  }

  // Candidates evaluated — one compact line each; rejected options build trust
  if (solution.evaluated && solution.evaluated.length > 0) {
    doc.setFontSize(6.8);
    doc.setTextColor(...C.accent);
    doc.setFont("helvetica", "bold");
    doc.text(`SOLUTIONS EVALUATED — ${solution.evaluated.length} REAL CANDIDATES ASSESSED AGAINST YOUR SCENARIO`, ML, y + 1);
    y += 4.5;
    solution.evaluated.slice(0, 8).forEach((c) => {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", c.verdict === "chosen" ? "bold" : "normal");
      doc.setTextColor(...(c.verdict === "chosen" ? C.dark : C.mid));
      const line = doc.splitTextToSize(`${c.verdict === "chosen" ? "[+]" : "[-]"} ${c.name} — ${c.reason}`, CW - 4) as string[];
      doc.text(line.slice(0, 2), ML + 2, y + 1);
      y += Math.min(line.length, 2) * 3.9 + 0.8;
    });
    y += 4;
  }

  // Assumptions the AI made — flag them honestly
  if (solution.assumptions && solution.assumptions.length > 0) {
    doc.setFontSize(6.8);
    doc.setTextColor(180, 130, 10);
    doc.setFont("helvetica", "bold");
    doc.text("WE ASSUMED — VERIFY THESE", ML, y + 1);
    y += 4.5;
    solution.assumptions.slice(0, 5).forEach((a) => {
      doc.setFontSize(7.5);
      doc.setTextColor(...C.mid);
      doc.setFont("helvetica", "italic");
      const aLines = doc.splitTextToSize(`- ${a}`, CW - 4) as string[];
      doc.text(aLines, ML + 2, y + 1);
      y += aLines.length * 3.9 + 0.8;
    });
    y += 4;
  }

  // Tools as cards — the WHY matters as much as the WHAT for an implementer
  y = sectionLabel(doc, "Recommended Tools — And Why These", y);

  solution.tools.forEach((tool) => {
    const purposeLines = (doc.splitTextToSize(tool.purpose, CW - 10) as string[]).slice(0, 2);
    const whyLines = tool.whyForYou
      ? (doc.splitTextToSize(`Why for you: ${tool.whyForYou}`, CW - 10) as string[]).slice(0, 3)
      : [];
    const cardH = 9 + purposeLines.length * 3.9 + (whyLines.length ? whyLines.length * 3.7 + 2.5 : 0) + 3;
    if (y + cardH > H - 22) { pageNum(page); doc.addPage(); page++; y = MT + 10; doc.setFillColor(...C.bgLight); doc.rect(0, 0, W, H, "F"); }

    doc.setFillColor(...C.white);
    doc.setDrawColor(...C.rule);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, y, CW, cardH, 1.5, 1.5, "FD");

    doc.setFontSize(9.5);
    doc.setTextColor(...C.dark);
    doc.setFont("helvetica", "bold");
    doc.text(tool.name, ML + 5, y + 6);
    const nameW = doc.getTextWidth(tool.name);
    doc.setFontSize(7);
    doc.setTextColor(...C.accent);
    doc.setFont("helvetica", "normal");
    doc.text(tool.category.toUpperCase(), ML + 8 + nameW, y + 6);

    doc.setFontSize(8);
    doc.setTextColor(...C.dark);
    doc.text(purposeLines, ML + 5, y + 11);
    if (whyLines.length) {
      doc.setFontSize(7.5);
      doc.setTextColor(...C.mid);
      doc.setFont("helvetica", "italic");
      doc.text(whyLines, ML + 5, y + 11 + purposeLines.length * 3.9 + 1.5);
    }
    y += cardH + 3;
  });

  pageNum(page);

  // ══════════════════════════════════════════════
  // PAGE(S) — IMPLEMENTATION PLAN (phases flow continuously)
  // ══════════════════════════════════════════════
  function newFlowPage() {
    pageNum(page);
    doc.addPage();
    page++;
    doc.setFillColor(...C.bgLight);
    doc.rect(0, 0, W, H, "F");
    doc.setFillColor(...C.accent);
    doc.rect(0, 0, W, 1.5, "F");
    y = MT;
    doc.setFontSize(8);
    doc.setTextColor(...C.light);
    doc.setFont("helvetica", "normal");
    doc.text(solution.title.toUpperCase(), ML, y + 4);
    y += 12;
  }
  function flowRoom(needed: number) {
    if (y > H - needed) newFlowPage();
  }

  if (solution.phases.length > 0) {
    newFlowPage();
    toc.push({ label: "Implementation plan & vendor questions", page });
    y = sectionLabel(doc, "Implementation Plan", y);

    // Timeline bar — the phases at a glance
    if (solution.phases.length > 1) {
      const seg = CW / solution.phases.length;
      solution.phases.forEach((ph, i) => {
        const sx = ML + i * seg;
        const shade = 235 - i * 55;
        doc.setFillColor(59, 130, Math.max(120, shade));
        doc.roundedRect(sx, y, seg - 1.5, 6.5, 1, 1, "F");
        doc.setFontSize(6.5);
        doc.setTextColor(...C.white);
        doc.setFont("helvetica", "bold");
        const label = ph.title.replace(/^Phase\s*\d+\s*[—–-]+\s*/i, "");
        const lLine = (doc.splitTextToSize(label, seg - 6) as string[])[0] ?? "";
        doc.text(lLine, sx + (seg - 1.5) / 2, y + 4.3, { align: "center" });
      });
      y += 11;
    }

    solution.phases.forEach((phase, phaseIdx) => {
      const hasChart = !!(phase.nodes && phase.nodes.length > 0);
      const chartH = 26;

      // Estimate the block height so a phase never splits across pages
      doc.setFontSize(8);
      let estH = 12 + (hasChart ? chartH + 5 : 0);
      if (phase.objective) estH += (doc.splitTextToSize(phase.objective, CW - 12) as string[]).length * 4 + 2;
      phase.actions.forEach((a) => {
        estH += (doc.splitTextToSize(a, CW - 8) as string[]).length * 4.6 + 2;
      });
      if (phase.exitCriteria?.length) estH += 6 + phase.exitCriteria.length * 4.4;
      flowRoom(estH + 14);

      // Phase badge + title
      doc.setFillColor(...C.accent);
      doc.circle(ML + 3.5, y + 1.5, 3.5, "F");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.white);
      doc.setFont("helvetica", "bold");
      doc.text(`${phaseIdx + 1}`, ML + 3.5, y + 3.7, { align: "center" });
      doc.setFontSize(12);
      doc.setTextColor(...C.dark);
      doc.text(phase.title, ML + 10, y + 4);
      y += 9;

      // Objective — what this phase is for
      if (phase.objective) {
        doc.setFontSize(8.5);
        doc.setTextColor(...C.mid);
        doc.setFont("helvetica", "italic");
        const oLines = doc.splitTextToSize(phase.objective, CW - 12) as string[];
        doc.text(oLines, ML + 10, y + 1);
        y += oLines.length * 4 + 3;
      } else {
        y += 2;
      }

      // Actions (full width)
      phase.actions.forEach((action) => {
        doc.setFontSize(8);
        doc.setTextColor(...C.accent);
        doc.setFont("helvetica", "bold");
        doc.text(">", ML + 1, y + 1);
        doc.setTextColor(...C.dark);
        doc.setFont("helvetica", "normal");
        const aLines = doc.splitTextToSize(action, CW - 8) as string[];
        doc.text(aLines, ML + 6, y + 1);
        y += aLines.length * 4.6 + 2;
      });

      // Exit criteria — when this phase counts as done
      if (phase.exitCriteria && phase.exitCriteria.length > 0) {
        y += 1;
        doc.setFontSize(6.8);
        doc.setTextColor(5, 150, 105);
        doc.setFont("helvetica", "bold");
        doc.text("DONE WHEN", ML + 1, y + 1);
        y += 4.5;
        phase.exitCriteria.forEach((c) => {
          doc.setFontSize(7.8);
          doc.setTextColor(...C.mid);
          doc.setFont("helvetica", "normal");
          const cLines = doc.splitTextToSize(`[ ] ${c}`, CW - 10) as string[];
          doc.text(cLines, ML + 6, y + 1);
          y += cLines.length * 4.2 + 0.5;
        });
        y += 1;
      }

      // Flowchart below the actions, full width — nodes render large enough to read
      if (hasChart) {
        y += 2;
        doc.setFillColor(...C.white);
        doc.setDrawColor(...C.rule);
        doc.setLineWidth(0.3);
        doc.roundedRect(ML, y, CW, chartH, 2, 2, "FD");
        drawFlowChart(doc, phase.nodes!, phase.edges ?? [], ML + 3, y + 3, CW - 6, chartH - 6);
        y += chartH + 3;
      }
      y += 8;
    });

    // Vendor questions follow the plan
    const toolsWithQs = solution.tools.filter((t) => t.vendorQuestions && t.vendorQuestions.length > 0).slice(0, 3);
    if (toolsWithQs.length > 0) {
      flowRoom(40);
      y = sectionLabel(doc, "Vendor Questions — Before You Buy", y);
      toolsWithQs.forEach((tool) => {
        flowRoom(24);
        doc.setFontSize(8.5);
        doc.setTextColor(...C.dark);
        doc.setFont("helvetica", "bold");
        doc.text(tool.name, ML, y);
        y += 5;
        tool.vendorQuestions!.forEach((q) => {
          flowRoom(12);
          doc.setFontSize(7.5);
          doc.setTextColor(...C.mid);
          doc.setFont("helvetica", "normal");
          const qLines = doc.splitTextToSize(`- ${q}`, CW - 4) as string[];
          doc.text(qLines, ML + 2, y);
          y += qLines.length * 4.3;
        });
        y += 4;
      });
    }

    pageNum(page);
  }

  // ══════════════════════════════════════════════
  // PAGE — COST OF OWNERSHIP, METRICS & ALTERNATIVE
  // ══════════════════════════════════════════════
  const tco = solution.tco;
  const kpis = solution.kpis;
  const adoption = solution.adoptionPlan;
  const alt = solution.alternative;
  const hasCostPage =
    (tco && ((tco.lineItems && tco.lineItems.length) || tco.firstYearTotal)) ||
    (kpis && kpis.length) || (adoption && adoption.length) || (alt && alt.name);

  if (hasCostPage) {
    // Flow onto the current page when at least a third of it is free —
    // hard page breaks were leaving reports full of half-empty pages
    if (y > H - 110) {
      pageNum(page);
      doc.addPage(); page++;
      doc.setFillColor(...C.bgLight); doc.rect(0, 0, W, H, "F");
      doc.setFillColor(...C.accent); doc.rect(0, 0, W, 1.5, "F");
      y = MT;
      doc.setFontSize(8); doc.setTextColor(...C.light); doc.setFont("helvetica", "normal");
      doc.text(solution.title.toUpperCase(), ML, y + 4);
      y += 12;
    } else {
      y += 8;
    }
    toc.push({ label: "Total cost of ownership, metrics & Option B", page });

    function roomCost(needed: number) {
      if (y > H - needed) {
        pageNum(page);
        doc.addPage(); page++;
        doc.setFillColor(...C.bgLight); doc.rect(0, 0, W, H, "F");
        doc.setFillColor(...C.accent); doc.rect(0, 0, W, 1.5, "F");
        y = MT + 6;
      }
    }

    // TCO table
    if (tco && ((tco.lineItems && tco.lineItems.length) || tco.firstYearTotal)) {
      y = sectionLabel(doc, "Total Cost of Ownership", y);
      if (tco.lineItems && tco.lineItems.length > 0) {
        const cw = [CW - 70, 30, 40];
        doc.setFillColor(...C.dark); doc.rect(ML, y, CW, 7, "F");
        doc.setFontSize(7.5); doc.setTextColor(...C.white); doc.setFont("helvetica", "bold");
        doc.text("Item", ML + 2, y + 5);
        doc.text("Type", ML + 2 + cw[0], y + 5);
        doc.text("Cost", ML + CW - 2, y + 5, { align: "right" });
        y += 7;
        tco.lineItems.forEach((li, i) => {
          roomCost(14);
          doc.setFillColor(...(i % 2 ? C.bgLight : C.white)); doc.rect(ML, y, CW, 8, "F");
          doc.setFontSize(8); doc.setTextColor(...C.dark); doc.setFont("helvetica", "normal");
          doc.text(doc.splitTextToSize(li.item, cw[0] - 4)[0], ML + 2, y + 5);
          doc.setTextColor(...C.mid); doc.setFontSize(7.5);
          doc.text(li.type, ML + 2 + cw[0], y + 5);
          doc.setTextColor(...C.dark); doc.setFontSize(8);
          doc.text(li.cost, ML + CW - 2, y + 5, { align: "right" });
          doc.setDrawColor(...C.rule); doc.setLineWidth(0.2); doc.line(ML, y + 8, ML + CW, y + 8);
          y += 8;
        });
        y += 3;
      }
      const totals: { label: string; val: string }[] = [
        { label: "One-time setup", val: tco.oneTimeSetup ?? "" },
        { label: "Monthly recurring", val: tco.monthlyRecurring ?? "" },
        { label: "First-year total", val: tco.firstYearTotal ?? "" },
      ].filter((t) => t.val);
      totals.forEach(({ label, val }) => {
        roomCost(8);
        doc.setFontSize(8.5); doc.setTextColor(...C.mid); doc.setFont("helvetica", "normal");
        doc.text(label, ML, y);
        doc.setTextColor(...C.accent); doc.setFont("helvetica", "bold");
        doc.text(val, ML + CW, y, { align: "right" });
        y += 6;
      });
      if (tco.hiddenCosts && tco.hiddenCosts.length > 0) {
        y += 2;
        doc.setFontSize(7.5); doc.setTextColor(...C.light); doc.setFont("helvetica", "normal");
        doc.text("HIDDEN COSTS TO BUDGET FOR", ML, y); y += 4.5;
        tco.hiddenCosts.forEach((c) => { roomCost(8); y = wrapText(doc, `- ${c}`, ML + 2, y, CW - 4, 7.5, C.mid, "normal"); y += 1; });
      }
      y += 6;
    }

    // KPIs
    if (kpis && kpis.length > 0) {
      roomCost(24);
      y = sectionLabel(doc, "Success Metrics", y);
      kpis.forEach((k) => {
        roomCost(14);
        doc.setFontSize(8.5); doc.setTextColor(...C.dark); doc.setFont("helvetica", "bold");
        y = wrapText(doc, k.metric, ML, y, CW, 8.5, C.dark, "bold");
        const line = `${k.baseline ? k.baseline + "  ->  " : ""}${k.target}${k.timeframe ? `   (${k.timeframe})` : ""}`;
        y = wrapText(doc, line, ML + 2, y, CW - 4, 7.5, C.mid, "normal");
        y += 3;
      });
      y += 4;
    }

    // Adoption plan
    if (adoption && adoption.length > 0) {
      roomCost(24);
      y = sectionLabel(doc, "Adoption Plan", y);
      adoption.forEach((a, i) => {
        roomCost(14);
        doc.setFontSize(8.5); doc.setTextColor(...C.dark); doc.setFont("helvetica", "bold");
        doc.text(`${i + 1}. ${a.title}`, ML, y); y += 4.5;
        y = wrapText(doc, a.detail, ML + 4, y, CW - 8, 7.5, C.mid, "normal");
        y += 2;
      });
      y += 4;
    }

    // Alternative
    if (alt && alt.name) {
      roomCost(30);
      y = sectionLabel(doc, "Alternative — Option B", y);
      doc.setFontSize(9.5); doc.setTextColor(...C.dark); doc.setFont("helvetica", "bold");
      y = wrapText(doc, alt.name, ML, y, CW, 9.5, C.dark, "bold");
      if (alt.summary) y = wrapText(doc, alt.summary, ML, y + 1, CW, 8, C.mid, "normal");
      if (alt.tools && alt.tools.length) y = wrapText(doc, `Tools: ${alt.tools.join(", ")}`, ML, y + 1, CW, 7.5, C.light, "italic");
      if (alt.estimatedCost) y = wrapText(doc, `Cost: ${alt.estimatedCost}`, ML, y + 1, CW, 7.5, C.mid, "normal");
      if (alt.tradeoff) y = wrapText(doc, `Tradeoff: ${alt.tradeoff}`, ML, y + 1, CW, 7.5, C.mid, "italic");
    }

    pageNum(page);
  }

  // ══════════════════════════════════════════════
  // PAGE — ROLLOUT PLAYBOOK, APPROVALS & VENDOR OUTREACH
  // ══════════════════════════════════════════════
  const rp = solution.rolloutPlaybook;
  const ap = solution.approvals;
  const vo = solution.vendorOutreach;
  const hasRollout =
    (rp && ((rp.stakeholders && rp.stakeholders.length) || (rp.tickets && rp.tickets.length))) ||
    (ap && ((ap.permissions && ap.permissions.length) || (ap.itControls && ap.itControls.length) || (ap.riskAssessment && ap.riskAssessment.length))) ||
    (vo && (vo.howToReach || vo.email || (vo.demoChecklist && vo.demoChecklist.length)));

  if (hasRollout) {
    if (y > H - 110) {
      pageNum(page);
      doc.addPage();
      page++;
      doc.setFillColor(...C.bgLight);
      doc.rect(0, 0, W, H, "F");
      doc.setFillColor(...C.accent);
      doc.rect(0, 0, W, 1.5, "F");
      y = MT;
      doc.setFontSize(8);
      doc.setTextColor(...C.light);
      doc.setFont("helvetica", "normal");
      doc.text(solution.title.toUpperCase(), ML, y + 4);
      y += 12;
    } else {
      y += 8;
    }
    toc.push({ label: "Internal rollout, approvals & vendor outreach", page });

    function ensureRoom(needed: number) {
      if (y > H - needed) {
        pageNum(page);
        doc.addPage(); page++;
        doc.setFillColor(...C.bgLight); doc.rect(0, 0, W, H, "F");
        doc.setFillColor(...C.accent); doc.rect(0, 0, W, 1.5, "F");
        y = MT + 6;
      }
    }

    // Stakeholders
    if (rp?.stakeholders && rp.stakeholders.length > 0) {
      y = sectionLabel(doc, "Internal Rollout — Who To Involve", y);
      rp.stakeholders.forEach((s) => {
        ensureRoom(24);
        doc.setFontSize(9);
        doc.setTextColor(...C.dark);
        doc.setFont("helvetica", "bold");
        doc.text(`${s.role}${s.team ? `  (${s.team})` : ""}`, ML, y);
        y += 5;
        y = wrapText(doc, s.responsibility, ML + 2, y, CW - 4, 8, C.mid, "normal");
        if (s.whenToContact) { y = wrapText(doc, `When: ${s.whenToContact}`, ML + 2, y, CW - 4, 7.5, C.light, "italic"); }
        y += 3;
      });
      y += 4;
    }

    // Tickets
    if (rp?.tickets && rp.tickets.length > 0) {
      ensureRoom(30);
      y = sectionLabel(doc, "Tickets To File", y);
      rp.tickets.forEach((t) => {
        ensureRoom(16);
        doc.setFontSize(8.5);
        doc.setTextColor(...C.accent);
        doc.setFont("helvetica", "bold");
        doc.text(`[${t.system}]`, ML, y);
        doc.setTextColor(...C.dark);
        y = wrapText(doc, t.title, ML + 2, y + 5, CW - 4, 8.5, C.dark, "normal");
        if (t.type || t.assignTo) y = wrapText(doc, `${t.type}${t.assignTo ? ` -> ${t.assignTo}` : ""}`, ML + 2, y, CW - 4, 7.5, C.light, "italic");
        y += 3;
      });
      y += 4;
    }

    // Permissions & IT controls
    if (ap?.permissions && ap.permissions.length > 0) {
      ensureRoom(30);
      y = sectionLabel(doc, "Permissions To Secure", y);
      ap.permissions.forEach((p) => {
        ensureRoom(14);
        doc.setFontSize(8.5); doc.setTextColor(...C.dark); doc.setFont("helvetica", "bold");
        doc.text(`• ${p.name}`, ML, y); y += 4.5;
        y = wrapText(doc, `${p.why}${p.owner ? ` (Owner: ${p.owner})` : ""}`, ML + 4, y, CW - 8, 7.5, C.mid, "normal");
        y += 2;
      });
      y += 4;
    }
    if (ap?.itControls && ap.itControls.length > 0) {
      ensureRoom(30);
      y = sectionLabel(doc, "IT Controls (CASB / IP Allow-list / SSO)", y);
      ap.itControls.forEach((c) => {
        ensureRoom(14);
        doc.setFontSize(8.5); doc.setTextColor(...C.dark); doc.setFont("helvetica", "bold");
        doc.text(`• ${c.name}`, ML, y); y += 4.5;
        y = wrapText(doc, c.action, ML + 4, y, CW - 8, 7.5, C.mid, "normal");
        y += 2;
      });
      y += 4;
    }

    // Risk assessment
    if (ap?.riskAssessment && ap.riskAssessment.length > 0) {
      ensureRoom(30);
      y = sectionLabel(doc, "Risk Assessment", y);
      ap.riskAssessment.forEach((r) => {
        ensureRoom(16);
        doc.setFontSize(8.5); doc.setTextColor(...C.dark); doc.setFont("helvetica", "bold");
        doc.text(`[${r.severity || "—"}] `, ML, y);
        const sevW = doc.getTextWidth(`[${r.severity || "—"}] `);
        doc.setFont("helvetica", "normal");
        y = wrapText(doc, r.risk, ML + sevW, y, CW - sevW - 2, 8.5, C.dark, "normal");
        y = wrapText(doc, `Mitigation: ${r.mitigation}`, ML + 4, y, CW - 8, 7.5, C.mid, "italic");
        y += 3;
      });
      y += 4;
    }

    // Vendor outreach
    if (vo && (vo.howToReach || vo.email || (vo.demoChecklist && vo.demoChecklist.length))) {
      ensureRoom(40);
      y = sectionLabel(doc, "Vendor Outreach", y);
      if (vo.howToReach) { y = wrapText(doc, vo.howToReach, ML, y, CW, 8.5, C.dark, "normal"); y += 3; }
      if (vo.email) {
        ensureRoom(30);
        doc.setFillColor(...C.white); doc.setDrawColor(...C.rule); doc.setLineWidth(0.3);
        const emailLines = doc.splitTextToSize(vo.email, CW - 8);
        const boxH = emailLines.length * 4.2 + 8;
        ensureRoom(boxH + 4);
        doc.roundedRect(ML, y, CW, boxH, 2, 2, "FD");
        doc.setFontSize(8); doc.setTextColor(...C.mid); doc.setFont("helvetica", "normal");
        doc.text(emailLines, ML + 4, y + 6);
        y += boxH + 4;
      }
      if (vo.demoChecklist && vo.demoChecklist.length > 0) {
        ensureRoom(20);
        doc.setFontSize(8); doc.setTextColor(...C.light); doc.setFont("helvetica", "normal");
        doc.text("DEMO-CALL CHECKLIST", ML, y); y += 5;
        vo.demoChecklist.forEach((q) => {
          ensureRoom(10);
          y = wrapText(doc, `[ ]  ${q}`, ML, y, CW, 8, C.dark, "normal");
          y += 1.5;
        });
      }
    }

    pageNum(page);
  }

  // ══════════════════════════════════════════════
  // FINAL PAGE — SOURCES & APPENDIX
  // ══════════════════════════════════════════════
  if (citations.length > 0) {
    const srcNeeded = 14 + Math.min(citations.length, 12) * 6;
    if (y > H - srcNeeded - 20) {
      pageNum(page);
      doc.addPage();
      page++;
      doc.setFillColor(...C.bgLight);
      doc.rect(0, 0, W, H, "F");
      doc.setFillColor(...C.accent);
      doc.rect(0, 0, W, 1.5, "F");
      y = MT + 10;
    } else {
      y += 8;
    }
    toc.push({ label: "Research sources", page });
    y = sectionLabel(doc, "Research Sources", y);
    citations.forEach((url, i) => {
      if (y > H - 20) return;
      doc.setFontSize(8);
      doc.setTextColor(...C.mid);
      doc.setFont("helvetica", "normal");
      const truncated = url.length > 90 ? url.slice(0, 90) + "..." : url;
      doc.text(`${i + 1}.  ${truncated}`, ML, y);
      y += 6;
    });

    pageNum(page);
  }

  // Backfill a compact one-line contents strip onto page 2 now that page
  // numbers are known — always fits, unlike a block that competes for space
  if (toc.length > 0) {
    doc.setPage(2);
    const short = (l: string) => l.split(",")[0].split("&")[0].trim();
    const line = toc.map((t) => `${short(t.label)} p.${t.page}`).join("   ·   ");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.mid);
    doc.setFont("helvetica", "normal");
    doc.text(line, W / 2, tocSlotY, { align: "center" });
  }

  doc.save(`${solution.title.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}_Implementation_Plan.pdf`);
}
