# Monetization & Events — Design Doc

Status: **Phase 1 (schema) implemented.** Phases 2–3 planned below.

## The model

A **$5/month subscription** whose perk is the ability to run tournament events. The existing app stays **free for players** — nothing currently working gets paywalled. The paid tier sells labor-saving tooling to the people who'll value it (tournament organizers).

### Three independent permission layers
| Action | Who |
|---|---|
| View events & standings | Everyone (public) |
| Create / score an event | `is_subscriber` **AND** `is_organizer` |
| Submit results into an event | An **approved participant** of that event |
| Submit to the global war | Any signed-in player (unchanged, free) |

The two flags are deliberately **separate**:
- `is_subscriber` — flipped by Stripe (they're paying). Source of truth = Stripe.
- `is_organizer` — admin-approved. Source of truth = your admin action.

Both must be true to run events. Keeping them separate means: someone can pay before approval (waiting in the queue); an admin can grant organizer status to a trusted partner without forcing billing; and if a card lapses, you flip `is_subscriber` off **without** losing the approval record.

### Lapse behavior (important)
When a subscription lapses, **data is never destroyed**. Existing events keep working and stay publicly visible. Only the *actions* are gated — a lapsed organizer can't create new events or score until they resubscribe (`can_run_events()` returns false). Hiding or deleting a tournament's results because a card expired would be a trust disaster; we grandfather the data and gate the verbs.

## Data model (Phase 1 — done)

- `profiles.is_subscriber`, `profiles.is_organizer`, `profiles.organizer_requested_at`
- `events` — belongs to a season, owned by an organizer, has `rolls_up` (count toward global war?) and `status` (draft/open/active/finalized)
- `event_participants` — the join-and-approve roster (requested/approved/rejected)
- `battles.event_id` (nullable) — a battle is standalone (null) or tied to an event
- **Roll-up:** `v_global_battles` includes standalone battles + event battles whose event has `rolls_up = true`. The war balance, player standings, and faction views all read from it, so event results flow into the global war automatically when the TO opts in.
- `v_event_standings` — per-event leaderboard (always counts the event's own battles regardless of roll-up)
- SQL helpers: `can_run_events(uid)`, `is_event_participant(uid, event)`, `request_organizer()`
- RLS enforces every layer above at the database level.

### The participant flow
1. TO creates an event (status draft → open).
2. Players **request to join** (`event_participants` row, status `requested`).
3. TO **approves** participants (status `approved`).
4. Approved participants **self-report** battles into the event (same submission UX as the global war; `battles.event_id` set). RLS blocks non-approved users from submitting to the event.
5. Event battles roll up to the global war if `rolls_up` is true.
6. TO **finalizes** the event when done.

## Phase 2 — Stripe (when ready to charge)

Keep the surface area tiny: the app reads exactly one fact from Stripe — "is this subscription active?" Everything else (cards, proration, refunds, dunning, failed-payment retries, tax) is Stripe's job.

**Pieces to build:**
1. **Stripe product**: a $5/mo recurring price. Create in the Stripe dashboard.
2. **Checkout**: a "Become an Organizer — $5/mo" button → Stripe Checkout session (server action creates the session, redirects to Stripe-hosted page). Store the user's `stripe_customer_id` on their profile.
3. **Webhook** (`/api/stripe/webhook`): on `customer.subscription.created/updated/deleted` and `invoice.payment_succeeded/failed`, set `profiles.is_subscriber = (subscription active)`. This is the *only* thing that flips the flag — never trust the client. Verify the Stripe signature.
4. **Customer portal**: a "Manage subscription" link → Stripe Billing portal (cancel, update card) — zero billing UI to build yourself.

**Env vars to add:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PRICE_ID`.

**Schema to add in Phase 2:** `profiles.stripe_customer_id text`, optionally `profiles.subscription_status text` and `current_period_end timestamptz` for showing renewal date.

## Phase 3 — TO experience (the actual product)

- **Organizer request + admin approval queue.** Player hits "Request organizer status" (`request_organizer()` sets the timestamp). Admin page lists `organizer_requested_at is not null and not is_organizer`, approve = set `is_organizer = true`.
- **Event creation form** (subscriber+organizer only): name, description, rolls-up toggle, dates.
- **Participant management**: TO sees join requests, approves/rejects.
- **Event submission**: the existing submit form gains an optional "event" picker showing events the player is an approved participant of.
- **Public event page** (`/event/[id]`): standings via `v_event_standings`, roster, roll-up status.
- **Finalize**: lock the event, freeze standings.

## Business / legal notes (not legal advice)

Taking recurring money moves this from hobby to "has paying customers." The standard, low-effort path for a $5/mo tool:
- **Stripe Billing** handles recurring charges, proration, retries.
- **Stripe Tax** automates sales-tax calculation/collection where required.
- Add a basic **Terms of Service** and **refund policy** page (a simple "cancel anytime, no refunds for partial months" is common and clear).
- Stripe handles **chargebacks**; you just respond to disputes in their dashboard.

Consult an accountant/lawyer for your specific situation before launch — this doc is engineering guidance, not legal/financial advice.

## Why Phase 1 first

Doing the schema now means the global war *already knows how to absorb event results*, and the permission gates exist at the database level before any money changes hands. When you wire Stripe in Phase 2, flipping `is_subscriber` is the only new moving part — the events system it unlocks is already built and tested.
