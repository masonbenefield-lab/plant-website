import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { containsSlur } from "@/lib/profanity";
import type { Database } from "@/lib/supabase/types";

const USERNAME_RE = /^[a-z0-9_-]{3,30}$/;

function adminClient() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: admin } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!admin?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { targetUserId, newUsername } = await request.json() as {
    targetUserId: string;
    newUsername: string;
  };

  if (!targetUserId || !newUsername) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (!USERNAME_RE.test(newUsername)) {
    return NextResponse.json(
      { error: "Username must be 3–30 characters and contain only letters, numbers, _ or -" },
      { status: 400 }
    );
  }

  if (containsSlur(newUsername)) {
    return NextResponse.json({ error: "Username contains a prohibited word" }, { status: 400 });
  }

  const service = adminClient();

  // Uniqueness check
  const { data: existing } = await service
    .from("profiles")
    .select("id")
    .eq("username", newUsername)
    .neq("id", targetUserId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
  }

  const { data: target } = await service
    .from("profiles")
    .select("username")
    .eq("id", targetUserId)
    .single();

  const oldUsername = target?.username ?? targetUserId;

  const { error } = await service
    .from("profiles")
    .update({ username: newUsername })
    .eq("id", targetUserId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit log
  await service.from("admin_audit_logs").insert({
    admin_id: user.id,
    action: "rename_user",
    target_type: "user",
    target_id: targetUserId,
    notes: `${oldUsername} → ${newUsername}`,
  });

  return NextResponse.json({ success: true });
}
