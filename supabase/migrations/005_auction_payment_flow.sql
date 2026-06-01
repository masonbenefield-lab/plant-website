-- ─── Auction status: scheduled ───────────────────────────────────────────────
ALTER TYPE auction_status ADD VALUE IF NOT EXISTS 'scheduled';

-- ─── Order statuses: expired + offered_down ───────────────────────────────────
-- 'expired'      = winner did not pay within the deadline
-- 'offered_down' = original expired order; a second-bidder offer is now active
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'offered_down';

-- ─── Orders: payment deadline tracking ───────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_deadline_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reminder_sent boolean NOT NULL DEFAULT false;

-- ─── Auctions: catch-up columns (exist in production, missing from migrations) ─
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS reserve_price_cents int;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS buy_now_price_cents int;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS bid_count int NOT NULL DEFAULT 0;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS starts_at timestamptz;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS category text;
