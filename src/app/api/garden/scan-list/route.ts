import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { image, mediaType } = await request.json() as {
    image: string;       // base64-encoded image data
    mediaType: string;   // e.g. "image/jpeg"
  };

  if (!image || !mediaType) {
    return NextResponse.json({ error: "Missing image data" }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: image,
            },
          },
          {
            type: "text",
            text: `This is a handwritten or printed list of plant names/varieties. Extract every plant name or variety name you can read from this image.

Return ONLY a JSON array of strings — no explanation, no markdown, no extra text. Each string should be one plant name or variety as written. Preserve capitalization as written. Ignore quantities like "(2)" or section headers like "1 gallon", "2-3 gallon cont..." — only include the actual plant/variety names.

Example output: ["Brown Turkey", "Celeste", "LSU Gold", "Tiger"]`,
          },
        ],
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";

  let names: string[] = [];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    names = match ? (JSON.parse(match[0]) as string[]) : [];
  } catch {
    return NextResponse.json({ error: "Could not parse plant names from image" }, { status: 422 });
  }

  return NextResponse.json({ names: names.filter((n) => typeof n === "string" && n.trim()) });
}
