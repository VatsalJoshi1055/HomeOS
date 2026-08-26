-- Performance, reliable invites, error visibility, developer overview.
-- Safe to re-run.

-- ─── last_seen for active-user stats ──────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON public.profiles (last_seen_at DESC NULLS LAST);

-- ─── App error / failed-operation log ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_error_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  household_id  UUID REFERENCES public.households(id) ON DELETE SET NULL,
  source        TEXT NOT NULL DEFAULT 'server',
  operation     TEXT,
  message       TEXT NOT NULL,
  detail        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_error_logs_created
  ON public.app_error_logs (created_at DESC);

ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own errors" ON public.app_error_logs;
CREATE POLICY "Users can insert own errors"
  ON public.app_error_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- No SELECT policy for end users — developer reads via SECURITY DEFINER RPC.

GRANT INSERT ON public.app_error_logs TO authenticated;

-- ─── Activity from item mutations (avoids a second client/server round-trip) ─

CREATE OR REPLACE FUNCTION public.log_shopping_item_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_name TEXT;
  v_action TEXT;
  v_message TEXT;
  v_title TEXT;
  v_list UUID;
  v_item UUID;
  v_household UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_actor := NEW.created_by;
    v_list := NEW.list_id;
    v_item := NEW.id;
    v_household := NEW.household_id;
    v_title := NEW.title;
    v_action := 'item_added';
  ELSIF TG_OP = 'DELETE' THEN
    v_actor := COALESCE(OLD.updated_by, OLD.created_by);
    v_list := OLD.list_id;
    v_item := NULL;
    v_household := OLD.household_id;
    v_title := OLD.title;
    v_action := 'item_deleted';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.completed IS NOT DISTINCT FROM NEW.completed
       AND OLD.title IS NOT DISTINCT FROM NEW.title
       AND OLD.quantity IS NOT DISTINCT FROM NEW.quantity
       AND OLD.unit IS NOT DISTINCT FROM NEW.unit
       AND OLD.category IS NOT DISTINCT FROM NEW.category
       AND OLD.notes IS NOT DISTINCT FROM NEW.notes
       AND OLD.estimated_price IS NOT DISTINCT FROM NEW.estimated_price
       AND OLD.priority IS NOT DISTINCT FROM NEW.priority THEN
      RETURN NEW;
    END IF;

    v_actor := COALESCE(NEW.updated_by, NEW.created_by);
    v_list := NEW.list_id;
    v_item := NEW.id;
    v_household := NEW.household_id;
    v_title := NEW.title;

    IF OLD.completed IS DISTINCT FROM NEW.completed THEN
      v_action := CASE WHEN NEW.completed THEN 'item_completed' ELSE 'item_reopened' END;
    ELSE
      v_action := 'item_updated';
    END IF;
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_actor;
  v_name := COALESCE(NULLIF(btrim(v_name), ''), 'Someone');

  IF v_action = 'item_added' THEN
    v_message := v_name || ' added ' || v_title;
  ELSIF v_action = 'item_deleted' THEN
    v_message := v_name || ' removed ' || v_title;
  ELSIF v_action = 'item_completed' THEN
    v_message := v_name || ' completed ' || v_title;
  ELSIF v_action = 'item_reopened' THEN
    v_message := v_name || ' reopened ' || v_title;
  ELSE
    v_message := v_name || ' updated ' || v_title;
  END IF;

  INSERT INTO public.activity_log (
    household_id, actor_id, action, message, list_id, item_id
  ) VALUES (
    v_household, v_actor, v_action, v_message, v_list, v_item
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_shopping_item_activity ON public.shopping_items;
CREATE TRIGGER on_shopping_item_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.log_shopping_item_activity();

-- ─── Invite accept: use auth.users.email (JWT email claim is not always present)

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

  SELECT lower(coalesce(u.email, auth.jwt() ->> 'email', p.email, ''))
    INTO v_email
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = v_user_id;

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

-- ─── Developer overview (authorization is inside the function) ────────────────

CREATE OR REPLACE FUNCTION public.developer_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_users_total BIGINT;
  v_households_total BIGINT;
  v_active_24h BIGINT;
  v_active_7d BIGINT;
  v_errors_24h BIGINT;
  v_errors_7d BIGINT;
  v_lists_total BIGINT;
  v_items_total BIGINT;
  v_pending_invites BIGINT;
  v_recent_errors JSONB;
  v_recent_users JSONB;
BEGIN
  SELECT lower(coalesce(u.email, auth.jwt() ->> 'email', ''))
    INTO v_email
  FROM auth.users u
  WHERE u.id = auth.uid();

  IF v_email IS DISTINCT FROM 'vatsal02015@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT count(*) INTO v_users_total FROM public.profiles;
  SELECT count(*) INTO v_households_total FROM public.households;
  SELECT count(*) INTO v_active_24h
    FROM public.profiles
    WHERE last_seen_at IS NOT NULL AND last_seen_at > now() - interval '24 hours';
  SELECT count(*) INTO v_active_7d
    FROM public.profiles
    WHERE last_seen_at IS NOT NULL AND last_seen_at > now() - interval '7 days';
  SELECT count(*) INTO v_errors_24h
    FROM public.app_error_logs
    WHERE created_at > now() - interval '24 hours';
  SELECT count(*) INTO v_errors_7d
    FROM public.app_error_logs
    WHERE created_at > now() - interval '7 days';
  SELECT count(*) INTO v_lists_total FROM public.shopping_lists;
  SELECT count(*) INTO v_items_total FROM public.shopping_items;
  SELECT count(*) INTO v_pending_invites
    FROM public.household_invites
    WHERE status = 'PENDING';

  SELECT coalesce(jsonb_agg(row_to_json(e)), '[]'::jsonb)
    INTO v_recent_errors
  FROM (
    SELECT id, user_id, household_id, source, operation, message, detail, created_at
    FROM public.app_error_logs
    ORDER BY created_at DESC
    LIMIT 40
  ) e;

  SELECT coalesce(jsonb_agg(row_to_json(u)), '[]'::jsonb)
    INTO v_recent_users
  FROM (
    SELECT id, full_name, email, household_id, role, last_seen_at, created_at
    FROM public.profiles
    ORDER BY created_at DESC
    LIMIT 15
  ) u;

  RETURN jsonb_build_object(
    'users_total', v_users_total,
    'households_total', v_households_total,
    'active_24h', v_active_24h,
    'active_7d', v_active_7d,
    'errors_24h', v_errors_24h,
    'errors_7d', v_errors_7d,
    'lists_total', v_lists_total,
    'items_total', v_items_total,
    'pending_invites', v_pending_invites,
    'generated_at', now(),
    'recent_errors', v_recent_errors,
    'recent_users', v_recent_users
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.developer_overview() TO authenticated;
