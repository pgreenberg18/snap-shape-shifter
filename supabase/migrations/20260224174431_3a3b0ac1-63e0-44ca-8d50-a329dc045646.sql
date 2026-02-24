
-- Allow anyone to upload to the scripts bucket
CREATE POLICY "Allow all uploads to scripts"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'scripts');

-- Allow anyone to read from the scripts bucket
CREATE POLICY "Allow all reads from scripts"
ON storage.objects
FOR SELECT
USING (bucket_id = 'scripts');

-- Allow anyone to update in the scripts bucket
CREATE POLICY "Allow all updates to scripts"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'scripts');

-- Allow anyone to delete from the scripts bucket
CREATE POLICY "Allow all deletes from scripts"
ON storage.objects
FOR DELETE
USING (bucket_id = 'scripts');
