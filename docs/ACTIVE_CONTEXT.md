# Active Context — Circulate

> Internal engineering working memory. Summarises project state, decisions, and priorities for new Cursor chats. Not a user-facing document. For full detail see `README.md`.

Last updated: May 19, 2026

### Document Hierarchy

| Document | Role |
|---|---|
| `CLAUDE.md` | AI agent context document — read every session |
| `README.md` | Authoritative project reference (stack, schema, known issues, roadmap) |
| `docs/ACTIVE_CONTEXT.md` ← **this file** | Primary startup context for all future Cursor sessions |
| `docs/RLS_HARDENING_PLAN.md` | Archival / reference only — consulted when actively implementing RLS phases, not needed at session start |

> **For future sessions:** read `CLAUDE.md` first, then `docs/ACTIVE_CONTEXT.md`. Fetch task-specific docs (e.g. `docs/RLS_HARDENING_PLAN.md`) only when relevant.

---

## 1. Product Summary

**Circulate** is a private-first community item-sharing platform. Users post items they want to give away, control who can see them (public or specific groups/circles), and browse what others are offering.

- Single trusted platform admin (one operator, not a multi-moderator system)
- Sharing model: items are `public` (anyone) or `groups` (members of selected groups only)
- No marketplace mechanics yet — no payments, no shipping, community trust model
- Production URL: **https://use-circulate.netlify.app**
- GitHub repo: `Cmrandall86/Circulate`

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

- **`admin-users`** — user management (list, create, update, disable/enable account, permanent delete). `DELETE` without `hard=true` bans the user; `DELETE?hard=true` permanently deletes. `PATCH` with `{ banned: false }` clears ban (`ban_duration: "none"`). Self disable/delete blocked server-side.
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

### Feedback
- Signed-in users submit feedback from a modal opened via "Feedback" in the navbar (desktop link + mobile hamburger menu)
- Fields: `type` (`bug` | `feature_request` | `question` | `general`), `message`
- Auto-captured: `user_id`, `page_url` (`window.location.pathname + search`), `user_agent` (`navigator.userAgent`), `created_at`
- Stored in `public.feedback` (migration 13); RLS is enabled — users can insert/select own rows, admins can select all and update status
- Lifecycle: `new` → `completed` → `archived`
- Admins review feedback inside the existing admin area (`/admin/users`) via a "Users / Feedback" tab switcher
- Default admin view shows `new` and `completed` rows only; archived rows are hidden but retained
- No Edge Function — normal Supabase client insert (user) and update (admin). RLS enforces the security boundary.
- No permanent delete in MVP
- Frontend: `web/src/features/feedback/` (`types.ts`, `api.ts`, `FeedbackModal.tsx`); admin UI in `web/src/routes/admin/Feedback.tsx` (exported `AdminFeedbackContent` composed into `Users.tsx`)

---

## 4. Current Technical Debt (short list)

- **RLS normalization in progress** (migration 14). RLS is enabled on all core tables. Items visibility is now enforced by policy (`items_select` uses `user_in_item_groups()` + `is_admin()`). Known remaining gap: `useDeleteImage(bypassOwnerCheck: true)` uses the normal client and will be rejected by `item_images` write policy for admin edits on non-owned items (Phase 5). `interests` and `reservations` still have no RLS.
- **Schema drift**: `items.visibility` column exists in production but is absent from `bootstrap.sql`. Migration `03` references tables (`group_invitations`, `group_join_requests`) that don't exist.
- **Migration gaps**: non-sequential numbering (03, 06, 07, 08, 10, 11); migrations 08 and 11 for storage are contradictory.
- **Manual domain types**: `web/src/lib/types.ts` and feature `types.ts` files are still hand-written. Generated types are now wired (`database.types.ts` + `createClient<Database>()`), but hand-written types remain and should be gradually reconciled. Known gaps: `Item` missing `visibility`; `Group`/`GroupMember`/`ItemVisibilityGroup` duplicated across files. `feedback` table is now in generated types (regenerated May 19, 2026); `features/feedback/types.ts` hand-written type is kept for narrower `type`/`status` unions that the generator emits as `string`.
- ~~**Query key inconsistency**~~: item detail/edit now use `itemKeys.one(id)` = `['items', id]` everywhere. Fixed.
- ~~**`get_user_email()` PII risk**~~ — fixed in migration 12; function now restricted to admin callers only.
- `zod` installed but never used.
- No `typecheck` script was missing (now added: `"typecheck": "tsc --noEmit"`).
- `eslint.config.js` is orphaned — no ESLint packages in `package.json`.
- No test runner. ~~No error boundary~~ ✅. ~~`alert()` still used in several flows~~ ✅.
- ~~`web/README.md` is still the default Vite template.~~ ✅ Deleted.
- `send-group-invitation` Edge Function is documented in `docs/supabase-overview.md` but does not exist.

---

## 5. Current Active Priorities (ordered)

1. ~~**RLS hardening**~~ ✅ Core tables done (migration 14). Remaining: `interests` RLS (Phase 4), `useDeleteImage` admin path (Phase 5).
3. **Migration chain cleanup** — reconcile into a clean sequential chain; fix migration 03 references to non-existent tables; make migration 11 idempotent; drop the broad-permission migration 08 policy.
4. **Add `items.visibility` to `bootstrap.sql`** — or replace bootstrap entirely with the migration chain.
5. ~~**Generate Supabase types**~~ ✅ Done
6. ~~**Unify item query keys**~~ ✅ Done
7. ~~**Replace `alert()` with a toast component**~~ ✅ Done
8. ~~**Add top-level React error boundary** in `main.tsx`.~~ ✅ Done
9. **ESLint** — either add deps + `lint` script or delete `eslint.config.js`.

---

## 6. Recent Major Changes

### Prior sessions (summary)
- Renamed Stuff Cycler → Circulate; migrated to new Supabase project
- Added `admin-items` Edge Function; deployed to production
- Added `ErrorBoundary`, unified item query keys, replaced `alert()` with sonner toasts
- Generated Supabase types (`database.types.ts`); `supabaseClient` uses `createClient<Database>()`
- Restricted `get_user_email()` to admin only (migration 12)
- Repo cleanup, CLAUDE.md created, docs reorganised

### May 17 2026 session
- **Feed card thumbnails** — changed from fixed `h-48` to `aspect-[4/5]` + `object-contain` + `object-center` (`ItemCard.tsx`). Portrait phone photos display without cropping; dark `bg-base-700` handles letterboxing. No-image placeholder uses same frame.
- **Responsive navbar** — added hamburger menu for mobile (`Navbar.tsx`). Single `menuOpen` useState. Desktop layout unchanged. Mobile signed-in: brand + New Item + ☰; hamburger panel contains Groups, Admin (admin only), Sign out. Signed-out: Sign in + Sign up inline. Menu closes on item tap.
- **Item detail header layout** — stacked title and action buttons on mobile (`sm:flex-col` → `sm:flex-row`). Removed visible Archive button from UI; all backend archive code (hook, mutation, modal, `ConfirmAction` type) retained (`routes/Item.tsx`).
- **Branding — Increment 1 complete** — chose "Orbital C" mark direction (open ring with dot).
- **Branding — Increment 2 complete:**
  - Chosen mark (`01-open-orbit.svg`) integrated into navbar as inline SVG beside "Circulate" wordmark. Uses `currentColor` so it inherits active/inactive mint states (`Navbar.tsx`).
  - `web/public/logo-mark.svg` — canonical static asset copy of the mark.
  - `web/public/favicon.svg` — favicon-optimised version: dark `#121416` rounded-square background, mint ring, stroke bumped to 2.5 for 16px legibility.
  - `web/public/apple-touch-icon.png` — 180×180 PNG for iOS home screen.
  - `web/index.html` — wired `<link rel="icon">`, `<link rel="apple-touch-icon">`, `<meta name="description">`, `<meta name="theme-color">`.

### May 19 2026 session — RLS normalization (migration 14)
- **Inspected production RLS state** — discovered RLS was already enabled on all core tables with partial/incorrect policies (`items_select_simple` missing group visibility and admin bypass; `item_images_select` same; `gm_delete` blocking member self-leave; feedback admin policies using unsafe inline profiles subqueries).
- **`public.user_in_item_groups(item_uuid, user_uuid)`** — canonicalised via `CREATE OR REPLACE`; already SECURITY DEFINER/STABLE in production; migration 14 is now the authoritative source.
- **`public.is_admin()`** (zero-arg) — new SECURITY DEFINER/STABLE helper; safe for use inside any RLS policy including profiles. Old `is_admin(uid uuid)` (different overload, not SECURITY DEFINER) left in place.
- **`gm_delete`** — patched to add Clause B: non-owner members may delete their own `group_members` row (`role <> 'owner'`). Fixes silent failure in `useLeaveGroup()`. Last-owner guard preserved.
- **`items_select`** — replaced `items_select_simple`; now covers public / owner / group-visible (`user_in_item_groups()`) / admin (`is_admin()`). Items visibility is now enforced at DB level.
- **`item_images_select`** — replaced; mirrors item visibility logic exactly via correlated subquery. Group members can now load images for group-visible items.
- **`feedback_select_admin` / `feedback_update_admin`** — replaced inline `profiles` subqueries with `public.is_admin()` to avoid fragility when profiles has RLS enabled.
- All 5 post-migration verification queries passed.

### May 19 2026 session — Feedback feature
- **Migration 13** (`13_feedback_table.sql`) — `public.feedback` table with RLS: insert/select own (authenticated), select all + update (admin). No delete policy. Lifecycle: `new` → `completed` → `archived`.
- **User submit flow** — "Feedback" button in navbar (desktop + mobile hamburger) opens a lightweight modal. Type select + message textarea. Captures `page_url` and `user_agent`. Direct Supabase insert; sonner toast on result.
- **Admin review** — "Users / Feedback" tab switcher inside existing `/admin/users` page. Feedback tab shows type badge, message, truncated user ID, page URL, date, status badge. "Mark Completed" (new→completed) and "Archive" (completed→archived) actions. Default view hides archived rows.
- **No Edge Function** — RLS on `feedback` is sufficient; no service-role key required.
- **Supabase types regenerated** — `database.types.ts` now includes `feedback` table; `any` cast removed from `api.ts`.
- **Navbar modal fix** — FeedbackModal rendered as Fragment sibling of the sticky navbar div to avoid `backdrop-filter` containing-block issue that clipped the modal top.

### May 18 2026 session — mobile / admin UI polish (pre-RLS)
- **Groups page (`/groups`)** — mobile-first layout polish: stacked page header and owner actions, improved member-row touch targets, `min-w-0` truncation. Accordion UX: groups collapsed by default, single-open expand, compact header (name, invite-only badge, member count, chevron). Expanded body shows description, owner actions, `GroupMembersPanel`. Auto-expands newly created group via `GroupCreateModal` `onCreated` callback.
- **Admin Users page (`/admin/users`)** — responsive layout: mobile card list (`md:hidden`), desktop table (`md+`). Removed Status column and all "Active" badges; small red **Banned** badge only when `banned_until` is set.
- **Admin account actions** — separate **Edit**, **Disable Account**, **Enable Account**, **Delete Permanently** with confirm modals. Delete is hard-delete only. Disable/enable hidden for the signed-in admin row. `admin-users` Edge Function: `PATCH` supports enable (`banned: false`); `DELETE` blocks self disable/delete.
- **Commits:** `82f491d` (Groups), `4cb9734` (Admin Users + edge function). **Deploy `admin-users` Edge Function** before Enable Account works in production.

### Branding plan — remaining increments
| Increment | Work | Status |
|---|---|---|
| 1 | Logo direction exploration — Orbital C chosen | ✅ Done |
| 2 | Favicon/app icon system + base HTML metadata | ✅ Done |
| 3 | OG/social metadata (`og:*`, `twitter:card`, static preview image) | Pending |
| 4 | Recruiter/demo polish pass (per-route titles, manifest.json, rough-edge review) | Pending |

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

1. ~~**Deploy `admin-items`**~~ ✅ Done
2. ~~**Unify item query keys**~~ ✅ Done
3. ~~**RLS hardening Phase 1**~~ ✅ Done
4. ~~**Generate Supabase types**~~ ✅ Done
5. **Deploy `admin-users` Edge Function** — required for Enable Account after `4cb9734` (enable via `PATCH { banned: false }`).
6. **Branding Increment 3** — OG/social metadata (`og:title`, `og:description`, `og:image` 1200×630, `twitter:card`). Needs a static preview image generated and placed in `web/public/`.
7. **Branding Increment 4** — per-route `<title>` tags, `manifest.json`, recruiter demo polish pass.
8. ~~**RLS hardening Phase 2+**~~ ✅ Done — migration 14 normalised all core-table policies.

---

## 9. RLS Hardening — Status & Phased Plan

### Current State (as of migration 14)

RLS is **enabled on all core tables**. The policy set is now normalised and production-correct:

| Table | RLS | Key policies |
|---|---|---|
| `items` | ✅ | `items_select` — public / owner / group (`user_in_item_groups()`) / admin (`is_admin()`) |
| `profiles` | ✅ | `profiles_*_simple` — select/insert/update/delete (existing, not changed by migration 14) |
| `groups` | ✅ | `groups_*` — owner-scoped select/insert/update/delete (existing, not changed) |
| `group_members` | ✅ | `gm_delete` patched to allow self-leave; others unchanged |
| `item_visibility_groups` | ✅ | `ivg_select` / `ivg_write` (existing, not changed) |
| `item_images` | ✅ | `item_images_select` — mirrors item visibility via `user_in_item_groups()` + `is_admin()` |
| `feedback` | ✅ | Admin policies now use `is_admin()` instead of inline profiles subquery |
| `interests` | ❌ | No RLS — Phase 4 |
| `reservations` | ❌ | No RLS — Phase 4/claim feature |

**Helper functions available:**
- `public.user_in_item_groups(item_uuid, user_uuid)` — SECURITY DEFINER, STABLE; breaks the recursion chain
- `public.is_admin()` (zero-arg) — SECURITY DEFINER, STABLE; safe for use in any policy including profiles
- `public.is_admin(uid uuid)` (old, one-arg) — NOT SECURITY DEFINER; do not use in new policies

**`items.visibility` is now enforced at the DB level.** Group-visibility rules are no longer client-enforced only.

### Prior Failure History

Multiple past RLS attempts failed due to a **recursion loop**:

```
items → item_visibility_groups → group_members → items
```

This caused policy evaluation to recurse indefinitely. A `TEMP-DISABLE-RLS.sql` nuclear rollback was used each time. **Resolved** by the `SECURITY DEFINER` helper — all policies that need group-visibility checks call `user_in_item_groups()` instead of joining inline.

### Known Gap: Admin Image Deletion

`useDeleteImage(bypassOwnerCheck: true)` in the frontend bypasses the owner check but still uses the normal Supabase client. Individual image deletions during admin edits of non-owned items are blocked by `item_images_write` policy.

- Full-item admin delete via the `admin-items` Edge Function (service-role) is **not affected**.
- Deferred to **Phase 5**: update this path to use service-role or route through the Edge Function.

### Phased Rollout

| Phase | Work | Status |
|---|---|---|
| 1 | ~~Restrict `get_user_email()` to admin only~~ (migration 12) | ✅ Done |
| 1 | ~~Fix migration 03 — remove broken index lines~~ | ✅ Done |
| 1 | ~~Audit `items.visibility` distribution~~ — all rows `public`, no nulls | ✅ Done |
| 2 | ~~Canonicalise `user_in_item_groups()`, add `is_admin()`, patch `gm_delete`~~ (migration 14) | ✅ Done |
| 3 | ~~Normalise items / item_images / feedback policies~~ (migration 14) | ✅ Done |
| 4 | Enable RLS on `interests`; audit `ivg_*` and `group_members` policies under load | Pending |
| 5 | Fix `useDeleteImage` admin path (admin edit of non-owned item images) | Pending |

**Migration rule:** Each phase is a new numbered migration. Never edit existing migration files. Keep `docs/TEMP-DISABLE-RLS.sql` accessible through Phase 5 as a rollback option.

---

## 10. AI-Assisted Development Guidelines / Token Discipline

- **Prefer small, scoped changes** over broad refactors.
- **Do not create Canvas artifacts, large planning documents, or new docs** unless explicitly requested.
- **When planning is needed, produce a concise plan in chat first.** Summarize the smallest safe change and wait for approval before implementing.
- **Prefer editing existing files** over creating parallel systems.
- **Avoid speculative abstractions** — no unused routes, unused components, or duplicate APIs.
- **Keep implementation prompts focused on one task at a time.**
- **Return concise summaries:** files changed, behavior changed, commands needed, and risks.
- Do not optimize for fewer tokens at the expense of correctness, but **avoid broad exploratory rewrites**.
- **Preserve the current product direction:** simple, private-first sharing circles with one trusted admin.
