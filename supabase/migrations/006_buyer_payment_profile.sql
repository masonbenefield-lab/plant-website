-- Buyer payment profile
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_payment_method_id text;

-- Shipping rate pre-selection per auction (weight-based shipping)
CREATE TABLE IF NOT EXISTS auction_shipping_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid REFERENCES auctions(id) ON DELETE CASCADE NOT NULL,
  bidder_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rate_id text,
  service text,
  carrier text,
  cost_cents integer NOT NULL DEFAULT 0,
  estimated_days integer,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(auction_id, bidder_id)
);

ALTER TABLE auction_shipping_selections ENABLE ROW LEVEL SECURITY;

-- Bidders can manage their own selections
CREATE POLICY "bidder manages own shipping selection"
  ON auction_shipping_selections FOR ALL
  USING (auth.uid() = bidder_id)
  WITH CHECK (auth.uid() = bidder_id);

-- Sellers can read selections for their auctions (for order fulfillment)
CREATE POLICY "seller reads shipping selections for own auctions"
  ON auction_shipping_selections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auctions a WHERE a.id = auction_id AND a.seller_id = auth.uid()
    )
  );
