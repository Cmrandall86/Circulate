## Parent

#1

## What to build

**In-app owner awareness** when items receive new interest — no email/push in V1.

Track whether owner has viewed interests since last expression. Show indicator when unread interest exists (navbar badge and/or "My items" count). Mark viewed when owner opens item detail queue.

## Acceptance criteria

- [ ] Owner sees indicator when owned item has interest newer than last viewed
- [ ] Indicator clears when owner views that item's detail/queue
- [ ] Interest count visible on owner's items list or item cards
- [ ] No notification sent outside app
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

- #8
