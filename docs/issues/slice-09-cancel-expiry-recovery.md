## Parent

#1

## What to build

**Cancel and expiry recovery** for reservations.

- Owner can cancel active reservation anytime → item returns `available`, reservation cleared/inactive
- Expired reservations (past `expires_at`) recover automatically on read or via lightweight check → item `available`, queue intact
- No re-expression required from interested members

## Acceptance criteria

- [ ] Owner sees "Cancel reservation" on reserved items they own
- [ ] Cancel transitions item `reserved` → `available`; queue rows unchanged
- [ ] Expired reservation no longer blocks item; item shows `available`
- [ ] Expiry check runs reliably (document trigger: on item fetch or scheduled — pick one, implement consistently)
- [ ] Owner can pick next person from preserved queue after cancel/expiry
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

- #10
