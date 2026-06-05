ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storefront_previewed boolean NOT NULL DEFAULT false;
