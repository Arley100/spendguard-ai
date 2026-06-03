import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { matchIntent } from "../../../lib/match";
import { validateIntent, Intent, ALLOWED_METRICS } from "../../../lib/intent";
import { dispatch, QueryResult } from "../../../lib/dispatch";
import { templateNarrate } from "../../../lib/narrate";

interface Turn { role: "user" | "assistant"; content: string; }

interface AskResponse {
  question: string;
  intent: Intent;
  result: QueryResult;
  narration: string;
  narrationSource: "ai" | "template";
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

// --- Stage 1 (keyed): ask the model for a constrained JSON intent. ---
// The model chooses a metric from the closed menu; it never writes SQL and
// never computes anything. Its output is validated before use.
async function aiParseIntent(apiKey: string, question: string, history: Turn[]): Promise<Intent> {
  const system = [
    "You translate a finance question into a JSON intent for a fixed query engine.",
    "Respond with ONLY a JSON object, no prose, no markdown.",
    `The "metric" field MUST be exactly one of: ${ALLOWED_METRICS.join(", ")}.`,
    "Optional fields: categoryFilter (one of: Fuel, Permits and Government, Tires, Auto Service, Car Washes, Auto Parts, Tolls and Transport, Trailers, Dining), monthFilter (YYYY-MM), limit (integer).",
    "If the question does not fit any metric, use {\"metric\":\"unsupported\"}.",
    "You never compute or invent numbers. You only pick the metric.",
  ].join(" ");

  const messages = [
    ...history.slice(-4).map((t) => ({ role: t.role, content: t.content })),
    { role: "user" as const, content: question },
  ];

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 200, system, messages }),
  });
  if (!res.ok) throw new Error(`intent parse failed: ${res.status}`);
  const json = await res.json();
  const text = (json.content?.[0]?.text ?? "").trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return validateIntent(JSON.parse(cleaned));
}

// --- Stage 3 (keyed): the model narrates the COMPUTED result. ---
// It is given only the numbers the store produced and told to use only those.
async function aiNarrate(apiKey: string, question: string, result: QueryResult): Promise<string> {
  const system = [
    "You narrate a finance query result in one or two plain sentences for a non-technical manager.",
    "Use ONLY the numbers present in the provided result JSON. Never introduce any number not in it.",
    "For risk results, use the phrase 'candidates for review, not accusations'. Never use the word 'fraud'.",
    "Be precise and calm. No markdown, no bullet points.",
  ].join(" ");

  const userContent = `Question: ${question}\nResult JSON (the only source of numbers):\n${JSON.stringify(result)}`;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 200, system, messages: [{ role: "user", content: userContent }] }),
  });
  if (!res.ok) throw new Error(`narration failed: ${res.status}`);
  const json = await res.json();
  return (json.content?.[0]?.text ?? "").trim();
}

export async function POST(req: NextRequest) {
  let body: { question?: string; history?: Turn[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  const history = Array.isArray(body.history) ? body.history : [];
  if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 });

  const db = await getDb();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Stage 1: parse intent. Keyed -> model; otherwise -> deterministic matcher.
  // Any failure in the keyed path falls back to the matcher, never errors.
  let intent: Intent;
  let parsedByAi = false;
  if (apiKey) {
    try {
      intent = await aiParseIntent(apiKey, question, history);
      parsedByAi = true;
    } catch {
      intent = validateIntent(matchIntent(question));
    }
  } else {
    intent = validateIntent(matchIntent(question));
  }

  // Stage 2: deterministic dispatch. Every number originates here, always.
  const result = dispatch(db, intent);

  // Stage 3: narrate. Keyed -> model (with template fallback on error);
  // otherwise -> template. Unsupported always uses the template menu.
  let narration: string;
  let narrationSource: "ai" | "template";
  if (apiKey && parsedByAi && result.metric !== "unsupported") {
    try {
      narration = await aiNarrate(apiKey, question, result);
      narrationSource = "ai";
    } catch {
      narration = templateNarrate(result);
      narrationSource = "template";
    }
  } else {
    narration = templateNarrate(result);
    narrationSource = "template";
  }

  const response: AskResponse = { question, intent, result, narration, narrationSource };
  return NextResponse.json(response);
}