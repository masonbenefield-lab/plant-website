-- Potting context lives on the plant (My Garden is the source of truth; the care
-- schedule reads from it). 'pot' | 'ground'; pot_size only meaningful when potted.
alter table garden_plants add column if not exists potting text
  check (potting in ('pot', 'ground'));
alter table garden_plants add column if not exists pot_size text;

-- Recreate the AI care-suggestion cache for the new shape: repotting is now
-- nullable (null = in-ground / not applicable) and pruning is free-text advice
-- rather than a fixed interval. The cache key bakes in potting + size.
drop table if exists care_suggestions;
create table care_suggestions (
  query text primary key,           -- "<name>|<potting>|<pot_size>"
  water int not null,
  fertilize int not null,
  repot int,                        -- null = in-ground, no repotting
  prune_advice text,
  confidence text not null default 'medium',
  created_at timestamptz not null default now()
);
alter table care_suggestions enable row level security;
