
-- Add enrichment columns to parsed_scenes
ALTER TABLE public.parsed_scenes
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS characters text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS key_objects text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS wardrobe jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS picture_vehicles text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS enriched boolean NOT NULL DEFAULT false;

-- Add enrichment tracking to parse_jobs
ALTER TABLE public.parse_jobs
  ADD COLUMN IF NOT EXISTS scenes_enriched integer NOT NULL DEFAULT 0;
