
-- Fix user_profiles admin policies to use auth.jwt() instead of auth.users
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin can delete profiles" ON public.user_profiles;

CREATE POLICY "Admin can view all profiles"
ON public.user_profiles FOR SELECT
TO authenticated
USING ((auth.jwt() ->> 'email') = 'paul@greenbergdirect.com');

CREATE POLICY "Admin can delete profiles"
ON public.user_profiles FOR DELETE
TO authenticated
USING ((auth.jwt() ->> 'email') = 'paul@greenbergdirect.com');

-- Fix user_access_controls admin policy
DROP POLICY IF EXISTS "Admin can manage all access" ON public.user_access_controls;

CREATE POLICY "Admin can manage all access"
ON public.user_access_controls FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'email') = 'paul@greenbergdirect.com');

-- Fix activity_logs admin policy
DROP POLICY IF EXISTS "Admin can view all activity logs" ON public.activity_logs;

CREATE POLICY "Admin can view all activity logs"
ON public.activity_logs FOR SELECT
TO authenticated
USING ((auth.jwt() ->> 'email') = 'paul@greenbergdirect.com');
