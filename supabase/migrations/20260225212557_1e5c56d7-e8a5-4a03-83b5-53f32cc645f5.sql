
-- Fix activity_logs INSERT policy - was restrictive, recreate as permissive
DROP POLICY IF EXISTS "Users can insert their own activity" ON public.activity_logs;

CREATE POLICY "Users can insert their own activity"
ON public.activity_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
