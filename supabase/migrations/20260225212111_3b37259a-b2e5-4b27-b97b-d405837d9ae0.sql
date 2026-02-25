
-- Fix user_profiles: drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin can delete profiles" ON public.user_profiles;

CREATE POLICY "Users can insert their own profile"
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own profile"
ON public.user_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all profiles"
ON public.user_profiles FOR SELECT
TO authenticated
USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'paul@greenbergdirect.com');

CREATE POLICY "Admin can delete profiles"
ON public.user_profiles FOR DELETE
TO authenticated
USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'paul@greenbergdirect.com');

-- Fix user_access_controls: drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Admin can manage all access" ON public.user_access_controls;
DROP POLICY IF EXISTS "Users can view their own access" ON public.user_access_controls;

CREATE POLICY "Admin can manage all access"
ON public.user_access_controls FOR ALL
TO authenticated
USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'paul@greenbergdirect.com');

CREATE POLICY "Users can view their own access"
ON public.user_access_controls FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to insert their own access control row (needed during onboarding)
CREATE POLICY "Users can insert their own access"
ON public.user_access_controls FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
