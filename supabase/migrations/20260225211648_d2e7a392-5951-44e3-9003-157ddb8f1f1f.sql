
-- 1. Update user_owns_film to also check allowed_project_ids
CREATE OR REPLACE FUNCTION public.user_owns_film(p_film_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.films f
    JOIN public.projects p ON f.project_id = p.id
    WHERE f.id = p_film_id 
    AND (
      p.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_access_controls uac
        WHERE uac.user_id = auth.uid()
        AND p.id = ANY(uac.allowed_project_ids)
      )
    )
  );
$function$;

-- 2. Add SELECT policy on projects for users with allowed_project_ids
CREATE POLICY "Users can read allowed projects"
ON public.projects
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_access_controls uac
    WHERE uac.user_id = auth.uid()
    AND projects.id = ANY(uac.allowed_project_ids)
  )
);

-- 3. Add SELECT policy on films for users who have access to the parent project
CREATE POLICY "Users can read films of allowed projects"
ON public.films
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.user_access_controls uac ON p.id = ANY(uac.allowed_project_ids)
    WHERE p.id = films.project_id
    AND uac.user_id = auth.uid()
  )
);
