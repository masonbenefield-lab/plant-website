import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateForm from "./create-form";

export default async function CreatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("seller_terms_accepted_at, return_policy_type, return_policy_notes, shipping_days, shipping_days_max")
    .eq("id", user.id)
    .single();

  const p = profile as {
    seller_terms_accepted_at?: string | null;
    return_policy_type?: string | null;
    return_policy_notes?: string | null;
    shipping_days?: number | null;
    shipping_days_max?: number | null;
  } | null;

  // The seller agreement and shipping/return policy are no longer hard gates here.
  // The agreement is collected inline (condensed) and shipping/return defaults are
  // collected inline the moment a seller lists in shop — see create-form.tsx.
  return (
    <CreateForm
      needsAgreement={!p?.seller_terms_accepted_at}
      sellerDefaults={{
        shippingDays: p?.shipping_days ?? null,
        shippingDaysMax: p?.shipping_days_max ?? null,
        returnPolicyType: p?.return_policy_type ?? null,
        returnPolicyNotes: p?.return_policy_notes ?? null,
      }}
    />
  );
}
