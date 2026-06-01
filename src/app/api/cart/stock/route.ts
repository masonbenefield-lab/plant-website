import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function POST(req: Request) {
  const { listingIds } = await req.json() as { listingIds: string[] };
  if (!listingIds?.length) return NextResponse.json({ stock: {} });

  // Use the service-role admin client — same pattern as cart-checkout route.
  // RLS is intentionally bypassed so we can read sold_out/paused listings too.
  const supabase = createAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("listings")
    .select("id, quantity, status")
    .in("id", listingIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Default every requested ID to 0 first — if a listing isn't in the result
  // (deleted, or status filtered by any future RLS change) treat it as no stock.
  const stock: Record<string, number> = {};
  for (const id of listingIds) stock[id] = 0;
  for (const l of data ?? []) {
    stock[l.id] = l.status === "sold_out" ? 0 : (l.quantity ?? 0);
  }

  return NextResponse.json({ stock });
}
