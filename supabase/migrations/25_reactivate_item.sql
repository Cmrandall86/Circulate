-- Migration 25: reactivate archived items without completed handoff (#13 polish)

CREATE OR REPLACE FUNCTION public.reactivate_item(p_item_id uuid)
RETURNS public.items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_item_status text;
  v_item public.items;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT owner_id, status
  INTO v_owner_id, v_item_status
  FROM public.items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  IF v_owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the item owner can reactivate this item';
  END IF;

  IF v_item_status <> 'archived' THEN
    RAISE EXCEPTION 'Only archived items can be returned to the feed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.reservations
    WHERE item_id = p_item_id
      AND status = 'fulfilled'
  ) THEN
    RAISE EXCEPTION 'Completed handoffs cannot be returned to the feed';
  END IF;

  UPDATE public.items
  SET status = 'available',
      updated_at = now()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reactivate_item(uuid) TO authenticated;

SELECT '✓ reactivate_item RPC applied' AS status;
