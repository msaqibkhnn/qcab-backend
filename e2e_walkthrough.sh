#!/bin/bash
set -e
cd /home/claude/qcab-backend

BASE=http://localhost:3000
j() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d$1)"; }

step() { echo; echo "### $1"; }

step "Register driver"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"phone_number":"+447700900001","role":"driver","full_name":"Aisha Khan","email":"aisha@example.com"}'
echo

step "Verify driver OTP (dev bypass code)"
DRIVER_AUTH=$(curl -s -X POST $BASE/auth/otp/verify -H "Content-Type: application/json" \
  -d '{"phone_number":"+447700900001","code":"000000"}')
echo "$DRIVER_AUTH"
DRIVER_TOKEN=$(echo "$DRIVER_AUTH" | j "['access_token']")
DRIVER_ID=$(echo "$DRIVER_AUTH" | j "['user']['id']")
echo "driver_id=$DRIVER_ID"

step "Register rider"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"phone_number":"+447700900002","role":"rider","full_name":"Ryan Miles"}'
echo

step "Verify rider OTP"
RIDER_AUTH=$(curl -s -X POST $BASE/auth/otp/verify -H "Content-Type: application/json" \
  -d '{"phone_number":"+447700900002","code":"000000"}')
RIDER_TOKEN=$(echo "$RIDER_AUTH" | j "['access_token']")
RIDER_ID=$(echo "$RIDER_AUTH" | j "['user']['id']")
echo "rider_id=$RIDER_ID"

step "Driver registers a vehicle"
VEHICLE=$(curl -s -X POST $BASE/vehicles -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" \
  -d '{"registrationNo":"KX21QCB","make":"Toyota","model":"Corolla","colour":"Blue","seatsAvailable":3}')
echo "$VEHICLE"
VEHICLE_ID=$(echo "$VEHICLE" | j "['id']")

step "Seed a zone directly (no POST /admin/zones endpoint exists yet — this is what a migration/seed script does in reality)"
ZONE_ID=$(PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -t -A -c "
  INSERT INTO zones (name, boundary, trip_type, base_rate_pence_per_mile, booking_fee_pence, vat_applicable, matching_radius_miles, commission_percent)
  VALUES ('Oxford', '{\"type\":\"Polygon\",\"coordinates\":[[[-1.30,51.72],[-1.20,51.72],[-1.20,51.78],[-1.30,51.78],[-1.30,51.72]]]}'::jsonb,
          'cost_share_carpool', 55, 30, true, 3.0, 5.0)
  RETURNING id;
")
echo "zone_id=$ZONE_ID"

step "Driver posts a route offer (Cotswold Rd -> City Centre, Oxford)"
ROUTE=$(curl -s -X POST $BASE/routes -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"vehicleId\":\"$VEHICLE_ID\",\"zoneId\":\"$ZONE_ID\",\"origin\":{\"lat\":51.752,\"lng\":-1.2577,\"label\":\"Cotswold Rd\"},\"destination\":{\"lat\":51.758,\"lng\":-1.2530,\"label\":\"City Centre\"},\"seatsTotal\":3,\"pricePence\":280}")
echo "$ROUTE"
ROUTE_ID=$(echo "$ROUTE" | j "['id']")

step "Rider searches for matching routes (real ST_DWithin/ST_Distance query)"
SEARCH=$(curl -s "$BASE/routes/search?origin_lat=51.7522&origin_lng=-1.2575&destination_lat=51.7581&destination_lng=-1.2528")
echo "$SEARCH"

step "Rider requests a seat on the route"
BOOKING=$(curl -s -X POST $BASE/bookings -H "Authorization: Bearer $RIDER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"route_offer_id\":\"$ROUTE_ID\",\"requested_price_pence\":280}")
echo "$BOOKING"
BOOKING_ID=$(echo "$BOOKING" | j "['id']")

step "Driver accepts the booking (seat should decrement)"
curl -s -X POST $BASE/bookings/$BOOKING_ID/accept -H "Authorization: Bearer $DRIVER_TOKEN"
echo
echo "route seats after accept:"
PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -c "SELECT id, seats_available FROM route_offers WHERE id='$ROUTE_ID';"

step "Reject an illegal transition (accept again on an already-confirmed booking should 400)"
curl -s -o /tmp/illegal.json -w "HTTP %{http_code}\n" -X POST $BASE/bookings/$BOOKING_ID/accept -H "Authorization: Bearer $DRIVER_TOKEN"
cat /tmp/illegal.json; echo

step "Trip lifecycle: en route -> arrived -> in progress"
curl -s -X POST $BASE/trips/$BOOKING_ID/start -H "Authorization: Bearer $DRIVER_TOKEN"; echo
curl -s -X POST $BASE/trips/$BOOKING_ID/arrived -H "Authorization: Bearer $DRIVER_TOKEN"; echo
curl -s -X POST $BASE/trips/$BOOKING_ID/in-progress -H "Authorization: Bearer $DRIVER_TOKEN"; echo

TRIP_ID=$(PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -t -A -c "SELECT id FROM trips WHERE booking_request_id='$BOOKING_ID';")
echo "trip_id=$TRIP_ID"

step "Driver starts Stripe Connect onboarding (against stripe-mock, not real Stripe)"
ONBOARD=$(curl -s -X POST $BASE/drivers/stripe/onboarding-link -H "Authorization: Bearer $DRIVER_TOKEN")
echo "$ONBOARD"

step "Simulate onboarding completion (in reality: Stripe redirects, then sends account.updated webhook)"
PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -c "UPDATE driver_profiles SET stripe_onboarding_complete = true WHERE user_id = '$DRIVER_ID';"

step "Charge the rider for the completed trip (real PaymentIntent created against stripe-mock)"
CHARGE=$(curl -s -X POST $BASE/payments/charge -H "Authorization: Bearer $RIDER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"trip_id\":\"$TRIP_ID\"}")
echo "$CHARGE"
PAYMENT_INTENT_ID=$(echo "$CHARGE" | j "['payment_intent_id']")

step "Payment row before webhook (should be status=pending)"
PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -c "SELECT trip_id, amount_pence, commission_pence, status, stripe_payment_intent_id FROM payments WHERE stripe_payment_intent_id='$PAYMENT_INTENT_ID';"

step "Craft a real Stripe webhook signature (Stripe's documented HMAC-SHA256 scheme) and deliver payment_intent.succeeded"
node -e "
const crypto = require('crypto');
const secret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_fake';
const payload = JSON.stringify({ id: 'evt_test_1', type: 'payment_intent.succeeded', data: { object: { id: '$PAYMENT_INTENT_ID' } } });
const timestamp = Math.floor(Date.now() / 1000);
const signedPayload = \`\${timestamp}.\${payload}\`;
const sig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
require('fs').writeFileSync('/tmp/webhook_payload.json', payload);
console.log(\`t=\${timestamp},v1=\${sig}\`);
" > /tmp/webhook_sig.txt
WEBHOOK_SIG=$(cat /tmp/webhook_sig.txt)
echo "signature header: $WEBHOOK_SIG"

curl -s -o /tmp/webhook_response.json -w "HTTP %{http_code}\n" -X POST $BASE/webhooks/stripe \
  -H "Content-Type: application/json" -H "Stripe-Signature: $WEBHOOK_SIG" --data-binary @/tmp/webhook_payload.json
cat /tmp/webhook_response.json; echo

step "Payment row after webhook (should now be status=captured)"
PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -c "SELECT trip_id, status, stripe_payment_intent_id FROM payments WHERE stripe_payment_intent_id='$PAYMENT_INTENT_ID';"

step "Complete the booking status"
curl -s -X POST $BASE/trips/$BOOKING_ID/complete -H "Authorization: Bearer $DRIVER_TOKEN"; echo

step "Rider rates the driver"
curl -s -X POST $BASE/trips/$TRIP_ID/rating -H "Authorization: Bearer $RIDER_TOKEN" -H "Content-Type: application/json" \
  -d '{"stars":5,"tags":["On time","Friendly"],"comment":"Great ride"}'
echo

step "Driver's updated average rating"
curl -s $BASE/users/$DRIVER_ID/ratings
echo

step "Replay the same webhook event (idempotency check — should be a safe no-op, not a duplicate capture or error)"
curl -s -o /tmp/webhook_replay.json -w "HTTP %{http_code}\n" -X POST $BASE/webhooks/stripe \
  -H "Content-Type: application/json" -H "Stripe-Signature: $WEBHOOK_SIG" --data-binary @/tmp/webhook_payload.json
cat /tmp/webhook_replay.json; echo

step "GDPR erasure request logging"
curl -s -X POST $BASE/privacy/erasure-request -H "Authorization: Bearer $RIDER_TOKEN"
echo

step "Server error log tail (checking for anything unexpected)"
tail -40 /tmp/qcab-backend.log | grep -iE "error|exception" || echo "(no errors logged)"

echo
echo "=== END-TO-END RUN COMPLETE ==="
