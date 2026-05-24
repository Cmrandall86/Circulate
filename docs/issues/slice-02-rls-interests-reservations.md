## Parent

#1

## What to build

Enable **RLS on `interests` and `reservations`** with policies aligned to item visibility and ownership. Tables exist but lack RLS (Phase 4 gap). This slice is schema/policy only — no UI.

Policies should allow:
- **Interests:** insert/select when member can see the item; update/delete by interest author or item owner
- **Reservations:** read by item owner and selected claimer; write by item owner only

Reference: `docs/rls-policies-reference.sql` and migration 14 patterns.

## Acceptance criteria

- [ ] New additive migration enables RLS on `interests` and `reservations`
- [ ] Policies match PRD intent: visibility-aware interest access; owner-controlled reservations
- [ ] Existing core table RLS unaffected
- [ ] Migration is idempotent-safe and documented in commit message / PR description

## Blocked by

None — can start immediately
