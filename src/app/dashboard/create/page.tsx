import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateForm from "./create-form";

export default async function CreatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("seller_terms_accepted_at")
    .eq("id", user.id)
    .single();

  if (!profile?.seller_terms_accepted_at) {
    redirect("/seller-agreement?next=/dashboard/create");
  }

  return <CreateForm />;
}
