
-- Add missing breakdown category columns to parsed_scenes
ALTER TABLE public.parsed_scenes
  ADD COLUMN IF NOT EXISTS stunts text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sfx text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vfx text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sound_cues text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS animals text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS extras text DEFAULT '',
  ADD COLUMN IF NOT EXISTS special_makeup text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mood text DEFAULT '',
  ADD COLUMN IF NOT EXISTS int_ext text DEFAULT '',
  ADD COLUMN IF NOT EXISTS day_night text DEFAULT '',
  ADD COLUMN IF NOT EXISTS location_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS estimated_page_count numeric DEFAULT 0;
