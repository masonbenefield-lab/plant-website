"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sprout, ArrowLeftRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  garden_bio: string | null;
  open_to_trades: boolean;
}

interface GardenSummary {
  count: number;
  photos: string[];
}

export default function CommunityGardensGrid({
  gardens,
  gardenMap,
  currentUserId,
}: {
  gardens: Profile[];
  gardenMap: Record<string, GardenSummary>;
  currentUserId: string | null;
}) {
  const [q, setQ] = useState("");
  const [activeQ, setActiveQ] = useState("");

  const filtered = activeQ.trim()
    ? gardens.filter((p) => {
        const name = (p.display_name || p.username).toLowerCase();
        return name.includes(activeQ.toLowerCase());
      })
    : gardens;

  return (
    <div className="space-y-4">
      {/* Search */}
      <form
        className="flex items-center gap-2 max-w-xs"
        onSubmit={(e) => { e.preventDefault(); setActiveQ(q); }}
      >
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search gardens..."
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
        <button type="submit" className="px-3 py-2 text-sm rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors font-medium">
          Search
        </button>
      </form>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Sprout className="mx-auto text-muted-foreground" size={36} />
            <p className="font-medium">{q ? "No gardens match your search" : "No public gardens yet"}</p>
            {!q && (
              <p className="text-sm text-muted-foreground">Make your garden public to be listed here.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((profile) => {
            const { count, photos } = gardenMap[profile.id] ?? { count: 0, photos: [] };
            const name = profile.display_name || profile.username;
            const isOwnGarden = currentUserId === profile.id;
            return (
              <Link key={profile.id} href={isOwnGarden ? "/garden" : `/gardens/${profile.username}`}>
                <Card className={cn("overflow-hidden hover:shadow-md transition-shadow group h-full relative", isOwnGarden && "ring-2 ring-green-500")}>
                  {isOwnGarden && (
                    <div className="absolute top-2 left-2 z-10 text-[10px] font-semibold bg-green-600 text-white px-2 py-0.5 rounded-full">
                      Your garden
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-0.5 bg-muted aspect-[4/3]">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="relative overflow-hidden bg-muted">
                        {photos[i] ? (
                          <Image
                            src={photos[i]}
                            alt=""
                            fill
                            className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-2xl">🪴</div>
                        )}
                      </div>
                    ))}
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={profile.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px] bg-green-100 text-green-700">
                          {name?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <p className="font-semibold text-sm leading-tight truncate">{name}</p>
                      {profile.open_to_trades && (
                        <span className="ml-auto shrink-0 flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          <ArrowLeftRight size={9} />
                          Trades
                        </span>
                      )}
                    </div>
                    {profile.garden_bio && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {profile.garden_bio}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {count} plant{count !== 1 ? "s" : ""}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
