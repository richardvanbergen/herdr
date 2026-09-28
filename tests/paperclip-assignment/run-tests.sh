#!/usr/bin/env bash
set -euo pipefail
: "${PAPERCLIP_RUN_SCRATCH_DIR:?Set to an existing disposable scratch parent}"
package_output="$(realpath "${1:?Pass the Nix package output}")"
test -f "$package_output/lib/paperclip/node_modules/@paperclipai/server/dist/services/authorization.js"
test_source="$(cd "$(dirname "$0")" && pwd)"
export PAPERCLIP_TEST_SCRATCH
PAPERCLIP_TEST_SCRATCH="$(mktemp -d "$PAPERCLIP_RUN_SCRATCH_DIR/assignment-tests.XXXXXX")"
export PGHOST="$PAPERCLIP_TEST_SCRATCH/pg-socket"
export PAPERCLIP_TEST_SERVER_URL="file://$package_output/lib/paperclip/node_modules/@paperclipai/server/"
mkdir -p "$PGHOST" "$PAPERCLIP_TEST_SCRATCH/repair"
cp "$test_source/"*.mjs "$PAPERCLIP_TEST_SCRATCH/repair/"
ln -s "$package_output/lib/paperclip/node_modules" "$PAPERCLIP_TEST_SCRATCH/repair/node_modules"
browser_pid=''
cleanup() {
  if [[ -n "$browser_pid" ]]; then kill "$browser_pid" 2>/dev/null || true; fi
  pg_ctl -D "$PAPERCLIP_TEST_SCRATCH/pg-data" -m fast stop >/dev/null 2>&1 || true
}
trap cleanup EXIT
initdb -D "$PAPERCLIP_TEST_SCRATCH/pg-data" --auth=trust --no-instructions > "$PAPERCLIP_TEST_SCRATCH/initdb.log"
pg_ctl -D "$PAPERCLIP_TEST_SCRATCH/pg-data" -l "$PAPERCLIP_TEST_SCRATCH/postgres.log" -o "-k $PGHOST -h ''" start
cat > "$PAPERCLIP_TEST_SCRATCH/repair/migrate.mjs" <<'JS'
import {applyPendingMigrations, closeRegisteredClients} from '@paperclipai/db';
await applyPendingMigrations('postgresql:///postgres');
await closeRegisteredClients('postgresql:///postgres');
JS
node "$PAPERCLIP_TEST_SCRATCH/repair/migrate.mjs"
node --test "$PAPERCLIP_TEST_SCRATCH/repair/permission.test.mjs" | tee "$PAPERCLIP_TEST_SCRATCH/routes.log"
if [[ "${2:-}" == '--browser' ]]; then
  node "$PAPERCLIP_TEST_SCRATCH/repair/browser-fixture.mjs" > "$PAPERCLIP_TEST_SCRATCH/browser-server.log" 2>&1 &
  browser_pid=$!
  for attempt in $(seq 1 100); do
    test -f "$PAPERCLIP_TEST_SCRATCH/repair/browser-fixture.json" && break
    kill -0 "$browser_pid"
    sleep 0.2
  done
  node "$PAPERCLIP_TEST_SCRATCH/repair/browser-check.mjs" | tee "$PAPERCLIP_TEST_SCRATCH/browser.log"
fi
printf 'Evidence directory: %s\n' "$PAPERCLIP_TEST_SCRATCH"
