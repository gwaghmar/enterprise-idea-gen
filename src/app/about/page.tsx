import Link from "next/link";

export const metadata = {
  title: "About — PilotPlan",
  description: "Who built PilotPlan and how it works.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-black text-white px-4 py-16">
      <div className="max-w-2xl mx-auto space-y-10">
        <Link href="/" className="text-white/40 hover:text-white/70 text-sm transition-colors">← Back to PilotPlan</Link>

        <div>
          <h1 className="text-3xl font-bold mb-3">About PilotPlan</h1>
          <p className="text-white/60 leading-relaxed">
            PilotPlan is an AI solution architect for businesses. Describe a problem —
            manual invoices, a CRM nobody updates, shadow AI everywhere — and it researches
            the live web, evaluates real candidate tools against your actual stack, budget,
            and team, and hands you a step-by-step implementation plan you can act on:
            tools with reasoning, real costs with linked sources, rollout phases with
            exit criteria, risks, and even the email to send the vendor.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">How it works</h2>
          <p className="text-white/60 leading-relaxed">
            Every report runs live research at the moment you ask — four parallel searches
            (vendor pricing, community reviews on Reddit and G2, official docs, and real
            case studies), then the actual pages are read and cross-checked before the plan
            is written. Claims carry source pills so you can verify anything with one click.
            Reports also improve over time: feedback and the changes users make feed a
            learning loop that shapes future reports.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Who built this</h2>
          <p className="text-white/60 leading-relaxed">
            Built by Govind Waghmare as an exploration of what AI-assisted consulting can
            look like when it shows its work — real sources, honest assumptions, and the
            rejected options alongside the recommendation. Currently in free beta;
            feedback directly shapes what gets improved next.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">The fine print</h2>
          <p className="text-white/50 text-sm leading-relaxed">
            Reports are AI-generated from live research and are informational only — verify
            pricing and compliance claims with vendors before purchasing (the source pills
            make that easy). © 2026 Govind Waghmare. All rights reserved.
          </p>
        </div>
      </div>
    </main>
  );
}
