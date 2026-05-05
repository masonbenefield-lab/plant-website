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
