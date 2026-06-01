import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { listingIds } = await req.json() as { listingIds: string[] };
  if (!listingIds?.length) return NextResponse.json({ stock: {} });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("id, quantity, status")
    .in("id", listingIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Default every requested ID to 0 — if a listing isn't returned (RLS hides
  // sold_out/paused rows, or it was deleted) we treat it as no stock available.
  const stock: Record<string, number> = {};
  for (const id of listingIds) stock[id] = 0;
  for (const l of data ?? []) {
    stock[l.id] = l.status === "sold_out" ? 0 : (l.quantity ?? 0);
  }

  return NextResponse.json({ stock });
}
