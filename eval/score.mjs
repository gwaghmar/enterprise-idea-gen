// Golden-set scoring engine — pure, deterministic, no network.
//
// Given a report `solution` object (the shape normalizeSolution emits) and a
// list of assertions, decide pass/fail per assertion and aggregate. This is
// the ground truth the self-improvement loop measures against: a report that
// fails an "error" assertion is a regression, full stop.
//
// Assertion kinds:
//   includes   { scope, pattern, flags?, severity, note }  text must appear
//   excludes   { scope, pattern, flags?, severity, note }  text must NOT appear (regression guards)
//   nonEmpty   { path, severity, note }                    field is a non-empty string/array
//   minCount   { path, min, severity, note }               array field has >= min items
//   chosenOne  { severity, note }                          exactly one evaluated[].verdict === "chosen"
//   moneyUnder { path, maxUsd, severity, note }            $ parsed from field <= maxUsd
//
// severity: "error" fails the case and counts as a regression; "warn" is
// reported but never fails the suite (for fragile/heuristic checks).

/** Resolve a named scope to searchable text. */
function resolveScope(solution, scope) {
  const s = solution || {};
  switch (scope) {
    case "summary": return [s.title, s.summary, s.insight].filter(Boolean).join(" \n ");
    case "approvals": return JSON.stringify(s.approvals ?? {});
    case "tools": return JSON.stringify(s.tools ?? []);
    case "evaluated": return JSON.stringify(s.evaluated ?? []);
    case "phases": return JSON.stringify(s.phases ?? []);
    case "team": return JSON.stringify(s.teamRequired ?? []);
    case "tco": return JSON.stringify(s.tco ?? {});
    case "report":
    default: return JSON.stringify(s);
  }
}

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// Parse a headline dollar figure from a string like "~$8,000/mo" or "$1.2M".
function parseMoney(v) {
  if (typeof v !== "string") return null;
  const m = v.replace(/,/g, "").match(/\$?\s*([\d.]+)\s*([kKmM])?/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (!isFinite(n)) return null;
  if (/k/i.test(m[2] || "")) n *= 1_000;
  if (/m/i.test(m[2] || "")) n *= 1_000_000;
  return n;
}

/** Run one assertion against a solution. Returns { passed, detail }. */
export function runAssertion(solution, a) {
  switch (a.kind) {
    case "includes": {
      const re = new RegExp(a.pattern, a.flags || "");
      const hit = re.test(resolveScope(solution, a.scope));
      return { passed: hit, detail: hit ? "" : `expected /${a.pattern}/ in ${a.scope}` };
    }
    case "excludes": {
      const re = new RegExp(a.pattern, a.flags || "");
      const hit = re.test(resolveScope(solution, a.scope));
      return { passed: !hit, detail: hit ? `found forbidden /${a.pattern}/ in ${a.scope}` : "" };
    }
    case "nonEmpty": {
      const v = getPath(solution, a.path);
      const ok = Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim().length > 0 : v != null;
      return { passed: ok, detail: ok ? "" : `${a.path} is empty` };
    }
    case "minCount": {
      const v = getPath(solution, a.path);
      const n = Array.isArray(v) ? v.length : 0;
      return { passed: n >= a.min, detail: n >= a.min ? "" : `${a.path} has ${n}, need >= ${a.min}` };
    }
    case "chosenOne": {
      const ev = Array.isArray(solution?.evaluated) ? solution.evaluated : [];
      const chosen = ev.filter((e) => String(e?.verdict).toLowerCase() === "chosen").length;
      return { passed: chosen === 1, detail: chosen === 1 ? "" : `${chosen} candidates marked chosen (need exactly 1)` };
    }
    case "moneyUnder": {
      const n = parseMoney(getPath(solution, a.path));
      if (n == null) return { passed: false, detail: `${a.path} has no parseable $ figure` };
      return { passed: n <= a.maxUsd, detail: n <= a.maxUsd ? "" : `${a.path} = $${n} exceeds $${a.maxUsd}` };
    }
    default:
      return { passed: false, detail: `unknown assertion kind: ${a.kind}` };
  }
}

/** Score one case's solution against its assertions. */
export function scoreCase(caseDef, solution) {
  const results = (caseDef.assertions || []).map((a) => {
    const { passed, detail } = runAssertion(solution, a);
    return { note: a.note, kind: a.kind, severity: a.severity || "error", passed, detail };
  });
  const errorFails = results.filter((r) => !r.passed && r.severity === "error");
  const warnFails = results.filter((r) => !r.passed && r.severity === "warn");
  return {
    id: caseDef.id,
    description: caseDef.description,
    passed: errorFails.length === 0,
    errorFails,
    warnFails,
    results,
  };
}

/** Aggregate a suite of scored cases. */
export function scoreSuite(scored) {
  const passed = scored.filter((c) => c.passed).length;
  const regressions = scored.flatMap((c) =>
    c.errorFails.map((f) => ({ case: c.id, note: f.note, detail: f.detail }))
  );
  return {
    total: scored.length,
    passed,
    failed: scored.length - passed,
    score: scored.length ? passed / scored.length : 1,
    regressions,
  };
}
