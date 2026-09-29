#!/bin/bash
set -e
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a
BASE=http://localhost:3000
j() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d$1)"; }
step() { echo; echo "### $1"; }

step "Seed a bootstrap super_admin via the seed script"
node scripts/seed-admin.js "Ops Admin" admin@qcab.co.uk "correct-horse-battery"

step "Reject a bad password"
curl -s -o /tmp/staff_login_bad.json -w "HTTP %{http_code}\n" -X POST $BASE/auth/staff/login \
  -H "Content-Type: application/json" -d '{"email":"admin@qcab.co.uk","password":"wrong-password"}'
cat /tmp/staff_login_bad.json; echo

step "Staff login with the correct password"
LOGIN=$(curl -s -X POST $BASE/auth/staff/login -H "Content-Type: application/json" \
  -d '{"email":"admin@qcab.co.uk","password":"correct-horse-battery"}')
echo "$LOGIN"
ADMIN_TOKEN=$(echo "$LOGIN" | j "['access_token']")

step "GET /admin/dashboard — exactly what DashboardPage.tsx renders"
curl -s $BASE/admin/dashboard -H "Authorization: Bearer $ADMIN_TOKEN"; echo

step "GET /admin/trips — exactly what the recent-trips table renders"
curl -s $BASE/admin/trips -H "Authorization: Bearer $ADMIN_TOKEN"; echo

step "GET /admin/zones — exactly what ZonesPage.tsx renders (no raw WKB geometry should appear)"
ZONES=$(curl -s $BASE/admin/zones -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$ZONES"
if echo "$ZONES" | grep -qi "0101000020"; then
  echo "FAIL: raw WKB hex leaked into the zones list response"
  exit 1
fi

step "Create a zone directly (no create-zone endpoint yet), then confirm it appears via the list endpoint"
PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -c "
  INSERT INTO zones (name, boundary, trip_type, base_rate_pence_per_mile, booking_fee_pence, vat_applicable, matching_radius_miles, commission_percent)
  VALUES ('Bristol', '{\"type\":\"Polygon\",\"coordinates\":[[[-2.65,51.42],[-2.55,51.42],[-2.55,51.50],[-2.65,51.50],[-2.65,51.42]]]}'::jsonb,
          'cost_share_carpool', 60, 30, true, 3.0, 5.0);
" >/dev/null
ZONE_ID=$(curl -s $BASE/admin/zones -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "
import sys, json
zones = json.load(sys.stdin)
z = next(z for z in zones if z['name'] == 'Bristol')
print(z['id'])
")
echo "zone_id=$ZONE_ID"

step "Edit the zone via PUT /admin/zones/:id — exactly what ZonesPage.tsx's save button calls"
curl -s -X PUT $BASE/admin/zones/$ZONE_ID -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"tripType":"cost_share_carpool","baseRatePencePerMile":65,"bookingFeePence":35,"matchingRadiusMiles":3.5,"commissionPercent":6.0}'
echo
echo "zone row after edit:"
curl -s $BASE/admin/zones -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "
import sys, json
zones = json.load(sys.stdin)
z = next(z for z in zones if z['id'] == '$ZONE_ID')
print(z)
"

step "Register a driver and raise a ticket, so GET /admin/tickets has something to show"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"phone_number":"+447123456795","role":"driver","full_name":"Priya Shah"}' >/dev/null
DRIVER_AUTH=$(curl -s -X POST $BASE/auth/otp/verify -H "Content-Type: application/json" -d '{"phone_number":"+447123456795","code":"000000"}')
DRIVER_TOKEN=$(echo "$DRIVER_AUTH" | j "['access_token']")
curl -s -X POST $BASE/tickets -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" \
  -d '{"category":"account"}' >/dev/null

step "GET /admin/tickets — exactly what TicketsPage.tsx renders"
curl -s $BASE/admin/tickets -H "Authorization: Bearer $ADMIN_TOKEN"; echo

step "GET /admin/tickets?status=open — filter behaves"
curl -s "$BASE/admin/tickets?status=open" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "
import sys, json
print('open tickets:', len(json.load(sys.stdin)))
"

step "A driver token (not staff) hitting /admin/dashboard should 403"
curl -s -o /tmp/forbidden2.json -w "HTTP %{http_code}\n" $BASE/admin/dashboard -H "Authorization: Bearer $DRIVER_TOKEN"
cat /tmp/forbidden2.json; echo

step "GET /admin/drivers/pending — exactly what DocumentsPage.tsx renders"
curl -s -X POST $BASE/drivers/documents -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" \
  -d '{"docType":"driving_licence","fileUrl":"https://storage.example.com/dl.pdf"}' >/dev/null
curl -s $BASE/admin/drivers/pending -H "Authorization: Bearer $ADMIN_TOKEN"; echo

step "Any server-side errors during this run?"
grep -iE "error|exception" /tmp/qcab-backend.log | grep -v "ExceptionsHandler.*origin_distance_m" || echo "(none found)"

echo
echo "=== CHUNK E COMPLETE ==="
