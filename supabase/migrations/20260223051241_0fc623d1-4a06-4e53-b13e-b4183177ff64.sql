
-- Create projects table (the "folder" that groups film versions)
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  poster_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (permissive for now, matching existing pattern)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to projects" ON public.projects
  FOR ALL USING (true) WITH CHECK (true);

-- Add version columns to films
ALTER TABLE public.films
  ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD COLUMN version_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN version_name TEXT DEFAULT 'Version 1',
  ADD COLUMN copied_from_version_id UUID REFERENCES public.films(id) ON DELETE SET NULL;

-- Create a default project for the existing Neon Rain film
INSERT INTO public.projects (id, title, description)
VALUES ('00000000-0000-0000-0000-000000000001', 'Neon Rain', 'First project');

-- Link existing film to the project
UPDATE public.films
SET project_id = '00000000-0000-0000-0000-000000000001',
    version_number = 1,
    version_name = 'Version 1'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Add trigger for updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
