import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error(JSON.stringify({ step: "checkout", error: "STRIPE_SECRET_KEY not set" }));
    return NextResponse.json({ error: "Payment not configured" }, { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let body: { problem?: string; sid?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { problem } = body;
  const sid = typeof body.sid === "string" ? body.sid.slice(0, 40) : "";

  if (!problem || typeof problem !== "string") {
    return NextResponse.json({ error: "Problem is required" }, { status: 400 });
  }

  const host = req.headers.get("host") || "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const origin = req.headers.get("origin") || `${proto}://${host}`;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Enterprise Solution",
            description: "AI-generated workflow solution for your business problem",
          },
          unit_amount: 100,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/solution`,
    metadata: { problem: problem.slice(0, 500), sid },
  });

  return NextResponse.json({ url: session.url });
}

// Verify a completed checkout session — the success page calls this so the
// paid flag comes from Stripe, not from the client guessing.
export async function GET(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Payment not configured" }, { status: 503 });
  }
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    // Confirm this is one of OUR $1 unlock sessions, not any paid session
    // that happens to exist on the Stripe account
    const paid =
      session.payment_status === "paid" &&
      session.mode === "payment" &&
      session.amount_total === 100 &&
      session.currency === "usd";
    return NextResponse.json({
      paid,
      sid: session.metadata?.sid ?? "",
    });
  } catch {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
}
