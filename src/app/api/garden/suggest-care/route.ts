import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// Untyped admin client — care_suggestions isn't in the generated types yet.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const CACHE_DAYS = 365;

// Sane bounds per care type. A value outside the range (or a non-number) falls
// back to the conservative default — catches the occasional bad model answer.
const BOUNDS = {
  water:     { min: 1,  max: 60,   fallback: 7   },
  fertilize: { min: 7,  max: 180,  fallback: 30  },
  prune:     { min: 14, max: 730,  fallback: 90  },
  repot:     { min: 90, max: 1095, fallback: 365 },
} as const;

function clampDays(key: keyof typeof BOUNDS, value: unknown): number {
  const b = BOUNDS[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return b.fallback;
  const rounded = Math.round(value);
  return rounded < b.min || rounded > b.max ? b.fallback : rounded;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length < 3) return NextResponse.json({ suggestion: null });

  const supabase = adminClient();

  // Return a cached suggestion if fresh (same pattern as /api/plant-info).
  const { data: cached } = await supabase
    .from("care_suggestions")
    .select("water, fertilize, prune, repot, confidence, created_at")
    .eq("query", q)
    .single();

  if (cached) {
    const ageMs = Date.now() - new Date(cached.created_at as string).getTime();
    if (ageMs < CACHE_DAYS * 24 * 60 * 60 * 1000) {
      return NextResponse.json({
        suggestion: {
          water: cached.water, fertilize: cached.fertilize,
          prune: cached.prune, repot: cached.repot, confidence: cached.confidence,
        },
      });
    }
  }

  // Cache miss — ask Claude (Haiku, same model the plant guide uses).
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: `You are a horticulture assistant for a US plant marketplace. For the plant "${q}" kept indoors in a pot, give typical STARTING care intervals in whole days. Reply with ONLY compact JSON, no markdown, no extra text: {"water":N,"fertilize":N,"prune":N,"repot":N,"confidence":"high"|"medium"|"low"}. Set confidence to "low" if you are unsure the term is a real plant. If it is clearly not a plant, reply only with the word NULL.`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text.trim() : null;
  if (!text || text === "NULL") return NextResponse.json({ suggestion: null });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ suggestion: null });
  }

  const confidence = ["high", "medium", "low"].includes(parsed.confidence as string)
    ? (parsed.confidence as string)
    : "low";
  const suggestion = {
    water: clampDays("water", parsed.water),
    fertilize: clampDays("fertilize", parsed.fertilize),
    prune: clampDays("prune", parsed.prune),
    repot: clampDays("repot", parsed.repot),
    confidence,
  };

  await supabase.from("care_suggestions").upsert({ query: q, ...suggestion });

  return NextResponse.json({ suggestion });
}
