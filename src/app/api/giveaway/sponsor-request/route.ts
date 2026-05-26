import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { item_name, message } = await req.json();
  if (!item_name?.trim()) return NextResponse.json({ error: "Item name is required" }, { status: 400 });

  // One open request at a time
  const { data: existing } = await supabase
    .from("giveaway_sponsor_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "open")
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "You already have an open sponsor request." }, { status: 400 });

  const { data, error } = await supabase
    .from("giveaway_sponsor_requests")
    .insert({ user_id: user.id, item_name: item_name.trim(), message: message?.trim() || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
