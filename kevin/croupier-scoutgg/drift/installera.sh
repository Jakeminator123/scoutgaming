#!/usr/bin/env bash
# Engångsinstallation PÅ SERVERN (Linux, som vanlig användare — ingen sudo krävs förutom linger, se nedan):
#
#   cd ~/astrid-lipsync-demo-2 && bash drift/installera.sh
#
# Gör: kontrollerar Node ≥ 22, installerar beroenden, hämtar cloudflared till bin/, lägger in
# användartjänsterna astrid-demo2 (+ astrid-share2 om ingen SESSION_URL finns) och startar dem.
# Idempotent — går att köra igen.
set -euo pipefail
APP="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP"

echo "== Node"
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' \
  || { echo "Node ≥ 22 krävs (node --version: $(node --version 2>/dev/null || echo saknas))"; exit 1; }

echo "== Beroenden"
npm ci --omit=dev --silent

echo "== .env"
[ -f .env ] || { echo "Ingen .env — kopiera .env.example till .env och fyll i nycklarna först."; exit 1; }
chmod 600 .env

if ! grep -q '^SESSION_URL=.' .env; then
  echo "== cloudflared (ingen SESSION_URL — publik länk via tunnel)"
  mkdir -p bin
  if [ ! -x bin/cloudflared ]; then
    curl -fsSL -o bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
    chmod +x bin/cloudflared
  fi
fi

echo "== Tjänster (systemd --user)"
mkdir -p ~/.config/systemd/user
install -m 644 drift/astrid-demo2.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now astrid-demo2
if ! grep -q '^SESSION_URL=.' .env; then
  install -m 644 drift/astrid-share2.service ~/.config/systemd/user/
  systemctl --user daemon-reload
  systemctl --user enable --now astrid-share2
fi

# Utan linger stoppas användartjänsterna när användaren loggar ut. Kräver sudo EN gång (eller admin):
loginctl show-user "$USER" -p Linger | grep -q yes \
  || echo "OBS: kör 'sudo loginctl enable-linger $USER' (en gång) så att demot överlever utloggning."

sleep 4
systemctl --user --no-pager status astrid-demo2 | head -5
[ -s public-url.txt ] && echo "länk: $(cat public-url.txt)"
echo "Klart."
