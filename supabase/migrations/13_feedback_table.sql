-- ============================================================
-- Migration 13: Feedback table + RLS
-- ============================================================
-- Stores user-submitted feedback (bug reports, feature requests,
-- questions, general). Feedback is never deleted; admins can
-- mark items completed or archived. users can only see their own.
-- ============================================================

CREATE TABLE public.feedback (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  type       text        NOT NULL CHECK (type IN ('bug', 'feature_request', 'question', 'general')),
  message    text        NOT NULL,
  page_url   text,
  user_agent text,
  status     text        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'completed', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- INSERT: authenticated users may submit their own feedback only
CREATE POLICY "feedback_insert_own"
  ON public.feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- SELECT (own): authenticated users can read their own submissions
CREATE POLICY "feedback_select_own"
  ON public.feedback
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- SELECT (admin): admins can read all feedback
CREATE POLICY "feedback_select_admin"
  ON public.feedback
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- UPDATE (admin): admins can update status (complete / archive)
CREATE POLICY "feedback_update_admin"
  ON public.feedback
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- No DELETE policy — feedback is retained, never permanently deleted in MVP

-- ✓ feedback table and RLS policies created
SELECT '✓ feedback table and RLS policies created' AS status;
