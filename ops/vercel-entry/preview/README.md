# Isolerad Vercel Preview för spelarfronten

Detta är en **separat, tillfällig Vercel-projektrot** (`ops/vercel-entry/preview`),
inte konfigurationen för befintliga Production-projektet
`github-work-vercel-entry`. Den incheckade
[`vercel.template.json`](vercel.template.json) innehåller bara en **ogiltig
platshållare** och kan inte proxyansluta till den riktiga databasen. På en
separat, isolerad testbackend med annan hostname och databas kör operatören
`node prepare.mjs --isolated-backend https://EXAKT-TESTORIGIN` i denna katalog.
Det skapar en Git-ignorerad `vercel.json` med exakta rewrites. Den kända
Production-originen `https://croupier-v2.onrender.com` avvisas uttryckligen.
Sätt `CROUPIER_GAME_ORIGIN` till exakt testbackend-origin i det tillfälliga
projektets Preview-miljö; bygget avbryts om värdena skiljer sig. Byggkommandot
`node build.mjs` här anropar
`build({ frontendPreview: true })` från
`apps/croupier-frontend/tools/player-ui-build.mjs`, samma opt-in som
`node apps/croupier-frontend/tools/player-ui-build.mjs --frontend-preview`,
men med egen `dist/`.
Ingen Production-konfiguration, Production-länk eller branch byts.
Den isolerade Web-processen behöver spelarregistrering aktiverad och en
separat datakatalog; ingen verklig användardatabas får användas. Dess
`CROUPIER_VERCEL_FRONTEND_ORIGIN` måste senare sättas till **exakt** den
tillfälliga Preview-adressen, inte `*.vercel.app`.

För ett framtida ad hoc-prov: skapa först den isolerade backenden, materialisera
dess konfiguration enligt ovan och länka denna rot till ett **annat** tillfälligt
Vercel-projekt, slå på *Include source files outside Root Directory* för
delade `web/public`- och `presentation-runtime`-filer, och gör endast en
icke-Production Preview-deployment med CLI från denna rot. Använd inte
`--prod`, länka inte till `github-work-vercel-entry`, och skapa ingen ny
Git-branch för provet. Öppna sedan
`/frontend-preview/blackjack/` på Preview-adressen. Detta har **inte**
driftsatts eller verifierats på Vercel ännu. Lokalt:
`node --test ops/vercel-entry/test/build-preview.mjs ops/vercel-entry/test/preview-routes.mjs`
från reporoten. `preview-only.css` döljer dealerväljaren, vars andra
dealer-/V2-/casino-rutter inte ingår. Spelets ingångsvakt styr även direkta
besök och ändrade frågeparametrar till `?dealer=astrid&presentation=local`.

## Exakta proxyvägar

Alla destinationsvägar behåller samma pathname på den isolerade backenden. Konfigurationen
använder inga generella `/api/*`, `/bo/*`, `/studio/*` eller `/lab/*`-rewrites.

| Grupp | Vägar i Preview |
| --- | --- |
| Inloggning/session | `/api/auth/session`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/player/login`, `/api/auth/player/register` |
| Serverägt spel och demopengar | `/api/player`, `/api/table`, `/api/deposit`, `/api/balance`, `/api/currency` |
| Astrid lokal presentation | `/api/presentation/config`, `/api/presentation/select`, `/api/presentation/idle-advice`, `/api/presentation/videos/:id` |
| Chatt/probe/kamera | `/chat`, två exakta `/api/chat/memory`-vägar, fem exakta `/api/probe`-vägar och två `/api/astrid`-vägar |
| Läsbar spelkonfiguration | Endast `/api/bo/config`: Web tillåter denna anonyma GET för spelets tier/clip-val; inga skyddade BO-vägar proxyas |
| Pilotmedia | Fyra exakta `/assets/*.png`, Astrids scen/bord/poster/cues/room och `audio/en/bank.json` för inspelad repliktext, tre ytterligare dealerporträtt som UI laddar, samt `scene.jpg`, `dealer-fallback.png`, `sfx/ambience.mp3`, `dealer/supervisor.webm` |

Denna lista är avsiktligt för `?dealer=astrid&presentation=local`. Den
kopierade klienten kan ännu innehålla andra dealer-/QA-funktioner; `/review/*`,
andra dealerströmmar, genererade talartefakter och `/casino.html` får ingen
proxy här. `web/public/app.mjs` läser dessutom den offentliga
`/api/bo/config`, därför finns just det GET-undantaget med, men ingen
BO-inloggning, BO-roll eller BO-HTML.

## Stoppvillkor före spelprov och cutover

- Den lokala, ännu ej driftsatta Web-ändringen kan godta **exakt** Vercel
  Preview-origin för spelar-POST när den uttryckligen konfigureras. Observera
  verkligt `Host`, `Origin`,
  `Sec-Fetch-Site`, `Set-Cookie` (HttpOnly/SameSite), `Location` och
  `Cache-Control` genom Vercels rewrite. Konfigurationstester här kan inte
  bevisa hur Vercels proxy vidarebefordrar dem.
- Videoregistret har en separat same-origin-kontroll. En lokal, ännu ej
  driftsatt opt-in-ändring kan godta samma exakta Preview-origin även för
  video-GET; det kräver rätt backend-konfiguration och verifiering av
  vidarebefordrade headers. Mät 200/206/416, `Range`, `Content-Range`,
  `Content-Length`, `ETag` och återvalidering över Vercel innan klipp godkänns.
  Registret hashar filen även före Range-svar, så första bildens latens måste
  mätas.
- `/chat` kan strömma NDJSON. [Vercels externa rewrite har 120 sekunders
  timeout](https://vercel.com/docs/limits#proxied-request-timeout); mät
  streaming, avbrott och fel. Labs SSE `/api/v1/events` och WebSocket
  `/speech-stream`/`/lipsync-worker` är **inte** proxyade eller godkända.
  Förinspelad Astrid ska provas utan att anta att genererat realtidstal
  fungerar.
- Gör en isolerad inloggning, omladdning mitt i runda, demoutbetalning och
  två följande Astrid-uppspelningar. Verifiera dessutom att okända/encoded
  vägar, `/api/bo/*` utom config, `/bo`, `/studio`, `/lab` och `/__cloud/*`
  inte når Render via Preview. Därefter, och först därefter, kan en separat
  migrationsfas föreslå ändring av den befintliga Vercel-adressen.

Vercels [externa rewrites](https://vercel.com/docs/routing/rewrites) bevarar
browserns synliga adress, men detta är ännu bara en konfiguration och ett
lokalt byggtest. Ingen Preview-deploy eller DNS-ändring är gjord.
