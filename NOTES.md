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

---

## 2026-05-03 — Buyer features: Make an Offer, restock notifications, saved address, tracking links

### Features built
- **Make an Offer**: Buyers can submit custom-price offers on fixed-price listings (when seller allows it). Sellers review offers in new `/dashboard/offers` page; accepting locks the price and emails the buyer a checkout link. Declining emails the buyer. Offer checkout path validates offer server-side and uses `offer.amount_cents`.
- **Offers toggle**: Sellers can disable offers per account in Account Settings. Defaults on. Stored as `offers_enabled` on profiles.
- **Restock notifications**: Sold-out listings show a "Notify me when back" subscribe button. When seller activates a listing, emails are sent to all subscribers via `/api/listings/notify-restock` and rows are deleted.
- **Saved shipping address**: Checkout pre-fills from profile `saved_shipping_address` JSONB column. Saved fire-and-forget when "Save address" is checked.
- **Auction won email**: Winner emailed with checkout link when auction closes (via `sendAuctionWon`).
- **Tracking carrier links**: Orders page auto-detects carrier (UPS/FedEx/USPS) via regex and links tracking number to carrier's tracking page.
- **Admin Hidden category**: Inventory category picker shows "Hidden" only to admins. Hidden listings/auctions filtered from all public views using NULL-safe `.or("category.neq.Hidden,category.is.null")`.
- **Listing pause/resume fix**: Added "Activate All" button, inline Resume button on each paused card, `force-dynamic` on listings/inventory pages.

### New files
- `src/app/api/offers/route.ts` — POST: create offer
- `src/app/api/offers/[id]/route.ts` — PATCH: accept/decline/withdraw
- `src/app/api/restock-notify/route.ts` — POST: subscribe to restock
- `src/app/api/listings/notify-restock/route.ts` — POST: fire restock emails (called on listing activate)
- `src/app/api/profile/save-address/route.ts` — POST: save shipping address to profile
- `src/app/dashboard/offers/page.tsx` — Seller offers inbox
- `src/app/dashboard/offers/offer-actions.tsx` — Accept/Decline buttons
- `src/app/shop/[id]/offer-button.tsx` — Buyer offer dialog + pending/accepted state
- `src/app/shop/[id]/restock-notify-button.tsx` — Restock subscribe button

### SQL migrations required
```sql
-- Run these in Supabase SQL editor

-- Offers table
CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','withdrawn')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '3 days',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyers and sellers can view their offers" ON offers FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Buyers can create offers" ON offers FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- Restock notifications
CREATE TABLE IF NOT EXISTS restock_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(listing_id, email)
);
ALTER TABLE restock_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert restock notifications" ON restock_notifications FOR INSERT WITH CHECK (true);

-- Profile columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS offers_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS saved_shipping_address jsonb;
```

### Environment variables
- None new — uses existing `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`

---

## 2026-05-03 — Buyer features: wishlist alerts, auction reminders, autocomplete, review photos, gift checkout, multi-item cart, bundle discounts

### Features added

#### 1. Wishlist price drop alert
- `src/lib/email.ts` — added `sendPriceDropAlert()`
- `src/app/api/listings/sale/route.ts` — after setting sale price, queries wishlists and emails each wisher

#### 2. Auction end reminder (~1 hour before close)
- `src/lib/email.ts` — added `sendAuctionEndingSoon()`
- `src/app/api/auctions/close/route.ts` — pre-close block finds auctions ending within 60 min with `reminder_sent = false`, emails all bidders, marks `reminder_sent = true`

#### 3. Search autocomplete
- `src/app/api/search/autocomplete/route.ts` — GET endpoint returning up to 8 deduplicated plant name/variety suggestions
- `src/components/shop-filter-bar.tsx` — added controlled search state, suggestion dropdown with click-outside handling

#### 4. Review photos
- `src/lib/supabase/types.ts` — added `photos: string[] | null` to ratings
- `src/app/api/ratings/route.ts` — accepts `photos?: string[]` in body, includes in insert
- `src/app/orders/rate-seller-form.tsx` — rewrote with photo upload (up to 3), Supabase Storage at `reviews/{userId}/...`, thumbnails with remove
- `src/app/sellers/[username]/page.tsx` — renders clickable photo thumbnails from `rating.photos`

#### 5. Gift checkout
- `src/app/checkout/checkout-form.tsx` — added `isGift` checkbox, `giftMessage` textarea, recipient name label; passes `is_gift`/`gift_message` in shipping address
- `src/app/dashboard/orders/page.tsx` — shows pink "🎁 Gift" badge + gift message; handles `cart_items` for multi-item orders

#### 6. Multi-item cart (same-seller, localStorage-backed)
- `src/lib/cart.tsx` — NEW: `CartItem` interface, `CartProvider`, `useCart`, `effectivePrice()`; same-seller enforcement; localStorage key `plantet_cart`
- `src/components/cart-drawer.tsx` — NEW: `CartButton` (badge count), `CartDrawer` (backdrop + slide-in); shows per-item effective price + bundle deal badge
- `src/app/layout.tsx` — wrapped with `<CartProvider>`, added `<CartDrawer />`
- `src/components/layout/navbar.tsx` — added `<CartButton />`
- `src/app/shop/[id]/add-to-cart-button.tsx` — NEW: calls `addItem`, handles seller_conflict toast
- `src/app/shop/[id]/page.tsx` — added `<AddToCartButton>`, "X% off 2+" badge
- `src/app/api/stripe/cart-checkout/route.ts` — NEW: validates same seller, quantities, applies sale + bundle discounts, creates single PaymentIntent, inserts order with `cart_items`, decrements stock
- `src/app/checkout/cart/page.tsx` — NEW: two-step (address → payment), order summary sidebar, clears cart on success
- `src/app/orders/page.tsx` — handles cart orders (🛒 thumbnail, all cart_items listed)

#### 7. Bundle discounts
- `src/lib/supabase/types.ts` — added `bundle_discount_pct: number | null` to listings
- `src/app/dashboard/inventory/inventory-client.tsx` — bundle discount input in edit-listing modal; `submitEditListing` saves to DB (clamped 1–80)
- `src/app/dashboard/inventory/page.tsx` — added `bundle_discount_pct` to listings select and row mapping
- `src/app/shop/[id]/page.tsx` — passes `bundleDiscountPct` to `<AddToCartButton>`
- `src/app/api/stripe/cart-checkout/route.ts` — applies bundle discount server-side when qty ≥ 2

#### Bug fixes
- `src/app/api/offers/[id]/route.ts` — fixed `never` type from PostgREST join; fetches listing separately
- `src/app/dashboard/offers/page.tsx` — same fix; builds `listingMap` separately
- `src/app/dashboard/inventory/inventory-client.tsx` — "0 in shop" now shows amber edit button instead of hiding it; over-listing now shows error toast and reverts instead of silently clamping
- `src/app/api/listings/notify-restock/route.ts` — NEW: fires restock emails to subscribers when listing activates
- `src/app/dashboard/listings/listing-actions.tsx` — `toggleStatus` calls notify-restock fire-and-forget on activation

### SQL migrations to run in Supabase
```sql
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS photos text[];
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cart_items jsonb;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS bundle_discount_pct integer;
```

### Environment variables
- None new — uses existing `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`

---

## 2026-05-04 — Seller audit features (8 items)

### Features added

#### 1. Reserve price on auctions
- `src/lib/supabase/types.ts` — added `reserve_price_cents: number | null` to auctions
- `src/app/dashboard/inventory/inventory-client.tsx` — "Reserve Price" optional input in Create Auction modal
- `src/app/api/auctions/close/route.ts` — if `current_bid_cents < reserve_price_cents`, treat as no winner (release inventory)
- `src/app/auctions/[id]/page.tsx` — "Reserve not met" amber badge when auction ends below reserve

#### 2. Scheduled auction start
- `src/lib/supabase/types.ts` — added `AuctionStatus` "scheduled", `starts_at: string | null` to auctions
- `src/app/dashboard/inventory/inventory-client.tsx` — "Scheduled Start" optional datetime input; creates auction with `status: 'scheduled'` if starts_at is in future
- `src/app/api/auctions/close/route.ts` — cron now activates `scheduled` auctions whose `starts_at` has passed
- `src/app/auctions/[id]/page.tsx` — "Upcoming" badge + scheduled start info banner

#### 3. Bulk order status update
- `src/app/api/orders/bulk-status/route.ts` — NEW: POST endpoint validates seller ownership, bulk-updates status
- `src/app/dashboard/orders/bulk-order-actions.tsx` — NEW: `BulkOrderActions` (bar with status select + Apply), `OrderCheckbox`
- `src/app/dashboard/orders/orders-client.tsx` — NEW: client component with select-all checkbox + `BulkOrderActions`
- `src/app/dashboard/orders/page.tsx` — server component delegates rendering to `OrdersClient`

#### 4. Listing templates
- `src/lib/supabase/types.ts` — added `listing_templates` table
- `src/app/dashboard/inventory/inventory-client.tsx` — "Load template" chips + "Save as template" input in Edit Item modal; `saveAsTemplate()`, `deleteTemplate()` functions

#### 5. Low stock email alert
- `src/lib/email.ts` — added `sendLowStockAlert()`
- `src/app/api/stripe/checkout/route.ts` — after inventory decrement, emails seller when qty ≤ low_stock_threshold
- `src/app/api/stripe/cart-checkout/route.ts` — same check for cart orders

#### 6. Auto-pause when sold out
- `src/lib/supabase/types.ts` — added `sold_out_behavior: "mark_sold_out" | "auto_pause"` to listings
- `src/app/dashboard/inventory/inventory-client.tsx` — "When sold out" select in Edit Listing modal (Stay visible vs Auto-hide)
- `src/app/api/stripe/checkout/route.ts` — respects `sold_out_behavior` when setting listing status on sell-through
- `src/app/api/stripe/cart-checkout/route.ts` — same

#### 7. Storefront announcement banner
- `src/lib/supabase/types.ts` — added `announcement: string | null` to profiles
- `src/app/account/account-form.tsx` — "Storefront announcement" textarea + saves to profile
- `src/app/api/profile/update/route.ts` — accepts `announcement` field
- `src/app/sellers/[username]/page.tsx` — green banner shown when profile.announcement is set

#### 8. Plant care PDFs
- `src/lib/supabase/types.ts` — added `care_guide_pdf_url: string | null` to listings
- `src/app/dashboard/inventory/inventory-client.tsx` — PDF upload in Edit Listing modal (`uploadCareGuidePdf()`); view/remove link
- `src/app/orders/page.tsx` — "📄 Download care guide" link shown to buyer when listing has PDF

### SQL migrations to run in Supabase
```sql
-- Auctions
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS reserve_price_cents integer;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS starts_at timestamptz;
ALTER TYPE auction_status ADD VALUE IF NOT EXISTS 'scheduled';

-- Profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS announcement text;

-- Listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sold_out_behavior text NOT NULL DEFAULT 'mark_sold_out';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS care_guide_pdf_url text;

-- Listing templates
CREATE TABLE IF NOT EXISTS listing_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  plant_name text NOT NULL,
  variety text,
  category text,
  pot_size text,
  description text,
  price_cents integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE listing_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers manage own templates" ON listing_templates FOR ALL USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
```

### Environment variables
- None new

---

## 2026-05-04 — 30-day delivery lock + auto-delete for listings

### Features built
- **30-day lock after delivery**: Listing delete now blocked for 30 days after a delivered order. Returns `RECENT_DELIVERY` error code when blocked.
- **Auto-delete option**: When deletion is blocked by the lock, delete dialog switches to an "auto-delete" screen offering to pause the listing immediately and schedule it for deletion in 30 days.
- **`delivered_at` stamping**: Order status route now stamps `delivered_at = now()` when order is marked "delivered" via the order status dropdown.
- **Cron cleanup job**: `/api/cron/cleanup-listings` runs daily at 2am UTC, deletes all listings whose `scheduled_delete_at` has passed, clears inventory links first.
- **Seller agreement page**: Shows read-only document when visited without `?next=` param; checkbox/sign UI only appears during onboarding flow.

### Files changed
- `src/lib/supabase/types.ts` — added `scheduled_delete_at: string | null` to listings, `delivered_at: string | null` to orders
- `src/app/api/orders/update-status/route.ts` — new route: updates order status, stamps `delivered_at` when marking delivered
- `src/app/dashboard/orders/order-status-select.tsx` — calls new route instead of direct Supabase write
- `src/app/api/listings/delete/route.ts` — added 30-day lock check using `delivered_at`
- `src/app/api/listings/schedule-delete/route.ts` — new route: pauses listing + sets `scheduled_delete_at = now() + 30 days`
- `src/app/dashboard/listings/listing-actions.tsx` — delete dialog shows auto-delete screen on `RECENT_DELIVERY` error
- `src/app/api/cron/cleanup-listings/route.ts` — new cron route for daily cleanup of scheduled deletions
- `vercel.json` — added cron at `0 2 * * *` for cleanup-listings
- `.env.local.example` — added `CRON_SECRET` variable

### SQL migrations (already run by user)
```sql
ALTER TABLE listings ADD COLUMN IF NOT EXISTS scheduled_delete_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
```

### Environment variables
- `CRON_SECRET` — add a random secret string; set same value in Vercel env vars under the project settings

---

## 2026-05-05 — Bug fixes: photo sync, inventory unlink, listing delete

### Bugs fixed
- **Photo sync**: Adding a photo to a listing from My Listings now also updates the linked inventory item's images
- **Inventory unlink on purchase**: Inventory was incorrectly unlinking from the listing whenever `listing_quantity` hit 0, even if the listing still had stock. Now only unlinks when the listing fully sells out. Fixed in both checkout and cart-checkout routes.
- **Photo editing in inventory**: "Edit Listing" modal in inventory now includes a photo section (add/remove), synced to both listing and inventory on save
- **Listing delete constraint violation**: `order_has_source` constraint blocked deletion when delivered orders referenced the listing. Delete route now populates `cart_items` on those orders before deleting, preserving order history.

### SQL migrations run
```sql
-- Fix order_has_source constraint to also allow cart_items as a valid source
ALTER TABLE orders DROP CONSTRAINT order_has_source;
ALTER TABLE orders ADD CONSTRAINT order_has_source 
  CHECK (
    (listing_id IS NOT NULL) OR 
    (auction_id IS NOT NULL) OR 
    (cart_items IS NOT NULL)
  );
```

### Files changed
- `src/app/dashboard/listings/listing-actions.tsx` — sync inventory photos on upload
- `src/app/api/stripe/checkout/route.ts` — only unlink inventory when listing sells out
- `src/app/api/stripe/cart-checkout/route.ts` — same fix
- `src/app/dashboard/inventory/inventory-client.tsx` — photo section in Edit Listing modal
- `src/app/api/listings/delete/route.ts` — populate cart_items on remaining orders before deletion

---

## 2026-05-06 — Weekly digest, pricing audit fixes, Stripe subscriptions, last_activated_at

### Features built
- **Weekly digest** — Changed cron from monthly to weekly (Sundays 3pm UTC). Subject/copy updated from "Monthly" to "Weekly". Followed section now allows up to 4 listings per seller (was 1), up to 12 total.
- **Digest fallback pool** — If fewer than 6 fresh picks exist, fills remaining slots from any active Grower+ listings with no age restriction.
- **45-day re-engagement email** — New cron (`/api/cron/reengagement`, runs daily) emails opted-in users who haven't signed in in 45+ days with 6 featured listings. Respects per-user cooldown via `last_reengagement_sent`.
- **Pricing audit fixes** — Updated pricing page copy (monthly→weekly, per-seller digest limits, priority support wording). Added live DB count checks before listing/auction creation (server-side limit enforcement). Bulk status tool gated to Grower+ (50-item batch) and Nursery (200-item batch).
- **Priority search placement** — Shop and auctions pages post-sort by plan (Nursery first, Grower second) after each Supabase page fetch. No extra query needed — seller plan is fetched alongside listings.
- **Stripe subscription flow** — New `/api/stripe/subscribe` route creates Checkout Session for Grower/Nursery plans; existing subscribers redirected to billing portal. New `/api/stripe/billing-portal` route. `account-form.tsx` shows current plan badge + upgrade/manage buttons.
- **Stripe webhook handlers** — Added `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded` handlers.
- **Stripe Tax** — `automatic_tax: { enabled: true }` and `customer_update: { address: "auto" }` added to checkout session. Parked until TX LLC registered.
- **`last_activated_at` — digest restock/reactivation logic** — Listings track when they were last activated. Digest followed section now shows listings activated within the last 30 days (not just newly created). Activating a listing that has been inactive for 7+ days bumps `last_activated_at`. Restocking a sold-out listing (qty 0 → >0 in Edit Listing modal) auto-activates it and bumps `last_activated_at` if 7+ days since last activation. Quick pause/resume button in inventory also respects the 7-day rule.

### Files changed
- `vercel.json` — digest cron changed to `0 15 * * 0`; added reengagement cron `0 14 * * *`
- `src/app/api/cron/digest/route.ts` — weekly cadence, fallback pool, 4-per-seller followed cap, OR filter on `last_activated_at`
- `src/app/api/cron/reengagement/route.ts` — new file
- `src/lib/email.ts` — monthly→weekly copy, `sendReengagementEmail()`
- `src/lib/supabase/types.ts` — added `last_reengagement_sent`, `stripe_customer_id`, `stripe_subscription_id` to profiles; `last_activated_at` to listings; `"refunded"` to OrderStatus
- `src/app/pricing/page.tsx` — digest copy, support tier wording
- `src/app/dashboard/inventory/page.tsx` — fetches `last_activated_at` from listings, passes through row mapping
- `src/app/dashboard/inventory/inventory-client.tsx` — `last_activated_at` in Row type; restock auto-activate in `submitEditListing`; `last_activated_at` bump in `toggleListingPause`; live plan limit checks
- `src/app/api/listings/toggle-status/route.ts` — sets `last_activated_at` when activating if 7+ days inactive
- `src/app/api/orders/bulk-status/route.ts` — Seedling blocked; batch limit 50 (Grower) vs 200 (Nursery)
- `src/app/shop/page.tsx` — priority sort by plan after fetch
- `src/app/auctions/page.tsx` — priority sort by plan after fetch
- `src/app/api/stripe/subscribe/route.ts` — new file
- `src/app/api/stripe/billing-portal/route.ts` — new file
- `src/app/api/stripe/webhook/route.ts` — subscription + refund webhook handlers
- `src/app/account/account-form.tsx` — PlanBillingCard component

### SQL migrations required
Run in Supabase SQL editor:
```sql
-- Digest restock/reactivation tracking
ALTER TABLE listings ADD COLUMN IF NOT EXISTS last_activated_at timestamptz;

-- Stripe subscription fields on profiles (if not already present)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Re-engagement email tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_reengagement_sent timestamptz;
```

### Environment variables
- `STRIPE_GROWER_PRICE_ID` — Stripe price ID for Grower monthly plan (starts `price_`)
- `STRIPE_GROWER_ANNUAL_PRICE_ID` — Stripe price ID for Grower annual plan
- `STRIPE_NURSERY_PRICE_ID` — Stripe price ID for Nursery monthly plan
- `STRIPE_NURSERY_ANNUAL_PRICE_ID` — Stripe price ID for Nursery annual plan

---

## 2026-05-09 — Bug fixes (code trace) + pricing page improvements

### Critical bugs fixed
- `src/app/api/stripe/checkout/route.ts` — Moved listing stock decrement before PaymentIntent creation using `.gte("quantity", qty)` atomic conditional update; rolls back on PI or order failure
- `src/app/api/stripe/cart-checkout/route.ts` — Same atomic decrement pattern for cart orders with per-item rollback array; rolls back all decrements on any failure
- `src/app/api/stripe/webhook/route.ts` — Added `restoreListingStock` helper; `payment_intent.payment_failed` now restores listing + inventory quantities (from PI metadata for single listing, from `cart_items` for cart orders) before deleting the pending order

### Medium bugs fixed
- `src/app/api/stripe/checkout/route.ts` + `src/app/api/stripe/cart-checkout/route.ts` — Block seller from purchasing their own listing (returns 400)
- `src/app/api/ratings/route.ts` — Added server-side validation: score must be whole number 1–5, comment max 1000 chars, photos max 5
- `src/app/api/orders/update-tracking/route.ts` — Only sets `status: "shipped"` when a real tracking number is provided AND order is currently `"paid"`; returns `notified` flag to client
- `src/app/dashboard/orders/tracking-input.tsx` — Toast shows "buyer notified" only when API confirms email was sent
- `src/app/api/orders/update-status/route.ts` — Enforces forward-only status progression; blocks backward transitions
- `src/app/dashboard/orders/order-status-select.tsx` — Dropdown now only shows `shipped`/`delivered`, filtered to forward options; read-only label when fully delivered

### Minor bugs fixed
- `src/app/shop/[id]/buy-button.tsx` — Replaced manual loading state with `useTransition`; loading auto-resets on navigation success or failure
- `src/app/api/stripe/checkout/route.ts` — Sold-out listings now return "This item is sold out" (410) instead of generic "Listing not found" (404)
- `src/app/orders/confirmed/page.tsx` — Confirmation copy is now status-aware; shows "payment is being confirmed" if webhook hasn't fired yet
- `src/app/api/orders/update-status/route.ts` — Blocks `"delivered"` status if order has no tracking number

### Features / changes
- `src/lib/plan-limits.ts` — Nursery plan photo limit changed from unlimited (`null`) to 20
- `src/app/pricing/page.tsx` — Updated Nursery photo copy to "Up to 20 photos per listing"
- `src/app/account/account-form.tsx` — Updated Nursery plan description to reflect 20-photo cap
- `src/app/pricing/page.tsx` — Added three new interactive callout sections: Custom Storefront Banner (before/after comparison), Priority Search Placement (mock search grid with priority badges), Full Sales Analytics (plan breakdown + live dashboard mockup with bar chart, top performers, repeat buyer rate, top states). All three wired as clickable anchor links from the pricing feature list.

### SQL migrations required
- None

### Environment variables added or changed
- None

---

## 2026-05-09 (continued) — My Garden, Messaging, Care Reminders, Public Garden

### Features built

#### My Garden (personal plant tracker)
- `src/app/garden/page.tsx` — Garden overview grid with status filter chips (Thriving / Growing / Dormant / Struggling / Dead) and Public/Private visibility toggle
- `src/app/garden/new/page.tsx` — Add plant page
- `src/app/garden/[id]/page.tsx` — Plant detail: photo gallery, info sidebar (location, planted date, source, event count), care log
- `src/app/garden/[id]/edit/page.tsx` — Edit plant page
- `src/components/garden/garden-form.tsx` — Shared add/edit form: name, variety, status, location, planted date, source type + name, notes, photo upload (up to 10 via Supabase Storage `garden` bucket), care interval inputs (water/fertilize/repot/prune every X days)
- `src/components/garden/event-log.tsx` — Care log client component: log Watered / Fertilized / Repotted / Pruned / Treated / Harvested / Note events with date and optional notes; delete events inline
- `src/components/garden/delete-plant-button.tsx` — Confirmation dialog before deleting a plant and all its events
- `src/components/garden/garden-visibility-toggle.tsx` — Client toggle that calls `/api/garden/toggle-public`
- `src/app/api/garden/toggle-public/route.ts` — POST: updates `profiles.garden_public`
- `src/components/layout/navbar.tsx` — Added Sprout icon shortcut, "My Garden" in dropdown and mobile menu

#### Care Schedules + Reminders
- `garden_plants` table: added `water_interval_days`, `fertilize_interval_days`, `repot_interval_days`, `prune_interval_days` (all nullable integers)
- `src/app/feed/care-reminders.tsx` — "Today's care" card section shown at top of feed when plants are due or overdue based on last logged event + interval
- `src/app/feed/page.tsx` — Queries garden plants with intervals + last events; computes due/overdue items; renders CareReminders above feed
- `src/lib/email.ts` — `sendGardenCareReminder()`: styled HTML email with plant/care/due-date table
- `src/app/api/cron/garden-reminders/route.ts` — Monthly cron: for each opted-in user with care intervals set, calculates what's due this month and sends one summary email
- `vercel.json` — Added `"/api/cron/garden-reminders"` cron at `0 9 1 * *` (9 AM UTC on the 1st of each month)

#### Public Garden Profiles
- `profiles` table: added `garden_public boolean DEFAULT false`
- `src/app/gardens/[username]/page.tsx` — Read-only public garden view at `/gardens/[username]`; 404s if garden is private

#### User-to-User Messaging
- `src/app/api/messages/start/route.ts` — POST: creates or finds existing conversation between two users (normalizes participant order for UNIQUE constraint)
- `src/app/api/messages/send/route.ts` — POST: server-side word filter (logs violation + 400 on hit), inserts message, updates conversation last_message_at + preview via admin client
- `src/app/api/messages/read/route.ts` — POST: marks all unread messages in a conversation as read
- `src/app/messages/page.tsx` — Inbox: lists conversations with unread badge, other user avatar, last message preview, timestamp
- `src/app/messages/[id]/page.tsx` — Server wrapper: fetches conversation, other user profile, initial messages
- `src/app/messages/[id]/message-thread.tsx` — Client component: Supabase Realtime live updates, auto-scroll, Enter-to-send, client-side word filter check
- `src/components/message-button.tsx` — "Message" button on seller storefronts for logged-in non-owner users
- `src/app/sellers/[username]/page.tsx` — Added MessageButton alongside Follow/Report buttons
- `src/app/layout.tsx` — Fetches unread message count server-side on every page load
- `src/components/layout/navbar.tsx` — MessageSquare icon with unread count badge, "Messages" in dropdown and mobile menu

### SQL migrations required
```sql
-- garden_plants care intervals
ALTER TABLE garden_plants
  ADD COLUMN water_interval_days integer,
  ADD COLUMN fertilize_interval_days integer,
  ADD COLUMN repot_interval_days integer,
  ADD COLUMN prune_interval_days integer;

-- public garden toggle
ALTER TABLE profiles
  ADD COLUMN garden_public boolean NOT NULL DEFAULT false;

-- Conversations table
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_a, participant_b),
  CHECK (participant_a < participant_b)
);

-- Messages table
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) <= 2000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants_all" ON conversations FOR ALL
  USING (participant_a = auth.uid() OR participant_b = auth.uid());

CREATE POLICY "participants_select" ON messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM conversations c WHERE c.id = conversation_id
    AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
  ));

CREATE POLICY "sender_insert" ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations c WHERE c.id = conversation_id
      AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

CREATE POLICY "recipient_update" ON messages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM conversations c WHERE c.id = conversation_id
    AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
  ));

-- Garden plants table
CREATE TABLE garden_plants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  variety text,
  status text NOT NULL DEFAULT 'growing'
    CHECK (status IN ('thriving','growing','dormant','struggling','dead')),
  location text,
  planted_at date,
  source_name text,
  source_type text CHECK (source_type IN ('nursery','purchase','trade','propagation','gift')),
  source_listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  notes text,
  images text[] NOT NULL DEFAULT '{}',
  water_interval_days integer,
  fertilize_interval_days integer,
  repot_interval_days integer,
  prune_interval_days integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Garden events table
CREATE TABLE garden_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES garden_plants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN ('watered','fertilized','repotted','pruned','treated','harvested','note')),
  event_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE garden_plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON garden_plants FOR ALL USING (user_id = auth.uid());
CREATE POLICY "owner_all" ON garden_events FOR ALL USING (user_id = auth.uid());
```

### Supabase Storage
- Created `garden` bucket (public) for plant photos

### Supabase Realtime
- Enabled `messages` table in `supabase_realtime` publication (Database → Publications)

### Environment variables added or changed
- None

---

## 2026-05-10 — Full shipping system (Shippo integration)

### Features built
- **Shippo utility library** (`src/lib/shippo.ts`): `getShippingRates()` and `purchaseLabel()` using Shippo SDK v2.18.0
- **Shipping rate step at checkout**: new "shipping" step in `checkout-form.tsx` between address entry and payment — calls `/api/shipping/rates`, shows seller-enabled USPS services with live prices, buyer selects rate
- **Domestic-only enforcement**: `/api/shipping/rates` checks `seller.ship_from_address.country === buyer.country`; returns error if mismatched
- **Shipping cost in PaymentIntent**: `/api/stripe/checkout` now adds `shippingCostCents` to the PaymentIntent amount (fee only taken on item price, not shipping)
- **Buy Label button in orders dashboard**: `orders-client.tsx` shows "Buy Label" button for orders with `shippo_rate_id`; calls `/api/shipping/purchase-label`, auto-populates tracking number and shows "View label" link after purchase
- **Ship-from address + services in account settings**: new "Shipping Settings" card with full address form + USPS service checkboxes; saved to `profiles.ship_from_address` and `profiles.shipping_services` via `/api/profile/update-shipping`
- **Shipping weight on inventory**: `shipping_weight_oz` field added to create form (per-size) and edit modal in inventory dashboard

### SQL migrations required
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ship_from_address jsonb, ADD COLUMN IF NOT EXISTS shipping_services text[];
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS shipping_weight_oz integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost_cents integer, ADD COLUMN IF NOT EXISTS shipping_service text, ADD COLUMN IF NOT EXISTS shippo_rate_id text, ADD COLUMN IF NOT EXISTS shippo_transaction_id text, ADD COLUMN IF NOT EXISTS label_url text;

### Environment variables
- SHIPPO_API_KEY already in .env.local (test key). Add to Vercel env vars. Swap for live key when approved.

### Files created/modified
- src/lib/shippo.ts (new)
- src/lib/supabase/types.ts
- src/app/api/shipping/rates/route.ts (new)
- src/app/api/shipping/purchase-label/route.ts (new)
- src/app/api/profile/update-shipping/route.ts (new)
- src/app/api/stripe/checkout/route.ts
- src/app/checkout/checkout-form.tsx
- src/app/dashboard/orders/orders-client.tsx
- src/app/account/account-form.tsx
- src/app/dashboard/create/create-form.tsx
- src/app/dashboard/inventory/inventory-client.tsx

---

## 2026-05-11 — Garden feed sharing + following page

### Features built
- **Garden feed sharing**: Opt-in "Share to followers' feeds" checkbox on the Add to Garden form. Sets `shared_at` timestamp on insert. Followers see a "🌱 New in garden" card in their feed that links to the grower's public garden page.
- **Feed page**: Now queries `garden_plants` from followed user IDs where `shared_at IS NOT NULL` and `is_public = true`. Garden posts merged and sorted with listings/auctions in the unified feed.
- **FeedList**: Handles `kind: "garden"` cards — shows "🌱 New in garden" badge, "Added to their garden" text, links to `/gardens/[username]`. No price shown.
- **FeedUpdates**: Realtime listener now also subscribes to `garden_plants` INSERTs from followed users (only increments count if `shared_at` is set).
- **Following/Followers/Blocked page** (`/following`): Three-tab page with user cards (avatar, username, Message, Follow/Unfollow, block menu). Added to navbar (desktop icon row, dropdown, mobile menu).
- **Block function**: `/api/users/block` route blocks/unblocks users. Block removes follows in both directions. Message route (`/api/messages/start`) checks for blocks before creating conversations.
- **Shipping weight warning**: Amber "⚠ No weight set" alert in inventory. Clicking opens edit modal.
- **Free shipping option**: Checkbox in inventory edit modal. Shows green "🚚 Free shipping" badge. Checkout skips Shippo rate step and uses $0 shipping.
- **Weight guard on list/auction**: Sonner toast intercepts listing/auction button clicks when no weight or free shipping is set. Offers "Set weight first" or "Continue anyway".
- **Add to Garden from orders**: "🪴 Add to garden →" link on delivered orders, pre-fills garden form. Shows "(already in garden)" note if already added but link always works.

### SQL migrations required
```sql
-- Garden feed sharing
ALTER TABLE garden_plants ADD COLUMN IF NOT EXISTS shared_at timestamptz;

-- Free shipping on inventory
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS free_shipping boolean NOT NULL DEFAULT false;

-- Block table
CREATE TABLE IF NOT EXISTS blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own blocks" ON blocks
  USING (blocker_id = auth.uid())
  WITH CHECK (blocker_id = auth.uid());
```

### Files changed
- src/lib/supabase/types.ts (shared_at on garden_plants; blocks table; free_shipping on inventory)
- src/components/garden/garden-form.tsx (shareToFeed checkbox, shared_at in insert payload)
- src/app/feed/page.tsx (garden_plants query, FeedItem type includes "garden" kind)
- src/app/feed/feed-list.tsx (garden card UI, kind: "garden" support)
- src/components/feed-updates.tsx (realtime garden_plants listener)
- src/app/following/page.tsx (new — server component)
- src/app/following/following-client.tsx (new — three-tab UI with block/unblock)
- src/app/api/users/block/route.ts (new — block/unblock API)
- src/components/layout/navbar.tsx (Users icon + /following link)
- src/app/api/messages/start/route.ts (block check before creating conversation)
- src/app/dashboard/inventory/inventory-client.tsx (weight warning, free_shipping, guardListOrAuction)
- src/app/dashboard/inventory/page.tsx (shipping_weight_oz + free_shipping in row mappings)
- src/app/api/shipping/rates/route.ts (free_shipping early return)
- src/app/checkout/checkout-form.tsx (free shipping bypass)
- src/app/checkout/cart/page.tsx (free shipping bypass)
- src/app/orders/page.tsx (Add to Garden link, duplicate detection)
- src/app/garden/new/page.tsx (searchParams pre-fill)
- src/app/garden/[id]/edit/page.tsx (source_listing_id in select)

---

## 2026-05-19 — Garden & Inventory improvements

### Features built
- **Inventory bulk import review page** — `/dashboard/inventory/import` with per-item collapsible cards (pot size, qty, cost, photos). Replaced old single-dialog import. Paste list (comma/newline separated names) also added.
- **Garden bulk import paste list** — Added textarea input to `/garden/import` so users can paste comma/newline-separated plant names directly, bypassing CSV. Same review page flow.
- **Garden "Bulk Upload" button** — Renamed "Import CSV" to "Bulk Upload" on My Garden page.
- **Inline plant notes editing** — Public and private notes on `/garden/[id]` are now click-to-edit inline with Save/Cancel. No navigation to edit page required.
- **Plant photo management** — `/garden/[id]` now has inline photo upload/remove. Camera overlay on main image, X button on thumbnails, uploads immediately to Supabase storage.
- **Share garden link** — "Share garden" copy-link button added to garden visibility toggle. Shows "Link copied!" confirmation for 2 seconds.
- **Feed unread badge** — Green dot on Feed nav icon when there are new listings, auctions, garden shares, or announcements from followed sellers. Clears on visiting feed.
- **Reshare warning dialog** — Sharing a plant to feed within 24 hours of last share shows a confirmation dialog with how long ago it was last shared.

### Bug fixes
- Fixed Supabase storage RLS policies on `garden` bucket blocking all photo uploads (INSERT/UPDATE/DELETE policies added).

### SQL migrations required
- `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS feed_last_seen_at timestamptz;` ✅ (run)
- Supabase storage policies for `garden` bucket ✅ (run)

### Files changed
- src/app/dashboard/inventory/import/page.tsx (new)
- src/components/inventory/inventory-import-client.tsx (new + paste list)
- src/components/inventory/inventory-review-card.tsx (new)
- src/app/dashboard/inventory/inventory-client.tsx (Import button → Link, removed old dialog)
- src/components/garden/import-client.tsx (paste list added)
- src/app/garden/page.tsx (Bulk Upload button rename)
- src/components/garden/plant-notes-editor.tsx (new)
- src/app/garden/[id]/page.tsx (inline notes + photo manager + lastSharedAt prop)
- src/components/garden/plant-photo-manager.tsx (new)
- src/components/garden/garden-visibility-toggle.tsx (Share garden copy-link button)
- src/components/layout/navbar.tsx (feed unread dot badge)
- src/app/api/feed/unread-count/route.ts (new)
- src/app/api/feed/mark-seen/route.ts (new)
- src/app/feed/feed-mark-seen.tsx (new)
- src/app/feed/page.tsx (FeedMarkSeen on load)
- src/components/garden/share-plant-button.tsx (24-hour reshare warning dialog)
- src/lib/supabase/types.ts (feed_last_seen_at added to profiles)

---

## 2026-05-26 — Giveaway referral system, pricing audit, bulk listing tools, UX improvements

### Features built

#### Giveaway: Donation request management
- **Close button on donation requests** — Admin can close a request without replying. Calls `/api/admin/sponsor-request-close` (service role write).
- **"Submit another request" button** — After a user submits a donation request, the confirmation screen now has a button to reset and submit a new one.
- **Donation Requests tab** — Admin giveaway page reorganized into two tabs: "Monthly Sponsors" and "Donation Requests". Requests tab shows open/closed filter. Green badge on tab shows count of open requests.
- **Auto-delete closed requests** — New cron job (`/api/cron/cleanup-sponsor-requests`, daily at 3am UTC) deletes closed donation requests older than 30 days.

#### Giveaway: Referral system
- **Referral codes** — Each user gets a unique 8-char alphanumeric code generated on signup (or backfilled on first giveaway page visit for existing users). Stored as `referral_code` on profiles.
- **Referred_by tracking** — Signup page reads `?ref=` URL param. `claim-groundbreaker` route looks up the referrer and stores `referred_by` on the new user's profile.
- **Activation on first plant** — Referral only counts when the referred user adds their first plant to their garden. `garden-form.tsx` and `import-client.tsx` call `/api/garden/activate-referral` on first plant add. Idempotent via `UNIQUE(referred_id)` constraint.
- **`total_referrals` counter** — Profiles have a `total_referrals` integer column incremented on each successful activation. Useful for marketing analytics.
- **Referral card on giveaway page** — Logged-in users see their shareable referral link with a copy button. Shows "+N bonus entries this month" badge when they have active referrals.
- **Post-entry nudge** — After entering the giveaway, the enter button area shows a referral card with specific language: "Every friend who signs up and adds at least one plant to their Plantet garden earns you +1 extra entry."
- **Weighted winner picker** — Admin giveaway page has a "Draw Winner" button per month. Builds a weighted pool (1 base + referral activations per user), Fisher-Yates shuffle, picks 1 winner + 5 backups. Shows results with username, bonus entries, and total pool weight. "Confirm Winner" saves to DB.
- **Next month teaser** — Giveaway page shows the next month's plant in the Coming Soon section, including sponsor name, if one has been set in admin.
- **Bonus entries count** — Giveaway page fetches `referral_activations` for the current month per user and passes to ReferralCard and EnterButton.

#### Pricing audit
- **Unlimited listings for all plans** — Removed listing limits from all three plans (Seedling, Grower, Nursery). All plans now show "Unlimited listings." Pricing page FAQ updated accordingly.
- **Photo limits enforced in UI** — Inventory edit modal now blocks adding photos past the plan limit (5/10/20). Photo button hidden at limit; label shows count `(3/5)`. Upload error replaced with upgrade toast.

#### Bulk listing tools
- **Bulk select in flat/table inventory view** — Checkboxes appear on rows that have an active listing. Select-all checkbox in table header.
- **Bulk action bar** — Appears above the table when rows are selected. Actions: Pause, Resume, Remove from Shop, Update Price (Nursery plan only).
- **`/api/listings/bulk-action` route** — POST endpoint accepts `{ listingIds, action, priceCents? }`. Verifies all listings belong to the authenticated seller. Actions: pause → status="paused", resume → status="active", remove → pause + clear inventory.listing_id, price → update price_cents.

#### UX improvements (audit fixes)
- **Listings dashboard empty state** — Replaced bare "No listings yet." with an illustrated empty state (🌿 emoji, explanation that listings come from Inventory, "Go to Inventory →" green button).
- **Auctions dashboard empty state** — Replaced bare "No auctions yet." with illustrated empty state (🔨 emoji, explanation that auctions come from Inventory, "Go to Inventory →" green button).
- **"How auctions work" collapsible** — Added a collapsible info panel above the bid card on every auction detail page. Collapsed by default. Explains: minimum bid, Buy Now, sniping protection (2-minute extension), no-bid outcome, and what to do when you win.

### SQL migrations required
Run in Supabase SQL editor:
```sql
-- Referral system
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by text,
  ADD COLUMN IF NOT EXISTS total_referrals integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS referral_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);
ALTER TABLE referral_activations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON referral_activations FOR ALL USING (false);
```

### Files created
- `src/app/api/admin/sponsor-request-close/route.ts`
- `src/app/api/cron/cleanup-sponsor-requests/route.ts`
- `src/app/api/admin/giveaway-pick-winner/route.ts`
- `src/app/api/admin/giveaway-save-winner/route.ts`
- `src/app/api/garden/activate-referral/route.ts`
- `src/app/api/listings/bulk-action/route.ts`
- `src/app/giveaway/referral-card.tsx`
- `src/app/admin/giveaway/giveaway-admin-tabs.tsx`

### Files modified
- `src/lib/plan-limits.ts` — listings set to null (unlimited) for all plans
- `src/lib/supabase/types.ts` — referral_code, referred_by, total_referrals on profiles; referral_activations table
- `src/app/signup/page.tsx` — reads ?ref= param, passes referral_code in signup metadata
- `src/app/api/auth/claim-groundbreaker/route.ts` — generates referral code, stores referred_by
- `src/components/garden/garden-form.tsx` — first-plant detection, activate-referral call
- `src/components/garden/import-client.tsx` — same first-plant check for bulk import
- `src/app/giveaway/page.tsx` — referral code backfill, bonus entries fetch, next month teaser, ReferralCard
- `src/app/giveaway/enter-button.tsx` — post-entry referral nudge with plant-add requirement language
- `src/app/giveaway/sponsor-request-form.tsx` — "Submit another request" button
- `src/app/admin/giveaway/giveaway-admin-client.tsx` — WinnerPicker component
- `src/app/admin/giveaway/sponsor-requests-panel.tsx` — CloseButton component
- `src/app/admin/giveaway/page.tsx` — delegates to GiveawayAdminTabs
- `src/app/pricing/page.tsx` — unlimited listings copy, FAQ update
- `src/app/dashboard/inventory/inventory-client.tsx` — photo limit enforcement, bulk select/action bar
- `src/app/dashboard/listings/page.tsx` — illustrated empty state
- `src/app/dashboard/auctions/page.tsx` — illustrated empty state
- `src/app/auctions/[id]/auction-bid-panel.tsx` — "How auctions work" collapsible
- `vercel.json` — added cleanup-sponsor-requests cron

---

## 2026-06-02 — Dispute refunds

### Features added
- Sellers can issue a full refund directly from the dispute thread via "Issue refund" button
- Refund goes through Stripe with `reverse_transfer: true, refund_application_fee: true` — money comes from seller's Stripe balance, Plantet returns its platform fee, buyer gets 100% back
- Order marked `refunded`, dispute auto-resolved on successful refund
- Both parties emailed: buyer gets refund confirmation with amount and 5–10 day timeline; seller gets confirmation with note about Stripe processing fee being non-refundable
- Button only visible to sellers (not buyers), only on open disputes

### Files modified
- `src/app/api/orders/dispute/[id]/refund/route.ts` — new POST endpoint
- `src/lib/email.ts` — added `sendRefundIssuedToBuyer`, `sendRefundIssuedToSeller`
- `src/app/orders/dispute-thread.tsx` — added "Issue refund" button for sellers

---

## 2026-06-03 — Care Schedule: Bulk Log, Filters, Search, One-time Reminders & Notes

### Features added
- **Bulk log in Week Ahead**: "Select tasks" button enters per-task selection mode (key = `plantId-careType` for recurring tasks, `reminder-id` for reminders); "Log selected" logs all chosen at once
- **Manage Schedules filter tabs**: All / Scheduled / Not set — filters the plant list in-place
- **Manage Schedules search bar**: Live search by plant name with clear button
- **One-time reminders**: New tab "One-time" inside the plant edit modal; choose task type, date, and optional notes; reminder appears in Week Ahead on the scheduled day
- **Garden-level notes/reminders**: "+ Add reminder" button in Week Ahead opens a modal with plant (optional), task type, date, and notes fields — no plant required
- **Reminders in Week Ahead**: `care_reminders` rows merged into section buckets (Overdue, Due Today, etc.) and the 7-day WeekStrip; "Done ✓" marks them complete
- **care_reminders table**: new Supabase table — run migration `014_care_reminders.sql`

### Files created
- `supabase/migrations/014_care_reminders.sql` — new table + RLS + index
- `src/app/api/garden/reminders/route.ts` — POST create reminder
- `src/app/api/garden/reminders/[id]/route.ts` — PATCH complete + DELETE

### Files modified
- `src/app/garden/care/page.tsx` — fetches `care_reminders` and passes `reminderEntries` to client
- `src/app/garden/care/care-schedule-client.tsx` — all UI changes (filters, search, bulk log, reminder cards, add-reminder modal, one-time tab in intervals modal)
- `src/lib/supabase/types.ts` — added `care_reminders` table type

### SQL migrations required
- Run `supabase/migrations/014_care_reminders.sql` in the Supabase SQL editor

### Environment variables
- None

---

## 2026-06-03 — Care Schedule TypeScript fixes

### Bugs fixed
- `src/app/api/garden/log-care/route.ts` — `CARE_EVENT_MAP` retyped as `Record<string, GardenEventType>` so `eventType` is assignable to the insert type (was `string`, caused TS2769)
- `src/app/garden/care/care-schedule-client.tsx` — Fixed `onLogged` callback type mismatch: `Section` and `CareCard` now accept `(plantId: string, careType: string) => void`; `CareCard` closes over `entry.plantId`/`entry.careType` before passing a no-arg callback to `QuickLogButton`. Previously the optimistic removal in `handleLogged` was getting `undefined` for both args and never removing entries from state.

### SQL migrations required
- None

### Environment variables
- None

---

## 2026-06-04 — Care Schedule: Notes dialog, date-accurate logging, next-task preview, quick presets

### Features added
- **`/api/garden/log-notes` route** — POST endpoint accepts `{ events: { eventId, notes }[] }` and batch-saves notes to existing `garden_events` rows; skips rows with empty notes; enforces user ownership via `user_id` check
- **Notes pop-out dialog after logging** — After any single or bulk log action in Week Ahead, a `LogNotesDialog` appears with a per-event textarea for each logged item; "Save notes" calls `/api/garden/log-notes`; dialog can be skipped via the close button
- **Date-accurate logging for past days** — `DayTaskRow` and all bulk-log calls now include the viewed day's date as `date:` in the API body so past tasks are logged on their actual date instead of always today; single log also passes `logDate`
- **Next upcoming task date when week is all clear** — When the current week has zero pending tasks, the strip header shows "Next: [short date]" (e.g. "Next: Jun 11") by computing the earliest future occurrence across all entries and reminders; falls back to "All clear ✓" when no future tasks exist
- **Quick water interval presets on unscheduled plants** — Plants with no intervals set in Manage Schedules now show "💧 water: 3d / 7d / 14d" inline preset buttons instead of "No schedule set"; clicking calls `/api/garden/update-intervals` directly and refreshes

### Files created
- `src/app/api/garden/log-notes/route.ts`

### Files modified
- `src/app/garden/care/care-schedule-client.tsx` — `LogNotesDialog` component; `logDate` computation; `nextTaskOffset` computation; `DayTaskRow` updated props; `handleLog`, `logSelected`, `logAll` updated; `ManagePlantRow` quick preset buttons; `handleQuickWater` in `CareScheduleClient`

### SQL migrations required
- None

### Environment variables
- None

---

## 2026-06-04 — Daily care reminder emails + quick setup wizard

### Features added

#### Daily garden care reminder email
- New `/api/cron/daily-care-reminder` cron route: fetches all users with `daily_care_emails = true`, computes which plants are due or overdue for each, sends a branded morning email via Resend listing plant name, care type, and days overdue
- Runs daily at 1 PM UTC (`0 13 * * *`) — fires only when the user has at least one task due that day
- `sendDailyCareReminder()` + `buildDailyCareReminderHtml()` added to `src/lib/email.ts` with full Plantet brand template
- `daily_care_emails boolean NOT NULL DEFAULT true` added to profiles table (users opted in by default)
- "Daily garden care reminders" toggle added to Account → Email Preferences — saved with the rest of the profile form

#### Quick setup wizard (`/garden/care/setup`)
- New server-rendered page + `SetupClient` component at `/garden/care/setup`
- Shows all plants that have zero intervals set — one card per plant with name, image, location
- Water interval chips: 3d / 7d / 14d / 30d — tap to select, tap again to deselect; clear button on set plants
- Sticky footer shows "X plants set up" count with "Save & continue" / "Skip for now" button
- On save: groups plants by chosen interval, calls `/api/garden/update-intervals` once per unique interval value, then navigates to `/garden/care`
- Care schedule "No schedules yet" empty state now shows a green "💧 Quick setup" button linking to the wizard

### Files created
- `src/app/api/cron/daily-care-reminder/route.ts`
- `src/app/garden/care/setup/page.tsx`
- `src/app/garden/care/setup/setup-client.tsx`

### Files modified
- `src/lib/email.ts` — `DailyCareItem` type, `buildDailyCareReminderHtml()`, `sendDailyCareReminder()`
- `src/lib/supabase/types.ts` — `daily_care_emails: boolean` on profiles Row, Insert, Update
- `vercel.json` — added `0 13 * * *` cron for daily-care-reminder
- `src/app/account/account-form.tsx` — `dailyCareEmails` state + toggle UI + save payload
- `src/app/garden/care/care-schedule-client.tsx` — updated empty state with Quick setup CTA

### SQL migrations required
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_care_emails boolean NOT NULL DEFAULT true;
```

### Environment variables
- None new

---

## 2026-06-04 — Remove Shippo / weight-based shipping (flat rate + free only)

### Why
Weight-based shipping via Shippo created financial risk: if a seller enters the wrong weight (e.g. 16 oz instead of 160 oz), the platform absorbs the difference in postage cost, potentially wiping out commission profits.

### Files deleted
- `src/lib/shippo.ts`
- `src/app/api/shipping/estimate/route.ts`
- `src/app/api/shipping/auction-rates/route.ts`
- `src/app/api/shipping/rates-for-order/route.ts`
- `src/app/api/shipping/purchase-label/route.ts`
- `src/app/api/shippo/webhook/route.ts`
- `src/app/api/shippo/validate-address/route.ts`
- `src/app/api/address/validate/route.ts`
- `src/app/dashboard/orders/get-label-modal.tsx`
- `src/app/api/profile/update-shipping/route.ts`

---

## 2026-06-16 — Auth fixes, garden display fix, Facebook OG images

### Bug fixes
- **Duplicate signup prevention** (`src/app/signup/page.tsx`): Supabase silently returns `identities: []` when email already exists. Added check after `signUp()` to detect this and show "An account with this email already exists. Sign in instead." instead of getting stuck on the "Check your inbox" screen.
- **Login error messages** (`src/app/login/page.tsx`): Replaced generic "Invalid login credentials" with specific banners — "Email not confirmed" → amber banner with resend link; "Invalid login credentials" → red banner noting Google signup option and forgot-password link.
- **Garden name/variety display** (`src/app/garden/[id]/page.tsx`, `src/app/gardens/[username]/[id]/page.tsx`, `src/components/garden/garden-plant-card.tsx`, `src/components/garden/garden-public-grid.tsx`): Plant name and variety were swapped in garden views — fixed display order.
- **Facebook OG images for auctions** (`src/app/auctions/[id]/page.tsx`): Custom `/api/og` route (Satori/ImageResponse) was being rejected by Facebook as "Corrupted Image" across all versions and runtimes (Node.js and Edge). Root cause never fully resolved — Facebook's image validator rejects our route despite curl confirming valid PNG. Fixed by switching `og:image` to use the auction's first plant photo via Supabase render endpoint (`/storage/v1/render/image/public/...?width=1200&height=630&resize=cover&quality=80`). Twitter card still uses the styled `/api/og` card.
- **Facebook OG images for shop listings** (`src/app/shop/[id]/page.tsx`): Applied same plant photo approach for consistency.

### OG route changes (`src/app/api/og/route.tsx`)
- Switched to Edge runtime (`export const runtime = "edge"`) to eliminate cold start latency
- Removed Supabase image pre-fetch (was downloading plant photos as base64 to embed in card) — route now renders text-only green branded card
- Added `Content-Length` header to response
- Route still used for Twitter card on both auctions and shop listings

### No SQL migrations required
### No new environment variables
- `src/app/admin/shipping-adjustments/page.tsx`

### Files changed
- `src/app/api/shipping/rates/route.ts` — rewritten, free/flat only (no Shippo)
- `src/app/dashboard/auctions/new-auction-dialog.tsx` — removed weight mode, calculatedShippingEnabled prop, weight state
- `src/app/dashboard/listings/new-listing-dialog.tsx` — same as above
- `src/app/account/account-form.tsx` — removed entire Shipping Settings card (ship-from address, services, calculated shipping, auto-labels toggles)
- `src/app/dashboard/orders/orders-client.tsx` — removed BuyLabelModal, BuyLabelButton, autoLabelsEnabled, shippo_rate_id
- `src/app/dashboard/auctions/page.tsx` — removed ship_from_address/calculated_shipping_enabled from profile fetch, removed calculatedShippingEnabled prop
- `src/app/api/auctions/close/route.ts` — removed auction_shipping_selections lookup, platformShipping, shippoRateId
- `src/app/api/bids/buy-now/route.ts` — removed shippingRateId params, auction_shipping_selections upsert, platformShipping
- `src/app/api/bids/place/route.ts` — removed shippingRateId params, auction_shipping_selections upsert, weight requirement check
- `src/app/auctions/[id]/auction-bid-panel.tsx` — removed ShippingRate interface, shippingRates state, weight UI in confirm dialogs
- `src/app/auctions/[id]/page.tsx` — removed shipping_weight_oz from AuctionData prop
- `src/app/api/stripe/checkout/route.ts` — removed shippoRateId, simplified applicationFeeCents (no longer holds shipping)
- `src/app/api/stripe/cart-checkout/route.ts` — removed shippoRateId, fixed applicationFeeCents (removed shippingCents from fee)
- `src/app/dashboard/inventory/inventory-client.tsx` — removed weight mode from all shipping UIs, calculatedShippingEnabled/hasShipFrom props
- `src/app/dashboard/inventory/page.tsx` — removed ship_from_address/calculated_shipping_enabled from profile fetch
- `src/app/dashboard/create/create-form.tsx` — removed weight ShippingMode, weightOz from SizeEntry, calculatedShippingEnabled state
- `src/app/orders/page.tsx` — removed autoLabelsEnabled

### SQL migrations needed
None — DB columns (shipping_weight_oz, box_length_in, box_width_in, box_height_in, package_type, ship_from_address, calculated_shipping_enabled, auto_labels_enabled) are left in place but unused.

### Environment variables
- `SHIPPO_API_KEY` is no longer used (can be removed from .env.local and Vercel, but not urgent)

---

## 2026-06-05 — Vacation Mode + Sitter Guide

### Features built
- **Vacation / pause mode**: "🏖️ Going away?" button on the care schedule page opens a dialog to set a return date. All care schedules pause for the duration — due dates shift forward, overdue banner hides, and daily emails are skipped. "I'm back" button ends vacation early. Pause duration is tracked as a cumulative offset so multiple vacations stack correctly.
- **Sitter guide**: "🌿 Share sitter guide" link in the Week Ahead tab opens a dialog with a shareable URL (`/garden/care/sitter-guide?token=<uuid>`). The page is public (no login), shows a 30-day day-by-day care schedule with printable checkboxes, and has a "Print / Save as PDF" button. Printing uses CSS `@media print` — no extra dependencies.

### Files changed
- `src/app/garden/care/page.tsx` — fetches profile vacation fields + sitter_token; adds pause offset to daysUntilDue; passes vacationStart, vacationEnd, sitterToken props to CareScheduleClient
- `src/app/garden/care/care-schedule-client.tsx` — new props (vacationStart, vacationEnd, sitterToken); vacation banner + "Going away?" link; vacation dialog; sitter share dialog; overdue banner suppressed during vacation
- `src/app/api/garden/vacation/route.ts` — new file; POST to set vacation, DELETE to end it
- `src/app/garden/care/sitter-guide/page.tsx` — new file; token-authenticated public page; 30-day schedule
- `src/app/garden/care/sitter-guide/print-button.tsx` — new file; client component for window.print()
- `src/app/api/cron/daily-care-reminder/route.ts` — skips vacationing users; applies schedule_pause_offset to daysUntilDue

### SQL migrations needed
Run `supabase/migrations/015_vacation_mode.sql` in the Supabase dashboard:
```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS vacation_start      DATE,
  ADD COLUMN IF NOT EXISTS vacation_end        DATE,
  ADD COLUMN IF NOT EXISTS schedule_pause_offset INTEGER NOT NULL DEFAULT 0;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sitter_token UUID NOT NULL DEFAULT gen_random_uuid();
```

### Environment variables
None new.

---

## 2026-06-05 — Snooze, All Done Moment, Custom Care Types

### Features built
- **Snooze tasks (#5+#9)**: Select one or more tasks in the day panel → "Snooze" button opens a dialog with Tomorrow / +3 days / +1 week / +2 weeks options. Pushes the due date forward without logging or changing the interval. Active snoozes stored in `care_snoozes` table; snooze clears automatically on log. 💤 indicator shows in Manage Schedules for snoozed tasks. Snoozed tasks skipped in daily emails.
- **All done moment (#7)**: When every task in today's panel is logged, shows "🌿 All done for today!" with the next upcoming task date instead of a blank panel.
- **Custom care types (#8)**: Add unlimited user-defined recurring intervals per plant (e.g. "Neem oil spray every 14 days"). Accessible via the IntervalsModal Recurring tab → Custom intervals section. Custom tasks appear in the day panel, week strip, Manage Schedules, daily emails, and sitter guide. Event type stored as `custom:<schedule_id>` in garden_events.

### Files changed
- `supabase/migrations/016_snooze_custom_care.sql` — new tables
- `src/app/api/garden/snooze/route.ts` — new snooze API
- `src/app/api/garden/custom-schedules/route.ts` — new custom schedule API
- `src/app/api/garden/log-care/route.ts` — accepts eventKey for custom types; clears snooze on log
- `src/app/garden/care/page.tsx` — fetches snoozes + custom schedules, applies to daysUntilDue
- `src/app/garden/care/care-schedule-client.tsx` — all done moment, snooze dialog, custom type rendering, IntervalsModal custom section, snooze indicator in Manage Schedules
- `src/app/api/cron/daily-care-reminder/route.ts` — custom schedules + snooze-aware
- `src/app/garden/care/sitter-guide/page.tsx` — custom schedules in 30-day schedule
- `src/lib/supabase/types.ts` — care_snoozes + custom_care_schedules table types

### SQL migrations needed
Run `supabase/migrations/016_snooze_custom_care.sql` in the Supabase dashboard.

### Environment variables
None new.

---

## 2026-06-05 � Weekly care summary email + landing page care schedule update

### Features added

#### Weekly garden care summary email
- New /api/cron/weekly-care-summary/route.ts cron: runs Monday 1 PM UTC (  13 * * 1), sends a 7-day care forecast to users with daily_care_emails = true
- Shows tasks due in the next 7 days (offsets 1�7), grouped by day label (Mon Jun 9, Wed Jun 11, etc.)
- Capped at 10 task rows; shows "+ N more tasks this week" overflow note with link to care schedule
- Skips vacation users and snoozed tasks; handles both built-in and custom care types
- uildWeeklyCareSummaryHtml() + sendWeeklyCareSummary() + WeeklyCareDay type added to src/lib/email.ts
- Account ? Email Preferences label updated from "Daily garden care reminders" to "Weekly garden care reminders" with corrected description

#### Admin email preview
- Weekly Care Summary added to /admin/email-preview under Account category with sample data
- Legacy "Garden Care Reminder" template removed from preview (superseded by Weekly Care Summary)
- "Monthly plant digest" label fixed to "Weekly plant digest" (cron fires weekly, not monthly)

#### Landing page care schedule card
- Description updated to reflect current features: week-ahead view, one-tap logging, snooze, vacation mode, email reminders, sitter guide
- Example widget updated: added amber "3 tasks missed" overdue banner, Overdue/Due today tabs, emoji-prefixed care badges, "Due today" labels on task rows

### No migrations required

### Files created
- src/app/api/cron/weekly-care-summary/route.ts

### Files modified
- src/lib/email.ts � WeeklyCareDay type, buildWeeklyCareSummaryHtml(), sendWeeklyCareSummary()
- src/app/account/account-form.tsx � Weekly care reminders label + description; Weekly plant digest label
- src/app/admin/email-preview/page.tsx � Added Weekly Care Summary, removed Garden Care Reminder
- src/components/garden-feature-cards.tsx � Care schedule description + example widget
- ercel.json � Added weekly-care-summary cron (Monday 1 PM UTC)

### Parking lot
- #12 iCal calendar feed deferred � details in parking_lot.md

---

## 2026-06-08 � Trades feature + community fixes + UX fixes

### Features built
- **Trades system** � full plant-for-plant swap feature:
  - src/app/api/trades/route.ts � POST create trade offer
  - src/app/api/trades/[id]/route.ts � PATCH accept/decline/cancel
  - src/app/api/trades/[id]/messages/route.ts � POST send chat message
  - src/app/trades/[id]/page.tsx � trade detail page (offer summary + actions)
  - src/app/trades/[id]/trade-actions.tsx � accept/decline/cancel client component
  - src/app/trades/[id]/trade-chat.tsx � real-time chat per trade
  - src/app/trades/new/page.tsx � propose trade form
  - src/app/trades/page.tsx � redirects to /dashboard/offers?tab=trades
  - Email notifications: sendTradeProposed, sendTradeAccepted, sendTradeDeclined added to email.ts
- **Offers page tabs** � /dashboard/offers now has Offers and Trades tabs
- **Navbar** � pending trade badge on avatar, "Offers & Trades (N)" in dropdown, Trades in mobile menu
- **Garden/seller profile** � "Open to trades" buttons now link to /trades/new?to=username (was /messages)
- **Confirmation email UX** � expired link error now shows prominent green button; /verify-email auto-triggers resend when email is pre-filled, immediately shows "already confirmed � sign in" if applicable

### Bugs fixed
- types.ts missing newlines between community_post_likes/community_post_follows and community_reply_likes/community_replies (caused TypeScript build failures)
- Placeholder string with literal quote character broke Turbopack parse in trades/new/page.tsx
- Trades "Open to trades" link on garden profile page and seller storefront page still pointed to /messages
- Trade chat realtime subscription used row-level filter � changed to client-side filtering for reliability

### SQL migrations to run
`sql
-- Trades feature
create table trade_offers (
  id uuid primary key default gen_random_uuid(),
  proposer_id uuid references profiles(id) on delete cascade not null,
  recipient_id uuid references profiles(id) on delete cascade not null,
  offer_description text not null,
  want_description text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table trade_offers enable row level security;
create policy "Trade parties can view their trades" on trade_offers for select using (auth.uid() = proposer_id or auth.uid() = recipient_id);
create policy "Users can create trades" on trade_offers for insert with check (auth.uid() = proposer_id);
create policy "Trade parties can update status" on trade_offers for update using (auth.uid() = proposer_id or auth.uid() = recipient_id);

create table trade_messages (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid references trade_offers(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table trade_messages enable row level security;
create policy "Trade participants can view messages" on trade_messages for select using (exists (select 1 from trade_offers where id = trade_messages.trade_id and (proposer_id = auth.uid() or recipient_id = auth.uid())));
create policy "Trade participants can send messages" on trade_messages for insert with check (auth.uid() = sender_id and exists (select 1 from trade_offers where id = trade_messages.trade_id and (proposer_id = auth.uid() or recipient_id = auth.uid())));

-- Enable realtime for trade chat
alter publication supabase_realtime add table trade_messages;
`

### Environment variables
- None added


---

## 2026-06-09 — Community Plants tab

### Features built
- Added plant_tag (text, nullable) column to community_posts — lets users optionally tag a post with a plant name
- New **Plants tab** on /community with a searchable plant directory (grid of all distinct plant tags + post counts)
- Clicking a plant shows all community posts tagged with that plant, with a breadcrumb back to the directory
- "Post about this plant" button pre-fills the tag on the new post form when coming from a plant page
- Plant tag combobox on new post form with live autocomplete (pulls from listings plant names + existing community tags)
- Plant tag badge shown on post cards throughout community feed
- New API route: GET /api/community/plant-suggestions?q= — returns merged, deduplicated plant name suggestions

### SQL migration (run in Supabase SQL editor)
```sql
alter table community_posts add column plant_tag text;
create index community_posts_plant_tag_idx on community_posts (plant_tag) where plant_tag is not null;
```

### Files changed
- src/lib/supabase/types.ts — added plant_tag to community_posts Row/Insert/Update
- src/app/community/page.tsx — Plants tab, directory, plant-filtered posts, plant tag badges on cards
- src/app/community/new/page.tsx — plant tag combobox with autocomplete, pre-fills from ?plant= query param
- src/components/community/plants-grid.tsx — new client component (searchable plant directory grid)
- src/app/api/community/plant-suggestions/route.ts — new autocomplete API route

### Environment variables
- None added

---

## 2026-06-15 — Capacitor native app + push notifications

### New features
- Capacitor 8 integration: `capacitor.config.ts` pointing `server.url` to `https://www.plantet.shop` so the native shell loads the live site with full server-side features intact
- Push notifications via Firebase Cloud Messaging (FCM) — works on both iOS and Android
- Push notification tokens stored in new `push_tokens` Supabase table (per-device, auto-cleaned when tokens go stale)
- Push notifications fire for: outbid on an auction, new bid on your auction, auction won (auto-charged), auction won (manual checkout needed), auction sold, message received, auction ending soon (< 1 hour)

### SQL migrations to run
```sql
-- Run 019_push_tokens.sql in Supabase SQL editor
-- (file: supabase/migrations/019_push_tokens.sql)
```

### Files created
- `capacitor.config.ts` — Capacitor app config (appId: shop.plantet.app)
- `cap-web/index.html` — placeholder webDir required by Capacitor CLI
- `supabase/migrations/019_push_tokens.sql` — push_tokens table + RLS
- `src/lib/firebase-admin.ts` — Firebase Admin SDK singleton
- `src/lib/push.ts` — `sendPushToUser()` helper (queries tokens, sends via FCM, prunes stale tokens)
- `src/app/api/push-tokens/route.ts` — POST to register token, DELETE to remove
- `src/components/push-notification-provider.tsx` — client component that runs in the native app only

### Files modified
- `src/app/layout.tsx` — added PushNotificationProvider
- `src/app/api/bids/place/route.ts` — push on outbid + push to seller on new bid
- `src/app/api/messages/send/route.ts` — push to recipient on new message
- `src/app/api/auctions/close/route.ts` — push on ending soon, auction won, sale made
- `.env.local.example` — added FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

### Environment variables added
- `FIREBASE_PROJECT_ID` — Firebase project ID
- `FIREBASE_CLIENT_EMAIL` — service account email
- `FIREBASE_PRIVATE_KEY` — service account private key (keep newlines as `\n` in Vercel)

### Next steps for publishing (manual)
1. Create Firebase project at console.firebase.google.com
2. Add Android app (package: `shop.plantet.app`) → download `google-services.json`
3. Add iOS app (bundle: `shop.plantet.app`) → download `GoogleService-Info.plist`
4. Add FIREBASE_* env vars to `.env.local` and Vercel dashboard
5. Run `npx cap add android` and `npx cap add ios` from project root
6. Place `google-services.json` in `android/app/`
7. Place `GoogleService-Info.plist` in `ios/App/App/`
8. Run `npx cap sync` after any changes
9. Open Android in Android Studio: `npx cap open android`
10. Open iOS in Xcode (Mac only): `npx cap open ios`
11. Accounts needed: Apple Developer ($99/yr) and Google Play ($25 one-time)

---

## 2026-06-22 — iOS native app shipped to device + push fully working

### Outcome
Android app submitted to Google Play **open testing** (built signed AAB, awaiting/への review).
iOS app built and **running on a physical iPhone via Xcode** with Firebase push notifications
working end-to-end (message, bid, auction notifications confirmed delivering in background).

### Key identifiers / accounts (IMPORTANT — durable facts)
- **iOS bundle ID:** `shop.plantet.ios` (NOT `shop.plantet.app` — that string was already
  claimed by another Apple team and is globally unavailable, so iOS uses a distinct bundle ID.
  Android keeps `shop.plantet.app`.)
- **Android package:** `shop.plantet.app`
- **Apple Developer team:** Plantet LLC — Team ID `WG3VYFNZD7` (enrolled as Organization)
- **Single Firebase project for BOTH apps:** `plantet-6fa38` (under the plantet.shop Google
  Workspace org). Earlier there were TWO Firebase projects split across a personal Google
  account and the Plantet Workspace; consolidated into `plantet-6fa38`. Backend service
  account + both app registrations all live here.
- **APNs Auth Key:** Key ID `5N8HQ48F6Z`, Team ID `WG3VYFNZD7` — uploaded to Firebase Cloud
  Messaging for the `shop.plantet.ios` app. (.p8 file — Apple only lets you download once.)
- **Google Cloud org policy gotcha:** the plantet.shop Workspace enforces
  `iam.disableServiceAccountKeyCreation` (legacy constraint), which blocked generating the
  firebase-admin service-account key. Fixed via Cloud Shell:
  `gcloud organizations add-iam-policy-binding 853487244283 --member="user:$(gcloud config get-value account)" --role="roles/orgpolicy.policyAdmin"`
  then `gcloud resource-manager org-policies disable-enforce iam.disableServiceAccountKeyCreation --project=plantet-6fa38`.
  Org ID is `853487244283`. Can be re-enforced after (the generated key keeps working).

### Native architecture (don't re-derive)
- Capacitor `server.url` points to `https://www.plantet.shop` — the native shell loads the live
  site, so **web deploys update the app instantly; only native changes need a store resubmit.**
- iOS push: `@capacitor/push-notifications` gives an APNs token; `AppDelegate.swift` was modified
  to `FirebaseApp.configure()`, set `Messaging.delegate`, and in
  `didRegisterForRemoteNotificationsWithDeviceToken` exchange the APNs token for an **FCM token**,
  then post that to `.capacitorDidRegisterForRemoteNotifications`. This means the JS
  `PushNotificationProvider` is unchanged and registers an FCM token on iOS just like Android.
- Firebase iOS SDK (FirebaseMessaging) added via Swift Package Manager.
- `GoogleService-Info.plist` MUST be added to the Xcode project (Add Files → uncheck "Copy items
  if needed", check App target) — copying it to the folder on disk alone is NOT enough; Firebase
  won't find it and `FirebaseApp.configure()` crashes.

### Critical backend fix (applies to ALL push)
Push sends were fire-and-forget (not awaited), so Vercel's serverless runtime killed the
function before the FCM call ran — notifications only appeared when the app was reopened.
**Fix: `await` every `sendPushToUser` call** so it completes before the response returns.
Also added APNs headers `apns-priority: 10` + `apns-push-type: alert` and explicit `aps.alert`
in `src/lib/push.ts` so iOS shows banners while the app is closed/backgrounded.

### Files modified this session
- `src/lib/push.ts` — APNs alert headers + explicit aps.alert + send logging
- `src/app/api/messages/send/route.ts` — await sendPushToUser
- `src/app/api/bids/place/route.ts` — await notifyOutbid/notifyNewBid (Promise.all)
- `src/app/api/auctions/close/route.ts` — await all sendPushToUser calls
- `ios/App/App/AppDelegate.swift` — Firebase init + APNs→FCM token exchange (on Mac, not committed from PC)
- `ios/App/App/GoogleService-Info.plist` — now for `shop.plantet.ios` / project `plantet-6fa38` (on Mac)

### Remaining for iOS launch
1. ~~Verify push works on a production build~~ ✅ DONE 2026-06-23. Production push initially
   failed on TestFlight because Firebase only had the APNs key in the **Development** slot —
   the **Production APNs auth key slot was empty**. Fixed by uploading the same `.p8`
   (Key ID `5N8HQ48F6Z`, Team ID `WG3VYFNZD7`) to the production slot too (the key is scoped
   Sandbox & Production, so the same file works for both). Build uploaded to App Store Connect,
   TestFlight internal testing working.
2. Fill App Store listing metadata (screenshots, privacy questionnaire, demo account for review
   since the app requires login) → submit for review. (In progress.)
3. (Optional) Re-enforce the `iam.disableServiceAccountKeyCreation` org policy.

### 2026-06-23 — iOS app SUBMITTED to App Store review
- App Store Connect record created (name "Plantet", bundle `shop.plantet.ios`, SKU `plantet-ios`).
- Listing: description (community-first, no emoji — App Store rejects emoji in description),
  keywords, support URL `https://www.plantet.shop/contact`, category Primary **Shopping** /
  Secondary **Lifestyle**.
- Screenshots: App Store wanted **6.5" display** (1284 × 2778). iPhone shots are 1179 × 2556;
  resized non-proportionally (~0.2% stretch, invisible) and **converted to JPEG** (App Store
  rejects PNGs with alpha channel).
- Demo account provided in App Review Information (app requires login).
- Pricing: **Free**. NOTE: paid "higher status" tiers are NOT in this submission. Watch for a
  possible **Guideline 3.1.1** rejection if the in-app upgrade (Stripe) is reachable — digital
  subscriptions on iOS must use Apple IAP; physical plant sales via Stripe are fine/required.
- Status: **Waiting for Review** (~24-48h, Apple emails the result).

### iOS UI fixes (web-only, deploy via Vercel — no rebuild)
- Navbar was scrolling away in WebKit: caused by `html h-full` + `body min-h-full` percentage
  height chain. Fixed to `body min-h-screen` + dropped `html h-full` (commit 80ace58).
- Content bled behind the iOS status bar on scroll: added `viewportFit: "cover"` to the viewport
  export and `pt-[env(safe-area-inset-top)]` on the sticky `<header>` so its background covers
  the status-bar strip (commit cd98eb4).

## 2026-06-24 — Admin: Ban/Unban users (login block)

- Added a true **ban/unban** capability for sellers (distinct from Archive, which has a 30-day delete timer). Built after spotting a seller ("shopra.org" — a competitor scouting the seller flow) on the first live sale.
- New server route `src/app/api/admin/ban-user/route.ts` (admin-gated, mirrors rename-user pattern):
  - Bans at the **Supabase Auth layer** via `auth.admin.updateUserById(id, { ban_duration })` — a real login block (no token issued/refreshed; existing sessions rejected by getUser). 100yr duration = "876000h"; unban = "none".
  - Mirrors state to new `profiles.banned_at` column (for display + audit). Rolls back the auth ban if the profile update fails so the two never drift.
  - On ban: pauses active listings + cancels live auctions. On unban: leaves listings paused for manual re-review. No email/push sent — silent.
  - Refuses to ban admins or self. Writes `admin_audit_logs` (`ban_user` / `unban_user`).
- Admin UI: `BanUserButton`/Unban in `src/app/admin/users/user-actions.tsx` + "Banned" badge in `src/app/admin/users/page.tsx`. banned_at fetched via a separate untyped query (not in generated types yet — keep it out of the typed select or it poisons the query type).

### SQL migration to run (Supabase SQL editor)
```sql
alter table profiles add column banned_at timestamptz;
```
(No env var changes. Optional: regenerate Supabase types to drop the `as any`/untyped query casts.)

## 2026-06-24 — Hashed-IP auth tracking (fraud linkage)

- Built to catch linked/multi-account fraud (the "honey" ring: honeydesign/shopra.org seller + samantha buyer, plus honey/honeystudios). Supabase auth audit log was pruned and we never stored IPs, so existing accounts' IPs are unrecoverable — this captures going forward.
- New `auth_events` table: user_id, event, ip_hash, country, user_agent, created_at. RLS enabled with NO policies (service-role only).
- IP is stored as an HMAC-SHA256 (keyed with IP_HASH_SECRET) — non-reversible, but same IP -> same hash so accounts sharing an IP can be matched. Never stores raw IP.
- `src/lib/track-auth.ts` (clientIp + hashIp), `src/app/api/track-auth/route.ts` (Node runtime; no-op for anon; untyped admin client for the insert), `src/components/session-tracker.tsx` (one ping per browser session), mounted in RootLayout only when a user is present.
- Admin users list now shows each user's last-seen country (non-US flagged red), read via service-role client since auth_events is RLS-locked.
- Degrades gracefully: missing table -> admin page still loads, route 500s silently (client .catch); missing IP_HASH_SECRET -> events recorded with null ip_hash.

### SQL migration to run (Supabase SQL editor)
```sql
create table if not exists auth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null,
  ip_hash text,
  country text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists auth_events_ip_hash_idx on auth_events(ip_hash);
create index if not exists auth_events_user_id_idx on auth_events(user_id);
alter table auth_events enable row level security;
```

### Env var to add (Vercel + .env.local)
- `IP_HASH_SECRET` = long random string (e.g. `openssl rand -hex 32`). Without it, ip_hash is null (no linkage), everything else still works.

### Ring-detection query (accounts sharing an IP)
```sql
select e.ip_hash, count(distinct e.user_id) as accounts,
       array_agg(distinct p.username) as usernames
from auth_events e
join public.profiles p on p.id = e.user_id
where e.ip_hash is not null
group by e.ip_hash
having count(distinct e.user_id) > 1
order by accounts desc;
```

### TODO
- Privacy policy: mention hashed-IP/country collection for fraud prevention.

## 2026-06-24 — Hardened US-only signup gate (server-side)

- The previous "US Only" gate was client-side only (cosmetic) — non-US users could sign up via VPN, the Google button, direct API calls, or null-country fail-open. This adds real server-side enforcement.
- No DB trigger creates profiles (confirmed via migrations), so `!profile?.username` reliably means "brand-new signup" — used as the gate point in /auth/callback.
- `src/lib/geo.ts`: `isGeoAllowed(country)` — fail-closed (unknown country blocked too), but ONLY in production (NODE_ENV), so local dev/preview aren't locked out. Allowed set = {US}.
- `src/app/auth/callback/route.ts`: brand-new non-US signups get their just-created auth user DELETED (not banned — keeps auth clean, lets false-positive US users retry) and redirected to /us-only. Existing users are never geo-checked (travelers unaffected).
- `src/app/api/auth/complete-profile/route.ts`: server-side 403 backstop so a profile can't be created from outside the US even if the client is bypassed.
- `src/app/us-only/page.tsx`: static US-only landing. signup/complete now shows the US Only card on a 403 geoBlocked response.
- Real seller enforcement remains Stripe Connect (US bank required) — IP geo is the deterrent.
- Added migration files for repo consistency: 020_user_bans.sql (banned_at), 021_auth_events.sql.

### Migrations / env (no NEW migration for the geo gate)
- Still required if not already done: run 021_auth_events.sql in Supabase, and set IP_HASH_SECRET in Vercel.
- Territories note: only "US" is allowed; Puerto Rico (PR) etc. resolve to their own codes and would be blocked — expand ALLOWED_COUNTRIES in src/lib/geo.ts if desired.

## 2026-06-24 — Fix: Care Schedule overdue tasks shown on a future day

- Bug: a task overdue by more than one full interval (e.g. 19d overdue, 21d interval) was excluded from the Overdue/Today bucket by a `Math.abs(daysUntilDue) < interval` cap, then projected forward by getStripDays() onto its next theoretical due date — so it rendered on a FUTURE day labeled "Xd overdue", while Today and past days showed "nothing missed".
- Fix (src/app/garden/care/care-schedule-client.tsx): overdue = `daysUntilDue < 0`, full stop — removed the one-interval cap everywhere (overdueCount, today strip count, today panel filter, overdue/dueToday split, bulk "log all overdue"). getStripDays() now returns empty for negative daysUntilDue so overdue tasks are never drawn on a future strip day. DayTaskRow shows the real overdue label.
- Result: overdue tasks consolidate into Today's Overdue bucket with correct "Nd overdue" labels; future days show only genuine future recurrences.
- No DB/schema/env changes.

## 2026-06-24 — AI care-schedule suggestions (Claude Haiku)

- New "Suggest schedule ✨" button on the care setup page that pre-fills water/fertilize/prune/repot intervals for each plant via Claude.
- Reuses the existing plant-guide setup: same @anthropic-ai/sdk, same ANTHROPIC_API_KEY, same model (claude-haiku-4-5-20251001), same cache-first pattern as /api/plant-info.
- New route `src/app/api/garden/suggest-care/route.ts`: normalized-name cache lookup in `care_suggestions` (365-day freshness) → Haiku on miss → JSON parse → clamp each interval to sane bounds (bad/out-of-range values fall back to a default) → upsert cache. Untyped admin client (table not in generated types). Returns confidence high/medium/low.
- UI `src/app/garden/care/setup/setup-client.tsx`: button calls the route, snaps each suggested interval to the nearest existing preset chip, auto-expands the plant, toasts a "double-check it" note on low confidence.
- Cost: ~$0.001–0.0015 per uncached lookup, $0 on cache hits (plant names repeat across users). No new env var or dependency.

### SQL migration to run (Supabase SQL editor)
```sql
create table if not exists care_suggestions (
  query text primary key,
  water int not null,
  fertilize int not null,
  prune int not null,
  repot int not null,
  confidence text not null default 'medium',
  created_at timestamptz not null default now()
);
alter table care_suggestions enable row level security;
```
(No env var changes — ANTHROPIC_API_KEY already set for the plant guide.)

## 2026-06-24 — Move AI care suggestion into the edit modal (Manage Schedules)

- Moved the "Suggest a schedule with AI" action out of the standalone /setup page and into the IntervalsModal "Recurring" tab (opened by the pencil from Manage Schedules and the Week Ahead day panel). Single-plant only; reverted the /setup additions.
- Button calls /api/garden/suggest-care and pre-fills the water/fertilize/repot/prune number inputs (em-dash stripped from the plant name for cache-key consistency). User reviews and hits Save. No backend changes — same route/table from the earlier commit.

## 2026-06-24 — Potting context + smarter care suggestions (repot/prune fixes)

- Repot only applies to potted plants; pruning is seasonal not a fixed timer. Fixed both by giving the suggester potting context and making prune advice-only.
- Data model: garden_plants gains `potting` ('pot'|'ground') and `pot_size` (text). My Garden is the source of truth; the care schedule reads from it.
- Add/Edit plant form (garden-form.tsx): new "Planting" select + conditional "Pot size" select. Edit page fetches potting/pot_size untyped and passes them in. Insert/update cast `as never` (columns not in generated types).
- care_suggestions cache recreated: `repot` now nullable (null = in-ground), `prune` int replaced by `prune_advice` text. Cache key = "<name>|<potting>|<pot_size>".
- suggest-care route: takes potting + potSize; in-ground => repot null + assume established-plant (less frequent) watering; potted => repot interval tailored to size. Pruning returned as a short text tip (no interval), since we don't know the user's climate/season.
- New /api/garden/potting (PATCH): saves potting/pot_size onto the plant (RLS + user_id pin).
- IntervalsModal: "Suggest a schedule with AI" now — if the plant has no potting set, shows an inline "in a pot / in the ground (+ size)" prompt, saves it to My Garden, then suggests. Fills water/fertilize always, repot only if potted, and shows pruning as a purple advice callout with the prune field left for manual entry.
- care page passes potting/potSize into PlantWithIntervals (fetched untyped).

### SQL migration to run (Supabase SQL editor)
```sql
alter table garden_plants add column if not exists potting text
  check (potting in ('pot', 'ground'));
alter table garden_plants add column if not exists pot_size text;

drop table if exists care_suggestions;
create table care_suggestions (
  query text primary key,
  water int not null,
  fertilize int not null,
  repot int,
  prune_advice text,
  confidence text not null default 'medium',
  created_at timestamptz not null default now()
);
alter table care_suggestions enable row level security;
```
(No env changes. Drops the old care_suggestions cache from migration 022 — it's just a cache.)

## 2026-06-24 — Care timezone fix, dormancy, and daily care PUSH reminders

- Timezone (024): profiles.timezone captured via SessionTracker->track-auth; care "today" now computed per-user in their zone (page, sitter-guide) — fixes evening day-rollover for US users. Weekly cron unaffected (runs 1pm UTC = US morning). Vacation offset clamped to vacation_end; weekly-email user pagination; sitter NaN guard. care-date.ts has todayStrInTz/hourInTz/midnight.
- Dormancy: plants with status 'dormant' or 'dead' are excluded from care-task generation (app, weekly email, sitter guide). They still show in Manage Schedules.
- Daily care PUSH reminders (025): opt-in profiles.care_push_reminders. New hourly cron /api/cron/care-push sends ONE app push (no email) at the user's local 8am when they have care due that day (skips vacation, dormant/dead, snoozed). vercel.json schedule "0 * * * *". Toggle in Account > notifications. Also fixed a latent bug: /api/profile/update was silently dropping daily_care_emails (now persists it + care_push_reminders).

### SQL migrations to run (Supabase SQL editor)
```sql
alter table profiles add column if not exists timezone text;
alter table profiles add column if not exists care_push_reminders boolean not null default false;
```
(No env changes. Push uses existing Firebase infra. care-push cron needs CRON_SECRET, already set.)

## 2026-06-24 — Frost alerts (weather, advisory push)

- Opt-in frost alerts (026): profiles.postal_code + lat/lng + frost_alerts (default true). ZIP geocoded once on save via zippopotam.us (free, no key) -> lat/lng stored. Account > notifications has a Frost alerts toggle + ZIP input.
- New hourly cron /api/cron/frost-alert: for opted-in users with coords, at their local 5pm, fetches tonight's overnight low from Open-Meteo (free, no key; tomorrow's daily temperature_2m_min). If <= 36°F, sends an APP push "❄️ Frost alert tonight — protect outdoor plants." Advisory only — never changes the care schedule. vercel.json schedule "0 * * * *".
- Indoor/outdoor: handled as a per-USER location alert (not per-plant) — the user knows which plants are outside. No per-plant flag needed.
- Rain notices intentionally deferred (noisy without an outdoor flag; advisory-only anyway → snooze already covers manual skip).
- src/lib/weather.ts: geocodeUsZip + getOvernightLowF.

### SQL migration to run (Supabase SQL editor)
```sql
alter table profiles add column if not exists postal_code text;
alter table profiles add column if not exists lat double precision;
alter table profiles add column if not exists lng double precision;
alter table profiles add column if not exists frost_alerts boolean not null default true;
```
(No env/API keys — Open-Meteo and zippopotam.us are free no-key APIs.)
