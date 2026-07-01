import { jsPDF } from "jspdf";
import Dagre from "@dagrejs/dagre";

interface FlowNode { id: string; label: string; type: string; }
interface FlowEdge { from: string; to: string; label?: string; }
interface Tool { name: string; purpose: string; category: string; whyForYou: string; vendorQuestions?: string[]; }
interface Phase { title: string; actions: string[]; nodes?: FlowNode[]; edges?: FlowEdge[]; }
interface Stakeholder { role: string; team: string; responsibility: string; whenToContact: string; }
interface Ticket { system: string; type: string; title: string; assignTo: string; }
interface Permission { name: string; owner: string; why: string; }
interface ITControl { name: string; action: string; }
interface Risk { risk: string; severity: string; mitigation: string; }
interface Solution {
  title: string; summary: string; tools: Tool[];
  phases: Phase[]; estimatedCost: string; timeToImplement: string;
  rolloutPlaybook?: { stakeholders?: Stakeholder[]; tickets?: Ticket[] };
  approvals?: { permissions?: Permission[]; itControls?: ITControl[]; riskAssessment?: Risk[] };
  vendorOutreach?: { howToReach?: string; email?: string; demoChecklist?: string[] };
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

  const NW = 38, NH = 14;
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 20, ranksep: 30 });
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
    doc.setFontSize(6.5);
    doc.setTextColor(...c.text);
    doc.setFont("helvetica", "bold");
    const label = doc.splitTextToSize(n.label, nw - 3);
    doc.text(label[0] ?? "", x + nw / 2, y + nh / 2 + 2, { align: "center" });
  });
}

export async function generatePDF(
  solution: Solution,
  problem: string,
  context: Context,
  citations: string[],
  roi?: ROI
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  let page = 1;

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

  // Context grid (bottom section)
  const gridY = H - 80;
  doc.setDrawColor(37, 99, 235, 0.3);
  doc.setLineWidth(0.3);
  doc.line(ML + 4, gridY, W - MR, gridY);

  doc.setFontSize(7.5);
  doc.setTextColor(...C.light);
  doc.text("COMPANY CONTEXT", ML + 4, gridY + 8);

  const ctxItems = [
    { label: "SIZE", value: context.size },
    { label: "STACK", value: context.stack },
    { label: "BUDGET", value: context.budget },
    { label: "TIMELINE", value: context.timeline },
  ];
  const colW = CW / 2;
  ctxItems.forEach((item, i) => {
    const cx = ML + 4 + (i % 2) * colW;
    const cy = gridY + 18 + Math.floor(i / 2) * 18;
    doc.setFontSize(7);
    doc.setTextColor(...C.light);
    doc.setFont("helvetica", "normal");
    doc.text(item.label, cx, cy);
    doc.setFontSize(10);
    doc.setTextColor(...C.white);
    doc.setFont("helvetica", "bold");
    doc.text(item.value, cx, cy + 6);
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

  let y = MT;

  // Header bar
  doc.setFillColor(...C.accent);
  doc.rect(0, 0, W, 1.5, "F");

  doc.setFontSize(8);
  doc.setTextColor(...C.light);
  doc.setFont("helvetica", "normal");
  doc.text(solution.title.toUpperCase(), ML, y + 4);
  y += 12;

  y = sectionLabel(doc, "Executive Summary", y);

  // Summary text
  y = wrapText(doc, solution.summary, ML, y, CW, 11, C.dark, "normal");
  y += 6;

  // Key metrics — 3 boxes
  const boxW = (CW - 8) / 3;
  const boxes = [
    { label: "ESTIMATED MONTHLY COST", value: solution.estimatedCost },
    { label: "TIME TO IMPLEMENT", value: solution.timeToImplement },
    { label: "TOOLS RECOMMENDED", value: `${solution.tools.length} tools` },
  ];
  boxes.forEach((b, i) => {
    const bx = ML + i * (boxW + 4);
    doc.setFillColor(...C.white);
    doc.setDrawColor(...C.rule);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, y, boxW, 22, 2, 2, "FD");
    doc.setFillColor(...C.accent);
    doc.roundedRect(bx, y, boxW, 2.5, 1, 1, "F");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.light);
    doc.setFont("helvetica", "normal");
    doc.text(b.label, bx + boxW / 2, y + 8, { align: "center" });
    doc.setFontSize(11);
    doc.setTextColor(...C.dark);
    doc.setFont("helvetica", "bold");
    const vLines = doc.splitTextToSize(b.value, boxW - 4);
    doc.text(vLines, bx + boxW / 2, y + 15, { align: "center" });
  });
  y += 30;

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

  // Tools overview table
  y = sectionLabel(doc, "Recommended Tools", y);
  const colWidths = [50, 35, CW - 85];
  const headers = ["Tool", "Category", "Purpose"];

  // Table header
  doc.setFillColor(...C.dark);
  doc.rect(ML, y, CW, 7, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.white);
  doc.setFont("helvetica", "bold");
  let cx2 = ML + 2;
  headers.forEach((h, i) => { doc.text(h, cx2, y + 5); cx2 += colWidths[i]; });
  y += 7;

  solution.tools.forEach((tool, i) => {
    if (y > H - 30) { doc.addPage(); page++; y = MT + 10; doc.setFillColor(...C.bgLight); doc.rect(0, 0, W, H, "F"); }
    const bg = i % 2 === 0 ? C.white : C.bgLight;
    const rowH = 12;
    doc.setFillColor(...bg);
    doc.rect(ML, y, CW, rowH, "F");
    doc.setFontSize(8);
    doc.setTextColor(...C.dark);
    doc.setFont("helvetica", "bold");
    doc.text(tool.name, ML + 2, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.mid);
    doc.setFontSize(7.5);
    doc.text(tool.category, ML + 2 + colWidths[0], y + 5);
    const purposeLines = doc.splitTextToSize(tool.purpose, colWidths[2] - 4);
    doc.setTextColor(...C.dark);
    doc.text(purposeLines[0], ML + 2 + colWidths[0] + colWidths[1], y + 5);
    doc.setDrawColor(...C.rule);
    doc.setLineWidth(0.2);
    doc.line(ML, y + rowH, ML + CW, y + rowH);
    y += rowH;
  });

  addPageNum(doc, page);

  // ══════════════════════════════════════════════
  // PAGE(S) — IMPLEMENTATION PHASES
  // ══════════════════════════════════════════════
  solution.phases.forEach((phase, phaseIdx) => {
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

    // Phase number badge
    doc.setFillColor(...C.accent);
    doc.circle(ML + 4, y + 2, 4, "F");
    doc.setFontSize(8);
    doc.setTextColor(...C.white);
    doc.setFont("helvetica", "bold");
    doc.text(`${phaseIdx + 1}`, ML + 4, y + 4.5, { align: "center" });

    // Phase title
    doc.setFontSize(16);
    doc.setTextColor(...C.dark);
    doc.setFont("helvetica", "bold");
    doc.text(phase.title, ML + 12, y + 6);
    y += 14;

    rule(doc, y);
    y += 8;

    // Actions + flowchart side by side
    const leftW = phase.nodes && phase.nodes.length > 0 ? CW * 0.45 : CW;
    const rightW = CW - leftW - 6;

    // Actions
    y = sectionLabel(doc, "Implementation Actions", y);
    phase.actions.forEach((action) => {
      if (y > H - 40) return;
      doc.setFontSize(8);
      doc.setTextColor(...C.accent);
      doc.setFont("helvetica", "bold");
      doc.text("›", ML, y + 1);
      doc.setTextColor(...C.dark);
      doc.setFont("helvetica", "normal");
      const aLines = doc.splitTextToSize(action, leftW - 8);
      doc.text(aLines, ML + 5, y + 1);
      y += aLines.length * 5 + 2;
    });

    // Flowchart (right column)
    if (phase.nodes && phase.nodes.length > 0) {
      const chartY = MT + 26;
      const chartX = ML + leftW + 6;
      const chartH = Math.min(phase.actions.length * 7 + 20, 100);

      doc.setFillColor(...C.white);
      doc.setDrawColor(...C.rule);
      doc.setLineWidth(0.3);
      doc.roundedRect(chartX, chartY, rightW, chartH, 2, 2, "FD");

      doc.setFontSize(6.5);
      doc.setTextColor(...C.light);
      doc.setFont("helvetica", "normal");
      doc.text("PHASE WORKFLOW", chartX + rightW / 2, chartY + 5, { align: "center" });

      drawFlowChart(doc, phase.nodes, phase.edges ?? [], chartX + 2, chartY + 8, rightW - 4, chartH - 12);
    }

    // Vendor questions for tools relevant to this phase (show for all tools on last phase)
    if (phaseIdx === solution.phases.length - 1) {
      y = Math.max(y, MT + 26) + 10;
      if (y < H - 60) {
        y = sectionLabel(doc, "Vendor Questions — Before You Buy", y);
        solution.tools.slice(0, 3).forEach((tool) => {
          if (!tool.vendorQuestions || y > H - 30) return;
          doc.setFontSize(8.5);
          doc.setTextColor(...C.dark);
          doc.setFont("helvetica", "bold");
          doc.text(tool.name, ML, y);
          y += 5;
          tool.vendorQuestions.forEach((q) => {
            if (y > H - 20) return;
            doc.setFontSize(7.5);
            doc.setTextColor(...C.mid);
            doc.setFont("helvetica", "normal");
            const qLines = doc.splitTextToSize(`• ${q}`, CW - 4);
            doc.text(qLines, ML + 2, y);
            y += qLines.length * 4.5;
          });
          y += 4;
        });
      }
    }

    addPageNum(doc, page);
  });

  // ══════════════════════════════════════════════
  // PAGE — ROLLOUT PLAYBOOK, APPROVALS & VENDOR OUTREACH
  // ══════════════════════════════════════════════
  const rp = solution.rolloutPlaybook;
  const ap = solution.approvals;
  const vo = solution.vendorOutreach;
  const hasRollout =
    (rp && ((rp.stakeholders && rp.stakeholders.length) || (rp.tickets && rp.tickets.length))) ||
    (ap && ((ap.permissions && ap.permissions.length) || (ap.itControls && ap.itControls.length) || (ap.riskAssessment && ap.riskAssessment.length))) ||
    (vo && (vo.email || (vo.demoChecklist && vo.demoChecklist.length)));

  if (hasRollout) {
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

    function ensureRoom(needed: number) {
      if (y > H - needed) {
        addPageNum(doc, page);
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
        if (t.type || t.assignTo) y = wrapText(doc, `${t.type}${t.assignTo ? ` → ${t.assignTo}` : ""}`, ML + 2, y, CW - 4, 7.5, C.light, "italic");
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
    if (vo && (vo.email || (vo.demoChecklist && vo.demoChecklist.length))) {
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
          y = wrapText(doc, `☐  ${q}`, ML, y, CW, 8, C.dark, "normal");
          y += 1.5;
        });
      }
    }

    addPageNum(doc, page);
  }

  // ══════════════════════════════════════════════
  // FINAL PAGE — SOURCES & APPENDIX
  // ══════════════════════════════════════════════
  if (citations.length > 0) {
    doc.addPage();
    page++;
    doc.setFillColor(...C.bgLight);
    doc.rect(0, 0, W, H, "F");
    doc.setFillColor(...C.accent);
    doc.rect(0, 0, W, 1.5, "F");

    y = MT + 10;
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

    addPageNum(doc, page);
  }

  doc.save(`${solution.title.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}_Implementation_Plan.pdf`);
}
