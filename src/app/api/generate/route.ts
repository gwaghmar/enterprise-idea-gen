import { NextRequest } from "next/server";
import OpenAI from "openai";

const encoder = new TextEncoder();

function send(controller: ReadableStreamDefaultController, data: object) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

async function jinaFetch(url: string): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    return text.slice(0, 3000);
  } catch {
    return "";
  }
}

function log(reqId: string, step: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ reqId, step, ts: new Date().toISOString(), ...data }));
}

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(36).slice(2, 9);

  let body: { problem?: string; size?: string; stack?: string; budget?: string; timeline?: string };
  try {
    body = await req.json();
  } catch {
    console.error(JSON.stringify({ reqId, step: "parse_body", error: "Invalid or empty JSON body" }));
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const { problem, size, stack, budget, timeline } = body;

  if (!problem) {
    return new Response(JSON.stringify({ error: "Problem is required" }), { status: 400 });
  }

  log(reqId, "start", { problem: problem.slice(0, 80), size, stack, budget, timeline });

  const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY!,
  });

  const userContext = `Company: ${size} | Stack: ${stack} | Budget: ${budget} | Timeline: ${timeline}`;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1 — Perplexity web search
        send(controller, { progress: 5, step: 1, message: "Connecting to Perplexity Sonar Pro..." });
        const t1 = Date.now();

        const searchResult = await openrouter.chat.completions.create({
          model: "perplexity/sonar-pro",
          messages: [{
            role: "user",
            content: `Research the best enterprise solution for this problem:
Problem: "${problem}"
Context: ${userContext}

Search for:
- Best tools and platforms for this specific use case
- Real pricing and integration details
- Implementation approaches used by similar companies
- Limitations and tradeoffs of top options

Be specific about tool names, pricing tiers, and integration capabilities.`,
          }],
          temperature: 0.3,
        });

        const searchContent = searchResult.choices[0].message.content || "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const citations: string[] = (searchResult as any).citations ?? [];
        log(reqId, "perplexity_done", { ms: Date.now() - t1, citations: citations.length, tokens: searchResult.usage?.total_tokens });

        send(controller, {
          progress: 30,
          step: 1,
          message: `Perplexity found ${citations.length} sources`,
          citations,
          done: false,
        });

        // Step 2 — Jina reads each source
        const topUrls = citations.slice(0, 3);
        const jinaContents: string[] = [];
        const t2 = Date.now();

        for (let i = 0; i < topUrls.length; i++) {
          send(controller, {
            progress: 35 + i * 10,
            step: 2,
            message: `Reading source ${i + 1} of ${topUrls.length}: ${new URL(topUrls[i]).hostname}`,
          });
          const content = await jinaFetch(topUrls[i]);
          jinaContents.push(content);
          log(reqId, `jina_source_${i + 1}`, { url: topUrls[i], chars: content.length });
        }

        const sourceContent = topUrls
          .map((url, i) => jinaContents[i] ? `SOURCE: ${url}\n${jinaContents[i]}` : "")
          .filter(Boolean)
          .join("\n\n---\n\n");

        log(reqId, "jina_done", { ms: Date.now() - t2, sourcesRead: jinaContents.filter(Boolean).length });
        send(controller, {
          progress: 60,
          step: 2,
          message: `Read ${jinaContents.filter(Boolean).length} sources in full`,
        });

        // Step 3 — DeepSeek R1 reasoning (streaming)
        send(controller, {
          progress: 65,
          step: 3,
          message: "DeepSeek R1 starting to reason...",
        });
        const t3 = Date.now();

        const reasoningStream = await openrouter.chat.completions.create({
          model: "deepseek/deepseek-r1",
          stream: true,
          messages: [{
            role: "user",
            content: `You are an enterprise solution architect. Reason carefully and build a specific, actionable solution.

USER CONTEXT:
- Problem: "${problem}"
- Company size: ${size}
- Current stack: ${stack}
- Budget: ${budget}
- Timeline: ${timeline}

RESEARCH FINDINGS (from live web search):
${searchContent}

FULL SOURCE CONTENT (read from top sources):
${sourceContent || "No additional source content available."}

Based on ALL of the above, build a solution that is:
- Specific to this company's size, stack, and budget
- Uses tools that actually integrate with ${stack}
- Realistic for a ${timeline} timeline
- Within ${budget} budget

Return ONLY valid JSON:
{
  "title": "Specific solution title (not generic)",
  "summary": "2-3 sentences. Be specific about what tools, why these tools for their stack, and what outcome they get.",
  "tools": [
    {
      "name": "Exact tool name",
      "purpose": "What it does in this solution",
      "category": "Category",
      "whyForYou": "Why this specifically for ${size} on ${stack} within ${budget}",
      "vendorQuestions": ["Question to ask vendor before buying", "Question about integration", "Question about pricing/contract"]
    }
  ],
  "phases": [
    {
      "title": "Phase 1 — Week 1-2",
      "actions": ["Specific action", "Specific action"],
      "nodes": [
        { "id": "p1_1", "label": "3-5 word action", "type": "start|process|decision|end" }
      ],
      "edges": [
        { "from": "p1_1", "to": "p1_2", "label": "optional" }
      ]
    },
    {
      "title": "Phase 2 — Week 3-4",
      "actions": ["Specific action"],
      "nodes": [
        { "id": "p2_1", "label": "3-5 word action", "type": "start|process|decision|end" }
      ],
      "edges": [
        { "from": "p2_1", "to": "p2_2" }
      ]
    },
    {
      "title": "Phase 3 — Month 2+",
      "actions": ["Specific action"],
      "nodes": [
        { "id": "p3_1", "label": "3-5 word action", "type": "start|process|decision|end" }
      ],
      "edges": []
    }
  ],
  "estimatedCost": "Specific monthly cost breakdown",
  "timeToImplement": "Realistic estimate for ${size}"
}

CRITICAL for nodes: labels must be SHORT action phrases (3-5 words max). No descriptions. Each phase should have 3-5 nodes showing the workflow for THAT phase only. Node IDs must be unique across all phases (prefix with phase number like p1_, p2_, p3_).`,
          }],
          temperature: 0.5,
        });

        // Stream DeepSeek tokens, update progress 65→90
        let fullContent = "";
        let tokenCount = 0;

        for await (const chunk of reasoningStream) {
          const delta = chunk.choices[0]?.delta?.content || "";
          fullContent += delta;
          tokenCount++;

          // Send progress every 20 tokens
          if (tokenCount % 20 === 0) {
            const progress = Math.min(90, 65 + Math.floor((tokenCount / 300) * 25));
            send(controller, {
              progress,
              step: 3,
              message: `DeepSeek R1 reasoning... (${tokenCount} tokens)`,
            });
          }
        }

        log(reqId, "deepseek_done", { ms: Date.now() - t3, tokens: tokenCount, contentLen: fullContent.length });
        send(controller, { progress: 92, step: 3, message: "Parsing solution..." });

        // DeepSeek R1 wraps output in <think>...</think> before JSON — strip it
        const stripped = fullContent.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

        // Find the outermost complete JSON object
        let solution;
        try {
          const start = stripped.indexOf("{");
          const end = stripped.lastIndexOf("}");
          if (start === -1 || end === -1 || end <= start) throw new Error("No JSON found");
          solution = JSON.parse(stripped.slice(start, end + 1));
        } catch (parseErr) {
          console.error(JSON.stringify({ reqId, step: "json_parse_failed", contentLen: fullContent.length, strippedPreview: stripped.slice(0, 300), error: String(parseErr) }));
          send(controller, {
            progress: 100,
            done: true,
            error: "AI returned an incomplete response. Please try again.",
          });
          controller.close();
          return;
        }

        const totalTokens = (searchResult.usage?.total_tokens ?? 0) + tokenCount;
        log(reqId, "complete", { totalTokens, totalMs: Date.now() - t1 });

        // Send final solution
        send(controller, {
          progress: 100,
          step: 4,
          message: "Solution ready",
          done: true,
          solution,
          problem,
          context: { size, stack, budget, timeline },
          citations,
          model: "perplexity/sonar-pro → jina reader → deepseek/r1",
          tokens: totalTokens,
        });

        controller.close();
      } catch (err) {
        console.error(JSON.stringify({ reqId, step: "unhandled_error", error: err instanceof Error ? err.message : String(err) }));
        send(controller, {
          progress: 100,
          done: true,
          error: err instanceof Error ? err.message : "Unknown error",
        });
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
