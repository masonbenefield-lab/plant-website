-- Package type for weight-based shipping (box, padded_envelope, poly_mailer)
ALTER TABLE auctions  ADD COLUMN IF NOT EXISTS package_type text DEFAULT 'box';
ALTER TABLE listings  ADD COLUMN IF NOT EXISTS package_type text DEFAULT 'box';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS package_type text DEFAULT 'box';
