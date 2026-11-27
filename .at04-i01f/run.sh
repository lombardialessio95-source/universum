#!/usr/bin/env bash
set -euo pipefail
test "${FIRESTORE_EMULATOR_HOST:-}" = '127.0.0.1:8080'
test "${GCLOUD_PROJECT:-}" = demo-universum
test "${GOOGLE_CLOUD_PROJECT:-}" = demo-universum
cd "$RUNNER_TEMP/at04f-game"
logs="$RUNNER_TEMP/at04f-logs"
run() {
  local name="$1" code; shift
  set +e
  timeout 300s "$@" 2>&1 | tee "$logs/$name.log"
  code=${PIPESTATUS[0]}
  set -e
  echo "$name exit=$code" | tee -a "$logs/results.txt"
  return "$code"
}
coverage() {
  curl -fsS --max-time 30 'http://127.0.0.1:8080/emulator/v1/projects/demo-universum:ruleCoverage' -o "$logs/coverage.json" || echo 'coverage JSON unavailable' | tee -a "$logs/results.txt"
  curl -fsS --max-time 30 'http://127.0.0.1:8080/emulator/v1/projects/demo-universum:ruleCoverage.html' -o "$logs/coverage.html" || echo 'coverage HTML unavailable' | tee -a "$logs/results.txt"
}
trap coverage EXIT
# An actual SDK transaction/read is the compilation and fixture preflight.
if ! run fixture-preflight node tests/helpers/historical-specialist-fixture.js; then
  echo 'Fixture preflight failed: specialist smoke not started' | tee -a "$logs/results.txt"
  exit 1
fi
if ! grep -Fq 'PASS fixture preflight:' "$logs/fixture-preflight.log"; then exit 1; fi
if grep -Eiq 'maximum of 1000|evaluation.*limit|exceed(ed|s)?.*expression|too many.*(get|access)' "$logs/fixture-preflight.log"; then exit 1; fi
run specialists-ui node tests/smoke_specialists_ui.js
grep -Fq 'SDK Firestore: due sessioni, limite imperiale, trasferimento atomico, arrivo, riconnessione e doppio checkpoint superati.' "$logs/specialists-ui.log"
grep -Fq 'SDK fixture: origin, destination and profile unchanged (data and versions)' "$logs/specialists-ui.log"
git diff --exit-code HEAD
