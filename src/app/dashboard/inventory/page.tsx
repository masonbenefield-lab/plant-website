import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { centsToDisplay } from "@/lib/stripe";
import InventoryClient from "./inventory-client";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: inventoryItems },
    { data: listings },
    { data: auctions },
  ] = await Promise.all([
    supabase.from("inventory").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }),
    supabase.from("listings").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }),
    supabase.from("auctions").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }),
  ]);

  const rows = [
    ...(inventoryItems ?? []).map((item) => ({
      id: item.id,
      plant_name: item.plant_name,
      variety: item.variety ?? "",
      quantity: item.quantity,
      description: item.description ?? "",
      status: "Draft" as const,
      price: "",
      created_at: item.created_at,
    })),
    ...(listings ?? []).map((l) => ({
      id: l.id,
      plant_name: l.plant_name,
      variety: l.variety ?? "",
      quantity: l.quantity,
      description: l.description ?? "",
      status: l.status === "active" ? "In Shop" : l.status === "paused" ? "Paused" : "Sold Out",
      price: centsToDisplay(l.price_cents),
      created_at: l.created_at,
    })),
    ...(auctions ?? []).map((a) => ({
      id: a.id,
      plant_name: a.plant_name,
      variety: a.variety ?? "",
      quantity: a.quantity,
      description: a.description ?? "",
      status: a.status === "active" ? "Live Auction" : a.status === "ended" ? "Auction Ended" : "Cancelled",
      price: `${centsToDisplay(a.current_bid_cents)} bid`,
      created_at: a.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return <InventoryClient rows={rows} />;
}
