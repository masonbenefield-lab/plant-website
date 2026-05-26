import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, variety, notes, priority } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Plant name is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("wishlist_items")
    .insert({
      user_id: user.id,
      name: name.trim(),
      variety: variety?.trim() || null,
      notes: notes?.trim() || null,
      priority: priority ?? "want",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, variety, notes, priority } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: "Plant name is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("wishlist_items")
    .update({
      name: name.trim(),
      variety: variety?.trim() || null,
      notes: notes?.trim() || null,
      priority: priority ?? "want",
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
