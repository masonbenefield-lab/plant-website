import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

// Untyped admin client — care_suggestions isn't in the generated types yet.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const CACHE_DAYS = 365;

// Sane bounds per care type. Out-of-range / non-number falls back to the default.
const BOUNDS = {
  water:     { min: 1,  max: 60,   fallback: 7   },
  fertilize: { min: 7,  max: 180,  fallback: 30  },
  repot:     { min: 90, max: 1095, fallback: 365 },
} as const;

function clampDays(key: keyof typeof BOUNDS, value: unknown): number {
  const b = BOUNDS[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return b.fallback;
  const rounded = Math.round(value);
  return rounded < b.min || rounded > b.max ? b.fallback : rounded;
}

export async function GET(request: Request) {
  // Require a logged-in user — this endpoint triggers paid LLM calls on cache miss.
  const ctx = await createServerClient();
  const { data: { user } } = await ctx.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!checkRateLimit(`suggest-care:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const potting = searchParams.get("potting") === "ground" ? "ground" : "pot";
  const potSize = (searchParams.get("potSize") ?? "").trim();
  if (q.length < 3) return NextResponse.json({ suggestion: null });

  const isPotted = potting === "pot";
  // Cache key bakes in potting + size, since the answer depends on them.
  const cacheKey = `${q}|${potting}|${isPotted ? potSize : ""}`;

  const supabase = adminClient();

  const { data: cached } = await supabase
    .from("care_suggestions")
    .select("water, fertilize, repot, prune_advice, confidence, created_at")
    .eq("query", cacheKey)
    .single();

  if (cached) {
    const ageMs = Date.now() - new Date(cached.created_at as string).getTime();
    if (ageMs < CACHE_DAYS * 24 * 60 * 60 * 1000) {
      return NextResponse.json({
        suggestion: {
          water: cached.water, fertilize: cached.fertilize,
          repot: cached.repot, pruneAdvice: cached.prune_advice, confidence: cached.confidence,
        },
      });
    }
  }

  const potContext = isPotted
    ? `It is grown IN A POT${potSize ? ` (about ${potSize})` : ""}, so include a repot interval.`
    : `It is planted IN THE GROUND, so DO NOT suggest repotting (set "repot" to null) and assume established-plant watering, which is much less frequent than potted.`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 220,
    messages: [
      {
        role: "user",
        content: `You are a horticulture assistant for a US plant marketplace. For the plant "${q}": ${potContext}

Give typical STARTING care intervals in whole days for water and fertilize, a repot interval in days (or null if in the ground), and SHORT pruning guidance as text (we do not know the user's climate, so describe the typical season/timing and frequency, e.g. "Prune once a year while dormant in late winter").

Reply with ONLY compact JSON, no markdown, no extra text:
{"water":N,"fertilize":N,"repot":N_or_null,"prune_advice":"short sentence","confidence":"high"|"medium"|"low"}
Set confidence to "low" if you are unsure the term is a real plant. If it is clearly not a plant, reply only with the word NULL.`,
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
  const pruneAdvice = typeof parsed.prune_advice === "string"
    ? parsed.prune_advice.slice(0, 280)
    : null;
  // Repot only applies to potted plants; otherwise null regardless of the model.
  const repot = isPotted ? clampDays("repot", parsed.repot) : null;

  const suggestion = {
    water: clampDays("water", parsed.water),
    fertilize: clampDays("fertilize", parsed.fertilize),
    repot,
    pruneAdvice,
    confidence,
  };

  await supabase.from("care_suggestions").upsert({
    query: cacheKey,
    water: suggestion.water,
    fertilize: suggestion.fertilize,
    repot: suggestion.repot,
    prune_advice: suggestion.pruneAdvice,
    confidence: suggestion.confidence,
  });

  return NextResponse.json({ suggestion });
}
