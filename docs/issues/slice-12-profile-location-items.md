## Parent

#1

## What to build

**Profile-based location** replacing per-post free-text as the primary path.

- Items inherit member's **public area** from profile
- Optional per-item override toggle on create/edit
- **Visitors** (logged out): no location on feed or item detail
- **Logged-in members**: see public area when set
- Pickup details never on listings

Implement public area input per HITL decision (slice 11b).

## Acceptance criteria

- [ ] Profile `public_area` persisted per HITL approach
- [ ] New items inherit profile public area; override optional
- [ ] Per-post free-text location no longer required/default path
- [ ] Anonymous requests omit location fields from responses/UI
- [ ] Logged-in viewers see inherited or override public area
- [ ] Items without any location show no location line
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

- #4
- #5
