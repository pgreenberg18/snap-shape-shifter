-- Add approved column for casting approval checkboxes
ALTER TABLE public.characters
ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;

-- Add reference_image_url for user-uploaded reference images
ALTER TABLE public.characters
ADD COLUMN IF NOT EXISTS reference_image_url text;