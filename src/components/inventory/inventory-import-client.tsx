"use client";

import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { InventoryReviewCard } from "@/components/inventory/inventory-review-card";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { dollarsToCents } from "@/lib/stripe";

const MAX_BATCH = 100;

const TEMPLATE_HEADERS = [
  "plant_name", "variety", "pot_size", "quantity",
  "category", "description", "notes", "cost_price",
];
const TEMPLATE_EXAMPLE = [
  "Monstera", "Deliciosa", "6\"", "10",
  "Tropicals", "Healthy specimen with 4 leaves", "Bought from wholesaler", "8.50",
];

export interface InventoryDraft {
  id: string;
  plant_name: string;
  variety: string;
  pot_size: string;
  quantity: string;
  category: string;
  description: string;
  notes: string;
  cost_price: string;
  images: string[];
  quantityInvalid: boolean;
}

function normaliseHeader(raw: string): string {
  const lower = raw.trim().toLowerCase().replace(/\s+/g, "_");
  const aliases: Record<string, string> = {
    name: "plant_name", plant: "plant_name", "plant name": "plant_name",
    cultivar: "variety", type: "variety",
    size: "pot_size", "pot size": "pot_size",
    qty: "quantity", count: "quantity", stock: "quantity",
    cat: "category",
    desc: "description",
    note: "notes",
    cost: "cost_price", "cost price": "cost_price", price: "cost_price",
  };
  return aliases[lower.replace(/_/g, " ")] ?? aliases[lower] ?? lower;
}

function parseRows(raw: Record<string, string>[]): InventoryDraft[] {
  return raw
    .filter((row) => Object.values(row).some((v) => String(v).trim()))
    .slice(0, MAX_BATCH)
    .map((row, i) => {
      const qtyRaw = String(row.quantity ?? "").trim();
      const qty = parseInt(qtyRaw, 10);
      const quantityInvalid = qtyRaw !== "" && (isNaN(qty) || qty <= 0);
      return {
        id: `inv-draft-${i}-${Date.now()}`,
        plant_name: String(row.plant_name ?? "").trim(),
        variety: String(row.variety ?? "").trim(),
        pot_size: String(row.pot_size ?? "").trim(),
        quantity: isNaN(qty) || qty <= 0 ? "" : String(qty),
        category: String(row.category ?? "").trim(),
        description: String(row.description ?? "").trim(),
        notes: String(row.notes ?? "").trim(),
        cost_price: String(row.cost_price ?? "").trim(),
        images: [],
        quantityInvalid,
      };
    });
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventory");
  XLSX.writeFile(wb, "plantet-inventory-template.xlsx");
}

export function InventoryImportClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [drafts, setDrafts] = useState<InventoryDraft[] | null>(null);
  const [parseError, setParseError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  function handleFile(file: File) {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      setParseError("Please upload a .csv, .xlsx, or .xls file.");
      return;
    }
    setParseError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
          defval: "",
          header: undefined,
        });
        if (!raw.length) { setParseError("The file appears to be empty."); return; }

        // Normalise headers
        const normalised = raw.map((row) => {
          const out: Record<string, string> = {};
          for (const [k, v] of Object.entries(row)) {
            out[normaliseHeader(k)] = String(v);
          }
          return out;
        });

        const parsed = parseRows(normalised);
        if (!parsed.length) { setParseError("No valid rows found."); return; }
        if (parsed.length === MAX_BATCH && raw.length > MAX_BATCH) {
          toast.warning(`Only the first ${MAX_BATCH} items were loaded. Split your file to import more.`);
        }
        setDrafts(parsed);
      } catch {
        setParseError("Could not read file. Make sure it's a valid CSV or Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function updateDraft(id: string, patch: Partial<InventoryDraft>) {
    setDrafts((prev) => prev?.map((d) => d.id === id ? { ...d, ...patch } : d) ?? null);
  }

  function removeDraft(id: string) {
    setDrafts((prev) => {
      const next = prev?.filter((d) => d.id !== id) ?? null;
      return next?.length ? next : null;
    });
  }

  async function handleSubmit() {
    if (!drafts?.length) return;
    const missingName = drafts.filter((d) => !d.plant_name.trim());
    const missingQty = drafts.filter((d) => !d.quantity || parseInt(d.quantity) <= 0);
    if (missingName.length) { toast.error(`${missingName.length} item${missingName.length > 1 ? "s are" : " is"} missing a plant name.`); return; }
    if (missingQty.length) { toast.error(`${missingQty.length} item${missingQty.length > 1 ? "s have" : " has"} an invalid quantity.`); return; }

    setSubmitting(true);
    setProgress({ done: 0, total: drafts.length });

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not signed in"); setSubmitting(false); return; }

    let success = 0;
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      let uploadedImages: string[] = [];

      for (const dataUrl of d.images) {
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const ext = blob.type.split("/")[1] ?? "jpg";
          const path = `inventory/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error } = await supabase.storage.from("listings").upload(path, blob);
          if (!error) {
            const { data: { publicUrl } } = supabase.storage.from("listings").getPublicUrl(path);
            uploadedImages.push(publicUrl);
          }
        } catch { /* skip failed photo */ }
      }

      const { error } = await supabase.from("inventory").insert({
        seller_id: user.id,
        plant_name: d.plant_name.trim(),
        variety: d.variety.trim() || null,
        pot_size: d.pot_size.trim() || null,
        quantity: parseInt(d.quantity),
        category: d.category.trim() || null,
        description: d.description.trim() || null,
        notes: d.notes.trim() || null,
        cost_cents: d.cost_price.trim() ? dollarsToCents(d.cost_price.trim()) : null,
        images: uploadedImages,
      });
      if (!error) success++;
      setProgress({ done: i + 1, total: drafts.length });
    }

    setSubmitting(false);
    if (success === 0) { toast.error("Import failed. Please try again."); return; }
    if (success < drafts.length) toast.warning(`${success} of ${drafts.length} items imported — some failed.`);
    else toast.success(`${success} item${success !== 1 ? "s" : ""} added to inventory!`);
    router.push("/dashboard/inventory");
    router.refresh();
  }

  // ── Review phase ──────────────────────────────────────────────────────────
  if (drafts !== null) {
    const missingName = drafts.filter((d) => !d.plant_name.trim()).length;
    const missingQty = drafts.filter((d) => !d.quantity || parseInt(d.quantity) <= 0).length;
    const hasErrors = missingName > 0 || missingQty > 0;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <span className="font-semibold">{drafts.length} item{drafts.length !== 1 ? "s" : ""} ready to review</span>
            {missingName > 0 && (
              <span className="flex items-center gap-1 text-destructive text-xs">
                <AlertTriangle size={13} />
                {missingName} missing plant name
              </span>
            )}
            {missingQty > 0 && (
              <span className="flex items-center gap-1 text-destructive text-xs">
                <AlertTriangle size={13} />
                {missingQty} missing or invalid quantity
              </span>
            )}
          </div>
          <button
            onClick={() => setDrafts(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Start over
          </button>
        </div>

        <div className="space-y-3">
          {drafts.map((draft) => (
            <InventoryReviewCard
              key={draft.id}
              draft={draft}
              onChange={(patch) => updateDraft(draft.id, patch)}
              onRemove={() => removeDraft(draft.id)}
            />
          ))}
        </div>

        <div className="sticky bottom-4 flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={submitting || hasErrors}
            className="bg-green-700 hover:bg-green-800 shadow-lg px-6"
            size="lg"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                Adding {progress.done} / {progress.total}…
              </>
            ) : (
              <>
                <CheckCircle2 size={16} className="mr-2" />
                Add {drafts.length} item{drafts.length !== 1 ? "s" : ""} to inventory
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ── Upload phase ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-8 py-16 text-center cursor-pointer transition-colors",
          dragging
            ? "border-green-500 bg-green-50 dark:bg-green-950/20"
            : "border-border hover:border-green-400 hover:bg-muted/30"
        )}
      >
        <div className={cn("rounded-full p-4", dragging ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground")}>
          <Upload size={28} />
        </div>
        <div>
          <p className="font-semibold text-base">Drop your file here, or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">Up to {MAX_BATCH} items per import · CSV, Excel (.xlsx, .xls)</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
      </div>

      {parseError && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle size={14} />
          {parseError}
        </p>
      )}

      <div className="rounded-xl border p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-muted-foreground" />
          <p className="font-medium text-sm">File format</p>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          First row should be a header row. Column names are flexible — we&apos;ll match common variations automatically.
        </p>
        <div className="overflow-x-auto rounded-lg border bg-muted/30 text-xs font-mono p-3 text-muted-foreground whitespace-nowrap">
          {TEMPLATE_HEADERS.join(", ")}
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">plant_name</span> and{" "}
          <span className="font-medium text-foreground">quantity</span> are required.
          Cost price in dollars (e.g. <span className="font-medium text-foreground">8.50</span>).
        </p>
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
          <FileText size={14} />
          Download template
        </Button>
      </div>
    </div>
  );
}
