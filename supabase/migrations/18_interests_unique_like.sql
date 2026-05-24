-- Migration 18: interests unique constraint + like level default
-- One interest per member per item. Normalizes legacy state 'interested' → 'like'.

-- Remove duplicate rows if any (keep earliest)
DELETE FROM public.interests a
USING public.interests b
WHERE a.item_id = b.item_id
  AND a.user_id = b.user_id
  AND a.created_at > b.created_at;

UPDATE public.interests
SET state = 'like'
WHERE state IS DISTINCT FROM 'like';

ALTER TABLE public.interests
  ALTER COLUMN state SET DEFAULT 'like';

ALTER TABLE public.interests
  DROP CONSTRAINT IF EXISTS interests_item_id_user_id_key;

ALTER TABLE public.interests
  ADD CONSTRAINT interests_item_id_user_id_key UNIQUE (item_id, user_id);

SELECT '✓ Interests unique constraint migration complete' AS status;
