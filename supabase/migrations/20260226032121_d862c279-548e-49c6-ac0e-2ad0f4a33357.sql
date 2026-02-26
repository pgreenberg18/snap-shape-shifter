
-- Generations table: tracks every generation attempt with full lineage
CREATE TABLE public.generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shot_id UUID NOT NULL REFERENCES public.shots(id) ON DELETE CASCADE,
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  
  -- Generation mode & engine
  engine TEXT NOT NULL DEFAULT 'pending',  -- e.g. 'veo_3.1', 'kling_3', 'seedance', 'higgsfield'
  mode TEXT NOT NULL DEFAULT 'anchor',     -- 'anchor' | 'animate' | 'targeted_edit'
  status TEXT NOT NULL DEFAULT 'compiling', -- 'compiling' | 'anchoring' | 'animating' | 'scoring' | 'repairing' | 'complete' | 'failed'
  
  -- Compile artifacts (frozen snapshot for reproducibility)
  compile_hash TEXT,
  reference_bundle_json JSONB DEFAULT '{}'::jsonb,
  prompt_pack_json JSONB DEFAULT '{}'::jsonb,
  generation_plan_json JSONB DEFAULT '{}'::jsonb,
  
  -- Execution
  seed BIGINT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  
  -- Outputs
  output_urls TEXT[] DEFAULT '{}',
  selected_output_index INTEGER,  -- which anchor was picked
  scores_json JSONB,              -- identity, prop fidelity, motion, constraint compliance
  
  -- Lineage
  parent_generation_id UUID REFERENCES public.generations(id),
  style_contract_version INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_generations_shot_id ON public.generations(shot_id);
CREATE INDEX idx_generations_film_id ON public.generations(film_id);
CREATE INDEX idx_generations_status ON public.generations(status);
CREATE INDEX idx_generations_parent ON public.generations(parent_generation_id);
CREATE INDEX idx_generations_compile_hash ON public.generations(compile_hash);

-- Enable RLS
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- RLS: users can access generations for their own films
CREATE POLICY "Users can access own generations"
  ON public.generations
  FOR ALL
  USING (user_owns_film(film_id))
  WITH CHECK (user_owns_film(film_id));

-- Updated_at trigger
CREATE TRIGGER update_generations_updated_at
  BEFORE UPDATE ON public.generations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
