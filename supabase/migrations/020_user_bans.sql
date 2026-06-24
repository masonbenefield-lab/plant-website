-- Admin ban/unban: a nullable timestamp marking a profile as banned.
-- The actual login block is enforced at the Supabase Auth layer (ban_duration);
-- this column mirrors the state for display, the admin Banned tab, and audit.

alter table profiles add column if not exists banned_at timestamptz;
