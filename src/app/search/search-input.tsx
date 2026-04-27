"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export default function SearchInput({ initialQ }: { initialQ: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);

  const submit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
    },
    [router]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(q);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xl">
      <div className="relative flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search plant name, variety…"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm border bg-background focus:outline-none focus:ring-2 focus:ring-green-500"
          autoFocus
        />
      </div>
      <button
        type="submit"
        className="px-5 py-2.5 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold rounded-lg transition-colors shrink-0"
      >
        Search
      </button>
    </form>
  );
}
