
CREATE TABLE public.production_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('lights', 'camera')),
  name TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.production_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on production_presets" ON public.production_presets FOR SELECT USING (true);
CREATE POLICY "Allow all insert on production_presets" ON public.production_presets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on production_presets" ON public.production_presets FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on production_presets" ON public.production_presets FOR DELETE USING (true);
