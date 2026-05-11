# Active Context — Circulate

> Internal engineering working memory. Summarises project state, decisions, and priorities for new Cursor chats. Not a user-facing document. For full detail see `README.md`.

Last updated: May 2026

---

## 1. Product Summary

**Circulate** is a private-first community item-sharing platform. Users post items they want to give away, control who can see them (public or specific groups/circles), and browse what others are offering.

- Single trusted platform admin (one operator, not a multi-moderator system)
- Sharing model: items are `public` (anyone) or `groups` (members of selected groups only)
- No marketplace mechanics yet — no payments, no shipping, community trust model
- Production URL: **https://use-circulate.netlify.app**
- GitHub repo: `Cmrandall86/Stuff-Cycler` (repo not yet renamed on GitHub)

---

## 2. Current Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript (strict), Vite 5 |
| Router | TanStack Router 1.x (imperative route tree in `web/src/main.tsx`) |
| Server state | TanStack Query 5 (shared `QueryClient`, 60 s `staleTime`) |
| Styling | Tailwind 3 + CSS custom-property tokens (`web/src/theme/tokens.css`) |
| Backend | Supabase (Postgres 15, Auth, Storage, Edge Functions) |
| Edge runtime | Deno (Supabase Edge Functions) |
| Hosting | Netlify (frontend), Supabase Cloud (backend) |
| Path alias | `@/*` → `web/src/*` |

---

## 3. Important Architectural Decisions

### Admin model
- Admin role is stored on `profiles.role` (`'member'` | `'admin'`)
- Admins bypass group visibility restrictions and can act on any item
- **No separate moderation dashboard.** Admin moderation happens through the normal feed, item detail, and item edit pages
- Admin controls (Edit / Archive / Delete) appear on `/item/$id` and `/item/$id/edit` when `role === 'admin'`
- A yellow admin notice is shown when an admin views/edits another user's item

### Edge Functions — narrow use only
Two Edge Functions exist. Both verify the caller's JWT and check `profiles.role === 'admin'` before using service-role:

- **`admin-users`** — user management (list, create, update, ban, hard delete)
- **`admin-items`** — item admin operations that RLS would otherwise block:
  - `GET /:id` — fetch any item + signed images (bypasses RLS)
  - `PATCH /:id { action: 'archive' }` — set `status = 'archived'`
  - `PATCH /:id { action: 'update' }` — update fields + visibility groups for items the admin doesn't own
  - `DELETE /:id` — hard delete (storage objects → related rows → item row)

The **feed does not use the admin-items Edge Function**. The `items` table has no RLS enabled (per `bootstrap.sql`), so the normal Supabase client query already returns all items for all users. If RLS is added to `items` in the future, `useFeed.ts` will need to be revisited.

### Storage
- Private bucket: `images`
- Path convention: `items/{itemId}/{filename}`
- All image reads go through 1-hour signed URLs

### Auth
- Email/password, Google OAuth, Discord OAuth — all working on the new Supabase project
- Session provided through `AuthProvider` → `useAuth()` hook
- Role loaded via `get_my_role()` RPC → `useRole()` hook
- `<AuthGate>` — requires any session; `<AdminGate>` — requires `role === 'admin'`

### Groups
- `groups` owned by a user, many-to-many membership in `group_members`
- Owner gets a `group_members` row automatically via `add_owner_membership` trigger (migration 06)
- Item visibility to groups via `item_visibility_groups` join table

---

## 4. Current Technical Debt (short list)

- **RLS not enabled** on most tables (`items`, `groups`, `profiles`, `item_images`, etc.). Only `group_members` has RLS (migration 07). The `visibility` column is currently decorative.
- **Schema drift**: `items.visibility` column exists in production but is absent from `bootstrap.sql`. Migration `03` references tables (`group_invitations`, `group_join_requests`) that don't exist.
- **Migration gaps**: non-sequential numbering (03, 06, 07, 08, 10, 11); migrations 08 and 11 for storage are contradictory.
- **Hand-rolled types**: `web/src/lib/types.ts` is manually maintained. No `supabase gen types typescript` run yet.
- **Query key inconsistency**: item detail/edit use `['item', id]`; `itemKeys.one(id)` is `['items', id]`. Detail views won't refresh after edits until stale.
- ~~**`get_user_email()` PII risk**~~ — fixed in migration 12; function now restricted to admin callers only.
- `zod` installed but never used.
- No `typecheck` script was missing (now added: `"typecheck": "tsc --noEmit"`).
- `eslint.config.js` is orphaned — no ESLint packages in `package.json`.
- No test runner, no error boundary, `alert()` still used in several flows.
- `web/README.md` is still the default Vite template.
- `send-group-invitation` Edge Function is documented in `supabase/README.md` but does not exist.

---

## 5. Current Active Priorities (ordered)

1. **Deploy `admin-items` Edge Function** — required for admin item detail/edit/archive/delete. Not yet deployed.
2. **RLS hardening** — enable RLS on all public-schema tables; write reviewed policy set (derive from `supabase/archive-debug-scripts/rls-policies.sql`).
3. **Migration chain cleanup** — reconcile into a clean sequential chain; fix migration 03 references to non-existent tables; make migration 11 idempotent; drop the broad-permission migration 08 policy.
4. **Add `items.visibility` to `bootstrap.sql`** — or replace bootstrap entirely with the migration chain.
5. **Generate Supabase types** — `supabase gen types typescript --linked > web/src/lib/database.types.ts`; wire into `createClient<Database>()`.
6. **Unify item query keys** — align `['item', id]` vs `['items', id]` across routes and mutations.
7. **Replace `alert()` with a toast component**.
8. **Add top-level React error boundary** in `main.tsx`.
9. **ESLint** — either add deps + `lint` script or delete `eslint.config.js`.

---

## 6. Recent Major Changes (this session)

- **Renamed Stuff Cycler → Circulate** across all code, docs, and package metadata. GitHub repo name unchanged (still `Cmrandall86/Stuff-Cycler`); clone instructions note this.
- **Migrated to a new Supabase project** (old free-tier expired). Google and Discord OAuth reconfigured and working. Images and data displaying correctly.
- **Added admin item moderation** integrated into normal app flows:
  - `/item/$id` — admins see Archive + Delete controls with modal confirmation; admin notice shown for other users' items
  - `/item/$id/edit` — admins can edit any item; admin notice shown; non-owner saves route through `admin-items` Edge Function
  - Feed unchanged — no admin-specific feed path; normal query is sufficient since `items` has no RLS
- **Added `admin-items` Edge Function** for privileged item operations (see §3)
- **Deleted stale files**: `web/stuff_cycler_starter_kit_scaffold_sql_rls_notes.md`, orphaned root `package-lock.json`
- **Added `typecheck` script** to `web/package.json`
- **`web/package-lock.json`** regenerated with correct `"name": "circulate"`
- **Restricted `get_user_email()` to admin users only** (migration 12) — closed live PII exposure where any authenticated user could resolve any UUID to an email address

---

## 7. Constraints / Development Philosophy

- **Scope changes minimally.** Prefer extending existing flows over adding new routes or pages.
- **No separate moderation dashboard.** Admin tooling lives in existing pages.
- **No new roles.** Single admin role on `profiles.role`. No moderator tier.
- **Edge Functions only where necessary.** Use them when RLS or auth.admin API access is required; avoid routing normal data through them.
- **Server-side enforcement.** Admin checks must happen in the Edge Function (JWT + `profiles.role`), not only in the UI.
- **No service-role key in frontend code.** Never in `VITE_*` variables.
- **Don't rebuild RLS in a hurry.** The current incomplete state is known. Fix it deliberately with a reviewed migration, not ad-hoc patches.
- **Keep the migration story honest.** Don't add new migrations that contradict existing ones without reconciling the chain.
- **Do not rename tables, buckets, or environment variable names.**

---

## 8. Immediate Next Steps

1. **Deploy `admin-items`** (required before admin item detail/edit works in production):
   ```
   supabase link --project-ref <ref>
   supabase functions deploy admin-items
   supabase secrets set SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... ALLOW_ORIGINS=http://localhost:5173,https://use-circulate.netlify.app
   ```
2. **Verify admin flow end-to-end** in production: item detail, archive, delete, edit for another user's item.
3. **Unify item query keys** — fix the `['item', id]` vs `['items', id]` mismatch so edits invalidate the detail page correctly.
4. **Begin RLS hardening** — start with `profiles` and `items` as the highest-impact tables.
5. **Run `supabase gen types typescript`** and wire into the client to eliminate manual type drift.

---

## 9. AI-Assisted Development Guidelines / Token Discipline

- **Prefer small, scoped changes** over broad refactors.
- **Do not create Canvas artifacts, large planning documents, or new docs** unless explicitly requested.
- **When planning is needed, produce a concise plan in chat first.** Summarize the smallest safe change and wait for approval before implementing.
- **Prefer editing existing files** over creating parallel systems.
- **Avoid speculative abstractions** — no unused routes, unused components, or duplicate APIs.
- **Keep implementation prompts focused on one task at a time.**
- **Return concise summaries:** files changed, behavior changed, commands needed, and risks.
- Do not optimize for fewer tokens at the expense of correctness, but **avoid broad exploratory rewrites**.
- **Preserve the current product direction:** simple, private-first sharing circles with one trusted admin.
