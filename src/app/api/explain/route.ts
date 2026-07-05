import { NextRequest } from "next/server";
import OpenAI from "openai";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";
import { sameOrigin, forbidden } from "@/lib/security";

const encoder = new TextEncoder();

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  if (!rateLimit(`explain:${clientIp(req)}`, 60, 3_600_000)) {
    return tooMany("Too many questions this hour — try again in a bit.");
  }

  let body: { item?: string; itemType?: string; question?: string; solutionContext?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const item = typeof body.item === "string" ? body.item.slice(0, 600) : "";
  const itemType = typeof body.itemType === "string" ? body.itemType.slice(0, 60) : "";
  const question = typeof body.question === "string" ? body.question.slice(0, 400) : undefined;
  const solutionContext = typeof body.solutionContext === "string" ? body.solutionContext.slice(0, 4000) : "";
  if (!item || !solutionContext) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
  }

  const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY!,
  });

  const prompt = question
    ? `You are an enterprise solution consultant. The user is reviewing a solution and has a question about a specific item.

SOLUTION CONTEXT:
${solutionContext}

SELECTED ITEM (${itemType}): "${item}"

USER'S QUESTION: "${question}"

Answer their question in 2-4 sentences. Be specific, practical, and grounded in their solution context. No fluff. Only discuss this solution and related business/tooling topics — if asked for anything else, briefly decline and steer back to the solution.`
    : `You are an enterprise solution consultant. Explain this item from the user's solution.

SOLUTION CONTEXT:
${solutionContext}

SELECTED ITEM (${itemType}): "${item}"

Explain in 3-5 sentences: what this is, why it's in their solution, what it does for them specifically, and any key thing they should know before implementing it. Be practical and specific to their context.`;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await openrouter.chat.completions.create({
          model: "anthropic/claude-haiku-4-5",
          stream: true,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
        });

        for await (const chunk of response) {
          const delta = chunk.choices[0]?.delta?.content || "";
          if (delta) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`));
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
