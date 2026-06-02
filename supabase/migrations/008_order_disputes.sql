-- Order disputes: buyer files against an order, seller responds, buyer can escalate
CREATE TABLE IF NOT EXISTS order_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  buyer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  seller_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reason text NOT NULL,
  details text,
  seller_response text,
  status text NOT NULL DEFAULT 'seller_notified',
  -- seller_notified → seller responded or left alone → buyer escalates → resolved
  created_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  escalated_at timestamptz,
  resolved_at timestamptz,
  UNIQUE(order_id)
);

ALTER TABLE order_disputes ENABLE ROW LEVEL SECURITY;

-- Buyer can insert (file a dispute on their own order)
CREATE POLICY "buyer can file dispute" ON order_disputes
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

-- Both parties can read disputes they're part of
CREATE POLICY "parties can read dispute" ON order_disputes
  FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- Seller can update seller_response + responded_at + status (to resolved)
CREATE POLICY "seller can respond" ON order_disputes
  FOR UPDATE USING (seller_id = auth.uid());

-- Buyer can update status to escalated
CREATE POLICY "buyer can escalate" ON order_disputes
  FOR UPDATE USING (buyer_id = auth.uid());
