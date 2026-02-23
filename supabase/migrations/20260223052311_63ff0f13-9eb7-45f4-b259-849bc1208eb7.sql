
-- Fix all RLS policies: drop RESTRICTIVE ones and recreate as PERMISSIVE

-- ai_generation_templates
DROP POLICY IF EXISTS "Anyone can view ai gen templates" ON public.ai_generation_templates;
DROP POLICY IF EXISTS "Anyone can insert ai gen templates" ON public.ai_generation_templates;
DROP POLICY IF EXISTS "Anyone can update ai gen templates" ON public.ai_generation_templates;
DROP POLICY IF EXISTS "Anyone can delete ai gen templates" ON public.ai_generation_templates;
CREATE POLICY "Allow all select on ai_generation_templates" ON public.ai_generation_templates FOR SELECT USING (true);
CREATE POLICY "Allow all insert on ai_generation_templates" ON public.ai_generation_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on ai_generation_templates" ON public.ai_generation_templates FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on ai_generation_templates" ON public.ai_generation_templates FOR DELETE USING (true);

-- asset_identity_registry
DROP POLICY IF EXISTS "Anyone can view asset registry" ON public.asset_identity_registry;
DROP POLICY IF EXISTS "Anyone can insert asset registry" ON public.asset_identity_registry;
DROP POLICY IF EXISTS "Anyone can update asset registry" ON public.asset_identity_registry;
DROP POLICY IF EXISTS "Anyone can delete asset registry" ON public.asset_identity_registry;
CREATE POLICY "Allow all select on asset_identity_registry" ON public.asset_identity_registry FOR SELECT USING (true);
CREATE POLICY "Allow all insert on asset_identity_registry" ON public.asset_identity_registry FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on asset_identity_registry" ON public.asset_identity_registry FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on asset_identity_registry" ON public.asset_identity_registry FOR DELETE USING (true);

-- characters
DROP POLICY IF EXISTS "Anyone can read characters" ON public.characters;
DROP POLICY IF EXISTS "Anyone can insert characters" ON public.characters;
DROP POLICY IF EXISTS "Anyone can update characters" ON public.characters;
DROP POLICY IF EXISTS "Anyone can delete characters" ON public.characters;
CREATE POLICY "Allow all select on characters" ON public.characters FOR SELECT USING (true);
CREATE POLICY "Allow all insert on characters" ON public.characters FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on characters" ON public.characters FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on characters" ON public.characters FOR DELETE USING (true);

-- content_safety
DROP POLICY IF EXISTS "Anyone can read safety" ON public.content_safety;
DROP POLICY IF EXISTS "Anyone can insert safety" ON public.content_safety;
DROP POLICY IF EXISTS "Anyone can update safety" ON public.content_safety;
DROP POLICY IF EXISTS "Anyone can delete safety" ON public.content_safety;
CREATE POLICY "Allow all select on content_safety" ON public.content_safety FOR SELECT USING (true);
CREATE POLICY "Allow all insert on content_safety" ON public.content_safety FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on content_safety" ON public.content_safety FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on content_safety" ON public.content_safety FOR DELETE USING (true);

-- films
DROP POLICY IF EXISTS "Anyone can read films" ON public.films;
DROP POLICY IF EXISTS "Anyone can insert films" ON public.films;
DROP POLICY IF EXISTS "Anyone can update films" ON public.films;
DROP POLICY IF EXISTS "Anyone can delete films" ON public.films;
CREATE POLICY "Allow all select on films" ON public.films FOR SELECT USING (true);
CREATE POLICY "Allow all insert on films" ON public.films FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on films" ON public.films FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on films" ON public.films FOR DELETE USING (true);

-- integrations
DROP POLICY IF EXISTS "Anyone can read integrations" ON public.integrations;
DROP POLICY IF EXISTS "Anyone can insert integrations" ON public.integrations;
DROP POLICY IF EXISTS "Anyone can update integrations" ON public.integrations;
DROP POLICY IF EXISTS "Anyone can delete integrations" ON public.integrations;
CREATE POLICY "Allow all select on integrations" ON public.integrations FOR SELECT USING (true);
CREATE POLICY "Allow all insert on integrations" ON public.integrations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on integrations" ON public.integrations FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on integrations" ON public.integrations FOR DELETE USING (true);

-- post_production_clips
DROP POLICY IF EXISTS "Anyone can read clips" ON public.post_production_clips;
DROP POLICY IF EXISTS "Anyone can insert clips" ON public.post_production_clips;
DROP POLICY IF EXISTS "Anyone can update clips" ON public.post_production_clips;
DROP POLICY IF EXISTS "Anyone can delete clips" ON public.post_production_clips;
CREATE POLICY "Allow all select on post_production_clips" ON public.post_production_clips FOR SELECT USING (true);
CREATE POLICY "Allow all insert on post_production_clips" ON public.post_production_clips FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on post_production_clips" ON public.post_production_clips FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on post_production_clips" ON public.post_production_clips FOR DELETE USING (true);

-- projects
DROP POLICY IF EXISTS "Allow all access to projects" ON public.projects;
CREATE POLICY "Allow all select on projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Allow all insert on projects" ON public.projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on projects" ON public.projects FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on projects" ON public.projects FOR DELETE USING (true);

-- script_analyses
DROP POLICY IF EXISTS "Anyone can read analyses" ON public.script_analyses;
DROP POLICY IF EXISTS "Anyone can insert analyses" ON public.script_analyses;
DROP POLICY IF EXISTS "Anyone can update analyses" ON public.script_analyses;
DROP POLICY IF EXISTS "Anyone can delete analyses" ON public.script_analyses;
CREATE POLICY "Allow all select on script_analyses" ON public.script_analyses FOR SELECT USING (true);
CREATE POLICY "Allow all insert on script_analyses" ON public.script_analyses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on script_analyses" ON public.script_analyses FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on script_analyses" ON public.script_analyses FOR DELETE USING (true);

-- shots
DROP POLICY IF EXISTS "Anyone can read shots" ON public.shots;
DROP POLICY IF EXISTS "Anyone can insert shots" ON public.shots;
DROP POLICY IF EXISTS "Anyone can update shots" ON public.shots;
DROP POLICY IF EXISTS "Anyone can delete shots" ON public.shots;
CREATE POLICY "Allow all select on shots" ON public.shots FOR SELECT USING (true);
CREATE POLICY "Allow all insert on shots" ON public.shots FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on shots" ON public.shots FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on shots" ON public.shots FOR DELETE USING (true);
