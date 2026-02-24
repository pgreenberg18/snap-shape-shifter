
-- Function to atomically increment scenes_enriched on parse_jobs
CREATE OR REPLACE FUNCTION public.increment_scenes_enriched(p_analysis_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE parse_jobs
  SET scenes_enriched = scenes_enriched + 1,
      updated_at = now()
  WHERE analysis_id = p_analysis_id;
$$;
