import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeft } from "lucide-react";
import { InventoryImportClient } from "@/components/inventory/inventory-import-client";

export default async function InventoryImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <Link href="/dashboard/inventory" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft size={16} />
          Inventory
        </Link>
        <h1 className="text-2xl font-bold">Bulk import inventory</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload a CSV or Excel file to add multiple items at once. Review and edit each entry — including photos — before saving.
        </p>
      </div>
      <InventoryImportClient />
    </div>
  );
}
