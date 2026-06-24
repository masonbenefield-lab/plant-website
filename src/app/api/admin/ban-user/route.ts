import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// 100 years — effectively permanent. Reversed by setting ban_duration to "none".
const BAN_DURATION = "876000h";

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

  const { targetUserId, action } = await request.json() as {
    targetUserId: string;
    action: "ban" | "unban";
  };

  if (!targetUserId || (action !== "ban" && action !== "unban")) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  if (targetUserId === user.id) {
    return NextResponse.json({ error: "You cannot ban yourself" }, { status: 400 });
  }

  const service = adminClient();

  const { data: target } = await service
    .from("profiles")
    .select("username, is_admin")
    .eq("id", targetUserId)
    .single();

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Admins are protected — same guarantee as the archive/rename actions.
  if (target.is_admin) {
    return NextResponse.json({ error: "Admins cannot be banned" }, { status: 400 });
  }

  // Block (or restore) the auth session itself. With a ban set, Supabase refuses
  // to issue or refresh tokens and getUser() rejects the existing one, so the
  // user is locked out of every authenticated route — a true login block.
  const { error: authError } = await service.auth.admin.updateUserById(targetUserId, {
    ban_duration: action === "ban" ? BAN_DURATION : "none",
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Mirror the state onto the profile for display + reversibility tracking.
  // banned_at lives outside the generated types until the next regen, so cast.
  const { error: profileError } = await service
    .from("profiles")
    .update({ banned_at: action === "ban" ? new Date().toISOString() : null } as never)
    .eq("id", targetUserId);

  if (profileError) {
    // Roll the auth ban back so the two never drift apart.
    await service.auth.admin.updateUserById(targetUserId, {
      ban_duration: action === "ban" ? "none" : BAN_DURATION,
    }).catch(() => {});
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // On ban, pull their content from the marketplace. On unban we leave listings
  // paused on purpose so they get re-reviewed before going live again.
  if (action === "ban") {
    await Promise.all([
      service.from("listings").update({ status: "paused" }).eq("seller_id", targetUserId).eq("status", "active"),
      service.from("auctions").update({ status: "cancelled" }).eq("seller_id", targetUserId).eq("status", "active"),
    ]);
  }

  await service.from("admin_audit_logs").insert({
    admin_id: user.id,
    action: action === "ban" ? "ban_user" : "unban_user",
    target_type: "user",
    target_id: targetUserId,
    notes: target.username,
  });

  return NextResponse.json({ success: true });
}
