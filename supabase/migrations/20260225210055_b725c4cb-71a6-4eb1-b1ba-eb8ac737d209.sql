
-- User profiles with onboarding + NDA data
CREATE TABLE public.user_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  address TEXT,
  email TEXT NOT NULL DEFAULT '',
  nda_signed BOOLEAN NOT NULL DEFAULT false,
  nda_signed_at TIMESTAMP WITH TIME ZONE,
  signature_data TEXT,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Admin can view all profiles
CREATE POLICY "Admin can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'paul@greenbergdirect.com'
  );

-- Admin can delete profiles
CREATE POLICY "Admin can delete profiles"
  ON public.user_profiles FOR DELETE
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'paul@greenbergdirect.com'
  );

-- Access controls per user (admin-managed)
CREATE TABLE public.user_access_controls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_development BOOLEAN NOT NULL DEFAULT false,
  access_pre_production BOOLEAN NOT NULL DEFAULT false,
  access_production BOOLEAN NOT NULL DEFAULT false,
  access_post_production BOOLEAN NOT NULL DEFAULT false,
  access_release BOOLEAN NOT NULL DEFAULT false,
  access_sample_projects BOOLEAN NOT NULL DEFAULT false,
  allowed_project_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_access_controls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own access"
  ON public.user_access_controls FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can manage all access"
  ON public.user_access_controls FOR ALL
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'paul@greenbergdirect.com'
  );

-- Activity logs for login/page views
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT,
  user_name TEXT,
  event_type TEXT NOT NULL,
  page_path TEXT,
  ip_address TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view all activity logs"
  ON public.activity_logs FOR SELECT
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'paul@greenbergdirect.com'
  );

CREATE POLICY "Users can insert their own activity"
  ON public.activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at on user_profiles
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on user_access_controls
CREATE TRIGGER update_user_access_controls_updated_at
  BEFORE UPDATE ON public.user_access_controls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
