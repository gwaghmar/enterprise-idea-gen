# Golden set — regression harness

The ground truth for the self-improvement loop. A fixed set of real problems,
each annotated with what a good report **must** and **must not** contain. Every
prompt or pipeline change replays against this before shipping, so a bug you've
already fixed can't silently come back.

## Run it

```bash
# Offline — score captured fixtures. Fast, free, deterministic. Run in CI.
node eval/replay.mjs --fixtures

# Live — run each case through the REAL /api/generate pipeline and score the
# result. The true regression check before shipping a prompt change.
# Costs ~$0.05 + ~60s per case, so run on demand.
node eval/replay.mjs --live --url https://pilotplan.vercel.app
node eval/replay.mjs --live --url http://localhost:3000 --case omnicom-bakeoff
```

Exit code is `1` if any error-severity assertion fails (or a negative-control
"bad" fixture slips through), so it can gate a deploy. Add `--json` for
machine-readable output.

## How it works

- `cases.mjs` — the golden problems + their assertions.
- `score.mjs` — the pure, deterministic scoring engine.
- `fixtures/` — captured report JSON for offline scoring. `*-bad.json` files are
  **negative controls**: known-bad reports the guard must catch. If a bad
  fixture ever passes, the harness fails — the guard has stopped biting.
- `replay.mjs` — the runner (fixture + live modes).

## Assertion kinds

| kind | checks |
|---|---|
| `includes` / `excludes` | text must / must-not appear in a scope (`report`, `summary`, `approvals`, `tools`, `evaluated`, `phases`, `team`, `tco`) |
| `nonEmpty` | a field (dot path) is a non-empty string/array |
| `minCount` | an array field has ≥ N items |
| `chosenOne` | exactly one `evaluated[].verdict === "chosen"` |
| `moneyUnder` | a `$` figure parsed from a field is ≤ a ceiling |

`severity: "error"` fails the case and counts as a regression. `"warn"` is
reported but never fails the suite — use it for fragile heuristics.

## Adding a case

Capture a real problem, write down what a good report MUST and MUST NOT contain,
and encode each as an assertion. Prefer `excludes` error-assertions for bugs
you've actually seen in production — those are the guards that stop a fixed bug
from regressing. When you fix a new bug, add a `*-bad.json` negative control so
the harness proves it stays fixed.
