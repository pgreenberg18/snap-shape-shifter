-- Create storage bucket for generation outputs (anchor frames + video clips)
INSERT INTO storage.buckets (id, name, public)
VALUES ('generation-outputs', 'generation-outputs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to generation outputs
CREATE POLICY "Generation outputs are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'generation-outputs');

-- Allow service role to upload (edge functions use service role key)
CREATE POLICY "Service role can upload generation outputs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'generation-outputs');

CREATE POLICY "Service role can update generation outputs"
ON storage.objects FOR UPDATE
USING (bucket_id = 'generation-outputs');
