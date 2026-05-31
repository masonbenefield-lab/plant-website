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
import { POT_SIZES } from "@/lib/pot-sizes";
import type { InventoryDraft } from "@/components/inventory/inventory-import-client";

const MAX_PHOTOS = 10;

interface Props {
  draft: InventoryDraft;
  onChange: (patch: Partial<InventoryDraft>) => void;
  onRemove: () => void;
}

export function InventoryReviewCard({ draft, onChange, onRemove }: Props) {
  const missingName = !draft.plant_name.trim();
  const qty = parseInt(draft.quantity);
  const invalidQty = draft.quantity !== "" && (isNaN(qty) || qty <= 0);
  const hasError = missingName || invalidQty;

  const [open, setOpen] = useState(hasError);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPotSizePreset = (POT_SIZES as readonly string[]).includes(draft.pot_size);

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

  return (
    <div className={cn(
      "rounded-xl border transition-colors",
      hasError ? "border-destructive/50" : open ? "border-[#A8BF9A] dark:border-forest" : "border-border"
    )}>
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown size={16} className={cn("text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          {missingName ? (
            <span className="text-sm text-destructive flex items-center gap-1">
              <AlertTriangle size={13} /> Missing plant type
            </span>
          ) : (
            <span className="text-sm font-semibold truncate">{draft.plant_name}</span>
          )}
          {draft.variety && <span className="text-xs text-muted-foreground">{draft.variety}</span>}
          {draft.pot_size && <span className="text-xs text-muted-foreground">{draft.pot_size}</span>}
          {invalidQty ? (
            <span className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle size={11} /> Invalid qty
            </span>
          ) : draft.quantity ? (
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">×{draft.quantity}</span>
          ) : null}
          {draft.category && <span className="text-xs text-muted-foreground hidden sm:inline">{draft.category}</span>}
          {draft.images.length > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">{draft.images.length} photo{draft.images.length > 1 ? "s" : ""}</span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1"
          aria-label="Remove item"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Expanded form */}
      {open && (
        <div className="border-t px-4 py-4 space-y-4">

          {/* Plant type + Variety */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${draft.id}-name`}>
                Plant type <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`${draft.id}-name`}
                value={draft.plant_name}
                onChange={(e) => onChange({ plant_name: e.target.value })}
                placeholder="e.g. Fig, Monstera, Pothos"
                className={missingName ? "border-destructive" : ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${draft.id}-variety`}>Variety / cultivar</Label>
              <Input
                id={`${draft.id}-variety`}
                value={draft.variety}
                onChange={(e) => onChange({ variety: e.target.value })}
                placeholder="e.g. BNR, Deliciosa"
              />
            </div>
          </div>

          {/* Pot size + Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Pot size</Label>
              <Select
                value={isPotSizePreset ? draft.pot_size : (draft.pot_size ? "custom" : "none")}
                onValueChange={(v) => {
                  if (v === "none") onChange({ pot_size: "" });
                  else if (v !== "custom") onChange({ pot_size: v ?? "" });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {POT_SIZES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                  <SelectItem value="custom">Other…</SelectItem>
                </SelectContent>
              </Select>
              {(!isPotSizePreset && draft.pot_size !== "") && (
                <Input
                  value={draft.pot_size}
                  onChange={(e) => onChange({ pot_size: e.target.value })}
                  placeholder="Custom size"
                  className="mt-1.5"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${draft.id}-qty`}>
                Quantity <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`${draft.id}-qty`}
                type="number"
                min={1}
                value={draft.quantity}
                onChange={(e) => onChange({ quantity: e.target.value, quantityInvalid: false })}
                placeholder="e.g. 10"
                className={invalidQty ? "border-destructive" : ""}
              />
            </div>
          </div>

          {/* Category + Cost price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${draft.id}-category`}>Category</Label>
              <Input
                id={`${draft.id}-category`}
                value={draft.category}
                onChange={(e) => onChange({ category: e.target.value })}
                placeholder="e.g. Tropicals, Succulents"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${draft.id}-cost`}>Cost price (internal)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  id={`${draft.id}-cost`}
                  value={draft.cost_price}
                  onChange={(e) => onChange({ cost_price: e.target.value })}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor={`${draft.id}-desc`}>Description</Label>
            <Textarea
              id={`${draft.id}-desc`}
              value={draft.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Shown on listings created from this item"
              rows={2}
            />
          </div>

          {/* Internal notes */}
          <div className="space-y-1.5">
            <Label htmlFor={`${draft.id}-notes`}>Internal notes</Label>
            <p className="text-xs text-muted-foreground -mt-1">Only visible to you in your inventory.</p>
            <Textarea
              id={`${draft.id}-notes`}
              value={draft.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder="Supplier info, purchase date, storage location…"
              rows={2}
            />
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
                    onClick={() => onChange({ images: draft.images.filter((_, j) => j !== i) })}
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
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-sage hover:text-leaf transition-colors text-xs"
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
            <p className="text-xs text-muted-foreground">Photos upload when you click &quot;Add to inventory&quot;</p>
          </div>
        </div>
      )}
    </div>
  );
}
