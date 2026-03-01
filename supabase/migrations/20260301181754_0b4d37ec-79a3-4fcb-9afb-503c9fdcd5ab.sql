
ALTER TABLE public.script_analyses
  ADD COLUMN format_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN time_period_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN genre_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN global_elements_approved boolean NOT NULL DEFAULT false;
