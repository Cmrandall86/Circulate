# Supabase Backend Overview

Supabase backend for the Circulate project (Postgres 15, Auth, Storage, Edge Functions).

## Directory Structure

```
supabase/
├── bootstrap.sql             # Initial schema (⚠️ has known drift — see README Known Issues)
├── backfill-profiles.sql     # One-off utility to backfill profiles for existing auth users
├── config.toml               # Supabase CLI configuration
├── migrations/               # Applied migrations — do NOT delete or rename
│   ├── 03_indexes_and_constraints.sql
│   ├── 06_trigger_add_owner.sql
│   ├── 07_policies_group_members.sql
│   ├── 08_storage_policies_images.sql  ⚠️ superseded by 11 — see Known Issues
│   ├── 10_get_user_email_function.sql
│   ├── 11_storage_policies_images.sql
│   └── 12_restrict_get_user_email.sql
└── functions/
    ├── admin-users/          # User management (list, create, edit role, ban, delete)
    └── admin-items/          # Item moderation (fetch, archive, update, delete)
```

## Key Files

### `bootstrap.sql`
Initial database schema. Contains table definitions (`profiles`, `groups`, `group_members`, `items`, `item_images`, `item_visibility_groups`, `interests`, `reservations`), the `handle_new_user` trigger, the `profiles_guard_role` trigger, and the `get_my_role()` RPC.

⚠️ Does **not** include `items.visibility` column or any `enable row level security` statements. See `README.md` Known Issues.

### `backfill-profiles.sql`
Run once in the SQL editor if you have existing `auth.users` rows without corresponding `profiles` rows.

## Migrations

Applied sequentially. **Do not delete or rename these files.**

| File | Notes |
|---|---|
| `03_indexes_and_constraints.sql` | `group_members` indexes + `uq_group_single_owner` constraint |
| `06_trigger_add_owner.sql` | `add_owner_membership` trigger — auto-creates owner's `group_members` row |
| `07_policies_group_members.sql` | Enables RLS on `group_members` |
| `08_storage_policies_images.sql` | ⚠️ Grants anon SELECT on entire `images` bucket — do not apply; superseded by `11` |
| `10_get_user_email_function.sql` | Creates `get_user_email(uuid)` — apply together with `12` |
| `11_storage_policies_images.sql` | Item-scoped storage policies — requires `items.visibility` column patch first |
| `12_restrict_get_user_email.sql` | Restricts `get_user_email` to admin callers only |

## Edge Functions

Both functions verify the caller's JWT and check `profiles.role === 'admin'` before using service-role.

### `admin-users`
User management: list, create, update (display name, role, password), soft-ban, hard-delete.

### `admin-items`
Item moderation:
- `GET /:id` — fetch any item + signed images (bypasses RLS)
- `PATCH /:id { action: 'archive' }` — set `status = 'archived'`
- `PATCH /:id { action: 'update' }` — update fields + visibility groups for items the admin doesn't own
- `DELETE /:id` — hard delete (storage objects → related rows → item row)

See `docs/deploy-edge-functions.md` for deployment steps.

## Local Development

```bash
# Link to your project
supabase link --project-ref your-project-ref

# Deploy a function
supabase functions deploy admin-users
supabase functions deploy admin-items

# Set function secrets
supabase secrets set \
  SUPABASE_URL=https://your-project.supabase.co \
  SUPABASE_ANON_KEY=your-anon-key \
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  ALLOW_ORIGINS=http://localhost:5173,https://use-circulate.netlify.app
```

## RLS Status

Only `group_members` has RLS enabled (migration 07). All other public-schema tables are unprotected. See `docs/RLS_HARDENING_PLAN.md` for the phased rollout plan.

Emergency RLS rollback script is at `docs/TEMP-DISABLE-RLS.sql` — keep accessible through Phase 4.
