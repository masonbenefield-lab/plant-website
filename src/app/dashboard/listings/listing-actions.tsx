"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";

type Listing = Database["public"]["Tables"]["listings"]["Row"];

export default function ListingActions({ listing }: { listing: Listing }) {
  const router = useRouter();

  async function toggleStatus() {
    const supabase = createClient();
    const newStatus = listing.status === "active" ? "paused" : "active";
    const { error } = await supabase
      .from("listings")
      .update({ status: newStatus })
      .eq("id", listing.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Listing ${newStatus}`);
      router.refresh();
    }
  }

  async function deleteListing() {
    if (!confirm("Delete this listing?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("listings").delete().eq("id", listing.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Listing deleted");
      router.refresh();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        Actions
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={toggleStatus}>
          {listing.status === "active" ? "Pause" : "Activate"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={deleteListing} className="text-red-600">
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
