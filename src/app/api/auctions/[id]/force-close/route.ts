import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!(profile as { is_admin?: boolean } | null)?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: auctionId } = await params;
  const admin = adminClient();

  const { error } = await admin
    .from("auctions")
    .update({ ends_at: new Date(Date.now() - 2 * 60 * 1000).toISOString() })
    .eq("id", auctionId)
    .eq("status", "active");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.shop").replace(/\/$/, "");
  const closeRes = await fetch(`${appUrl}/api/auctions/close`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const closeData = await closeRes.json().catch(() => ({}));

  return NextResponse.json({ ok: true, closeResult: closeData });
}
