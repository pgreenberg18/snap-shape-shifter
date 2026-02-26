-- Make the character-assets bucket public so headshot URLs resolve
UPDATE storage.buckets SET public = true WHERE id = 'character-assets';