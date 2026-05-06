export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type ListingStatus = "active" | "paused" | "sold_out";
export type AuctionStatus = "active" | "ended" | "cancelled" | "scheduled";
export type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "refunded";

export interface Database {
  public: {
    Tables: {

      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          bio: string | null;
          avatar_url: string | null;
          location: string | null;
          banner_url: string | null;
          seller_terms_accepted_at: string | null;
          stripe_account_id: string | null;
          stripe_onboarded: boolean;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          is_admin: boolean;
          plan: "seedling" | "grower" | "nursery";
          show_follower_count: boolean;
          shipping_days: number | null;
          vacation_mode: boolean;
          vacation_until: string | null;
          offers_enabled: boolean;
          saved_shipping_address: Json | null;
          announcement: string | null;
          email_marketing_opt_in: boolean;
          last_digest_sent: string | null;
          last_reengagement_sent: string | null;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          location?: string | null;
          banner_url?: string | null;
          stripe_account_id?: string | null;
          stripe_onboarded?: boolean;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          is_admin?: boolean;
          plan?: "seedling" | "grower" | "nursery";
          show_follower_count?: boolean;
          shipping_days?: number | null;
          vacation_mode?: boolean;
          vacation_until?: string | null;
          offers_enabled?: boolean;
          saved_shipping_address?: Json | null;
          announcement?: string | null;
          email_marketing_opt_in?: boolean;
          last_digest_sent?: string | null;
          last_reengagement_sent?: string | null;
          deleted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          location?: string | null;
          banner_url?: string | null;
          seller_terms_accepted_at?: string | null;
          stripe_account_id?: string | null;
          stripe_onboarded?: boolean;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          is_admin?: boolean;
          plan?: "seedling" | "grower" | "nursery";
          show_follower_count?: boolean;
          shipping_days?: number | null;
          vacation_mode?: boolean;
          vacation_until?: string | null;
          offers_enabled?: boolean;
          saved_shipping_address?: Json | null;
          announcement?: string | null;
          email_marketing_opt_in?: boolean;
          last_digest_sent?: string | null;
          last_reengagement_sent?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      offers: {
        Row: {
          id: string;
          listing_id: string;
          buyer_id: string;
          seller_id: string;
          amount_cents: number;
          message: string | null;
          status: "pending" | "accepted" | "declined" | "withdrawn";
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          buyer_id: string;
          seller_id: string;
          amount_cents: number;
          message?: string | null;
          status?: "pending" | "accepted" | "declined" | "withdrawn";
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          status?: "pending" | "accepted" | "declined" | "withdrawn";
        };
        Relationships: [];
      };

      restock_notifications: {
        Row: {
          id: string;
          listing_id: string;
          user_id: string | null;
          email: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          user_id?: string | null;
          email: string;
          created_at?: string;
        };
        Update: Record<string, never>;
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
          inventory_id: string | null;
          sale_price_cents: number | null;
          sale_ends_at: string | null;
          bundle_discount_pct: number | null;
          sold_out_behavior: "mark_sold_out" | "auto_pause";
          care_guide_pdf_url: string | null;
          scheduled_delete_at: string | null;
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
          inventory_id?: string | null;
          sale_price_cents?: number | null;
          sale_ends_at?: string | null;
          bundle_discount_pct?: number | null;
          sold_out_behavior?: "mark_sold_out" | "auto_pause";
          care_guide_pdf_url?: string | null;
          scheduled_delete_at?: string | null;
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
          inventory_id?: string | null;
          sale_price_cents?: number | null;
          sale_ends_at?: string | null;
          bundle_discount_pct?: number | null;
          sold_out_behavior?: "mark_sold_out" | "auto_pause";
          care_guide_pdf_url?: string | null;
          scheduled_delete_at?: string | null;
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
          inventory_id: string | null;
          bid_count: number;
          reminder_sent: boolean;
          reserve_price_cents: number | null;
          starts_at: string | null;
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
          inventory_id?: string | null;
          bid_count?: number;
          reminder_sent?: boolean;
          reserve_price_cents?: number | null;
          starts_at?: string | null;
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
          inventory_id?: string | null;
          bid_count?: number;
          reminder_sent?: boolean;
          reserve_price_cents?: number | null;
          starts_at?: string | null;
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
          delivered_at: string | null;
          cart_items: { listing_id: string; plant_name: string; variety: string | null; quantity: number; price_cents: number }[] | null;
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
          cart_items?: { listing_id: string; plant_name: string; variety: string | null; quantity: number; price_cents: number }[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          stripe_payment_intent_id?: string | null;
          status?: OrderStatus;
          tracking_number?: string | null;
          delivered_at?: string | null;
          cart_items?: { listing_id: string; plant_name: string; variety: string | null; quantity: number; price_cents: number }[] | null;
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
          low_stock_threshold: number | null;
          cost_cents: number | null;
          listing_quantity: number | null;
          listing_id: string | null;
          auction_id: string | null;
          auction_quantity: number | null;
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
          low_stock_threshold?: number | null;
          cost_cents?: number | null;
          listing_quantity?: number | null;
          listing_id?: string | null;
          auction_id?: string | null;
          auction_quantity?: number | null;
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
          low_stock_threshold?: number | null;
          cost_cents?: number | null;
          listing_quantity?: number | null;
          listing_id?: string | null;
          auction_id?: string | null;
          auction_quantity?: number | null;
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
          photos: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reviewer_id: string;
          seller_id: string;
          order_id: string;
          score: number;
          comment?: string | null;
          photos?: string[] | null;
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

      manual_sales: {
        Row: {
          id: string;
          seller_id: string;
          inventory_id: string | null;
          plant_name: string;
          variety: string | null;
          price_cents: number;
          quantity: number;
          note: string | null;
          sold_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          inventory_id?: string | null;
          plant_name: string;
          variety?: string | null;
          price_cents: number;
          quantity?: number;
          note?: string | null;
          sold_at?: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };

      word_violations: {
        Row: {
          id: string;
          user_id: string;
          word: string;
          context: string;
          content_snippet: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          word: string;
          context: string;
          content_snippet?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
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

      listing_templates: {
        Row: {
          id: string;
          seller_id: string;
          name: string;
          plant_name: string;
          variety: string | null;
          category: string | null;
          pot_size: string | null;
          description: string | null;
          price_cents: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          name: string;
          plant_name: string;
          variety?: string | null;
          category?: string | null;
          pot_size?: string | null;
          description?: string | null;
          price_cents?: number | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          plant_name?: string;
          variety?: string | null;
          category?: string | null;
          pot_size?: string | null;
          description?: string | null;
          price_cents?: number | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
