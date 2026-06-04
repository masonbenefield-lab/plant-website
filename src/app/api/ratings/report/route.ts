import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const VALID_REASONS = ["fake", "harassment", "wrong_order", "other"] as const;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ratingId, reason, details } = await req.json() as {
    ratingId: string;
    reason: string;
    details?: string;
  };

  if (!ratingId || !reason) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (!VALID_REASONS.includes(reason as typeof VALID_REASONS[number])) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }
  if (details && details.length > 500) {
    return NextResponse.json({ error: "Details must be 500 characters or fewer" }, { status: 400 });
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Only the seller being reviewed can report the review
  const { data: rating } = await admin
    .from("ratings")
    .select("seller_id")
    .eq("id", ratingId)
    .single();

  if (!rating || rating.seller_id !== user.id) {
    return NextResponse.json({ error: "Not authorized to report this review" }, { status: 403 });
  }

  const { error } = await admin.from("review_reports").insert({
    rating_id: ratingId,
    reporter_id: user.id,
    reason,
    details: details?.trim() || null,
  } as never);

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "You already reported this review" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
