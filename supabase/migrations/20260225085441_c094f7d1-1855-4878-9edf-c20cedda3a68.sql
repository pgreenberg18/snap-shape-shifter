
-- The master creative contract for the entire film — compiled from Development data
CREATE TABLE public.film_style_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,

  -- Core visual identity (from visual_summary + signature_style)
  visual_dna TEXT,

  -- Structured color direction (from global_elements.visual_design.color_palette)
  color_mandate JSONB DEFAULT '{}'::jsonb,

  -- Lighting philosophy (from global_elements.visual_design.lighting_language)
  lighting_doctrine JSONB DEFAULT '{}'::jsonb,

  -- Lens and camera defaults (from ai_generation_notes)
  lens_philosophy JSONB DEFAULT '{}'::jsonb,

  -- Film texture and grain (derived from genre + time_period)
  texture_mandate JSONB DEFAULT '{}'::jsonb,

  -- Temporal anachronism rules (from time_period)
  temporal_rules JSONB DEFAULT '{}'::jsonb,

  -- Content safety guardrails (from content_safety + rating)
  content_guardrails JSONB DEFAULT '{}'::jsonb,

  -- Genre-derived visual profile (blended from genres[])
  genre_visual_profile JSONB DEFAULT '{}'::jsonb,

  -- Free-form director notes / world rules
  world_rules TEXT,

  -- Pre-compiled negative prompt base (union of all restrictions)
  negative_prompt_base TEXT,

  -- Character archetype visual directives (per-character portrait direction)
  character_directives JSONB DEFAULT '{}'::jsonb,

  -- Source data fingerprint (to detect when re-compilation is needed)
  source_hash TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(film_id)
);

-- Per-scene style overrides (auto-populated from enrichment data)
CREATE TABLE public.scene_style_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,

  -- From parsed_scenes.mood
  mood_override TEXT,

  -- From cinematic_elements
  lighting_override TEXT,

  -- Color temperature shift based on day/night + mood
  color_shift JSONB DEFAULT '{}'::jsonb,

  -- From environment_details
  environment_texture TEXT,

  -- Mapped from day_night → color temperature preset
  time_of_day_grade TEXT,

  -- From cinematic_elements.camera_feel
  camera_feel TEXT,

  -- Scene-specific negative prompt additions
  custom_negative TEXT,

  -- From cinematic_elements.shot_suggestions
  shot_suggestions JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(film_id, scene_number)
);

-- Enable RLS
ALTER TABLE public.film_style_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scene_style_overrides ENABLE ROW LEVEL SECURITY;

-- Permissive policies (matching current pattern)
CREATE POLICY "Allow all select on film_style_contracts" ON public.film_style_contracts FOR SELECT USING (true);
CREATE POLICY "Allow all insert on film_style_contracts" ON public.film_style_contracts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on film_style_contracts" ON public.film_style_contracts FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on film_style_contracts" ON public.film_style_contracts FOR DELETE USING (true);

CREATE POLICY "Allow all select on scene_style_overrides" ON public.scene_style_overrides FOR SELECT USING (true);
CREATE POLICY "Allow all insert on scene_style_overrides" ON public.scene_style_overrides FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on scene_style_overrides" ON public.scene_style_overrides FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on scene_style_overrides" ON public.scene_style_overrides FOR DELETE USING (true);

-- Index for fast lookups
CREATE INDEX idx_film_style_contracts_film_id ON public.film_style_contracts(film_id);
CREATE INDEX idx_scene_style_overrides_film_scene ON public.scene_style_overrides(film_id, scene_number);
