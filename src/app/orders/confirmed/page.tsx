import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { centsToDisplay } from "@/lib/stripe";
import FollowButton from "@/components/follow-button";

export default async function OrderConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) redirect("/orders");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .eq("buyer_id", user.id)
    .single();

  if (!order) redirect("/orders");

  const [{ data: listing }, { data: auction }, { data: seller }, { data: alreadyFollows }, { count: followerCount }] = await Promise.all([
    order.listing_id
      ? supabase.from("listings").select("plant_name, variety, images").eq("id", order.listing_id).single()
      : { data: null },
    order.auction_id
      ? supabase.from("auctions").select("plant_name, variety, images").eq("id", order.auction_id).single()
      : { data: null },
    supabase.from("profiles").select("id, username").eq("id", order.seller_id).single(),
    supabase.from("follows").select("id").eq("follower_id", user.id).eq("seller_id", order.seller_id).maybeSingle(),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("seller_id", order.seller_id),
  ]);

  const item = listing ?? auction;
  const addr = order.shipping_address as {
    name: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    zip: string;
    country: string;
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="text-6xl mb-4">🌿</div>
      <h1 className="text-2xl font-bold mb-2">Order confirmed!</h1>
      <p className="text-muted-foreground mb-8">
        {order.status === "paid"
          ? "Your payment was successful. The seller will be in touch soon."
          : "Your order has been placed and payment is being confirmed. The seller will be in touch soon."}
      </p>

      <Card className="text-left mb-6">
        <CardContent className="p-5 space-y-4">
          {item && (
            <div className="flex items-center gap-3">
              {(item.images as string[])?.[0] && (
                <img
                  src={(item.images as string[])[0]}
                  alt={item.plant_name}
                  className="w-16 h-16 rounded-lg object-cover border shrink-0"
                />
              )}
              <div>
                <p className="font-semibold">{item.plant_name}</p>
                {item.variety && <p className="text-sm text-muted-foreground">{item.variety}</p>}
                <p className="text-sm font-medium text-green-700 mt-0.5">{centsToDisplay(order.amount_cents)}</p>
              </div>
            </div>
          )}

          <div className="border-t pt-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Shipping to</p>
            <p>{addr.name}</p>
            <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
            <p>{addr.city}, {addr.state} {addr.zip}</p>
            <p>{addr.country}</p>
          </div>

          {seller?.username && (
            <div className="border-t pt-4 text-sm">
              <span className="text-muted-foreground">Seller: </span>
              <Link href={`/sellers/${seller.username}`} className="font-medium text-green-700 hover:underline">
                {seller.username}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mb-6">
        Once your order is delivered, you can leave a review from{" "}
        <Link href="/orders" className="text-green-700 hover:underline">My Purchases</Link>.
      </p>

      {seller && seller.id !== user.id && !alreadyFollows && (
        <div className="mb-6 border rounded-xl p-4 flex items-center justify-between gap-4 text-left bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <div>
            <p className="font-medium text-sm">Follow {seller.username}</p>
            <p className="text-xs text-muted-foreground">Get notified when they list new plants</p>
          </div>
          <FollowButton
            userId={user.id}
            sellerId={seller.id}
            initialFollowing={false}
            initialCount={followerCount ?? 0}
          />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/orders" className={cn(buttonVariants({ variant: "outline" }))}>
          View my purchases
        </Link>
        <Link href="/shop" className={cn(buttonVariants(), "bg-green-700 hover:bg-green-800")}>
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
