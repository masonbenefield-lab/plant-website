"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export default function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(q.trim() ? `/shop?q=${encodeURIComponent(q.trim())}` : "/shop");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-md">
      <div className="relative flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search monstera, pothos, orchid…"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-white/60"
        />
      </div>
      <button
        type="submit"
        className="px-4 py-2.5 bg-green-900 hover:bg-green-950 text-white text-sm font-semibold rounded-lg transition-colors shrink-0"
      >
        Search
      </button>
    </form>
  );
}
