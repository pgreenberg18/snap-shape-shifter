
-- Table to store 8 consistency views per character (multi-angle turnaround)
CREATE TABLE public.character_consistency_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  angle_index INTEGER NOT NULL CHECK (angle_index >= 0 AND angle_index <= 7),
  angle_label TEXT NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(character_id, angle_index)
);

-- Enable RLS
ALTER TABLE public.character_consistency_views ENABLE ROW LEVEL SECURITY;

-- User-scoped RLS policy (cascading via character → film → project)
CREATE POLICY "Users can access own consistency views" ON public.character_consistency_views
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_consistency_views.character_id
      AND public.user_owns_film(c.film_id)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_consistency_views.character_id
      AND public.user_owns_film(c.film_id)
    )
  );

CREATE INDEX idx_consistency_views_character ON public.character_consistency_views(character_id);
