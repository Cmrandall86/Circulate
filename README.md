# Circulate

A community platform for sharing and cycling items. Post things you want to give away, control who can see them (public or specific groups), and browse what others are offering.

> **Status:** Functional MVP with known schema drift and several pre-production cleanup items. The application boots, all advertised flows work end-to-end on a freshly seeded database, **but** the SQL setup story has inconsistencies that will trip up a clean install. See [Known Issues](#known-issues--technical-debt) before doing a fresh deploy.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [What Works Today](#what-works-today)
3. [Repository Layout](#repository-layout)
4. [Local Development](#local-development)
5. [Environment Variables](#environment-variables)
6. [Deployment (Netlify)](#deployment-netlify)
7. [Architecture Overview](#architecture-overview)
8. [Known Issues & Technical Debt](#known-issues--technical-debt)
9. [Cleanup Backlog](#cleanup-backlog)
10. [Roadmap](#roadmap)
11. [Reference Documents](#reference-documents)
12. [Agent / Contributor Notes](#agent--contributor-notes)

---

## Tech Stack

| Layer | Choice | Notes |
|------|--------|------|
| Frontend framework | React 18 + TypeScript (strict) | `web/tsconfig.app.json` |
| Build tool | Vite 5 | `web/vite.config.ts` (alias `@` → `./src`) |
| Router | TanStack Router 1.x | Code-defined route tree in `web/src/main.tsx` |
| Server state | TanStack Query 5 | Single shared `QueryClient`, 60s `staleTime` |
| Styling | Tailwind 3 + CSS custom-property tokens | `web/tailwind.config.ts`, `web/src/theme/tokens.css` |
| Image client | `browser-image-compression` | `web/src/lib/image.ts` |
| Validation | `zod` is installed but **not yet used anywhere** | Candidate for adoption in forms |
| Backend | Supabase (Postgres 15, Auth, Storage, Edge Functions) | `supabase/config.toml` |
| Edge runtime | Deno (Supabase Edge Functions) | `supabase/functions/admin-users/` |
| Hosting | Netlify (frontend), Supabase Cloud (backend) | `web/netlify.toml`, Node `20.17.0` |

---

## What Works Today

Verified by reading the source — these are the surfaces that are wired end-to-end:

- **Auth** — email/password, Google, and Discord via Supabase Auth. Session is provided through `AuthProvider` in `web/src/hooks/useAuth.ts`. Password reset email → `/reset-password` flow works.
- **Profile bootstrap** — new `auth.users` rows automatically get a `profiles` row via the `handle_new_user` trigger (`supabase/bootstrap.sql`). On first sign-in the client also creates a default "My Circle" group for the user (`web/src/lib/bootstrapUser.ts`).
- **Feed** (`/`) — public, lists the latest 50 items with the first image as a thumbnail (`web/src/hooks/useFeed.ts`, `web/src/routes/Feed.tsx`).
- **Item CRUD** (`/new`, `/item/$id`, `/item/$id/edit`) — title, description, condition, category, location, multi-image upload with client-side compression, and visibility (`public` or one-or-more groups). API in `web/src/features/items/api.ts`.
- **Images** — private `images` bucket, items stored under `items/{itemId}/...`, signed URLs requested per render with 1-hour TTL.
- **Groups** (`/groups`) — create / edit / delete (owner-only), leave, list (owned + member), add and remove members, change member role (`member` / `admin`), search users by display name. UI in `web/src/features/groups/`.
- **Admin Users** (`/admin/users`, role-gated) — paginated list, create, update (display name, role, password), soft-ban or hard-delete users. Powered by the `admin-users` Edge Function which uses the service-role key server-side.
- **404 page** with a "Go home" link, custom Tailwind theme tokens, responsive grid layout.

---

## Repository Layout

```
Circulate/
├── README.md                              # This file
├── .gitignore                             # Includes supabase/.temp/, env files
│                                          # (root package-lock.json deleted — orphaned, no root package.json)
├── skills-lock.json                       # Lockfile for committed agent skills
├── .agents/skills/                        # Cursor agent skills (Supabase best-practices, etc.)
├── docs/                                  # Feature-level docs (image, groups)
│   ├── IMAGE_DEPLOYMENT_CHECKLIST.md
│   ├── IMAGE_IMPLEMENTATION.md
│   └── GROUPS_MEMBERSHIP.md
├── web/                                   # Vite + React app (the only Node package)
│   ├── netlify.toml                       # Build = npm run build, publish = dist, Node 20.17.0
│   ├── package.json                       # Scripts: dev, build, preview ONLY
│   ├── eslint.config.js                   # ⚠️ Orphan: not wired into a script and deps missing
│   ├── vite.config.ts                     # @ → ./src; blocks supabase/functions imports
│   ├── tailwind.config.ts                 # base/ink/mint palette
│   ├── tsconfig*.json                     # Strict; noUnusedLocals/Params
│   ├── index.html                         # <title>Circulate</title>, no favicon yet (add one when branding is ready)
│   ├── README.md                          # ⚠️ Default Vite template — should be deleted or rewritten
│   │                                      # (stuff_cycler_starter_kit_…notes.md deleted — was stale)
│   ├── public/_redirects                  # SPA fallback for Netlify
│   └── src/
│       ├── main.tsx                       # Router + QueryClient + AuthProvider wiring
│       ├── routes/                        # Page components
│       │   ├── Root.tsx                   # Layout shell
│       │   ├── Feed.tsx
│       │   ├── Item.tsx                   # Item detail
│       │   ├── ItemEdit.tsx
│       │   ├── Groups.tsx
│       │   ├── SignIn.tsx / SignUp.tsx / ResetPassword.tsx
│       │   └── admin/Users.tsx
│       ├── features/
│       │   ├── items/                     # api.ts, types.ts, ItemForm.tsx
│       │   └── groups/                    # api.ts, types.ts, components/
│       ├── components/                    # Navbar, AuthGate, AdminGate, ImageUploader, ItemCard
│       │   └── ui/                        # Button, Input, Card, Modal, Badge
│       ├── hooks/                         # useAuth, useRole, useFeed
│       ├── lib/                           # supabaseClient, types, image, bootstrapUser
│       ├── theme/tokens.css               # CSS variables
│       ├── App.css / index.css
│       └── mcp/                           # ⚠️ Aspirational planning notes (PLAN.md, SUPABASE_ARCHIVE.md)
└── supabase/
    ├── README.md
    ├── config.toml                        # Local CLI config (no [auth] block)
    ├── bootstrap.sql                      # Tables, profile trigger, role helpers, get_my_role
    ├── backfill-profiles.sql              # One-off utility
    ├── DEPLOY_EDGE_FUNCTION.md
    ├── storage-buckets.md
    ├── functions/
    │   └── admin-users/                   # Only edge function that actually exists
    │       ├── index.ts
    │       └── deno.json
    ├── migrations/                        # ⚠️ Non-sequential numbering, see Known Issues
    │   ├── 03_indexes_and_constraints.sql
    │   ├── 06_trigger_add_owner.sql
    │   ├── 07_policies_group_members.sql
    │   ├── 08_storage_policies_images.sql # Old, broad-permission set
    │   ├── 10_get_user_email_function.sql # ⚠️ Restricted to admin only via migration 12
    │   └── 11_storage_policies_images.sql # Newer, item-scoped set
    └── archive-debug-scripts/             # Historical fix scripts, reference only
```

---

## Local Development

### Prerequisites

- Node **20.17.0** (pinned in `web/netlify.toml`; any 20.x should work locally)
- npm
- A Supabase project ([free tier](https://supabase.com))
- (Optional) Supabase CLI for deploying the Edge Function

### 1. Clone & install

```bash
git clone https://github.com/Cmrandall86/Stuff-Cycler.git Circulate
cd Circulate/web
npm install
```

> Note: The GitHub repository is still hosted at `Cmrandall86/Stuff-Cycler`. The `Circulate` argument above renames the cloned folder locally to match the current project name.

> Note: All Node tooling lives under `web/`. There is no `package.json` at the repo root (only a stray `package-lock.json` — see [Cleanup Backlog](#cleanup-backlog)).

### 2. Environment variables

Create `web/.env.local` (see [Environment Variables](#environment-variables) for the full reference):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_NAME="Circulate"
VITE_IMAGE_BUCKET="images"
```

### 3. Database setup

> ⚠️ **There is real schema drift here.** Do not just paste files blindly. Read [Known Issues](#known-issues--technical-debt) first. The steps below produce a working DB but you must apply the patches called out in step 3c.

In the Supabase SQL editor, run **in this order**:

**3a. Bootstrap**

Run `supabase/bootstrap.sql`. This creates: `groups`, `group_members`, `items`, `item_images`, `item_visibility_groups`, `interests`, `reservations`, `profiles`; the `handle_new_user` trigger; the role guard; and the `get_my_role()` RPC.

**3b. Migrations** — in numeric order, but with caveats

| File | Status | What it does |
|------|--------|--------------|
| `03_indexes_and_constraints.sql` | ✅ Safe | Ghost-table index references (`group_invitations`, `group_join_requests`) removed. Only `group_members` indexes and `uq_group_single_owner` constraint remain. |
| `06_trigger_add_owner.sql` | ✅ Safe | Adds membership row for group owner automatically. |
| `07_policies_group_members.sql` | ✅ Safe | Enables RLS and policies on `group_members`. |
| `08_storage_policies_images.sql` | ⚠️ **Do not apply on its own** | Grants `anon` SELECT on the entire `images` bucket — undermines privacy. Skip this and apply `11` instead. |
| `10_get_user_email_function.sql` | ⚠️ Apply + migration 12 together | Creates the function; migration 12 restricts it to admin callers only. Apply both or neither. |
| `11_storage_policies_images.sql` | ⚠️ Requires patch | This file references `items.visibility`, a column that is **not** in `bootstrap.sql`. Add `alter table items add column if not exists visibility text not null default 'public';` before running. Not idempotent — only run once. |

**3c. Required schema patch** (not yet committed as its own migration):

```sql
alter table items add column if not exists visibility text not null default 'public'
  check (visibility in ('public','groups'));
```

The frontend writes this column on every item create/update; without it inserts will silently drop the field or, if the policy in `11` is active, reads will fail.

**3d. (Optional)** `backfill-profiles.sql` — if you have existing auth users without `profiles` rows.

### 4. Storage

Create a **private** bucket named `images` (or let `11_storage_policies_images.sql` create it — it inserts with `public = false`).

### 5. Authentication

In Supabase Dashboard → Authentication → Providers:

- Enable **Email** (allow password sign-ups)
- Enable **Google** and **Discord** with OAuth credentials
- URL Configuration → Site URL = `http://localhost:5173` (and add it as a redirect URL)
- For production, add your Netlify URL as a redirect URL too

### 6. Edge Function (admin panel)

```bash
supabase link --project-ref your-project-ref
supabase functions deploy admin-users
supabase secrets set \
  SUPABASE_URL=https://your-project.supabase.co \
  SUPABASE_ANON_KEY=your-anon-key \
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  ALLOW_ORIGINS=http://localhost:5173,https://your-site.netlify.app
```

> The root README has historically omitted `SUPABASE_ANON_KEY` and `ALLOW_ORIGINS`, but both are required. See `supabase/DEPLOY_EDGE_FUNCTION.md` for full detail.

### 7. Promote yourself to admin

Run in the SQL editor while signed in to the app:

```sql
update profiles set role = 'admin' where id = auth.uid();
```

### 8. Run the app

```bash
cd web
npm run dev
```

Visit `http://localhost:5173`.

---

## Environment Variables

### Frontend (Vite — `web/.env.local` and Netlify Site Settings)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `VITE_SUPABASE_URL` | ✅ | `https://abc.supabase.co` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | `eyJ…` | Anon/public key. **Never** the service-role key. |
| `VITE_APP_NAME` | ✅ | `"Circulate"` | Used in UI chrome |
| `VITE_IMAGE_BUCKET` | ✅ | `"images"` | Storage bucket name |

### Edge Function secrets (`supabase secrets set …`)

| Secret | Required | Notes |
|--------|----------|-------|
| `SUPABASE_URL` | ✅ | Same project URL |
| `SUPABASE_ANON_KEY` | ✅ | Used to validate the caller's JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Privileged operations only — **never** expose to client |
| `ALLOW_ORIGINS` | ✅ | Comma-separated list. Defaults include localhost + a Netlify URL; override for your domain. |

---

## Deployment (Netlify)

- **Repo:** GitHub `Cmrandall86/Stuff-Cycler` (repository not yet renamed; project name is Circulate)
- **Deploys from:** `main` branch
- **Site base directory:** `web` ← **must be set in Netlify UI**, because `netlify.toml` lives at `web/netlify.toml`, not the repo root.
- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Node version:** pinned to `20.17.0` in `netlify.toml`
- **SPA fallback:** `/*` → `/index.html` 200 (both via `netlify.toml` and `web/public/_redirects`)
- **Environment variables:** set the four `VITE_*` values listed above in **Site Settings → Environment Variables**

---

## Architecture Overview

### Authentication & role model

```
auth.users (Supabase Auth)
     │
     │ AFTER INSERT trigger → handle_new_user()
     ▼
profiles { id, display_name, avatar_url, role: 'member' | 'admin' }
     │
     │ profiles_guard_role trigger blocks non-admin role changes
     ▼
RPC get_my_role()  ← called by frontend useRole()
```

- The frontend gate components are `<AuthGate>` (any session) and `<AdminGate>` (role === 'admin' via `get_my_role` RPC).
- The `admin-users` Edge Function re-validates the caller's JWT, checks role server-side, then uses the service-role key for privileged operations.

### Item visibility model

```
items.visibility = 'public'    → readable by anyone (incl. unauthenticated)
items.visibility = 'groups'    → joined through item_visibility_groups
                                  → group_members → only members can read
```

This is enforced (intended to be enforced) by Postgres RLS for the rows, and by storage policies (`11_storage_policies_images.sql`) for the underlying image objects.

### Group model

- `groups` are owned (`owner_id`) and have a many-to-many membership in `group_members` with a free-text `role` (`owner` | `admin` | `member`).
- Owner gets a `group_members` row automatically via the `add_owner_membership` trigger (migration `06`).
- A partial unique index in migration `03` enforces a single `owner` per group: `uq_group_single_owner (group_id) where role = 'owner'`.

### Storage layout

- Bucket: `images`, private.
- Path convention: `items/{itemId}/{filename}` (enforced by policies in `11`).
- Reads always go through 1-hour signed URLs requested by the client.

---

## Known Issues & Technical Debt

### 🔴 Schema drift (must fix before a fresh deploy)

1. **`items.visibility` column is missing from `bootstrap.sql`** but is referenced by the frontend (every item create/update writes it), by migration `11_storage_policies_images.sql`, and by most archive RLS scripts.
2. ~~**Migration `03_indexes_and_constraints.sql` references tables that do not exist**~~ — **Fixed.** Ghost-table index references removed; only `group_members` indexes remain.
3. **Migrations `08` and `11` for storage are contradictory.** `08` grants anon SELECT on the entire bucket; `11` enforces item-scoped reads for authenticated users. Both have different policy names so they accumulate rather than replace, which means if both are applied the broad-permission `08` policy wins via the OR semantics of multiple permissive policies.
4. **Bootstrap claims RLS, but does not enable it.** `bootstrap.sql` contains zero `enable row level security` or `create policy` statements. The only public-schema RLS that ships through migrations is on `group_members` (file `07`). `groups`, `items`, `item_images`, `item_visibility_groups`, `interests`, `reservations`, and `profiles` are **unprotected by RLS** out of the box. The full RLS picture exists in `supabase/archive-debug-scripts/rls-policies.sql` but is explicitly marked reference-only.
5. **Migration numbering has gaps**: 03, 06, 07, 08, 10, 11. Missing 01, 02, 04, 05, 09. Either renumber as a clean `01_…` sequence (and version-stamp `bootstrap.sql`) or rebuild the chain.
6. **Migration `11` is not idempotent** — it `create policy` without first dropping by name. Second run fails.
7. **`send-group-invitation` Edge Function is documented in `supabase/README.md` but does not exist on disk.** Either implement it or remove from docs.

### 🔴 Security concerns

1. ~~**`get_user_email(uuid)` PII exposure**~~ — **Fixed (migration 12).** The function is now restricted to `admin` callers only. Any non-admin call raises an exception. The `search_path` hardening item below still applies.
2. **Storage policy `08_storage_policies_images.sql`** grants `SELECT TO anon, authenticated` on every object in the `images` bucket. Anyone with the storage URL can read any image. Drop or replace with `11`.
3. **`SECURITY DEFINER` functions without `set search_path = …`**: `add_owner_membership` (migration `06`), `get_user_email` (migration `10`). Standard Postgres hardening guidance is to pin `search_path` on every `SECURITY DEFINER` function.
4. **`get_my_role()` is granted to `anon`**. Low impact (returns NULL for anonymous), but unusual and worth tightening to `authenticated`.
5. **`profiles` has no RLS**. Combined with the above, in the current state the schema relies on PostgREST/Supabase defaults rather than explicit policy. This is the single biggest production-readiness gap.

### 🟡 Frontend code quality

1. ~~**Query-key inconsistency for items.**~~ — **Fixed.** All detail queries and invalidations now use `itemKeys.one(id)` = `['items', id]`.
2. **Manual domain types remain.** Generated types are now wired (`web/src/lib/database.types.ts`, `createClient<Database>()`). Hand-written domain types in `lib/types.ts` and feature `types.ts` files still exist and should be gradually reconciled: `Item` is missing `visibility`; `Group`/`GroupMember`/`ItemVisibilityGroup` are duplicated across files with slight shape differences.
3. **`zod` is installed but never imported.** Either adopt it for form validation (recommended) or remove the dependency.
4. **`eslint.config.js` is orphaned.** No `eslint` or plugin packages in `web/package.json` and no `lint` script. The config currently does nothing.
5. **No `typecheck` script.** `tsc --noEmit` would catch the type-drift issues above. Add `"typecheck": "tsc --noEmit"` to `web/package.json`.
6. **No automated tests.** `.gitignore` reserves `coverage/` but no test runner is installed and no `*.test.*` / `*.spec.*` files exist.
7. ~~**No React error boundary.**~~ ✅ Done (`web/src/components/ErrorBoundary.tsx` wraps `RouterProvider`)
8. ~~**`alert()` is used for user-visible errors** in several places (auth and group flows). Replace with toast notifications.~~ ✅ Done (`sonner`)
9. **`console.error` / `console.warn` / `console.debug` are scattered through the codebase** — fine for development, but a logger abstraction with environment gating would be cleaner.
10. **`UserSearchInput.tsx` has dead props.** `groupId` is accepted but never used in the component body, and `excludedEmails` is documented but never applied to the filter.
11. **`useRemoveMember`** checks whether the group has any owner, not whether the *target* being removed is the sole owner. A non-owner could in principle slip through this check; verify and add explicit "target is not the last owner" logic.
12. **Item detail page (`routes/Item.tsx`) selects `item_visibility_groups` from the API but never renders the visibility metadata** for owners. Owners cannot see which groups their item is shared with on the detail page (only on edit).
13. **`web/index.html`** has no favicon yet. Add a `/favicon.ico` (or SVG) once brand assets are ready.

### 🟡 Documentation inconsistencies

- The current root README points to `08_storage_policies_images.sql` for storage policies. `docs/IMAGE_*` and the implementation actually depend on `11_storage_policies_images.sql`. (Fixed in this rewrite.)
- The root README's Edge Function setup omits `SUPABASE_ANON_KEY` and `ALLOW_ORIGINS`. (Fixed in this rewrite.)
- The Netlify base-directory requirement was never documented. (Fixed in this rewrite.)
- `supabase/README.md` lists a `send-group-invitation` function that does not exist.
- `web/stuff_cycler_starter_kit_scaffold_sql_rls_notes.md` was a stale starter-kit scaffold doc with contradictory table names. **Deleted.**
- `web/README.md` is the default Vite + React template.

---

## Cleanup Backlog

Concrete, mechanical tasks. Mostly safe and quick. Suitable for a "cleanup" PR before any feature work.

- [ ] **Delete or rewrite `web/README.md`** (currently the default Vite template).
- [x] **Delete `web/stuff_cycler_starter_kit_scaffold_sql_rls_notes.md`** (stale, misleading). ✅ Done
- [ ] **Delete `web/src/mcp/`** or move to `docs/proposals/` (it is aspirational planning, not runtime code).
- [ ] **Fix `web/index.html`** — set a real title and favicon, or remove the icon link.
- [x] **Remove root-level `package-lock.json`** (there is no root `package.json`). ✅ Done
- [ ] **Either commit to ESLint or remove the orphan config** — add the deps + a `lint` script in `web/package.json`, or delete `eslint.config.js`.
- [x] **Add `typecheck` script:** `"typecheck": "tsc --noEmit"` in `web/package.json`. ✅ Done
- [ ] **Remove unused `zod` dependency** or start using it (recommend the latter).
- [x] **Generate Supabase types** — `web/src/lib/database.types.ts` generated; `createClient<Database>()` wired. ✅ Done
- [ ] **Unify `Group`/`GroupMember` type definitions** (`lib/types.ts` vs `features/groups/types.ts`).
- [x] **Unify item query keys** under `itemKeys`. ✅ Done
- [x] **Replace `alert()` with a toast component** (`sonner`). ✅ Done
- [x] **Add a top-level React error boundary** in `main.tsx`. ✅ Done
- [ ] **Reconcile migrations** into a clean sequential chain (`01_schema.sql`, `02_triggers.sql`, `03_rls.sql`, `04_storage.sql`, …). Promote the consolidated RLS story from `archive-debug-scripts/rls-policies.sql` into a real migration, *after* review and removal of overly permissive `profiles` policies.
- [ ] **Add the `items.visibility` column to `bootstrap.sql`** (or, better, replace bootstrap with the migration chain entirely).
- [ ] **Remove or implement `send-group-invitation`** referenced in `supabase/README.md`.
- [x] **Tighten `get_user_email`** — restricted to admin callers only (migration 12). ✅ Done
- [ ] **Drop migration `08` storage policy set** (keep only `11`).
- [ ] **Pin `search_path`** on all `SECURITY DEFINER` functions.

---

## Roadmap

Organized in tiers from "necessary to call this a real product" → "differentiation".

### Tier 0 — Production-readiness (blockers)

These overlap with [Known Issues](#known-issues--technical-debt) but are listed here for planning.

1. **RLS hardening.** Enable RLS on every public-schema table and write a reviewed policy set. Single migration, derived from `archive-debug-scripts/rls-policies.sql` but with `profiles` SELECT tightened (don't expose all profile rows to anonymous), `INSERT` not `with check (true)`, etc.
2. **Migration chain rebuild.** Either: (a) make `bootstrap.sql` the single source of truth for v1 schema and renumber migrations from `01`, or (b) drop `bootstrap.sql` and rely on `supabase db push` against the migrations folder. Decide one model and document it.
3. ~~**Email-lookup hardening**~~ — restricted to admin via migration 12. ✅ Done
4. **Storage policy reconciliation** (delete `08`, keep `11` after making it idempotent).
5. **Add basic CI**: GitHub Actions running `tsc --noEmit`, `npm run build`, and `eslint .` on every PR.

### Tier 1 — Core product (unlocks usability)

1. **Feed pagination + filters.** Currently `useFeed` limits to 50 most recent items. Add infinite scroll (TanStack Query `useInfiniteQuery`), filter by category, and a search box on title/description.
2. **Item lifecycle states.** Today `items.status` defaults to `'active'` and is never changed. Wire up `available` → `reserved` → `claimed` → `archived` flows. The `interests` and `reservations` tables already exist but have no UI.
3. **Interest / "I want this" flow.** Tap a button on an item → row in `interests`. Owner sees a list of interested users on item detail.
4. **Reservation / claim flow.** Owner picks a claimer → row in `reservations` with `expires_at`. Item becomes `reserved` until pickup is confirmed or the reservation expires.
5. **User profile page** (`/profile/$id`). Display name, avatar, items posted, mutual groups. Currently there is no way to view another user.
6. **Profile self-edit page** (`/settings`). Change display name, avatar (Storage upload), and password.
7. **Email verification UX.** Today the app parses the `"Email not confirmed"` error string and `alert()`s. Add a real "please verify your email" screen + resend flow.
8. **Real invitation system.** Migration `03` referenced `group_invitations` and `group_join_requests` tables that never made it. Implement them, build the `send-group-invitation` Edge Function the docs already promise (Resend or Supabase email), and gate invite-only groups behind an invitation token.
9. **Toast / notification UI primitive.** Replaces `alert()` and gives Tier 2 features (in-app notifications) a place to render.

### Tier 2 — Engagement & community

1. **Comments / messages on items.** A `comments` table scoped to `item_id` with RLS mirroring item visibility.
2. **Direct messages between users.** New schema (`conversations`, `messages`) with RLS by participant.
3. **In-app notifications.** A `notifications` table; events: new interest in your item, you were invited to a group, your reservation expires soon, etc. Triggered from DB-side `AFTER INSERT` functions for atomic delivery.
4. **Push / email notifications.** Edge Function consumer of the notifications table → email via Resend / push via web-push.
5. **Activity feed per group.** "New item posted to Family Circle" etc.

### Tier 3 — Trust, safety, moderation

1. **Report / flag system.** `reports` table, admin queue at `/admin/reports`.
2. **Audit log** for admin actions (who banned whom, who promoted whom).
3. **Soft delete for items and groups** (`deleted_at` column), with admin-only hard delete.
4. **Rate limiting** on item creation, member-add, and invitation-send.
5. **Image content checks** — at minimum size/MIME validation server-side, optionally an Edge Function that runs basic NSFW scoring before publish.

### Tier 4 — Differentiation

1. **Geo / distance** — "items within 10 km of me". `approx_location` is a free-text field today; introduce a real coordinate column + `earthdistance` extension.
2. **Auto-tagging** of items from images (Edge Function calling a vision API).
3. **Scheduled releases.** Publish at `publish_at` (the column already exists, never used).
4. **Recurring "cycle" giveaways** — schedule an item to be available, with a draw or first-come logic.
5. **PWA / mobile install** — service worker, offline cache of feed, push notifications.

---

## Reference Documents

| Path | Purpose |
|------|---------|
| `supabase/README.md` | Backend overview (note: mentions a `send-group-invitation` function that doesn't exist) |
| `supabase/DEPLOY_EDGE_FUNCTION.md` | Step-by-step deployment for `admin-users` |
| `supabase/storage-buckets.md` | Storage bucket config and upload policy notes |
| `docs/GROUPS_MEMBERSHIP.md` | Groups feature spec (invite-only vs open, roles, visibility) |
| `docs/IMAGE_IMPLEMENTATION.md` | Image pipeline implementation summary |
| `docs/IMAGE_DEPLOYMENT_CHECKLIST.md` | Pre/post deploy QA for image features |
| `supabase/archive-debug-scripts/` | Historical fix-up SQL. Reference only. **Do not** run `TEMP-DISABLE-RLS.sql` or `NUCLEAR-*.sql` against shared databases. |

---

## Agent / Contributor Notes

This repo is set up for Cursor-driven agent work:

- `skills-lock.json` pins the committed Supabase agent skills.
- `.agents/skills/supabase/SKILL.md` is the canonical reference an agent should read before touching Supabase.
- `.agents/skills/supabase-postgres-best-practices/SKILL.md` covers query/index/RLS guidance.
- When working on a feature, **read this README's [Known Issues](#known-issues--technical-debt) section first** so you don't paper over schema drift with another patch.

### Conventions in this codebase

- Path alias `@/*` → `web/src/*`.
- TanStack Router routes are declared imperatively in `web/src/main.tsx`; add new routes there and to the route tree at the bottom.
- React Query keys live in `features/*/api.ts` under a `*Keys` const (this is the model, even though `items` currently violates it — fixing is on the cleanup list).
- Image paths in the `images` bucket are always `items/{itemId}/{filename}`. Never write objects to other top-level folders.
- Never put the Supabase service-role key in any `VITE_*` variable.

### Manual testing checklist

(Preserved from the prior README; eventually replace with automated tests.)

- [ ] Email/password sign-up creates a profile automatically
- [ ] Sign in / sign out flows work
- [ ] Google and Discord OAuth sign-in work
- [ ] Non-admin cannot access `/admin/users` (gets redirected)
- [ ] Admin can list, create, edit, and delete users
- [ ] Password reset email → `/reset-password` → redirect to sign-in
- [ ] Items can be created with images and visibility settings
- [ ] Groups can be created and members added/removed
- [ ] Feed shows items respecting visibility rules
- [ ] Signed image URLs render in feed and on detail pages
