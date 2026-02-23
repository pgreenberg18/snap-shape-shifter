CREATE POLICY "Users can update scripts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'scripts' AND auth.uid() IS NOT NULL)
WITH CHECK (bucket_id = 'scripts' AND auth.uid() IS NOT NULL);