import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const CACHE_DAYS = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

  if (q.length < 3) return NextResponse.json({ description: null });

  const supabase = adminClient();

  // Return cached description if fresh
  const { data: cached } = await supabase
    .from("plant_descriptions")
    .select("description, created_at")
    .eq("query", q)
    .single();

  if (cached) {
    const ageMs = Date.now() - new Date(cached.created_at).getTime();
    if (ageMs < CACHE_DAYS * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ description: cached.description });
    }
  }

  // Call Claude
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 120,
    messages: [
      {
        role: "user",
        content: `You are a helpful gardening assistant on a plant marketplace. Given the search term "${q}", if it is a plant, write exactly 2 concise sentences for beginner gardeners covering care difficulty, light and water needs, and whether it's good for beginners. Do not include any headings, markdown, or the plant name at the start — just the sentences. If it is not a plant, reply only with the word NULL.`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text.trim() : null;

  if (!text || text === "NULL") return NextResponse.json({ description: null });

  // Cache the result
  await supabase.from("plant_descriptions").upsert({ query: q, description: text });

  return NextResponse.json({ description: text });
}
