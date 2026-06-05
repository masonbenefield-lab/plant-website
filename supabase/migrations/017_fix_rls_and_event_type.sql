-- RLS for care_snoozes (matches care_reminders pattern)
ALTER TABLE care_snoozes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own snoozes"
  ON care_snoozes FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS for custom_care_schedules
ALTER TABLE custom_care_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own custom schedules"
  ON custom_care_schedules FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow custom event types in garden_events (drops CHECK constraint if one exists)
ALTER TABLE garden_events DROP CONSTRAINT IF EXISTS garden_events_event_type_check;
