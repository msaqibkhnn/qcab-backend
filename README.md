# QCab Backend (NestJS)

Implements `qcab_api.yaml` against `qcab_schema.sql`. This has been:
- Type-checked end-to-end (`npx tsc --noEmit`) and built (`npx nest build`).
- Unit-tested: `bookings.service.spec.ts` covers the state machine against
  mocked repositories (`npm test`).
- **Run end-to-end against real infrastructure**: real PostgreSQL 16 +
  PostGIS, the real compiled server, and Stripe's own open-source
  `stripe-mock` server standing in for Stripe's live API (this sandbox
  couldn't reach `api.stripe.com` directly, but stripe-mock speaks the
  identical request/response shape, so the integration code itself —
  Connect onboarding, split PaymentIntents, signed webhooks — was
  exercised for real, not mocked at the application layer).

That real run covered: registration → OTP → JWT issuance → vehicle
registration → KYC document upload → admin document approval (including
the auto-approval-once-all-docs-approved rule) → admin zone/commission
config → role-based 403 enforcement → route posting → geospatial search
→ booking → counter-offer → accept → illegal-transition rejection →
full trip lifecycle → Stripe Connect onboarding → a PaymentIntent with
the commission split → a **cryptographically real webhook signature**
(Stripe's documented HMAC-SHA256 scheme) delivered to trigger payment
capture → webhook replay correctly recognized as a duplicate → rating
submission with the driver's average recalculated → cancellation →
GDPR request logging → **the document-expiry-blocks-going-online rule**
(blocked pre-approval, blocked with an expired MOT naming the specific
vehicle, succeeds once fixed) → notifications list/mark-read → ticket
creation, threaded replies, and category-based SLA differentiation
(confirmed a `safety` ticket gets a 1-hour deadline vs 48 hours for
`technical`) → dispute creation. Three real bugs were found and fixed
by this process (see below) — this is not illustrative code.

### Bugs found and fixed by the end-to-end run
1. **Every registration was silently rejected.** `RegisterDto` and
   `VerifyOtpDto` used camelCase (`phoneNumber`) while the OpenAPI
   contract and every client (Flutter's `ApiClient` included) send
   snake_case (`phone_number`). `class-validator` saw `undefined` and
   failed validation. Fixed by renaming the DTO fields to match the wire
   format — **if you're integrating a client against an older copy of
   this backend, check it sends `phone_number`/`full_name`, not
   camelCase.**
2. **`GET /routes/search` — the core matching query — threw a 500.**
   The `ORDER BY` clause referenced a compound expression combining two
   `SELECT`-list aliases (`origin_distance_m + destination_distance_m`).
   PostgreSQL only substitutes aliases for *bare* `ORDER BY` references,
   not expressions containing them, so it tried (and failed) to resolve
   them as real columns. Fixed by repeating the full `ST_Distance(...)`
   expressions directly in `ORDER BY`.
3. **The document-expiry-blocks-going-online rule (Section 3.2 of the
   spec) didn't exist at all.** There was a `driver_profiles.is_online`
   column and no code path that ever set it or checked anything before
   doing so. Added `POST /drivers/online` (`documents.service.ts` →
   `setOnlineStatus`), which rejects going online unless
   `approval_status = 'approved'` and none of the DBS/MOT/insurance
   expiry dates are in the past — checked fresh on every attempt, not
   just once at approval time.

A local dev-mode OTP bypass (`OTP_DEV_BYPASS=true`, see `.env.example`)
and a Stripe host override (`STRIPE_API_HOST`, for pointing at
stripe-mock) were added to make this kind of testing possible without
real Twilio/Stripe accounts — both are no-ops unless explicitly set, and
must never be set in a deployed environment.

## What's implemented

| Module | Covers |
|---|---|
| `auth` | Register, Twilio Verify OTP send/check, JWT access+refresh issuing/refresh, plus `POST /auth/staff/login` (email+password) for admin/support/finance accounts — see `scripts/seed-admin.js` to bootstrap the first one |
| `users` | GET/PUT `/users/me` |
| `vehicles` | Driver vehicle registration |
| `documents` | KYC/compliance upload, verification status, admin approve/reject, auto-approves the driver once all required document types are approved, `POST /drivers/online` enforcing the document-expiry gate |
| `zones` | Admin pricing/matching-radius/trip-type configuration (raw PostGIS for the polygon boundary), `GET /admin/zones` for a JSON-safe summary list with no raw geometry |
| `routes` | Route offer creation; geospatial search via `ST_DWithin`/`ST_Distance` |
| `bookings` | Full state machine (`requested → countered/confirmed → driver_en_route → arrived → in_progress → completed`, plus `cancelled`/`no_show`/`disputed`), enforced centrally so illegal transitions 400 rather than silently succeeding; counter-offer accept/expiry; creates the `Trip` row on `in_progress` |
| `payments` | Stripe Connect: driver onboarding-link generation, split PaymentIntents (`application_fee_amount` + `transfer_data.destination`), webhook receiver with signature verification + idempotency table |
| `ratings` | Post-trip rating submission, rolling average recompute for drivers |
| `support` | Tickets, threaded messages, disputes, category-based SLA due dates, `GET /admin/tickets` for the CRM inbox with optional status filter |
| `notifications` | In-app list/mark-read; `record()` is called by other services, not exposed publicly — actual push/SMS/email delivery is a follow-up integration |
| `privacy` | GDPR export/erasure request logging with the one-calendar-month statutory deadline (does **not** yet execute the export/erasure itself — see below) |
| `admin` | Driver document queue/approval, zone updates, commission config, `GET /admin/dashboard` (KPI aggregates) and `GET /admin/trips` (Live Trip Monitoring list) — role-guarded to `admin`/`super_admin`/`support_agent`/`finance_admin` (see simplification below) |

There is now a real frontend for all of this — see the separate
`qcab-admin` React app, which implements the Dashboard, Document
Verification, Zones & Pricing, and Support Inbox screens against these
exact endpoints (verified together in `e2e/05_admin_frontend_contract.sh`).

## Known simplifications (fix before production)

1. **Booking id vs Trip id** — `/trips/{id}/start` and `/trips/{id}/complete`
   currently take the *booking request* id, since a `Trip` row doesn't
   exist until `markInProgress()` creates one. A production build should
   mint the Trip id at confirmation time and use that consistently.
2. **Vehicle document ownership** — `DocumentsService.maybeApproveDriver`
   checks vehicle documents (V5C/MOT/insurance) by `ownerUserId`, assuming
   uploads tag the driver's id alongside the vehicle id. A multi-vehicle
   driver needs this reworked to check per-vehicle completeness.
3. **Online-status check blocks on ANY expired vehicle, not just the one
   in use** — `setOnlineStatus` rejects going online if *any* of the
   driver's active vehicles has an expired MOT/insurance, even if they
   intend to drive a different, compliant one. Safe-by-default, but a
   multi-vehicle driver needs a "which vehicle for this shift" concept
   for this to be correct rather than just conservative.
4. **GDPR fulfilment** — `privacy.service.ts` logs the request and its
   statutory deadline; it does not walk every table and actually export
   or erase the user's data. That's a cross-cutting job (Section 9 of
   the spec) that touches every module and belongs in a dedicated
   worker, not inline in the controller.
5. **File upload** — `/drivers/documents` accepts a `file_url` in the
   request body; it assumes a separate direct-to-S3 (or equivalent)
   upload has already happened and this endpoint just registers the
   resulting URL. No storage integration is included here.
6. **Bonus tiers** — `commission-config`'s `bonus_tiers` parameter is
   accepted but not persisted; `qcab_schema.sql` doesn't yet have a
   column for it. Add a `bonus_tiers jsonb` column to `zones` (or a
   separate table if tiers get complex) before wiring this through.
7. **Automated tests are limited to the booking state machine.** The
   `e2e/` scripts cover a lot of ground — and found three real bugs —
   but they're run by hand, not in CI. There's no regression coverage
   yet for routes, payments, documents, or the online-status check
   beyond that one-time manual run. Add integration tests against the
   `docker-compose.yml` Postgres before trusting this in staging.
8. **`AdminController`'s role guard is uniform across all its
   endpoints** (`admin`/`super_admin`/`support_agent`/`finance_admin`
   can all reach every route under `/admin`), because the frontend
   needed `support_agent` to reach `/admin/tickets` and the simplest
   fix was widening the controller-level guard rather than adding
   per-endpoint `@Roles()`. A support agent can currently approve
   driver documents and edit zone pricing, which they shouldn't be
   able to do — split this by endpoint before this goes near
   production.

## Setup

```bash
cp .env.example .env   # fill in real values
docker compose up -d   # starts Postgres+PostGIS and loads qcab_schema.sql
npm install
npm run start:dev
```

The API will be at `http://localhost:3000`, matching the `baseUrl` the
Flutter app's `ApiClient` expects.

### Stripe webhook locally
```bash
stripe listen --forward-to localhost:3000/webhooks/stripe
```
Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET` in `.env`.

## What to verify before deploying
- Run `docker compose up -d` and confirm `qcab_schema.sql` loads without
  error (it's mounted as a Postgres init script).
- Point a real Stripe test-mode account at `.env` and walk through
  onboarding-link → PaymentIntent → webhook end to end.
- Add request-level integration tests for the booking state machine —
  it's the part most likely to need adjustment once real usage patterns
  (double-booking races, expired counter-offers) show up.
