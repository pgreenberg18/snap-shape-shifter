
-- Tracks which provider is selected for each category within a specific film version
CREATE TABLE public.version_provider_selections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,           -- e.g. 'script-analysis', 'image-generation'
  provider_service_id TEXT NOT NULL,  -- e.g. 'midjourney', 'dall-e', matches SERVICE_CATALOGS keys
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(film_id, section_id)         -- one provider per category per version
);

-- Enable RLS
ALTER TABLE public.version_provider_selections ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to manage selections (no user_id on films table)
CREATE POLICY "Anyone can view version provider selections"
  ON public.version_provider_selections FOR SELECT USING (true);

CREATE POLICY "Anyone can insert version provider selections"
  ON public.version_provider_selections FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update version provider selections"
  ON public.version_provider_selections FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete version provider selections"
  ON public.version_provider_selections FOR DELETE USING (true);

-- Auto-update timestamp
CREATE TRIGGER update_version_provider_selections_updated_at
  BEFORE UPDATE ON public.version_provider_selections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
