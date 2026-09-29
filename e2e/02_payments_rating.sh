#!/bin/bash
set -e
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a
BASE=http://localhost:3000
j() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d$1)"; }
step() { echo; echo "### $1"; }

. /tmp/e2e_vars.sh

step "Driver starts Stripe Connect onboarding (against stripe-mock)"
ONBOARD=$(curl -s -X POST $BASE/drivers/stripe/onboarding-link -H "Authorization: Bearer $DRIVER_TOKEN")
echo "$ONBOARD"

step "Simulate onboarding completion (in reality: Stripe redirects, then sends account.updated webhook)"
PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -c "UPDATE driver_profiles SET stripe_onboarding_complete = true WHERE user_id = '$DRIVER_ID';"

step "Charge the rider for the completed trip (real PaymentIntent created against stripe-mock)"
CHARGE=$(curl -s -X POST $BASE/payments/charge -H "Authorization: Bearer $RIDER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"trip_id\":\"$TRIP_ID\"}")
echo "$CHARGE"
PAYMENT_INTENT_ID=$(echo "$CHARGE" | j "['payment_intent_id']")

step "Payment row before webhook (expect status=pending)"
PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -c "SELECT trip_id, amount_pence, commission_pence, status FROM payments WHERE stripe_payment_intent_id='$PAYMENT_INTENT_ID';"

step "Craft a real Stripe webhook signature and deliver payment_intent.succeeded"
node -e "
const payload = JSON.stringify({ id: 'evt_test_1', type: 'payment_intent.succeeded', data: { object: { id: '$PAYMENT_INTENT_ID' } } });
require('fs').writeFileSync('/tmp/webhook_payload.json', payload);
"
WEBHOOK_SIG=$(node -e "
const crypto = require('crypto');
const secret = '$STRIPE_WEBHOOK_SECRET';
const payload = require('fs').readFileSync('/tmp/webhook_payload.json');
const timestamp = Math.floor(Date.now() / 1000);
const signedPayload = timestamp + '.' + payload;
const sig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
console.log('t=' + timestamp + ',v1=' + sig);
")
echo "signature: $WEBHOOK_SIG"

curl -s -o /tmp/webhook_response.json -w "HTTP %{http_code}\n" -X POST $BASE/webhooks/stripe \
  -H "Content-Type: application/json" -H "Stripe-Signature: $WEBHOOK_SIG" --data-binary @/tmp/webhook_payload.json
cat /tmp/webhook_response.json; echo

step "Payment row after webhook (expect status=captured)"
PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -c "SELECT trip_id, status FROM payments WHERE stripe_payment_intent_id='$PAYMENT_INTENT_ID';"

step "Complete the booking status"
curl -s -X POST $BASE/trips/$BOOKING_ID/complete -H "Authorization: Bearer $DRIVER_TOKEN"; echo

step "Rider rates the driver"
curl -s -X POST $BASE/trips/$TRIP_ID/rating -H "Authorization: Bearer $RIDER_TOKEN" -H "Content-Type: application/json" \
  -d '{"stars":5,"tags":["On time","Friendly"],"comment":"Great ride"}'
echo

step "Driver's updated average rating"
curl -s $BASE/users/$DRIVER_ID/ratings
echo

step "Replay the same webhook event (idempotency check)"
curl -s -o /tmp/webhook_replay.json -w "HTTP %{http_code}\n" -X POST $BASE/webhooks/stripe \
  -H "Content-Type: application/json" -H "Stripe-Signature: $WEBHOOK_SIG" --data-binary @/tmp/webhook_payload.json
cat /tmp/webhook_replay.json; echo

step "GDPR erasure request logging"
curl -s -X POST $BASE/privacy/erasure-request -H "Authorization: Bearer $RIDER_TOKEN"
echo

step "Any server-side errors logged during this whole run?"
grep -iE "error|exception" /tmp/qcab-backend.log | grep -v "ExceptionsHandler.*origin_distance_m" || echo "(none found)"

echo
echo "=== CHUNK B COMPLETE — FULL END-TO-END RUN FINISHED ==="
