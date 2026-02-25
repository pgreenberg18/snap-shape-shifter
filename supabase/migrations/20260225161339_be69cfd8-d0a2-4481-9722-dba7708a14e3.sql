
-- Add style_contract_version to shots so we can detect drift
ALTER TABLE public.shots
ADD COLUMN style_contract_version integer DEFAULT NULL;

-- Add a comment for clarity
COMMENT ON COLUMN public.shots.style_contract_version IS 'The film_style_contracts.version that was active when this shot was generated. NULL means pre-contract or unknown.';
