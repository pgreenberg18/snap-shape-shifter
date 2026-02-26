-- Enable realtime for VICE tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.vice_conflicts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vice_dirty_queue;