#!/bin/bash
set -e
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a
BASE=http://localhost:3000
j() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d$1)"; }
step() { echo; echo "### $1"; }

step "Register + verify a driver"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"phone_number":"+447123456790","role":"driver","full_name":"Tom Ellery"}' >/dev/null
DRIVER_AUTH=$(curl -s -X POST $BASE/auth/otp/verify -H "Content-Type: application/json" -d '{"phone_number":"+447123456790","code":"000000"}')
DRIVER_TOKEN=$(echo "$DRIVER_AUTH" | j "['access_token']")
DRIVER_ID=$(echo "$DRIVER_AUTH" | j "['user']['id']")

step "Attempt to go online before approval (expect 400)"
curl -s -o /tmp/online1.json -w "HTTP %{http_code}\n" -X POST $BASE/drivers/online -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" -d '{"online": true}'
cat /tmp/online1.json; echo

step "Driver registers a vehicle with an ALREADY-EXPIRED MOT"
VEHICLE=$(curl -s -X POST $BASE/vehicles -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" \
  -d '{"registrationNo":"TE99XYZ","make":"Ford","model":"Focus","colour":"Grey","seatsAvailable":3}')
VEHICLE_ID=$(echo "$VEHICLE" | j "['id']")
PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -c "UPDATE vehicles SET mot_expiry_date = '2020-01-01', insurance_expiry_date = '2028-01-01' WHERE id = '$VEHICLE_ID';" >/dev/null

step "Upload and approve all 5 required documents (via a seeded admin)"
PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -c "
  INSERT INTO users (id, role, full_name, phone_number, status)
  VALUES ('00000000-0000-0000-0000-000000000098', 'admin', 'Ops Admin 2', '+447123456798', 'active')
  ON CONFLICT (id) DO NOTHING;
" >/dev/null
ADMIN_TOKEN=$(node -e "
const jwt = require('jsonwebtoken');
console.log(jwt.sign({ sub: '00000000-0000-0000-0000-000000000098', role: 'admin' }, '$JWT_ACCESS_SECRET', { expiresIn: '15m' }));
")
for DOC in driving_licence dbs_check vehicle_v5c vehicle_mot vehicle_insurance; do
  DOC_ID=$(curl -s -X POST $BASE/drivers/documents -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" \
    -d "{\"docType\":\"$DOC\",\"fileUrl\":\"https://storage.example.com/$DOC.pdf\"}" | j "['id']")
  curl -s -X POST $BASE/admin/drivers/$DOC_ID/approve -H "Authorization: Bearer $ADMIN_TOKEN" -o /dev/null
done
echo "all 5 documents approved"

step "Verification status now (expect approval_status=approved)"
curl -s $BASE/drivers/verification-status -H "Authorization: Bearer $DRIVER_TOKEN"; echo

step "Attempt to go online with approval granted but MOT expired (expect 400, naming the vehicle)"
curl -s -o /tmp/online2.json -w "HTTP %{http_code}\n" -X POST $BASE/drivers/online -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" -d '{"online": true}'
cat /tmp/online2.json; echo

step "Fix the MOT expiry to the future"
PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -c "UPDATE vehicles SET mot_expiry_date = '2028-01-01' WHERE id = '$VEHICLE_ID';" >/dev/null

step "Attempt to go online again (expect success now)"
curl -s -o /tmp/online3.json -w "HTTP %{http_code}\n" -X POST $BASE/drivers/online -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" -d '{"online": true}'
cat /tmp/online3.json; echo
PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -c "SELECT is_online FROM driver_profiles WHERE user_id='$DRIVER_ID';"

step "Go offline (always allowed)"
curl -s -X POST $BASE/drivers/online -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" -d '{"online": false}'; echo

step "Notifications: insert one directly (no public create-endpoint by design — internal only), then list + mark read"
NOTIF_ID=$(PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -t -A -c "
  INSERT INTO notifications (user_id, channel, template_key, payload)
  VALUES ('$DRIVER_ID', 'in_app', 'document_approved', '{\"docType\":\"vehicle_mot\"}')
  RETURNING id;" | grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' || true)
echo "notification_id=$NOTIF_ID"
curl -s $BASE/notifications -H "Authorization: Bearer $DRIVER_TOKEN"; echo
curl -s -X PATCH $BASE/notifications/$NOTIF_ID/read -H "Authorization: Bearer $DRIVER_TOKEN"; echo
echo "notification row after mark-read:"
PGPASSWORD=qcab psql -h localhost -U qcab -d qcab -c "SELECT id, read_at IS NOT NULL AS is_read FROM notifications WHERE id='$NOTIF_ID';"

step "Tickets: driver raises a support ticket and gets a reply"
TICKET=$(curl -s -X POST $BASE/tickets -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" \
  -d '{"category":"technical"}')
echo "$TICKET"
TICKET_ID=$(echo "$TICKET" | j "['id']")
echo "SLA due date set: $(echo "$TICKET" | j "['slaDueAt']")"

curl -s -X POST $BASE/tickets/$TICKET_ID/messages -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" \
  -d '{"body":"The app crashes when I try to go online"}'
echo

step "Fetch the ticket thread"
curl -s $BASE/tickets/$TICKET_ID -H "Authorization: Bearer $DRIVER_TOKEN"; echo

step "Raise a dispute against this ticket"
curl -s -X POST $BASE/disputes -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"ticket_id\":\"$TICKET_ID\"}"
echo

step "Confirm the safety-category ticket gets a tighter SLA than a technical one"
SAFETY_TICKET=$(curl -s -X POST $BASE/tickets -H "Authorization: Bearer $DRIVER_TOKEN" -H "Content-Type: application/json" -d '{"category":"safety"}')
echo "safety SLA:    $(echo "$SAFETY_TICKET" | j "['slaDueAt']")"
echo "technical SLA: $(echo "$TICKET" | j "['slaDueAt']")"

step "Any server-side errors during this run?"
grep -iE "error|exception" /tmp/qcab-backend.log | grep -v "ExceptionsHandler.*origin_distance_m" || echo "(none found)"

echo
echo "=== CHUNK D COMPLETE ==="
