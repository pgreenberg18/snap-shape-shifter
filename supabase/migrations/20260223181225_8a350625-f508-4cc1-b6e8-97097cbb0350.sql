
-- Add character metadata columns for auditions
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sex text DEFAULT 'Unknown',
  ADD COLUMN IF NOT EXISTS age_min integer,
  ADD COLUMN IF NOT EXISTS age_max integer,
  ADD COLUMN IF NOT EXISTS is_child boolean DEFAULT false;

-- Create storage bucket for character headshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('character-assets', 'character-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to character assets
CREATE POLICY "Character assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'character-assets');

-- Allow authenticated users to upload character assets
CREATE POLICY "Authenticated users can upload character assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'character-assets');

-- Allow authenticated users to update character assets
CREATE POLICY "Authenticated users can update character assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'character-assets');

-- Allow authenticated users to delete character assets
CREATE POLICY "Authenticated users can delete character assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'character-assets');
