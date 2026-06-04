import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { garden_bio, open_to_trades, disclaimer_accepted } = body;

  if (open_to_trades && !disclaimer_accepted) {
    return NextResponse.json({ error: "You must accept the disclaimer to enable trades." }, { status: 400 });
  }

  const update: Record<string, unknown> = { open_to_trades: !!open_to_trades };
  if ("garden_bio" in body) update.garden_bio = garden_bio?.trim() || null;
  if (open_to_trades && disclaimer_accepted) update.trades_disclaimer_accepted = true;

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
