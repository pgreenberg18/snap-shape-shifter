
-- 1. Drop the overly permissive wardrobe_scene_assignments policy
DROP POLICY IF EXISTS "Allow all access to wardrobe_scene_assignments" ON public.wardrobe_scene_assignments;

-- 2. Add input validation to log_credit_usage function
CREATE OR REPLACE FUNCTION public.log_credit_usage(
  p_user_id UUID,
  p_film_id UUID,
  p_service_name TEXT,
  p_service_category TEXT,
  p_operation TEXT,
  p_credits NUMERIC DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate credits range
  IF p_credits <= 0 OR p_credits > 1000 THEN
    RAISE EXCEPTION 'Invalid credit amount: %', p_credits;
  END IF;

  -- Validate required fields
  IF p_service_name IS NULL OR p_service_name = '' THEN
    RAISE EXCEPTION 'service_name is required';
  END IF;

  IF p_operation IS NULL OR p_operation = '' THEN
    RAISE EXCEPTION 'operation is required';
  END IF;

  INSERT INTO public.credit_usage_logs (
    user_id, film_id, service_name, service_category, operation, credits_used
  )
  VALUES (
    p_user_id, p_film_id, p_service_name, p_service_category, p_operation, p_credits
  );
END;
$$;

-- 3. Tighten storage RLS: Drop overly permissive policies and add user-scoped ones

-- character-assets: drop broad policy, add scoped one
DROP POLICY IF EXISTS "Authenticated users can read character-assets" ON storage.objects;
CREATE POLICY "Users can read own character assets"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'character-assets'
  AND (
    (string_to_array(name, '/'))[1]::text IN (
      SELECT f.id::text FROM films f
      JOIN projects p ON f.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
    OR (string_to_array(name, '/'))[1]::text IN (
      SELECT f.id::text FROM films f
      JOIN projects p ON f.project_id = p.id
      JOIN user_access_controls uac ON p.id = ANY(uac.allowed_project_ids)
      WHERE uac.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  )
);

-- film-assets: drop broad policy, add scoped one
DROP POLICY IF EXISTS "Authenticated users can read film-assets" ON storage.objects;
CREATE POLICY "Users can read own film assets"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'film-assets'
  AND (
    (string_to_array(name, '/'))[1]::text IN (
      SELECT f.id::text FROM films f
      JOIN projects p ON f.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
    OR (string_to_array(name, '/'))[1]::text IN (
      SELECT f.id::text FROM films f
      JOIN projects p ON f.project_id = p.id
      JOIN user_access_controls uac ON p.id = ANY(uac.allowed_project_ids)
      WHERE uac.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  )
);

-- generation-outputs: drop broad policy, add scoped one
DROP POLICY IF EXISTS "Authenticated users can read generation-outputs" ON storage.objects;
CREATE POLICY "Users can read own generation outputs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'generation-outputs'
  AND (
    (string_to_array(name, '/'))[1]::text IN (
      SELECT f.id::text FROM films f
      JOIN projects p ON f.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
    OR (string_to_array(name, '/'))[1]::text IN (
      SELECT f.id::text FROM films f
      JOIN projects p ON f.project_id = p.id
      JOIN user_access_controls uac ON p.id = ANY(uac.allowed_project_ids)
      WHERE uac.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  )
);

-- voice-samples: add scoped policy
DROP POLICY IF EXISTS "Authenticated users can read voice-samples" ON storage.objects;
CREATE POLICY "Users can read own voice samples"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'voice-samples'
  AND (
    (string_to_array(name, '/'))[1]::text IN (
      SELECT f.id::text FROM films f
      JOIN projects p ON f.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
    OR (string_to_array(name, '/'))[1]::text IN (
      SELECT f.id::text FROM films f
      JOIN projects p ON f.project_id = p.id
      JOIN user_access_controls uac ON p.id = ANY(uac.allowed_project_ids)
      WHERE uac.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  )
);

-- scripts: tighten existing policy
DROP POLICY IF EXISTS "Authenticated users can read scripts" ON storage.objects;
CREATE POLICY "Users can read own scripts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'scripts'
  AND (
    (string_to_array(name, '/'))[1]::text IN (
      SELECT f.id::text FROM films f
      JOIN projects p ON f.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
    OR (string_to_array(name, '/'))[1]::text IN (
      SELECT f.id::text FROM films f
      JOIN projects p ON f.project_id = p.id
      JOIN user_access_controls uac ON p.id = ANY(uac.allowed_project_ids)
      WHERE uac.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  )
);
