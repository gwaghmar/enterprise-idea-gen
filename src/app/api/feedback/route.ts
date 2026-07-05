import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";

// Feedback loop: thumbs + optional comment from the report page.
// Logged (visible in Vercel logs) and mirrored to Blob when configured.
export async function POST(req: NextRequest) {
  if (!rateLimit(`fb:${clientIp(req)}`, 10, 3_600_000)) {
    return tooMany("Too much feedback too fast — thank you though!");
  }
  let body: { rating?: string; comment?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const rating = body.rating === "up" || body.rating === "down" ? body.rating : null;
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 1000) : "";
  const title = typeof body.title === "string" ? body.title.slice(0, 140) : "";
  if (!rating && !comment) {
    return NextResponse.json({ error: "Empty feedback" }, { status: 400 });
  }
  const entry = { rating, comment, title, ts: new Date().toISOString() };
  console.log(JSON.stringify({ step: "feedback", ...entry }));
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await put(`feedback/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`, JSON.stringify(entry), {
        access: "public", contentType: "application/json",
      });
    } catch { /* log line above is the fallback record */ }
  }
  return NextResponse.json({ ok: true });
}
