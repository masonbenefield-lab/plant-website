-- Enable uuid extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- ENUM TYPES
-- ─────────────────────────────────────────────
create type listing_status as enum ('active', 'paused', 'sold_out');
create type auction_status as enum ('active', 'ended', 'cancelled');
create type order_status as enum ('pending', 'paid', 'shipped', 'delivered');

-- ─────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  bio text,
  avatar_url text,
  stripe_account_id text,
  stripe_onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- ─────────────────────────────────────────────
-- LISTINGS (fixed-price)
-- ─────────────────────────────────────────────
create table listings (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references profiles(id) on delete cascade,
  plant_name text not null,
  variety text,
  quantity int not null default 1 check (quantity >= 0),
  description text,
  price_cents int not null check (price_cents > 0),
  images text[] not null default '{}',
  status listing_status not null default 'active',
  created_at timestamptz not null default now()
);

alter table listings enable row level security;

create policy "Active listings are viewable by everyone"
  on listings for select using (status = 'active' or auth.uid() = seller_id);

create policy "Sellers can insert their own listings"
  on listings for insert with check (auth.uid() = seller_id);

create policy "Sellers can update their own listings"
  on listings for update using (auth.uid() = seller_id);

create policy "Sellers can delete their own listings"
  on listings for delete using (auth.uid() = seller_id);

-- ─────────────────────────────────────────────
-- AUCTIONS
-- ─────────────────────────────────────────────
create table auctions (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references profiles(id) on delete cascade,
  plant_name text not null,
  variety text,
  quantity int not null default 1 check (quantity >= 1),
  description text,
  images text[] not null default '{}',
  starting_bid_cents int not null check (starting_bid_cents > 0),
  current_bid_cents int not null,
  current_bidder_id uuid references profiles(id),
  ends_at timestamptz not null,
  status auction_status not null default 'active',
  created_at timestamptz not null default now()
);

alter table auctions enable row level security;

create policy "Auctions are viewable by everyone"
  on auctions for select using (true);

create policy "Sellers can insert their own auctions"
  on auctions for insert with check (auth.uid() = seller_id);

create policy "Sellers can update their own auctions"
  on auctions for update using (auth.uid() = seller_id);

create policy "Sellers can delete their own active auctions"
  on auctions for delete using (auth.uid() = seller_id and status = 'active');

-- ─────────────────────────────────────────────
-- BIDS
-- ─────────────────────────────────────────────
create table bids (
  id uuid primary key default uuid_generate_v4(),
  auction_id uuid not null references auctions(id) on delete cascade,
  bidder_id uuid not null references profiles(id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);

alter table bids enable row level security;

create policy "Bids are viewable by everyone"
  on bids for select using (true);

create policy "Authenticated users can place bids"
  on bids for insert with check (auth.uid() = bidder_id);

-- ─────────────────────────────────────────────
-- ORDERS
-- ─────────────────────────────────────────────
create table orders (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid not null references profiles(id) on delete restrict,
  seller_id uuid not null references profiles(id) on delete restrict,
  listing_id uuid references listings(id) on delete set null,
  auction_id uuid references auctions(id) on delete set null,
  stripe_payment_intent_id text,
  shipping_address jsonb not null,
  status order_status not null default 'pending',
  amount_cents int not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  constraint order_has_source check (listing_id is not null or auction_id is not null)
);

alter table orders enable row level security;

create policy "Buyers can view their own orders"
  on orders for select using (auth.uid() = buyer_id);

create policy "Sellers can view orders for their items"
  on orders for select using (auth.uid() = seller_id);

create policy "System can insert orders"
  on orders for insert with check (auth.uid() = buyer_id);

create policy "Sellers can update order status"
  on orders for update using (auth.uid() = seller_id);

-- ─────────────────────────────────────────────
-- RATINGS
-- ─────────────────────────────────────────────
create table ratings (
  id uuid primary key default uuid_generate_v4(),
  reviewer_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  order_id uuid not null unique references orders(id) on delete cascade,
  score int not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

alter table ratings enable row level security;

create policy "Ratings are viewable by everyone"
  on ratings for select using (true);

create policy "Buyers can insert ratings for their delivered orders"
  on ratings for insert with check (auth.uid() = reviewer_id);

-- ─────────────────────────────────────────────
-- STORAGE BUCKETS (run via Supabase dashboard or CLI)
-- ─────────────────────────────────────────────
-- bucket: avatars      (public)
-- bucket: listings     (public)
-- bucket: auctions     (public)
