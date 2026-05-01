import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InventoryClient from "./inventory-client";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const { q, cat } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: profile },
    { data: activeInventory },
    { data: archivedInventory },
  ] = await Promise.all([
    supabase.from("profiles").select("seller_terms_accepted_at").eq("id", user.id).single(),
    supabase.from("inventory").select("*").eq("seller_id", user.id).is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("inventory").select("*").eq("seller_id", user.id).not("archived_at", "is", null).gte("archived_at", thirtyDaysAgo).order("archived_at", { ascending: false }),
  ]);

  // Fetch linked listings and auctions by ID
  const listingIds = (activeInventory ?? []).map(i => i.listing_id).filter(Boolean) as string[];
  const auctionIds = (activeInventory ?? []).map(i => i.auction_id).filter(Boolean) as string[];

  const [{ data: linkedListings }, { data: linkedAuctions }] = await Promise.all([
    listingIds.length
      ? supabase.from("listings").select("id, price_cents, quantity, status").in("id", listingIds)
      : Promise.resolve({ data: [] as { id: string; price_cents: number; quantity: number; status: string }[] }),
    auctionIds.length
      ? supabase.from("auctions").select("id, current_bid_cents, ends_at, status, quantity").in("id", auctionIds)
      : Promise.resolve({ data: [] as { id: string; current_bid_cents: number; ends_at: string; status: string; quantity: number }[] }),
  ]);

  const listingMap = Object.fromEntries((linkedListings ?? []).map(l => [l.id, l]));
  const auctionMap = Object.fromEntries((linkedAuctions ?? []).map(a => [a.id, a]));

  function computeStatus(listing: { status: string } | null, auction: { status: string } | null): string {
    const activeListing = listing && listing.status === "active";
    const pausedListing = listing && listing.status === "paused";
    const soldOutListing = listing && listing.status === "sold_out";
    const activeAuction = auction && auction.status === "active";
    const endedAuction = auction && (auction.status === "ended" || auction.status === "cancelled");

    if (activeListing && activeAuction) return "Shop + Auction";
    if (activeListing) return "In Shop";
    if (activeAuction) return "Live Auction";
    if (pausedListing) return "Paused";
    if (soldOutListing) return "Sold Out";
    if (endedAuction) return "Auction Ended";
    return "Draft";
  }

  const activeRows = (activeInventory ?? []).map((item) => {
    const listing = item.listing_id ? (listingMap[item.listing_id] ?? null) : null;
    const auction = item.auction_id ? (auctionMap[item.auction_id] ?? null) : null;
    return {
      id: item.id,
      plant_name: item.plant_name,
      variety: item.variety ?? "",
      quantity: item.quantity,
      listing_quantity: item.listing_quantity ?? null,
      listing_id: item.listing_id ?? null,
      listing_price_cents: listing?.price_cents ?? null,
      listing_status: listing?.status ?? null,
      auction_quantity: (item as { auction_quantity?: number | null }).auction_quantity ?? null,
      auction_id: (item as { auction_id?: string | null }).auction_id ?? null,
      auction_bid_cents: auction?.current_bid_cents ?? null,
      auction_ends_at: auction?.ends_at ?? null,
      auction_status: auction?.status ?? null,
      status: computeStatus(listing, auction),
      description: item.description ?? "",
      notes: item.notes ?? "",
      images: (item.images as string[]) ?? [],
      category: item.category ?? null,
      pot_size: item.pot_size ?? null,
      created_at: item.created_at,
      archived_at: null as string | null,
    };
  });

  const archivedRows = (archivedInventory ?? []).map((item) => ({
    id: item.id,
    plant_name: item.plant_name,
    variety: item.variety ?? "",
    quantity: item.quantity,
    listing_quantity: item.listing_quantity ?? null,
    listing_id: item.listing_id ?? null,
    listing_price_cents: null as number | null,
    listing_status: null as string | null,
    auction_quantity: null as number | null,
    auction_id: null as string | null,
    auction_bid_cents: null as number | null,
    auction_ends_at: null as string | null,
    auction_status: null as string | null,
    status: "Archived",
    description: item.description ?? "",
    notes: item.notes ?? "",
    images: (item.images as string[]) ?? [],
    category: item.category ?? null,
    pot_size: item.pot_size ?? null,
    created_at: item.created_at,
    archived_at: item.archived_at,
  }));

  // Orphaned listings/auctions — created before inventory tracking (no inventory_id)
  const [{ data: unlinkedListings }, { data: unlinkedAuctions }] = await Promise.all([
    supabase
      .from("listings")
      .select("id, plant_name, variety, quantity, price_cents, status, images, category, pot_size, description")
      .eq("seller_id", user.id)
      .is("inventory_id", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("auctions")
      .select("id, plant_name, variety, quantity, current_bid_cents, ends_at, status, images, category, pot_size, description")
      .eq("seller_id", user.id)
      .is("inventory_id", null)
      .order("created_at", { ascending: false }),
  ]);

  const termsAccepted = !!profile?.seller_terms_accepted_at;

  return (
    <InventoryClient
      activeRows={activeRows}
      archivedRows={archivedRows}
      termsAccepted={termsAccepted}
      unlinkedListings={(unlinkedListings ?? []).map(l => ({
        id: l.id,
        plant_name: l.plant_name,
        variety: l.variety ?? "",
        quantity: l.quantity,
        price_cents: l.price_cents,
        status: l.status,
        images: (l.images as string[]) ?? [],
        category: l.category ?? null,
        pot_size: l.pot_size ?? null,
        description: l.description ?? "",
      }))}
      unlinkedAuctions={(unlinkedAuctions ?? []).map(a => ({
        id: a.id,
        plant_name: a.plant_name,
        variety: a.variety ?? "",
        quantity: a.quantity,
        current_bid_cents: a.current_bid_cents,
        ends_at: a.ends_at,
        status: a.status,
        images: (a.images as string[]) ?? [],
        category: a.category ?? null,
        pot_size: a.pot_size ?? null,
        description: a.description ?? "",
      }))}
      initialSearch={q ?? ""}
      initialCategory={cat ?? ""}
    />
  );
}
