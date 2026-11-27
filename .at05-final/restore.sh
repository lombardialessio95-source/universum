#!/usr/bin/env bash
set -euo pipefail
src="$GITHUB_WORKSPACE/.at05-final"
work="$RUNNER_TEMP/at05-game"
logs="$RUNNER_TEMP/at05-logs"
mkdir -p "$logs"
exec > >(tee "$logs/reconstruction.log") 2>&1
git worktree add --detach "$work" 7099402d8596d3a179191b8ff2427ac3145df897
cd "$work"
restore() {
  local name="$1" blob="$2" tree="$3" sha="$4"
  test "$(git hash-object "$src/$name.patch")" = "$blob"
  git apply --index "$src/$name.patch"
  test "$(git write-tree)" = "$tree"
  test "$(git hash-object -t commit -w "$src/$name.commit")" = "$sha"
  git reset --hard "$sha"
  echo "PASS exact reconstruction $sha $tree"
}
restore completamento 17009e4cd3188f06ad92a2135b3381c871b52498 d73ffd1c0ba87c5df8e93698b6a8837ded05178b a75ab56c559af87d1b04dda321cfcb344fb492ae
restore rules 2deb52412733c9c398733e2f75c800167dcfb745 f36a2516c1d34208070b87e37d29d8aa25ae65f0 4880f936afd3d2f385b3cbab4c9a70d275562de3
restore prefinale 05fc988572815991211cb78c08246ad7ee952119 2d2fcb783e5b526840bf49b017ffa407977454c7 08942f02f3cbeba0cb7ed32f11bb19aff1226684
test "$(git hash-object tests/smoke_specialists_ui.js)" = 5f69bdf8671e55ec1730e8860e32149fa2a07e16
test "$(git hash-object tests/smoke_suprema_ui.js)" = 9d0c768317a398ce00149bd031f2a2f0d930c783
test "$(git hash-object tests/smoke_d05_emulator.js)" = 88bfad4120ab15788d2d3e98c5a762334d1f2743
test "$(git hash-object firestore.rules)" = 2a668723c9f5d22a1f7a3909b22a4e142562060d
test "$(git hash-object .github/workflows/verify-release.yml)" = dbbabf89f705888b16de50bf24ca7dfba303d379
git diff --exit-code HEAD
git fsck --full
