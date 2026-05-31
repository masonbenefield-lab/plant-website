import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (!q || q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .order("username")
    .limit(10);

  if (error) return NextResponse.json({ users: [] });

  // Exclude the current user and anyone they've blocked
  let blockedIds = new Set<string>();
  if (user) {
    const { data: blocks } = await supabase
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id);
    blockedIds = new Set((blocks ?? []).map((b) => b.blocked_id));
  }

  const users = (data ?? []).filter(
    (p) => p.id !== user?.id && !blockedIds.has(p.id)
  );

  return NextResponse.json({ users });
}
