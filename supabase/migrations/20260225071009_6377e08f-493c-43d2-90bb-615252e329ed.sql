
-- Per-scene wardrobe assignments: allows overriding which wardrobe items appear in which scenes
CREATE TABLE public.wardrobe_scene_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  character_name TEXT NOT NULL,
  clothing_item TEXT NOT NULL,
  scene_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(film_id, character_name, clothing_item, scene_number)
);

-- Enable RLS
ALTER TABLE public.wardrobe_scene_assignments ENABLE ROW LEVEL SECURITY;

-- Public read/write for now (no auth required based on existing app patterns)
CREATE POLICY "Allow all access to wardrobe_scene_assignments"
  ON public.wardrobe_scene_assignments
  FOR ALL
  USING (true)
  WITH CHECK (true);
