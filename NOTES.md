# PlantMarket — Project Log

---

## 2026-04-23 — Initial build + deployment setup

### Features built
- Full Next.js 16.2.4 project scaffolded with shadcn/ui, Tailwind, Supabase SSR, Stripe SDK
- Supabase migration: `profiles`, `listings`, `auctions`, `bids`, `orders`, `ratings` tables with RLS policies
- Auth: sign up, login, magic link, session middleware via `src/proxy.ts`
- Profile page (`/account`): bio, username, avatar upload, Stripe Connect onboarding
- Public seller storefront (`/sellers/[username]`): bio, listings, ratings, average score
- Fixed-price listings: CRUD dashboard at `/dashboard/listings`, browse at `/shop`, detail at `/shop/[id]`
- Stripe Connect: seller onboarding (`/api/stripe/connect/onboard`), checkout (`/api/stripe/checkout`), webhook (`/api/stripe/webhook`)
- Orders dashboard (`/dashboard/orders`): seller view with shipping address, order status select
- Buyer order history (`/orders`) with rate-seller form (post-delivery only)
- Auctions: dashboard CRUD, browse at `/auctions`, detail at `/auctions/[id]` with Supabase Realtime live bidding
- Vercel cron job (`vercel.json`) to auto-close expired auctions — set to daily (`0 0 * * *`) for Hobby plan
- Landing page with hero, trust bar, features, how-it-works, testimonials, CTA, footer
- Navbar with mobile hamburger menu

### Bug fixes
- `middleware` → `proxy.ts` (Next.js 16 breaking change)
- Supabase `Database` type needed `Views` and `Functions` fields to avoid `never` type cascade
- Stripe lazy init (`getStripe()`) to avoid build-time crash without env vars
- Profile creation moved to DB trigger (RLS blocks client-side insert before email confirmation)
- Email rate limit: disabled email confirmation in Supabase Auth settings
- Profiles FK error on listings: manually backfilled profiles via SQL for users created before trigger

### SQL run in Supabase
```sql
-- Initial schema
-- See supabase/migrations/001_initial_schema.sql

-- Profile auto-create trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, new.raw_user_meta_data->>'username');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Backfill profiles for existing users
INSERT INTO profiles (id, username)
SELECT id, raw_user_meta_data->>'username'
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles);
```

### Environment variables (`.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `STRIPE_SECRET_KEY` *(not yet configured)*
- `STRIPE_WEBHOOK_SECRET` *(not yet configured)*
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` *(not yet configured)*
- `STRIPE_PLATFORM_FEE_PERCENT` *(optional, defaults to 5)*

---

## 2026-04-23 — Inventory system

### Features built
- Unified inventory creation page (`/dashboard/create`): shared form with three options — List in Shop, Create Auction, Save to Inventory
- Drag-and-drop photo upload on create page with hover-to-remove thumbnails
- `inventory` table: draft items not yet listed
- Inventory dashboard (`/dashboard/inventory`):
  - Active tab: all drafts, shop listings, and auctions in one table
  - Archived tab: soft-deleted drafts with 7-day countdown and Restore button
  - Delete action for drafts (archives) and cancelled auctions (hard delete)
  - **List in Shop** and **Create Auction** action buttons on draft items — open modals with price/bid fields
  - Download Excel (xlsx) and Download PDF (browser print) export
- `+ Add Inventory` button on dashboard homepage

### SQL run in Supabase
```sql
-- Inventory table
CREATE TABLE inventory (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plant_name text NOT NULL,
  variety text,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  description text,
  images text[] NOT NULL DEFAULT '{}',
  notes text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers can view their own inventory" ON inventory FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "Sellers can insert their own inventory" ON inventory FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Sellers can update their own inventory" ON inventory FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Sellers can delete their own inventory" ON inventory FOR DELETE USING (auth.uid() = seller_id);

-- Allow deleting cancelled auctions
DROP POLICY "Sellers can delete their own active auctions" ON auctions;
CREATE POLICY "Sellers can delete their own auctions"
  ON auctions FOR DELETE USING (auth.uid() = seller_id AND status IN ('active', 'cancelled'));
```

---

## 2026-04-23 — Dashboard improvements

### Features built
- Dashboard rebuilt with:
  - Onboarding checklist (profile complete, first listing, Stripe connected) — hides when all done
  - 4th stat card: Total Revenue (sum of paid + shipped + delivered orders)
  - Orders to Ship card highlights blue when action needed
  - Recent orders panel: last 5 paid/unshipped orders with buyer, item, address, Manage button
  - Quick nav links with badges: order count on View Orders, orange "!" on Account if Stripe not connected
  - Welcome message with username

---

## 2026-04-23 — Landing page redesign

### Features built
- Split hero: text left + 2×2 live listing cards right (fetched from DB, fallback placeholders if <2 listings)
- Trust bar: stats row (plants listed, sellers, rating, free to start)
- "Who it's for" cards with emoji icons and hover effects
- Features grid with icon tiles and hover border
- "Sell in 3 steps" with connecting line between circles on desktop
- Testimonials section: 3 seller quotes with star ratings
- Bottom CTA with gradient and two buttons
- Footer with nav links
- Navbar: mobile hamburger menu with full nav + auth links, closes on navigate/sign out
- Font changed from Geist to Inter

### Bug fixes
- Browse Plants button invisible (white text on white) — fixed to semi-transparent white fill
- TypeScript build errors on hero card key and image type — fixed with `l.name` key and `as string` cast

---

## 2026-04-23 — Listings photo improvements

### Features built
- Photo thumbnail (64×64) on each listing card in `/dashboard/listings` — shows first image or 🌿 placeholder
- Photo count in listing subtitle
- "Add Photo" action in listings Actions dropdown — uploads to Supabase storage and appends to listing images
- Upload errors now surfaced as toast instead of silently failing on create page

### Storage setup required in Supabase
```sql
CREATE POLICY "Authenticated users can upload listing images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listings');

CREATE POLICY "Anyone can view listing images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'listings');
```
Storage buckets needed: `avatars`, `listings`, `auctions` (all public)
