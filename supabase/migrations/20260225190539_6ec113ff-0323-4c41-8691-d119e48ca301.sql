
-- Credit usage log: records every AI API call with service, cost, and context
CREATE TABLE public.credit_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  film_id UUID REFERENCES public.films(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  service_category TEXT NOT NULL,
  operation TEXT NOT NULL,
  credits_used NUMERIC(10,4) NOT NULL DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own usage logs" ON public.credit_usage_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert usage logs" ON public.credit_usage_logs
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_credit_usage_user_created ON public.credit_usage_logs(user_id, created_at DESC);
CREATE INDEX idx_credit_usage_service ON public.credit_usage_logs(service_name, created_at DESC);

-- Credit usage settings: per-user warning/cutoff thresholds
CREATE TABLE public.credit_usage_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  warning_threshold NUMERIC(10,2) DEFAULT NULL,
  cutoff_threshold NUMERIC(10,2) DEFAULT NULL,
  warning_period TEXT NOT NULL DEFAULT 'month',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_usage_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own settings" ON public.credit_usage_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Helper function to log credit usage from edge functions (uses service role)
CREATE OR REPLACE FUNCTION public.log_credit_usage(
  p_user_id UUID,
  p_film_id UUID,
  p_service_name TEXT,
  p_service_category TEXT,
  p_operation TEXT,
  p_credits NUMERIC DEFAULT 1
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.credit_usage_logs (user_id, film_id, service_name, service_category, operation, credits_used)
  VALUES (p_user_id, p_film_id, p_service_name, p_service_category, p_operation, p_credits);
$$;
