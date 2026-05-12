---
name: circulate-safe-change
description: Enforces disciplined, scoped, production-minded changes in the Circulate repo. Use before making any implementation changes — editing routes, components, hooks, migrations, RLS policies, Edge Functions, auth logic, or any production code. Triggers on: new feature work, bug fixes, schema changes, security edits, refactors, or any non-trivial edit in this codebase.
disable-model-invocation: true
---

# Circulate Safe Change

Follow these rules before and during any implementation work in this repo.

## 1. Read context first

- For normal work, read `README.md` and `docs/ACTIVE_CONTEXT.md`.
- Only read `docs/RLS_HARDENING_PLAN.md` when actively working on RLS, migrations, or security policies.
- Do not load unnecessary docs for tiny edits.

## 2. Scope control

- Prefer small, surgical changes.
- Do not refactor unrelated code.
- Do not create new routes, components, hooks, docs, or abstractions unless explicitly requested.
- Prefer extending existing flows over creating parallel systems.

## 3. Plan before build

- For non-trivial work, first inspect relevant files and propose the smallest safe change.
- **Wait for approval before editing** when the task touches security, migrations, RLS, auth, Edge Functions, or data deletion.
- For tiny obvious edits, proceed — but keep changes minimal.

## 4. Token discipline

- Do not create Canvas artifacts unless explicitly requested.
- Do not generate large planning docs unless explicitly requested.
- Keep summaries concise.
- Avoid broad exploratory rewrites.

## 5. Supabase safety

- Never expose service-role keys to frontend code.
- Do not casually edit applied migrations.
- Prefer additive migrations for production schema changes.
- Explain production impact before SQL, RLS, or auth changes.
- Edge Functions must verify JWT and admin role server-side before service-role operations.

## 6. Admin model

- Single trusted admin role only.
- No moderator role.
- No separate moderation dashboard unless explicitly requested.
- Admin item moderation belongs in normal item flows.

## 7. Verification

- For frontend changes, run `npm run typecheck` and `npm run build` when practical.
- For migrations and security changes, explain rollout and rollback.
- Summaries must include: files changed, behavior changed, commands needed, and risks.

## 8. Stop rule

- After completing the requested task, stop.
- Do not start the next task.
- Do not opportunistically fix unrelated issues.
