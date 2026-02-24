
-- Create parsed_scenes table
CREATE TABLE public.parsed_scenes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id uuid NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  scene_number integer NOT NULL,
  heading text NOT NULL,
  raw_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_parsed_scenes_film_id ON public.parsed_scenes(film_id);
CREATE INDEX idx_parsed_scenes_scene_number ON public.parsed_scenes(film_id, scene_number);

ALTER TABLE public.parsed_scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on parsed_scenes" ON public.parsed_scenes FOR SELECT USING (true);
CREATE POLICY "Allow all insert on parsed_scenes" ON public.parsed_scenes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on parsed_scenes" ON public.parsed_scenes FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on parsed_scenes" ON public.parsed_scenes FOR DELETE USING (true);

-- Create parse_jobs table
CREATE TABLE public.parse_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id uuid NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  analysis_id uuid REFERENCES public.script_analyses(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  scene_count integer DEFAULT 0,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_parse_jobs_film_id ON public.parse_jobs(film_id);

ALTER TABLE public.parse_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on parse_jobs" ON public.parse_jobs FOR SELECT USING (true);
CREATE POLICY "Allow all insert on parse_jobs" ON public.parse_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on parse_jobs" ON public.parse_jobs FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on parse_jobs" ON public.parse_jobs FOR DELETE USING (true);
