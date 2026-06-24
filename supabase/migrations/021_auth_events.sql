-- Hashed-IP auth tracking for fraud linkage. Stores an HMAC of the IP (never the
-- raw address) so accounts sharing an IP can be matched. RLS is enabled with no
-- policies, so the table is reachable only via the service role.

create table if not exists auth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null,
  ip_hash text,
  country text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists auth_events_ip_hash_idx on auth_events(ip_hash);
create index if not exists auth_events_user_id_idx on auth_events(user_id);

alter table auth_events enable row level security;
