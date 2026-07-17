-- Fix household creation RLS chicken-and-egg
-- Run this in the Supabase SQL editor if you already applied the initial schema.

-- Allow creators to read households they just created (before profile.household_id is set)
DROP POLICY IF EXISTS "Members can view their household" ON public.households;
CREATE POLICY "Members can view their household"
  ON public.households FOR SELECT
  USING (
    id = public.get_user_household_id()
    OR created_by = auth.uid()
  );

-- Atomic onboarding: create household, assign owner, seed default list
CREATE OR REPLACE FUNCTION public.create_household_for_current_user(p_name TEXT)
RETURNS public.households
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_household public.households;
  v_existing UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Household name is required';
  END IF;

  SELECT household_id INTO v_existing
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_existing IS NOT NULL THEN
    SELECT * INTO v_household
    FROM public.households
    WHERE id = v_existing;
    RETURN v_household;
  END IF;

  INSERT INTO public.households (name, created_by)
  VALUES (btrim(p_name), v_user_id)
  RETURNING * INTO v_household;

  UPDATE public.profiles
  SET household_id = v_household.id,
      role = 'OWNER'
  WHERE id = v_user_id;

  INSERT INTO public.shopping_lists (household_id, name, created_by)
  VALUES (v_household.id, 'Monthly Grocery', v_user_id);

  RETURN v_household;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_household_for_current_user(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_household_for_current_user(TEXT) TO service_role;
