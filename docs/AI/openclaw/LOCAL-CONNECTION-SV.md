# Lokal OpenClaw-anslutning

> Guide flyttad 2026-10-13. Relativa kodsökvägar som `src/`, `deploy/` och
> `config/` i exemplen utgår från `services/openclaw/lab/`. Daterade prov nedan
> är historiska; [aktuell dokumentingång](../README.md) skiljer drift från förslag.

> **Pensionerad 27 oktober 2026.** Den lokala anslutningshelpern
> `services/openclaw/lab/deploy/local-connection.mjs`, dess sessionsvakt
> `local-session.mjs` och det isolerade native-/Next-paret på SQLite-tempdatabaser
> är borttagna; produkten har en väg (Vercel + Render + Neon + Blob). Isolerade
> prov körs i staging eller CI. Äldre start-, kontroll- och provinstruktioner
> finns i Git-historiken före borttagningen. Kontraktsavsnitten nedan gäller fortsatt.

Guiden gäller `Jakeminator123/scoutgaming`, branch
`main`. `github-work` vidarebefordrar dit.
Se [miljökartan](../../ENVIRONMENT-VARIABLES.md) för filernas placering och
[runtime-referensen](../../LOCAL-PRESENTATION-RUNTIME.md) för spelaren.

## Anslutningskontroll

Kontrollen 29 september (revision `15bd1541` och de dåvarande Vercel-projekten)
är inte dagens drift. Aktuell kedja står i [DEPLOYMENT.md](DEPLOYMENT.md) och
[molnkartan](../../CLOUD-MIGRATION.md). En tom speech-envelope med
giltig produkt-token ska fortfarande ge HTTP 400 innan modellkörning.

Produkten använder `OPENCLAW_PRODUCT_SPEECH_URL` och separat speech-token.
Lokalt Lab använder `LAB_REMOTE_URL` och `LAB_REMOTE_TOKEN`. En direkt publik
Gateway-URL behövs inte för denna väg. `OPENCLAW_API_KEY` hör till privat
Gateway-autentisering; `OPENCLAW_MODEL_API_KEY` används av Gateway mot modellen.

## Version och officiellt kontrakt

[`Dockerfile.gateway`](../../../services/openclaw/lab/deploy/Dockerfile.gateway) låser
`ghcr.io/openclaw/openclaw:2026.9.5` med digest
`sha256:ea298b62be8955d3ef750e2004a610dd90c3a30e5f9886e5d654d78a0c573218`.
Den nåbara Control UI-sidan annonserade själv `2026.9.5` i sina versionsmärkta
assets vid kontrollen. Det matchar imagen och runtimepaketets version. En privat
containershell användes inte, så nästa driftkontroll vid redeploy bör fortfarande
köra `node /app/openclaw.mjs --version` och `config validate --json`.

Den låsta versionens officiella
[HTTP-referens](https://github.com/openclaw/openclaw/blob/v2026.9.5/docs/gateway/openai-http-api.md)
bekräftar att `/v1/chat/completions` ligger på Gateway-porten, kräver Gatewayens
token/lösenord och tolkar `model: openclaw/<agentId>` som ett agentmål. Samma
referens klassar bearer-hemligheten som full operatörsåtkomst och säger att
endpointen ska hållas på loopback, tailnet eller privat ingress. Därför ska den
inte exponeras genom Directors publika dashboardproxy.

Den aktuella dokumentationswebben har i huvudsak samma kontrakt men kan ligga
före deploymenten. Använd alltid taggen `v2026.9.5` för ändringar i den här
Gatewayen. Senaste officiella release var 2026.9.6 vid kontrollen; ingen
uppgradering ingår här.

## Talrollen och transportgränsen

Produktens [`openclaw-chat.mjs`](../../../services/game/openclaw-chat.mjs) begär fortsatt
exakt samma JSON-val mellan `recordedLine`, `generatedText` och `silence`, med
ekade request-, dealer-, session- och rundrevisioner. Den använder nu det
separata `OPENCLAW_SPEECH_AGENT`, vars säkra default är
`openclaw/croupier-speech`; `OPENCLAW_CHAT_AGENT` förblir operatörschatt.

Gatewaykonfigurationen kan additivt skapa `croupier-speech` med egen
workspace/agentDir, samma redan sparade provider/modell, inga fallbackmodeller,
minne eller heartbeat och hård verktygsdeny. Den skriver inte över en
konflikterande befintlig roll. Runtimepaket `2026-09-25.1` injicerar endast det
stängda produktkontraktet.

Eftersom direkt laptop → privat Gateway fortfarande saknar nätväg finns också
en separat `POST /api/product/speech` på Director. Den kräver en egen hemlighet,
skild från labbtoken, validerar kontraktet på båda sidor och
ger inte produktprocessen Gatewayens fulla operatörscredential. Koden finns
och endpointen är aktiverad i den verifierade deploymenten ovan.

Den senare driftsättningen gjordes efter separat uttryckligt godkännande.
Den lokala läppsynk-/idle-integrationen kräver ingen ytterligare Gateway-deploy.
Säkerhetsgräns, rollback och steg-för-steg-plan finns i
[produkt-speech-driftplanen](PRODUCT-SPEECH-DEPLOYMENT-SV.md). Portarna 4192/4194
och den pågående jämförelsen har lämnats orörda.

## Tester

```powershell
node --test services/openclaw/lab/test/product-speech.test.mjs
```

Testerna använder endast fixture-hemligheter, lokala HTTP-stubbar och loopback.
De gör inga modell- eller molnanrop.
