
-- Add columns to persist content safety analysis results
ALTER TABLE public.content_safety
ADD COLUMN IF NOT EXISTS suggested_rating text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rating_justification text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS flags jsonb DEFAULT '[]'::jsonb;
