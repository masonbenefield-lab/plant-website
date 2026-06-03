-- Box dimensions for weight-based shipping rate calculation
ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS box_length_in numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS box_width_in  numeric DEFAULT 8,
  ADD COLUMN IF NOT EXISTS box_height_in numeric DEFAULT 4;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS box_length_in numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS box_width_in  numeric DEFAULT 8,
  ADD COLUMN IF NOT EXISTS box_height_in numeric DEFAULT 4;

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS box_length_in numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS box_width_in  numeric DEFAULT 8,
  ADD COLUMN IF NOT EXISTS box_height_in numeric DEFAULT 4;
