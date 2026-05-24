# Active Context — Circulate

> Internal engineering working memory. Summarises project state, decisions, and priorities for new Cursor chats. Not a user-facing document. For full detail see `README.md`.

Last updated: May 24, 2026 (V1 complete — all slices #2–#15 shipped; RLS Phase 5 done)

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

**Handoff loop:** ✅ Shipped (#2–#15). **V1 engineering backlog:** complete except real-user sign-off (issue #1).

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

### Item lifecycle (migrations 16–26)
- Status values: `available` | `reserved` | `claimed` | `archived` (legacy `active` → `available`; **claim → `archived`** via migration 24)
- UI labels: `web/src/features/items/status.ts`; archived badges: **Handoff complete** vs **Removed** (from fulfilled reservation)
- **Browse feed:** `available` only; owner **My archived** toggle on feed (`useOwnerArchivedFeed`)
- **RPCs:** `create_item_reservation`, `cancel_item_reservation`, `recover_expired_reservations`, `mark_item_claimed`, `archive_item`, `reactivate_item` (removed archives only)
- **Locked edits:** handoff-complete archived items cannot be edited (migration 26 trigger + `canEditItem()`)

### Interests & reservations (issues #6–#13, #11, #15, #9)
- Table: `interests` — one row per `(item_id, user_id)` (migration 18); levels `need` / `like` / `take` (migration 20)
- Table: `reservations` — one active per item (migration 21); expiry presets at reserve time (migration 28: 2d / 7d / 14d / none / custom max 30d)
- RLS: migration 17 + reservation insert tightened in migration 21
- **Member UI:** `ItemInterestActions.tsx` — level picker, withdraw, reserved/chosen messaging
- **Owner UI:** `ItemInterestQueue.tsx` — sorted queue, mutual groups per row (#9), reserve modal with expiry picker
- **Owner reservation panel:** `ItemOwnerReservation.tsx` — cancel, mark claimed
- **Owner archived panel:** `ItemOwnerArchivedActions.tsx` — return removed archives to feed
- **Owner indicators:** navbar **New interest** pill + interest count on own feed cards (migration 27)
- API: `web/src/features/interests/api.ts`

### Profile settings (issue #4)
- Route: `/settings` (AuthGate) — display name, avatar upload, optional `public_area`
- API: `web/src/features/profile/api.ts`
- Column: `profiles.public_area` (migration 19)

### Auth
- Email/password, Google OAuth, Discord OAuth — all working on the new Supabase project
- Session provided through `AuthProvider` → `useAuth()` hook
- Role loaded via `get_my_role()` RPC → `useRole()` hook
- `<AuthGate>` — requires any session; `<AdminGate>` — requires `role === 'admin'`
- **Email confirmation (migration 29):** `profiles` row created only when `auth.users.email_confirmed_at` is set; trigger on INSERT + UPDATE. Unconfirmed users excluded from group member search (`search_confirmed_member_profiles` RPC) and blocked by `gm_insert` RLS.

### Groups
- `groups` owned by a user, many-to-many membership in `group_members`
- Owner gets a `group_members` row automatically via `add_owner_membership` trigger (migration 06)
- Item visibility to groups via `item_visibility_groups` join table
- **Add member search:** `UserSearchInput.tsx` → `search_confirmed_member_profiles` RPC (confirmed users only)

### React Query cache (item detail)
- Shared `QueryClient` uses **60 s `staleTime`** (`web/src/main.tsx`). `invalidateQueries` marks stale but does not always repaint active views immediately.
- **Item detail has two fetch paths:** normal client → `itemKeys.one(id)`; admin (including admin-as-owner) → `adminItemKeys.one(id)` via Edge Function. After item mutations, **refetch both keys**.
- **Canonical helper:** `web/src/lib/itemQueryCache.ts` → `refreshItemDetailCaches(qc, itemId)`. Await before navigating from edit flows; also refetches images + visibility groups.
- Handoff mutations use the same dual-key pattern in `features/interests/api.ts` (`invalidateItemHandoffQueries`).
- **Known pitfall:** mutating in `onSuccess` then doing more work (e.g. image upload in `ItemForm`) before navigate — refresh must run **after** all side effects, not only in the mutation hook.

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
- **RLS complete for core tables** (migration 14) + **`interests` / `reservations`** (migration 17). ~~Admin image delete gap~~ ✅ Phase 5 — admin single-image delete routes through `admin-items` Edge Function when `bypassOwnerCheck: true`.
- ~~**Schema drift**: `items.visibility` absent from `bootstrap.sql`~~ ✅ Fixed in bootstrap (May 24 2026).
- **Migration gaps**: non-sequential numbering (03, 06, 07, 08, 10, 11); migrations 08 and 11 for storage are contradictory. *(Post-V1 cleanup — do not reorder applied migrations.)*
- **Manual domain types**: `web/src/lib/types.ts` and feature `types.ts` files are still hand-written. Generated types are now wired (`database.types.ts` + `createClient<Database>()`), but hand-written types remain and should be gradually reconciled. Known gaps: `Item` missing `visibility`; `Group`/`GroupMember`/`ItemVisibilityGroup` duplicated across files. `feedback` table is now in generated types (regenerated May 19, 2026); `features/feedback/types.ts` hand-written type is kept for narrower `type`/`status` unions that the generator emits as `string`.
- ~~**Query key inconsistency**~~: item detail/edit now use `itemKeys.one(id)` = `['items', id]` everywhere. Fixed.
- ~~**`get_user_email()` PII risk**~~ — fixed in migration 12; function now restricted to admin callers only.
- `zod` installed but never used.
- No `typecheck` script was missing (now added: `"typecheck": "tsc --noEmit"`).
- ~~`eslint.config.js` is orphaned~~ ✅ Removed (no ESLint packages in `package.json`).
- No test runner. ~~No error boundary~~ ✅. ~~`alert()` still used in several flows~~ ✅.
- ~~`web/README.md` is still the default Vite template.~~ ✅ Deleted.
- `send-group-invitation` Edge Function is documented in `docs/supabase-overview.md` but does not exist.

---

## 5. Current Active Priorities (ordered)

### Primary: V1 item handoff loop — ✅ COMPLETE (May 24 2026)

All slices shipped. GitHub **#1** (PRD) closes when real-user handoff is confirmed in production.

| Issue | Title | Status |
|---|---|---|
| #1 | PRD: V1 Item Handoff Loop | Open — close after real-user sign-off |
| #2–#15 | All vertical slices | ✅ Closed |

### Post-V1 (not blocking launch)

- **Migration chain cleanup** — reconcile numbering; fix migration 03; migration 11 idempotent; drop migration 08 policy.
- **Manual domain types** — gradually reconcile hand-written types with `database.types.ts`.
- **Branding increment 4** — per-route titles, rough-edge polish pass (OG + manifest done).

---

## 6. Recent Major Changes

### May 24 2026 session — V1 engineering wrap-up

**Shipped**
- **RLS Phase 5** — admin single-image delete via `admin-items` `DELETE /:itemId/images/:imageId`; `useDeleteImage(bypassOwnerCheck)` uses Edge Function
- **bootstrap.sql** — `items.visibility`, `profiles.public_area`, lifecycle status defaults aligned with production
- **Branding** — `manifest.json` + link in `index.html`; removed orphaned `eslint.config.js`
- **Docs** — ACTIVE_CONTEXT, CLAUDE.md, RLS_HARDENING_PLAN marked complete through Phase 5

**Commits:** `785b8ec` (location #14), V1 wrap-up commit pending push

### May 23 2026 session (continued) — handoff loop completion + auth fix

**Migrations 21–29** (user applies via Supabase SQL editor; see git for files)
- **21–22** — create / cancel / recover reservations
- **23–26** — claim, archive, reactivate, lock handoff-complete edits
- **27** — owner interest indicators (`owner_interests_viewed_at`, navbar pill)
- **28** — reservation expiry presets on `create_item_reservation`
- **29** — profiles deferred until email confirmed; confirmed-only member search

**Features shipped (not yet committed to main)**
- Full handoff loop UI + optional slices #9, #11, #15
- Navbar **New interest** alert (right side, not on logo)
- Edit cache fix — `web/src/lib/itemQueryCache.ts` → `refreshItemDetailCaches()`
- Email signup: unconfirmed users no longer in `profiles` or group search

**Last pushed commit:** `7620419` (through migration 20). **Working tree:** migrations 21–29 + handoff UI uncommitted.

### May 23 2026 session — archive polish + edit cache fix

**Migrations applied (user via SQL editor)**
- **22** — cancel + expiry recovery
- **23** — mark claimed + archive RPCs
- **24** — claim sets `archived`; browse feed `available` only; owner **My archived** toggle
- **25** — `reactivate_item` (return removed archives to feed)
- **26** — lock handoff-complete archived items from edits (trigger)

**Features shipped**
- Cancel reservation, mark claimed, owner archive, archived feed badges (Handoff complete vs Removed)
- Return to feed for removed archives; edit locked for handoff-complete archives
- **Edit cache fix** — `refreshItemDetailCaches()`; `ItemForm` awaits refetch of normal + admin item queries (and images) before navigate

### May 23 2026 session — reservation (#10) + queue sign-off (#8)

**Migration applied**
- **21** — `create_item_reservation` RPC; one active reservation per item; tightened `reservations_insert` RLS

**Features shipped**
- **#10 Create reservation** — owner Reserve on queue row; atomic `available` → `reserved` + 7-day `expires_at`; claimer / non-claimer member messaging
- **Post-reserve cache fix** — optimistic status patch + refetch for both normal and admin item queries (platform admin-as-owner no longer needs manual page refresh)

**Manual testing:** #8 and #10 verified in production/dev.

**Decision (locked):** Owner cancel / mistaken-reservation override deferred to **#12** (confirm dialog, `reserved` → `available`, queue preserved). Do not bolt partial cancel onto #10.

### May 23 2026 session (continued) — interest levels + owner queue

**Migration applied**
- **20** — `interests.state` CHECK constraint (`need` / `like` / `take`)

**Features implemented**
- **#7 Interest levels** — three-level card picker on item detail; upsert on `(item_id, user_id)`; withdraw; level change blocked when item not `available`. UI polish: stacked cards, separated withdraw button.
- **#8 Owner interest queue** — `ItemInterestQueue.tsx` on item detail; owner-only, `available` items only; sorted `need` → `like` → `take` then FIFO; rows show display name, avatar, level badge, timestamp.

**Key files:** `web/src/features/interests/api.ts`, `ItemInterestActions.tsx`, `ItemInterestQueue.tsx`, `web/src/routes/Item.tsx`, `web/src/lib/types.ts` (`InterestLevel`, `InterestQueueEntry`).

**Manual testing status**
- ✅ #7 interest levels — verified
- ✅ #8 owner queue — verified (ordering, privacy, reserved hiding)
- ✅ #10 create reservation — verified (reserve flow, member messaging, immediate UI update after cache fix)

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
| 3 | OG/social metadata (`og:*`, `twitter:card`, static preview image) | ✅ Done |
| 4 | Recruiter/demo polish pass (per-route titles, manifest.json, rough-edge review) | Partial — manifest ✅; per-route titles pending |

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

1. **Real-user V1 validation** — one complete handoff in a real group; then close GitHub **#1**.
2. **Post-V1** — migration chain cleanup, type reconciliation, invite links / notifications (new issues).

---

## 9. RLS Hardening — Status & Phased Plan

### Current State (as of migration 29)

RLS is **enabled on all core tables** including `interests` and `reservations` (migration 17):

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

~~`useDeleteImage(bypassOwnerCheck: true)` blocked by RLS.~~ ✅ **Fixed (May 24 2026):** admin single-image delete routes through `admin-items` Edge Function `DELETE /:itemId/images/:imageId` (service-role).

### Phased Rollout

| Phase | Work | Status |
|---|---|---|
| 1 | ~~Restrict `get_user_email()` to admin only~~ (migration 12) | ✅ Done |
| 1 | ~~Fix migration 03 — remove broken index lines~~ | ✅ Done |
| 1 | ~~Audit `items.visibility` distribution~~ | ✅ Done |
| 2 | ~~Canonicalise helpers + patch `gm_delete`~~ (migration 14) | ✅ Done |
| 3 | ~~Normalise items / item_images / feedback policies~~ (migration 14) | ✅ Done |
| 4 | ~~Enable RLS on `interests` and `reservations`~~ (migration 17) | ✅ Done |
| 5 | ~~Fix `useDeleteImage` admin path~~ (admin-items Edge Function) | ✅ Done |

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
