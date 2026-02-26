-- Add visual_design JSONB column to parsed_scenes for per-scene visual design data
-- (palette, lighting_style, visual_references, atmosphere)
ALTER TABLE public.parsed_scenes ADD COLUMN IF NOT EXISTS visual_design JSONB DEFAULT NULL;