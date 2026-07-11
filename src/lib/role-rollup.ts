// Per-role responsibility rollup — answers "what will THIS person actually
// do?" without making the reader reassemble it from the whole plan.
//
// Pure, deterministic derivation from data the report already has:
//   - phase actions are written as "ROLE does X" ("Data Engineer configures
//     ADF linked services"), so actions are attributed by name match
//   - rolloutPlaybook stakeholders carry an explicit responsibility line
// No AI call, no schema change — if nothing matches a role, the rollup for
// that role is simply empty and the UI shows nothing extra.

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface RoleDuty { text: string; phase: string; }
export interface RoleRollup { duties: RoleDuty[]; responsibility?: string; }

// Matchable variants of a role name: full name, the part before any "(" or
// "/", and a distinctive leading bigram — so "Finance Analyst (Power User)"
// matches actions that just say "Finance Analyst".
function variantsOf(role: string): string[] {
  const base = role.toLowerCase().trim();
  const noParen = base.split("(")[0].trim();
  const noSlash = noParen.split("/")[0].trim();
  const words = noSlash.split(/\s+/);
  const bigram = words.slice(0, 2).join(" ");
  const set = new Set([base, noParen, noSlash]);
  // A single generic word ("analyst") would over-match; require >= 2 words
  // or a reasonably distinctive single token (>= 6 chars).
  if (words.length >= 2) set.add(bigram);
  return [...set].filter((v) => v.length >= 6 || v.split(/\s+/).length >= 2);
}

export function rollupForRole(role: string, solution: any): RoleRollup {
  const variants = variantsOf(role);
  if (!variants.length) return { duties: [] };
  const hit = (text: string) => {
    const t = text.toLowerCase();
    return variants.some((v) => t.includes(v));
  };

  const duties: RoleDuty[] = [];
  for (const ph of solution?.phases ?? []) {
    const phaseLabel = String(ph?.title ?? "").split(":")[0].split("—")[0].trim() || "Phase";
    for (const a of ph?.actions ?? []) {
      const text = String(a ?? "");
      if (text && hit(text)) duties.push({ text, phase: phaseLabel });
    }
  }

  const stakeholder = (solution?.rolloutPlaybook?.stakeholders ?? []).find((s: any) => hit(String(s?.role ?? "")));
  return {
    duties: duties.slice(0, 6),
    responsibility: stakeholder?.responsibility ? String(stakeholder.responsibility) : undefined,
  };
}
