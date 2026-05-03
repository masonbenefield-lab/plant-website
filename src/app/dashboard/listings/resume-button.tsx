"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function ResumeButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function resume() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("listings")
      .update({ status: "active" })
      .eq("id", listingId);
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Listing activated"); router.refresh(); }
  }

  return (
    <button
      onClick={resume}
      disabled={loading}
      className="text-xs font-medium text-green-700 hover:text-green-800 hover:underline disabled:opacity-50"
    >
      {loading ? "Activating…" : "Resume"}
    </button>
  );
}
