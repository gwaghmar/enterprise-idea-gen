import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  const { problem } = await req.json();

  if (!problem || typeof problem !== "string") {
    return NextResponse.json({ error: "Problem is required" }, { status: 400 });
  }

  const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY!,
  });

  const prompt = `You are an enterprise solution architect. A business has described this problem:

"${problem}"

Your task:
1. Think deeply about the best solution architecture
2. Research and recommend the top 3-5 specific tools/platforms (be specific: name real products like Salesforce, Zapier, AWS Lambda, etc.)
3. Design a clear step-by-step workflow

Return ONLY valid JSON in this exact format:
{
  "title": "Short solution title",
  "summary": "2-3 sentence executive summary of the solution",
  "tools": [
    { "name": "Tool Name", "purpose": "What it does in this solution", "category": "Category" }
  ],
  "nodes": [
    { "id": "1", "label": "Step label", "type": "start|process|decision|end", "description": "What happens here" }
  ],
  "edges": [
    { "from": "1", "to": "2", "label": "optional edge label" }
  ],
  "estimatedCost": "Monthly cost estimate",
  "timeToImplement": "e.g. 4-6 weeks"
}

Make nodes flow logically (start → process steps → end). Keep node labels short (3-5 words). Include 6-10 nodes.`;

  const completion = await openrouter.chat.completions.create({
    model: "perplexity/sonar-pro",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  const content = completion.choices[0].message.content || "";

  let solution;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    solution = JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response", raw: content }, { status: 500 });
  }

  return NextResponse.json({ solution, problem });
}
