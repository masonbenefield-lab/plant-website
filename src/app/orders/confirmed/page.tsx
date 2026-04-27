import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { centsToDisplay } from "@/lib/stripe";

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

  const [{ data: listing }, { data: auction }, { data: seller }] = await Promise.all([
    order.listing_id
      ? supabase.from("listings").select("plant_name, variety, images").eq("id", order.listing_id).single()
      : { data: null },
    order.auction_id
      ? supabase.from("auctions").select("plant_name, variety, images").eq("id", order.auction_id).single()
      : { data: null },
    supabase.from("profiles").select("username").eq("id", order.seller_id).single(),
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
        Your payment was successful. The seller will be in touch soon.
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

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/orders" className={cn(buttonVariants({ variant: "outline" }))}>
          View all orders
        </Link>
        <Link href="/shop" className={cn(buttonVariants(), "bg-green-700 hover:bg-green-800")}>
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
