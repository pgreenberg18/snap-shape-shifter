
-- Add approval persistence columns to script_analyses
ALTER TABLE public.script_analyses
  ADD COLUMN IF NOT EXISTS visual_summary_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ratings_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_notes_approved boolean NOT NULL DEFAULT false;
