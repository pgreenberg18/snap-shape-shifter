
-- Add character_details column for structured character data (emotion, expressions, behavior)
ALTER TABLE public.parsed_scenes
ADD COLUMN IF NOT EXISTS character_details jsonb DEFAULT '[]'::jsonb;

-- Add cinematic_elements column for camera, motion, shot suggestions
ALTER TABLE public.parsed_scenes
ADD COLUMN IF NOT EXISTS cinematic_elements jsonb DEFAULT '{}'::jsonb;
