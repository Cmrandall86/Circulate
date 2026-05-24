-- Migration 20: constrain interests.state to V1 interest levels (need / like / take)

ALTER TABLE public.interests
  DROP CONSTRAINT IF EXISTS interests_state_check;

ALTER TABLE public.interests
  ADD CONSTRAINT interests_state_check
  CHECK (state IN ('need', 'like', 'take'));

SELECT '✓ Interest level CHECK constraint applied' AS status;
