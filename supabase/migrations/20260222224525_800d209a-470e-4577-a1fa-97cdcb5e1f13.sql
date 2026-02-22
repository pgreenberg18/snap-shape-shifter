
-- Create storage bucket for scripts
INSERT INTO storage.buckets (id, name, public) VALUES ('scripts', 'scripts', false);

-- Allow authenticated users to upload scripts
CREATE POLICY "Users can upload scripts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'scripts' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to read their own scripts
CREATE POLICY "Users can read scripts"
ON storage.objects FOR SELECT
USING (bucket_id = 'scripts' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to delete their own scripts
CREATE POLICY "Users can delete scripts"
ON storage.objects FOR DELETE
USING (bucket_id = 'scripts' AND auth.uid() IS NOT NULL);
