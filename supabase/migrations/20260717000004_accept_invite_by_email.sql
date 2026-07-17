-- After email confirmation, invitees often land on /login instead of /auth/callback.
-- Accept any PENDING invite that matches the signed-in user's email.

CREATE OR REPLACE FUNCTION public.accept_pending_invite_for_current_user()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT;
  v_invite public.household_invites;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) INTO v_email;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'No email on session';
  END IF;

  SELECT *
  INTO v_invite
  FROM public.household_invites
  WHERE lower(email) = v_email
    AND status = 'PENDING'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending invite for this email';
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

GRANT EXECUTE ON FUNCTION public.accept_pending_invite_for_current_user() TO authenticated, service_role;
