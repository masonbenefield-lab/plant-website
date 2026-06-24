-- Store each user's IANA timezone (e.g. "America/Chicago") so the server can
-- compute "today" in the user's zone instead of UTC. Captured client-side.
alter table profiles add column if not exists timezone text;
