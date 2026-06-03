-- Snapshot plant name, variety, and cover image at order creation time
-- so buyers can always recall what they purchased even if the listing/auction is later deleted
ALTER TABLE orders ADD COLUMN IF NOT EXISTS item_snapshot jsonb;
-- shape: { plant_name: string, variety: string | null, image: string | null }
