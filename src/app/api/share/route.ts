import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { readBlobJson } from "@/lib/blob-read";
import { sameOrigin, forbidden } from "@/lib/security";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  if (!rateLimit(`share:${clientIp(req)}`, 20, 3_600_000)) return tooMany("Slow down a little — try again in a bit.");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Share not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const id = Math.random().toString(36).slice(2, 10);
  const blob = await put(`solutions/${id}.json`, JSON.stringify(body), {
    access: "public",
    contentType: "application/json",
  });

  return NextResponse.json({ id, url: blob.url });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const data = await readBlobJson(`solutions/${id}.json`);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
