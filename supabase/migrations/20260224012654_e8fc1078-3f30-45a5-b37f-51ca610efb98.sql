-- Create table for persisting audition headshot cards
CREATE TABLE public.character_auditions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  card_index INTEGER NOT NULL,
  section TEXT NOT NULL, -- 'archetype', 'wildcard', 'novel'
  label TEXT NOT NULL,
  image_url TEXT,
  locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one card per character per index
ALTER TABLE public.character_auditions ADD CONSTRAINT unique_char_card UNIQUE (character_id, card_index);

-- Enable RLS (permissive for dev)
ALTER TABLE public.character_auditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to character_auditions" ON public.character_auditions
  FOR ALL USING (true) WITH CHECK (true);