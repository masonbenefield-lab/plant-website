-- Distinguish synthetic schedule-anchor "baseline" events from real care logs,
-- so care streaks/stats count only actual care the user performed.
alter table garden_events add column if not exists is_baseline boolean not null default false;
