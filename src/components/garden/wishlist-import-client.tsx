"use client";

import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2, List, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Priority = "nice" | "want" | "must";

interface WishlistDraft {
  id: string;
  name: string;
  variety: string;
  notes: string;
  priority: Priority;
}

const PRIORITY_LABEL: Record<Priority, string> = {
  nice: "Nice to have",
  want: "Want it",
  must: "Must have",
};

const PRIORITY_COLOR: Record<Priority, string> = {
  nice: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  want: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  must: "bg-[#DFE7D4] text-leaf dark:bg-forest/40 dark:text-sage",
};

const MAX_BATCH = 100;

const TEMPLATE_HEADERS = ["name", "variety", "priority", "notes"];
const TEMPLATE_EXAMPLE = ["Monstera", "Deliciosa", "must", "The large form, not mini"];

const COL_ALIASES: Record<string, string> = {
  "plant name": "name", plant: "name", "common name": "name",
  cultivar: "variety", type: "name",
  note: "notes",
  rank: "priority",
};

function normaliseHeader(raw: string): string {
  const lower = raw.trim().toLowerCase().replace(/_/g, " ");
  return COL_ALIASES[lower] ?? lower.replace(/ /g, "_");
}

function normalisePriority(raw: string): Priority {
  const lower = raw.trim().toLowerCase();
  if (lower === "must" || lower === "must have" || lower === "need" || lower === "essential") return "must";
  if (lower === "nice" || lower === "nice to have" || lower === "someday" || lower === "maybe") return "nice";
  return "want";
}

function parseRows(raw: Record<string, string>[]): WishlistDraft[] {
  return raw
    .filter((row) => Object.values(row).some((v) => v.trim()))
    .slice(0, MAX_BATCH)
    .map((row, i) => ({
      id: `draft-${i}-${Date.now()}`,
      name: (row.name ?? "").trim(),
      variety: (row.variety ?? "").trim(),
      notes: (row.notes ?? "").trim(),
      priority: normalisePriority(row.priority ?? ""),
    }));
}

function downloadTemplate() {
  const csv = [TEMPLATE_HEADERS.join(","), TEMPLATE_EXAMPLE.join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantet-wishlist-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function WishlistImportClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [drafts, setDrafts] = useState<WishlistDraft[] | null>(null);
  const [parseError, setParseError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [pasteText, setPasteText] = useState("");
  const [pasteMode, setPasteMode] = useState<"variety" | "type">("variety");

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
        if (!results.data.length) { setParseError("The CSV appears to be empty."); return; }
        const parsed = parseRows(results.data);
        if (!parsed.length) { setParseError("No valid rows found in the CSV."); return; }
        if (parsed.length === MAX_BATCH && results.data.length > MAX_BATCH) {
          toast.warning(`Only the first ${MAX_BATCH} plants were loaded. Split your file to import more.`);
        }
        setDrafts(parsed);
      },
      error(err) { setParseError(`Could not parse file: ${err.message}`); },
    });
  }

  function parsePasteList() {
    const entries = pasteText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_BATCH);
    if (!entries.length) {
      setParseError("No entries found — separate items with commas or new lines.");
      return;
    }
    if (entries.length === MAX_BATCH && pasteText.split(/[\n,]+/).filter((s) => s.trim()).length > MAX_BATCH) {
      toast.warning(`Only the first ${MAX_BATCH} plants were loaded.`);
    }
    setParseError("");
    setDrafts(
      entries.map((entry, i) => ({
        id: `draft-${i}-${Date.now()}`,
        name: pasteMode === "type" ? entry : "",
        variety: pasteMode === "variety" ? entry : "",
        notes: "",
        priority: "want" as Priority,
      }))
    );
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function updateDraft(id: string, patch: Partial<WishlistDraft>) {
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
    setSubmitting(true);
    setProgress({ done: 0, total: drafts.length });

    let added = 0;
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      const res = await fetch("/api/garden/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: d.name.trim() || d.variety.trim() || "Unnamed plant",
          variety: d.variety.trim() || null,
          notes: d.notes.trim() || null,
          priority: d.priority,
        }),
      });
      if (res.ok) added++;
      setProgress({ done: i + 1, total: drafts.length });
    }

    setSubmitting(false);
    if (added === 0) {
      toast.error("Failed to add any plants. Please try again.");
      return;
    }
    if (added < drafts.length) {
      toast.warning(`${added} of ${drafts.length} plants added — some failed.`);
    } else {
      toast.success(`${added} plant${added !== 1 ? "s" : ""} added to your wishlist!`);
    }
    router.push("/garden/wishlist");
    router.refresh();
  }

  // ── Review phase ──────────────────────────────────────────────────────────
  if (drafts !== null) {
    const missingName = drafts.filter((d) => !d.name.trim()).length;

    return (
      <div className="space-y-6">
        {/* Summary bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <span className="font-semibold">{drafts.length} plant{drafts.length !== 1 ? "s" : ""} ready to review</span>
            {missingName > 0 && (
              <span className="flex items-center gap-1 text-amber-600 text-xs">
                <AlertTriangle size={13} />
                {missingName} plant{missingName > 1 ? "s" : ""} missing a plant name
              </span>
            )}
          </div>
          <button onClick={() => setDrafts(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Start over
          </button>
        </div>

        {/* Review cards */}
        <div className="space-y-3">
          {drafts.map((draft) => (
            <div key={draft.id} className="rounded-xl border p-4 space-y-3 bg-background">
              <div className="flex items-start gap-2">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Plant name *</label>
                    <input
                      value={draft.name}
                      onChange={(e) => updateDraft(draft.id, { name: e.target.value })}
                      placeholder="e.g. Monstera"
                      className={cn(
                        "w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-leaf",
                        !draft.name.trim() ? "border-amber-400" : "border-input"
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Variety</label>
                    <input
                      value={draft.variety}
                      onChange={(e) => updateDraft(draft.id, { variety: e.target.value })}
                      placeholder="e.g. Deliciosa"
                      className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf"
                    />
                  </div>
                </div>
                <button
                  onClick={() => removeDraft(draft.id)}
                  className="mt-6 p-1 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Remove"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <div className="flex gap-2 flex-wrap">
                  {(["nice", "want", "must"] as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => updateDraft(draft.id, { priority: p })}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                        draft.priority === p
                          ? PRIORITY_COLOR[p] + " border-transparent"
                          : "border-border text-muted-foreground hover:border-sage"
                      )}
                    >
                      {PRIORITY_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <textarea
                  value={draft.notes}
                  onChange={(e) => updateDraft(draft.id, { notes: e.target.value })}
                  placeholder="Where to find it, why you want it…"
                  rows={1}
                  className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf resize-none"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Submit */}
        <div className="sticky bottom-4 flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-leaf hover:bg-forest shadow-lg px-6"
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
                Add {drafts.length} plant{drafts.length !== 1 ? "s" : ""} to wishlist
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
            ? "border-leaf bg-[#EBF0E6] dark:bg-forest/20"
            : "border-border hover:border-sage hover:bg-muted/30"
        )}
      >
        <div className={cn("rounded-full p-4", dragging ? "bg-[#DFE7D4] text-leaf" : "bg-muted text-muted-foreground")}>
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
          <p className="font-medium text-sm">Paste a list of plants</p>
        </div>
        <Textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={pasteMode === "variety" ? "Cavendish, Eureka, Satsuma\nor one per line" : "Banana, Lemon, Mandarin\nor one per line"}
          rows={4}
          className="font-mono text-sm resize-none"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Treat as:</span>
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setPasteMode("variety")}
              className={cn(
                "px-3 py-1.5 font-medium transition-colors",
                pasteMode === "variety"
                  ? "bg-leaf text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              Variety / cultivar
            </button>
            <button
              type="button"
              onClick={() => setPasteMode("type")}
              className={cn(
                "px-3 py-1.5 font-medium transition-colors border-l",
                pasteMode === "type"
                  ? "bg-leaf text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              Plant type
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {pasteMode === "variety"
            ? "Each entry fills Variety / cultivar (e.g. BNR, Deliciosa). You'll add the plant type (e.g. Fig, Monstera) on the next step."
            : "Each entry fills Plant type (e.g. Fig, Monstera). You can add varieties on the next step."}
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
          Your CSV should have a header row. Accepted columns:
        </p>
        <div className="overflow-x-auto rounded-lg border bg-muted/30 text-xs font-mono p-3 text-muted-foreground whitespace-nowrap">
          {TEMPLATE_HEADERS.join(", ")}
        </div>
        <p className="text-xs text-muted-foreground">
          Valid priorities: <span className="font-medium text-foreground">nice, want, must</span> — defaults to &ldquo;want&rdquo;.
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
