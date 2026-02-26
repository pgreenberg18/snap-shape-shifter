
ALTER TABLE public.film_director_profiles
ADD COLUMN visual_mandate JSONB DEFAULT NULL;

COMMENT ON COLUMN public.film_director_profiles.visual_mandate IS 'Stores the matched director visual mandate (lighting, lens, texture, color, negativeHints) for use by the style contract compiler';
