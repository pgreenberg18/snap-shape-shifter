
-- Films table
CREATE TABLE public.films (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0,
  time_period TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Characters table
CREATE TABLE public.characters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT,
  voice_description TEXT,
  voice_generation_seed INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shots table
CREATE TABLE public.shots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  camera_angle TEXT,
  prompt_text TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Post-production assembly (timeline clips)
CREATE TABLE public.post_production_clips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  track TEXT NOT NULL,
  left_pos NUMERIC NOT NULL DEFAULT 0,
  width NUMERIC NOT NULL DEFAULT 100,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Integrations (BYOK API keys)
CREATE TABLE public.integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name TEXT NOT NULL,
  section_id TEXT NOT NULL,
  api_key_encrypted TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Content safety settings
CREATE TABLE public.content_safety (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  language BOOLEAN NOT NULL DEFAULT false,
  nudity BOOLEAN NOT NULL DEFAULT false,
  violence BOOLEAN NOT NULL DEFAULT false,
  mode TEXT NOT NULL DEFAULT 'auto',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.films ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_production_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_safety ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (no auth for now — single-project app)
CREATE POLICY "Allow all access to films" ON public.films FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to characters" ON public.characters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to shots" ON public.shots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to post_production_clips" ON public.post_production_clips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to integrations" ON public.integrations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to content_safety" ON public.content_safety FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_films_updated_at BEFORE UPDATE ON public.films FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_content_safety_updated_at BEFORE UPDATE ON public.content_safety FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
