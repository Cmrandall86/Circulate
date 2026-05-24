## Parent

#1

## What to build

Add a minimal **member settings page** (`/settings`) for self-edit profile fields: **display name**, **avatar upload**, and optional **public area** placeholder field.

Public area input UX is finalized in the HITL slice (public area input approach). This slice may ship a stub public area field or basic text input that slice #12 refines once the HITL decision lands.

Use domain terms from `CONTEXT.md`: **Member**, **Public area**.

## Acceptance criteria

- [ ] Authenticated members reach `/settings`; unauthenticated users redirected to sign-in
- [ ] Member can update display name; persists to `profiles`
- [ ] Member can upload/change avatar via existing storage patterns
- [ ] Public area field exists on settings (implementation may be refined by location slices)
- [ ] Route registered in router; linked from navbar or account menu
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

None — can start immediately
