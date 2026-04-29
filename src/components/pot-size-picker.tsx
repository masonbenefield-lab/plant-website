"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { POT_SIZES } from "@/lib/pot-sizes";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function PotSizePicker({ value, onChange }: Props) {
  const isCustom = value !== "" && !(POT_SIZES as readonly string[]).includes(value);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {POT_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => onChange(value === size ? "" : size)}
            className={cn(
              "px-2.5 py-1 text-xs rounded-full border font-medium transition-colors",
              value === size
                ? "bg-green-700 text-white border-green-700"
                : "border-border text-muted-foreground bg-background hover:border-green-500 hover:text-green-700"
            )}
          >
            {size}
          </button>
        ))}
      </div>
      <Input
        type="text"
        placeholder="Custom size (e.g. 4″ nursery pot)…"
        value={isCustom ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { if (!isCustom) onChange(""); }}
        className="h-8 text-sm"
      />
    </div>
  );
}
