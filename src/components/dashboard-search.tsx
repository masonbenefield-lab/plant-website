"use client";

import { useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

export default function DashboardSearch({ placeholder = "Search…", basePath }: { placeholder?: string; basePath: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = params.get("q") ?? "";

  function push(q: string) {
    const next = new URLSearchParams(params.toString());
    if (q) {
      next.set("q", q);
    } else {
      next.delete("q");
    }
    next.delete("page");
    router.push(`${basePath}?${next.toString()}`);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => push(val), 350);
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    push("");
  }

  return (
    <div className="relative w-full max-w-xs">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        defaultValue={current}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-8 pr-8 h-9 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {current && (
        <button onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
