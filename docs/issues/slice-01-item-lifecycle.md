## Parent

#1

## What to build

Introduce explicit **item lifecycle statuses** across the stack. Items today use `active` and never transition. Normalize to the V1 state machine foundation: `available`, `reserved`, `claimed`, `archived`.

Migrate existing rows (`active` → `available`). Display the current status on item detail (badge or label). No interest or reservation behavior in this slice — only status values and display.

```
available → reserved → claimed
     ↑         |
     └─ (cancel / expiry — later slices)
available → archived (owner action — later slice)
```

## Acceptance criteria

- [ ] Migration maps existing `active` items to `available`; new constraint or check allows only `available | reserved | claimed | archived`
- [ ] Item detail shows human-readable status for all users who can view the item
- [ ] Feed/item queries continue to work; archived items behavior unchanged from today unless already filtered
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

None — can start immediately
