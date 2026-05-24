## Parent

#1

## What to build

When creating a reservation, owner chooses **expiry**:

| Preset | Duration |
|---|---|
| 2 days | Quick pickup |
| 7 days | Default |
| 14 days | Flexible |
| No expiry | Trusted handoff |
| Custom | Date picker, max 30 days out |

Default remains 7 days if owner accepts preset without changing.

## Acceptance criteria

- [ ] Owner sees preset options at reserve time; 7-day pre-selected
- [ ] Custom date cannot exceed 30 days from now
- [ ] `expires_at` stored correctly on reservation row
- [ ] "No expiry" stores null `expires_at`
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

- #10
