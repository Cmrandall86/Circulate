## Parent

#1

## What to build

**Human decision required** before implementing profile-based location.

Choose the V1 **public area input approach**:

1. **Structured fields** — separate city + neighborhood (dropdown or validated text)
2. **Places autocomplete** — single normalized label (e.g. Google Places API); adds external dependency
3. **Normalized free text** — single field with server-side trim/case normalization only

Document the decision in a brief ADR under `docs/adr/` or as a comment on this issue. Criteria:

- Optional everywhere (member can leave blank)
- One public area per profile (+ per-item override comes in a later slice)
- Prevents "Capitol Hill" vs "capitol hill" duplication as much as practical for V1
- No exact address / pickup details on profile

**This slice is decision-only — no implementation.**

## Acceptance criteria

- [ ] Approach chosen and rationale recorded (trade-offs vs alternatives)
- [ ] Decision unblocks profile-based location slice
- [ ] Confirms public area remains optional

## Blocked by

None — can start immediately
