import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ count: listingCount }, { count: auctionCount }, { count: orderCount }] =
    await Promise.all([
      supabase.from("listings").select("*", { count: "exact", head: true }).eq("seller_id", user.id),
      supabase.from("auctions").select("*", { count: "exact", head: true }).eq("seller_id", user.id).eq("status", "active"),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("seller_id", user.id).eq("status", "paid"),
    ]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-8">Seller Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active Listings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{listingCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Live Auctions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{auctionCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Orders to Ship</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{orderCount ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/dashboard/listings"
          className={cn(buttonVariants(), "bg-green-700 hover:bg-green-800 h-14 text-base")}
        >
          Manage Listings
        </Link>
        <Link
          href="/dashboard/auctions"
          className={cn(buttonVariants({ variant: "outline" }), "h-14 text-base")}
        >
          Manage Auctions
        </Link>
        <Link
          href="/dashboard/orders"
          className={cn(buttonVariants({ variant: "outline" }), "h-14 text-base")}
        >
          View Orders
        </Link>
      </div>
    </div>
  );
}
