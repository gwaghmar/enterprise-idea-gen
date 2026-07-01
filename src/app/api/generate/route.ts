import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

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

export async function POST(req: NextRequest) {
  const { problem, size, stack, budget, timeline } = await req.json();

  if (!problem) {
    return NextResponse.json({ error: "Problem is required" }, { status: 400 });
  }

  const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY!,
  });

  const userContext = `Company: ${size} | Stack: ${stack} | Budget: ${budget} | Timeline: ${timeline}`;

  // Step 1 — Perplexity searches the web
  const searchPrompt = `Research the best enterprise solution for this problem:

Problem: "${problem}"
Context: ${userContext}

Search for:
- Best tools and platforms for this specific use case
- Real pricing and integration details
- Implementation approaches used by similar companies
- Limitations and tradeoffs of top options

Be specific about tool names, pricing tiers, and integration capabilities.`;

  const searchResult = await openrouter.chat.completions.create({
    model: "perplexity/sonar-pro",
    messages: [{ role: "user", content: searchPrompt }],
    temperature: 0.3,
  });

  const searchContent = searchResult.choices[0].message.content || "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const citations: string[] = (searchResult as any).citations ?? [];

  // Step 2 — Jina reads top 3 sources in full
  const topUrls = citations.slice(0, 3);
  const jinaResults = await Promise.all(topUrls.map(jinaFetch));
  const sourceContent = topUrls
    .map((url, i) => jinaResults[i] ? `SOURCE: ${url}\n${jinaResults[i]}` : "")
    .filter(Boolean)
    .join("\n\n---\n\n");

  // Step 3 — DeepSeek R1 reasons over everything
  const reasoningPrompt = `You are an enterprise solution architect. Reason carefully and build a specific, actionable solution.

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
      "whyForYou": "Why this specifically for ${size} on ${stack} within ${budget}"
    }
  ],
  "nodes": [
    { "id": "1", "label": "3-5 word action", "type": "start|process|decision|end" }
  ],
  "edges": [
    { "from": "1", "to": "2", "label": "optional short label" }
  ],
  "phases": [
    { "title": "Phase 1 — Week 1-2", "actions": ["Specific action", "Specific action"] },
    { "title": "Phase 2 — Week 3-4", "actions": ["Specific action"] },
    { "title": "Phase 3 — Month 2+", "actions": ["Specific action"] }
  ],
  "estimatedCost": "Specific monthly cost breakdown",
  "timeToImplement": "Realistic estimate for ${size}"
}

CRITICAL for nodes: labels must be SHORT action phrases (3-5 words max). No descriptions. Good examples: "Trigger new hire event", "Send document request", "Check docs complete". Bad: long sentences.
Include 6-9 nodes that tell a clear story left to right.`;

  const reasoningResult = await openrouter.chat.completions.create({
    model: "deepseek/deepseek-r1",
    messages: [{ role: "user", content: reasoningPrompt }],
    temperature: 0.5,
  });

  const reasoningContent = reasoningResult.choices[0].message.content || "";

  let solution;
  try {
    const jsonMatch = reasoningContent.match(/\{[\s\S]*\}/);
    solution = JSON.parse(jsonMatch ? jsonMatch[0] : reasoningContent);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse solution", raw: reasoningContent },
      { status: 500 }
    );
  }

  return NextResponse.json({
    solution,
    problem,
    context: { size, stack, budget, timeline },
    citations,
    model: "perplexity/sonar-pro → jina reader → deepseek/r1",
    tokens: (searchResult.usage?.total_tokens ?? 0) + (reasoningResult.usage?.total_tokens ?? 0),
  });
}
