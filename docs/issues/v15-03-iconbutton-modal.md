## Parent

#16

## What to build

**Accessible interactive primitives.**

- New `IconButton` component: min 44×44px, required `aria-label`, visible focus ring
- Upgrade `Modal`: focus trap, Escape to close, `role="dialog"` + `aria-modal`, return focus on close
- Migrate existing modals (Feedback, archive/delete confirms) to upgraded Modal + IconButton close

## Acceptance criteria

- [ ] `IconButton` enforces size and accessible labeling
- [ ] Modal traps focus; Escape closes; focus returns to trigger
- [ ] Feedback modal and Item confirm modals use upgraded patterns
- [ ] Close control meets 44×44px touch target
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

None — can start immediately
