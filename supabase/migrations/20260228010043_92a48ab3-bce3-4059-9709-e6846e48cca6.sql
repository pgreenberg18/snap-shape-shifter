
-- Table to store ElevenLabs voice audition samples per character
CREATE TABLE public.character_voice_auditions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  voice_index INTEGER NOT NULL,
  voice_id TEXT NOT NULL,
  voice_name TEXT NOT NULL,
  audio_url TEXT,
  sample_text TEXT,
  selected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.character_voice_auditions ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can access auditions for characters they own
CREATE POLICY "Users can access own voice auditions"
  ON public.character_voice_auditions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM characters c
      WHERE c.id = character_voice_auditions.character_id
      AND user_owns_film(c.film_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM characters c
      WHERE c.id = character_voice_auditions.character_id
      AND user_owns_film(c.film_id)
    )
  );

-- Storage bucket for voice samples
INSERT INTO storage.buckets (id, name, public) VALUES ('voice-samples', 'voice-samples', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for voice samples
CREATE POLICY "Public read voice samples"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-samples');

CREATE POLICY "Auth users upload voice samples"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'voice-samples' AND auth.role() = 'authenticated');

CREATE POLICY "Auth users delete voice samples"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'voice-samples' AND auth.role() = 'authenticated');
