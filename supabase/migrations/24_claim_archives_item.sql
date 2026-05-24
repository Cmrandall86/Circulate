-- Migration 24: claim completes as archived (#13 polish)
-- Handoff-complete items leave the browse feed; distinction via reservations.status = 'fulfilled'.

UPDATE public.items
SET status = 'archived',
    updated_at = now()
WHERE status = 'claimed';

CREATE OR REPLACE FUNCTION public.mark_item_claimed(p_item_id uuid)
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
    RAISE EXCEPTION 'Only the item owner can mark an item as claimed';
  END IF;

  IF v_item_status <> 'reserved' THEN
    RAISE EXCEPTION 'Only reserved items can be marked as claimed';
  END IF;

  UPDATE public.reservations
  SET status = 'fulfilled'
  WHERE item_id = p_item_id
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active reservation found for this item';
  END IF;

  UPDATE public.items
  SET status = 'archived',
      updated_at = now()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_item(p_item_id uuid)
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
    RAISE EXCEPTION 'Only the item owner can archive this item';
  END IF;

  IF v_item_status = 'archived' THEN
    RAISE EXCEPTION 'Item is already archived';
  END IF;

  IF v_item_status NOT IN ('available', 'reserved') THEN
    RAISE EXCEPTION 'Item cannot be archived from its current status';
  END IF;

  UPDATE public.reservations
  SET status = 'cancelled'
  WHERE item_id = p_item_id
    AND status = 'active';

  UPDATE public.items
  SET status = 'archived',
      updated_at = now()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

SELECT '✓ mark_item_claimed archives items; claimed rows backfilled' AS status;
