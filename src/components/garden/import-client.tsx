"use client";

import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlantReviewCard } from "@/components/garden/plant-review-card";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { GardenPlantStatus } from "@/lib/supabase/types";

const MAX_BATCH = 100;

const TEMPLATE_HEADERS = [
  "name", "variety", "status", "location", "planted_at",
  "source_type", "source_name", "notes", "public_notes",
];

const TEMPLATE_EXAMPLE = [
  "Monstera", "Deliciosa", "thriving", "Living room", "2024-03-15",
  "nursery", "Home Depot", "Repot in spring", "Large and healthy!",
];

const VALID_STATUSES: GardenPlantStatus[] = ["thriving", "growing", "dormant", "struggling", "dead"];

const STATUS_ALIASES: Record<string, GardenPlantStatus> = {
  healthy: "thriving", great: "thriving", excellent: "thriving", perfect: "thriving",
  good: "growing", ok: "growing", okay: "growing", normal: "growing", fine: "growing",
  resting: "dormant", inactive: "dormant", sleeping: "dormant",
  bad: "struggling", sick: "struggling", poor: "struggling", weak: "struggling", stressed: "struggling",
  died: "dead", gone: "dead", brown: "dead",
};

const COL_ALIASES: Record<string, string> = {
  "plant name": "name", plant: "name", "common name": "name",
  cultivar: "variety", type: "variety",
  health: "status", condition: "status",
  spot: "location", place: "location", where: "location",
  planted: "planted_at", "date planted": "planted_at", date: "planted_at",
  "acquisition date": "planted_at",
  "source type": "source_type", source: "source_type",
  "source name": "source_name", from: "source_name", seller: "source_name", nursery: "source_name",
  note: "notes", "private notes": "notes", "private note": "notes",
  "public notes": "public_notes", "public note": "public_notes",
};

export interface PlantDraft {
  id: string;
  name: string;
  variety: string;
  status: GardenPlantStatus;
  statusInvalid: boolean;
  location: string;
  planted_at: string;
  source_type: string;
  source_name: string;
  notes: string;
  public_notes: string;
  images: string[];
}

function normaliseHeader(raw: string): string {
  const lower = raw.trim().toLowerCase().replace(/_/g, " ");
  return COL_ALIASES[lower] ?? lower.replace(/ /g, "_");
}

function normaliseStatus(raw: string): { status: GardenPlantStatus; invalid: boolean } {
  const lower = raw.trim().toLowerCase();
  if ((VALID_STATUSES as string[]).includes(lower)) return { status: lower as GardenPlantStatus, invalid: false };
  const mapped = STATUS_ALIASES[lower];
  if (mapped) return { status: mapped, invalid: false };
  return { status: "growing", invalid: !!raw.trim() };
}

function parseRows(raw: Record<string, string>[]): PlantDraft[] {
  return raw
    .filter((row) => Object.values(row).some((v) => v.trim()))
    .slice(0, MAX_BATCH)
    .map((row, i) => {
      const { status, invalid: statusInvalid } = normaliseStatus(row.status ?? "");
      return {
        id: `draft-${i}-${Date.now()}`,
        name: (row.name ?? "").trim(),
        variety: (row.variety ?? "").trim(),
        status,
        statusInvalid,
        location: (row.location ?? "").trim(),
        planted_at: (row.planted_at ?? "").trim(),
        source_type: (row.source_type ?? "").trim(),
        source_name: (row.source_name ?? "").trim(),
        notes: (row.notes ?? "").trim(),
        public_notes: (row.public_notes ?? "").trim(),
        images: [],
      };
    });
}

function downloadTemplate() {
  const csv = [TEMPLATE_HEADERS.join(","), TEMPLATE_EXAMPLE.join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantet-garden-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [drafts, setDrafts] = useState<PlantDraft[] | null>(null);
  const [parseError, setParseError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [pasteText, setPasteText] = useState("");

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      setParseError("Please upload a .csv file.");
      return;
    }
    setParseError("");
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normaliseHeader,
      complete(results) {
        if (!results.data.length) {
          setParseError("The CSV appears to be empty.");
          return;
        }
        const parsed = parseRows(results.data);
        if (!parsed.length) {
          setParseError("No valid rows found in the CSV.");
          return;
        }
        if (parsed.length === MAX_BATCH && results.data.length > MAX_BATCH) {
          toast.warning(`Only the first ${MAX_BATCH} plants were loaded. Split your file to import more.`);
        }
        setDrafts(parsed);
      },
      error(err) {
        setParseError(`Could not parse file: ${err.message}`);
      },
    });
  }

  function parsePasteList() {
    const names = pasteText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_BATCH);
    if (!names.length) {
      setParseError("No plant names found — separate names with commas or new lines.");
      return;
    }
    if (names.length === MAX_BATCH && pasteText.split(/[\n,]+/).filter((s) => s.trim()).length > MAX_BATCH) {
      toast.warning(`Only the first ${MAX_BATCH} plants were loaded.`);
    }
    setParseError("");
    setDrafts(
      names.map((name, i) => ({
        id: `draft-${i}-${Date.now()}`,
        name,
        variety: "",
        status: "growing" as GardenPlantStatus,
        statusInvalid: false,
        location: "",
        planted_at: "",
        source_type: "",
        source_name: "",
        notes: "",
        public_notes: "",
        images: [],
      }))
    );
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function updateDraft(id: string, patch: Partial<PlantDraft>) {
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
    const invalid = drafts.filter((d) => !d.name.trim());
    if (invalid.length) {
      toast.error(`${invalid.length} plant${invalid.length > 1 ? "s are" : " is"} missing a name.`);
      return;
    }

    setSubmitting(true);
    setProgress({ done: 0, total: drafts.length });

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not signed in"); setSubmitting(false); return; }

    const rows = [];
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      let uploadedImages: string[] = [];

      // Upload photos for this plant
      if (d.images.length) {
        for (const dataUrl of d.images) {
          try {
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const ext = blob.type.split("/")[1] ?? "jpg";
            const path = `garden/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const { error } = await supabase.storage.from("garden").upload(path, blob);
            if (!error) {
              const { data: { publicUrl } } = supabase.storage.from("garden").getPublicUrl(path);
              uploadedImages.push(publicUrl);
            }
          } catch { /* skip failed photo */ }
        }
      }

      rows.push({
        user_id: user.id,
        name: d.name.trim(),
        variety: d.variety.trim() || null,
        status: d.status,
        location: d.location.trim() || null,
        planted_at: d.planted_at.trim() || null,
        source_type: (d.source_type.trim() || null) as "nursery" | "purchase" | "trade" | "propagation" | "gift" | null,
        source_name: d.source_name.trim() || null,
        notes: d.notes.trim() || null,
        public_notes: d.public_notes.trim() || null,
        images: uploadedImages,
      });

      setProgress({ done: i + 1, total: drafts.length });
    }

    const { error } = await supabase.from("garden_plants").insert(rows);
    setSubmitting(false);

    if (error) {
      toast.error("Import failed. Please try again.");
      return;
    }

    toast.success(`${rows.length} plant${rows.length > 1 ? "s" : ""} added to your garden!`);
    router.push("/garden");
    router.refresh();
  }

  // ── Review phase ──────────────────────────────────────────────────────────
  if (drafts !== null) {
    const invalidCount = drafts.filter((d) => !d.name.trim()).length;
    const flaggedCount = drafts.filter((d) => d.statusInvalid).length;

    return (
      <div className="space-y-6">
        {/* Summary bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <span className="font-semibold">{drafts.length} plant{drafts.length !== 1 ? "s" : ""} ready to review</span>
            {flaggedCount > 0 && (
              <span className="flex items-center gap-1 text-amber-600 text-xs">
                <AlertTriangle size={13} />
                {flaggedCount} status value{flaggedCount > 1 ? "s" : ""} were unrecognised — defaulted to Growing
              </span>
            )}
            {invalidCount > 0 && (
              <span className="flex items-center gap-1 text-destructive text-xs">
                <AlertTriangle size={13} />
                {invalidCount} plant{invalidCount > 1 ? "s" : ""} missing a name
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

        {/* Plant cards */}
        <div className="space-y-3">
          {drafts.map((draft) => (
            <PlantReviewCard
              key={draft.id}
              draft={draft}
              onChange={(patch) => updateDraft(draft.id, patch)}
              onRemove={() => removeDraft(draft.id)}
            />
          ))}
        </div>

        {/* Submit */}
        <div className="sticky bottom-4 flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={submitting || invalidCount > 0}
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
                Add {drafts.length} plant{drafts.length !== 1 ? "s" : ""} to garden
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
      {/* Drop zone */}
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
          <p className="font-semibold text-base">Drop your CSV here, or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">Up to {MAX_BATCH} plants per import · .csv files only</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
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

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 border-t" />
      </div>

      {/* Paste list */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <List size={16} className="text-muted-foreground" />
          <p className="font-medium text-sm">Paste a list of plant names</p>
        </div>
        <Textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={"Monstera, Pothos, Snake Plant\nor one per line"}
          rows={4}
          className="font-mono text-sm resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Separate by commas or new lines. Status, variety, and photos can be added on the next step.
        </p>
        <Button
          onClick={parsePasteList}
          disabled={!pasteText.trim()}
          variant="outline"
          className="gap-2"
        >
          <CheckCircle2 size={14} />
          Review list
        </Button>
      </div>

      {/* Template section */}
      <div className="rounded-xl border p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-muted-foreground" />
          <p className="font-medium text-sm">CSV format</p>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your CSV should have a header row. Column names are flexible — we&apos;ll match common variations automatically.
        </p>
        <div className="overflow-x-auto rounded-lg border bg-muted/30 text-xs font-mono p-3 text-muted-foreground whitespace-nowrap">
          {TEMPLATE_HEADERS.join(", ")}
        </div>
        <p className="text-xs text-muted-foreground">
          Valid statuses: <span className="font-medium text-foreground">thriving, growing, dormant, struggling, dead</span>
          {" "}— other values default to Growing.
          Dates in <span className="font-medium text-foreground">YYYY-MM-DD</span> format.
          Only <span className="font-medium text-foreground">name</span> is required.
        </p>
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
          <FileText size={14} />
          Download template
        </Button>
      </div>
    </div>
  );
}
