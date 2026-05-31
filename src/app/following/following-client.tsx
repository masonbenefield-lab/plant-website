"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageButton } from "@/components/message-button";
import FollowButton from "@/components/follow-button";
import { toast } from "sonner";
import { MoreHorizontal, ShieldOff, Search, X, Loader2 } from "lucide-react";

type Profile = { id: string; username: string; display_name: string | null; avatar_url: string | null };

interface Props {
  currentUserId: string;
  followingIds: string[];
  followerIds: string[];
  blockedIds: string[];
  profileMap: Record<string, Profile>;
}

const TABS = ["following", "followers", "find_people", "blocked"] as const;
type Tab = typeof TABS[number];

const TAB_LABEL: Record<Tab, string> = {
  following: "Following",
  followers: "Followers",
  find_people: "Find People",
  blocked: "Blocked",
};

const EMPTY_MSG: Record<Exclude<Tab, "find_people">, string> = {
  following: "You're not following anyone yet.",
  followers: "You don't have any followers yet.",
  blocked: "No blocked users.",
};

export default function FollowingClient({ currentUserId, followingIds, followerIds, blockedIds, profileMap }: Props) {
  const [tab, setTab] = useState<Tab>("following");
  const [query, setQuery] = useState("");
  const [following, setFollowing] = useState(() => new Set(followingIds));
  const [followers, setFollowers] = useState(() => new Set(followerIds));
  const [blocked, setBlocked] = useState(() => new Set(blockedIds));

  // Find People tab state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tab !== "find_people") return;
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const { users } = await res.json();
        setSearchResults(users);
      }
      setSearching(false);
    }, 400);
  }, [searchQuery, tab]);

  async function handleBlock(userId: string) {
    const res = await fetch("/api/users/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockedId: userId, action: "block" }),
    });
    if (!res.ok) { toast.error("Failed to block user"); return; }
    setFollowing((prev) => { const s = new Set(prev); s.delete(userId); return s; });
    setFollowers((prev) => { const s = new Set(prev); s.delete(userId); return s; });
    setBlocked((prev) => new Set(prev).add(userId));
    toast.success("User blocked");
  }

  async function handleUnblock(userId: string) {
    const res = await fetch("/api/users/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockedId: userId, action: "unblock" }),
    });
    if (!res.ok) { toast.error("Failed to unblock user"); return; }
    setBlocked((prev) => { const s = new Set(prev); s.delete(userId); return s; });
    toast.success("User unblocked");
  }

  const lists: Record<Exclude<Tab, "find_people">, Profile[]> = useMemo(() => ({
    following: [...following].map((id) => profileMap[id]).filter(Boolean),
    followers: [...followers].map((id) => profileMap[id]).filter(Boolean),
    blocked: [...blocked].map((id) => profileMap[id]).filter(Boolean),
  }), [following, followers, blocked, profileMap]);

  const currentList = useMemo(() => {
    if (tab === "find_people") return [];
    const q = query.trim().toLowerCase();
    return q ? lists[tab].filter((p) => p.username.toLowerCase().includes(q)) : lists[tab];
  }, [lists, tab, query]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Connections</h1>

      {/* Tabs */}
      <div className="flex gap-0 border-b mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setQuery(""); setSearchQuery(""); setSearchResults([]); }}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t
                ? "border-green-700 text-green-700"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {TAB_LABEL[t]}
            {t !== "find_people" && (
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                ({lists[t as Exclude<Tab, "find_people">].length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Find People tab */}
      {tab === "find_people" ? (
        <div>
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username or shop name…"
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {searching ? (
            <div className="py-16 flex justify-center"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-2">
              {searchResults.map((profile) => (
                <UserCard
                  key={profile.id}
                  profile={profile}
                  tab="find_people"
                  following={following}
                  blocked={blocked}
                  currentUserId={currentUserId}
                  onBlock={handleBlock}
                  onUnblock={handleUnblock}
                />
              ))}
            </div>
          ) : searchQuery.trim() ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No users found for &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            <div className="py-16 text-center text-muted-foreground text-sm">
              Type a username to search for people to follow.
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Search within existing lists */}
          {lists[tab as Exclude<Tab, "find_people">].length > 0 && (
            <div className="relative mb-4">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${TAB_LABEL[tab].toLowerCase()}…`}
                className="pl-9 pr-9"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {currentList.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              {query
                ? `No ${TAB_LABEL[tab].toLowerCase()} match "${query}"`
                : EMPTY_MSG[tab as Exclude<Tab, "find_people">]}
            </div>
          ) : (
            <div className="space-y-2">
              {currentList.map((profile) => (
                <UserCard
                  key={profile.id}
                  profile={profile}
                  tab={tab as Exclude<Tab, "find_people">}
                  following={following}
                  blocked={blocked}
                  currentUserId={currentUserId}
                  onBlock={handleBlock}
                  onUnblock={handleUnblock}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function UserCard({
  profile, tab, following, blocked, currentUserId, onBlock, onUnblock,
}: {
  profile: Profile;
  tab: Tab;
  following: Set<string>;
  blocked: Set<string>;
  currentUserId: string;
  onBlock: (id: string) => void;
  onUnblock: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={profile.avatar_url ?? undefined} />
        <AvatarFallback className="bg-green-100 text-green-700 text-sm font-semibold">
          {profile.username.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <Link
          href={`/sellers/${profile.username}`}
          className="font-medium text-sm hover:text-green-700 hover:underline block truncate"
        >
          {profile.display_name ?? profile.username}
        </Link>
        {profile.display_name && (
          <span className="text-xs text-muted-foreground block truncate">@{profile.username}</span>
        )}
        {tab === "followers" && (
          <span className="text-xs text-muted-foreground">
            {following.has(profile.id) ? "Follows you back" : "Follows you"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {tab !== "blocked" ? (
          <>
            <MessageButton recipientId={profile.id} />
            <FollowButton
              userId={currentUserId}
              sellerId={profile.id}
              initialFollowing={following.has(profile.id)}
              initialCount={0}
            />
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                  <MoreHorizontal size={15} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onBlock(profile.id)}
                  className="text-red-600 focus:text-red-600"
                >
                  <ShieldOff size={14} className="mr-2" />
                  Block {profile.username}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => onUnblock(profile.id)}>
            Unblock
          </Button>
        )}
      </div>
    </div>
  );
}
