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
          location: string | null;
          banner_url: string | null;
          seller_terms_accepted_at: string | null;
          stripe_account_id: string | null;
          stripe_onboarded: boolean;
          is_admin: boolean;
          plan: "seedling" | "grower" | "nursery";
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          bio?: string | null;
          avatar_url?: string | null;
          location?: string | null;
          banner_url?: string | null;
          stripe_account_id?: string | null;
          stripe_onboarded?: boolean;
          is_admin?: boolean;
          plan?: "seedling" | "grower" | "nursery";
          deleted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          bio?: string | null;
          avatar_url?: string | null;
          location?: string | null;
          banner_url?: string | null;
          seller_terms_accepted_at?: string | null;
          stripe_account_id?: string | null;
          stripe_onboarded?: boolean;
          is_admin?: boolean;
          plan?: "seedling" | "grower" | "nursery";
          deleted_at?: string | null;
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
          in_stock: number | null;
          description: string | null;
          price_cents: number;
          images: string[];
          status: ListingStatus;
          category: string | null;
          pot_size: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          plant_name: string;
          variety?: string | null;
          quantity: number;
          in_stock?: number | null;
          description?: string | null;
          price_cents: number;
          images?: string[];
          status?: ListingStatus;
          category?: string | null;
          pot_size?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          plant_name?: string;
          variety?: string | null;
          quantity?: number;
          in_stock?: number | null;
          description?: string | null;
          price_cents?: number;
          images?: string[];
          status?: ListingStatus;
          category?: string | null;
          pot_size?: string | null;
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
          buy_now_price_cents: number | null;
          current_bidder_id: string | null;
          ends_at: string;
          status: AuctionStatus;
          category: string | null;
          pot_size: string | null;
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
          buy_now_price_cents?: number | null;
          current_bidder_id?: string | null;
          ends_at: string;
          status?: AuctionStatus;
          category?: string | null;
          pot_size?: string | null;
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
          buy_now_price_cents?: number | null;
          current_bidder_id?: string | null;
          ends_at?: string;
          status?: AuctionStatus;
          category?: string | null;
          pot_size?: string | null;
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
          tracking_number: string | null;
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
          tracking_number?: string | null;
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
          listing_quantity: number | null;
          listing_id: string | null;
          description: string | null;
          images: string[];
          notes: string | null;
          category: string | null;
          pot_size: string | null;
          archived_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          plant_name: string;
          variety?: string | null;
          quantity: number;
          listing_quantity?: number | null;
          listing_id?: string | null;
          description?: string | null;
          images?: string[];
          notes?: string | null;
          category?: string | null;
          pot_size?: string | null;
          archived_at?: string | null;
          created_at?: string;
        };
        Update: {
          plant_name?: string;
          variety?: string | null;
          quantity?: number;
          listing_quantity?: number | null;
          listing_id?: string | null;
          description?: string | null;
          images?: string[];
          notes?: string | null;
          category?: string | null;
          pot_size?: string | null;
          archived_at?: string | null;
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
      wishlists: {
        Row: {
          id: string;
          user_id: string;
          listing_id: string | null;
          auction_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          listing_id?: string | null;
          auction_id?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      follows: {
        Row: {
          id: string;
          follower_id: string;
          seller_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          follower_id: string;
          seller_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string | null;
          listing_id: string | null;
          auction_id: string | null;
          reported_user_id: string | null;
          reason: string;
          details: string | null;
          status: string;
          admin_note: string | null;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          listing_id?: string | null;
          auction_id?: string | null;
          reported_user_id?: string | null;
          reason: string;
          details?: string | null;
          status?: string;
          admin_note?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: string;
          admin_note?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
        };
        Relationships: [];
      };

      plant_descriptions: {
        Row: {
          query: string;
          description: string;
          created_at: string;
        };
        Insert: {
          query: string;
          description: string;
          created_at?: string;
        };
        Update: {
          description?: string;
        };
        Relationships: [];
      };

      admin_audit_logs: {
        Row: {
          id: string;
          admin_id: string;
          action: string;
          target_type: string;
          target_id: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          action: string;
          target_type: string;
          target_id: string;
          notes?: string | null;
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
