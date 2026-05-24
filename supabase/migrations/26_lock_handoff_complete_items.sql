-- Migration 26: lock handoff-complete archived items from edits (#13 polish)

CREATE OR REPLACE FUNCTION public.prevent_handoff_complete_item_edit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'archived'
     AND EXISTS (
       SELECT 1
       FROM public.reservations r
       WHERE r.item_id = OLD.id
         AND r.status = 'fulfilled'
     ) THEN
    RAISE EXCEPTION 'Completed handoff items cannot be edited';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_handoff_complete_item_edit ON public.items;

CREATE TRIGGER trg_prevent_handoff_complete_item_edit
  BEFORE UPDATE ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_handoff_complete_item_edit();

SELECT '✓ handoff-complete item edit lock applied' AS status;
