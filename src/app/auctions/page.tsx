import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { centsToDisplay } from "@/lib/stripe";

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("auctions")
    .select("*")
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString())
    .order("ends_at", { ascending: true });

  if (q) query = query.ilike("plant_name", `%${q}%`);

  const { data: auctions } = await query;

  const sellerIds = [...new Set(auctions?.map((a) => a.seller_id) ?? [])];
  const { data: sellers } = sellerIds.length
    ? await supabase.from("profiles").select("id, username").in("id", sellerIds)
    : { data: [] };

  const sellerMap = Object.fromEntries((sellers ?? []).map((s) => [s.id, s]));

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Live Auctions</h1>
        <form className="w-64">
          <Input name="q" defaultValue={q} placeholder="Search auctions…" />
        </form>
      </div>

      {!auctions?.length ? (
        <p className="text-muted-foreground">No active auctions right now. Check back soon!</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {auctions.map((auction) => {
            const seller = sellerMap[auction.seller_id];
            const endsAt = new Date(auction.ends_at);
            const timeLeft = endsAt.getTime() - Date.now();
            const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

            return (
              <Link key={auction.id} href={`/auctions/${auction.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer overflow-hidden">
                  <div className="relative h-48 bg-muted">
                    {auction.images[0] ? (
                      <Image src={auction.images[0]} alt={auction.plant_name} fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-4xl">🌿</div>
                    )}
                    <Badge className="absolute top-2 right-2 bg-red-600">
                      {hoursLeft > 0 ? `${hoursLeft}h ${minutesLeft}m` : `${minutesLeft}m`} left
                    </Badge>
                  </div>
                  <CardContent className="p-4">
                    <p className="font-semibold truncate">{auction.plant_name}</p>
                    {auction.variety && (
                      <p className="text-sm text-muted-foreground truncate">{auction.variety}</p>
                    )}
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">Current bid</p>
                      <span className="font-bold text-green-700">
                        {centsToDisplay(auction.current_bid_cents)}
                      </span>
                    </div>
                    {seller && (
                      <p className="text-xs text-muted-foreground mt-1">by {seller.username}</p>
                    )}
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
