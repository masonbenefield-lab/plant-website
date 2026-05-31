import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeft } from "lucide-react";
import { WishlistImportClient } from "@/components/garden/wishlist-import-client";

export default async function WishlistImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <Link href="/garden/wishlist" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft size={16} />
          My Wishlist
        </Link>
        <h1 className="text-2xl font-bold">Bulk import wishlist</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload a CSV or paste a list to add multiple plants at once. Review each entry before saving.
        </p>
      </div>
      <WishlistImportClient />
    </div>
  );
}
