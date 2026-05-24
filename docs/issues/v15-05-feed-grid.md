## Parent

#16

## What to build

**Feed grid fixed-width layout.**

- Item cards stay ~260px wide; grid left-aligned
- Partial rows do not stretch last card(s) to fill row
- Works in both themes; respects typography scale from slice 4

## Acceptance criteria

- [ ] Feed uses fixed-width columns (e.g. `repeat(auto-fill, 260px)` with `justify-start`)
- [ ] 5 items on a 6-column row: fifth card same width as others; empty space on right
- [ ] Mobile/tablet breakpoints still usable
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

- #17
- #20