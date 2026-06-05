-- Snooze a single care task without changing the interval
CREATE TABLE care_snoozes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  plant_id      UUID NOT NULL REFERENCES garden_plants(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,   -- 'watered' | 'fertilized' | ... | 'custom:<schedule_id>'
  snoozed_until DATE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plant_id, event_type)   -- one active snooze per plant × care-type
);

-- User-defined recurring care schedules beyond the four built-in types
CREATE TABLE custom_care_schedules (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  plant_id      UUID NOT NULL REFERENCES garden_plants(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  interval_days INTEGER NOT NULL,
  start_date    DATE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
