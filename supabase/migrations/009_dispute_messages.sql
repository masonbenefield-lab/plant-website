CREATE TABLE IF NOT EXISTS order_dispute_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid REFERENCES order_disputes(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  images text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_dispute_messages ENABLE ROW LEVEL SECURITY;

-- Both parties in the dispute can read messages
CREATE POLICY "parties can read messages" ON order_dispute_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM order_disputes d
      WHERE d.id = dispute_id
        AND (d.buyer_id = auth.uid() OR d.seller_id = auth.uid())
    )
  );

-- Either party can send a message (while dispute is open)
CREATE POLICY "parties can send messages" ON order_dispute_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM order_disputes d
      WHERE d.id = dispute_id
        AND (d.buyer_id = auth.uid() OR d.seller_id = auth.uid())
        AND d.status NOT IN ('resolved', 'escalated')
    )
  );

-- Track last_replied_at and last_replied_by_role on order_disputes for timeout logic
ALTER TABLE order_disputes ADD COLUMN IF NOT EXISTS last_replied_at timestamptz;
ALTER TABLE order_disputes ADD COLUMN IF NOT EXISTS last_replied_by_role text; -- 'buyer' or 'seller'
