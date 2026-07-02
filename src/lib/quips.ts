// Loading-screen facts and error one-liners. Facts are phrased as guidance /
// widely-reported industry findings rather than precise claims.

export const LOADING_FACTS = [
  "The average company runs ~130 SaaS apps — most teams can name about 20 of them.",
  "Roughly a third of SaaS licenses go unused. Auditing seats is the fastest “discount” there is.",
  "The #1 reason tools fail isn't the tech — it's nobody owning adoption after go-live.",
  "Asking a vendor for their SOC 2 report early can shave weeks off security review.",
  "Most enterprise deals have 20–30% negotiation room — especially at quarter-end.",
  "“Design partner” discounts are real: vendors trade price for feedback and a logo.",
  "Automation ROI usually comes from handling exceptions well, not the happy path.",
  "Knowledge workers toggle between apps and tabs over 1,000 times a day.",
  "A big slice of software spend happens outside IT's knowledge — that's “shadow IT.”",
  "Procurement pro-tip: paying annually up front usually unlocks 10–20% off.",
  "Watch for the “SSO tax” — single sign-on is often paywalled into a pricier tier. Ask early.",
  "Data migration is the most underestimated line item in every implementation plan.",
  "Pilots with a hard end date get decisions. Open-ended pilots get forgotten.",
  "Best vendor question: “What do customers like us complain about most?”",
  "Right now the AI is reading live web sources for your report — not just its memory.",
  "Every price and tool in your report comes with the sources it was pulled from.",
  "Tools that integrate with what you already use get adopted 2–3× faster than rip-and-replace.",
  "The cheapest week to negotiate with a SaaS vendor is the last week of their quarter.",
];

const TIMEOUT_QUIPS = [
  "The AI was thinking so hard it pulled a hamstring.",
  "Somewhere, a GPU is very embarrassed right now.",
  "The AI went for a coffee mid-report and lost track of time. Rude.",
  "Even robots have Mondays.",
];

const NETWORK_QUIPS = [
  "The internet ate our homework.",
  "The packets went out for milk and never came back.",
  "Your Wi-Fi and our server are no longer on speaking terms.",
  "We'd blame the cloud, but it's just someone else's computer having a bad day.",
];

const RATELIMIT_QUIPS = [
  "Whoa, speed racer — even the AI needs to catch its breath.",
  "You've officially out-worked the robot. Take a victory lap.",
  "The hamsters powering our servers have filed for a break.",
];

const AI_QUIPS = [
  "The AI wrote a beautiful report, then dropped it in a puddle.",
  "It had the answer, we promise. It just... blinked.",
  "Great minds occasionally return malformed JSON.",
];

export type ErrorKind = "timeout" | "network" | "ratelimit" | "ai";

const POOLS: Record<ErrorKind, string[]> = {
  timeout: TIMEOUT_QUIPS,
  network: NETWORK_QUIPS,
  ratelimit: RATELIMIT_QUIPS,
  ai: AI_QUIPS,
};

export function quipFor(kind: ErrorKind): string {
  const pool = POOLS[kind];
  return pool[Math.floor(Math.random() * pool.length)];
}
