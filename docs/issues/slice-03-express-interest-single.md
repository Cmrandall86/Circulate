## Parent

#1

## What to build

First **end-to-end interest path** with a single level (`like` / "I'd like this") to prove the vertical slice before adding level variants.

Logged-in **members** can express, update, or withdraw interest on **available** items they can see. One interest row per member per item. **Visitors** see a sign-up / sign-in prompt instead of interest controls.

Includes: schema constraint (unique `item_id + user_id`), API hooks, item detail UI, RLS from slice 2.

## Acceptance criteria

- [ ] Member can tap express interest on an available item they can view
- [ ] Member sees their current interest state on revisit; can withdraw
- [ ] Second express from same member updates existing row (no duplicate)
- [ ] Visitor (logged out) cannot express interest — sees auth prompt
- [ ] Interest blocked when item is not `available`
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

- #2
- #3
