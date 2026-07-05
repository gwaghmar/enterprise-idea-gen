import { NextRequest } from "next/server";

// Same-origin check for expensive/mutating API routes: browsers always send
// an Origin header on cross-site POSTs, so requiring it to match our host
// stops other websites and casual scripts from driving up our model bill.
// Requests with no Origin at all (curl, server-to-server) are allowed through
// to the rate limiter — this is an abuse-cost raiser, not the only wall.
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const host = req.headers.get("host") ?? "";
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function forbidden(): Response {
  return new Response(JSON.stringify({ error: "Cross-origin requests are not allowed" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
