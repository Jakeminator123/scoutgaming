# Verifierad lokal OpenClaw-anslutning

Den här guiden gäller den isolerade lokala produkt- och labbvägen. Helpern ändrar
inte Gateway, modellleverantör, roller, Control UI eller offline-jämförelsens
konfiguration. Arbetet fortsätter på `jakeminator123/work` i
`C:\Users\jakem\Projects\croupier`. Den gemensamma lokala uppspelningen beskrivs
i [runtime-referensen](../../../docs/LOCAL-PRESENTATION-RUNTIME.md).

## En aktiv miljö efter städningen 2026-09-25

- Spela och chatta: <http://127.0.0.1:4200/?dealer=astrid&presentation=local>.
- Konfigurera och observera samma spelare: <http://127.0.0.1:4201/activity>.
- Behåll dessa två flikar. Händelselogg → Anslut öppnar den kopplade spelfliken
  om ingen sådan redan är ansluten; den befintliga fliken behöver inte laddas om.

De gamla serverparen 4192/4194, 4196/4197 och 4198/4199 stoppades på användarens
begäran. Endast 4200/4201 lyssnade inom intervallet 4192–4201 vid kontrollen,
och båda sidorna svarade HTTP 200. Render-tjänsterna lämnades igång.
Startkommandona nedan behövs först när den befintliga lokala körningen har
stoppats. En ny start skapar en ny isolerad testdatabas och spelsession.

## Aktuell status och tidigare kontroll

Uppföljning 2026-09-25: exakt `113dfd8` är nu driftsatt på Gateway och Director,
och produktens smala `/api/product/speech` är konfigurerad och liveverifierad.
Direkt laptop → privat Gateway saknar fortfarande URL, men behövs inte när
speech-reläet används. OpenAI-provider och modell är oförändrade. Se
[driftkvittot](DEPLOYMENT-RECEIPT-2026-09-25.md).

Den isolerade körningen med `--generated-speech` har dessutom verifierats hela
vägen: länkad labbchatt → autentiserad produktchatt → OpenClaw → ElevenLabs →
RunPod → hashkontrollerat talpaket → labbuppspelning i standardposition.
Ett faktiskt lokalt bord gav svaret 5♦ + K♠ = 15 och dealer 10♠; hålkortet
förblev dolt. Detta bevisar funktion, inte mänskligt godkänd läppsynk.
Idle-rådgivaren har separat verifierat Director-svar med kontextkontrakt v2;
det innebär inte att varje modellförslag leder till ett spelat klipp.

### Historiskt första prov, före speech-driftsättningen

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

När den tidigare körningen är stoppad, starta produkt och labb på sina
separata loopbackportar:

```powershell
node open-claw/lab/deploy/local-connection.mjs --start --product-port 4200 --lab-port 4201
```

Helpern läser de befintliga privata värdena server-side från rotens `.env` och
`lab/.env.local`. Ange aldrig nycklar på kommandoraden. Den skriver inte en ny
env-fil och lägger inte hemligheter i URL:er, webbläsaren eller exempeldata.

Varje körning får en ny katalog under operativsystemets tempområde:

- produktservern får en separat `croupier.db`, `craig.db` och tom
  generationskatalog;
- labbreläet får en separat `LAB_DATA_DIR`;
- båda binder bara `127.0.0.1`;
- direkt Gateway-nyckel finns bara i produktbarnets miljö när speech-relä saknas;
- produktens presentationsadapter och Lab får samma befintliga Director-token
  via separata servervariabler; spelets taladapter behåller sin separata token.
  Web får `CROUPIER_PRESENTATION_DIRECTOR_URL/TOKEN` och samma projektkatalog
  genom `CROUPIER_PRESENTATION_STUDIO_DIR`. Inga av dessa värden går till browsern;
- modellnyckel/providerinställningar är tomma i båda barnen eftersom modellen
  redan ägs av den privata Gatewayen;
- en egen nätvakt tillåter bara de två loopbackportarna och respektive
  konfigurerade upstream-origin;
- Ctrl+C stoppar bara de två skapade barnen och tar bort just den skapade
  tempkatalogen.

Om en direkt Gateway-URL eller separat Director speech-adapter senare läggs till
medan agentmålet är något annat än det exakta `croupier-speech` vägrar helpern
starta den anslutna produkten. En adapterhemlighet vidarebefordras endast till
produktbarnets taladapter; presentationsadaptern använder Directors befintliga
behörighet. Detta skapar ingen ny scoped token eller ändrar modellkonfiguration.

Port 4192 och 4194 avvisas uttryckligen. Helpern ändrar inte
`tools/start-local-comparison.mjs`; offline-jämförelsen behåller sin fulla
externa nätspärr, blockerade env-filer och tomma providerinställningar.

### Valfritt genererat tal och läppsynk i den isolerade körningen

Detta är en explicit preview, inte ett godkännande av läppsynkens visuella
kvalitet. Standardstarten ovan aktiverar inte ElevenLabs eller RunPod, även om
nycklar finns i privata filer eller i den anropande processens miljö.

```powershell
node open-claw/lab/deploy/local-connection.mjs --check --generated-speech
node open-claw/lab/deploy/local-connection.mjs --start --generated-speech --product-port 4200 --lab-port 4201
```

För opt-in behövs befintlig `ELEVENLABS_API_KEY` (alternativt
`ELEVENLABS_OC_API`), `RUNPOD_API_KEY` och en separat
`CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`. Det äldre `RUNPOD_ENDPOINT_ID` används
aldrig som reserv. Saknas något vägrar starten innan barnprocesserna skapas.
`--check` visar enbart närvaro och konfigurationsstatus; inget tal eller GPU-jobb
skapas av kontrollen.

Helpern läser i ordning `.env`, `lab/.env.local` och
`lab/.env.generated-speech.local`; explicita processvärden har högst prioritet.
Den sista filen kan därför innehålla enbart det nya scoped-endpoint-ID:t.
Nycklar behöver inte kopieras dit eller anges på kommandoraden.

Endast opt-in-körningen får server-side talnycklarna och de ytterligare
nätmålen `https://api.elevenlabs.io` och `https://api.runpod.ai`. Produkt och
labb får varsin tom cache under körningens `speech/product` respektive
`speech/lab`, flaggan `CROUPIER_GENERATED_SPEECH=1` och explicit
`CROUPIER_GENERATED_SPEECH_PREVIEW=1`. Cacherna försvinner med testkörningen.
OpenClaws modellnyckel vidarebefordras fortfarande inte, och gränsen mellan
produktens speech-token och labbets Director-token behålls. Generering som
uttryckligen begärs i chatten kan förbruka ElevenLabs-/RunPod-krediter.

Med dagens privata konfiguration använder labbet Director och produktservern
det separata speech-reläet. `--check` är ändå auktoritativt för en ny körning:
en nåbar tjänst utan rätt roll eller credential är inte en fungerande chatt.

Under **Händelselogg → Anslut** öppnas Astrid med lokal presentation. Spela och
chatta direkt i spelfliken. Lab visar **En spelare · Web** och dess kvitton.
Det lokala läget monterar ingen extra Lab-spelare eller bordschatt. Video väntar
på renderad primär-idle; deal får alltid företräde. Vanliga native-eventrepliker
spelas fortfarande från exakt replikfamilj. **Fristående chattprov** och
operatörschatten är inte kopplade till den autentiserade spelaren.

Produktservern behåller kort och spelaridentitet som auktoritet. Konversations-
minnet binds till autentiserad spelare och dealer, högst 12 meddelanden och
8 000 tecken, med 30 dagars inaktivitetsgräns. **Minne** i originalchatten kan
glömma den historiken; pågående svar avbryts. Den temporära QA-databasen raderas
vid Ctrl+C, så dess spelarminne överlever inte en ny helperkörning.

## Talrollen och transportgränsen

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
node --test open-claw/lab/deploy/local-connection.test.mjs
node --test open-claw/lab/test/product-speech.test.mjs
```

Testerna använder endast fixture-hemligheter, lokala HTTP-stubbar, lediga
loopbackportar och nya tempdatabaser. De verifierar credentialseparation,
redigerad statusrapport, tomma providerinställningar, blockerade env-filer och
externa nätmål, avvisade 4192/4194, start/stopp och säker rensning. De gör inga
modell- eller molnanrop.
