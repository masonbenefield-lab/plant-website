-- Vacation / pause mode for care schedules
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS vacation_start      DATE,
  ADD COLUMN IF NOT EXISTS vacation_end        DATE,
  ADD COLUMN IF NOT EXISTS schedule_pause_offset INTEGER NOT NULL DEFAULT 0;

-- Sitter guide share token (random UUID per user for public sitter-guide URL)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sitter_token UUID NOT NULL DEFAULT gen_random_uuid();
