# CLAUDE.md — Circulate

AI agent context document. Read this before making any changes to this codebase.
For engineering working memory and current priorities, also read `docs/ACTIVE_CONTEXT.md`.

---

## What is Circulate?

A private-first community item-sharing platform. Users post items they want to give away, control who can see them (public or specific groups/circles), and browse what others are offering. No marketplace mechanics — no payments, no shipping. Community trust model.

- **Production URL:** https://use-circulate.netlify.app
- **GitHub repo:** `Cmrandall86/Stuff-Cycler` (not yet renamed on GitHub)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript (strict), Vite 5 |
| Router | TanStack Router 1.x — imperative route tree in `web/src/main.tsx` |
| Server state | TanStack Query 5 — shared `QueryClient`, 60 s `staleTime` |
| Styling | Tailwind 3 + CSS custom-property tokens (`web/src/theme/tokens.css`) |
| Backend | Supabase (Postgres 15, Auth, Storage, Edge Functions) |
| Edge runtime | Deno (Supabase Edge Functions) |
| Hosting | Netlify (frontend), Supabase Cloud (backend) |
| Path alias | `@/*` → `web/src/*` |

---

## Repository Layout

```
Circulate/
├── CLAUDE.md                     ← this file
├── README.md                     ← user-facing project reference
├── docs/                         ← all documentation
│   ├── ACTIVE_CONTEXT.md         ← engineering working memory (read every session)
│   ├── RLS_HARDENING_PLAN.md     ← RLS phase plan (read only when doing RLS work)
│   ├── supabase-overview.md      ← Supabase backend overview
│   ├── deploy-edge-functions.md  ← Edge Function deployment guide
│   ├── storage-buckets.md        ← Storage bucket setup
│   ├── GROUPS_MEMBERSHIP.md      ← Groups feature spec
│   ├── IMAGE_IMPLEMENTATION.md   ← Image pipeline implementation
│   ├── IMAGE_DEPLOYMENT_CHECKLIST.md
│   ├── rls-policies-reference.sql  ← Reference for Phase 2+ RLS work
│   └── TEMP-DISABLE-RLS.sql       ← Emergency RLS rollback (Phase 4 rollback option)
├── web/                          ← Vite + React app (the only Node package)
│   ├── package.json
│   ├── src/
│   │   ├── main.tsx              ← Router + QueryClient + AuthProvider wiring
│   │   ├── routes/               ← Page components
│   │   ├── features/             ← items/, groups/, admin-items/
│   │   ├── components/           ← Navbar, AuthGate, AdminGate, ImageUploader, ErrorBoundary
│   │   │   └── ui/               ← Button, Input, Card, Modal, Badge
│   │   ├── hooks/                ← useAuth, useRole, useFeed
│   │   ├── lib/                  ← supabaseClient, database.types.ts, image, bootstrapUser
│   │   └── theme/tokens.css      ← CSS custom-property tokens
└── supabase/
    ├── bootstrap.sql             ← Initial schema (⚠️ has known drift — see README Known Issues)
    ├── backfill-profiles.sql     ← One-off utility
    ├── config.toml
    ├── migrations/               ← Applied migrations (do NOT delete or rename)
    └── functions/
        ├── admin-users/          ← User management Edge Function
        └── admin-items/          ← Item moderation Edge Function
```

---

## Code Conventions

- **Path alias:** `@/*` → `web/src/*`. Always use `@/` for cross-feature imports.
- **New routes** are declared imperatively in `web/src/main.tsx`. Add to route tree there.
- **React Query keys** live in `features/*/api.ts` under a `*Keys` const.
- **Image paths** in the `images` storage bucket are always `items/{itemId}/{filename}`. Never write to other top-level folders.
- **Never put the Supabase service-role key in any `VITE_*` variable.**
- **TypeScript is strict** (`noUnusedLocals`, `noUnusedParams`). Run `npm run typecheck` after changes.
- **Verify with:** `npm run typecheck` then `npm run build` for any non-trivial frontend change.

---

## Key Architecture

### Auth & roles
- Session via `AuthProvider` → `useAuth()` hook in `web/src/hooks/useAuth.ts`
- Role stored on `profiles.role` (`'member'` | `'admin'`), loaded via `get_my_role()` RPC → `useRole()`
- `<AuthGate>` — requires any session; `<AdminGate>` — requires `role === 'admin'`
- **Single admin role only. No moderator tier.**

### Item visibility
- `items.visibility = 'public'` → readable by anyone
- `items.visibility = 'groups'` → readable by members of groups in `item_visibility_groups`
- ⚠️ Currently decorative — no RLS enforces this yet. See RLS hardening plan.

### Admin moderation
- Admin controls live in normal item flows (`/item/$id`, `/item/$id/edit`), not a separate dashboard
- Non-owner admin operations route through the `admin-items` Edge Function (service-role)
- Admin user management via `admin-users` Edge Function

### Edge Functions — narrow use only
Use Edge Functions only when the Supabase service-role key or `auth.admin` API is required. Normal data queries go through the Supabase JS client directly.

Both functions verify JWT + `profiles.role === 'admin'` before using service-role.

### Storage
- Private bucket: `images`
- All reads go through 1-hour signed URLs

---

## Development Rules

1. **Prefer small, surgical changes.** Do not refactor unrelated code.
2. **Plan before building.** For non-trivial work, inspect relevant files and propose the smallest safe change. Wait for approval before editing security/auth/migration/RLS code.
3. **No new routes, components, hooks, or abstractions unless explicitly requested.**
4. **Never expose the service-role key to frontend code.**
5. **Do not casually edit applied migrations.** Prefer additive new migrations.
6. **No separate moderation dashboard.** Admin tooling lives in existing pages.
7. **No new roles.** Single admin role only.
8. **After completing a task, stop.** Do not opportunistically fix unrelated issues.

---

## Known Open Issues (summary)

- **RLS not enabled** on most tables — `items`, `groups`, `profiles`, `item_images` are unprotected. Only `group_members` has RLS. This is the biggest production-readiness gap.
- **Schema drift:** `items.visibility` exists in production but is absent from `bootstrap.sql`.
- **Migration gaps:** non-sequential numbering (03, 06, 07, 08, 10, 11, 12). Migrations 08 and 11 for storage are contradictory.
- **`send-group-invitation` Edge Function** is documented in `supabase/README.md` (now `docs/supabase-overview.md`) but does not exist on disk.

Full details and the ordered priority list are in `docs/ACTIVE_CONTEXT.md`.
Full RLS phased plan is in `docs/RLS_HARDENING_PLAN.md`.

---

## Session Startup Checklist

For any non-trivial session, read:
1. `CLAUDE.md` (this file) — always
2. `docs/ACTIVE_CONTEXT.md` — always
3. `docs/RLS_HARDENING_PLAN.md` — only when doing RLS/migration work
