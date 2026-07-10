import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";
import { maybeDistill } from "@/lib/learning";
import { sameOrigin, forbidden } from "@/lib/security";

// Feedback loop: thumbs + optional comment from the report page.
// Logged (visible in Vercel logs) and mirrored to Blob when configured.
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  if (!rateLimit(`fb:${clientIp(req)}`, 10, 3_600_000)) {
    return tooMany("Too much feedback too fast — thank you though!");
  }
  let body: { rating?: string; comment?: string; title?: string; kind?: string; detail?: string; problem?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const rating = body.rating === "up" || body.rating === "down" ? body.rating : null;
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 1000) : "";
  const title = typeof body.title === "string" ? body.title.slice(0, 140) : "";
  // Behavioral events feed the learning loop too: tool swaps and remixes are
  // implicit feedback about what the AI got wrong
  const kind = ["rating", "swap", "remix", "tech", "refine"].includes(body.kind ?? "") ? body.kind : "rating";
  const detail = typeof body.detail === "string" ? body.detail.trim().slice(0, 300) : "";
  // The originating problem, when the client sends it, lets failure analysis
  // graduate a recurring complaint into a runnable golden case (it needs the
  // input to replay). Optional — older clients / privacy just omit it.
  const problem = typeof body.problem === "string" ? body.problem.trim().slice(0, 400) : "";
  if (!rating && !comment && !detail) {
    return NextResponse.json({ error: "Empty feedback" }, { status: 400 });
  }
  const entry = { kind, rating, comment, detail, title, problem, ts: new Date().toISOString() };
  console.log(JSON.stringify({ step: "feedback", ...entry }));
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await put(`feedback/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`, JSON.stringify(entry), {
        access: "public", contentType: "application/json",
      });
    } catch { /* log line above is the fallback record */ }
  }
  // Learning loop: fire-and-forget distillation of recent events into lessons
  maybeDistill();
  return NextResponse.json({ ok: true });
}
