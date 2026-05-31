import { createClient as createAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function admin() {
  return createAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Returns true if either user has blocked the other.
 * Uses the admin client so RLS does not interfere.
 */
export async function isBlocked(userA: string, userB: string): Promise<boolean> {
  const db = admin();
  const [{ data: ab }, { data: ba }] = await Promise.all([
    db.from("blocks").select("id").eq("blocker_id", userA).eq("blocked_id", userB).maybeSingle(),
    db.from("blocks").select("id").eq("blocker_id", userB).eq("blocked_id", userA).maybeSingle(),
  ]);
  return !!(ab || ba);
}
