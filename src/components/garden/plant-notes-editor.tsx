"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  plantId: string;
  field: "notes" | "public_notes";
  initialValue: string | null;
  label: string;
  placeholder: string;
  dashed?: boolean;
}

export function PlantNotesEditor({ plantId, field, initialValue, label, placeholder, dashed }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue ?? "");
  const [saved, setSaved] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const patch = field === "notes"
      ? { notes: value.trim() || null }
      : { public_notes: value.trim() || null };
    const { error } = await supabase
      .from("garden_plants")
      .update(patch)
      .eq("id", plantId);
    setSaving(false);
    if (error) {
      toast.error("Failed to save. Please try again.");
      return;
    }
    setSaved(value.trim());
    setEditing(false);
  }

  function handleCancel() {
    setValue(saved);
    setEditing(false);
  }

  return (
    <div className={cn("rounded-xl border p-4 space-y-2", dashed && "border-dashed")}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1"
            aria-label={`Edit ${label}`}
          >
            <Pencil size={13} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            rows={3}
            autoFocus
            className="resize-none text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-green-700 hover:bg-green-800 h-7 px-3 text-xs">
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving} className="h-7 px-3 text-xs">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p
          className={cn("text-sm whitespace-pre-wrap leading-relaxed cursor-text", !saved && "text-muted-foreground italic")}
          onClick={() => setEditing(true)}
        >
          {saved || placeholder}
        </p>
      )}
    </div>
  );
}
