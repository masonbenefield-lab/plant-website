import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { centsToDisplay } from "@/lib/stripe";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/types";

export const metadata = { title: "My Bids — Plantet" };

function timeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export default async function MyBidsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get all auctions the user has ever bid on
  const { data: bids } = await admin
    .from("bids")
    .select("auction_id, amount_cents")
    .eq("bidder_id", user.id)
    .order("created_at", { ascending: false });

  const auctionIds = [...new Set((bids ?? []).map((b) => b.auction_id))];

  if (!auctionIds.length) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold mb-8">My Bids</h1>
        <Card>
          <CardContent className="py-16 text-center space-y-2">
            <p className="text-4xl">🏷️</p>
            <p className="font-medium">No bids yet</p>
            <p className="text-sm text-muted-foreground">Browse live auctions and place your first bid.</p>
            <Link href="/auctions" className="inline-block mt-3 text-sm font-medium text-green-700 hover:underline">
              Browse auctions →
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: auctions } = await admin
    .from("auctions")
    .select("id, plant_name, variety, current_bid_cents, current_bidder_id, status, ends_at, images, seller_id")
    .in("id", auctionIds);

  // For each auction, find user's highest bid
  const highBidMap: Record<string, number> = {};
  for (const b of bids ?? []) {
    if (!highBidMap[b.auction_id] || b.amount_cents > highBidMap[b.auction_id]) {
      highBidMap[b.auction_id] = b.amount_cents;
    }
  }

  type AuctionRow = NonNullable<typeof auctions>[number];
  function classify(a: AuctionRow): "winning" | "outbid" | "won" | "lost" | "no_winner" {
    const active = a.status === "active" && new Date(a.ends_at) > new Date();
    if (active) return a.current_bidder_id === user.id ? "winning" : "outbid";
    if (a.status === "ended") {
      if (!a.current_bidder_id) return "no_winner";
      return a.current_bidder_id === user.id ? "won" : "lost";
    }
    return "lost";
  }

  const groups: Record<string, AuctionRow[]> = { winning: [], outbid: [], won: [], lost: [], no_winner: [] };
  for (const a of auctions ?? []) groups[classify(a)].push(a);

  const sections: { key: string; label: string; badge: string; badgeClass: string }[] = [
    { key: "winning",   label: "Winning",        badge: "You're leading",  badgeClass: "bg-green-100 text-green-700" },
    { key: "outbid",    label: "Outbid",          badge: "You've been outbid", badgeClass: "bg-red-100 text-red-700" },
    { key: "won",       label: "Won",             badge: "You won",        badgeClass: "bg-green-100 text-green-700" },
    { key: "lost",      label: "Ended — not won", badge: "Ended",          badgeClass: "bg-gray-100 text-gray-500" },
    { key: "no_winner", label: "No winner",       badge: "No winner",      badgeClass: "bg-gray-100 text-gray-500" },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
      <h1 className="text-2xl font-bold">My Bids</h1>

      {sections.map(({ key, label, badge, badgeClass }) => {
        const items = groups[key];
        if (!items.length) return null;
        return (
          <div key={key}>
            <h2 className="text-base font-semibold mb-3 text-muted-foreground uppercase tracking-wide text-xs">{label}</h2>
            <div className="space-y-3">
              {items.map((a) => {
                const myBid = highBidMap[a.id];
                const img = (a.images as string[])?.[0];
                const isActive = a.status === "active" && new Date(a.ends_at) > new Date();
                return (
                  <Link key={a.id} href={`/auctions/${a.id}`}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden shrink-0 relative">
                          {img ? (
                            <Image src={img} alt={a.plant_name} fill className="object-cover" sizes="64px" />
                          ) : (
                            <div className="flex items-center justify-center h-full text-2xl">🌿</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{a.plant_name}{a.variety ? ` ${a.variety}` : ""}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeClass}`}>{badge}</span>
                            {isActive && (
                              <span className="text-xs text-muted-foreground">{timeLeft(a.ends_at)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 text-sm">
                            <span className="text-muted-foreground">Your bid: <span className="font-medium text-foreground">{centsToDisplay(myBid)}</span></span>
                            {a.current_bid_cents !== myBid && (
                              <span className="text-muted-foreground">Current: <span className="font-medium text-green-700">{centsToDisplay(a.current_bid_cents)}</span></span>
                            )}
                          </div>
                        </div>
                        {key === "won" && (
                          <span className="shrink-0 text-sm font-semibold text-green-700 underline underline-offset-2">
                            Complete purchase →
                          </span>
                        )}
                        {key === "outbid" && isActive && (
                          <span className="shrink-0 text-sm font-semibold text-green-700 underline underline-offset-2">
                            Bid again →
                          </span>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
