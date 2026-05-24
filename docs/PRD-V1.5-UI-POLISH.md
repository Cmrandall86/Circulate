# PRD: Circulate V1.5 — UI/UX & Styling Polish

## Problem Statement

Circulate V1 shipped the full item handoff loop, but the UI was built quickly on a dark-only palette with ad hoc typography and minimal accessibility hardening. Members see inconsistent font sizes, undersized interactive controls (modal close buttons, gallery arrows), a feed grid that stretches cards on partial rows, and no light mode for users who prefer it or need higher ambient-light contrast. The app should feel cohesive, accessible (WCAG 2.2 AA on core flows), and professionally polished without changing product behavior.

## Solution

A focused **V1.5 styling pass**: dual-theme support (light / dark / system) via design tokens, a 4-tier typography scale, fixed-width feed cards, shared accessible interactive primitives (`IconButton`, upgraded `Modal`), and a final accessibility sweep on core member flows. Delivered as vertical slices on GitHub with review between each — no backend or handoff logic changes.

## User Stories

### Theme

1. As a **member**, I want to choose light, dark, or system theme, so that the app matches my environment and preference.
2. As a **member**, I want my theme choice remembered, so that I don't re-select it every visit.
3. As a **member**, I want light mode with clear card separation, so that content is readable in bright environments.
4. As a **visitor**, I want the default theme to follow my OS setting, so that the first impression feels native.

### Layout & typography

5. As a **member**, I want feed cards to stay a consistent width, so that partial rows don't look broken or stretched.
6. As a **member**, I want consistent text hierarchy across pages, so that titles, body, and labels are easy to scan.
7. As a **visitor/member**, I want readable contrast in both themes, so that text and accents meet accessibility standards.

### Interactive controls

8. As a **member**, I want modal close buttons large enough to tap easily, so that dialogs are usable on mobile.
9. As a **member** using a keyboard, I want modals to trap focus and close on Escape, so that I can use the app without a mouse.
10. As a **member**, I want gallery prev/next controls large and keyboard-accessible, so that I can browse item photos comfortably.
11. As a **member** using a screen reader, I want icon-only buttons to have clear labels, so that controls are understandable.

### Accessibility (core flows)

12. As a **member**, I want visible focus indicators on interactive elements, so that keyboard navigation is clear.
13. As a **member**, I want form inputs and buttons on auth, feed, item detail, and settings to meet WCAG 2.2 AA, so that the app is usable by people with disabilities.

## Implementation Decisions

### Theme architecture

- **Modes:** `light`, `dark`, `system` — persisted in `localStorage`.
- **Default:** `system` on first visit; listen to `prefers-color-scheme` when mode is `system`.
- **Anti-FOUC:** inline script in `index.html` applies theme class/data-attribute before first paint.
- **Tokens:** CSS custom properties in `tokens.css` for both themes; Tailwind colors reference semantic tokens where practical.
- **Light palette:** soft gray page background, white card panels, same mint accent; verify AA contrast for text and accent on both themes.

### Theme UI

- **Location:** navbar only (desktop + mobile hamburger panel).
- **Control:** popover with three labeled options (Light / Dark / System) — not a mystery cycle button.
- **Implementation:** `useTheme` hook; theme toggle uses `IconButton` (slice 3).

### Typography

- **4-tier semantic scale:** `text-title`, `text-heading`, `text-body`, `text-caption`.
- **Scope:** core member screens — feed, item detail, auth, settings, navbar, modals.
- Map tiers in Tailwind config or CSS layer; migrate ad hoc `text-sm` / `text-xl` usage on those screens.

### Feed grid

- **Fixed card width** (~260px), left-aligned grid.
- Use `repeat(auto-fill, 260px)` or equivalent — cards do not grow to fill partial rows.

### Interactive primitives

- **`IconButton`:** minimum 44×44px touch target, required `aria-label`, visible focus ring.
- **`Modal` upgrade:** focus trap, Escape to close, `role="dialog"` + `aria-modal`, return focus to trigger on close, backdrop click optional (keep current behavior unless a11y requires otherwise).
- Migrate modal close, gallery arrows, theme trigger, mobile menu trigger where applicable.

### Item gallery

- Replace text arrows with `IconButton` + chevron icons (or SVG).
- Keyboard: Left/Right arrow keys when gallery focused.
- Thumbnail strip retains selection state with visible focus.

### Accessibility target

- **WCAG 2.2 Level AA** on core member flows: feed, item detail, auth (sign-in/sign-up), settings, modals, forms, navbar.
- **Out of scope for this pass:** admin users table, groups page deep polish.

### Slice order

1. Theme foundation (tokens, hook, anti-FOUC)
2. Navbar theme popover
3. IconButton + Modal (can parallel slice 1–2)
4. Typography scale on core screens
5. Feed grid fixed-width layout
6. Item gallery a11y upgrade
7. Core-flow a11y pass (contrast audit, focus rings, remaining labels)

## Testing Decisions

- **Principle:** verify visual and behavioral outcomes manually; no new test runner required for V1.5.
- **Theme:** toggle all three modes; reload page; confirm persistence; confirm system tracks OS change.
- **A11y:** keyboard-only walkthrough of feed → item → modal; axe DevTools or Lighthouse accessibility on core routes in both themes.
- **Contrast:** spot-check mint accent and body text against WCAG AA (4.5:1 normal text, 3:1 large text/UI components).

## Out of Scope

- Admin UI redesign
- Groups page accordion/layout overhaul
- New font family or custom webfonts
- Animation / motion design pass
- Backend, RLS, or handoff logic changes
- Per-route document titles (deferred to later branding increment)

## Further Notes

- V1 (#1–#15) is complete and closed. V1.5 is styling/a11y only.
- Parent tracker issue on GitHub references slice issues #17–#23.
- Terminology: see `CONTEXT.md`. No new domain concepts.
