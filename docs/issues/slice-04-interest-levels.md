## Parent

#1

## What to build

Extend interest to **three levels** per `CONTEXT.md`:

| Level | Label |
|---|---|
| `need` | I need this |
| `like` | I'd like this |
| `take` | I can take it |

Member picks level at express time; can change level or withdraw before owner creates a reservation. Still one interest per member per item.

## Acceptance criteria

- [ ] UI offers three distinct level choices with PRD labels
- [ ] Level stored in DB (extend `interests.state` or equivalent enum)
- [ ] Member can switch level without creating duplicate rows
- [ ] Withdraw removes interest entirely
- [ ] Level change blocked once item is `reserved` or beyond
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

- #6
