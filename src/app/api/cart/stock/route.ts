import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function POST(req: Request) {
  const { listingIds } = await req.json() as { listingIds: string[] };
  if (!listingIds?.length) return NextResponse.json({ stock: {} });

  const supabase = createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from("listings")
    .select("id, quantity, status")
    .in("id", listingIds);

  const stock: Record<string, number> = {};
  for (const l of data ?? []) {
    stock[l.id] = l.status === "sold_out" ? 0 : (l.quantity ?? 0);
  }

  return NextResponse.json({ stock });
}
