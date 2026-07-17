-- Ensure Realtime can deliver filtered row changes under RLS
ALTER TABLE public.shopping_items REPLICA IDENTITY FULL;
ALTER TABLE public.shopping_lists REPLICA IDENTITY FULL;
ALTER TABLE public.activity_log REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_lists;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
