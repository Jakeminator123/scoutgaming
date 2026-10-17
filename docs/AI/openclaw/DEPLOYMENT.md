# Aktuell drift: Director och OpenClaw Gateway

> Guide flyttad 2026-10-13. Relativa kodsökvägar som `src/`, `deploy/` och
> `config/` i exemplen utgår från `services/openclaw/lab/`. Daterade prov nedan
> är historiska; [aktuell dokumentingång](../README.md) skiljer drift från förslag.

Driftunderlaget gäller `Jakeminator123/scoutgaming` på
`main`. Tjänsterna finns redan på Render och ska
förvaltas där. De äldre anvisningarna för ett separat labbrepo är borttagna.

Den fullständiga variabellistan och rätt placering finns i
[variabelregistret](../../ENVIRONMENT-VARIABLES.md).
Aktuell drift och QA finns i [molnkartan](../../CLOUD-MIGRATION.md).

Kvittot från 29 september är pensionerat. Det namngav Vercel-projekt som inte
länger finns, bland annat `github-work-vercel-entry`, och en Render-revision
som inte är dagens deploy. Kedjan som fortfarande gäller: spelaren skickar en
avgränsad projektion via Director till den privata Gateway. Svaret ska vara
`recordedLine`, `generatedText` eller `silence` och matcha request, dealer,
session och runda. Spelaren äger talkö, idlegrind och uppspelning. Saldo och
utbetalningar förblir serverägda. Matchade miljönamn är inte ett tal-, bild-
eller GPU-prov och inte godkänd läppsynk.

## Tjänster och behörighet

- `croupier-lab-director`: publik HTTPS, eget `LAB_API_TOKEN`, separat
  `OPENCLAW_PRODUCT_SPEECH_TOKEN`, privat upstream
  `croupier-lab-openclaw:18789` och disk `/data/catalog`.
- `croupier-lab-openclaw`: privat Gateway med `OPENCLAW_API_KEY`, annan
  `OPENCLAW_MODEL_API_KEY` och beständig state på `/data/openclaw`.
- `croupier-v2`: produktservern har speech-URL/token och separata
  Director-/Lab-rådpar. Den validerar session, kort, saldo och modellbeslut.
- Vercels frontend följer origin-/ingresskontraktet i variabelregistret.
  `CROUPIER_GAME_URL` är äldre flagga-av-kompatibilitet. Ingen av ovanstående
  OpenClaw-hemligheter behövs där.

Gateway-starten mappar `OPENCLAW_API_KEY` till OpenClaws interna
`OPENCLAW_GATEWAY_PASSWORD`. Dashboard går via Directors `/openclaw/` och
kräver Gateways inloggning och vid behov enhetsgodkännande. Publik proxy
exponerar inte Gateways `/v1`-API. Se [dashboardguiden](DASHBOARD-SV.md).

Beständig `openclaw.json` kan ha operatörsändrade modeller och roller.
Miljöstandarderna initierar ny state men ersätter inte automatiskt
handredigerad konfiguration. Kontrollera effektiv konfiguration före modellbyte.

Kodändringar levereras med `node tools/push-github-work.mjs`; Render-deploy
är en separat åtgärd. Följ [driftordningen](RENDER-START-SV.md) och kontrollera
[produktens speech-kontrakt](PRODUCT-SPEECH-DEPLOYMENT-SV.md) vid rolländringar.
