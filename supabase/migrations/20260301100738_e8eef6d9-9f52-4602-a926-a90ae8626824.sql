
-- ═══════════════════════════════════════════════════════════════
-- PHASE 1: Screenplay Entity Registry
-- Two-Phase Screenplay Intelligence System
-- ═══════════════════════════════════════════════════════════════

-- Master entity registry: canonical names, aliases, typed metadata
CREATE TABLE public.script_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,  -- CHARACTER, LOCATION, VEHICLE, PROP, WARDROBE, ANIMAL, PRACTICAL_LIGHT_SOURCE, SOUND_EVENT, ENVIRONMENTAL_CONDITION, DOCUMENT, WEAPON, DEVICE, FOOD_OR_DRINK
  canonical_name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  first_appearance_scene INTEGER,
  
  -- Type-specific metadata (JSONB for flexibility per entity_type)
  -- CHARACTER: { sex, age_range, build, height }
  -- LOCATION: { sublocations: string[], parent_location_id: uuid }
  -- VEHICLE: { associated_character_id: uuid }
  -- PROP: { associated_character_id: uuid, associated_location_id: uuid }
  -- WARDROBE: { character_id: uuid, description, state }
  metadata JSONB NOT NULL DEFAULT '{}',
  
  -- Normalization confidence
  confidence NUMERIC NOT NULL DEFAULT 1.0,  -- 0-1, lower = needs review
  needs_review BOOLEAN NOT NULL DEFAULT false,
  review_note TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent duplicate canonical names per film+type
  UNIQUE(film_id, entity_type, canonical_name)
);

-- Validation trigger for entity_type
CREATE OR REPLACE FUNCTION public.validate_entity_type()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entity_type NOT IN (
    'CHARACTER', 'LOCATION', 'VEHICLE', 'PROP', 'WARDROBE', 'ANIMAL',
    'PRACTICAL_LIGHT_SOURCE', 'SOUND_EVENT', 'ENVIRONMENTAL_CONDITION',
    'DOCUMENT', 'WEAPON', 'DEVICE', 'FOOD_OR_DRINK'
  ) THEN
    RAISE EXCEPTION 'Invalid entity_type: %', NEW.entity_type;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_script_entity_type
  BEFORE INSERT OR UPDATE ON public.script_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_entity_type();

-- Per-scene entity associations with contextual data
CREATE TABLE public.scene_entity_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scene_id UUID NOT NULL REFERENCES public.parsed_scenes(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES public.script_entities(id) ON DELETE CASCADE,
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  
  -- Scene-specific context for this entity appearance
  -- CHARACTER: { emotional_tone, key_expressions, physical_behavior, dialogue_lines, dialogue_word_count }
  -- WARDROBE: { state: "clean"|"torn"|"bloody", description_override }
  -- PROP: { action: "held"|"placed"|"thrown" }
  context JSONB NOT NULL DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Each entity appears at most once per scene
  UNIQUE(scene_id, entity_id)
);

-- Scene structural flags (extracted deterministically from headings/text)
-- These belong to Phase 1 and are immutable after vision lock
ALTER TABLE public.parsed_scenes 
  ADD COLUMN IF NOT EXISTS sublocation TEXT,
  ADD COLUMN IF NOT EXISTS continuity_marker TEXT,  -- CONTINUOUS, LATER, SAME TIME, MOMENTS LATER, etc.
  ADD COLUMN IF NOT EXISTS is_flashback BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_dream BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_montage BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dialogue_density NUMERIC,  -- ratio 0-1
  ADD COLUMN IF NOT EXISTS dialogue_line_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dialogue_word_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phase1_locked BOOLEAN NOT NULL DEFAULT false;  -- immutable after lock

-- Indexes for performance
CREATE INDEX idx_script_entities_film ON public.script_entities(film_id);
CREATE INDEX idx_script_entities_type ON public.script_entities(film_id, entity_type);
CREATE INDEX idx_scene_entity_links_scene ON public.scene_entity_links(scene_id);
CREATE INDEX idx_scene_entity_links_entity ON public.scene_entity_links(entity_id);
CREATE INDEX idx_scene_entity_links_film ON public.scene_entity_links(film_id);

-- Enable RLS
ALTER TABLE public.script_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scene_entity_links ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can access own script_entities"
  ON public.script_entities FOR ALL
  USING (user_owns_film(film_id))
  WITH CHECK (user_owns_film(film_id));

CREATE POLICY "Users can access own scene_entity_links"
  ON public.scene_entity_links FOR ALL
  USING (user_owns_film(film_id))
  WITH CHECK (user_owns_film(film_id));

-- Updated_at trigger for script_entities
CREATE TRIGGER update_script_entities_updated_at
  BEFORE UPDATE ON public.script_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
