"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronDown, X, Upload, AlertTriangle, Trash2 } from "lucide-react";
import type { PlantDraft } from "@/components/garden/import-client";
import type { GardenPlantStatus } from "@/lib/supabase/types";

const STATUS_OPTIONS: { value: GardenPlantStatus; label: string; color: string }[] = [
  { value: "thriving",   label: "Thriving",   color: "bg-green-100 text-green-700" },
  { value: "growing",    label: "Growing",    color: "bg-emerald-100 text-emerald-700" },
  { value: "dormant",    label: "Dormant",    color: "bg-yellow-100 text-yellow-700" },
  { value: "struggling", label: "Struggling", color: "bg-orange-100 text-orange-700" },
  { value: "dead",       label: "Dead",       color: "bg-gray-100 text-gray-500" },
];

const SOURCE_OPTIONS = [
  { value: "nursery",     label: "Local nursery" },
  { value: "purchase",    label: "Online purchase" },
  { value: "trade",       label: "Trade / swap" },
  { value: "propagation", label: "Propagation" },
  { value: "gift",        label: "Gift" },
];

const MAX_PHOTOS = 10;

interface Props {
  draft: PlantDraft;
  onChange: (patch: Partial<PlantDraft>) => void;
  onRemove: () => void;
}

export function PlantReviewCard({ draft, onChange, onRemove }: Props) {
  const [open, setOpen] = useState(draft.statusInvalid || !draft.name.trim());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const statusMeta = STATUS_OPTIONS.find((s) => s.value === draft.status) ?? STATUS_OPTIONS[1];
  const missingName = !draft.name.trim();

  function handlePhotoFiles(files: FileList) {
    const remaining = MAX_PHOTOS - draft.images.length;
    if (remaining <= 0) return;
    const toAdd = Array.from(files).slice(0, remaining);
    const readers: Promise<string>[] = toAdd.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        })
    );
    Promise.all(readers).then((urls) => {
      onChange({ images: [...draft.images, ...urls] });
    });
  }

  function removePhoto(index: number) {
    onChange({ images: draft.images.filter((_, i) => i !== index) });
  }

  return (
    <div className={cn(
      "rounded-xl border transition-colors",
      missingName ? "border-destructive/50" : open ? "border-green-300 dark:border-green-800" : "border-border"
    )}>
      {/* Header row — always visible */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown
          size={16}
          className={cn("text-muted-foreground shrink-0 transition-transform", open && "rotate-180")}
        />
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          {missingName ? (
            <span className="text-sm text-destructive flex items-center gap-1">
              <AlertTriangle size={13} />
              Missing name
            </span>
          ) : (
            <span className="text-sm font-semibold truncate">{draft.name}</span>
          )}
          {draft.variety && (
            <span className="text-xs text-muted-foreground truncate">{draft.variety}</span>
          )}
          <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0", statusMeta.color)}>
            {statusMeta.label}
            {draft.statusInvalid && <span className="ml-1 opacity-60">·edited</span>}
          </span>
          {draft.location && (
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">{draft.location}</span>
          )}
          {draft.images.length > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">{draft.images.length} photo{draft.images.length > 1 ? "s" : ""}</span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1"
          aria-label="Remove plant"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Expanded form */}
      {open && (
        <div className="border-t px-4 py-4 space-y-4">

          {/* Name + Variety */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${draft.id}-name`}>
                Plant name <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`${draft.id}-name`}
                value={draft.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="e.g. Monstera"
                className={missingName ? "border-destructive" : ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${draft.id}-variety`}>Variety / cultivar</Label>
              <Input
                id={`${draft.id}-variety`}
                value={draft.variety}
                onChange={(e) => onChange({ variety: e.target.value })}
                placeholder="e.g. Deliciosa"
              />
            </div>
          </div>

          {/* Status + Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Status
                {draft.statusInvalid && (
                  <span className="ml-2 text-xs text-amber-600 font-normal flex-inline items-center gap-0.5">
                    <AlertTriangle size={11} className="inline mr-0.5" />
                    Original value not recognised — please confirm
                  </span>
                )}
              </Label>
              <Select
                value={draft.status}
                onValueChange={(v) => onChange({ status: v as GardenPlantStatus, statusInvalid: false })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${draft.id}-location`}>Location</Label>
              <Input
                id={`${draft.id}-location`}
                value={draft.location}
                onChange={(e) => onChange({ location: e.target.value })}
                placeholder="e.g. Back porch, Living room"
              />
            </div>
          </div>

          {/* Planted date + Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${draft.id}-planted`}>Date planted / acquired</Label>
              <Input
                id={`${draft.id}-planted`}
                type="date"
                value={draft.planted_at}
                onChange={(e) => onChange({ planted_at: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Source type</Label>
              <Select
                value={draft.source_type || "none"}
                onValueChange={(v) => onChange({ source_type: v === "none" ? "" : (v ?? "") })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Source name */}
          <div className="space-y-1.5">
            <Label htmlFor={`${draft.id}-source-name`}>Source name</Label>
            <Input
              id={`${draft.id}-source-name`}
              value={draft.source_name}
              onChange={(e) => onChange({ source_name: e.target.value })}
              placeholder="Nursery name, seller, friend…"
            />
          </div>

          {/* Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${draft.id}-notes`}>Private notes</Label>
              <Textarea
                id={`${draft.id}-notes`}
                value={draft.notes}
                onChange={(e) => onChange({ notes: e.target.value })}
                placeholder="Only visible to you"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${draft.id}-public-notes`}>Public notes</Label>
              <Textarea
                id={`${draft.id}-public-notes`}
                value={draft.public_notes}
                onChange={(e) => onChange({ public_notes: e.target.value })}
                placeholder="Visible on your public garden"
                rows={2}
              />
            </div>
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <Label>Photos ({draft.images.length}/{MAX_PHOTOS}) — optional</Label>
            <div className="flex flex-wrap gap-2">
              {draft.images.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border group">
                  <Image src={url} alt={`Photo ${i + 1}`} fill className="object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={11} className="text-white" />
                  </button>
                </div>
              ))}
              {draft.images.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-green-400 hover:text-green-700 transition-colors text-xs"
                >
                  <Upload size={16} />
                  <span>Add</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) handlePhotoFiles(e.target.files); e.target.value = ""; }}
            />
            <p className="text-xs text-muted-foreground">Photos are uploaded when you click &quot;Add to garden&quot;</p>
          </div>
        </div>
      )}
    </div>
  );
}
