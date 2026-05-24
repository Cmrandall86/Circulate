# Active Context — Circulate

> Internal engineering working memory. Summarises project state, decisions, and priorities for new Cursor chats. Not a user-facing document. For full detail see `README.md`.

Last updated: May 23, 2026 (V1 handoff loop — #7 + #8 implemented; #8 manual testing incomplete)

### Document Hierarchy

| Document | Role |
|---|---|
| `CLAUDE.md` | AI agent context document — read every session (includes agent skills catalog) |
| `CONTEXT.md` | Domain glossary — canonical product language (from grill-with-docs) |
| `README.md` | Authoritative project reference (stack, schema, known issues, roadmap) |
| `docs/ACTIVE_CONTEXT.md` ← **this file** | Primary startup context for all future Cursor sessions |
| `docs/agents/` | Issue tracker config, triage labels, domain doc consumer rules |
| `docs/PRD-V1-HANDOFF-LOOP.md` | Local copy of V1 PRD (GitHub issue #1) |
| `docs/RLS_HARDENING_PLAN.md` | Archival / reference only — consulted when actively implementing RLS phases, not needed at session start |

> **For future sessions:** read `CLAUDE.md` first, then `docs/ACTIVE_CONTEXT.md`. Use `CONTEXT.md` for domain terms. Fetch task-specific docs only when relevant. Work one GitHub slice issue at a time; user reviews between each.

### Agent workflow (configured May 23 2026)

- **Skills:** `.agents/skills/` — see `CLAUDE.md` § Agent skills. Key skills: `circulate-safe-change`, `grill-me`, `grill-with-docs`, `to-prd`, `to-issues`, `caveman`.
- **Issue tracker:** GitHub Issues on `Cmrandall86/Circulate` via `gh` CLI. Config: `docs/agents/issue-tracker.md`.
- **Triage labels:** `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. Config: `docs/agents/triage-labels.md`.
- **Domain docs:** Single-context — `CONTEXT.md` + `docs/adr/` (ADRs created lazily). Config: `docs/agents/domain.md`.
- **Process:** One vertical-slice issue at a time → user reviews → next issue. Do not batch multiple slices without approval.

---

## 1. Product Summary

**Circulate** is a private-first community item-sharing platform. Users post items they want to give away, control who can see them (public or specific groups/circles), and browse what others are offering.

- Single trusted platform admin (one operator, not a multi-moderator system)
- Sharing model: items are `public` (anyone) or `groups` (members of selected groups only)
- No marketplace mechanics yet — no payments, no shipping, community trust model
- Production URL: **https://use-circulate.netlify.app**
- GitHub repo: `Cmrandall86/Circulate`

### V1 product direction (locked May 23 2026 — see issue #1, `CONTEXT.md`)

**Vision:** Trusted-circle giving now; public browse-only feed seeds future stranger-to-stranger sharing (Goodwill-alternative story). Word-of-mouth growth; single platform admin.

**V1 success bar:** One complete handoff loop with real users (post → leveled interest → owner picks → reserved → claimed) without admin intervention.

| Area | V1 decision |
|---|---|
| Public feed (visitors) | Browse-only — no interest, no location |
| Signup | Open + admin oversight (approval queue deferred) |
| Groups | Owner-add-only membership (no invite links yet) |
| Item visibility | User chooses public vs groups at post time — no default |
| Interest levels | `need` / `like` / `take` — queue sorted level → FIFO within tier |
| Handoff | Interest → owner picks → `reserved` → `claimed`; 7-day default expiry |
| Location | Profile `public_area` (optional), inherited by items; per-item override in slice #14 |
| Settings | `/settings` — display name, avatar, public area stub |
| Out of V1 | DMs, email/push, invite links, public profile pages, report queue |

**Next unbuilt handoff slices:** #10 reservation → (#11, #12, #13) → #15. Optional #9 mutual groups in queue. Full tracker below §5.

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

The **feed does not use the admin-items Edge Function**. Since migration 14 the `items` table has the `items_select` RLS policy, which includes an `OR public.is_admin()` clause so admins see all items in the feed via the normal client. Public items are visible to all users including unauthenticated. Group-visible items are only visible to group members and admins.

### Storage
- Private bucket: `images`
- Path conventions:
  - Item images: `items/{itemId}/{filename}`
  - Member avatars: `avatars/{userId}/{filename}` (migration 19)
- All image reads go through 1-hour signed URLs
- Avatar helper: `web/src/lib/avatar.ts` — storage paths vs OAuth URLs

### Item lifecycle (migration 16)
- Status values: `available` | `reserved` | `claimed` | `archived` (legacy `active` → `available`)
- UI labels: `web/src/features/items/status.ts`
- Status **display** on feed + item detail; **transitions** not wired in app yet (no reserve/claim UI — issue #10+)
- **Manual testing only:** set `items.status` via Supabase SQL editor until #10 ships (e.g. `UPDATE items SET status = 'reserved' WHERE id = '…'`)

### Interests (issues #6–#8)
- Table: `interests` — one row per `(item_id, user_id)` (migration 18); levels `need` / `like` / `take` (migration 20 CHECK)
- RLS enabled (migration 17) — insert/update/delete only when item `available` (member author path)
- **Member UI:** `web/src/features/interests/ItemInterestActions.tsx` — card-style level picker + withdraw
- **Owner UI:** `web/src/features/interests/ItemInterestQueue.tsx` — sorted queue (level → FIFO), owner + `available` only
- API: `web/src/features/interests/api.ts` — `useMyInterest`, `useSetInterest`, `useWithdrawInterest`, `useItemInterestQueue`, `sortInterestQueue`
- Non-owners see only their own interest row in UI; full queue is owner-only (RLS still allows broad read — tighten later if needed)

### Profile settings (issue #4)
- Route: `/settings` (AuthGate) — display name, avatar upload, optional `public_area`
- API: `web/src/features/profile/api.ts`
- Column: `profiles.public_area` (migration 19)

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
- Stored in `public.feedback` (migration 13); RLS is enabled — users can insert/select own rows, admins can select all, update status, and delete
- Lifecycle: `new` → `completed` → `archived`
- Admins review feedback inside the existing admin area (`/admin/users`) via a "Users / Feedback" tab switcher
- Admin feedback has two views toggled by a button:
  - **Active view** (default): shows `status = 'new'` rows only. "Mark Completed" moves to completed and removes from view.
  - **Handled view**: shows `status in ('completed', 'archived')` rows. "Archive" moves completed → archived. "Delete" permanently deletes after confirmation modal.
- No Edge Function — normal Supabase client insert/update/delete + RLS. Migration 15 added `feedback_delete_admin` DELETE policy using `public.is_admin()`.
- Admin feedback view shows the submitter's `display_name` (fetched from `profiles` in a second query after loading feedback rows). Falls back to truncated UUID if no display_name is available.
- Frontend: `web/src/features/feedback/` (`types.ts`, `api.ts`, `FeedbackModal.tsx`); admin UI in `web/src/routes/admin/Feedback.tsx` (exported `AdminFeedbackContent` composed into `Users.tsx`)
- `useFeedbackList(mode)` accepts `'active'` or `'handled'`; `feedbackKeys.list(mode)` is mode-scoped. Both views share invalidation via `feedbackKeys.all`.

---

## 4. Current Technical Debt (short list)

- ~~**DEV DIAG logs in `Users.tsx`**~~ ✅ Removed — console.log diagnostics and `retry: false` cleaned up.
- **RLS complete for core tables** (migration 14) + **`interests` / `reservations`** (migration 17). Remaining gap: `useDeleteImage(bypassOwnerCheck: true)` blocked by `item_images_write` for admin edits on non-owned items (Phase 5).
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

### Primary: V1 item handoff loop (GitHub issue #1)

Work **one slice at a time**; user reviews between each. Issues on GitHub; bodies also in `docs/issues/`.

| Issue | Title | Status |
|---|---|---|
| #1 | PRD: V1 Item Handoff Loop | ✅ Published |
| #2 | Item lifecycle statuses | ✅ Shipped (migration 16) |
| #3 | RLS for interests & reservations | ✅ Shipped (migration 17) |
| #4 | Profile settings | ✅ Shipped (migration 19) |
| #5 | Public area input approach (HITL) | ⏸ Pending human decision |
| #6 | Express interest (single level) | ✅ Shipped (migration 18) |
| #7 | Interest levels (need/like/take) | ✅ Shipped (migration 20 + UI polish) |
| **#8** | **Owner interest queue** | **🧪 Implemented — manual testing incomplete** |
| #9 | Mutual groups in queue | Blocked by #8 sign-off |
| #10 | Create reservation (7-day default) | Blocked by #8 sign-off |
| #11 | Reservation expiry presets | Blocked by #10 |
| #12 | Cancel + expiry recovery | Blocked by #10 |
| #13 | Mark claimed + archive | Blocked by #10 |
| #14 | Profile-based location on items | Blocked by #4 + #5 |
| #15 | Owner interest indicator | Blocked by #8 |

**Recommended order after #8 sign-off:** #10 → (#11, #12, #13 parallel) → #15. Optional #9 after #8. Location track (#5 HITL → #14) can run in parallel.

### Secondary (unchanged)

- **Migration chain cleanup** — reconcile numbering; fix migration 03; migration 11 idempotent; drop migration 08 policy.
- **Add `items.visibility` to `bootstrap.sql`**
- **ESLint** — add deps + `lint` script or delete `eslint.config.js`
- **`useDeleteImage` admin path** (RLS Phase 5)
- **Branding increments 3–4** (OG metadata, manifest)

---

## 6. Recent Major Changes

### May 23 2026 session (continued) — interest levels + owner queue

**Migration applied**
- **20** — `interests.state` CHECK constraint (`need` / `like` / `take`)

**Features implemented**
- **#7 Interest levels** — three-level card picker on item detail; upsert on `(item_id, user_id)`; withdraw; level change blocked when item not `available`. UI polish: stacked cards, separated withdraw button.
- **#8 Owner interest queue** — `ItemInterestQueue.tsx` on item detail; owner-only, `available` items only; sorted `need` → `like` → `take` then FIFO; rows show display name, avatar, level badge, timestamp.

**Key files:** `web/src/features/interests/api.ts`, `ItemInterestActions.tsx`, `ItemInterestQueue.tsx`, `web/src/routes/Item.tsx`, `web/src/lib/types.ts` (`InterestLevel`, `InterestQueueEntry`).

**Manual testing status**
- ✅ #7 interest levels — user verified
- ⏳ **#8 queue — incomplete.** Remaining checklist:
  1. Owner on **available** item with no interests → empty queue message
  2. Another member expresses interest at different levels → queue order correct (`need` first, FIFO within tier)
  3. As that member → only own interest actions visible, not full queue
  4. Set item to **`reserved`** via SQL editor → queue hidden; status badge shows Reserved; member sees "not accepting interest"
  5. Member withdraws or changes level → owner queue updates on refresh

**SQL for #8 reserved-state test (no app UI yet):**
```sql
UPDATE public.items SET status = 'reserved' WHERE id = 'ITEM-UUID';
-- revert:
UPDATE public.items SET status = 'available' WHERE id = 'ITEM-UUID';
```

### May 23 2026 session — agent skills, V1 spec, handoff loop start

**Agent infrastructure**
- Added `.agents/skills/` (17 skills) + `CLAUDE.md` § Agent skills
- Ran `setup-matt-pocock-skills`: `docs/agents/` (GitHub tracker, triage labels, domain layout)
- GitHub CLI installed + authenticated as `Cmrandall86`
- Created `CONTEXT.md` domain glossary; published PRD as **issue #1**; broke into slices **issues #2–#15**

**Migrations applied (16–20)**
- **16** — Item lifecycle statuses (`available`/`reserved`/`claimed`/`archived`)
- **17** — RLS on `interests` and `reservations`
- **18** — Unique `(item_id, user_id)` on interests; default level `like`
- **19** — `profiles.public_area`; avatar storage policies (`avatars/{user_id}/`)
- **20** — Interest level CHECK (`need`/`like`/`take`) — applied in production

**Features shipped**
- Item status badges on detail + feed cards (`features/items/status.ts`)
- Member express interest on available items (`features/interests/`)
- Profile settings page `/settings` (`features/profile/`, navbar link)

**Manual testing:** #2, #3, #6, #4 verified in production/dev.

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

### May 19 2026 session — group bugs + feedback display_name
- **`useRemoveMember` guard fix** (`features/groups/api.ts`) — `targetMember` was finding the first owner row instead of the specific user being removed, causing every remove attempt in a single-owner group to throw "Cannot remove the last owner". Fixed to `members?.find(m => m.user_id === userId)` so the guard only fires when removing the actual last owner.
- **`UserSearchInput` dropdown fix** (`features/groups/components/UserSearchInput.tsx`) — "No users found" message was logically unreachable because `showDropdown` was set to `filtered.length > 0` but the empty-state branch required `showDropdown && results.length === 0`. Fixed by setting `showDropdown(true)` after any completed search, making both branches reachable.
- **Feedback admin display_name** (`features/feedback/api.ts`, `routes/admin/Feedback.tsx`) — `useFeedbackList` now enriches results with a second `profiles` query keyed on `user_id`. Admin feedback view shows submitter's display_name; falls back to truncated UUID.

### May 21 2026 session — auth/session robustness + navbar polish

**Root-cause investigation:** `POST /auth/v1/logout 403` on sign-out and `GET /functions/v1/admin-users 401` on the admin page were both caused by a stale/expired Supabase access token. In `@supabase/supabase-js` v2.x, **all** `signOut()` scopes (including `local`) make a network request. When the access token is expired the server returns 403 and supabase-js surfaces `"Auth session missing!"`. Because the signOut call failed, supabase-js did NOT clear localStorage or fire the `SIGNED_OUT` event, leaving `user` stale in React state and the Navbar stuck in signed-in state.

**`useAuth.ts`** — Added `clearUser: () => void` to `AuthContextValue` and the provider value. It synchronously sets `user = null` in React state without waiting for `onAuthStateChange`. Used only as a bypass when `signOut` fails and `SIGNED_OUT` is never fired.

**`Navbar.tsx`** — Replaced fire-and-forget `supabase.auth.signOut()` calls with a single `handleSignOut` async function (shared by desktop and mobile):
  - Calls `signOut({ scope: 'local' })`, catches any error non-fatally (including `"Auth session missing!"`)
  - Manually removes `sb-${projectRef}-auth-token` from `localStorage` (targeted removal, not `localStorage.clear()`) — supabase-js leaves this key when signOut fails
  - Calls `clearUser()` to immediately update React state
  - Calls `queryClient.clear()` to evict all cached query data
  - Calls `navigate({ to: '/' })` for SPA navigation

**`Users.tsx` `getToken()`** — Added explicit expiry check: if the stored access token is expired or within 60 s of expiry, `supabase.auth.refreshSession()` is called before the Edge Function fetch. `refreshErr` is now captured and logged. This ensures the `admin-users` Edge Function always receives a live JWT.

**`Navbar.tsx` visual polish** — Removed "New Item" button from navbar (desktop and mobile). The `/new` route and `ItemForm` remain fully accessible.

**`ItemCard.tsx`** — Hover border refined to `[@media(hover:hover)]:hover:border-mint-400` so the highlight does not trigger on touch devices.

**DEV DIAG cleanup complete** — diagnostic `console.log` calls and `retry: false` removed from `Users.tsx`.

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

1. **Finish #8 manual testing** — queue ordering, member privacy, reserved-state hiding (SQL editor for `status = 'reserved'` until #10). Sign off #8 when done.
2. **Issue #10** — Create reservation (owner picks from queue → `reserved` + `reservations` row). Next implementation slice after #8 sign-off.
3. **Issue #9 (optional)** — Mutual groups hint in queue rows. Can defer until after #10.
4. **Issue #5 (HITL)** — Decide public area input approach before slice #14. Record in ADR or issue comment.
5. **Regenerate Supabase types** after migrations 16–20 (optional but recommended before more DB work).
6. **Deploy frontend** — if #7/#8 changes not yet live on Netlify.
7. **Branding increments 3–4** — deferred behind V1 handoff.

---

## 9. RLS Hardening — Status & Phased Plan

### Current State (as of migration 17)

RLS is **enabled on all core tables** including `interests` and `reservations`:

| Table | RLS | Key policies |
|---|---|---|
| `items` | ✅ | `items_select` — public / owner / group (`user_in_item_groups()`) / admin (`is_admin()`) |
| `profiles` | ✅ | `profiles_*_simple` — select/insert/update/delete (existing, not changed by migration 14) |
| `groups` | ✅ | `groups_*` — owner-scoped select/insert/update/delete (existing, not changed) |
| `group_members` | ✅ | `gm_delete` patched to allow self-leave; others unchanged |
| `item_visibility_groups` | ✅ | `ivg_select` / `ivg_write` (existing, not changed) |
| `item_images` | ✅ | `item_images_select` — mirrors item visibility via `user_in_item_groups()` + `is_admin()` |
| `feedback` | ✅ | Admin policies use `is_admin()`; migration 15 adds admin DELETE policy |
| `interests` | ✅ | `interests_select/insert/update/delete` — visibility via items subquery; insert when `available` (migration 17) |
| `reservations` | ✅ | Owner write; owner + claimer + admin read (migration 17) |

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
| 4 | ~~Enable RLS on `interests` and `reservations`~~ (migration 17) | ✅ Done |
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
