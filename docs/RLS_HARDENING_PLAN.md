# RLS Hardening Plan

## Current State

RLS is **riskier than it looks.** Only `group_members` has RLS active (migration 07). Seven tables are fully unprotected, including `profiles` (which stores the `role` field), `items`, and `groups`.

The `visibility` column on `items` is decorative — it controls nothing right now.

### Archive Script History

Multiple failed RLS attempts are recorded in the archive scripts:

- Recursion loop: `items → item_visibility_groups → group_members → items`
- Broken storage paths (migration 08 vs 11)
- `TEMP-DISABLE-RLS.sql` nuclear rollback

The root cause of all recursion failures has a clean fix: a single `SECURITY DEFINER` helper function (see below).

---

## Live Issues (Fix Before Enabling Any RLS)

### 1. `get_user_email()` — PII Exposure

`get_user_email()` (migration 10) exposes any user's email to any authenticated caller. This is unrelated to RLS — the function body is simply missing a role check.

**Fix:** Add a guard inside the function:

```sql
IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'admin' THEN
  RAISE EXCEPTION 'Access denied';
END IF;
```

Zero breakage risk. Fixes a live PII exposure.

### 2. Migration 03 — Broken Index References

Migration 03 contains two index lines referencing `group_invitations` and `group_join_requests`. These will block any future `supabase migration up` run until removed.

**Fix:** Remove the two broken index lines from migration 03.

### 3. Audit `items.visibility` Values Before Enabling Items RLS

**Fix:** Run before touching `items` RLS:

```sql
SELECT visibility, COUNT(*) FROM items GROUP BY visibility;
```

If any rows are not `'public'`, enabling items RLS will blank the feed for those items.

---

## Recursion-Safe Architecture

The entire policy set hinges on one helper function that breaks the recursion chain:

```sql
CREATE OR REPLACE FUNCTION public.user_in_item_groups(item_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM item_visibility_groups ivg
    JOIN group_members gm ON gm.group_id = ivg.group_id
    WHERE ivg.item_id = item_uuid
      AND gm.user_id = user_uuid
  );
$$;
```

`SECURITY DEFINER` breaks the `items → item_visibility_groups → group_members → items` cycle that caused all previous recursion crashes. All downstream policies should call this function rather than joining those tables directly.

---

## Known Gap: Admin Image Deletion

`useDeleteImage(bypassOwnerCheck: true)` bypasses the frontend owner check but still uses the normal Supabase client. Once `item_images` has RLS, storage `DELETE` calls from that hook will be rejected by policy.

- Full-item admin delete via Edge Function (service role) is **not affected**.
- Only affected case: individual image removal during an admin's edit of a non-owned item.
- This can be **deferred to Phase 5**.

---

## Phased Rollout

### Phase 1 — Minimal First Steps (No Schema Changes)
1. ~~Restrict `get_user_email()` — add role check to function body.~~ **Done** (migration 12)
2. Fix migration 03 — remove broken index lines.
3. Audit `items.visibility` values in production.

### Phase 2 — Deploy Recursion-Safe Helper
1. Create `public.user_in_item_groups(item_uuid, user_uuid)` as `SECURITY DEFINER`.
2. Verify function resolves correctly against current data.

### Phase 3 — Enable RLS on Core Tables
1. Enable RLS on `items` with `visibility`-aware policies using the helper.
2. Enable RLS on `profiles` (read: own row + admin; write: own row only).
3. Enable RLS on `groups`.

### Phase 4 — Enable RLS on Relational Tables
1. `item_visibility_groups`
2. `group_members` (already has RLS — audit existing policy)
3. `item_images`

### Phase 5 — Admin Image Deletion Fix
1. Update `useDeleteImage` admin path to use service-role client or Edge Function.

---

## Migration Notes

- All policy changes should be applied as new numbered migrations — do not edit existing ones.
- Test each phase against a production-like `items.visibility` distribution before deploying.
- The `TEMP-DISABLE-RLS.sql` rollback script should be kept available through Phase 4.
