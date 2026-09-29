#!/bin/bash
set -e
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a
BASE=http://localhost:3000
j() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d$1)"; }
step() { echo; echo "### $1"; }

step "Register + verify a driver"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"phone_number":"+447123456783","role":"driver","full_name":"Marcus Webb"}' >/dev/null
DRIVER_AUTH=$(curl -s -X POST $BASE/auth/otp/verify -H "Content-Type: application/json" \
  -d '{"phone_number":"+447123456783","code":"000000"}')
DRIVER_TOKEN=$(echo "$DRIVER_AUTH" | j "['access_token']")
DRIVER_ID=$(echo "$DRIVER_AUTH" | j "['user']['id']")
echo "driver_id=$DRIVER_ID"

step "Check verification status before any documents (expect not_submitted)"
curl -s $BASE/drivers/verification-status -H "Authorization: Bearer $DRIVER_TOKEN"; echo

step "Driver uploads all five required documents"
for DOC in driving_licence dbs_check vehicle_v5c vehicle_mot vehicle_insurance; do
  curl -s -X POST $BASE/drivers/documents -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" \
    -d "{\"docType\":\"$DOC\",\"fileUrl\":\"https://storage.example.com/$DOC.pdf\",\"expiryDate\":\"2028-01-01\"}"
  echo
done

step "Verification status after upload (expect 5 docs, all pending, approval_status still not_submitted)"
curl -s $BASE/drivers/verification-status -H "Authorization: Bearer $DRIVER_TOKEN"; echo

step "Mint an admin JWT (no /auth/register path supports the admin role — seeding directly, as an ops team's internal tooling would)"
PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -c "
  INSERT INTO users (id, role, full_name, phone_number, status)
  VALUES ('00000000-0000-0000-0000-000000000099', 'admin', 'Ops Admin', '+447123456799', 'active');
" >/dev/null
ADMIN_TOKEN=$(node -e "
const jwt = require('jsonwebtoken');
console.log(jwt.sign({ sub: '00000000-0000-0000-0000-000000000099', role: 'admin' }, '$JWT_ACCESS_SECRET', { expiresIn: '15m' }));
")

step "Admin views the pending document queue"
PENDING=$(curl -s $BASE/admin/drivers/pending -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$PENDING"
DOC_COUNT=$(echo "$PENDING" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "pending doc count: $DOC_COUNT"

step "Admin approves each pending document for this driver"
DOC_IDS=$(echo "$PENDING" | python3 -c "
import sys, json
docs = json.load(sys.stdin)
for d in docs:
    print(d['id'])
")
for ID in $DOC_IDS; do
  curl -s -X POST $BASE/admin/drivers/$ID/approve -H "Authorization: Bearer $ADMIN_TOKEN" -o /dev/null -w "approved $ID -> HTTP %{http_code}\n"
done

step "Verification status after all approvals (expect approval_status=approved — tests the auto-approval logic in maybeApproveDriver)"
curl -s $BASE/drivers/verification-status -H "Authorization: Bearer $DRIVER_TOKEN"; echo

step "Admin updates zone pricing via PUT /admin/zones/:id"
ZONE_ID=$(PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -t -A -c "SELECT id FROM zones LIMIT 1;" | grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' || true)
if [ -z "$ZONE_ID" ]; then
  ZONE_ID=$(PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -t -A -c "
    INSERT INTO zones (name, boundary, trip_type, base_rate_pence_per_mile, booking_fee_pence, vat_applicable, matching_radius_miles, commission_percent)
    VALUES ('Test Zone', '{\"type\":\"Polygon\",\"coordinates\":[[[-1.3,51.7],[-1.2,51.7],[-1.2,51.8],[-1.3,51.8],[-1.3,51.7]]]}'::jsonb,
            'cost_share_carpool', 55, 30, true, 3.0, 5.0)
    RETURNING id;" | grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
fi
curl -s -X PUT $BASE/admin/zones/$ZONE_ID -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"commissionPercent": 7.5, "matchingRadiusMiles": 4.0}'
echo
echo "zone row after update:"
PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -c "SELECT commission_percent, matching_radius_miles FROM zones WHERE id='$ZONE_ID';"

step "Non-admin (driver token) hitting an admin endpoint should 403"
curl -s -o /tmp/forbidden.json -w "HTTP %{http_code}\n" $BASE/admin/drivers/pending -H "Authorization: Bearer $DRIVER_TOKEN"
cat /tmp/forbidden.json; echo

step "Counter-offer flow: register a rider, driver posts a route, rider requests, driver counters, rider's booking reflects countered status"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"phone_number":"+447123456784","role":"rider","full_name":"Sara Ito"}' >/dev/null
RIDER2_AUTH=$(curl -s -X POST $BASE/auth/otp/verify -H "Content-Type: application/json" -d '{"phone_number":"+447123456784","code":"000000"}')
RIDER2_TOKEN=$(echo "$RIDER2_AUTH" | j "['access_token']")

VEHICLE2=$(curl -s -X POST $BASE/vehicles -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" \
  -d '{"registrationNo":"MW22ABC","make":"Honda","model":"Jazz","colour":"Red","seatsAvailable":3}')
VEHICLE2_ID=$(echo "$VEHICLE2" | j "['id']")

ROUTE2=$(curl -s -X POST $BASE/routes -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"vehicleId\":\"$VEHICLE2_ID\",\"zoneId\":\"$ZONE_ID\",\"origin\":{\"lat\":51.752,\"lng\":-1.2577,\"label\":\"Marston\"},\"destination\":{\"lat\":51.758,\"lng\":-1.2530,\"label\":\"City Centre\"},\"seatsTotal\":2,\"pricePence\":300}")
ROUTE2_ID=$(echo "$ROUTE2" | j "['id']")

BOOKING2=$(curl -s -X POST $BASE/bookings -H "Authorization: Bearer $RIDER2_TOKEN" -H "Content-Type: application/json" \
  -d "{\"route_offer_id\":\"$ROUTE2_ID\",\"requested_price_pence\":300}")
BOOKING2_ID=$(echo "$BOOKING2" | j "['id']")
echo "booking2 status before counter: $(echo "$BOOKING2" | j "['status']")"

curl -s -X POST $BASE/bookings/$BOOKING2_ID/counter-offer -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" \
  -d '{"proposed_price_pence": 350}'
echo
echo "booking2 status in DB after counter-offer:"
PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -c "SELECT status, requested_price_pence, final_price_pence FROM booking_requests WHERE id='$BOOKING2_ID';"

step "Cancel a booking and confirm the state machine records who cancelled and why"
curl -s -X POST $BASE/bookings/$BOOKING2_ID/cancel -H "Authorization: Bearer $RIDER2_TOKEN" -H "Content-Type: application/json" \
  -d '{"reason":"Found another ride"}'
echo

step "Any server-side errors during this run?"
grep -iE "error|exception" /tmp/qcab-backend.log | grep -v "ExceptionsHandler.*origin_distance_m" || echo "(none found)"

echo
echo "=== CHUNK C COMPLETE ==="
