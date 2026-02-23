-- Add columns to store scene approval state persistently
ALTER TABLE public.script_analyses
ADD COLUMN scene_approvals jsonb DEFAULT '[]'::jsonb,
ADD COLUMN scene_rejections jsonb DEFAULT '[]'::jsonb;