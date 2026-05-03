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

---

## 2026-04-24 — Whole-site feature pass (8 improvements)

### Features built
- **Navigation audit** (`src/components/layout/navbar.tsx`): Added Search/Wishlist/My Orders/Feed icon links visible on desktop when logged in. Added Search link to main desktop nav (visible to all). Added Feed to the user dropdown.
- **Wishlist auction countdowns** (`src/components/wishlist-auction-card.tsx`, `src/app/wishlist/page.tsx`): New `WishlistAuctionCard` client component with live 1-second countdown timer for auction cards on the wishlist page.
- **Tracking number field** (`src/app/dashboard/orders/tracking-input.tsx`, `src/app/dashboard/orders/page.tsx`, `src/app/orders/page.tsx`): Sellers can enter/save a tracking number per order. Buyers see it on their orders page.
- **Post-purchase confirmation screen** (`src/app/orders/confirmed/page.tsx`): New page shown after payment success with order summary, item thumbnail, shipping address, and seller link. Checkout form now routes to `/orders/confirmed?id=…` instead of `/dashboard/orders`.
- **Unified search** (`src/app/search/page.tsx`, `src/app/search/search-input.tsx`): Searches both `listings` and `auctions` tables simultaneously. Results split into Shop / Auctions tabs. Accessible at `/search`.
- **Followed seller feed** (`src/app/feed/page.tsx`): Shows recent listings and auctions from sellers the user follows, merged and sorted by date. Empty state if not following anyone.
- **Pause all listings** (`src/app/dashboard/listings/pause-all-button.tsx`, `src/app/dashboard/listings/page.tsx`): One-click button to pause all active listings. Appears next to "New Listing" in the listings dashboard header.
- **Order image & seller link** (`src/app/orders/page.tsx`): Buyer order cards now show a 64×64 thumbnail linking to the item, and the seller name links to their storefront.

### SQL migration required
```sql
ALTER TABLE orders ADD COLUMN tracking_number text;
```

### Type changes
- `src/lib/supabase/types.ts`: Added `tracking_number: string | null` to `orders` Row and `tracking_number?: string | null` to `orders` Update.

---

## 2026-04-26 — Inventory section audit improvements (8 items)

### Features built
- **Bug fix: images now copied** when using "List in Shop" or "Create Auction" from inventory — `submitListing` and `submitAuction` now pass `images: modal.row.images` and `category: modal.row.category` to their respective inserts.
- **Category column** — new `category` field on all inventory rows (drafts, listings, auctions). Displays in table (hidden on narrow screens) and mobile cards. Inline editable for inventory drafts and shop listings by clicking the cell value; auctions are display-only.
- **Category filter** — dropdown added to filter bar; only appears when categories exist in the current tab.
- **Bulk select + actions** — checkbox column in desktop table, checkbox on mobile cards. Bulk action bar appears when any rows are selected with context-aware actions: "Archive selected" (inventory drafts), "Pause listings" (active shop listings). Select-all checkbox in table header. Selected rows highlighted.
- **Sort by quantity and date** — In Stock and Added (created_at) columns are now sortable in addition to existing Plant/Variety columns.
- **Notes preview icon** — rows with private notes show a `FileText` icon next to the plant name; hovering shows the note text via native tooltip.
- **Hidden stock warning** — orange `⚠ N hidden` badge appears in the Listed Qty cell when In Stock > Listed Qty (inventory drafts with a linked listing) or when physical stock > listed quantity (shop listings with in_stock set).
- **Photo editing in Edit modal** — Edit Item modal now shows a grid of current photos with hover-to-remove X buttons, plus an "Add Photo" button that uploads directly to Supabase storage (`listings` bucket, `inventory/` prefix).
- **Category in Edit modal** — category dropdown added to Edit Item modal.
- **Category passed through clone** — cloneItem now copies category to the new draft.
- **Export updated** — Excel and PDF exports now include a Category column.

### SQL migration required
```sql
ALTER TABLE inventory ADD COLUMN category text;
```

### Type changes
- `src/lib/supabase/types.ts`: Added `category: string | null` to `inventory` Row, Insert, Update.

---

## 2026-04-27 — Critical & Major audit fixes

### Critical fixes
- **SEO metadata** — Added `generateMetadata` to `shop/[id]/page.tsx`, `auctions/[id]/page.tsx`, `sellers/[username]/page.tsx`. Each pulls plant name, variety, description, price/bid, and first image into `<title>`, `<meta description>`, and OpenGraph tags.
- **Sitemap & robots** — Created `src/app/sitemap.ts` (dynamic; includes all active listings, auctions, seller profiles) and `src/app/robots.ts` (blocks private routes, points to sitemap). Uses `NEXT_PUBLIC_SITE_URL` env var, falls back to `https://plantet.co`.
- **Image optimization** — Replaced raw `<img>` tags with Next.js `<Image>` in `app/page.tsx` (hero cards, `priority` prop), `app/orders/page.tsx` (order thumbnail), `app/feed/page.tsx` (seller avatar).
- **Error pages** — Created `src/app/error.tsx` (global error boundary with Try Again + Go Home) and `src/app/not-found.tsx` (global 404 page).
- **Auction checkout fix** — `app/checkout/page.tsx` previously required `status = 'ended'` for auction checkout; now also allows checkout if `ends_at <= now()` so winners can pay before the cron job runs.
- **Realtime connection fallback** — `auction-bid-panel.tsx`: added `connected` state wired to Supabase channel subscribe callback; shows amber warning banner on disconnect. Added `visibilitychange` listener that resyncs auction data from server when browser tab regains focus.

### Major fixes
- **Pagination** — Created `src/components/pagination.tsx` (reusable Prev/Next + count). Applied to `shop/page.tsx` (24/page), `auctions/page.tsx` (24/page), `search/page.tsx` (20/page). Filter changes reset page to 1.
- **Accessibility** — `image-gallery.tsx`: lightbox has `role="dialog"` + `aria-modal`, all buttons have `aria-label`, dot nav uses `role="tablist"`. `shop-filter-bar.tsx` and `auction-filter-bar.tsx`: all inputs and selects have associated `<label>` (sr-only), price range wrapped in `<fieldset>` + `<legend>`, chip remove buttons have descriptive `aria-label`.
- **Rate limiting** — Created `src/lib/rate-limit.ts` (in-memory sliding window, no new dependencies). Applied to `api/stripe/checkout/route.ts` (5 req/min per user) and `api/ratings/route.ts` (10 req/min per user).
- **Admin audit logging** — Created `supabase/migrations/002_admin_audit_logs.sql` (table + RLS: admins insert/read only). All three admin action files now insert a log row on every action: `listing-actions.tsx` (delete, pause, restore), `user-actions.tsx` (archive, restore), `report-actions.tsx` (dismiss, resolve, remove+resolve).

### SQL migration required
Run `supabase/migrations/002_admin_audit_logs.sql` in Supabase SQL editor (already done ✓).

### Environment variables
- `NEXT_PUBLIC_SITE_URL` — set to your production domain (e.g. `https://plantet.co`) for sitemap and robots.txt URLs.

---

## 2026-04-27 — Medium audit fixes (batch 2)

### Features built
- **Expanded search (#15)** — Shop, auctions, and unified search pages now match on `description` and `category` in addition to `plant_name` and `variety`. Changed all four `.or()` ilike filter strings in `shop/page.tsx`, `auctions/page.tsx`, and `search/page.tsx`.
- **Feed real-time banner (#16)** — Created `src/components/feed-updates.tsx`: client component that subscribes to Supabase Realtime INSERT events on `listings` and `auctions` filtered by followed seller IDs; shows a sticky "N new posts — click to refresh" button that calls `router.refresh()`. Rendered in `src/app/feed/page.tsx`.
- **Email notifications via Resend (#11)**:
  - Installed `resend` package.
  - Created `src/lib/email.ts` with `sendOrderConfirmation()` and `sendOutbidNotification()` helpers.
  - Updated `src/app/api/stripe/webhook/route.ts`: on `payment_intent.succeeded`, fetches order + buyer email via admin client, sends order confirmation email.
  - Created `src/app/api/bids/notify/route.ts`: accepts `{ auctionId, previousBidderId, newBidCents }`, looks up outbid user's email via admin client, sends outbid notification.
  - Updated `src/app/auctions/[id]/auction-bid-panel.tsx`: after a successful bid, fires `POST /api/bids/notify` with the previous bidder ID.
- **TypeScript fixes**: Added `admin_audit_logs` table to `src/lib/supabase/types.ts` (was missing, causing `never` type errors in admin action files). Fixed `src/app/sitemap.ts` to use `created_at` instead of `updated_at` (column doesn't exist).

### Environment variables
- `RESEND_API_KEY` — Resend API key for sending transactional emails. Get from resend.com.
- Email `from` address is `noreply@plantet.co` — requires domain verified in Resend dashboard.

---

## 2026-04-27 — Minor/UX polish pass

### Changes made
- **Confirmation dialogs** — Replaced native browser `confirm()` calls with proper modal dialogs:
  - `dashboard/listings/listing-actions.tsx`: "Delete listing?" Dialog with Cancel + Delete buttons and loading state
  - `dashboard/auctions/auction-actions.tsx`: "Cancel auction?" Dialog explaining bids will be voided
- **Auction image gallery** — `auctions/[id]/page.tsx`: replaced static image + thumbnail strip with `<ImageGallery>` (same lightbox component used on shop detail pages — supports click-to-expand, swipe, keyboard nav)
- **Password visibility toggle** — Added Eye/EyeOff toggle button to password fields in `login/page.tsx` and `signup/page.tsx`
- **Character counters** — Added live `{n}/max` counters to:
  - Bio textarea in `account/account-form.tsx` (500 char limit, rows bumped to 4)
  - Description textarea in `dashboard/listings/listing-actions.tsx` edit dialog (1000 char limit)
- **Mobile nav Search link** — `components/layout/navbar.tsx`: added "Search" between Auctions and Pricing in the mobile hamburger menu
- **Dashboard orders empty state** — `dashboard/orders/page.tsx`: replaced bare "No orders yet." with a card containing emoji, explanation, and links to View listings / Add a listing

---

## 2026-05-03 — Audit items #21–#30

### Features built
- **#21 Account deletion** — New API route `src/app/api/account/delete/route.ts` blocks deletion if seller has active auctions or unshipped orders; otherwise calls Supabase admin `deleteUser`. Added "Danger Zone" card to `account-form.tsx` with Dialog requiring user to type "DELETE" to confirm.
- **#22 Shipping days** — Added `shipping_days smallint` to profiles in `src/lib/supabase/types.ts`. Dropdown in account settings (1–14 days). Displayed as "🚚 Ships within N days" on listing detail (`shop/[id]/page.tsx`) and seller storefront (`sellers/[username]/page.tsx`).
- **#23 Vacation mode** — Added `vacation_mode boolean NOT NULL DEFAULT false` and `vacation_until date` to profiles in types. Toggle + optional return date in account settings. Yellow banner shown on seller storefront and listing detail when active.
- **#24 Image audit** — Converted all remaining raw `<img>` tags to Next.js `<Image>` in `dashboard/create/create-form.tsx`, `dashboard/inventory/inventory-client.tsx`, and `dashboard/listings/page.tsx`.
- **#26 Top Seller badge** — Shop and auctions browse pages now fetch ratings for visible sellers; sellers with 10+ reviews averaging ≥ 4.5★ get a "⭐ Top Seller" badge on their cards.
- **#27 bid_count** — Added `bid_count integer NOT NULL DEFAULT 0` to auctions type. Auction cards on browse and live-auction-card now show "X bids" vs "Starting bid" with color differentiation.
- **#28 Recently viewed** — `TrackView` and `RecentlyViewedStrip` components were already implemented (localStorage). Added "Clear" button to strip.
- **#29 Dashboard pagination** — All three dashboard pages (`dashboard/listings`, `dashboard/orders`, `dashboard/auctions`) now accept `?page=N` param, fetch 25 items/page with `.range()`, and render `<Pagination>`.
- **#30 Seller agreement modal** — Created `src/components/seller-agreement-dialog.tsx`. When a seller without accepted terms opens a listing/auction modal in `inventory-client.tsx`, shows the agreement in a Dialog instead of redirecting to the full page.

### SQL migrations required
Run in Supabase SQL editor:

```sql
-- #22 Shipping days
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shipping_days smallint;

-- #23 Vacation mode
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vacation_mode boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vacation_until date;

-- #27 bid_count with auto-increment trigger
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS bid_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_bid_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auctions SET bid_count = bid_count + 1 WHERE id = NEW.auction_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_bid_inserted
  AFTER INSERT ON bids
  FOR EACH ROW EXECUTE PROCEDURE increment_bid_count();

-- Backfill bid_count for existing auctions
UPDATE auctions a
SET bid_count = (SELECT COUNT(*) FROM bids b WHERE b.auction_id = a.id);
```
