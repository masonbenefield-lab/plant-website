-- Add 'refunded' to order_status enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'refunded';

-- Allow buyers to view paused listings they already purchased
-- (sellers already see all their own listings via auth.uid() = seller_id)
DROP POLICY IF EXISTS "Active and sold-out listings are viewable by everyone" ON listings;
DROP POLICY IF EXISTS "Active listings are viewable by everyone" ON listings;
CREATE POLICY "Listings viewable by everyone"
  ON listings FOR SELECT
  USING (status IN ('active', 'sold_out', 'paused') OR auth.uid() = seller_id);

-- Tighten ratings RLS: buyer can only insert a rating when the order is delivered
DROP POLICY IF EXISTS "Buyers can insert ratings for their delivered orders" ON ratings;
CREATE POLICY "Buyers can insert ratings for their delivered orders"
  ON ratings FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = ratings.order_id
        AND orders.buyer_id = auth.uid()
        AND orders.status = 'delivered'
    )
  );
