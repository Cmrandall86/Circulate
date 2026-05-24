## Parent

#1

## What to build

Enrich each **interest queue** row with **mutual groups** — groups both the item owner and the interested member belong to.

Helps owner recognize trusted context ("also in Family Group") without building public profile pages.

## Acceptance criteria

- [ ] Each queue row lists mutual group names (or count + expand) when any exist
- [ ] Rows with no mutual groups show nothing or "No shared groups"
- [ ] Query performant for typical group sizes (no N+1 fetches in UI loop)
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

- #8
