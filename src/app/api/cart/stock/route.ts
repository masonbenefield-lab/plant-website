import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function POST(req: Request) {
  const { listingIds } = await req.json() as { listingIds: string[] };
  if (!listingIds?.length) return NextResponse.json({ stock: {} });

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .from("listings")
    .select("id, quantity, status")
    .in("id", listingIds);

  // Default every requested ID to 0 — if a listing isn't returned (RLS hides
  // sold_out/paused rows, or it was deleted) we treat it as no stock available.
  const stock: Record<string, number> = {};
  for (const id of listingIds) stock[id] = 0;
  for (const l of data ?? []) {
    stock[l.id] = l.status === "sold_out" ? 0 : (l.quantity ?? 0);
  }

  return NextResponse.json({ stock });
}
