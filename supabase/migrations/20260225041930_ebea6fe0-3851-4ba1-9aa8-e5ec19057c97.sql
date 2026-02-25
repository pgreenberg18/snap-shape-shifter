
-- Add format fields to films table
ALTER TABLE public.films
  ADD COLUMN IF NOT EXISTS format_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS frame_width integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS frame_height integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS frame_rate numeric DEFAULT NULL;
