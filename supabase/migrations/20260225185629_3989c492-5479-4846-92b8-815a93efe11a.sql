
-- ============================================================
-- 1. Add user_id to projects and integrations for ownership
-- ============================================================
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);

ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON public.integrations(user_id);

-- ============================================================
-- 2. Drop ALL existing permissive RLS policies on ALL tables
-- ============================================================

-- projects
DROP POLICY IF EXISTS "Allow all select on projects" ON public.projects;
DROP POLICY IF EXISTS "Allow all insert on projects" ON public.projects;
DROP POLICY IF EXISTS "Allow all update on projects" ON public.projects;
DROP POLICY IF EXISTS "Allow all delete on projects" ON public.projects;

-- films
DROP POLICY IF EXISTS "Allow all select on films" ON public.films;
DROP POLICY IF EXISTS "Allow all insert on films" ON public.films;
DROP POLICY IF EXISTS "Allow all update on films" ON public.films;
DROP POLICY IF EXISTS "Allow all delete on films" ON public.films;

-- characters
DROP POLICY IF EXISTS "Allow all select on characters" ON public.characters;
DROP POLICY IF EXISTS "Allow all insert on characters" ON public.characters;
DROP POLICY IF EXISTS "Allow all update on characters" ON public.characters;
DROP POLICY IF EXISTS "Allow all delete on characters" ON public.characters;

-- character_auditions
DROP POLICY IF EXISTS "Allow all access to character_auditions" ON public.character_auditions;

-- shots
DROP POLICY IF EXISTS "Allow all select on shots" ON public.shots;
DROP POLICY IF EXISTS "Allow all insert on shots" ON public.shots;
DROP POLICY IF EXISTS "Allow all update on shots" ON public.shots;
DROP POLICY IF EXISTS "Allow all delete on shots" ON public.shots;

-- post_production_clips
DROP POLICY IF EXISTS "Allow all select on post_production_clips" ON public.post_production_clips;
DROP POLICY IF EXISTS "Allow all insert on post_production_clips" ON public.post_production_clips;
DROP POLICY IF EXISTS "Allow all update on post_production_clips" ON public.post_production_clips;
DROP POLICY IF EXISTS "Allow all delete on post_production_clips" ON public.post_production_clips;

-- integrations
DROP POLICY IF EXISTS "Allow all select on integrations" ON public.integrations;
DROP POLICY IF EXISTS "Allow all insert on integrations" ON public.integrations;
DROP POLICY IF EXISTS "Allow all update on integrations" ON public.integrations;
DROP POLICY IF EXISTS "Allow all delete on integrations" ON public.integrations;

-- content_safety
DROP POLICY IF EXISTS "Allow all select on content_safety" ON public.content_safety;
DROP POLICY IF EXISTS "Allow all insert on content_safety" ON public.content_safety;
DROP POLICY IF EXISTS "Allow all update on content_safety" ON public.content_safety;
DROP POLICY IF EXISTS "Allow all delete on content_safety" ON public.content_safety;

-- script_analyses (has duplicate policies)
DROP POLICY IF EXISTS "Allow all select on script_analyses" ON public.script_analyses;
DROP POLICY IF EXISTS "Allow all insert on script_analyses" ON public.script_analyses;
DROP POLICY IF EXISTS "Allow all update on script_analyses" ON public.script_analyses;
DROP POLICY IF EXISTS "Allow all delete on script_analyses" ON public.script_analyses;
DROP POLICY IF EXISTS "Anyone can read script analyses" ON public.script_analyses;
DROP POLICY IF EXISTS "Anyone can insert script analyses" ON public.script_analyses;
DROP POLICY IF EXISTS "Anyone can update script analyses" ON public.script_analyses;
DROP POLICY IF EXISTS "Anyone can delete script analyses" ON public.script_analyses;

-- parsed_scenes
DROP POLICY IF EXISTS "Allow all select on parsed_scenes" ON public.parsed_scenes;
DROP POLICY IF EXISTS "Allow all insert on parsed_scenes" ON public.parsed_scenes;
DROP POLICY IF EXISTS "Allow all update on parsed_scenes" ON public.parsed_scenes;
DROP POLICY IF EXISTS "Allow all delete on parsed_scenes" ON public.parsed_scenes;

-- parse_jobs
DROP POLICY IF EXISTS "Allow all select on parse_jobs" ON public.parse_jobs;
DROP POLICY IF EXISTS "Allow all insert on parse_jobs" ON public.parse_jobs;
DROP POLICY IF EXISTS "Allow all update on parse_jobs" ON public.parse_jobs;
DROP POLICY IF EXISTS "Allow all delete on parse_jobs" ON public.parse_jobs;

-- asset_identity_registry
DROP POLICY IF EXISTS "Allow all select on asset_identity_registry" ON public.asset_identity_registry;
DROP POLICY IF EXISTS "Allow all insert on asset_identity_registry" ON public.asset_identity_registry;
DROP POLICY IF EXISTS "Allow all update on asset_identity_registry" ON public.asset_identity_registry;
DROP POLICY IF EXISTS "Allow all delete on asset_identity_registry" ON public.asset_identity_registry;

-- ai_generation_templates
DROP POLICY IF EXISTS "Allow all select on ai_generation_templates" ON public.ai_generation_templates;
DROP POLICY IF EXISTS "Allow all insert on ai_generation_templates" ON public.ai_generation_templates;
DROP POLICY IF EXISTS "Allow all update on ai_generation_templates" ON public.ai_generation_templates;
DROP POLICY IF EXISTS "Allow all delete on ai_generation_templates" ON public.ai_generation_templates;

-- film_assets
DROP POLICY IF EXISTS "Allow all select on film_assets" ON public.film_assets;
DROP POLICY IF EXISTS "Allow all insert on film_assets" ON public.film_assets;
DROP POLICY IF EXISTS "Allow all update on film_assets" ON public.film_assets;
DROP POLICY IF EXISTS "Allow all delete on film_assets" ON public.film_assets;

-- production_presets
DROP POLICY IF EXISTS "Allow all select on production_presets" ON public.production_presets;
DROP POLICY IF EXISTS "Allow all insert on production_presets" ON public.production_presets;
DROP POLICY IF EXISTS "Allow all update on production_presets" ON public.production_presets;
DROP POLICY IF EXISTS "Allow all delete on production_presets" ON public.production_presets;

-- version_provider_selections
DROP POLICY IF EXISTS "Anyone can view version provider selections" ON public.version_provider_selections;
DROP POLICY IF EXISTS "Anyone can insert version provider selections" ON public.version_provider_selections;
DROP POLICY IF EXISTS "Anyone can update version provider selections" ON public.version_provider_selections;
DROP POLICY IF EXISTS "Anyone can delete version provider selections" ON public.version_provider_selections;

-- film_style_contracts
DROP POLICY IF EXISTS "Allow all select on film_style_contracts" ON public.film_style_contracts;
DROP POLICY IF EXISTS "Allow all insert on film_style_contracts" ON public.film_style_contracts;
DROP POLICY IF EXISTS "Allow all update on film_style_contracts" ON public.film_style_contracts;
DROP POLICY IF EXISTS "Allow all delete on film_style_contracts" ON public.film_style_contracts;

-- wardrobe_scene_assignments
DROP POLICY IF EXISTS "Allow all select on wardrobe_scene_assignments" ON public.wardrobe_scene_assignments;
DROP POLICY IF EXISTS "Allow all insert on wardrobe_scene_assignments" ON public.wardrobe_scene_assignments;
DROP POLICY IF EXISTS "Allow all update on wardrobe_scene_assignments" ON public.wardrobe_scene_assignments;
DROP POLICY IF EXISTS "Allow all delete on wardrobe_scene_assignments" ON public.wardrobe_scene_assignments;

-- scene_style_overrides
DROP POLICY IF EXISTS "Allow all select on scene_style_overrides" ON public.scene_style_overrides;
DROP POLICY IF EXISTS "Allow all insert on scene_style_overrides" ON public.scene_style_overrides;
DROP POLICY IF EXISTS "Allow all update on scene_style_overrides" ON public.scene_style_overrides;
DROP POLICY IF EXISTS "Allow all delete on scene_style_overrides" ON public.scene_style_overrides;

-- ============================================================
-- 3. Create user-scoped RLS policies
-- ============================================================

-- Helper function to check project ownership via film_id
CREATE OR REPLACE FUNCTION public.user_owns_film(p_film_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.films f
    JOIN public.projects p ON f.project_id = p.id
    WHERE f.id = p_film_id AND p.user_id = auth.uid()
  );
$$;

-- PROJECTS: user-scoped
CREATE POLICY "Users can read own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- INTEGRATIONS: user-scoped
CREATE POLICY "Users can read own integrations" ON public.integrations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own integrations" ON public.integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own integrations" ON public.integrations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own integrations" ON public.integrations
  FOR DELETE USING (auth.uid() = user_id);

-- FILMS: cascading via project ownership
CREATE POLICY "Users can access own films" ON public.films
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = films.project_id
      AND projects.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = films.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- CHARACTERS: cascading via film → project
CREATE POLICY "Users can access own characters" ON public.characters
  FOR ALL USING (public.user_owns_film(film_id))
  WITH CHECK (public.user_owns_film(film_id));

-- CHARACTER_AUDITIONS: cascading via character → film → project
CREATE POLICY "Users can access own auditions" ON public.character_auditions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_auditions.character_id
      AND public.user_owns_film(c.film_id)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_auditions.character_id
      AND public.user_owns_film(c.film_id)
    )
  );

-- SHOTS
CREATE POLICY "Users can access own shots" ON public.shots
  FOR ALL USING (public.user_owns_film(film_id))
  WITH CHECK (public.user_owns_film(film_id));

-- POST_PRODUCTION_CLIPS
CREATE POLICY "Users can access own clips" ON public.post_production_clips
  FOR ALL USING (public.user_owns_film(film_id))
  WITH CHECK (public.user_owns_film(film_id));

-- CONTENT_SAFETY
CREATE POLICY "Users can access own content_safety" ON public.content_safety
  FOR ALL USING (public.user_owns_film(film_id))
  WITH CHECK (public.user_owns_film(film_id));

-- SCRIPT_ANALYSES
CREATE POLICY "Users can access own analyses" ON public.script_analyses
  FOR ALL USING (public.user_owns_film(film_id))
  WITH CHECK (public.user_owns_film(film_id));

-- PARSED_SCENES
CREATE POLICY "Users can access own scenes" ON public.parsed_scenes
  FOR ALL USING (public.user_owns_film(film_id))
  WITH CHECK (public.user_owns_film(film_id));

-- PARSE_JOBS
CREATE POLICY "Users can access own parse_jobs" ON public.parse_jobs
  FOR ALL USING (public.user_owns_film(film_id))
  WITH CHECK (public.user_owns_film(film_id));

-- ASSET_IDENTITY_REGISTRY
CREATE POLICY "Users can access own asset_registry" ON public.asset_identity_registry
  FOR ALL USING (public.user_owns_film(film_id))
  WITH CHECK (public.user_owns_film(film_id));

-- AI_GENERATION_TEMPLATES: cascading via shot → film → project
CREATE POLICY "Users can access own templates" ON public.ai_generation_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.shots s
      WHERE s.id = ai_generation_templates.shot_id
      AND public.user_owns_film(s.film_id)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shots s
      WHERE s.id = ai_generation_templates.shot_id
      AND public.user_owns_film(s.film_id)
    )
  );

-- FILM_ASSETS
CREATE POLICY "Users can access own film_assets" ON public.film_assets
  FOR ALL USING (public.user_owns_film(film_id))
  WITH CHECK (public.user_owns_film(film_id));

-- PRODUCTION_PRESETS
CREATE POLICY "Users can access own presets" ON public.production_presets
  FOR ALL USING (public.user_owns_film(film_id))
  WITH CHECK (public.user_owns_film(film_id));

-- VERSION_PROVIDER_SELECTIONS
CREATE POLICY "Users can access own provider_selections" ON public.version_provider_selections
  FOR ALL USING (public.user_owns_film(film_id))
  WITH CHECK (public.user_owns_film(film_id));

-- FILM_STYLE_CONTRACTS
CREATE POLICY "Users can access own style_contracts" ON public.film_style_contracts
  FOR ALL USING (public.user_owns_film(film_id))
  WITH CHECK (public.user_owns_film(film_id));

-- WARDROBE_SCENE_ASSIGNMENTS
CREATE POLICY "Users can access own wardrobe_assignments" ON public.wardrobe_scene_assignments
  FOR ALL USING (public.user_owns_film(film_id))
  WITH CHECK (public.user_owns_film(film_id));

-- SCENE_STYLE_OVERRIDES
CREATE POLICY "Users can access own style_overrides" ON public.scene_style_overrides
  FOR ALL USING (public.user_owns_film(film_id))
  WITH CHECK (public.user_owns_film(film_id));

-- ============================================================
-- 4. Make storage buckets private and fix policies
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id IN ('character-assets', 'film-assets');

-- Drop existing overly permissive storage policies
DROP POLICY IF EXISTS "Allow public read access on character-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to character-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to character-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from character-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access on film-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to film-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to film-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from film-assets" ON storage.objects;

-- Authenticated users can read/write their own assets (scoped by auth)
CREATE POLICY "Authenticated users can read character-assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'character-assets' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can upload character-assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'character-assets' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update character-assets" ON storage.objects
  FOR UPDATE USING (bucket_id = 'character-assets' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete character-assets" ON storage.objects
  FOR DELETE USING (bucket_id = 'character-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read film-assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'film-assets' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can upload film-assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'film-assets' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update film-assets" ON storage.objects
  FOR UPDATE USING (bucket_id = 'film-assets' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete film-assets" ON storage.objects
  FOR DELETE USING (bucket_id = 'film-assets' AND auth.role() = 'authenticated');

-- Service role (edge functions) can still read/write via SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)
