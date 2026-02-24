
-- Create film_assets table for asset audition system
CREATE TABLE public.film_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('location','prop','wardrobe','vehicle')),
  asset_name TEXT NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  option_index INTEGER NOT NULL,
  description TEXT,
  image_url TEXT,
  locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_film_assets_film_id ON public.film_assets(film_id);
CREATE INDEX idx_film_assets_asset_type ON public.film_assets(asset_type);
CREATE INDEX idx_film_assets_character_id ON public.film_assets(character_id);

-- Enable RLS
ALTER TABLE public.film_assets ENABLE ROW LEVEL SECURITY;

-- Permissive policies for development
CREATE POLICY "Allow all select on film_assets" ON public.film_assets FOR SELECT USING (true);
CREATE POLICY "Allow all insert on film_assets" ON public.film_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on film_assets" ON public.film_assets FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on film_assets" ON public.film_assets FOR DELETE USING (true);

-- Storage bucket for film assets
INSERT INTO storage.buckets (id, name, public) VALUES ('film-assets', 'film-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read film-assets" ON storage.objects FOR SELECT USING (bucket_id = 'film-assets');
CREATE POLICY "Allow upload film-assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'film-assets');
CREATE POLICY "Allow update film-assets" ON storage.objects FOR UPDATE USING (bucket_id = 'film-assets');
CREATE POLICY "Allow delete film-assets" ON storage.objects FOR DELETE USING (bucket_id = 'film-assets');
