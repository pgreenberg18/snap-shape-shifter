
-- Create production_bibles table to store generated Production Bible documents
CREATE TABLE public.production_bibles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(film_id)
);

-- Enable RLS
ALTER TABLE public.production_bibles ENABLE ROW LEVEL SECURITY;

-- RLS policy using existing user_owns_film function
CREATE POLICY "Users can access own production_bibles"
ON public.production_bibles
FOR ALL
USING (user_owns_film(film_id))
WITH CHECK (user_owns_film(film_id));
