-- Migration 21: atomic create reservation (issue #10)
-- One active reservation per item; owner picks from interest queue via RPC.

CREATE UNIQUE INDEX IF NOT EXISTS reservations_one_active_per_item
  ON public.reservations (item_id)
  WHERE status = 'active';

DROP POLICY IF EXISTS "reservations_insert" ON public.reservations;
CREATE POLICY "reservations_insert" ON public.reservations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = item_id
      AND i.owner_id = auth.uid()
      AND i.status = 'available'
  )
  AND EXISTS (
    SELECT 1 FROM public.interests int
    WHERE int.item_id = item_id
      AND int.user_id = claimer_id
  )
);

CREATE OR REPLACE FUNCTION public.create_item_reservation(
  p_item_id uuid,
  p_claimer_id uuid
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

  INSERT INTO public.reservations (item_id, claimer_id, expires_at, status)
  VALUES (p_item_id, p_claimer_id, now() + interval '7 days', 'active')
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

GRANT EXECUTE ON FUNCTION public.create_item_reservation(uuid, uuid) TO authenticated;

SELECT '✓ create_item_reservation RPC and one-active-per-item index applied' AS status;
