#!/usr/bin/env bash
set -euo pipefail
test "${FIRESTORE_EMULATOR_HOST:-}" = '127.0.0.1:8080'
logs="$RUNNER_TEMP/at05-logs"
cd "$RUNNER_TEMP/at05-game"
timeout 120s node "$GITHUB_WORKSPACE/.at05-final/preflight.js" 2>&1 | tee "$logs/preflight.log"
: > "$logs/results.txt"
failed=0
for test in tests/smoke_specialists_ui.js tests/smoke_suprema_ui.js tests/smoke_d05_emulator.js; do
  name="$(basename "$test" .js)"
  set +e
  timeout 240s node "$test" 2>&1 | tee "$logs/$name.log"
  code=${PIPESTATUS[0]}
  set -e
  if [ "$code" -eq 0 ]; then
    echo "PASS $test" | tee -a "$logs/results.txt"
  else
    echo "FAIL $test exit=$code" | tee -a "$logs/results.txt"
    failed=1
  fi
done
git diff --exit-code HEAD
exit "$failed"
