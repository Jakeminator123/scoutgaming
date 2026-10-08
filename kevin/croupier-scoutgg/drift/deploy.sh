#!/usr/bin/env bash
# Skicka upp koden till en server och starta om demot. Körs FRÅN DIN DATOR (Git Bash på Windows fungerar):
#
#   HOST=anvandare@server bash drift/deploy.sh            (första gången: kör sedan drift/installera.sh på servern)
#   HOST=emil@37.27.199.225 SSH_KEY=~/.ssh/nyckel bash drift/deploy.sh
#
# Kopierar paketet (utan node_modules, .git, bin, svar och loggar) till ~/astrid-lipsync-demo-2 på servern,
# installerar beroenden och startar om BARA demot — tunneln (astrid-share2) lämnas i fred, annars byter länken namn.
# .env skickas bara om den inte redan finns på servern — serverns .env är sanningen.
set -euo pipefail
: "${HOST:?sätt HOST=anvandare@server}"
SSH="ssh ${SSH_KEY:+-i $SSH_KEY} -o StrictHostKeyChecking=accept-new $HOST"
cd "$(dirname "$0")/.."

echo "== Kopierar"
tar --exclude=node_modules --exclude=.git --exclude=bin --exclude=answers --exclude=public-url.txt \
    --exclude='*.log' --exclude=.env --exclude='prov-*.png' -cf - . \
  | $SSH 'mkdir -p ~/astrid-lipsync-demo-2 && tar -xf - -C ~/astrid-lipsync-demo-2'

if ! $SSH 'test -f ~/astrid-lipsync-demo-2/.env'; then
  echo "== Ingen .env på servern — skickar den lokala"
  $SSH 'cat > ~/astrid-lipsync-demo-2/.env && chmod 600 ~/astrid-lipsync-demo-2/.env' < .env
fi

echo "== Beroenden och omstart"
$SSH 'cd ~/astrid-lipsync-demo-2 && npm ci --omit=dev --silent && (systemctl --user restart astrid-demo2 2>/dev/null || echo "tjänsten saknas — kör: bash drift/installera.sh") && sleep 3 && systemctl --user is-active astrid-demo2 || true; [ -s public-url.txt ] && echo "länk: $(cat public-url.txt)"'
echo "Klart."
