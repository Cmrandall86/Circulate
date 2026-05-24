# Public area input — normalized free text (V1)

V1 stores each member's optional **public area** as a single free-text field on `profiles.public_area`, with server-side trim and case normalization on save. We rejected structured city/neighborhood fields (extra form UX and schema for limited V1 benefit) and Places autocomplete (external dependency, cost, and privacy overhead for a coarse optional hint). Dedup is best-effort only ("Cap Hill" vs "Capitol Hill" may coexist); items inherit profile public area in slice #14 with an optional per-item override. Exact addresses and pickup details never belong on profile or listings.

**Status:** accepted

**Considered options:** (1) structured city + neighborhood fields, (2) Places autocomplete, (3) normalized free text — chosen.

**Consequences:** Settings keeps one optional text input; #14 implements inheritance/override and member-only visibility without new integrations. Structured fields or Places can be revisited if location dedup becomes a real product problem.
