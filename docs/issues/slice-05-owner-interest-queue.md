## Parent

#1

## What to build

**Item owner** sees an **interest queue** on item detail for their available items.

Queue sorted by level priority (`need` → `like` → `take`), then `created_at` ascending within each tier. Each row shows: display name, avatar, interest level, timestamp.

Owner-only view — interested members do not see the full queue (they see only their own interest).

## Acceptance criteria

- [ ] Only item owner sees the queue section
- [ ] Queue ordering matches: level priority then FIFO within tier
- [ ] Empty queue shows clear empty state
- [ ] Queue hidden when item is not `available` (reserved/claimed/archived show status instead)
- [ ] Queue reads work under RLS for owner
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

- #7
