-- Migration 16: Item lifecycle statuses
-- Normalizes items.status from legacy 'active' to V1 lifecycle values.
-- Rollback: remove check constraint; map 'available' back to 'active' if needed.

UPDATE public.items
SET status = 'available'
WHERE status = 'active';

ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_status_check;

ALTER TABLE public.items
  ADD CONSTRAINT items_status_check
  CHECK (status IN ('available', 'reserved', 'claimed', 'archived'));

ALTER TABLE public.items
  ALTER COLUMN status SET DEFAULT 'available';

SELECT '✓ Item lifecycle statuses migration complete' AS status;
