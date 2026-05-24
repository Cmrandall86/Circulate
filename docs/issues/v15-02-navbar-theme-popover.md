## Parent

#16

## What to build

**Navbar theme popover** — member-facing theme control.

- Popover in navbar (desktop + mobile menu) with three labeled options: Light / Dark / System
- Uses `useTheme` from slice 1
- Keyboard accessible (open, select, close); appropriate `aria` attributes
- Uses `IconButton` if slice 3 is done; otherwise implement with slice 3 in mind

## Acceptance criteria

- [ ] Theme popover visible in navbar on desktop and mobile
- [ ] All three modes selectable; current mode indicated
- [ ] Choice persists via slice 1 hook
- [ ] Popover dismisses on selection and outside click / Escape
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

- #17
