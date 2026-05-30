import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreateForm from "./create-form";

export default async function CreatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("seller_terms_accepted_at, return_policy_type")
    .eq("id", user.id)
    .single();

  if (!profile?.seller_terms_accepted_at) {
    redirect("/seller-agreement?next=/dashboard/create");
  }

  const hasReturnPolicy = !!(profile as { return_policy_type?: string | null })?.return_policy_type;

  return (
    <>
      {!hasReturnPolicy && (
        <div className="border-b border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <span className="font-medium">Set your return policy before listing.</span>{" "}
          Buyers expect to know your policy upfront.{" "}
          <Link href="/account#return-policy" className="underline font-medium hover:opacity-80">
            Set it now →
          </Link>
        </div>
      )}
      <CreateForm />
    </>
  );
}
