-- Migration 28: reservation expiry presets at reserve time (issue #11)

DROP FUNCTION IF EXISTS public.create_item_reservation(uuid, uuid);

CREATE OR REPLACE FUNCTION public.create_item_reservation(
  p_item_id uuid,
  p_claimer_id uuid,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_item_status text;
  v_reservation public.reservations;
  v_expires_at timestamptz;
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
    RAISE EXCEPTION 'Only the item owner can create a reservation';
  END IF;

  IF v_item_status <> 'available' THEN
    RAISE EXCEPTION 'Item is not available for reservation';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.interests
    WHERE item_id = p_item_id
      AND user_id = p_claimer_id
  ) THEN
    RAISE EXCEPTION 'Member is not in the interest queue for this item';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.reservations
    WHERE item_id = p_item_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Item already has an active reservation';
  END IF;

  IF p_expires_at IS NULL THEN
    v_expires_at := NULL;
  ELSE
    IF p_expires_at <= now() THEN
      RAISE EXCEPTION 'Reservation expiry must be in the future';
    END IF;

    IF p_expires_at > now() + interval '30 days' THEN
      RAISE EXCEPTION 'Reservation expiry cannot be more than 30 days from now';
    END IF;

    v_expires_at := p_expires_at;
  END IF;

  INSERT INTO public.reservations (item_id, claimer_id, expires_at, status)
  VALUES (p_item_id, p_claimer_id, v_expires_at, 'active')
  RETURNING * INTO v_reservation;

  UPDATE public.items
  SET status = 'reserved',
      updated_at = now()
  WHERE id = p_item_id;

  RETURN v_reservation;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Item already has an active reservation';
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_item_reservation(uuid, uuid, timestamptz) TO authenticated;

SELECT '✓ create_item_reservation expiry presets applied' AS status;
