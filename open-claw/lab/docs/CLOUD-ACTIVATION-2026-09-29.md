# Verifierad OpenClaw- och Vercel-konfiguration — 2026-09-29

Denna aktuella kontroll ersätter de borttagna driftkvittona från den
25 och 28 september och äldre instruktioner för det separata Lab-upplägget.
Kontrollen gjordes mot Render Dashboard, Vercels autentiserade CLI/API och
den lokala anslutningshelpern. Hemligheter jämfördes endast i minnet.

## Render: kontrollerat i tjänsternas riktiga Environment-vyer

Director `croupier-lab-director` och privat Gateway `croupier-lab-openclaw`
visade Live från `Jakeminator123/github-work`, branch
`jakemanator123-github-work`, revision `15bd1541`.

- Directors tolv env-namn och icke-hemliga värden stämmer med
  `open-claw/lab/render.yaml`: host, port, datakatalog, tre agentroller,
  dashboardflagga, 8000 ms timeout och privat Gateway-adress.
- `OPENCLAWAPI_KEY` är satt på båda tjänsterna och värdena är exakt lika.
  Gateways `OPENCLAW_MODEL_API_KEY` är satt och skiljer sig från Gateway-nyckeln.
- Gateway har `/data/openclaw/openclaw.json`, `/data/openclaw`, port 18789,
  `openai-responses`, `https://api.openai.com/v1`, `gpt-5.4-mini` och
  `CROUPIER_SPEECH_VISION=1`. Dashboard-origin är exakt
  `https://croupier-lab-director.onrender.com`, utan escape-tecken eller path.
- Director har produkt-speech-token skild från `LAB_API_TOKEN` och agenten
  `openclaw/croupier-speech`.
- Spelets `OPENCLAW_PRODUCT_SPEECH_TOKEN` matchar Directors produkt-token.
  Spelets `LAB_REMOTE_TOKEN` och `CROUPIER_PRESENTATION_DIRECTOR_TOKEN`
  matchar Directors `LAB_API_TOKEN`. Alla tre URL-par pekar på Directors
  rena HTTPS-origin.

Ingen Render-env behövde rättas, ingen ny nyckel skapades och ingen Render-
redeploy gjordes i denna kontroll. Vercels startsida behöver ingen av dessa
nycklar. Gateway är platsen för modellnyckeln.

## Verifiering utan modellanrop

`node open-claw/lab/deploy/local-connection.mjs --check` med fungerande
nätåtkomst gav Director health 200 och autentiserad API-status 200.
Rotens lokala Lab-token fungerar alltså mot nuvarande Render-Director.
Ett `POST {}` till `/api/product/speech` med den lokala speech-tokenen gav
400 `invalid_product_speech_envelope`: token accepterades, och tomt schema
stoppades före modellkörning. Inga modell-, tal- eller GPU-anrop gjordes.

Den tidigare observationen `unreachable` kom från en kontroll utan fungerande
nätåtkomst och ska inte användas som belägg för ett Render-fel.

## Vercel: faktiska env-namn och rättningar

- `croupier-frontend`: `CROUPIER_GAME_URL` fanns redan för Production/Preview.
  Den publika Next-startsidan använder den serverägda Render-spelvägen.
- `github-work-vercel-entry`: det gamla `CROUPIER_GAME_ORIGIN` fanns, men
  publicerad Next-kod läser `CROUPIER_GAME_URL`. Den senare variabeln lades
  till för Production/Preview med
  `https://croupier-v2.onrender.com/blackjack?dealer=astrid`.
- `croupier-landing-preview-qa`: saknade sparade projekt-env. Nu finns
  `CROUPIER_GAME_URL` för Production/Preview/Development med den verifierade
  QA-spelpreviewns `/frontend-preview/blackjack/`-adress. Den separata
  Render-QA-backenden är fortsatt pausad.
- Båda nya URL-värdena återlästes via `/v1/projects/:id/env/:envId` och
  jämfördes exakt med avsett värde. De gäller kommande byggen; inga nya
  Vercel-deployer gjordes av env-kontrollen.
- `croupier-player-preview-qa`: `BLOB_READ_WRITE_TOKEN` finns för Production,
  Preview och Development. Zon-Neons `CROUPIER_ZONES_*` finns för Preview
  och Development. De kopplades inte till OpenClaw-tjänsterna.

## Vad miljökontrollen inte bevisar

Spelservern hämtar autentiserad spelkontext och skickar en begränsad projektion
via Director till privat Gateway. Svaret ska vara `recordedLine`,
`generatedText` eller `silence` och matcha request/dealer/session/runda.
Spelaren äger talkö, idlegrind och uppspelning. Saldo och utbetalningar förblir
serverägda. Env-matchning bevisar inte ett fullständigt tal-/bild-/GPU-prov
eller godkänd läppsynk. Det kräver syntetiskt end-to-end-prov med explicit
kostnadsram och faktisk ljud-/videogranskning.

Se [miljökartan](../../../_ENVIROMENT-INFO.md),
[speech-kontraktet](PRODUCT-SPEECH-DEPLOYMENT-SV.md),
[medieguiden](../../../docs/LOCAL-PRESENTATION-RUNTIME.md) och
[game-Neon-planen](../../../docs/CLOUD-MIGRATION.md).
