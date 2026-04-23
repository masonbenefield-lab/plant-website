"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";

type Listing = Database["public"]["Tables"]["listings"]["Row"];

export default function ListingActions({ listing }: { listing: Listing }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("listings").upload(path, file, { upsert: true });
      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        setUploading(false);
        e.target.value = "";
        return;
      }
      const { data } = supabase.storage.from("listings").getPublicUrl(path);
      newUrls.push(data.publicUrl);
    }

    const updatedImages = [...(listing.images ?? []), ...newUrls];
    const { error: updateError } = await supabase
      .from("listings")
      .update({ images: updatedImages })
      .eq("id", listing.id);

    setUploading(false);
    e.target.value = "";

    if (updateError) {
      toast.error(updateError.message);
    } else {
      toast.success(`${newUrls.length} photo${newUrls.length !== 1 ? "s" : ""} added`);
      router.refresh();
    }
  }

  async function toggleStatus() {
    const supabase = createClient();
    const newStatus = listing.status === "active" ? "paused" : "active";
    const { error } = await supabase.from("listings").update({ status: newStatus }).eq("id", listing.id);
    if (error) toast.error(error.message);
    else { toast.success(`Listing ${newStatus}`); router.refresh(); }
  }

  async function deleteListing() {
    if (!confirm("Delete this listing?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("listings").delete().eq("id", listing.id);
    if (error) toast.error(error.message);
    else { toast.success("Listing deleted"); router.refresh(); }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={uploading} />}>
          {uploading ? "Uploading…" : "Actions"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>
            Add Photo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleStatus}>
            {listing.status === "active" ? "Pause" : "Activate"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={deleteListing} className="text-red-600">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
