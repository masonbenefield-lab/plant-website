import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function adminClient() {
  return createAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockedId, action } = await req.json() as { blockedId: string; action: "block" | "unblock" };
  if (!blockedId || blockedId === user.id) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const admin = adminClient();

  if (action === "block") {
    await admin.from("blocks").upsert({ blocker_id: user.id, blocked_id: blockedId });
    // Remove follows in both directions
    await Promise.all([
      admin.from("follows").delete().eq("follower_id", user.id).eq("seller_id", blockedId),
      admin.from("follows").delete().eq("follower_id", blockedId).eq("seller_id", user.id),
    ]);
  } else {
    await admin.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", blockedId);
  }

  return NextResponse.json({ success: true });
}
