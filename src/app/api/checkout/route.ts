import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error(JSON.stringify({ step: "checkout", error: "STRIPE_SECRET_KEY not set" }));
    return NextResponse.json({ error: "Payment not configured" }, { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let body: { problem?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { problem } = body;

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
    success_url: `${origin}/success`,
    cancel_url: `${origin}/solution`,
    metadata: { problem: problem.slice(0, 500) },
  });

  return NextResponse.json({ url: session.url });
}
