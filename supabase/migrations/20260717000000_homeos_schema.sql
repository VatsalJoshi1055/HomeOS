-- HomeOS production schema
-- Completely independent from TuitionOS

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.households (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id  UUID REFERENCES public.households(id) ON DELETE SET NULL,
  full_name     TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'MEMBER'
                CHECK (role IN ('OWNER', 'MEMBER')),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shopping_lists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shopping_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id          UUID NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  household_id     UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  quantity         NUMERIC(12, 2) NOT NULL DEFAULT 1,
  unit             TEXT,
  category         TEXT,
  notes            TEXT,
  estimated_price  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  priority         TEXT NOT NULL DEFAULT 'MEDIUM'
                   CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  completed        BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  list_id       UUID REFERENCES public.shopping_lists(id) ON DELETE SET NULL,
  item_id       UUID REFERENCES public.shopping_items(id) ON DELETE SET NULL,
  actor_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  message       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.household_invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  invited_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token         TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status        TEXT NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_household ON public.profiles(household_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_lists_household ON public.shopping_lists(household_id);
CREATE INDEX IF NOT EXISTS idx_items_list ON public.shopping_items(list_id);
CREATE INDEX IF NOT EXISTS idx_items_household ON public.shopping_items(household_id);
CREATE INDEX IF NOT EXISTS idx_items_completed ON public.shopping_items(list_id, completed);
CREATE INDEX IF NOT EXISTS idx_activity_household ON public.activity_log(household_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invites_token ON public.household_invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_email ON public.household_invites(email);

-- ─── Helper ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_household_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'MEMBER'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Touch list updated_at when items change
CREATE OR REPLACE FUNCTION public.touch_shopping_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.shopping_lists
  SET updated_at = NOW()
  WHERE id = COALESCE(NEW.list_id, OLD.list_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_item_change_touch_list ON public.shopping_items;
CREATE TRIGGER on_item_change_touch_list
  AFTER INSERT OR UPDATE OR DELETE ON public.shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_shopping_list();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shopping_items REPLICA IDENTITY FULL;
ALTER TABLE public.shopping_lists REPLICA IDENTITY FULL;
ALTER TABLE public.activity_log REPLICA IDENTITY FULL;

-- Households
CREATE POLICY "Members can view their household"
  ON public.households FOR SELECT
  USING (
    id = public.get_user_household_id()
    OR created_by = auth.uid()
  );

CREATE POLICY "Authenticated users can create households"
  ON public.households FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update their household"
  ON public.households FOR UPDATE
  USING (
    id = public.get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'OWNER' AND household_id = households.id
    )
  );

CREATE POLICY "Owners can delete their household"
  ON public.households FOR DELETE
  USING (
    id = public.get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'OWNER' AND household_id = households.id
    )
  );

-- Profiles
CREATE POLICY "Users can view household profiles"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR household_id = public.get_user_household_id()
  );

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Shopping lists
CREATE POLICY "Members can view lists"
  ON public.shopping_lists FOR SELECT
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Members can create lists"
  ON public.shopping_lists FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id());

CREATE POLICY "Members can update lists"
  ON public.shopping_lists FOR UPDATE
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Members can delete lists"
  ON public.shopping_lists FOR DELETE
  USING (household_id = public.get_user_household_id());

-- Shopping items
CREATE POLICY "Members can view items"
  ON public.shopping_items FOR SELECT
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Members can create items"
  ON public.shopping_items FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id());

CREATE POLICY "Members can update items"
  ON public.shopping_items FOR UPDATE
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Members can delete items"
  ON public.shopping_items FOR DELETE
  USING (household_id = public.get_user_household_id());

-- Activity log
CREATE POLICY "Members can view activity"
  ON public.activity_log FOR SELECT
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Members can create activity"
  ON public.activity_log FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id());

-- Invites
CREATE POLICY "Members can view household invites"
  ON public.household_invites FOR SELECT
  USING (
    household_id = public.get_user_household_id()
    OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

CREATE POLICY "Owners can create invites"
  ON public.household_invites FOR INSERT
  WITH CHECK (
    household_id = public.get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'OWNER'
    )
  );

CREATE POLICY "Owners can update invites"
  ON public.household_invites FOR UPDATE
  USING (
    household_id = public.get_user_household_id()
    OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

-- Atomic household onboarding (avoids RLS chicken-and-egg on create + select)
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

-- ─── Realtime ─────────────────────────────────────────────────────────────────

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
