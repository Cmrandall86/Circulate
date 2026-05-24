# Circulate

A private-first community platform for giving away useful items to trusted circles, with a browse-only public feed that may grow into broader stranger-to-stranger sharing over time.

## Language

### People & access

**Member**:
A signed-up user who can post items, join groups, and express interest in items.
_Avoid_: User (when meaning domain actor), account holder

**Owner** (item):
The member who posted an item and controls who receives it.
_Avoid_: Seller, lister, poster (when the domain action is giving)

**Admin**:
The single platform operator who moderates content and can remove members. Not a separate product tier for group management.
_Avoid_: Moderator (platform-wide)

**Visitor**:
Someone browsing the public feed without being logged in. Can view only; cannot express interest or see location.
_Avoid_: Anonymous user, guest (when meaning non-member browser)

### Communities

**Group** (Circle):
A private community whose members can see group-scoped items. Membership is controlled by the group owner in V1.
_Avoid_: Circle (in code/docs — use Group consistently), community (generic)

**Group owner**:
The member who created a group and adds members manually in V1.
_Avoid_: Admin (within a group — reserve Admin for platform operator)

### Items & visibility

**Item**:
Something a member is giving away. Has a lifecycle from available through claimed or archived.
_Avoid_: Listing, product, offer

**Public item**:
An item with public visibility, shown on the browse-only feed to visitors and members.
_Avoid_: Open listing

**Group item**:
An item visible only to members of one or more selected groups.
_Avoid_: Private item (ambiguous — group-scoped is precise)

**Visibility**:
The member's explicit choice at post time: public or specific groups. There is no system default.
_Avoid_: Privacy setting, audience (generic)

### Handoff & interest

**Interest**:
A member's signal that they want an item, at one of three levels. One interest per member per item.
_Avoid_: Claim (premature — claim follows owner selection), request, bid

**Interest level**:
How strongly a member wants an item: **I need this** (highest), **I'd like this**, or **I can take it** (lowest — willing to help the owner dispose of it).
_Avoid_: Priority tag, want level

**Interest queue**:
All interests on an item, sorted by level then timestamp within each level. A tiebreaker hint for the item owner, not auto-assignment.
_Avoid_: Waitlist (implies automatic ordering)

**Reservation**:
The owner's selection of one member to receive an item. Puts the item in reserved status until pickup is confirmed, cancelled, or the reservation expires.
_Avoid_: Claim (use Claimed for final state), hold, booking

**Handoff**:
The full flow from interest through reservation to claimed. V1 success is one complete handoff with real members.
_Avoid_: Transaction, transfer, sale

**Claimed**:
The item has been picked up and the handoff is complete.
_Avoid_: Sold, delivered, closed

### Location

**Public area**:
A member's optional, normalized general location (e.g. neighborhood + city) stored on their profile. Inherited by items unless overridden.
_Avoid_: Address, location pin, approx_location (legacy field name)

**Pickup details**:
Exact coordination info (street address, instructions). Never shown on a listing; shared outside the app in V1.
_Avoid_: Delivery address, meetup spot (on listing)

## Flagged ambiguities

**Claim vs reservation**: "Claim" is the final state after pickup (`claimed`). "Reservation" is the interim owner selection. Do not use "claim" for expressing interest or for the owner's pick action.

**Public feed vs public item**: The public feed is the visitor-facing browse experience. A public item is an item with public visibility. Visitors see public items; logged-in members may see more.

## Example dialogue

> **Member**: I posted a group item to Family Group. Two people expressed interest — one said "I need this," one said "I can take it."
>
> **Group owner**: You're the item owner, so you see the interest queue sorted by level. You pick the person who needs it, set a 7-day reservation, and the item shows as reserved.
>
> **Member**: What if they don't pick it up?
>
> **Group owner**: After 7 days the reservation expires, the item goes back to available, and you can pick the next person from the queue. Or you cancel the reservation yourself anytime.
>
> **Visitor**: I saw something on the public feed but I can't tell where it is.
>
> **Admin**: Right — visitors browse only. Location appears after you sign up as a member. No interest button until then either.
