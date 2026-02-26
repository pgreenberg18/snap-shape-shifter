
-- Store director selection/blend per film
CREATE TABLE public.film_director_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  primary_director_id TEXT NOT NULL,
  primary_director_name TEXT NOT NULL,
  secondary_director_id TEXT,
  secondary_director_name TEXT,
  blend_weight NUMERIC DEFAULT 1.0,
  computed_vector JSONB NOT NULL DEFAULT '{}',
  quadrant TEXT,
  cluster TEXT,
  emotional_depth TEXT,
  auto_matched BOOLEAN DEFAULT false,
  match_distance NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(film_id)
);

ALTER TABLE public.film_director_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view director profiles for their films"
  ON public.film_director_profiles FOR SELECT
  USING (public.user_owns_film(film_id));

CREATE POLICY "Users can insert director profiles for their films"
  ON public.film_director_profiles FOR INSERT
  WITH CHECK (public.user_owns_film(film_id));

CREATE POLICY "Users can update director profiles for their films"
  ON public.film_director_profiles FOR UPDATE
  USING (public.user_owns_film(film_id));

CREATE POLICY "Users can delete director profiles for their films"
  ON public.film_director_profiles FOR DELETE
  USING (public.user_owns_film(film_id));
