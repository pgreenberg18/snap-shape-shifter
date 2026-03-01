
-- 1. Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create internal encryption key storage (RLS enabled, no policies = no direct access)
CREATE TABLE IF NOT EXISTS public._internal_keys (
  id TEXT PRIMARY KEY,
  key_value TEXT NOT NULL
);
ALTER TABLE public._internal_keys ENABLE ROW LEVEL SECURITY;
-- No RLS policies intentionally - only SECURITY DEFINER functions can read

-- 3. Generate and store encryption key
INSERT INTO public._internal_keys (id, key_value)
VALUES ('v1', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT DO NOTHING;

-- 4. Add key_hint column to integrations for safe display
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS key_hint TEXT;

-- 5. Populate key_hint from existing plaintext keys
UPDATE public.integrations
SET key_hint = '••••' || RIGHT(api_key_encrypted, 4)
WHERE api_key_encrypted IS NOT NULL AND api_key_encrypted != '';

-- 6. Encrypt existing plaintext keys in place
DO $$
DECLARE
  v_enc_key TEXT;
  r RECORD;
BEGIN
  SELECT key_value INTO v_enc_key FROM public._internal_keys WHERE id = 'v1';
  FOR r IN SELECT id, api_key_encrypted FROM public.integrations WHERE api_key_encrypted IS NOT NULL AND api_key_encrypted != ''
  LOOP
    UPDATE public.integrations
    SET api_key_encrypted = encode(pgp_sym_encrypt(r.api_key_encrypted, v_enc_key), 'base64')
    WHERE id = r.id;
  END LOOP;
END $$;

-- 7. Create function to store a new integration with encrypted key
CREATE OR REPLACE FUNCTION public.store_integration_key(
  p_section_id TEXT,
  p_provider_name TEXT,
  p_api_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enc_key TEXT;
  v_encrypted TEXT;
  v_result UUID;
BEGIN
  IF p_api_key IS NULL OR p_api_key = '' THEN
    RAISE EXCEPTION 'API key is required';
  END IF;
  IF p_section_id IS NULL OR p_section_id = '' THEN
    RAISE EXCEPTION 'section_id is required';
  END IF;
  IF p_provider_name IS NULL OR p_provider_name = '' THEN
    RAISE EXCEPTION 'provider_name is required';
  END IF;

  SELECT key_value INTO v_enc_key FROM _internal_keys WHERE id = 'v1';
  v_encrypted := encode(pgp_sym_encrypt(p_api_key, v_enc_key), 'base64');

  INSERT INTO integrations (section_id, provider_name, api_key_encrypted, key_hint, is_verified, user_id)
  VALUES (p_section_id, p_provider_name, v_encrypted, '••••' || RIGHT(p_api_key, 4), true, auth.uid())
  RETURNING id INTO v_result;

  RETURN v_result;
END;
$$;

-- 8. Create function to update an existing integration key
CREATE OR REPLACE FUNCTION public.update_integration_key(
  p_integration_id UUID,
  p_api_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enc_key TEXT;
  v_encrypted TEXT;
  v_owner UUID;
BEGIN
  IF p_api_key IS NULL OR p_api_key = '' THEN
    RAISE EXCEPTION 'API key is required';
  END IF;

  SELECT user_id INTO v_owner FROM integrations WHERE id = p_integration_id;
  IF v_owner IS NULL OR v_owner != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT key_value INTO v_enc_key FROM _internal_keys WHERE id = 'v1';
  v_encrypted := encode(pgp_sym_encrypt(p_api_key, v_enc_key), 'base64');

  UPDATE integrations
  SET api_key_encrypted = v_encrypted,
      key_hint = '••••' || RIGHT(p_api_key, 4),
      is_verified = true,
      updated_at = now()
  WHERE id = p_integration_id;
END;
$$;

-- 9. Create function to decrypt an integration key (owner-only)
CREATE OR REPLACE FUNCTION public.get_integration_key(p_integration_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enc_key TEXT;
  v_encrypted TEXT;
  v_owner UUID;
BEGIN
  SELECT api_key_encrypted, user_id INTO v_encrypted, v_owner
  FROM integrations WHERE id = p_integration_id;

  IF v_owner IS NULL OR v_owner != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_encrypted IS NULL OR v_encrypted = '' THEN
    RETURN NULL;
  END IF;

  SELECT key_value INTO v_enc_key FROM _internal_keys WHERE id = 'v1';

  RETURN pgp_sym_decrypt(decode(v_encrypted, 'base64'), v_enc_key);
END;
$$;

-- 10. Make generation-outputs bucket private
UPDATE storage.buckets SET public = false WHERE id = 'generation-outputs';
