export const dynamic = "force-dynamic";

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
    supabase.from("profiles").select("seller_terms_accepted_at, is_admin, stripe_onboarded, plan, return_policy_type, shipping_days, ship_from_address, calculated_shipping_enabled").eq("id", user.id).single(),
    supabase.from("inventory").select("*").eq("seller_id", user.id).is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("inventory").select("*").eq("seller_id", user.id).not("archived_at", "is", null).gte("archived_at", thirtyDaysAgo).order("archived_at", { ascending: false }),
  ]);

  // Fetch linked listings by ID
  const listingIds = (activeInventory ?? []).map(i => i.listing_id).filter(Boolean) as string[];

  const { data: linkedListings } = listingIds.length
    ? await supabase.from("listings").select("id, price_cents, quantity, status, created_at, sale_price_cents, sale_ends_at, bundle_discount_pct, sold_out_behavior, care_guide_pdf_url, last_activated_at").in("id", listingIds)
    : { data: [] as { id: string; price_cents: number; quantity: number; status: string; created_at: string; sale_price_cents: number | null; sale_ends_at: string | null; bundle_discount_pct: number | null; sold_out_behavior: "mark_sold_out" | "auto_pause"; care_guide_pdf_url: string | null; last_activated_at: string | null }[] };

  const listingMap = Object.fromEntries((linkedListings ?? []).map(l => [l.id, l]));

  function computeStatus(listing: { status: string } | null): string {
    if (listing?.status === "active") return "In Shop";
    if (listing?.status === "paused") return "Paused";
    if (listing?.status === "sold_out") return "Sold Out";
    return "Draft";
  }

  const activeRows = (activeInventory ?? []).map((item) => {
    const listing = item.listing_id ? (listingMap[item.listing_id] ?? null) : null;
    return {
      id: item.id,
      plant_name: item.plant_name,
      variety: item.variety ?? "",
      quantity: item.quantity,
      listing_quantity: item.listing_quantity ?? null,
      listing_id: item.listing_id ?? null,
      listing_price_cents: listing?.price_cents ?? null,
      listing_status: listing?.status ?? null,
      listing_created_at: listing?.created_at ?? null,
      listing_sale_price_cents: listing?.sale_price_cents ?? null,
      listing_sale_ends_at: listing?.sale_ends_at ?? null,
      listing_bundle_discount_pct: (listing as { bundle_discount_pct?: number | null } | null)?.bundle_discount_pct ?? null,
      listing_sold_out_behavior: (listing as { sold_out_behavior?: "mark_sold_out" | "auto_pause" } | null)?.sold_out_behavior ?? "mark_sold_out",
      listing_care_guide_pdf_url: (listing as { care_guide_pdf_url?: string | null } | null)?.care_guide_pdf_url ?? null,
      listing_last_activated_at: (listing as { last_activated_at?: string | null } | null)?.last_activated_at ?? null,
      shipping_weight_oz: (item as { shipping_weight_oz?: number | null }).shipping_weight_oz ?? null,
      shipping_cost_cents: (item as { shipping_cost_cents?: number | null }).shipping_cost_cents ?? null,
      free_shipping: (item as { free_shipping?: boolean }).free_shipping ?? false,
      low_stock_threshold: (item as { low_stock_threshold?: number | null }).low_stock_threshold ?? null,
      cost_cents: (item as { cost_cents?: number | null }).cost_cents ?? null,
      status: computeStatus(listing),
      description: item.description ?? "",
      notes: item.notes ?? "",
      images: (item.images as string[]) ?? [],
      category: item.category ?? null,
      pot_size: item.pot_size ?? null,
      item_type: (item as { item_type?: string | null }).item_type ?? "plant",
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
    listing_created_at: null as string | null,
    listing_sale_price_cents: null as number | null,
    listing_sale_ends_at: null as string | null,
    listing_bundle_discount_pct: null as number | null,
    listing_sold_out_behavior: "mark_sold_out" as "mark_sold_out" | "auto_pause",
    listing_care_guide_pdf_url: null as string | null,
    listing_last_activated_at: null as string | null,
    shipping_weight_oz: (item as { shipping_weight_oz?: number | null }).shipping_weight_oz ?? null,
    shipping_cost_cents: (item as { shipping_cost_cents?: number | null }).shipping_cost_cents ?? null,
    free_shipping: (item as { free_shipping?: boolean }).free_shipping ?? false,
    low_stock_threshold: null as number | null,
    cost_cents: null as number | null,
    status: "Archived",
    description: item.description ?? "",
    notes: item.notes ?? "",
    images: (item.images as string[]) ?? [],
    category: item.category ?? null,
    pot_size: item.pot_size ?? null,
    item_type: (item as { item_type?: string | null }).item_type ?? "plant",
    created_at: item.created_at,
    archived_at: item.archived_at,
  }));

  // Orphaned listings — created before inventory tracking (no inventory_id)
  const { data: unlinkedListings } = await supabase
    .from("listings")
    .select("id, plant_name, variety, quantity, price_cents, status, images, category, pot_size, description")
    .eq("seller_id", user.id)
    .is("inventory_id", null)
    .order("created_at", { ascending: false });

  const termsAccepted = !!profile?.seller_terms_accepted_at;
  const isAdmin = !!(profile as { is_admin?: boolean } | null)?.is_admin;
  const stripeOnboarded = !!(profile as { stripe_onboarded?: boolean } | null)?.stripe_onboarded;
  const hasReturnPolicy = !!(profile as { return_policy_type?: string | null } | null)?.return_policy_type;
  const hasShippingTimeline = !!(profile as { shipping_days?: number | null } | null)?.shipping_days;
  const shipFromAddr = (profile as { ship_from_address?: { street1?: string; city?: string; zip?: string } | null } | null)?.ship_from_address;
  const hasShipFrom = !!(shipFromAddr?.street1?.trim() && shipFromAddr?.city?.trim() && shipFromAddr?.zip?.trim());
  // Require a complete address AND explicit opt-in (null/undefined = not enabled)
  const calculatedShippingEnabled = hasShipFrom && (profile as { calculated_shipping_enabled?: boolean | null } | null)?.calculated_shipping_enabled === true;

  const { getPlanLimits } = await import("@/lib/plan-limits");
  const planLimits = getPlanLimits((profile as { plan?: string } | null)?.plan as "seedling" | "grower" | "nursery" | null, isAdmin);

  return (
    <InventoryClient
      activeRows={activeRows}
      archivedRows={archivedRows}
      isAdmin={isAdmin}
      planLimits={planLimits}
      termsAccepted={termsAccepted}
      showWelcome={activeRows.length === 0}
      stripeOnboarded={stripeOnboarded}
      hasReturnPolicy={hasReturnPolicy}
      hasShippingTimeline={hasShippingTimeline}
      hasShipFrom={hasShipFrom}
      calculatedShippingEnabled={calculatedShippingEnabled}
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
      initialSearch={q ?? ""}
      initialCategory={cat ?? ""}
    />
  );
}
