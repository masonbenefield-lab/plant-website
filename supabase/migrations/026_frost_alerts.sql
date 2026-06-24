-- Frost alerts: a ZIP (geocoded to lat/lng once on save) + an opt-in flag.
-- A daily cron checks the overnight low for that point and pushes a warning.
alter table profiles add column if not exists postal_code text;
alter table profiles add column if not exists lat double precision;
alter table profiles add column if not exists lng double precision;
alter table profiles add column if not exists frost_alerts boolean not null default true;
