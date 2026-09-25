# Verifierad lokal OpenClaw-anslutning

Den här guiden gäller den isolerade lokala produkt- och labbvägen. Den ändrar
inte Gateway, modellleverantör, roller, Control UI eller den befintliga
offline-jämförelsen. Kontrollen nedan gjordes 2026-09-25 på
`jakeminator123/work` utan att stoppa de delade portarna 4192/4194.

## Tre olika kontrollnivåer

| Väg | Konfigurerad | Nåbar | Funktionellt prov |
| --- | --- | --- | --- |
| Lokal produktserver → OpenClaw Gateway | **Nej.** Privat `.env` har gatewaynyckeln, men saknar `OPENCLAW_BASE_URL`. Nyckeln ensam anger ingen säker nätväg. | Inte provbar utan mål-URL. Den publika `/openclaw/`-proxyn spärrar avsiktligt `/v1` och ska inte användas som genväg. | Inte kört. Koden kräver nu det separata agentmålet `openclaw/croupier-speech`; rollen och den smala Director-adaptern är lokalt implementerade men inte driftsatta. |
| Lokalt labb → Render Director | **Ja.** `LAB_REMOTE_URL` och `LAB_REMOTE_TOKEN` finns i privat rotkonfiguration. | **Ja.** `GET /healthz` gav HTTP 200. Autentiserat `GET /api/status` gav HTTP 200. | **Ja.** Ett enda manuellt `/api/studio/chat`-prov gav HTTP 200, `provider.status=responded` och samma syntetiska conversation-id. Modellen svarade att detta var operatörslabbet och att kortexemplen var syntetiska, inte verifierad drift. |

Modellprovet använde bara katalogens syntetiska kortexempel och visningsnamnet
`OpenClaw Lokalprov`. Ingen riktig spelare, plånbok, databas eller dold kortdata
användes. Provet gick laptop → Director → privat Gateway → befintlig OpenAI-provider.
Det bevisar den vägen vid provtillfället, inte produktens separata talbeslut.

Gatewaylösenord och modellnyckel är skilda uppgifter. Den privata
konfigurationen innehöll båda, de var olika, och inga värden skrevs ut.
`OPENCLAWAPI_KEY` autentiserar Director/produktklienten mot Gateway;
`OPENCLAW_MODEL_API_KEY` används bara av den privata Gatewayen mot OpenAI.

## Version och officiellt kontrakt

[`Dockerfile.gateway`](../deploy/Dockerfile.gateway) låser
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

## Isolerad start

Först en läsande kontroll, utan modellkörning:

```powershell
node open-claw/lab/deploy/local-connection.mjs --check
```

Starta därefter två nya loopbackprocesser på portar som inte delas med
Eventstudion:

```powershell
node open-claw/lab/deploy/local-connection.mjs --start --product-port 4196 --lab-port 4197
```

Helpern läser de befintliga privata värdena server-side från rotens `.env` och
`lab/.env.local`. Ange aldrig nycklar på kommandoraden. Den skriver inte en ny
env-fil och lägger inte hemligheter i URL:er, webbläsaren eller exempeldata.

Varje körning får en ny katalog under operativsystemets tempområde:

- produktservern får en separat `croupier.db`, `craig.db` och tom
  generationskatalog;
- labbreläet får en separat `LAB_DATA_DIR`;
- båda binder bara `127.0.0.1`;
- gatewaynyckeln finns bara i produktbarnets miljö och Director-token bara i
  labbbarnets miljö;
- modellnyckel/providerinställningar är tomma i båda barnen eftersom modellen
  redan ägs av den privata Gatewayen;
- en egen nätvakt tillåter bara de två loopbackportarna och respektive
  konfigurerade upstream-origin;
- Ctrl+C stoppar bara de två skapade barnen och tar bort just den skapade
  tempkatalogen.

Om en direkt Gateway-URL eller separat Director speech-adapter senare läggs till
medan agentmålet är något annat än det exakta `croupier-speech` vägrar helpern
starta den anslutna produkten. En adapterhemlighet vidarebefordras endast till
produktbarnet; labbtoken och Gatewayhemlighet hålls fortsatt separata.

Port 4192 och 4194 avvisas uttryckligen. Helpern ändrar inte
`tools/start-local-comparison.mjs`; offline-jämförelsen behåller sin fulla
externa nätspärr, blockerade env-filer och tomma providerinställningar.

Med dagens privata konfiguration startar det isolerade labbreläet anslutet till
Director. Produktservern startar med en egen databas, men dess OpenClaw-chat är
fortfarande blockerad eftersom `OPENCLAW_BASE_URL` saknas. Detta visas tydligt i
startutskriften; en fungerande labbanslutning får inte beskrivas som en fungerande
produktanslutning.

## Kontraktskonflikten är lokalt löst, drift återstår

Produktens [`openclaw-chat.mjs`](../../../web/openclaw-chat.mjs) begär fortsatt
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
skild från labbtoken och Gatewaynyckel, validerar kontraktet på båda sidor och
ger inte produktprocessen Gatewayens fulla operatörscredential. Koden finns
lokalt men endpointen är avstängd tills hemligheten uttryckligen konfigureras.

Ingen roll, nyckel, Render-inställning, körande process eller Gateway ändrades i
denna uppgift. Säkerhetsgräns, rollback och steg-för-steg-plan finns i
[produkt-speech-driftplanen](PRODUCT-SPEECH-DEPLOYMENT-SV.md). Portarna 4192/4194
och den pågående jämförelsen har lämnats orörda.

## Tester

```powershell
node --test open-claw/lab/deploy/local-connection.test.mjs
node --test open-claw/lab/test/product-speech.test.mjs
```

Testerna använder endast fixture-hemligheter, lokala HTTP-stubbar, lediga
loopbackportar och nya tempdatabaser. De verifierar credentialseparation,
redigerad statusrapport, tomma providerinställningar, blockerade env-filer och
externa nätmål, avvisade 4192/4194, start/stopp och säker rensning. De gör inga
modell- eller molnanrop.
