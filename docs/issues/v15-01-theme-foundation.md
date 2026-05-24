## Parent

#16

## What to build

**Theme foundation** — dual-theme token layer and runtime plumbing.

- CSS custom properties for light + dark in `tokens.css` (soft gray light chrome, white cards, mint accent)
- Tailwind wired to semantic tokens where practical
- `useTheme` hook: `light` | `dark` | `system`, persisted in `localStorage`, listens to `prefers-color-scheme` when system
- Inline anti-FOUC script in `index.html` applies theme before first paint
- Default mode: `system`

No navbar toggle yet (slice 2). Existing screens should render correctly in both themes after token migration of base surfaces.

## Acceptance criteria

- [ ] Light and dark token sets defined; components using `base`/`ink`/`card` read themed values
- [ ] `useTheme` hook exported; persistence works across reload
- [ ] System mode tracks OS preference changes
- [ ] No flash of wrong theme on cold load
- [ ] Mint accent + body text meet WCAG AA contrast in both themes (spot-check)
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

None — can start immediately
