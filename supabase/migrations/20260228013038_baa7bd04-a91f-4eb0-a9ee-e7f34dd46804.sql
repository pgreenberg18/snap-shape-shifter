
-- Create wardrobe fitting views table (mirrors character_consistency_views but for wardrobe items)
CREATE TABLE public.wardrobe_fitting_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  asset_name TEXT NOT NULL,
  angle_index INTEGER NOT NULL,
  angle_label TEXT NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(film_id, character_id, asset_name, angle_index)
);

-- Enable RLS
ALTER TABLE public.wardrobe_fitting_views ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can access own wardrobe_fitting_views"
ON public.wardrobe_fitting_views
FOR ALL
USING (user_owns_film(film_id))
WITH CHECK (user_owns_film(film_id));
