-- Cache of AI-generated care intervals keyed by normalized plant name, so the
-- same plant is only ever sent to Claude once. Mirrors the plant_descriptions
-- cache used by the plant guide. RLS on with no policies = service-role only.

create table if not exists care_suggestions (
  query text primary key,
  water int not null,
  fertilize int not null,
  prune int not null,
  repot int not null,
  confidence text not null default 'medium',
  created_at timestamptz not null default now()
);

alter table care_suggestions enable row level security;
