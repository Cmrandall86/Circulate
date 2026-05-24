# PRD: Circulate V1 — Item Handoff Loop

## Problem Statement

Members of trusted circles have useful items they want to give away, but coordinating who gets what is informal and fragile. There is no structured way to signal need versus casual interest, no fair ordering when multiple people want the same item, and no lifecycle from "available" through pickup. Location entry is repetitive, inconsistent, and exposes too much to people who should not see it. The platform needs a complete V1 handoff loop so real groups can post, express leveled interest, reserve, and complete a pickup without the admin intervening.

## Solution

Ship the core **handoff loop** for logged-in members: leveled interest, owner-controlled reservation with configurable expiry, item lifecycle states, in-app owner indicators, profile-based optional location, and a minimal settings page. Keep the public feed browse-only for visitors. Groups remain owner-add-only. Platform admin retains content and user moderation powers. V1 success is one clean handoff with real users in a real group.

## User Stories

### Vision & access

1. As a **visitor**, I want to browse the public feed without logging in, so that I can see what is available and decide whether to join.
2. As a **visitor**, I want to see item title, photos, description, and category only, so that I am not exposed to pickup locations before I am a member.
3. As a **visitor**, I want clear prompts to sign up when I try to express interest, so that I understand actions require membership.
4. As a **member**, I want to sign up with open registration, so that I can join when invited by word of mouth.
5. As an **admin**, I want to remove problematic members and items, so that I can keep the platform safe at small scale without a moderation dashboard.

### Groups & visibility

6. As a **group owner**, I want to create a group and add members by search, so that my trusted circle can see group-scoped items.
7. As a **group owner**, I want to add existing members to my group manually, so that V1 growth works without email invitations.
8. As a **member**, I want to choose public or group visibility each time I post, so that I control who sees each item with no system default.
9. As a **member**, I want to select one or more groups when posting a group item, so that I can target specific circles.
10. As a **member**, I want to see items from my groups and public items I am allowed to see, so that I can browse what is available to me.

### Profile & location

11. As a **member**, I want a settings page to set my display name, so that others recognize me in interest queues.
12. As a **member**, I want to upload an avatar on my settings page, so that owners can identify me when choosing who receives an item.
13. As a **member**, I want to set an optional public area on my profile (normalized neighborhood + city), so that I do not retype location on every post.
14. As a **member**, I want my items to inherit my profile public area by default, so that posting is faster and locations stay consistent.
15. As a **member**, I want an optional per-item location override when posting, so that I can handle rare cases like posting from a different area.
16. As a **member**, I want to post items without setting any location, so that location remains optional everywhere.
17. As a **member** viewing an item while logged in, I want to see the poster's public area when set, so that I have general proximity context without exact addresses.
18. As an **item owner**, I want pickup details kept off listings, so that my exact address is not public.

### Interest & queue

19. As a **member**, I want to express interest in an item at one of three levels (I need this / I'd like this / I can take it), so that owners can prioritize genuine need.
20. As a **member**, I want to express only one interest per item, so that the queue stays fair and simple.
21. As a **member**, I want to change my interest level before the owner reserves, so that I can correct mistakes.
22. As a **member**, I want to withdraw my interest before reservation, so that I am not stuck after changing my mind.
23. As an **item owner**, I want to see all interested members sorted by level then time, so that I have a clear tiebreaker when choosing.
24. As an **item owner**, I want to see each interested member's display name, avatar, interest level, timestamp, and mutual groups, so that I can make an informed choice without a full profile page.
25. As an **item owner**, I want the interest queue preserved when a reservation expires or is cancelled, so that I can pick the next person without everyone re-expressing interest.

### Reservation & lifecycle

26. As an **item owner**, I want to select one interested member and create a reservation, so that the item is held for them.
27. As an **item owner**, I want reservations to default to 7 days, so that items do not stay stuck indefinitely.
28. As an **item owner**, I want to choose a preset expiry (2 / 7 / 14 days / no expiry) or a custom date, so that I can match pickup expectations.
29. As an **item owner**, I want to cancel an active reservation anytime, so that I can recover from ghosting or wrong picks.
30. As an **item owner**, I want to mark an item as claimed after pickup, so that the handoff is complete.
31. As an **item owner**, I want to archive or delete my items manually, so that I control how long listings stay up.
32. As a **member**, I want to see whether an item is available, reserved, or claimed, so that I know the current state.
33. As a **member** whose reservation expired, I want the item to return to available with the queue intact, so that the owner can pick again fairly.
34. As an **interested member** not selected, I want to see when an item is reserved for someone else, so that I know to wait or move on.

### Owner awareness

35. As an **item owner**, I want an in-app indicator when my items have new interest, so that I notice without email or push notifications in V1.
36. As an **item owner**, I want to see interest counts on my items, so that I know which listings need attention.

### Admin

37. As an **admin**, I want to delete or edit any item, so that I can remove spam or fix bad listings.
38. As an **admin**, I want to view and remove users, so that I can enforce trust as the sole moderator.

## Implementation Decisions

### Item lifecycle state machine

Items move through explicit statuses:

```
available → reserved → claimed
     ↑         |
     └─ (cancel / expiry)
available → archived (owner action at any time)
```

- `available`: accepting interest
- `reserved`: owner selected a member; reservation active
- `claimed`: pickup confirmed complete
- `archived`: owner removed from active circulation

### Interest module (deep module)

Encapsulate all interest behavior behind a small interface:

- `expressInterest(itemId, level)` — create or update; one row per user per item
- `withdrawInterest(itemId)` — remove from queue
- `getInterestQueue(itemId)` — returns sorted list: level priority (need > like > take), then `created_at` ASC within tier
- Enrich queue entries with display name, avatar, mutual groups count/names

**Schema:** Extend `interests.state` (or rename column) to hold level enum: `need` | `like` | `take`. Add unique constraint on `(item_id, user_id)`.

### Reservation module (deep module)

- `createReservation(itemId, claimerId, expiresAt)` — sets item to `reserved`; only item owner
- `cancelReservation(itemId)` — clears reservation, item back to `available`, queue preserved
- `expireReservations()` — scheduled or on-read check: past `expires_at` → cancel + `available`
- Expiry presets: 2d, 7d (default), 14d, null (no expiry); custom date capped at 30 days

**Schema:** `reservations` already exists; wire `items.status` transitions. Ensure one active reservation per item.

### Profile & location module

- Add `public_area` (and optionally structured `city` / `neighborhood` columns) to `profiles`
- Settings page: display name, avatar upload, public area picker (structured normalization — autocomplete or constrained input)
- Item form: remove default free-text location field; inherit profile `public_area`; optional override toggle
- Visibility rule: strip location from API responses for unauthenticated public feed requests

### Owner interest indicator module

- Track `last_viewed_interests_at` on items (or per-owner read cursor) to compute unread interest count
- Navbar or "My items" badge when any owned item has interest newer than last viewed
- Item detail for owner: full queue + mark viewed on open

### Modules to modify (existing)

- Item create/edit flow — visibility unchanged; location inheritance + override
- Item detail page — interest UI for members, queue + reservation controls for owner, status display
- Feed — hide location for anonymous; status badges optional
- Auth gate — interest actions require session
- Admin users — user removal (verify exists or add)

### RLS

- Enable RLS on `interests` and `reservations` (Phase 4 gap in ACTIVE_CONTEXT)
- Policies: interest insert/select if member can see item; reservation write by item owner; read by owner and selected claimer

### Item form deprecation

- Phase out per-post `approx_location` free text as primary path; migrate to profile inheritance with optional override column or reuse `approx_location` as override-only

## Testing Decisions

**Principle:** Test external behavior and pure domain logic, not React implementation details.

**Modules worth unit tests (no prior art in repo — would be first tests):**

1. **Interest queue ordering** — given mixed levels and timestamps, assert sort order
2. **Reservation expiry** — given `expires_at` in past, assert item returns to `available` and queue unchanged
3. **Item status transitions** — valid/invalid transitions (e.g. cannot reserve when already claimed)

**Integration tests (optional V1):** interest express → owner reserve → claim happy path against local Supabase.

Ask stakeholder: confirm interest queue sorter and reservation expiry as priority test targets.

## Out of Scope

- DMs, comments, in-app messaging
- Email or push notifications (in-app badge only)
- Invite links / email group invitations
- Report / flag system
- Stranger interest or contact without signup
- Public `/profile/$id` pages (inline queue info only)
- Signup approval queue
- Payments, shipping, marketplace mechanics
- Auto-archive of stale listings
- Feed pagination, search, filters (unless needed before handoff demo)
- Full moderation dashboard

## Further Notes

- **V1 success metric:** One complete handoff loop with real users in a real group without admin intervention.
- **Future vision:** Stranger-to-stranger giving and Goodwill-alternative positioning; public feed browse-only today seeds that story.
- **Terminology:** See root `CONTEXT.md` for canonical domain language.
- **Admin model:** Single platform admin; group owners manage their own membership via owner-add-only in V1.
