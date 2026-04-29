import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { centsToDisplay } from "@/lib/stripe";
import InventoryClient from "./inventory-client";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: profile },
    { data: activeInventory },
    { data: archivedInventory },
    { data: listings },
    { data: auctions },
  ] = await Promise.all([
    supabase.from("profiles").select("seller_terms_accepted_at").eq("id", user.id).single(),
    supabase.from("inventory").select("*").eq("seller_id", user.id).is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("inventory").select("*").eq("seller_id", user.id).not("archived_at", "is", null).gte("archived_at", thirtyDaysAgo).order("archived_at", { ascending: false }),
    supabase.from("listings").select("id, plant_name, variety, status, quantity, in_stock, price_cents, description, images, category, seller_id, created_at").eq("seller_id", user.id).order("created_at", { ascending: false }),
    supabase.from("auctions").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }),
  ]);

  const activeRows = [
    ...(activeInventory ?? []).map((item) => ({
      id: item.id,
      source: "inventory" as const,
      plant_name: item.plant_name,
      variety: item.variety ?? "",
      quantity: item.quantity,
      in_stock: null as number | null,
      listing_quantity: item.listing_quantity ?? null,
      linked_listing_id: item.listing_id ?? null,
      description: item.description ?? "",
      notes: item.notes ?? "",
      status: "Draft",
      price: "",
      price_cents: null as number | null,
      images: (item.images as string[]) ?? [],
      category: item.category ?? null,
      pot_size: item.pot_size ?? null,
      ends_at: null as string | null,
      created_at: item.created_at,
      archived_at: null as string | null,
    })),
    ...(listings ?? []).map((l) => ({
      id: l.id,
      source: "listing" as const,
      plant_name: l.plant_name,
      variety: l.variety ?? "",
      quantity: l.quantity,
      in_stock: l.in_stock ?? null,
      listing_quantity: null as number | null,
      linked_listing_id: null as string | null,
      description: l.description ?? "",
      notes: "",
      status: l.status === "active" ? "In Shop" : l.status === "paused" ? "Paused" : "Sold Out",
      price: centsToDisplay(l.price_cents),
      price_cents: l.price_cents,
      images: (l.images as string[]) ?? [],
      category: l.category ?? null,
      pot_size: l.pot_size ?? null,
      ends_at: null as string | null,
      created_at: l.created_at,
      archived_at: null as string | null,
    })),
    ...(auctions ?? []).map((a) => ({
      id: a.id,
      source: "auction" as const,
      plant_name: a.plant_name,
      variety: a.variety ?? "",
      quantity: a.quantity,
      in_stock: null as number | null,
      listing_quantity: null as number | null,
      linked_listing_id: null as string | null,
      description: a.description ?? "",
      notes: "",
      status: a.status === "active" ? "Live Auction" : a.status === "ended" ? "Auction Ended" : "Cancelled",
      price: `${centsToDisplay(a.current_bid_cents)} bid`,
      price_cents: null as number | null,
      images: (a.images as string[]) ?? [],
      category: a.category ?? null,
      pot_size: a.pot_size ?? null,
      ends_at: a.ends_at,
      created_at: a.created_at,
      archived_at: null as string | null,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const archivedRows = (archivedInventory ?? []).map((item) => ({
    id: item.id,
    source: "inventory" as const,
    plant_name: item.plant_name,
    variety: item.variety ?? "",
    quantity: item.quantity,
    in_stock: null as number | null,
    listing_quantity: item.listing_quantity ?? null,
    linked_listing_id: item.listing_id ?? null,
    description: item.description ?? "",
    notes: item.notes ?? "",
    status: "Archived",
    price: "",
    price_cents: null as number | null,
    images: (item.images as string[]) ?? [],
    category: item.category ?? null,
    pot_size: item.pot_size ?? null,
    ends_at: null as string | null,
    created_at: item.created_at,
    archived_at: item.archived_at,
  }));

  const listingOptions = (listings ?? []).map((l) => ({
    id: l.id,
    plant_name: l.plant_name,
    variety: l.variety ?? null,
  }));

  const termsAccepted = !!profile?.seller_terms_accepted_at;

  return <InventoryClient activeRows={activeRows} archivedRows={archivedRows} listingOptions={listingOptions} termsAccepted={termsAccepted} />;
}
