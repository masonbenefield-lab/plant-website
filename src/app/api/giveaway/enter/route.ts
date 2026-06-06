import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

const US_STATE_NAMES = new Set([
  "ALABAMA","ALASKA","ARIZONA","ARKANSAS","CALIFORNIA","COLORADO","CONNECTICUT",
  "DELAWARE","FLORIDA","GEORGIA","HAWAII","IDAHO","ILLINOIS","INDIANA","IOWA",
  "KANSAS","KENTUCKY","LOUISIANA","MAINE","MARYLAND","MASSACHUSETTS","MICHIGAN",
  "MINNESOTA","MISSISSIPPI","MISSOURI","MONTANA","NEBRASKA","NEVADA",
  "NEW HAMPSHIRE","NEW JERSEY","NEW MEXICO","NEW YORK","NORTH CAROLINA",
  "NORTH DAKOTA","OHIO","OKLAHOMA","OREGON","PENNSYLVANIA","RHODE ISLAND",
  "SOUTH CAROLINA","SOUTH DAKOTA","TENNESSEE","TEXAS","UTAH","VERMONT",
  "VIRGINIA","WASHINGTON","WEST VIRGINIA","WISCONSIN","WYOMING","DISTRICT OF COLUMBIA",
]);

function isValidUSState(state: string): boolean {
  const s = state.trim().toUpperCase();
  return US_STATES.has(s) || US_STATE_NAMES.has(s);
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check eligibility via saved shipping address
  const { data: profile } = await supabase
    .from("profiles")
    .select("saved_shipping_address")
    .eq("id", user.id)
    .single();

  const addr = profile?.saved_shipping_address as { state?: string; country?: string } | null;
  if (!addr?.state) {
    return NextResponse.json({ error: "Please confirm your shipping address before entering." }, { status: 400 });
  }
  if (addr.country && addr.country !== "US") {
    return NextResponse.json({ error: "This giveaway is open to US residents only." }, { status: 403 });
  }
  if (!isValidUSState(addr.state)) {
    return NextResponse.json({ error: "This giveaway is open to US residents only." }, { status: 403 });
  }

  const month = new Date().toISOString().slice(0, 7);

  const { data: giveaway } = await supabase
    .from("giveaway_months")
    .select("month")
    .eq("month", month)
    .single();

  if (!giveaway) return NextResponse.json({ error: "No active giveaway this month" }, { status: 400 });

  const { error } = await supabase
    .from("giveaway_entries")
    .insert({ user_id: user.id, month });

  if (error) {
    if (error.code === "23505") return NextResponse.json({ already: true });
    return NextResponse.json({ error: "Failed to enter" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
