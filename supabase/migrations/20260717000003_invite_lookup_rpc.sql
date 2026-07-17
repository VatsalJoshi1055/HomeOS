-- Allow invite links to work for logged-out family members.
-- Direct SELECT on household_invites is blocked by RLS for anon users.

CREATE OR REPLACE FUNCTION public.get_pending_invite_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  household_id UUID,
  email TEXT,
  token TEXT,
  status TEXT,
  household_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.household_id,
    i.email,
    i.token,
    i.status,
    h.name AS household_name
  FROM public.household_invites i
  JOIN public.households h ON h.id = i.household_id
  WHERE i.token = p_token
    AND i.status = 'PENDING'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.accept_household_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invite public.household_invites;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Invite token is required';
  END IF;

  SELECT *
  INTO v_invite
  FROM public.household_invites
  WHERE token = btrim(p_token)
    AND status = 'PENDING'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  UPDATE public.profiles
  SET
    household_id = v_invite.household_id,
    role = 'MEMBER'
  WHERE id = v_user_id;

  UPDATE public.household_invites
  SET status = 'ACCEPTED'
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'ok', true,
    'household_id', v_invite.household_id,
    'invite_id', v_invite.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_invite_by_token(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_household_invite(TEXT) TO authenticated, service_role;
