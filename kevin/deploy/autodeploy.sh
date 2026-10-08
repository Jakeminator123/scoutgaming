#!/bin/bash
# Puts branch kevin's kevin/croupier-scoutgg live on croupier.scoutgg.dev whenever that folder changes.
# launchd runs it every 60 s (install.sh); log: ~/Library/Logs/croupier-autodeploy.log.
# Only the files that changed since the live release travel to scout-hel1. server-release.sh builds the
# release beside the live one, runs the tests and switches when no round is in play. Failures reach Kevin
# as a Mac notification and a Slack DM, once per commit and reason.
set -uo pipefail
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin
DIR=kevin/croupier-scoutgg
HOST=scout-hel1
SRV=/opt/astrid-scout-demo/bin/release-from-github.sh
STATE="$HOME/Library/Application Support/croupier-autodeploy"
CLONE="$STATE/scoutgaming.git"
# precomposeunicode=false: pathspecs reach git byte for byte, whatever form the commit stores names in
GIT=(git -C "$CLONE" -c core.precomposeunicode=false --literal-pathspecs)
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=30 -o ServerAliveCountMax=4)
NEW='' TREE=''
LAST=$(cat "$STATE/last-run" 2>/dev/null || echo 0)
date +%s >"$STATE/last-run"

g() { "${GIT[@]}" "$@"; }
log() { echo "$(date '+%F %T') $*"; }
notify() {
  osascript -e 'on run argv' -e 'display notification (item 1 of argv) with title "croupier.scoutgg.dev"' -e 'end run' \
    "$1" >/dev/null 2>&1
}
alert() {  # once per commit and reason (digits stripped: retries differ only in times and counts)
  local key
  key="${NEW:0:7} $(printf '%s' "$1" | tr -d 0-9)"
  if [ "$(cat "$STATE/alerted" 2>/dev/null)" != "$key" ]; then
    echo "$key" >"$STATE/alerted"
    notify "Deploy failed: $1"
  fi
  [ "$(cat "$STATE/alerted-slack" 2>/dev/null)" = "$key" ] && return
  if printf 'croupier.scoutgg.dev auto-deploy of kevin@%s failed: %s (log: ~/Library/Logs/croupier-autodeploy.log on the Mac)' "${NEW:0:7}" "$1" |
    "${SSH[@]}" -o ClearAllForwardings=yes solvaxelio "bash -lc 'cd /root/scheduled/scout-reports && python3 -c \"
import sys, notify_slack
r = notify_slack.post_kevin(sys.stdin.read())
sys.exit(0 if (r[0] if isinstance(r, tuple) else r) else 1)\"'" >/dev/null 2>&1; then
    echo "$key" >"$STATE/alerted-slack"
  else
    log "Slack alert not delivered, retrying next run"
  fi
}
healthy_exit() { rm -f "$STATE/soft-since" "$STATE/alerted" "$STATE/alerted-slack"; exit 0; }
# $2 = final: this tree is not retried until a new push (or until the failed file is deleted)
fail() {
  log "FAILED: $1"
  [ -n "$TREE" ] && echo "$TREE ${2:-$(date +%s)}" >"$STATE/failed"
  if [ "${2:-}" = final ]; then
    alert "$1 Push a fix, or delete ~/Library/Application Support/croupier-autodeploy/failed to retry."
  else
    alert "$1"
  fi
  exit 1
}
# A condition that may clear by itself (offline, VPN): alert once it has lasted 30 minutes of runs.
# A gap of more than 5 minutes between runs (the Mac slept) restarts the clock.
soft() {
  local f="$STATE/soft-since" now first
  now=$(date +%s)
  first=$(cat "$f" 2>/dev/null)
  if [ -z "$first" ] || [ $((now - LAST)) -gt 300 ]; then first=$now; echo "$first" >"$f"; fi
  log "$1"
  [ $((now - first)) -gt 1800 ] && fail "$1 (for 30 min)"
  exit 0
}

g fetch -q origin +refs/heads/kevin:refs/heads/kevin 2>"$STATE/fetch.err" ||
  soft "cannot fetch branch kevin: $(tail -1 "$STATE/fetch.err")"
NEW=$(g rev-parse refs/heads/kevin)
TREE=$(g rev-parse -q --verify "$NEW:$DIR") || healthy_exit
[ "$(cat "$STATE/deployed" 2>/dev/null)" = "$TREE" ] && healthy_exit
# The same tree failed: wait for a new push, or 15 minutes after a failure that may be transient.
[ -f "$STATE/failed" ] && read -r FTREE FAT <"$STATE/failed" &&
  [ "$FTREE" = "$TREE" ] && { [ "$FAT" = final ] || [ $(($(date +%s) - FAT)) -lt 900 ]; } && exit 0

LIVE=$("${SSH[@]}" $HOST "cat /opt/astrid-scout-demo/current/.github-release 2>/dev/null; true") ||
  soft "scout-hel1 unreachable"
rm -f "$STATE/soft-since"
read -r BASE LIVE_TREE _ <<<"$LIVE"
if [ "${LIVE_TREE:-}" = "$TREE" ]; then echo "$TREE" >"$STATE/deployed"; healthy_exit; fi

REL=gh-${NEW:0:12}
MODE=full
[ -n "${BASE:-}" ] && g cat-file -e "$BASE:$DIR" 2>/dev/null && MODE=diff
log "kevin@${NEW:0:7}: deploying ($MODE${BASE:+ over ${BASE:0:7}})"
STEP=$("${SSH[@]}" $HOST "$SRV prepare $REL $MODE" 2>"$STATE/step.err") ||
  fail "prepare: $(tail -2 "$STATE/step.err" | tr '\n' ' ')"
if [ "$STEP" != built ]; then
  if [ $MODE = diff ]; then
    g diff -z --no-renames --name-only --diff-filter=D --relative="$DIR" "$BASE" "$NEW" |
      "${SSH[@]}" $HOST "$SRV delete $REL" || fail "removing deleted files failed"
    g diff -z --no-renames --name-only --diff-filter=AMT "$BASE" "$NEW" -- "$DIR" >"$STATE/changed"
  else
    g ls-tree -r -z --name-only "$NEW" -- "$DIR" >"$STATE/changed"
  fi
  if [ -s "$STATE/changed" ]; then
    # The clone has no file contents: fetch the changed ones in one request, then send them as one tar.
    # --worktree-attributes keeps git archive from reading (and so downloading) the rest of the tree.
    xargs -0 "${GIT[@]}" ls-tree "$NEW" -- <"$STATE/changed" | awk '$2 == "blob" {print $3}' |
      g -c fetch.negotiationAlgorithm=noop fetch -q origin --no-tags --no-write-fetch-head \
        --recurse-submodules=no --filter=blob:none --stdin || fail "fetching the changed files failed"
    xargs -0 "${GIT[@]}" archive --worktree-attributes --format=tar "$NEW" -- <"$STATE/changed" |
      "${SSH[@]}" $HOST "$SRV extract $REL" || fail "upload to scout-hel1 failed"
  fi
  OUT=$("${SSH[@]}" $HOST "$SRV finish $REL $NEW $TREE" 2>&1)
  case $? in
  0) ;;
  # ssh itself failed (Mac asleep, network drop): the build may well have finished; retry, not final
  255) fail "lost the connection to scout-hel1 during the build: $(echo "$OUT" | tail -1)" ;;
  *) fail "release not built: $(echo "$OUT" | tail -4 | tr '\n' ' ')" final ;;
  esac
fi
OUT=$("${SSH[@]}" $HOST "$SRV switch $REL" 2>&1)
case $? in
0) ;;
75) log "round in play, retrying next minute"; exit 0 ;;
3) fail "$(echo "$OUT" | tail -1)." final ;;
*) fail "switch: $(echo "$OUT" | tail -2 | tr '\n' ' ')" ;;
esac
echo "$TREE" >"$STATE/deployed"
rm -f "$STATE/failed" "$STATE/soft-since" "$STATE/alerted" "$STATE/alerted-slack"
log "kevin@${NEW:0:7} is live"
notify "kevin@${NEW:0:7} is live"
