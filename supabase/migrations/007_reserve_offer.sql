-- Reserve offer: seller can accept highest bid even when reserve was not met
ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS reserve_offer_sent_at   timestamptz,
  ADD COLUMN IF NOT EXISTS reserve_offer_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS reserve_offer_status     text;
  -- reserve_offer_status values: 'pending' | 'accepted' | 'declined' | 'expired'
