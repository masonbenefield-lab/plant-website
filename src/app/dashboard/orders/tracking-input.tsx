"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function TrackingInput({
  orderId,
  initialValue,
}: {
  orderId: string;
  initialValue: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (value.trim() === (initialValue ?? "")) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("orders")
      .update({ tracking_number: value.trim() || null })
      .eq("id", orderId);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Tracking number saved");
      router.refresh();
    }
  }

  return (
    <div className="flex gap-2 mt-3">
      <Input
        placeholder="Tracking number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="text-xs h-8 flex-1"
        onKeyDown={(e) => { if (e.key === "Enter") save(); }}
      />
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        onClick={save}
        disabled={saving}
      >
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
