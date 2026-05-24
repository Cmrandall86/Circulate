-- Migration 22: cancel reservation + expired reservation recovery (issue #12)

CREATE OR REPLACE FUNCTION public.recover_expired_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.reservations r
    SET status = 'expired'
    WHERE r.status = 'active'
      AND r.expires_at IS NOT NULL
      AND r.expires_at < now()
    RETURNING r.item_id
  ),
  revived AS (
    UPDATE public.items i
    SET status = 'available',
        updated_at = now()
    FROM expired e
    WHERE i.id = e.item_id
      AND i.status = 'reserved'
    RETURNING i.id
  )
  SELECT count(*)::integer INTO v_count FROM expired;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_item_reservation(p_item_id uuid)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_item_status text;
  v_reservation public.reservations;
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
    RAISE EXCEPTION 'Only the item owner can cancel a reservation';
  END IF;

  IF v_item_status <> 'reserved' THEN
    RAISE EXCEPTION 'Item does not have an active reservation';
  END IF;

  UPDATE public.reservations
  SET status = 'cancelled'
  WHERE item_id = p_item_id
    AND status = 'active'
  RETURNING * INTO v_reservation;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active reservation found for this item';
  END IF;

  UPDATE public.items
  SET status = 'available',
      updated_at = now()
  WHERE id = p_item_id;

  RETURN v_reservation;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recover_expired_reservations() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cancel_item_reservation(uuid) TO authenticated;

SELECT '✓ cancel_item_reservation and recover_expired_reservations applied' AS status;
