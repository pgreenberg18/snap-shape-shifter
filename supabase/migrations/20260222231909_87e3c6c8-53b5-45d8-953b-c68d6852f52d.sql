
-- Global Identity Registry: tracks swappable assets (actors, props, locations)
CREATE TABLE public.asset_identity_registry (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('actor', 'prop', 'location')),
    internal_ref_code TEXT NOT NULL,
    display_name TEXT NOT NULL,
    reference_image_url TEXT,
    description TEXT,
    is_dirty BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_identity_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view asset registry" ON public.asset_identity_registry FOR SELECT USING (true);
CREATE POLICY "Anyone can insert asset registry" ON public.asset_identity_registry FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update asset registry" ON public.asset_identity_registry FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete asset registry" ON public.asset_identity_registry FOR DELETE USING (true);

CREATE TRIGGER update_asset_identity_registry_updated_at
    BEFORE UPDATE ON public.asset_identity_registry
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- AI Generation Templates: tokenized prompts per shot
CREATE TABLE public.ai_generation_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    shot_id UUID NOT NULL REFERENCES public.shots(id) ON DELETE CASCADE,
    image_prompt_base TEXT,
    video_prompt_base TEXT,
    camera_language TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_generation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ai gen templates" ON public.ai_generation_templates FOR SELECT USING (true);
CREATE POLICY "Anyone can insert ai gen templates" ON public.ai_generation_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update ai gen templates" ON public.ai_generation_templates FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete ai gen templates" ON public.ai_generation_templates FOR DELETE USING (true);

CREATE TRIGGER update_ai_generation_templates_updated_at
    BEFORE UPDATE ON public.ai_generation_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add unique constraint for ref codes per film
CREATE UNIQUE INDEX idx_asset_registry_ref_code ON public.asset_identity_registry (film_id, internal_ref_code);
