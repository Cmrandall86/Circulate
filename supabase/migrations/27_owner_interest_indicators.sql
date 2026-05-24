-- Migration 27: owner interest indicators (#15)

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS owner_interests_viewed_at timestamptz;

COMMENT ON COLUMN public.items.owner_interests_viewed_at IS
  'When the item owner last viewed the interest queue on item detail.';

CREATE OR REPLACE FUNCTION public.mark_item_interests_viewed(p_item_id uuid)
RETURNS public.items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_item public.items;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT owner_id
  INTO v_owner_id
  FROM public.items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  IF v_owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the item owner can mark interests viewed';
  END IF;

  UPDATE public.items
  SET owner_interests_viewed_at = now(),
      updated_at = now()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_owner_interest_indicators()
RETURNS TABLE (
  item_id uuid,
  interest_count bigint,
  has_unread boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id AS item_id,
    COUNT(intr.id) AS interest_count,
    COALESCE(
      BOOL_OR(
        intr.created_at > COALESCE(i.owner_interests_viewed_at, '-infinity'::timestamptz)
      ),
      false
    ) AS has_unread
  FROM public.items i
  LEFT JOIN public.interests intr ON intr.item_id = i.id
  WHERE i.owner_id = auth.uid()
    AND i.status = 'available'
    AND auth.uid() IS NOT NULL
  GROUP BY i.id, i.owner_interests_viewed_at
  HAVING COUNT(intr.id) > 0;
$$;

GRANT EXECUTE ON FUNCTION public.mark_item_interests_viewed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_interest_indicators() TO authenticated;

SELECT '✓ owner interest indicator RPCs applied' AS status;
