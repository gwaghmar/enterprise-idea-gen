import { NextRequest } from "next/server";
import OpenAI from "openai";

const encoder = new TextEncoder();

function send(controller: ReadableStreamDefaultController, data: object) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

// Parallel Jina fetch — 5s timeout, 4500 chars per source
async function jinaFetch(url: string): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(5000),
    });
    return (await res.text()).slice(0, 4500);
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

  let body: {
    problem?: string; size?: string; stack?: string; budget?: string; timeline?: string;
    industry?: string; team?: string; seats?: string; techLevel?: string; compliance?: string;
  };
  try {
    body = await req.json();
  } catch {
    console.error(JSON.stringify({ reqId, step: "parse_body", error: "Invalid or empty JSON body" }));
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const { problem, size, stack, budget, timeline } = body;
  const industry = body.industry || "Not specified";
  const team = body.team || "Not specified";
  const seats = body.seats || "Not specified";
  const techLevel = body.techLevel || "Not specified";
  const compliance = body.compliance || "Not specified";

  if (!problem) {
    return new Response(JSON.stringify({ error: "Problem is required" }), { status: 400 });
  }

  log(reqId, "start", { problem: problem.slice(0, 80), size, stack, budget, timeline, industry, team, seats, techLevel, compliance });

  const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY!,
  });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ── Step 1: Perplexity — targeted enterprise research ──────────────
        send(controller, { progress: 5, step: 1, message: "Searching for enterprise tools and case studies..." });
        const t1 = Date.now();

        const searchResult = await openrouter.chat.completions.create({
          model: "perplexity/sonar-pro",
          messages: [{
            role: "user",
            content: `You are an enterprise technology researcher. Find the best real-world solutions for this specific problem.

COMPANY PROFILE:
- Problem: "${problem}"
- Industry: ${industry}
- Company size: ${size}
- Requesting team: ${team}
- Number of users/seats: ${seats}
- Team technical level: ${techLevel}
- Current tech stack: ${stack}
- Compliance / data sensitivity: ${compliance}
- Monthly budget: ${budget}
- Implementation timeline: ${timeline}

Find and compare:
1. The top 3-5 enterprise tools that solve this exact problem AND natively integrate with ${stack}, are appropriate for the ${industry} industry, and meet these compliance needs: ${compliance}
2. Real pricing for each tool at the ${size} tier for ~${seats} users (not just "contact sales" — find published pricing)
3. A real case study of a ${size} ${industry} company that solved this same problem (name the company, tool used, outcome)
4. The #1 mistake companies make when solving this problem
5. Any open-source or lower-cost alternatives if budget is tight
6. Procurement, security-review, and IT-onboarding requirements typical for tools like these (SSO/SAML, data residency, SOC2/DPA, CASB allow-listing such as Netskope, IP allow-listing)

Be specific: name exact products, pricing tiers, integration methods, compliance posture, and implementation timeframes.`,
          }],
          temperature: 0.2,
        });

        const searchContent = searchResult.choices[0].message.content || "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const citations: string[] = (searchResult as any).citations ?? [];
        log(reqId, "perplexity_done", { ms: Date.now() - t1, citations: citations.length, tokens: searchResult.usage?.total_tokens });

        send(controller, {
          progress: 30, step: 1,
          message: citations.length > 0 ? `Found ${citations.length} sources` : "Research complete",
          citations, done: false,
        });

        // ── Step 2: Jina — parallel source reading (skip if no citations) ──
        let sourceContent = "";
        if (citations.length > 0) {
          const topUrls = citations.slice(0, 4);
          send(controller, { progress: 35, step: 2, message: `Reading ${topUrls.length} sources in parallel...` });
          const t2 = Date.now();

          const jinaResults = await Promise.all(topUrls.map((url) => jinaFetch(url)));
          sourceContent = topUrls
            .map((url, i) => jinaResults[i] ? `SOURCE: ${url}\n${jinaResults[i]}` : "")
            .filter(Boolean)
            .join("\n\n---\n\n");

          log(reqId, "jina_done", { ms: Date.now() - t2, sourcesRead: jinaResults.filter(Boolean).length });
          send(controller, { progress: 58, step: 2, message: `Read ${jinaResults.filter(Boolean).length} sources` });
        } else {
          send(controller, { progress: 58, step: 2, message: "Proceeding with research findings" });
        }

        // ── Step 3: Claude Sonnet — structured solution synthesis ──────────
        send(controller, { progress: 63, step: 3, message: "Claude synthesizing your solution..." });
        const t3 = Date.now();

        const synthesisStream = await openrouter.chat.completions.create({
          model: "anthropic/claude-sonnet-4-5",
          stream: true,
          max_tokens: 6000,
          messages: [{
            role: "user",
            content: `You are a senior enterprise solution architect with 20 years of experience at McKinsey and Gartner. Build a specific, opinionated solution — not a generic overview. You cover not just WHICH tools, but exactly HOW to get them approved and rolled out inside this specific company.

COMPANY PROFILE:
- Problem: "${problem}"
- Industry: ${industry}
- Company size: ${size}
- Requesting team: ${team}
- Number of users/seats: ${seats}
- Team technical level: ${techLevel}
- Current stack: ${stack}
- Compliance / data sensitivity: ${compliance}
- Budget: ${budget}/month
- Timeline: ${timeline}

LIVE RESEARCH (from web search):
${searchContent}

${sourceContent ? `FULL SOURCE CONTENT:\n${sourceContent}` : ""}

INSTRUCTIONS:
- Pick ONE clear solution approach (don't hedge with "you could also...")
- Lead with the insight most companies miss about this problem
- Choose tools that ACTUALLY integrate with ${stack} — verify from the research above
- Match tool tier to ${budget} budget — no enterprise-only tools if budget is tight
- Fit the ${industry} industry and satisfy compliance needs: ${compliance}
- Match complexity to the team's technical level (${techLevel}) — no raw APIs for a no-code team
- Be realistic about ${timeline} — what's truly achievable vs what needs more time
- vendorQuestions should be sharp negotiation questions, not generic

CRITICAL — the rollout playbook, approvals, and vendor outreach MUST be tailored to company size:
- If "${size}" is Startup: keep red tape minimal. Usually the requester self-serves — sign up with a company card, connect it themselves, no procurement ticket. Name the ONE founder/lead who approves. Skip heavy security review unless compliance demands it.
- If "${size}" is SMB or Enterprise: assume real red tape. Name the internal roles/teams to involve (IT/Security, Legal, Procurement, Finance, Data/DBA), the exact TICKET to file (e.g. "Jira Service Desk → New Software Request" or "ServiceNow → Procurement Request"), who onboards the vendor, who provisions the database/application, and required IT controls: SSO/SAML provisioning, CASB allow-listing (e.g. Netskope/Zscaler), firewall IP allow-listing, DPA/data-processing agreement, and a security/IP (intellectual-property & infosec) risk review.
- riskAssessment: list the top real risks (security, data, vendor lock-in, adoption) with a severity and a concrete mitigation.
- vendorOutreach.email must be a ready-to-send short intro email the requester can copy-paste to the vendor.

Return ONLY valid JSON, no markdown, no explanation:
{
  "title": "Specific 4-8 word solution title",
  "insight": "The one thing most companies get wrong about this problem, in 1-2 sentences.",
  "summary": "2-3 sentences: what the solution is, which tools, and what measurable outcome they get.",
  "tools": [
    {
      "name": "Exact product name",
      "purpose": "What it does in this solution specifically",
      "category": "One of: Integration | Automation | CRM | Analytics | Storage | Security | Infrastructure | Communication",
      "whyForYou": "Why this tool for ${size} on ${stack} within ${budget} — be specific",
      "vendorQuestions": [
        "Specific question about native ${stack} integration",
        "Question about pricing at ${size} scale",
        "Question about implementation support or SLA"
      ]
    }
  ],
  "phases": [
    {
      "title": "Phase 1 — Week 1-2",
      "actions": ["Concrete action with owner and output", "Another concrete action"],
      "nodes": [
        { "id": "p1_1", "label": "Short action phrase", "type": "start" },
        { "id": "p1_2", "label": "Short action phrase", "type": "process" },
        { "id": "p1_3", "label": "Short action phrase", "type": "end" }
      ],
      "edges": [
        { "from": "p1_1", "to": "p1_2" },
        { "from": "p1_2", "to": "p1_3" }
      ]
    },
    {
      "title": "Phase 2 — Week 3-4",
      "actions": ["Concrete action"],
      "nodes": [
        { "id": "p2_1", "label": "Short action phrase", "type": "start" },
        { "id": "p2_2", "label": "Short action phrase", "type": "process" },
        { "id": "p2_3", "label": "Short action phrase", "type": "end" }
      ],
      "edges": [
        { "from": "p2_1", "to": "p2_2" },
        { "from": "p2_2", "to": "p2_3" }
      ]
    },
    {
      "title": "Phase 3 — Month 2+",
      "actions": ["Concrete action"],
      "nodes": [
        { "id": "p3_1", "label": "Short action phrase", "type": "start" },
        { "id": "p3_2", "label": "Short action phrase", "type": "process" },
        { "id": "p3_3", "label": "Short action phrase", "type": "end" }
      ],
      "edges": [
        { "from": "p3_1", "to": "p3_2" },
        { "from": "p3_2", "to": "p3_3" }
      ]
    }
  ],
  "estimatedCost": "Itemized: Tool A $X/mo + Tool B $Y/mo = $Z/mo total",
  "timeToImplement": "Realistic timeline for ${size} with ${timeline} urgency",
  "rolloutPlaybook": {
    "stakeholders": [
      { "role": "e.g. IT Security Lead / Founder / DBA", "team": "e.g. IT / Security", "responsibility": "What they own — e.g. approves vendor, provisions the database, onboards the app", "whenToContact": "e.g. Before purchase / Week 1" }
    ],
    "tickets": [
      { "system": "e.g. Jira Service Desk / ServiceNow / None (self-serve)", "type": "e.g. New Software Request", "title": "Suggested ticket title to file", "assignTo": "Which team/queue" }
    ]
  },
  "approvals": {
    "permissions": [
      { "name": "e.g. Admin/OAuth scope, SSO app registration, DB access grant", "owner": "Who grants it", "why": "Why it is needed" }
    ],
    "itControls": [
      { "name": "e.g. Netskope/CASB allow-list, Firewall IP allow-list, SSO/SAML, DPA", "action": "Concrete step — e.g. add vendor domains/IPs to Netskope allow-list" }
    ],
    "riskAssessment": [
      { "risk": "Concrete risk", "severity": "Low | Medium | High", "mitigation": "Concrete mitigation" }
    ]
  },
  "vendorOutreach": {
    "howToReach": "How to contact the vendor — e.g. book a demo via site, ask for the ${size} tier + design partner discount",
    "email": "A short ready-to-send intro email to the vendor, personalized to this company and problem",
    "demoChecklist": ["Sharp thing to verify on the demo call", "Another", "Another"]
  }
}

Node labels: 3-5 words MAX. Node IDs must be unique (p1_, p2_, p3_ prefixes).`,
          }],
          temperature: 0.3,
        });

        let fullContent = "";
        let tokenCount = 0;

        for await (const chunk of synthesisStream) {
          const delta = chunk.choices[0]?.delta?.content || "";
          fullContent += delta;
          tokenCount++;
          if (tokenCount % 15 === 0) {
            const progress = Math.min(90, 63 + Math.floor((tokenCount / 250) * 27));
            send(controller, { progress, step: 3, message: `Building your solution... (${tokenCount} tokens)` });
          }
        }

        log(reqId, "claude_done", { ms: Date.now() - t3, tokens: tokenCount, contentLen: fullContent.length });
        send(controller, { progress: 93, step: 3, message: "Parsing solution..." });

        // Claude returns clean JSON — no <think> tags to strip
        let solution;
        try {
          const start = fullContent.indexOf("{");
          const end = fullContent.lastIndexOf("}");
          if (start === -1 || end === -1 || end <= start) throw new Error("No JSON found");
          solution = JSON.parse(fullContent.slice(start, end + 1));
        } catch (parseErr) {
          console.error(JSON.stringify({ reqId, step: "json_parse_failed", contentLen: fullContent.length, preview: fullContent.slice(0, 300), error: String(parseErr) }));
          send(controller, { progress: 100, done: true, error: "AI returned an incomplete response. Please try again." });
          controller.close();
          return;
        }

        const totalTokens = (searchResult.usage?.total_tokens ?? 0) + tokenCount;
        log(reqId, "complete", { totalTokens, totalMs: Date.now() - t1 });

        send(controller, {
          progress: 100, step: 4, message: "Solution ready", done: true,
          solution, problem,
          context: { size, stack, budget, timeline, industry, team, seats, techLevel, compliance },
          citations,
          model: "perplexity/sonar-pro → jina (parallel) → claude/sonnet-4-5",
          tokens: totalTokens,
        });

        controller.close();
      } catch (err) {
        console.error(JSON.stringify({ reqId, step: "unhandled_error", error: err instanceof Error ? err.message : String(err) }));
        send(controller, { progress: 100, done: true, error: err instanceof Error ? err.message : "Unknown error" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
