#!/usr/bin/env bash
set -euo pipefail
test "${FIRESTORE_EMULATOR_HOST:-}" = '127.0.0.1:8080'
cd "$RUNNER_TEMP/at04i02b-game"
logs="$RUNNER_TEMP/at04i02b-logs"
group="$1"
project="$2"
failed=0
run() {
  local name="$1"; shift
  set +e
  timeout 300s "$@" 2>&1 | tee "$logs/$name.log"
  local code=${PIPESTATUS[0]}
  set -e
  echo "$name exit=$code" | tee -a "$logs/results.txt"
  if [ "$code" -ne 0 ]; then failed=1; fi
}
case "$group" in
  compile)
    endpoint="http://127.0.0.1:8080/v1/projects/$project/databases/(default)/documents/online_universes/at04i02b_compile_preflight"
    curl --fail-with-body --silent --show-error --max-time 30 -X PATCH -H 'Authorization: Bearer owner' -H 'Content-Type: application/json' --data '{"fields":{"name":{"stringValue":"AT04I02B compiler preflight"}}}' "$endpoint" | tee "$logs/$project-compile-seed.json"
    curl --fail-with-body --silent --show-error --max-time 30 -H 'Authorization: Bearer owner' "$endpoint" | tee "$logs/$project-compile-read.json"
    echo "PASS effective compiler preflight $project" | tee -a "$logs/results.txt"
    exit 0 ;;
  critical) run critical-i02 env AT04I02B_MODE=critical RULES_FILE="$RUNNER_TEMP/at04i02b-emulator/firestore.rules" node tests/smoke_at04_i02b_integrity_emulator.js ;;
  red) run red-i02 env AT04I02B_MODE=baseline RULES_FILE="$RUNNER_TEMP/at04i02b-emulator/firestore.rules" node tests/smoke_at04_i02b_integrity_emulator.js ;;
  green)
    run green-i02 env AT04I02B_MODE=candidate RULES_FILE="$RUNNER_TEMP/at04i02b-emulator/firestore.rules" node tests/smoke_at04_i02b_integrity_emulator.js
    run real-i02-resolver node tests/smoke_at04_i02_resolver_emulator.js
    run regression-i01f-at04 env AT04_MODE=candidate RULES_FILE="$RUNNER_TEMP/at04i02b-emulator/firestore.rules" node tests/smoke_at04_i01c_emulator.js
    run D05-resolver node tests/smoke_d05_emulator.js
    run fixture-preflight node tests/helpers/historical-specialist-fixture.js
    run specialists-ui node tests/smoke_specialists_ui.js
    run suprema-ui node tests/smoke_suprema_ui.js ;;
  at03) run AT03-regressions node tests/smoke_at03_i01_emulator.js ;;
  at05) run AT05-regressions node tests/smoke_at05_rules_emulator.js ;;
  *) exit 2 ;;
esac
curl -fsS --max-time 30 "http://127.0.0.1:8080/emulator/v1/projects/$project:ruleCoverage" -o "$logs/$group-coverage.json" || echo "coverage JSON unavailable ($group)" | tee -a "$logs/results.txt"
curl -fsS --max-time 30 "http://127.0.0.1:8080/emulator/v1/projects/$project:ruleCoverage.html" -o "$logs/$group-coverage.html" || echo "coverage HTML unavailable ($group)" | tee -a "$logs/results.txt"
git diff --exit-code HEAD
exit "$failed"
