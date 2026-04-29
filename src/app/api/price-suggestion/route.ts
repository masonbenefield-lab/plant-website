import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function buildSuggestion(prices: number[], matchType: "variety" | "name") {
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];
  return {
    suggestion: {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median,
      count: prices.length,
      matchType,
    },
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const plant = searchParams.get("plant")?.trim() ?? "";
  const variety = searchParams.get("variety")?.trim() ?? "";

  if (plant.length < 2) return NextResponse.json({ suggestion: null });

  const supabase = await createClient();

  // Try variety-specific first when variety is provided
  if (variety.length >= 2) {
    const { data: varietyRows } = await supabase
      .from("listings")
      .select("price_cents")
      .eq("status", "active")
      .ilike("plant_name", `%${plant}%`)
      .ilike("variety", `%${variety}%`);

    if (varietyRows && varietyRows.length >= 3) {
      return NextResponse.json(
        buildSuggestion(
          varietyRows.map((r) => r.price_cents),
          "variety"
        )
      );
    }
  }

  // Fall back to plant name only
  const { data: nameRows } = await supabase
    .from("listings")
    .select("price_cents")
    .eq("status", "active")
    .ilike("plant_name", `%${plant}%`);

  if (!nameRows || nameRows.length < 3) {
    return NextResponse.json({ suggestion: null });
  }

  return NextResponse.json(
    buildSuggestion(
      nameRows.map((r) => r.price_cents),
      "name"
    )
  );
}
