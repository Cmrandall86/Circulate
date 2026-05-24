## Parent

#16

## What to build

**Item detail gallery accessibility upgrade.**

- Replace small text arrow buttons with `IconButton` + chevron icons
- Keyboard: Left/Right arrows navigate images when gallery focused
- Improved `aria-label`s on prev/next and thumbnails
- Counter and thumbnails remain; focus visible on thumb selection

## Acceptance criteria

- [ ] Prev/next controls ≥44×44px with descriptive labels
- [ ] Arrow keys change selected image when gallery region focused
- [ ] Thumbnail buttons keyboard accessible with visible focus
- [ ] Works in light and dark themes
- [ ] `npm run typecheck` and `npm run build` pass

## Blocked by

- #19
