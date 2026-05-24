-- Migration 29: defer profiles until email confirmation

CREATE OR REPLACE FUNCTION public.is_auth_user_confirmed(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_user_id
      AND u.email_confirmed_at IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dn text := coalesce(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'user_name',
    NULL
  );
  pic text := coalesce(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NULL
  );
  email_local text := split_part(NEW.email, '@', 1);
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF dn IS NULL OR btrim(dn) = '' THEN
    dn := initcap(regexp_replace(email_local, '[_\.\-]+', ' ', 'g'));
  END IF;

  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, dn, pic)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Remove memberships/profiles for users who never confirmed email.
DELETE FROM public.group_members gm
USING auth.users u
WHERE gm.user_id = u.id
  AND u.email_confirmed_at IS NULL;

DELETE FROM public.profiles p
USING auth.users u
WHERE p.id = u.id
  AND u.email_confirmed_at IS NULL;

DROP POLICY IF EXISTS "gm_insert" ON public.group_members;

CREATE POLICY "gm_insert" ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_auth_user_confirmed(group_members.user_id)
  AND EXISTS (
    SELECT 1
    FROM public.group_members me
    WHERE me.group_id = group_members.group_id
      AND me.user_id = auth.uid()
      AND me.role IN ('owner', 'admin')
  )
);

CREATE OR REPLACE FUNCTION public.search_confirmed_member_profiles(
  p_query text,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  display_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.id
  WHERE auth.uid() IS NOT NULL
    AND u.email_confirmed_at IS NOT NULL
    AND btrim(p_query) <> ''
    AND p.display_name ILIKE '%' || btrim(p_query) || '%'
  ORDER BY p.display_name NULLS LAST, p.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 25);
$$;

GRANT EXECUTE ON FUNCTION public.is_auth_user_confirmed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_confirmed_member_profiles(text, integer) TO authenticated;

SELECT '✓ confirmed-only profiles and member search applied' AS status;
