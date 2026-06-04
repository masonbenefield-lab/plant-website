import type { Database } from "@/lib/supabase/types";
export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type AuctionStatus = Database["public"]["Enums"]["auction_status"];
export type ListingStatus = Database["public"]["Enums"]["listing_status"];
