# End-to-end verification scripts

These three scripts are exactly what was used to verify this backend
against real infrastructure (see the main README's "Bugs found and
fixed" section for what that run turned up). They're included so you
can reproduce the same verification, or extend it, rather than take
this backend's correctness on faith.

They assume:
- PostgreSQL 16 + PostGIS running locally, reachable with the
  credentials in `.env` (`docker compose up -d` from the repo root
  gives you this).
- A `stripe-mock` instance running on `127.0.0.1:12111` (see
  https://github.com/stripe/stripe-mock — or point `STRIPE_API_HOST`
  in `.env` at a real Stripe test account instead and drop the
  `stripe-mock`-specific steps).
- The server itself running and reachable at `http://localhost:3000`.
- `OTP_DEV_BYPASS=true` in `.env` (see that variable's warning in
  `.env.example` — dev/CI only).
- `python3` and `node` available on PATH (used for JSON parsing and
  for computing a real Stripe webhook signature).

## Running them

```bash
# from the qcab-backend/ directory, with the server already running:
bash e2e/01_auth_routes_booking.sh   # registration through to trip in-progress; writes IDs/tokens to /tmp/e2e_vars.sh
bash e2e/02_payments_rating.sh       # sources /tmp/e2e_vars.sh — Stripe Connect, payment, webhook, rating
bash e2e/03_documents_admin_counteroffer.sh   # independent — documents, admin approval, zones, counter-offer, cancellation
bash e2e/04_online_status_notifications_tickets.sh   # independent — online-status expiry gate, notifications, tickets, disputes
bash e2e/05_admin_frontend_contract.sh   # independent — staff login, dashboard/trips/zones/tickets, exactly what qcab-admin calls
```

Script 1 and 2 share state via `/tmp/e2e_vars.sh` because JWTs are
stateless — a token minted by one server process is still valid when a
freshly restarted server process verifies it, since it's just an HMAC
signature check. This matters if you're running these against a server
you've restarted between scripts; it doesn't matter at all in normal
operation.

Script 3 is fully independent — it registers its own driver/rider and
seeds its own zone.

## What each script exercises

- **01**: registration, OTP, JWT issuance, vehicle registration, zone
  seeding, route posting (real PostGIS insert), geospatial search (real
  `ST_DWithin`/`ST_Distance`), booking, acceptance (seat decrement),
  illegal-transition rejection, full trip lifecycle.
- **02**: Stripe Connect onboarding, PaymentIntent creation with the
  commission split, a real HMAC-signed webhook delivering
  `payment_intent.succeeded`, webhook idempotency (replay is a no-op),
  rating submission, GDPR erasure request logging.
- **03**: KYC document upload, the admin approval queue, the
  auto-approve-once-all-documents-approved rule, admin zone/commission
  config, the role-based 403 boundary, the counter-offer flow, and
  cancellation with reason tracking.
- **04**: the document-expiry-blocks-going-online rule (`POST
  /drivers/online`) — blocked pre-approval, blocked with an expired
  MOT naming the specific vehicle, succeeds once fixed, offline always
  allowed — plus notifications list/mark-read and ticket creation,
  threaded replies, and category-based SLA differentiation.
- **05**: staff email+password login (`scripts/seed-admin.js` +
  `POST /auth/staff/login`, including a rejected bad-password
  attempt), then every endpoint the `qcab-admin` React frontend calls
  — dashboard KPIs, recent trips, the zones list (with an explicit
  check that no raw PostGIS geometry leaks into the JSON), a zone
  edit, the tickets list with status filtering, and the 403 boundary
  when a driver token hits an admin route.
