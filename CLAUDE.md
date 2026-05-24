# CLAUDE.md — Circulate

AI agent context document. Read this before making any changes to this codebase.
For engineering working memory and current priorities, also read `docs/ACTIVE_CONTEXT.md`.

---

## What is Circulate?

A private-first community item-sharing platform. Users post items they want to give away, control who can see them (public or specific groups/circles), and browse what others are offering. No marketplace mechanics — no payments, no shipping. Community trust model.

- **Production URL:** https://use-circulate.netlify.app
- **GitHub repo:** `Cmrandall86/Circulate`

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
├── .agents/skills/               ← project agent skills (read when relevant)
├── README.md                     ← user-facing project reference
├── docs/                         ← all documentation
│   ├── agents/                   ← issue tracker, triage labels, domain doc config
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
│   │   ├── features/             ← items/, groups/, admin-items/, feedback/
│   │   ├── components/           ← Navbar, AuthGate, AdminGate, ImageUploader, ErrorBoundary
│   │   │   └── ui/               ← Button, Input, Card, Modal, Badge
│   │   ├── hooks/                ← useAuth, useRole, useFeed
│   │   ├── lib/                  ← supabaseClient, database.types.ts, image, itemQueryCache, bootstrapUser
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
- **Item detail cache refresh:** After any mutation that changes item metadata, images, or visibility, call `refreshItemDetailCaches(qc, itemId)` from `web/src/lib/itemQueryCache.ts`. Item detail uses **two** query keys — normal (`itemKeys.one`) and admin (`adminItemKeys.one`) — depending on role; refresh **both**. With `staleTime: 60_000`, `invalidateQueries` alone often leaves stale UI until a hard refresh; **await `refetchQueries`** on both keys (and images/visibility) before navigating away from edit flows.
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
- `useAuth()` also exposes `clearUser()` — force-sets `user` to `null` in React state. Use only in sign-out paths where `supabase.auth.signOut()` fails (e.g. expired token) and `onAuthStateChange` SIGNED_OUT is never fired.
- **supabase-js v2 sign-out quirk:** `signOut()` makes a network request for **all** scopes including `local`. If the access token is expired the server returns 403 / `"Auth session missing!"`. The Navbar `handleSignOut` treats this as non-fatal and proceeds with local cleanup (targeted `localStorage.removeItem`, `clearUser()`, query cache clear, navigate).
- **Single admin role only. No moderator tier.**

### Item visibility
- `items.visibility = 'public'` → readable by anyone
- `items.visibility = 'groups'` → readable by members of groups in `item_visibility_groups`
- ✅ Enforced at the DB level via `items_select` RLS policy (migration 14). Uses `public.user_in_item_groups()` SECURITY DEFINER helper to avoid recursion.

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

## Agent skills

Project-specific agent skills live in `.agents/skills/`. They reduce hallucinations, tighten scope, save tokens, and keep work aligned with how Circulate actually works. **When a skill applies, read its `SKILL.md` and follow it** — do not reconstruct steps from memory.

### Suggest before you start

At the start of a session — or as soon as the user's intent is clear — **propose the best-matching skill(s) in one short sentence** before reading files or editing code. Wait for approval before starting a grilling session, publishing a PRD, or breaking work into issues unless the user explicitly asked for that workflow.

| User intent | Suggest |
|---|---|
| Vague feature, product direction, or "what should this do?" | `grill-me` or `grill-with-docs` |
| Plan exists; stress-test against domain language and docs | `grill-with-docs` |
| Conversation is ready to become a spec | `to-prd` → then `to-issues` |
| Any code change in this repo | `circulate-safe-change` (+ `supabase` if backend) |
| Bug, regression, or "something is broken" | `diagnose` |
| Quick surgical fix; user wants terse replies | `caveman` |
| Explore UI or state-machine options before committing | `prototype` |
| Test-first implementation | `tdd` |
| Hand off to another session/agent | `handoff` |

### Issue tracker

GitHub Issues on `Cmrandall86/Circulate` via `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles with default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` + `docs/adr/` at repo root (created lazily during grilling). See `docs/agents/domain.md`.

### Recommended workflows

**Extract full product scope (preferred for new features):**

1. **`grill-me`** — interview the user one question at a time until the decision tree is resolved. Use when the idea is still in the user's head.
2. **`grill-with-docs`** — same grilling, but challenge terms against the codebase, sharpen vocabulary, and update `CONTEXT.md` / `docs/adr/` inline as decisions land. Prefer this once domain language matters or the feature touches existing concepts.
3. **`to-prd`** — synthesize the conversation into a PRD and publish to the issue tracker (does not re-interview).
4. **`to-issues`** — break the PRD into independently grabbable vertical-slice tickets.
5. **`circulate-safe-change`** (+ `supabase` / `tdd` as needed) — implement.

**Quick edits:** When the user invokes caveman mode (`caveman`, `/caveman`, "less tokens", "be brief"), read `.agents/skills/caveman/SKILL.md` and stay in terse mode until they say "stop caveman" or "normal mode".

**Implementation baseline:** For any production edit, read `.agents/skills/circulate-safe-change/SKILL.md` first — it encodes this repo's scope, Supabase safety, and verification rules.

### Skill catalog

| Skill | Path | Use when |
|---|---|---|
| circulate-safe-change | `.agents/skills/circulate-safe-change/SKILL.md` | Before any implementation change in this repo |
| grill-me | `.agents/skills/grill-me/SKILL.md` | Stress-test a plan via one-at-a-time interview |
| grill-with-docs | `.agents/skills/grill-with-docs/SKILL.md` | Grill + align terminology; update `CONTEXT.md` / ADRs |
| caveman | `.agents/skills/caveman/SKILL.md` | Ultra-compressed communication for quick edits |
| to-prd | `.agents/skills/to-prd/SKILL.md` | Turn conversation context into a published PRD |
| to-issues | `.agents/skills/to-issues/SKILL.md` | Break a plan or PRD into implementation issues |
| setup-matt-pocock-skills | `.agents/skills/setup-matt-pocock-skills/SKILL.md` | One-time repo config for issue-tracker skills |
| triage | `.agents/skills/triage/SKILL.md` | Create, triage, or route issues through workflow states |
| diagnose | `.agents/skills/diagnose/SKILL.md` | Hard bugs or performance regressions |
| prototype | `.agents/skills/prototype/SKILL.md` | Throwaway UI or logic prototype before committing |
| tdd | `.agents/skills/tdd/SKILL.md` | Red-green-refactor / test-first development |
| supabase | `.agents/skills/supabase/SKILL.md` | Any Supabase task (DB, auth, RLS, Edge Functions, storage) |
| supabase-postgres-best-practices | `.agents/skills/supabase-postgres-best-practices/SKILL.md` | Query/schema performance review |
| improve-codebase-architecture | `.agents/skills/improve-codebase-architecture/SKILL.md` | Find deep-module / refactoring opportunities |
| handoff | `.agents/skills/handoff/SKILL.md` | Compact session into a handoff doc |
| zoom-out | `.agents/skills/zoom-out/SKILL.md` | Need higher-level context on unfamiliar code |
| write-a-skill | `.agents/skills/write-a-skill/SKILL.md` | Author a new agent skill |

Bundled reference files (e.g. `grill-with-docs/CONTEXT-FORMAT.md`, `grill-with-docs/ADR-FORMAT.md`) are read only when the parent skill calls for them.

---

## Known Open Issues (summary)

- **RLS normalised** (migrations 14 + 15 + 17) — all core tables have RLS + correct policies. Migration 15 adds admin DELETE for `feedback`. ~~Admin image delete gap~~ ✅ Phase 5 — `useDeleteImage(bypassOwnerCheck)` routes through `admin-items` Edge Function.
- **Schema drift:** `bootstrap.sql` updated with `items.visibility`, `profiles.public_area`, lifecycle status defaults (May 24 2026). Migration `03` still references non-existent invitation tables — post-V1 cleanup only.
- **Migration gaps:** non-sequential numbering (03, 06, 07, 08, 10, 11, 12, 13, 14, 15). Migrations 08 and 11 for storage are contradictory.
- **`send-group-invitation` Edge Function** is documented in `docs/supabase-overview.md` but does not exist on disk.

Full details and the ordered priority list are in `docs/ACTIVE_CONTEXT.md`.
Full RLS phased plan is in `docs/RLS_HARDENING_PLAN.md`.

---

## Session Startup Checklist

For any non-trivial session, read in this order:
1. `CLAUDE.md` (this file) — always
2. `docs/ACTIVE_CONTEXT.md` — always
3. **Propose a relevant agent skill** from `.agents/skills/` (see [Agent skills](#agent-skills)) — before reading extra files or editing code
4. Task-specific docs only when relevant (e.g. `docs/RLS_HARDENING_PLAN.md` for RLS/migration work)
5. `docs/agents/*.md` — when using `to-prd`, `to-issues`, or `triage`
