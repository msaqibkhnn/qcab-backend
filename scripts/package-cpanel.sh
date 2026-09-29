#!/usr/bin/env bash
# Builds a ready-to-upload zip for cPanel "Setup Node.js App".
#   npm run package:cpanel            -> ../qcab-api-cpanel.zip
#   bash scripts/package-cpanel.sh /some/where/out.zip
# The zip has app.js at its root, so extract it INTO the application root.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="$(realpath -m "${1:-../qcab-api-cpanel.zip}")"

npm install --no-audit --no-fund
npx nest build

STAGE="$(mktemp -d)"
mkdir -p "$STAGE/scripts"
cp -r dist "$STAGE/dist"
find "$STAGE/dist" \( -name '*.map' -o -name '*.spec.js' -o -name '*.tsbuildinfo' \) -delete
cp app.js "$STAGE/"
cp scripts/seed-admin.js "$STAGE/scripts/"
cp .env.example "$STAGE/.env.example"

# Production-only package.json so cPanel's "Run NPM Install" never pulls
# TypeScript/Jest/Nest CLI onto the shared host.
node -e '
const fs=require("fs"); const p=require("./package.json");
delete p.devDependencies; delete p.jest;
p.scripts={ start:"node app.js", "seed:admin":"node scripts/seed-admin.js" };
fs.writeFileSync(process.argv[1]+"/package.json", JSON.stringify(p,null,2)+"\n");
' "$STAGE"
( cd "$STAGE" && npm install --package-lock-only --omit=dev --no-audit --no-fund >/dev/null )

rm -f "$OUT"
( cd "$STAGE" && zip -qr "$OUT" . )
echo "Wrote $OUT"; unzip -l "$OUT" | tail -1
