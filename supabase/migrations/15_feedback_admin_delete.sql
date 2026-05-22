-- ============================================================
-- Migration 15: Admin delete policy for feedback
-- ============================================================
-- Adds a DELETE policy so admins can permanently remove feedback
-- rows from the handled (completed / archived) view. The policy
-- uses the public.is_admin() SECURITY DEFINER helper (introduced
-- in migration 14) for safe, recursion-free admin role checks.
--
-- No change to INSERT, SELECT, or UPDATE policies.
-- Users still cannot delete their own feedback rows.
-- ============================================================

CREATE POLICY "feedback_delete_admin" ON public.feedback
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ✓ feedback admin delete policy created
SELECT '✓ feedback admin delete policy created' AS status;
