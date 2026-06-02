-- Tracks USPS postage-due adjustments billed back by Shippo
-- Populated by the /api/shippo/webhook route when Shippo fires a postage adjustment event

CREATE TABLE IF NOT EXISTS shipping_adjustments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              uuid REFERENCES orders(id) ON DELETE SET NULL,
  seller_id             uuid REFERENCES profiles(id) ON DELETE SET NULL,
  shippo_transaction_id text,
  original_weight_oz    numeric,
  billed_weight_oz      numeric,
  adjustment_cents      integer NOT NULL,
  shippo_event_id       text UNIQUE, -- idempotency key; prevents duplicate processing
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipping_adjustments_seller_id_idx ON shipping_adjustments(seller_id);
CREATE INDEX IF NOT EXISTS shipping_adjustments_order_id_idx  ON shipping_adjustments(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE shipping_adjustments TO authenticated;
GRANT SELECT ON TABLE shipping_adjustments TO anon;
