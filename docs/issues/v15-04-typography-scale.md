## Parent

#16

## What to build

**4-tier typography scale** on core member screens.

- Define semantic tiers: `text-title`, `text-heading`, `text-body`, `text-caption` (Tailwind or CSS)
- Migrate ad hoc font sizes on: feed, item detail, auth, settings, navbar, modals
- Line heights readable in both light and dark themes

## Acceptance criteria

- [ ] Four semantic text utilities documented and used on core screens listed above
- [ ] No conflicting arbitrary size jumps on those screens (e.g. mixed `text-sm`/`text-lg` for same role)
- [ ] Hierarchy visually clear on feed and item detail
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

- #17
