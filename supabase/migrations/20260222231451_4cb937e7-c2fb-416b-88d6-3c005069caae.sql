
-- Store the AI-generated visual breakdown for uploaded scripts
CREATE TABLE public.script_analyses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'complete', 'error')),
    visual_summary TEXT,
    scene_breakdown JSONB,
    global_elements JSONB,
    ai_generation_notes JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.script_analyses ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read/write their analyses
CREATE POLICY "Authenticated users can view script analyses"
    ON public.script_analyses FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert script analyses"
    ON public.script_analyses FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update script analyses"
    ON public.script_analyses FOR UPDATE
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete script analyses"
    ON public.script_analyses FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- Auto-update timestamp
CREATE TRIGGER update_script_analyses_updated_at
    BEFORE UPDATE ON public.script_analyses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
