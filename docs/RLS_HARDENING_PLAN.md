# RLS Hardening Plan

> **Archival / reference document.** The high-signal summary (current state, recursion risk, phased rollout, admin image gap) has been consolidated into `docs/ACTIVE_CONTEXT.md §9`. Refer to this file when actively implementing a specific RLS phase — particularly for the full `user_in_item_groups()` function definition and migration-level details. Do not load this file as startup context for general sessions.

## Current State (as of migration 14 — May 19 2026)

RLS is **enabled on all core tables** with a normalised, production-correct policy set.

| Table | RLS | Notes |
|---|---|---|
| `items` | ✅ | `items_select`: public / owner / `user_in_item_groups()` / `is_admin()` |
| `profiles` | ✅ | `profiles_*_simple` policies (existing) |
| `groups` | ✅ | `groups_*` owner-scoped policies (existing) |
| `group_members` | ✅ | `gm_delete` patched for member self-leave |
| `item_visibility_groups` | ✅ | `ivg_select` / `ivg_write` (existing) |
| `item_images` | ✅ | `item_images_select` mirrors item visibility |
| `feedback` | ✅ | Admin policies use `is_admin()` |
| `interests` | ❌ | Phase 4 |
| `reservations` | ❌ | Phase 4 / claim feature |

`items.visibility` is now **enforced at the DB level**. The recursion problem is solved.

**Helper functions:**
- `public.user_in_item_groups(item_uuid, user_uuid)` — SECURITY DEFINER, STABLE (canonical since migration 14)
- `public.is_admin()` (zero-arg) — SECURITY DEFINER, STABLE (new in migration 14)
- `public.is_admin(uid uuid)` (old, one-arg) — NOT SECURITY DEFINER; do not use in new policies

### Prior Failure History

Multiple failed RLS attempts recorded in archive scripts:

- Recursion loop: `items → item_visibility_groups → group_members → items`
- Broken storage paths (migration 08 vs 11)
- `TEMP-DISABLE-RLS.sql` nuclear rollback

The root cause of all recursion failures has a clean fix: the `SECURITY DEFINER` helper (deployed, see above).

---

## Pre-Deployment Checklist (completed)

### 1. `get_user_email()` — PII Exposure ✅ Fixed (migration 12)

Admin-only guard added to the function body.

### 2. Migration 03 — Broken Index References ✅ Fixed

Broken index lines referencing `group_invitations` and `group_join_requests` removed.

### 3. Audit `items.visibility` Values ✅ Done

All rows were `'public'`, no nulls. Safe to proceed.

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

### Phase 1 — Minimal First Steps ✅ Done
1. ~~Restrict `get_user_email()` — add role check to function body.~~ Done (migration 12)
2. ~~Fix migration 03 — remove broken index lines.~~ Done
3. ~~Audit `items.visibility` values in production.~~ Done — all rows `'public'`

### Phase 2 — Deploy Recursion-Safe Helpers ✅ Done (migration 14)
1. ~~`public.user_in_item_groups(item_uuid, user_uuid)` — canonicalised via `CREATE OR REPLACE`, SECURITY DEFINER/STABLE.~~
2. ~~`public.is_admin()` (zero-arg) — new SECURITY DEFINER/STABLE helper added.~~
3. ~~`gm_delete` patched — non-owner members can self-leave; last-owner guard preserved.~~

### Phase 3 — Normalise Core Table Policies ✅ Done (migration 14)
1. ~~`items_select` — replaced `items_select_simple`; full visibility logic: public / owner / group / admin.~~
2. ~~`item_images_select` — replaced; mirrors item visibility via correlated subquery.~~
3. ~~`feedback` admin policies — replaced inline profiles subqueries with `is_admin()`.~~

> Phases 2 and 3 were applied in a single migration (14_rls_normalization.sql) because production RLS was already enabled on all core tables with incomplete policies — the work was corrective rather than additive.

### Phase 4 — Enable RLS on Remaining Tables (Pending)
1. Enable RLS on `interests` with appropriate read/write policies.
2. Audit `ivg_*` and `group_members` policies under load.
3. `reservations` — policy design depends on claim feature design.

### Phase 5 — Admin Image Deletion Fix (Pending)
1. `useDeleteImage(bypassOwnerCheck: true)` uses normal client; blocked by `item_images_write` for admin edits of non-owned items. Update to use service-role path or route through `admin-items` Edge Function.

---

## Migration Notes

- All policy changes should be applied as new numbered migrations — do not edit existing ones.
- Test each phase against a production-like `items.visibility` distribution before deploying.
- The `TEMP-DISABLE-RLS.sql` rollback script should be kept available through Phase 4.
