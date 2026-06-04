import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// review_reports is not in the generated types yet — use a raw typed helper
type RRClient = ReturnType<typeof createAdminClient<Database>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rr = (admin: RRClient) => (admin as any).from("review_reports");

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { reportId, action } = await req.json() as { reportId: string; action: "dismiss" | "delete" };
  if (!reportId || !["dismiss", "delete"].includes(action)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (action === "dismiss") {
    const { error } = await rr(admin).update({ status: "dismissed" }).eq("id", reportId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { data: report } = await rr(admin).select("rating_id").eq("id", reportId).single() as { data: { rating_id: string } | null };
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    await rr(admin).update({ status: "deleted" }).eq("id", reportId);

    const { error } = await admin.from("ratings").delete().eq("id", report.rating_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
