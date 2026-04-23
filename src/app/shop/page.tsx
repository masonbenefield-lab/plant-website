import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { centsToDisplay } from "@/lib/stripe";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (q) query = query.ilike("plant_name", `%${q}%`);

  const { data: listings } = await query;

  const sellerIds = [...new Set(listings?.map((l) => l.seller_id) ?? [])];
  const { data: sellers } = sellerIds.length
    ? await supabase.from("profiles").select("id, username").in("id", sellerIds)
    : { data: [] };

  const sellerMap = Object.fromEntries((sellers ?? []).map((s) => [s.id, s]));

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Shop Plants</h1>
        <form className="w-64">
          <Input name="q" defaultValue={q} placeholder="Search plants…" />
        </form>
      </div>

      {!listings?.length ? (
        <p className="text-muted-foreground">No listings found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {listings.map((listing) => {
            const seller = sellerMap[listing.seller_id];
            return (
              <Link key={listing.id} href={`/shop/${listing.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer overflow-hidden">
                  <div className="relative h-48 bg-gray-100">
                    {listing.images[0] ? (
                      <Image src={listing.images[0]} alt={listing.plant_name} fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-4xl">🌿</div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <p className="font-semibold truncate">{listing.plant_name}</p>
                    {listing.variety && (
                      <p className="text-sm text-muted-foreground truncate">{listing.variety}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold text-green-700">
                        {centsToDisplay(listing.price_cents)}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {listing.quantity} left
                      </Badge>
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
