-- One-time care reminders and notes for the Week Ahead schedule
CREATE TABLE IF NOT EXISTS care_reminders (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  plant_id       UUID                 REFERENCES garden_plants(id) ON DELETE SET NULL,
  event_type     TEXT        NOT NULL,
  scheduled_date DATE        NOT NULL,
  notes          TEXT,
  completed      BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE care_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own reminders"
  ON care_reminders FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX care_reminders_user_date_idx
  ON care_reminders (user_id, scheduled_date)
  WHERE completed = FALSE;
