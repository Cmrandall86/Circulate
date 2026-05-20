-- ============================================================
-- Migration 14: RLS normalization
-- ============================================================
-- Production already has RLS enabled on core tables but with
-- incomplete policies. Specifically:
--   • items_select_simple: missing group visibility and admin bypass
--   • item_images_select: missing group visibility and admin bypass
--   • gm_delete: no self-leave path for regular members
--   • feedback admin policies: inline profiles subqueries unsafe
--     when profiles has RLS enabled
--
-- This migration:
--   1. Canonicalises user_in_item_groups() (already correct in prod)
--   2. Adds a zero-arg is_admin() SECURITY DEFINER helper
--   3. Patches gm_delete to allow member self-leave
--   4. Replaces items SELECT policy with full visibility logic
--   5. Replaces item_images SELECT policy to mirror item visibility
--   6. Replaces feedback admin policies to use is_admin()
--
-- No RLS is enabled or disabled. No write policies are modified.
-- No other tables or policies are touched.
-- ============================================================

-- ------------------------------------------------------------
-- 1. user_in_item_groups — canonicalise recursion-safe helper
-- ------------------------------------------------------------
-- Already exists in production with correct definition. CREATE OR
-- REPLACE makes this migration the authoritative source of truth.
--
-- SECURITY DEFINER breaks the cross-table recursion chain that
-- crashed every prior RLS attempt:
--   items → item_visibility_groups → group_members → items
-- The items SELECT policy must call this function; it must never
-- join item_visibility_groups or group_members inline in a policy.

CREATE OR REPLACE FUNCTION public.user_in_item_groups(item_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM item_visibility_groups ivg
    JOIN group_members gm ON gm.group_id = ivg.group_id
    WHERE ivg.item_id = item_uuid
      AND gm.user_id = user_uuid
  );
$$;

-- ------------------------------------------------------------
-- 2. is_admin() — zero-arg SECURITY DEFINER role check
-- ------------------------------------------------------------
-- The existing is_admin(uid uuid) has a different signature (one arg
-- vs zero). Postgres distinguishes overloads by argument types; these
-- two functions coexist without conflict. The old function is not
-- modified.
--
-- A zero-arg helper is needed for policies on tables that already
-- have RLS enabled (including profiles itself). An inline subquery
-- on profiles inside a profiles policy re-evaluates that same policy,
-- causing infinite recursion. SECURITY DEFINER bypasses RLS for the
-- inner profiles read, breaking the cycle safely.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- ------------------------------------------------------------
-- 3. Patch group_members delete policy — add member self-leave
-- ------------------------------------------------------------
-- The prior gm_delete only permitted group owners to remove member
-- rows. Regular members had no path to leave a group voluntarily,
-- causing useLeaveGroup() to silently return zero rows deleted.
--
-- Clause A (owner-remove): the group's designated owner
--   (groups.owner_id = auth.uid()) may delete any member row,
--   except the sole remaining row with role = 'owner'. This prevents
--   orphaning the group without an owner.
--
-- Clause B (self-leave): any authenticated member may delete their
--   own group_members row provided their current role is not 'owner'.
--   Owners must transfer ownership or delete the group before leaving.
--
-- gm_select, gm_insert, and gm_update are not changed.

DROP POLICY IF EXISTS "gm_delete" ON public.group_members;

CREATE POLICY "gm_delete" ON public.group_members
FOR DELETE
TO authenticated
USING (
  -- Clause A: group owner removes a member, protecting the last owner
  (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_members.group_id
        AND g.owner_id = auth.uid()
    )
    AND NOT (
      group_members.role = 'owner'
      AND (
        SELECT COUNT(*)
        FROM public.group_members x
        WHERE x.group_id = group_members.group_id
          AND x.role = 'owner'
      ) = 1
    )
  )
  OR
  -- Clause B: non-owner member self-leave
  (
    group_members.user_id = auth.uid()
    AND group_members.role <> 'owner'
  )
);

-- ------------------------------------------------------------
-- 4. Replace items SELECT policy — full visibility logic
-- ------------------------------------------------------------
-- items_select_simple only covered public items and owned items.
-- Group-visible items were invisible to group members. Admins
-- relying on the feed (useFeed uses the normal client for all users)
-- could not see non-public non-owned items.
--
-- New policy covers all four cases:
--   • public items — visible to everyone including unauthenticated
--   • owner — always sees their own items
--   • groups — authenticated member of a group the item was shared to
--   • admin — sees all items (needed for feed-based moderation)
--
-- auth.uid() IS NOT NULL guard on the groups clause prevents passing
-- NULL into user_in_item_groups for unauthenticated requests.
-- items_insert, items_update, and items_delete are not changed.

DROP POLICY IF EXISTS "items_select_simple" ON public.items;

CREATE POLICY "items_select" ON public.items
FOR SELECT
USING (
  visibility = 'public'
  OR owner_id = auth.uid()
  OR (
    visibility = 'groups'
    AND auth.uid() IS NOT NULL
    AND public.user_in_item_groups(items.id, auth.uid())
  )
  OR public.is_admin()
);

-- ------------------------------------------------------------
-- 5. Replace item_images SELECT policy — mirror item visibility
-- ------------------------------------------------------------
-- item_images_select only covered public/owner cases. Group members
-- could not load images for group-visible items.
--
-- The new policy mirrors the items SELECT logic exactly via a
-- correlated subquery on items. This join direction (item_images →
-- items) does not re-enter the item_images policy, so no recursion
-- is introduced. item_images_write is not changed.

DROP POLICY IF EXISTS "item_images_select" ON public.item_images;

CREATE POLICY "item_images_select" ON public.item_images
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = item_images.item_id
      AND (
        i.visibility = 'public'
        OR i.owner_id = auth.uid()
        OR (
          i.visibility = 'groups'
          AND auth.uid() IS NOT NULL
          AND public.user_in_item_groups(i.id, auth.uid())
        )
        OR public.is_admin()
      )
  )
);

-- ------------------------------------------------------------
-- 6. Replace feedback admin policies — use is_admin()
-- ------------------------------------------------------------
-- Profiles has RLS enabled. The prior inline subquery
--   EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
-- inside feedback policies evaluated profiles under its own RLS.
-- Depending on the profiles SELECT policy content, this may work
-- today but is fragile. Replacing with is_admin() (SECURITY DEFINER)
-- makes the role check unconditionally safe regardless of profiles
-- policy state. Logic is semantically equivalent; only the mechanism
-- changes. feedback_insert_own and feedback_select_own are not changed.

DROP POLICY IF EXISTS "feedback_select_admin" ON public.feedback;
DROP POLICY IF EXISTS "feedback_update_admin" ON public.feedback;

CREATE POLICY "feedback_select_admin" ON public.feedback
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "feedback_update_admin" ON public.feedback
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ✓ RLS normalization complete
SELECT '✓ RLS normalization complete' AS status;
