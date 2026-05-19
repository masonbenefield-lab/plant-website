import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeft } from "lucide-react";
import { ImportClient } from "@/components/garden/import-client";

export default async function GardenImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <Link href="/garden" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft size={16} />
          My Garden
        </Link>
        <h1 className="text-2xl font-bold">Bulk import plants</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload a CSV to add multiple plants at once. Review and edit each entry — including photos — before saving.
        </p>
      </div>
      <ImportClient />
    </div>
  );
}
