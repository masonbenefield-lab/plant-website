import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OrdersClient from "./orders-client";

const PAGE_SIZE = 25;

export default async function OrdersDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: orders, count } = await supabase
    .from("orders")
    .select("*", { count: "exact" })
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (!orders?.length) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-8">Orders</h1>
        <div className="text-center py-16 border rounded-xl bg-muted/30">
          <p className="text-4xl mb-4">📦</p>
          <p className="font-semibold mb-1">No orders yet</p>
          <p className="text-sm text-muted-foreground mb-6">Orders from buyers will appear here once someone purchases one of your listings.</p>
          <div className="flex justify-center gap-3">
            <Link href="/dashboard/listings" className="text-sm text-green-700 hover:underline">View your listings</Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/dashboard/create" className="text-sm text-green-700 hover:underline">Add a listing</Link>
          </div>
        </div>
      </div>
    );
  }

  const listingIds = orders.filter((o) => o.listing_id).map((o) => o.listing_id!);
  const auctionIds = orders.filter((o) => o.auction_id).map((o) => o.auction_id!);
  const buyerIds = [...new Set(orders.map((o) => o.buyer_id))];

  const [{ data: listings }, { data: auctionItems }, { data: buyers }] = await Promise.all([
    listingIds.length
      ? supabase.from("listings").select("id, plant_name, variety").in("id", listingIds)
      : { data: [] },
    auctionIds.length
      ? supabase.from("auctions").select("id, plant_name, variety").in("id", auctionIds)
      : { data: [] },
    supabase.from("profiles").select("id, username").in("id", buyerIds),
  ]);

  const listingMap = Object.fromEntries((listings ?? []).map((l) => [l.id, l]));
  const auctionMap = Object.fromEntries((auctionItems ?? []).map((a) => [a.id, a]));
  const buyerMap = Object.fromEntries((buyers ?? []).map((b) => [b.id, b]));

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-8">Orders</h1>
      <OrdersClient
        orders={orders}
        listingMap={listingMap}
        auctionMap={auctionMap}
        buyerMap={buyerMap}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
