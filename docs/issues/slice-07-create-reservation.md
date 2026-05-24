## Parent

#1

## What to build

**Owner selects one interested member** from the queue and creates a **reservation**. Item becomes `reserved`. Default expiry: **7 days** from reservation time (custom presets come in next slice).

This is the critical handoff gate — criteria must be exact.

## Acceptance criteria

- [ ] **Only item owner** sees a reserve action on queue rows (not on arbitrary users)
- [ ] Reserve action available **only** when item status is `available`
- [ ] Reserve target **must** be a member currently in the interest queue for that item
- [ ] Successful reserve creates **exactly one** active reservation (`item_id` + `claimer_id` + `expires_at`)
- [ ] Item status atomically transitions `available` → `reserved` in same operation (no orphaned states)
- [ ] Default `expires_at` = now + 7 days when owner does not customize
- [ ] After reserve: interest queue data preserved (rows not deleted)
- [ ] **Selected claimer** sees reserved state indicating they were chosen
- [ ] **Other interested members** see item is reserved (not chosen); cannot reserve
- [ ] **Non-owner members** cannot create reservations (UI absent + server/RLS enforced)
- [ ] Attempt to reserve when already `reserved`, `claimed`, or `archived` fails with clear error
- [ ] Concurrent double-reserve attempts: only one succeeds; other fails gracefully
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

- #8
