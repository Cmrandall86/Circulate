-- ============================================================
-- Migration 12: Restrict get_user_email() to admin callers only
-- ============================================================
-- Replaces the unguarded version from migration 10.
-- Non-admin callers (including unauthenticated or profileless users)
-- receive an exception rather than a result.
-- Also pins search_path per SECURITY DEFINER best practice.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_email(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  IF COALESCE((SELECT role FROM public.profiles WHERE id = auth.uid()), 'member') != 'admin' THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_id;

  RETURN user_email;
END;
$$;

-- ✓ get_user_email restricted to admin callers
SELECT '✓ get_user_email restricted to admin callers' AS status;
