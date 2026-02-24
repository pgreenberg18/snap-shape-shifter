
-- Add archive flag to films
ALTER TABLE public.films ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;

-- Create index for efficient filtering
CREATE INDEX idx_films_archived ON public.films(project_id, is_archived);
