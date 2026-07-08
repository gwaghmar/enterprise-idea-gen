import ExcelJS from "exceljs";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Palette mirrors the PDF export for a consistent brand across downloads.
const NAVY = "FF16223A";
const ACCENT = "FF2563EB";
const RED = "FFB42828";
const GREEN = "FF059669";
const AMBER = "FFB4820A";
const LIGHT = "FFF4F6F9";
const GREY = "FF8A93A6";
const WHITE = "FFFFFFFF";

interface Tool {
  name: string;
  purpose: string;
  category: string;
  whyForYou: string;
  lockIn?: { level: string; reason: string };
  vendorQuestions?: string[];
}
interface Phase {
  title: string;
  objective: string;
  actions: string[];
  exitCriteria: string[];
}
interface AdoptionStep {
  title: string;
  detail: string;
}
interface LineItem {
  item: string;
  type: string;
  cost: string;
}
interface TeamRole {
  role: string;
  skills: string[];
  commitment: string;
  phases: string;
  staffing: string;
}
interface Kpi {
  metric: string;
  baseline?: string;
  target: string;
  timeframe?: string;
}
interface Solution {
  title: string;
  summary: string;
  estimatedCost: string;
  timeToImplement: string;
  costOfInaction?: { annualCost: string; basis: string; paybackPeriod?: string };
  tools: Tool[];
  phases: Phase[];
  teamRequired: TeamRole[];
  kpis: Kpi[];
  adoptionPlan?: AdoptionStep[];
  evaluated?: { name: string; verdict: string; reason: string }[];
  tco?: {
    lineItems: LineItem[];
    oneTimeSetup?: string;
    monthlyRecurring?: string;
    firstYearTotal?: string;
  };
}

function money(v: string | undefined): number | string {
  if (!v) return "";
  const m = v.replace(/,/g, "").match(/[\d.]+/);
  if (!m) return v;
  let n = parseFloat(m[0]);
  if (/k\b/i.test(v)) n *= 1_000;
  if (/m\b/i.test(v)) n *= 1_000_000;
  return Math.round(n);
}

function styleHeaderRow(row: ExcelJS.Row, fill = NAVY) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: NAVY } } };
  });
  row.height = 22;
}

function autosize(ws: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

function titleBlock(ws: ExcelJS.Worksheet, title: string, subtitle: string, span: number) {
  ws.mergeCells(1, 1, 1, span);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 16, color: { argb: NAVY } };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, span);
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.font = { size: 10, color: { argb: GREY }, italic: true };
  ws.getRow(2).height = 18;
}

// exceljs can't create native charts, but data-bar conditional formatting
// renders real in-cell proportional bars natively in Excel/Sheets — so a
// numeric column becomes a bar chart with no floating chart object (and no
// empty whitespace around it).
function dataBar(ws: ExcelJS.Worksheet, ref: string, argb: string) {
  ws.addConditionalFormatting({
    ref,
    rules: [{ type: "dataBar", cfvo: [{ type: "min" }, { type: "max" }], color: { argb }, gradient: true } as any],
  });
}

// Parse a phase's week span from its title for the timeline Gantt.
// "Week 1-2" -> [1,2]; "Week 3" -> [3,3]; "Month 2+" -> ~[5,8]; else 2-wk block.
function weekSpan(title: string, idx: number): [number, number] {
  const range = title.match(/week\s*(\d+)\s*[-–—]\s*(\d+)/i);
  if (range) return [parseInt(range[1], 10), parseInt(range[2], 10)];
  const one = title.match(/week\s*(\d+)/i);
  if (one) return [parseInt(one[1], 10), parseInt(one[1], 10)];
  const mo = title.match(/month\s*(\d+)/i);
  if (mo) { const s = (parseInt(mo[1], 10) - 1) * 4 + 1; return [s, s + 3]; }
  return [idx * 2 + 1, idx * 2 + 2];
}

export async function generateExcel(solutionRaw: Solution | any, problem: string): Promise<Uint8Array> {
  const solution = solutionRaw as Solution;
  const wb = new ExcelJS.Workbook();
  wb.creator = "PilotPlan";
  wb.created = new Date();

  // ---------- Dashboard ----------
  const dash = wb.addWorksheet("Dashboard", { views: [{ showGridLines: false }] });
  titleBlock(dash, solution.title || "Implementation Plan", `Pilot plan for: ${problem.slice(0, 140)}`, 4);
  autosize(dash, [26, 22, 22, 22]);

  let r = 4;
  dash.getCell(r, 1).value = "KEY METRICS";
  dash.getCell(r, 1).font = { bold: true, size: 11, color: { argb: ACCENT } };
  r += 1;

  const metricStart = r;
  const metrics: [string, string][] = [
    ["Estimated Cost", solution.estimatedCost || ""],
    ["Time to Implement", solution.timeToImplement || ""],
    ["First-Year TCO", solution.tco?.firstYearTotal || solution.estimatedCost || ""],
  ];
  metrics.forEach(([label, val], i) => {
    const row = dash.getRow(metricStart + i);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true, color: { argb: NAVY } };
    row.getCell(2).value = val;
    row.getCell(2).font = { size: 12, bold: true, color: { argb: ACCENT } };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
    row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
  });
  r = metricStart + metrics.length + 1;

  // COST BREAKDOWN — real in-cell bar chart via data bars.
  const dashItems = solution.tco?.lineItems || [];
  const numericItems = dashItems.map((li) => ({ item: li.item, type: li.type, n: money(li.cost) })).filter((x) => typeof x.n === "number");
  if (numericItems.length) {
    dash.getCell(r, 1).value = "COST BREAKDOWN";
    dash.getCell(r, 1).font = { bold: true, size: 11, color: { argb: ACCENT } };
    r += 1;
    const barStart = r;
    numericItems.forEach((x) => {
      const row = dash.getRow(r);
      row.getCell(1).value = x.item;
      row.getCell(1).alignment = { wrapText: true };
      row.getCell(2).value = x.n;
      row.getCell(2).numFmt = '"$"#,##0';
      row.getCell(3).value = x.type;
      row.getCell(3).font = { color: { argb: x.type === "Recurring" ? AMBER : GREEN }, size: 9 };
      r += 1;
    });
    dataBar(dash, `B${barStart}:B${r - 1}`, ACCENT);
    r += 1;
  }

  if (solution.costOfInaction) {
    const c = solution.costOfInaction;
    dash.getCell(r, 1).value = "COST OF INACTION";
    dash.getCell(r, 1).font = { bold: true, size: 11, color: { argb: RED } };
    r += 1;
    dash.mergeCells(r, 1, r, 4);
    dash.getCell(r, 1).value = `${c.annualCost} / year if this problem stays unsolved`;
    dash.getCell(r, 1).font = { bold: true, size: 12, color: { argb: RED } };
    r += 1;
    dash.mergeCells(r, 1, r, 4);
    dash.getCell(r, 1).value = c.basis;
    dash.getCell(r, 1).alignment = { wrapText: true };
    dash.getCell(r, 1).font = { color: { argb: GREY }, italic: true, size: 10 };
    r += 1;
    if (c.paybackPeriod) {
      dash.getCell(r, 1).value = "Payback period";
      dash.getCell(r, 2).value = c.paybackPeriod;
      dash.getCell(r, 2).font = { bold: true, color: { argb: GREEN } };
      r += 1;
    }
    // Inaction vs plan — two proportional bars make the gap visceral.
    const inactionN = money(c.annualCost);
    const planN = money(solution.tco?.firstYearTotal || solution.estimatedCost);
    if (typeof inactionN === "number" && typeof planN === "number") {
      const s = r;
      const a = dash.getRow(r); a.getCell(1).value = "Cost of inaction (annual)"; a.getCell(2).value = inactionN; a.getCell(2).numFmt = '"$"#,##0'; r += 1;
      const b = dash.getRow(r); b.getCell(1).value = "This plan (first-year)"; b.getCell(2).value = planN; b.getCell(2).numFmt = '"$"#,##0'; r += 1;
      dataBar(dash, `B${s}:B${r - 1}`, RED);
    }
    r += 1;
  }

  if (solution.kpis?.length) {
    dash.getCell(r, 1).value = "KPI TARGETS";
    dash.getCell(r, 1).font = { bold: true, size: 11, color: { argb: ACCENT } };
    r += 1;
    const hdr = dash.getRow(r);
    hdr.getCell(1).value = "Metric";
    hdr.getCell(2).value = "Baseline";
    hdr.getCell(3).value = "Target";
    hdr.getCell(4).value = "Timeframe";
    styleHeaderRow(hdr, ACCENT);
    r += 1;
    solution.kpis.forEach((k) => {
      const row = dash.getRow(r);
      row.getCell(1).value = k.metric;
      row.getCell(2).value = k.baseline || "—";
      row.getCell(3).value = k.target;
      row.getCell(4).value = k.timeframe || "—";
      row.eachCell((cell) => (cell.border = { bottom: { style: "hair", color: { argb: GREY } } }));
      r += 1;
    });
  }

  // ---------- Timeline (Gantt) ----------
  // A colored-cell grid: each phase's row fills the weeks it spans. Own sheet
  // so the narrow week columns don't fight the wide dashboard columns.
  if (solution.phases?.length) {
    const spans = solution.phases.map((p, i) => weekSpan(p.title, i));
    const maxWk = Math.min(20, Math.max(4, ...spans.map((s) => s[1])));
    const tl = wb.addWorksheet("Timeline", { views: [{ showGridLines: false, state: "frozen", xSplit: 1, ySplit: 4 }] });
    titleBlock(tl, "Implementation Timeline", "Each shaded block is one week of the rollout", maxWk + 1);
    tl.getColumn(1).width = 30;
    for (let w = 1; w <= maxWk; w++) tl.getColumn(w + 1).width = 4;
    const hdr = tl.getRow(4);
    hdr.getCell(1).value = "Phase";
    for (let w = 1; w <= maxWk; w++) { hdr.getCell(w + 1).value = `W${w}`; }
    styleHeaderRow(hdr);
    let tr = 5;
    solution.phases.forEach((p, i) => {
      const row = tl.getRow(tr);
      row.getCell(1).value = p.title;
      row.getCell(1).font = { bold: true, color: { argb: NAVY }, size: 10 };
      row.getCell(1).alignment = { wrapText: true, vertical: "middle" };
      const [s, e] = spans[i];
      for (let w = Math.max(1, s); w <= Math.min(e, maxWk); w++) {
        const c = row.getCell(w + 1);
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 ? ACCENT : NAVY } };
        c.border = { top: { style: "thin", color: { argb: WHITE } }, bottom: { style: "thin", color: { argb: WHITE } } };
      }
      row.height = 22;
      tr += 1;
    });
  }

  // ---------- To-Do Tracker ----------
  // Map each phase to the team role(s) who own it, using role.phases
  // ("Phase 1-3", "Phase 2", etc.) matched against the phase's own number —
  // so an enterprise plan with several roles gets per-row ownership, not one
  // undifferentiated list everyone has to read in full.
  const phaseNumOf = (title: string): number | null => {
    const m = title.match(/Phase\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  };
  const roleRangeOf = (phasesStr: string): [number, number] | null => {
    const nums = [...phasesStr.matchAll(/\d+/g)].map((m) => parseInt(m[0], 10));
    if (!nums.length) return null;
    return [Math.min(...nums), Math.max(...nums)];
  };
  const ownersFor = (phase: Phase, idx: number): string => {
    const n = phaseNumOf(phase.title) ?? idx + 1;
    const owners = (solution.teamRequired || []).filter((r) => {
      const range = roleRangeOf(r.phases);
      return range ? n >= range[0] && n <= range[1] : true;
    });
    return owners.map((r) => r.role).join(", ") || "Unassigned";
  };

  const todo = wb.addWorksheet("To-Do Tracker", { views: [{ showGridLines: false, state: "frozen", ySplit: 4 }] });
  titleBlock(todo, "Implementation Tracker", "Every action, adoption step, and vendor question — owned by team", 6);
  autosize(todo, [22, 40, 10, 26, 16, 38]);
  const todoHdrRow = todo.getRow(4);
  ["Phase / Category", "Action", "Status", "Owner (Team)", "Due Date", "Exit Criteria / Notes"].forEach((h, i) => (todoHdrRow.getCell(i + 1).value = h));
  styleHeaderRow(todoHdrRow);

  let todoRow = 5;
  const statusList = '"Not Started,In Progress,Blocked,Done"';

  const addTrackerRow = (category: string, action: string, owner: string, notes: string) => {
    const row = todo.getRow(todoRow);
    row.getCell(1).value = category;
    row.getCell(2).value = action;
    row.getCell(3).value = "Not Started";
    row.getCell(4).value = owner;
    row.getCell(5).value = "";
    row.getCell(6).value = notes;
    row.getCell(2).alignment = { wrapText: true };
    row.getCell(4).alignment = { wrapText: true };
    row.getCell(6).alignment = { wrapText: true };
    todo.getCell(todoRow, 3).dataValidation = { type: "list", allowBlank: false, formulae: [statusList] };
    todoRow += 1;
  };

  solution.phases.forEach((phase, idx) => {
    const firstRowOfPhase = todoRow;
    const owner = ownersFor(phase, idx);
    phase.actions.forEach((action, i) => {
      addTrackerRow(phase.title, action, owner, i === 0 ? phase.exitCriteria.join("; ") : "");
    });
    if (todoRow > firstRowOfPhase) {
      todo.mergeCells(firstRowOfPhase, 1, todoRow - 1, 1);
      todo.getCell(firstRowOfPhase, 1).alignment = { vertical: "top", wrapText: true };
      todo.getCell(firstRowOfPhase, 1).font = { bold: true, color: { argb: NAVY } };
    }
  });

  // Adoption / change-management steps — real to-dos, previously dropped entirely.
  const adoption = solution.adoptionPlan || [];
  if (adoption.length) {
    const firstRow = todoRow;
    adoption.forEach((a) => addTrackerRow("Adoption & Rollout", a.title, "Program Lead / Change Mgmt", a.detail));
    todo.mergeCells(firstRow, 1, todoRow - 1, 1);
    todo.getCell(firstRow, 1).alignment = { vertical: "top", wrapText: true };
    todo.getCell(firstRow, 1).font = { bold: true, color: { argb: NAVY } };
  }

  // Vendor outreach questions per tool — the procurement/security to-dos that
  // are easy to lose track of on a larger, multi-vendor enterprise plan.
  const vendorRows: { tool: string; q: string }[] = [];
  (solution.tools || []).forEach((t) => (t.vendorQuestions || []).forEach((q) => vendorRows.push({ tool: t.name, q })));
  if (vendorRows.length) {
    const firstRow = todoRow;
    vendorRows.forEach((v) => addTrackerRow("Vendor Outreach", `Ask ${v.tool}: ${v.q}`, "Procurement / Security", ""));
    todo.mergeCells(firstRow, 1, todoRow - 1, 1);
    todo.getCell(firstRow, 1).alignment = { vertical: "top", wrapText: true };
    todo.getCell(firstRow, 1).font = { bold: true, color: { argb: NAVY } };
  }

  const summaryRow = todoRow + 1;
  todo.getCell(summaryRow, 1).value = "Progress";
  todo.getCell(summaryRow, 1).font = { bold: true };
  todo.getCell(summaryRow, 2).value = {
    formula: `=COUNTIF(C5:C${todoRow - 1},"Done")&" / "&COUNTA(C5:C${todoRow - 1})&" tasks done"`,
  } as any;
  todo.getCell(summaryRow, 2).font = { bold: true, color: { argb: ACCENT } };

  // ---------- Costs ----------
  const costs = wb.addWorksheet("Costs", { views: [{ showGridLines: false, state: "frozen", ySplit: 4 }] });
  titleBlock(costs, "Cost Breakdown", "Total cost of ownership, first year", 3);
  autosize(costs, [30, 16, 16]);
  const costHdr = costs.getRow(4);
  ["Line Item", "Type", "Cost ($)"].forEach((h, i) => (costHdr.getCell(i + 1).value = h));
  styleHeaderRow(costHdr);

  let costRow = 5;
  const items = solution.tco?.lineItems || [];
  items.forEach((li) => {
    const row = costs.getRow(costRow);
    row.getCell(1).value = li.item;
    row.getCell(2).value = li.type;
    row.getCell(3).value = money(li.cost);
    row.getCell(3).numFmt = '"$"#,##0';
    if (li.type === "Recurring") {
      row.getCell(2).font = { color: { argb: AMBER } };
    } else {
      row.getCell(2).font = { color: { argb: GREEN } };
    }
    costRow += 1;
  });
  if (costRow > 5) dataBar(costs, `C5:C${costRow - 1}`, ACCENT);
  const totalRow = costRow + 1;
  costs.getCell(totalRow, 1).value = "TOTAL (first year)";
  costs.getCell(totalRow, 1).font = { bold: true, color: { argb: NAVY } };
  costs.getCell(totalRow, 3).value = { formula: `=SUM(C5:C${costRow - 1})` } as any;
  costs.getCell(totalRow, 3).numFmt = '"$"#,##0';
  costs.getCell(totalRow, 3).font = { bold: true, color: { argb: ACCENT } };
  costs.getRow(totalRow).eachCell((cell) => {
    cell.border = { top: { style: "medium", color: { argb: NAVY } } };
  });

  if (solution.costOfInaction) {
    const roiRow = totalRow + 2;
    costs.getCell(roiRow, 1).value = "Annual cost of inaction";
    costs.getCell(roiRow, 3).value = money(solution.costOfInaction.annualCost);
    costs.getCell(roiRow, 3).numFmt = '"$"#,##0';
    costs.getCell(roiRow + 1, 1).value = "Net first-year benefit";
    costs.getCell(roiRow + 1, 1).font = { bold: true, color: { argb: GREEN } };
    costs.getCell(roiRow + 1, 3).value = { formula: `=C${roiRow}-C${totalRow}` } as any;
    costs.getCell(roiRow + 1, 3).numFmt = '"$"#,##0';
    costs.getCell(roiRow + 1, 3).font = { bold: true, color: { argb: GREEN } };
  }

  // ---------- Tools ----------
  const tools = wb.addWorksheet("Tools", { views: [{ showGridLines: false, state: "frozen", ySplit: 4 }] });
  titleBlock(tools, "Recommended Tools", "Vendor shortlist with exit-risk rating", 4);
  autosize(tools, [22, 16, 45, 32]);
  const toolHdr = tools.getRow(4);
  ["Tool", "Category", "Why for you", "Lock-in risk"].forEach((h, i) => (toolHdr.getCell(i + 1).value = h));
  styleHeaderRow(toolHdr);
  let toolRow = 5;
  solution.tools.forEach((t) => {
    const row = tools.getRow(toolRow);
    row.getCell(1).value = t.name;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = t.category;
    row.getCell(3).value = t.whyForYou;
    row.getCell(3).alignment = { wrapText: true };
    if (t.lockIn) {
      row.getCell(4).value = `${t.lockIn.level.toUpperCase()} — ${t.lockIn.reason}`;
      row.getCell(4).font = {
        color: { argb: t.lockIn.level === "high" ? RED : t.lockIn.level === "medium" ? AMBER : GREEN },
      };
      row.getCell(4).alignment = { wrapText: true };
    }
    toolRow += 1;
  });

  // ---------- Team ----------
  if (solution.teamRequired?.length) {
    const team = wb.addWorksheet("Team", { views: [{ showGridLines: false, state: "frozen", ySplit: 4 }] });
    titleBlock(team, "Team & Staffing", "Roles required to run this pilot", 5);
    autosize(team, [22, 34, 16, 18, 16]);
    const teamHdr = team.getRow(4);
    ["Role", "Skills", "Commitment", "Phases", "Staffing"].forEach((h, i) => (teamHdr.getCell(i + 1).value = h));
    styleHeaderRow(teamHdr);
    let teamRow = 5;
    solution.teamRequired.forEach((role) => {
      const row = team.getRow(teamRow);
      row.getCell(1).value = role.role;
      row.getCell(1).font = { bold: true };
      row.getCell(2).value = role.skills.join(", ");
      row.getCell(3).value = role.commitment;
      row.getCell(4).value = role.phases;
      row.getCell(5).value = role.staffing;
      teamRow += 1;
    });
  }

  // ---------- Comparison (scenario-adaptive) ----------
  // Only for questions that were actually a bake-off — a field of candidates
  // evaluated against each other. A simple single-tool request skips this tab.
  const evaluated = solution.evaluated || [];
  if (evaluated.length >= 3) {
    const cmp = wb.addWorksheet("Comparison", { views: [{ showGridLines: false, state: "frozen", ySplit: 4 }] });
    titleBlock(cmp, "Candidates Evaluated", "Why the winner won — and why each alternative was ruled out", 3);
    autosize(cmp, [30, 14, 60]);
    const cHdr = cmp.getRow(4);
    ["Candidate", "Verdict", "Reasoning"].forEach((h, i) => (cHdr.getCell(i + 1).value = h));
    styleHeaderRow(cHdr);
    let cr = 5;
    // Chosen first, then rejected — the recommendation leads.
    const ordered = [...evaluated].sort((a, b) => (a.verdict === "chosen" ? -1 : b.verdict === "chosen" ? 1 : 0));
    ordered.forEach((e) => {
      const chosen = String(e.verdict).toLowerCase() === "chosen";
      const row = cmp.getRow(cr);
      row.getCell(1).value = e.name;
      row.getCell(1).font = { bold: true, color: { argb: NAVY } };
      row.getCell(2).value = chosen ? "CHOSEN" : "Rejected";
      row.getCell(2).font = { bold: chosen, color: { argb: chosen ? GREEN : GREY } };
      row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: chosen ? "FFE7F6EF" : LIGHT } };
      row.getCell(3).value = e.reason;
      row.getCell(3).alignment = { wrapText: true, vertical: "top" };
      row.eachCell((c) => (c.border = { bottom: { style: "hair", color: { argb: GREY } } }));
      cr += 1;
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}
