
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow all access to films" ON public.films;
DROP POLICY IF EXISTS "Allow all access to characters" ON public.characters;
DROP POLICY IF EXISTS "Allow all access to shots" ON public.shots;
DROP POLICY IF EXISTS "Allow all access to post_production_clips" ON public.post_production_clips;
DROP POLICY IF EXISTS "Allow all access to integrations" ON public.integrations;
DROP POLICY IF EXISTS "Allow all access to content_safety" ON public.content_safety;

-- Films: authenticated users can read/write all films (no per-user scoping for now)
CREATE POLICY "Authenticated users can read films" ON public.films FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert films" ON public.films FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update films" ON public.films FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete films" ON public.films FOR DELETE TO authenticated USING (true);

-- Characters
CREATE POLICY "Authenticated users can read characters" ON public.characters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert characters" ON public.characters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update characters" ON public.characters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete characters" ON public.characters FOR DELETE TO authenticated USING (true);

-- Shots
CREATE POLICY "Authenticated users can read shots" ON public.shots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert shots" ON public.shots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update shots" ON public.shots FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete shots" ON public.shots FOR DELETE TO authenticated USING (true);

-- Post production clips
CREATE POLICY "Authenticated users can read clips" ON public.post_production_clips FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clips" ON public.post_production_clips FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clips" ON public.post_production_clips FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete clips" ON public.post_production_clips FOR DELETE TO authenticated USING (true);

-- Content safety
CREATE POLICY "Authenticated users can read safety" ON public.content_safety FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert safety" ON public.content_safety FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update safety" ON public.content_safety FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete safety" ON public.content_safety FOR DELETE TO authenticated USING (true);

-- Integrations
CREATE POLICY "Authenticated users can read integrations" ON public.integrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert integrations" ON public.integrations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update integrations" ON public.integrations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete integrations" ON public.integrations FOR DELETE TO authenticated USING (true);
