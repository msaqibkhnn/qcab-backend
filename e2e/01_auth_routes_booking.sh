#!/bin/bash
set -e
cd "$(dirname "$0")/.."
BASE=http://localhost:3000
j() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d$1)"; }
step() { echo; echo "### $1"; }

step "Register driver"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"phone_number":"+447123456781","role":"driver","full_name":"Aisha Khan","email":"aisha@example.com"}'
echo

step "Verify driver OTP"
DRIVER_AUTH=$(curl -s -X POST $BASE/auth/otp/verify -H "Content-Type: application/json" \
  -d '{"phone_number":"+447123456781","code":"000000"}')
echo "$DRIVER_AUTH"
DRIVER_TOKEN=$(echo "$DRIVER_AUTH" | j "['access_token']")
DRIVER_ID=$(echo "$DRIVER_AUTH" | j "['user']['id']")

step "Register + verify rider"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"phone_number":"+447123456782","role":"rider","full_name":"Ryan Miles"}' >/dev/null
RIDER_AUTH=$(curl -s -X POST $BASE/auth/otp/verify -H "Content-Type: application/json" \
  -d '{"phone_number":"+447123456782","code":"000000"}')
echo "$RIDER_AUTH"
RIDER_TOKEN=$(echo "$RIDER_AUTH" | j "['access_token']")
RIDER_ID=$(echo "$RIDER_AUTH" | j "['user']['id']")

step "Driver registers a vehicle"
VEHICLE=$(curl -s -X POST $BASE/vehicles -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" \
  -d '{"registrationNo":"KX21QCB","make":"Toyota","model":"Corolla","colour":"Blue","seatsAvailable":3}')
echo "$VEHICLE"
VEHICLE_ID=$(echo "$VEHICLE" | j "['id']")

step "Seed a zone directly (no admin create-zone endpoint exists yet)"
ZONE_ID=$(PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -t -A -c "
  INSERT INTO zones (name, boundary, trip_type, base_rate_pence_per_mile, booking_fee_pence, vat_applicable, matching_radius_miles, commission_percent)
  VALUES ('Oxford', '{\"type\":\"Polygon\",\"coordinates\":[[[-1.30,51.72],[-1.20,51.72],[-1.20,51.78],[-1.30,51.78],[-1.30,51.72]]]}'::jsonb,
          'cost_share_carpool', 55, 30, true, 3.0, 5.0)
  RETURNING id;" | grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
echo "zone_id=$ZONE_ID"

step "Driver posts a route offer"
ROUTE=$(curl -s -X POST $BASE/routes -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"vehicleId\":\"$VEHICLE_ID\",\"zoneId\":\"$ZONE_ID\",\"origin\":{\"lat\":51.752,\"lng\":-1.2577,\"label\":\"Cotswold Rd\"},\"destination\":{\"lat\":51.758,\"lng\":-1.2530,\"label\":\"City Centre\"},\"seatsTotal\":3,\"pricePence\":280}")
echo "$ROUTE"
ROUTE_ID=$(echo "$ROUTE" | j "['id']")

step "Rider searches for matching routes (haversine distance query)"
curl -s "$BASE/routes/search?origin_lat=51.7522&origin_lng=-1.2575&destination_lat=51.7581&destination_lng=-1.2528"
echo

step "Rider requests a seat"
BOOKING=$(curl -s -X POST $BASE/bookings -H "Authorization: Bearer $RIDER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"route_offer_id\":\"$ROUTE_ID\",\"requested_price_pence\":280}")
echo "$BOOKING"
BOOKING_ID=$(echo "$BOOKING" | j "['id']")

step "Driver accepts (seat should decrement)"
curl -s -X POST $BASE/bookings/$BOOKING_ID/accept -H "Authorization: Bearer $DRIVER_TOKEN"; echo
PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -c "SELECT id, seats_available FROM route_offers WHERE id='$ROUTE_ID';"

step "Illegal transition check: accepting an already-confirmed booking should 400"
curl -s -o /tmp/illegal.json -w "HTTP %{http_code}\n" -X POST $BASE/bookings/$BOOKING_ID/accept -H "Authorization: Bearer $DRIVER_TOKEN"
cat /tmp/illegal.json; echo

step "Trip lifecycle: en route -> arrived -> in progress"
curl -s -X POST $BASE/trips/$BOOKING_ID/start -H "Authorization: Bearer $DRIVER_TOKEN"; echo
curl -s -X POST $BASE/trips/$BOOKING_ID/arrived -H "Authorization: Bearer $DRIVER_TOKEN"; echo
curl -s -X POST $BASE/trips/$BOOKING_ID/in-progress -H "Authorization: Bearer $DRIVER_TOKEN"; echo
TRIP_ID=$(PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -t -A -c "SELECT id FROM trips WHERE booking_request_id='$BOOKING_ID';")
echo "trip_id=$TRIP_ID"

cat > /tmp/e2e_vars.sh << VARSEOF
DRIVER_TOKEN="$DRIVER_TOKEN"
RIDER_TOKEN="$RIDER_TOKEN"
DRIVER_ID="$DRIVER_ID"
RIDER_ID="$RIDER_ID"
BOOKING_ID="$BOOKING_ID"
TRIP_ID="$TRIP_ID"
VARSEOF
echo "=== CHUNK A COMPLETE — vars saved to /tmp/e2e_vars.sh ==="
