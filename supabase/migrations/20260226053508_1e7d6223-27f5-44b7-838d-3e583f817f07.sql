
-- ═══════════════════════════════════════════════════════════════
-- VICE (Visual Intent Creativity Engine) — Core Tables
-- ═══════════════════════════════════════════════════════════════

-- 1. Dependency graph: which tokens are used in which shots
CREATE TABLE public.vice_dependencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  source_token TEXT NOT NULL,           -- e.g. "ACTOR_1", "LOC_DINER"
  source_type TEXT NOT NULL,            -- character | location | prop | wardrobe | vehicle
  shot_id UUID NOT NULL REFERENCES public.shots(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'visual', -- visual | continuity | wardrobe
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique: one token can only link to a shot once per type
CREATE UNIQUE INDEX idx_vice_dep_unique ON public.vice_dependencies(film_id, source_token, shot_id, dependency_type);
CREATE INDEX idx_vice_dep_token ON public.vice_dependencies(film_id, source_token);
CREATE INDEX idx_vice_dep_shot ON public.vice_dependencies(shot_id);

ALTER TABLE public.vice_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own vice_dependencies"
  ON public.vice_dependencies FOR ALL
  USING (user_owns_film(film_id))
  WITH CHECK (user_owns_film(film_id));

-- 2. Continuity conflicts detected by VICE
CREATE TABLE public.vice_conflicts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  shot_id UUID REFERENCES public.shots(id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL,          -- wardrobe_mismatch | character_drift | prop_missing | lighting_shift
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning', -- info | warning | error
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_vice_conflicts_film ON public.vice_conflicts(film_id, resolved);
CREATE INDEX idx_vice_conflicts_shot ON public.vice_conflicts(shot_id);

ALTER TABLE public.vice_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own vice_conflicts"
  ON public.vice_conflicts FOR ALL
  USING (user_owns_film(film_id))
  WITH CHECK (user_owns_film(film_id));

-- 3. Dirty queue: shots flagged for regeneration by the ripple engine
CREATE TABLE public.vice_dirty_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  shot_id UUID NOT NULL REFERENCES public.shots(id) ON DELETE CASCADE,
  triggered_by TEXT NOT NULL,           -- token that changed e.g. "ACTOR_1"
  trigger_type TEXT NOT NULL DEFAULT 'identity_swap', -- identity_swap | style_drift | continuity_fix
  status TEXT NOT NULL DEFAULT 'pending', -- pending | queued | regenerating | done | dismissed
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX idx_vice_dirty_unique ON public.vice_dirty_queue(shot_id, triggered_by, status) WHERE status = 'pending';
CREATE INDEX idx_vice_dirty_film ON public.vice_dirty_queue(film_id, status);

ALTER TABLE public.vice_dirty_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own vice_dirty_queue"
  ON public.vice_dirty_queue FOR ALL
  USING (user_owns_film(film_id))
  WITH CHECK (user_owns_film(film_id));
