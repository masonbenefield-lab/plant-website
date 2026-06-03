export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type ListingStatus = "active" | "paused" | "sold_out";
export type AuctionStatus = "active" | "ended" | "cancelled" | "scheduled" | "expired";
export type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "refunded" | "expired" | "offered_down";
export type GardenPlantStatus = "thriving" | "growing" | "dormant" | "struggling" | "dead";
export type GardenEventType = "watered" | "fertilized" | "repotted" | "pruned" | "treated" | "harvested" | "note";

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
          default_payment_method_id: string | null;
          is_admin: boolean;
          plan: "seedling" | "grower" | "nursery";
          show_follower_count: boolean;
          garden_public: boolean;
          garden_bio: string | null;
          open_to_trades: boolean;
          trades_disclaimer_accepted: boolean;
          shipping_days: number | null;
          shipping_days_max: number | null;
          return_policy_type: string | null;
          return_policy_notes: string | null;
          vacation_mode: boolean;
          vacation_until: string | null;
          offers_enabled: boolean;
          saved_shipping_address: Json | null;
          announcement: string | null;
          announcement_expires_at: string | null;
          email_marketing_opt_in: boolean;
          last_digest_sent: string | null;
          last_reengagement_sent: string | null;
          groundbreaker: boolean;
          groundbreaker_number: number | null;
          ship_from_address: Json | null;
          shipping_services: string[] | null;
          calculated_shipping_enabled: boolean;
          auto_labels_enabled: boolean;
          deleted_at: string | null;
          feed_last_seen_at: string | null;
          referral_code: string | null;
          referred_by: string | null;
          total_referrals: number;
          country: string | null;
          wishlist_public: boolean;
          social_links: Json | null;
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
          default_payment_method_id?: string | null;
          is_admin?: boolean;
          plan?: "seedling" | "grower" | "nursery";
          show_follower_count?: boolean;
          garden_public?: boolean;
          garden_bio?: string | null;
          open_to_trades?: boolean;
          trades_disclaimer_accepted?: boolean;
          shipping_days?: number | null;
          shipping_days_max?: number | null;
          return_policy_type?: string | null;
          return_policy_notes?: string | null;
          vacation_mode?: boolean;
          vacation_until?: string | null;
          offers_enabled?: boolean;
          saved_shipping_address?: Json | null;
          announcement?: string | null;
          announcement_expires_at?: string | null;
          email_marketing_opt_in?: boolean;
          last_digest_sent?: string | null;
          last_reengagement_sent?: string | null;
          groundbreaker?: boolean;
          groundbreaker_number?: number | null;
          ship_from_address?: Json | null;
          shipping_services?: string[] | null;
          calculated_shipping_enabled?: boolean;
          auto_labels_enabled?: boolean;
          deleted_at?: string | null;
          feed_last_seen_at?: string | null;
          referral_code?: string | null;
          referred_by?: string | null;
          total_referrals?: number;
          country?: string | null;
          wishlist_public?: boolean;
          social_links?: Json | null;
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
          default_payment_method_id?: string | null;
          is_admin?: boolean;
          plan?: "seedling" | "grower" | "nursery";
          show_follower_count?: boolean;
          garden_public?: boolean;
          garden_bio?: string | null;
          open_to_trades?: boolean;
          trades_disclaimer_accepted?: boolean;
          shipping_days?: number | null;
          shipping_days_max?: number | null;
          return_policy_type?: string | null;
          return_policy_notes?: string | null;
          vacation_mode?: boolean;
          vacation_until?: string | null;
          offers_enabled?: boolean;
          saved_shipping_address?: Json | null;
          announcement?: string | null;
          announcement_expires_at?: string | null;
          email_marketing_opt_in?: boolean;
          last_digest_sent?: string | null;
          last_reengagement_sent?: string | null;
          ship_from_address?: Json | null;
          shipping_services?: string[] | null;
          calculated_shipping_enabled?: boolean;
          auto_labels_enabled?: boolean;
          groundbreaker?: boolean;
          groundbreaker_number?: number | null;
          deleted_at?: string | null;
          feed_last_seen_at?: string | null;
          referral_code?: string | null;
          referred_by?: string | null;
          total_referrals?: number;
          country?: string | null;
          wishlist_public?: boolean;
          social_links?: Json | null;
        };
        Relationships: [];
      };

      shipping_adjustments: {
        Row: {
          id: string;
          order_id: string | null;
          seller_id: string | null;
          shippo_transaction_id: string | null;
          original_weight_oz: number | null;
          billed_weight_oz: number | null;
          adjustment_cents: number;
          shippo_event_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string | null;
          seller_id?: string | null;
          shippo_transaction_id?: string | null;
          original_weight_oz?: number | null;
          billed_weight_oz?: number | null;
          adjustment_cents: number;
          shippo_event_id?: string | null;
          created_at?: string;
        };
        Update: {
          order_id?: string | null;
          seller_id?: string | null;
          shippo_transaction_id?: string | null;
          original_weight_oz?: number | null;
          billed_weight_oz?: number | null;
          adjustment_cents?: number;
          shippo_event_id?: string | null;
        };
        Relationships: [];
      };

      auction_shipping_selections: {
        Row: {
          id: string;
          auction_id: string;
          bidder_id: string;
          rate_id: string | null;
          service: string | null;
          carrier: string | null;
          cost_cents: number;
          estimated_days: number | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auction_id: string;
          bidder_id: string;
          rate_id?: string | null;
          service?: string | null;
          carrier?: string | null;
          cost_cents: number;
          estimated_days?: number | null;
          updated_at?: string;
        };
        Update: {
          rate_id?: string | null;
          service?: string | null;
          carrier?: string | null;
          cost_cents?: number;
          estimated_days?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      order_disputes: {
        Row: {
          id: string;
          order_id: string;
          buyer_id: string;
          seller_id: string;
          reason: string;
          details: string | null;
          seller_response: string | null;
          status: string;
          created_at: string;
          responded_at: string | null;
          escalated_at: string | null;
          resolved_at: string | null;
          last_replied_at: string | null;
          last_replied_by_role: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          buyer_id: string;
          seller_id: string;
          reason: string;
          details?: string | null;
          seller_response?: string | null;
          status?: string;
          created_at?: string;
          responded_at?: string | null;
          escalated_at?: string | null;
          resolved_at?: string | null;
          last_replied_at?: string | null;
          last_replied_by_role?: string | null;
        };
        Update: {
          seller_response?: string | null;
          status?: string;
          responded_at?: string | null;
          escalated_at?: string | null;
          resolved_at?: string | null;
          last_replied_at?: string | null;
          last_replied_by_role?: string | null;
        };
        Relationships: [];
      };
      order_dispute_messages: {
        Row: {
          id: string;
          dispute_id: string;
          sender_id: string;
          message: string;
          images: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          dispute_id: string;
          sender_id: string;
          message: string;
          images?: string[];
          created_at?: string;
        };
        Update: {
          message?: string;
          images?: string[];
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
          last_activated_at: string | null;
          shipping_weight_oz: number | null;
          shipping_cost_cents: number | null;
          free_shipping: boolean;
          item_type: string | null;
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
          last_activated_at?: string | null;
          shipping_weight_oz?: number | null;
          shipping_cost_cents?: number | null;
          free_shipping?: boolean;
          item_type?: string | null;
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
          last_activated_at?: string | null;
          shipping_weight_oz?: number | null;
          shipping_cost_cents?: number | null;
          free_shipping?: boolean;
          item_type?: string | null;
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
          shipping_weight_oz: number | null;
          shipping_cost_cents: number | null;
          free_shipping: boolean;
          reserve_offer_sent_at: string | null;
          reserve_offer_expires_at: string | null;
          reserve_offer_status: string | null;
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
          shipping_weight_oz?: number | null;
          shipping_cost_cents?: number | null;
          free_shipping?: boolean;
          reserve_offer_sent_at?: string | null;
          reserve_offer_expires_at?: string | null;
          reserve_offer_status?: string | null;
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
          shipping_weight_oz?: number | null;
          shipping_cost_cents?: number | null;
          free_shipping?: boolean;
          reserve_offer_sent_at?: string | null;
          reserve_offer_expires_at?: string | null;
          reserve_offer_status?: string | null;
        };
        Relationships: [];
      };
      bids: {
        Row: {
          id: string;
          auction_id: string;
          bidder_id: string;
          amount_cents: number;
          max_bid_cents: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          auction_id: string;
          bidder_id: string;
          amount_cents: number;
          max_bid_cents?: number | null;
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
          shipping_cost_cents: number | null;
          shipping_service: string | null;
          shippo_rate_id: string | null;
          shippo_transaction_id: string | null;
          label_url: string | null;
          platform_fee_cents: number | null;
          tax_cents: number;
          payment_deadline_at: string | null;
          payment_reminder_sent: boolean;
          item_snapshot: { plant_name: string; variety: string | null; image: string | null } | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          buyer_id: string;
          seller_id: string;
          listing_id?: string | null;
          auction_id?: string | null;
          stripe_payment_intent_id?: string | null;
          shipping_address?: {
            name: string;
            line1: string;
            line2?: string | null;
            city: string;
            state: string;
            zip: string;
            country: string;
          } | null;
          status?: OrderStatus;
          amount_cents: number;
          cart_items?: { listing_id: string; plant_name: string; variety: string | null; quantity: number; price_cents: number }[] | null;
          shipping_cost_cents?: number | null;
          shipping_service?: string | null;
          shippo_rate_id?: string | null;
          platform_fee_cents?: number | null;
          tax_cents?: number;
          payment_deadline_at?: string | null;
          payment_reminder_sent?: boolean;
          item_snapshot?: { plant_name: string; variety: string | null; image: string | null } | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          stripe_payment_intent_id?: string | null;
          status?: OrderStatus;
          tracking_number?: string | null;
          delivered_at?: string | null;
          shipping_address?: {
            name: string;
            line1: string;
            line2?: string | null;
            city: string;
            state: string;
            zip: string;
            country: string;
          };
          amount_cents?: number;
          cart_items?: { listing_id: string; plant_name: string; variety: string | null; quantity: number; price_cents: number }[] | null;
          shipping_cost_cents?: number | null;
          shipping_service?: string | null;
          shippo_rate_id?: string | null;
          shippo_transaction_id?: string | null;
          label_url?: string | null;
          platform_fee_cents?: number | null;
          tax_cents?: number;
          payment_deadline_at?: string | null;
          payment_reminder_sent?: boolean;
          item_snapshot?: { plant_name: string; variety: string | null; image: string | null } | null;
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
          shipping_weight_oz: number | null;
          shipping_cost_cents: number | null;
          free_shipping: boolean;
          item_type: string | null;
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
          shipping_weight_oz?: number | null;
          shipping_cost_cents?: number | null;
          free_shipping?: boolean;
          item_type?: string | null;
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
          shipping_weight_oz?: number | null;
          shipping_cost_cents?: number | null;
          free_shipping?: boolean;
          item_type?: string | null;
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
      referral_activations: {
        Row: {
          id: string;
          referrer_id: string;
          referred_id: string;
          activated_at: string;
        };
        Insert: {
          id?: string;
          referrer_id: string;
          referred_id: string;
          activated_at?: string;
        };
        Update: {
          id?: string;
          referrer_id?: string;
          referred_id?: string;
          activated_at?: string;
        };
        Relationships: [];
      };

      giveaway_months: {
        Row: {
          month: string;
          plant_name: string;
          description: string | null;
          image_url: string | null;
          winner_user_id: string | null;
          sponsor_name: string | null;
          sponsor_username: string | null;
          sponsor_logo_url: string | null;
          sponsor_message: string | null;
          created_at: string;
        };
        Insert: {
          month: string;
          plant_name: string;
          description?: string | null;
          image_url?: string | null;
          winner_user_id?: string | null;
          sponsor_name?: string | null;
          sponsor_username?: string | null;
          sponsor_logo_url?: string | null;
          sponsor_message?: string | null;
          created_at?: string;
        };
        Update: {
          month?: string;
          plant_name?: string;
          description?: string | null;
          image_url?: string | null;
          winner_user_id?: string | null;
          sponsor_name?: string | null;
          sponsor_username?: string | null;
          sponsor_logo_url?: string | null;
          sponsor_message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      giveaway_sponsor_requests: {
        Row: {
          id: string;
          user_id: string;
          item_name: string;
          message: string | null;
          status: "open" | "closed";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          item_name: string;
          message?: string | null;
          status?: "open" | "closed";
          created_at?: string;
        };
        Update: {
          status?: "open" | "closed";
        };
        Relationships: [];
      };

      giveaway_entries: {
        Row: {
          id: string;
          user_id: string;
          month: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month: string;
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
      blocks: {
        Row: {
          id: string;
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          blocker_id: string;
          blocked_id: string;
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
          community_post_id: string | null;
          community_reply_id: string | null;
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
          community_post_id?: string | null;
          community_reply_id?: string | null;
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

      conversations: {
        Row: {
          id: string;
          participant_a: string;
          participant_b: string;
          last_message_at: string | null;
          last_message_preview: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          participant_a: string;
          participant_b: string;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          created_at?: string;
        };
        Update: {
          last_message_at?: string | null;
          last_message_preview?: string | null;
        };
        Relationships: [];
      };

      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          read_at?: string | null;
        };
        Relationships: [];
      };

      garden_plants: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          variety: string | null;
          status: GardenPlantStatus;
          location: string | null;
          planted_at: string | null;
          source_name: string | null;
          source_type: "nursery" | "purchase" | "trade" | "propagation" | "gift" | null;
          source_listing_id: string | null;
          notes: string | null;
          public_notes: string | null;
          images: string[];
          water_interval_days: number | null;
          fertilize_interval_days: number | null;
          repot_interval_days: number | null;
          prune_interval_days: number | null;
          is_public: boolean;
          pin_order: number | null;
          shared_at: string | null;
          from_user_id: string | null;
          origin_verified: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          variety?: string | null;
          status?: GardenPlantStatus;
          location?: string | null;
          planted_at?: string | null;
          source_name?: string | null;
          source_type?: "nursery" | "purchase" | "trade" | "propagation" | "gift" | null;
          source_listing_id?: string | null;
          notes?: string | null;
          public_notes?: string | null;
          images?: string[];
          water_interval_days?: number | null;
          fertilize_interval_days?: number | null;
          repot_interval_days?: number | null;
          prune_interval_days?: number | null;
          is_public?: boolean;
          pin_order?: number | null;
          shared_at?: string | null;
          from_user_id?: string | null;
          origin_verified?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          variety?: string | null;
          status?: GardenPlantStatus;
          location?: string | null;
          planted_at?: string | null;
          source_name?: string | null;
          source_type?: "nursery" | "purchase" | "trade" | "propagation" | "gift" | null;
          source_listing_id?: string | null;
          notes?: string | null;
          public_notes?: string | null;
          images?: string[];
          water_interval_days?: number | null;
          fertilize_interval_days?: number | null;
          repot_interval_days?: number | null;
          prune_interval_days?: number | null;
          is_public?: boolean;
          pin_order?: number | null;
          shared_at?: string | null;
          from_user_id?: string | null;
          origin_verified?: boolean;
        };
        Relationships: [];
      };

      plant_origin_requests: {
        Row: {
          id: string;
          plant_id: string;
          requester_id: string;
          verifier_user_id: string;
          plant_name: string;
          requester_username: string;
          status: "pending" | "confirmed" | "denied";
          created_at: string;
        };
        Insert: {
          id?: string;
          plant_id: string;
          requester_id: string;
          verifier_user_id: string;
          plant_name: string;
          requester_username: string;
          status?: "pending" | "confirmed" | "denied";
          created_at?: string;
        };
        Update: {
          status?: "pending" | "confirmed" | "denied";
        };
        Relationships: [];
      };

      wishlist_items: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          variety: string | null;
          notes: string | null;
          priority: "nice" | "want" | "must";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          variety?: string | null;
          notes?: string | null;
          priority?: "nice" | "want" | "must";
          created_at?: string;
        };
        Update: {
          name?: string;
          variety?: string | null;
          notes?: string | null;
          priority?: "nice" | "want" | "must";
        };
        Relationships: [];
      };

      garden_events: {
        Row: {
          id: string;
          plant_id: string;
          user_id: string;
          event_type: GardenEventType;
          event_date: string;
          notes: string | null;
          photos: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          plant_id: string;
          user_id: string;
          event_type: GardenEventType;
          event_date: string;
          notes?: string | null;
          photos?: string[];
          created_at?: string;
        };
        Update: {
          event_type?: GardenEventType;
          event_date?: string;
          notes?: string | null;
          photos?: string[];
        };
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

      announcements: {
        Row: {
          id: string;
          seller_id: string;
          body: string;
          photos: string[];
          listing_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          body: string;
          photos?: string[];
          listing_id?: string | null;
          created_at?: string;
        };
        Update: {
          body?: string;
          photos?: string[];
          listing_id?: string | null;
        };
        Relationships: [];
      };

      listing_comments: {
        Row: {
          id: string;
          listing_id: string;
          user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          user_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          body?: string;
        };
        Relationships: [];
      };

      community_posts: {
        Row: {
          id: string;
          user_id: string;
          post_type: "help" | "show_and_tell" | "discussion";
          title: string;
          body: string | null;
          photos: string[];
          solved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          post_type: "help" | "show_and_tell" | "discussion";
          title: string;
          body?: string | null;
          photos?: string[];
          solved?: boolean;
          created_at?: string;
        };
        Update: {
          title?: string;
          body?: string | null;
          photos?: string[];
          solved?: boolean;
        };
        Relationships: [];
      };

      community_replies: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          body: string;
          photos: string[];
          is_solution: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          body: string;
          photos?: string[];
          is_solution?: boolean;
          created_at?: string;
        };
        Update: {
          body?: string;
          photos?: string[];
          is_solution?: boolean;
        };
        Relationships: [];
      };

      community_post_follows: {
        Row: {
          id: string;
          user_id: string;
          post_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          post_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          post_id?: string;
        };
        Relationships: [];
      };

    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
