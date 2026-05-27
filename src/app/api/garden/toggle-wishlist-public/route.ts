import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { public: isPublic } = await req.json();

  const { error } = await supabase
    .from("profiles")
    .update({ wishlist_public: !!isPublic })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  return NextResponse.json({ ok: true, wishlist_public: !!isPublic });
}
