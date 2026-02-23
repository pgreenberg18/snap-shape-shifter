
-- Fix films policies: drop restrictive, create permissive
DROP POLICY IF EXISTS "Authenticated users can read films" ON public.films;
DROP POLICY IF EXISTS "Authenticated users can insert films" ON public.films;
DROP POLICY IF EXISTS "Authenticated users can update films" ON public.films;
DROP POLICY IF EXISTS "Authenticated users can delete films" ON public.films;

CREATE POLICY "Anyone can read films" ON public.films FOR SELECT USING (true);
CREATE POLICY "Anyone can insert films" ON public.films FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update films" ON public.films FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete films" ON public.films FOR DELETE USING (true);

-- Fix content_safety policies
DROP POLICY IF EXISTS "Authenticated users can read safety" ON public.content_safety;
DROP POLICY IF EXISTS "Authenticated users can insert safety" ON public.content_safety;
DROP POLICY IF EXISTS "Authenticated users can update safety" ON public.content_safety;
DROP POLICY IF EXISTS "Authenticated users can delete safety" ON public.content_safety;

CREATE POLICY "Anyone can read safety" ON public.content_safety FOR SELECT USING (true);
CREATE POLICY "Anyone can insert safety" ON public.content_safety FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update safety" ON public.content_safety FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete safety" ON public.content_safety FOR DELETE USING (true);

-- Fix script_analyses policies
DROP POLICY IF EXISTS "Authenticated users can view script analyses" ON public.script_analyses;
DROP POLICY IF EXISTS "Authenticated users can insert script analyses" ON public.script_analyses;
DROP POLICY IF EXISTS "Authenticated users can update script analyses" ON public.script_analyses;
DROP POLICY IF EXISTS "Authenticated users can delete script analyses" ON public.script_analyses;

CREATE POLICY "Anyone can read script analyses" ON public.script_analyses FOR SELECT USING (true);
CREATE POLICY "Anyone can insert script analyses" ON public.script_analyses FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update script analyses" ON public.script_analyses FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete script analyses" ON public.script_analyses FOR DELETE USING (true);

-- Fix characters policies
DROP POLICY IF EXISTS "Authenticated users can read characters" ON public.characters;
DROP POLICY IF EXISTS "Authenticated users can insert characters" ON public.characters;
DROP POLICY IF EXISTS "Authenticated users can update characters" ON public.characters;
DROP POLICY IF EXISTS "Authenticated users can delete characters" ON public.characters;

CREATE POLICY "Anyone can read characters" ON public.characters FOR SELECT USING (true);
CREATE POLICY "Anyone can insert characters" ON public.characters FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update characters" ON public.characters FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete characters" ON public.characters FOR DELETE USING (true);

-- Fix integrations policies
DROP POLICY IF EXISTS "Authenticated users can read integrations" ON public.integrations;
DROP POLICY IF EXISTS "Authenticated users can insert integrations" ON public.integrations;
DROP POLICY IF EXISTS "Authenticated users can update integrations" ON public.integrations;
DROP POLICY IF EXISTS "Authenticated users can delete integrations" ON public.integrations;

CREATE POLICY "Anyone can read integrations" ON public.integrations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert integrations" ON public.integrations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update integrations" ON public.integrations FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete integrations" ON public.integrations FOR DELETE USING (true);

-- Fix post_production_clips policies
DROP POLICY IF EXISTS "Authenticated users can read clips" ON public.post_production_clips;
DROP POLICY IF EXISTS "Authenticated users can insert clips" ON public.post_production_clips;
DROP POLICY IF EXISTS "Authenticated users can update clips" ON public.post_production_clips;
DROP POLICY IF EXISTS "Authenticated users can delete clips" ON public.post_production_clips;

CREATE POLICY "Anyone can read clips" ON public.post_production_clips FOR SELECT USING (true);
CREATE POLICY "Anyone can insert clips" ON public.post_production_clips FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update clips" ON public.post_production_clips FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete clips" ON public.post_production_clips FOR DELETE USING (true);

-- Fix shots policies
DROP POLICY IF EXISTS "Authenticated users can read shots" ON public.shots;
DROP POLICY IF EXISTS "Authenticated users can insert shots" ON public.shots;
DROP POLICY IF EXISTS "Authenticated users can update shots" ON public.shots;
DROP POLICY IF EXISTS "Authenticated users can delete shots" ON public.shots;

CREATE POLICY "Anyone can read shots" ON public.shots FOR SELECT USING (true);
CREATE POLICY "Anyone can insert shots" ON public.shots FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update shots" ON public.shots FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete shots" ON public.shots FOR DELETE USING (true);
