export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type ListingStatus = "active" | "paused" | "sold_out";
export type AuctionStatus = "active" | "ended" | "cancelled";
export type OrderStatus = "pending" | "paid" | "shipped" | "delivered";

export interface Database {
  public: {
    Tables: {

      profiles: {
        Row: {
          id: string;
          username: string;
          bio: string | null;
          avatar_url: string | null;
          stripe_account_id: string | null;
          stripe_onboarded: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          bio?: string | null;
          avatar_url?: string | null;
          stripe_account_id?: string | null;
          stripe_onboarded?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          bio?: string | null;
          avatar_url?: string | null;
          stripe_account_id?: string | null;
          stripe_onboarded?: boolean;
        };
        Relationships: [];
      };
      listings: {
        Row: {
          id: string;
          seller_id: string;
          plant_name: string;
          variety: string | null;
          quantity: number;
          description: string | null;
          price_cents: number;
          images: string[];
          status: ListingStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          plant_name: string;
          variety?: string | null;
          quantity: number;
          description?: string | null;
          price_cents: number;
          images?: string[];
          status?: ListingStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          plant_name?: string;
          variety?: string | null;
          quantity?: number;
          description?: string | null;
          price_cents?: number;
          images?: string[];
          status?: ListingStatus;
        };
        Relationships: [];
      };
      auctions: {
        Row: {
          id: string;
          seller_id: string;
          plant_name: string;
          variety: string | null;
          quantity: number;
          description: string | null;
          images: string[];
          starting_bid_cents: number;
          current_bid_cents: number;
          current_bidder_id: string | null;
          ends_at: string;
          status: AuctionStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          plant_name: string;
          variety?: string | null;
          quantity: number;
          description?: string | null;
          images?: string[];
          starting_bid_cents: number;
          current_bid_cents?: number;
          current_bidder_id?: string | null;
          ends_at: string;
          status?: AuctionStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          plant_name?: string;
          variety?: string | null;
          quantity?: number;
          description?: string | null;
          images?: string[];
          starting_bid_cents?: number;
          current_bid_cents?: number;
          current_bidder_id?: string | null;
          ends_at?: string;
          status?: AuctionStatus;
        };
        Relationships: [];
      };
      bids: {
        Row: {
          id: string;
          auction_id: string;
          bidder_id: string;
          amount_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          auction_id: string;
          bidder_id: string;
          amount_cents: number;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          buyer_id: string;
          seller_id: string;
          listing_id: string | null;
          auction_id: string | null;
          stripe_payment_intent_id: string | null;
          shipping_address: {
            name: string;
            line1: string;
            line2: string | null;
            city: string;
            state: string;
            zip: string;
            country: string;
          };
          status: OrderStatus;
          amount_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          buyer_id: string;
          seller_id: string;
          listing_id?: string | null;
          auction_id?: string | null;
          stripe_payment_intent_id?: string | null;
          shipping_address: {
            name: string;
            line1: string;
            line2?: string | null;
            city: string;
            state: string;
            zip: string;
            country: string;
          };
          status?: OrderStatus;
          amount_cents: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          stripe_payment_intent_id?: string | null;
          status?: OrderStatus;
        };
        Relationships: [];
      };
      inventory: {
        Row: {
          id: string;
          seller_id: string;
          plant_name: string;
          variety: string | null;
          quantity: number;
          description: string | null;
          images: string[];
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          plant_name: string;
          variety?: string | null;
          quantity: number;
          description?: string | null;
          images?: string[];
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          plant_name?: string;
          variety?: string | null;
          quantity?: number;
          description?: string | null;
          images?: string[];
          notes?: string | null;
        };
        Relationships: [];
      };
      ratings: {
        Row: {
          id: string;
          reviewer_id: string;
          seller_id: string;
          order_id: string;
          score: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reviewer_id: string;
          seller_id: string;
          order_id: string;
          score: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
