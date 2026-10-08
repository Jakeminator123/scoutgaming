#!/bin/bash
# Installs the croupier.scoutgg.dev auto-deploy: server-release.sh on scout-hel1, autodeploy.sh on this Mac
# as a launchd job every 60 s, with its own blob-less clone of branch kevin (outside ~/Desktop, which
# launchd jobs may not read). Run it again after changing either script.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
STATE="$HOME/Library/Application Support/croupier-autodeploy"
LABEL=dev.scoutgg.croupier-autodeploy
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
HELPER='!f() { echo username=x-access-token; echo password=$(/opt/homebrew/bin/gh auth token --user invoicesolv); }; f'

# Replaced atomically: a release step that is running keeps reading the old file.
F=/opt/astrid-scout-demo/bin/release-from-github.sh
ssh scout-hel1 "mkdir -p /opt/astrid-scout-demo/bin && cat >$F.new && chmod 755 $F.new && mv -f $F.new $F" <"$HERE/server-release.sh"

mkdir -p "$STATE" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
install -m 755 "$HERE/autodeploy.sh" "$STATE/autodeploy.sh"
# A fresh blob-less clone every install: it holds only commits and trees (a few MB); file contents are
# fetched per deploy, for the changed files only.
rm -rf "$STATE/scoutgaming.git.new"
git -c credential.helper= -c "credential.helper=$HELPER" clone -q --bare --filter=blob:none --single-branch \
  --branch kevin https://github.com/Jakeminator123/scoutgaming.git "$STATE/scoutgaming.git.new"
git -C "$STATE/scoutgaming.git.new" config credential.helper ''
git -C "$STATE/scoutgaming.git.new" config --add credential.helper "$HELPER"
rm -rf "$STATE/scoutgaming.git"
mv "$STATE/scoutgaming.git.new" "$STATE/scoutgaming.git"
# First install: the live release was deployed by hand from the commit that added the folder. Mark it so,
# with a placeholder tree, and the first run redeploys it through the pipeline with no files to send.
ADDED=$(git -C "$STATE/scoutgaming.git" log --format=%H --diff-filter=A -1 kevin -- kevin/croupier-scoutgg/package.json)
ssh scout-hel1 "C=\$(readlink -f /opt/astrid-scout-demo/current); [ -f \$C/.github-release ] ||
  echo '$ADDED 0000000000000000000000000000000000000000 hand-deployed' >\$C/.github-release"

cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$STATE/autodeploy.sh</string></array>
  <key>StartInterval</key><integer>60</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/croupier-autodeploy.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/croupier-autodeploy.log</string>
</dict>
</plist>
EOF
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "installed: pushes to kevin that change kevin/croupier-scoutgg go live on croupier.scoutgg.dev"
