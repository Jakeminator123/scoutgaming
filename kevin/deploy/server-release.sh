#!/bin/bash
# Server half of the croupier.scoutgg.dev auto-deploy; autodeploy.sh on the Mac drives it over ssh.
# install.sh puts it at /opt/astrid-scout-demo/bin/release-from-github.sh on scout-hel1.
#   prepare <rel> diff|full        start releases/<rel>.tmp (diff: hard-linked copy of the live release);
#                                  prints "built" when <rel> is already built
#   delete <rel>                   remove the NUL-separated paths on stdin, relative to the game folder
#   extract <rel>                  unpack the tar on stdin (paths start with kevin/croupier-scoutgg/)
#   finish <rel> <commit> <tree>   install dependencies, run the tests in a sandbox, mark the release built
#   switch <rel>                   wait until no table has a round in play, go live, roll back if unhealthy
#                                  (exit 75: held, try again later; exit 3: rolled back, the release is deleted)
# The copy shares inodes with the live release: tar unlinks a file before writing it, the tests see a
# read-only tree, and nothing else writes in place. Pushed code is untrusted: it never runs as root.
set -euo pipefail
APP=/opt/astrid-scout-demo
LIVE=/var/lib/astrid-scout-demo
REL=${2:?release}
case $REL in gh-[0-9a-f]*) ;; *) echo "bad release name: $REL" >&2; exit 2 ;; esac
R=$APP/releases/$REL
T=$R.tmp
exec 9>/run/lock/astrid-autodeploy.lock
flock -w 900 9

# Tables with someone seated and a round past betting; prints the count (read-only).
busy_tables() {
  python3 - <<'PY'
import json, sqlite3
db = sqlite3.connect('file:/var/lib/astrid-scout-demo/data/demo.sqlite?mode=ro', uri=True, timeout=5)
rooms = [json.loads(state) for (state,) in db.execute('SELECT state FROM shared_rooms')]
print(sum(1 for r in rooms if any(r.get('owners') or []) and r.get('phase') not in ('bets', 'settled')))
PY
}
healthy() {
  systemctl is-active -q astrid-scout-demo &&
    curl -sf -m 5 http://127.0.0.1:8620/api/health | grep -q '"ok":true' &&
    curl -sf -m 5 -o /dev/null http://127.0.0.1:8620/dealers.js &&
    table_ok
}
# The table answers its state; with the strict demo gate on (DEMO_GATE_STRICT=1 in the env file, Kevin o1792873491724) an
# unsigned request is answered 401 "Enter the demo password first" by design, and that answer is the healthy one then.
table_ok() {
  local out code
  out=$(curl -s -m 5 -w '\n%{http_code}' -X POST http://127.0.0.1:8620/api/table -H 'content-type: application/json' \
    -H 'Origin: http://127.0.0.1:8620' -d '{"session":"astrid","op":"state"}') || return 1
  code=${out##*$'\n'}
  if grep -q '^DEMO_GATE_STRICT=1$' /etc/astrid-scout-demo.env 2>/dev/null; then
    [ "$code" = 401 ] && grep -q 'Enter the demo password first' <<<"$out"
  else
    [ "$code" = 200 ] && grep -q '"phase"' <<<"$out"
  fi
}
# Five healthy probes in a row, 2 s apart, from the same process: a crash loop cannot pass.
stable() {
  local ok=0 pid
  pid=$(systemctl show -p MainPID --value astrid-scout-demo)
  for _ in $(seq 20); do
    sleep 2
    if healthy && [ "$(systemctl show -p MainPID --value astrid-scout-demo)" = "$pid" ]; then
      ok=$((ok + 1))
    else
      ok=0
      pid=$(systemctl show -p MainPID --value astrid-scout-demo)
    fi
    [ $ok -ge 5 ] && return 0
  done
  return 1
}
go_live() { ln -sfn "$1" $APP/current.new && mv -T $APP/current.new $APP/current && systemctl restart astrid-scout-demo; }

case $1 in
prepare)
  if [ -f "$R/.github-release" ]; then echo built; exit 0; fi
  rm -rf "$T" "$R"
  find $APP/releases -maxdepth 1 -name 'gh-*.tmp' -mmin +120 -exec rm -rf {} +
  if [ "$3" = diff ]; then
    cp -al "$(readlink -f $APP/current)/." "$T"
    # rm -rf on a symlink removes the link only: delete and extract can no longer reach live player data
    rm -rf "$T/.github-release" "$T/data" "$T/answers"
  else
    mkdir -p "$T"
  fi
  echo started ;;
delete)
  root=$(readlink -f "$T")
  while IFS= read -r -d '' p; do
    case "/$p/" in //|*/../*|/data/*|/answers/*) continue ;; esac
    parent=$(readlink -f -- "$(dirname -- "$T/$p")") || continue
    case "$parent/" in "$root"/*) rm -f -- "$T/$p" ;; esac
  done ;;
extract)
  tar -x -i --no-same-owner --strip-components=2 -C "$T" ;;
finish)
  cd "$T"
  live=$(readlink -f $APP/current)
  if [ ! -d node_modules ] || ! cmp -s package.json "$live/package.json" || ! cmp -s package-lock.json "$live/package-lock.json"; then
    rm -rf node_modules
    timeout 600 npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null
  fi
  # The tests run as the service user: read-only tree, scratch data/answers, no live data, env file or homes.
  rm -rf data answers
  mkdir data answers
  chown astrid-scout: data answers
  if ! out=$(systemd-run --quiet --wait --pipe --collect -p User=astrid-scout -p Group=astrid-scout \
    -p WorkingDirectory="$T" -p ProtectSystem=strict -p ProtectHome=yes -p PrivateTmp=yes -p NoNewPrivileges=yes \
    -p "InaccessiblePaths=$LIVE /etc/astrid-scout-demo.env" -p "ReadWritePaths=$T/data $T/answers" \
    -p RuntimeMaxSec=900 /usr/bin/node --test --test-force-exit test/*.test.mjs 2>&1); then
    { echo "$out" | grep -E '^not ok|^ℹ (pass|fail)' || echo "$out" | tail -5; } | tail -8 >&2 || true
    echo "tests failed" >&2
    exit 1
  fi
  rm -rf data answers
  ln -s $LIVE/data data
  ln -s $LIVE/answers answers
  printf '%s %s %s\n' "$3" "$4" "$(date -u +%FT%TZ)" >.github-release
  mv -T "$T" "$R"
  echo built ;;
switch)
  [ -f "$R/.github-release" ] || { echo "release $REL is not built" >&2; exit 1; }
  prev=$(readlink -f $APP/current)
  if [ "$prev" = "$R" ]; then echo live; exit 0; fi
  idle=0
  for _ in $(seq 40); do
    if ! systemctl is-active -q astrid-scout-demo || [ "$(busy_tables 2>/dev/null || echo 1)" = 0 ]; then idle=1; break; fi
    sleep 15
  done
  [ $idle = 1 ] || { echo "round in play, held" >&2; exit 75; }
  go_live "$R"
  if ! stable; then
    go_live "$prev"
    rm -rf -- "$R"
    if stable; then
      echo "unhealthy after the switch, rolled back to $(basename "$prev")" >&2
    else
      echo "unhealthy after the switch, and $(basename "$prev") is not healthy after the rollback either" >&2
    fi
    exit 3
  fi
  # keep the three newest GitHub releases and the one live before; hand-made releases are left alone
  ls -1dt $APP/releases/gh-* | grep -v '\.tmp$' | tail -n +4 | while read -r old; do
    [ "$old" = "$R" ] || [ "$old" = "$prev" ] || rm -rf -- "$old"
  done || true
  echo live ;;
*)
  echo "usage: $0 prepare|delete|extract|finish|switch <release> ..." >&2
  exit 2 ;;
esac
