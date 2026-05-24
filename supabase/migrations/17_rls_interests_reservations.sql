-- ============================================================
-- Migration 17: RLS for interests and reservations
-- ============================================================
-- Phase 4 gap: interests and reservations had no RLS.
--
-- Interests visibility delegates to items SELECT RLS via correlated
-- subquery (same pattern as item_images in migration 14).
--
-- Rollback:
--   DROP POLICY IF EXISTS ... on interests/reservations;
--   ALTER TABLE public.interests DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.reservations DISABLE ROW LEVEL SECURITY;
-- ============================================================

ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Drop reference-policy names if ever applied manually
DROP POLICY IF EXISTS "interest read if related" ON public.interests;
DROP POLICY IF EXISTS "interest insert if can see item" ON public.interests;
DROP POLICY IF EXISTS "interest update/delete by author or item owner" ON public.interests;
DROP POLICY IF EXISTS "reservation read if related" ON public.reservations;
DROP POLICY IF EXISTS "reservation write by item owner" ON public.reservations;

-- ------------------------------------------------------------
-- interests
-- ------------------------------------------------------------
-- SELECT: any row whose item is visible to the current user
-- (items RLS filters the subquery).

DROP POLICY IF EXISTS "interests_select" ON public.interests;
CREATE POLICY "interests_select" ON public.interests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = interests.item_id
  )
);

-- INSERT: member expresses own interest on an available item they can see.

DROP POLICY IF EXISTS "interests_insert" ON public.interests;
CREATE POLICY "interests_insert" ON public.interests
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = item_id
      AND i.status = 'available'
  )
);

-- UPDATE: author adjusts level; item owner may update rows on their item.

DROP POLICY IF EXISTS "interests_update" ON public.interests;
CREATE POLICY "interests_update" ON public.interests
FOR UPDATE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = interests.item_id
      AND i.owner_id = auth.uid()
  )
)
WITH CHECK (
  (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.items i
      WHERE i.id = item_id
        AND i.status = 'available'
    )
  )
  OR EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = item_id
      AND i.owner_id = auth.uid()
  )
);

-- DELETE: author withdraws; item owner may remove rows on their item.

DROP POLICY IF EXISTS "interests_delete" ON public.interests;
CREATE POLICY "interests_delete" ON public.interests
FOR DELETE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = interests.item_id
      AND i.owner_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- reservations
-- ------------------------------------------------------------
-- SELECT: item owner, selected claimer, or platform admin.

DROP POLICY IF EXISTS "reservations_select" ON public.reservations;
CREATE POLICY "reservations_select" ON public.reservations
FOR SELECT
USING (
  auth.uid() = claimer_id
  OR EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = reservations.item_id
      AND i.owner_id = auth.uid()
  )
  OR public.is_admin()
);

-- INSERT / UPDATE / DELETE: item owner only.

DROP POLICY IF EXISTS "reservations_insert" ON public.reservations;
CREATE POLICY "reservations_insert" ON public.reservations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = item_id
      AND i.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "reservations_update" ON public.reservations;
CREATE POLICY "reservations_update" ON public.reservations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = reservations.item_id
      AND i.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = item_id
      AND i.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "reservations_delete" ON public.reservations;
CREATE POLICY "reservations_delete" ON public.reservations
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = reservations.item_id
      AND i.owner_id = auth.uid()
  )
);

SELECT '✓ RLS for interests and reservations complete' AS status;
