## Parent

#1

## What to build

Owner completes the handoff lifecycle:

- **Mark claimed** — pickup confirmed; item status → `claimed`
- **Archive** — owner removes from active circulation; status → `archived`

Owner-controlled only; no auto-archive.

## Acceptance criteria

- [ ] Owner can mark `reserved` item as `claimed`
- [ ] Owner can archive item from appropriate states (document which states allowed)
- [ ] Claimed/archived items no longer accept new interest
- [ ] Status visible on item detail
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

- #10
