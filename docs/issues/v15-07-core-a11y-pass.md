## Parent

#16

## What to build

**Core-flow WCAG 2.2 AA pass** — final sweep after prior slices.

Routes: feed, item detail, sign-in/sign-up, settings, navbar, modals, item form (create/edit).

- Visible focus rings on interactive elements not yet covered
- Form labels / `aria-describedby` where missing
- Contrast fixes in both themes (badges, muted text, disabled states)
- Skip link to main content if not present
- Interest actions and owner panels: keyboard reachable, labels sane

## Acceptance criteria

- [ ] Keyboard-only walkthrough of feed → item → express interest path works
- [ ] Lighthouse or axe accessibility scan on core routes: no critical issues in either theme
- [ ] Focus indicators visible on all primary interactive elements
- [ ] No regressions from V1 behavior
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

- #17
- #18
- #19
- #20
- #21
- #22
