# Produktchatten: separat OpenClaw-roll och privat transport

> Guide flyttad 2026-10-13. Relativa kodsökvägar som `src/`, `deploy/` och
> `config/` i exemplen utgår från `services/openclaw/lab/`. Daterade prov nedan
> är historiska; [aktuell dokumentingång](../README.md) skiljer drift från förslag.

Kodkontraktet nedan är det som gäller. Driftkvittot från 29 september är
inte dagens revision. Se [driften](DEPLOYMENT.md) och
[molnkartan](../../CLOUD-MIGRATION.md).
Konfigurationen är inte ensam bevis för ett färdigt tal-/bild-/GPU-flöde
eller godkänd läppsynk.

## Låst kontrakt

Gateway-imagen är fortsatt OpenClaw `2026.9.5` med befintlig digest i
`deploy/Dockerfile.gateway`. Den nya agentposten använder bara fält som finns i
den taggade versionens strikta schema: separat `workspace`, `agentDir`, befintlig
`model.primary`, tom `fallbacks`, tom `skills`, avstängd minnessökning och
heartbeat samt `tools.profile=minimal`, `tools.deny=["*"]` och avstängd
elevated. Se den taggade
[AgentEntry-källan](https://github.com/openclaw/openclaw/blob/v2026.9.5/src/config/zod-schema.agent-runtime.ts)
och [agents-schemat](https://github.com/openclaw/openclaw/blob/v2026.9.5/src/config/zod-schema.agents.ts).

Den taggade
[HTTP-referensen](https://github.com/openclaw/openclaw/blob/v2026.9.5/docs/gateway/openai-http-api.md)
bekräftar `model: openclaw/<agentId>`, `tool_choice: "none"` och
`max_completion_tokens`. Den säger också att Gatewayens delade bearer-hemlighet
ger full operatörsåtkomst och att `/v1` ska hållas på loopback, tailnet eller
privat ingress. Därför får Directors publika `/openclaw/`-proxy fortsatt inte
vidarebefordra `/v1`.

## Roller och dataflöde

`croupier-chat` förblir labboperatörens fria samtalsroll. Den återanvänds inte
och dess innebörd ändras inte. Den nya `croupier-speech` har egen workspace och
agent state, samma redan sparade OpenAI-provider/modell som `croupier-chat`,
inga fallbackmodeller och inga verktyg.

Produktservern skapar först sin befintliga allowlistprojektion. Endast detta går
vidare: request-id, dealer-id, session- och rundrevision, säkert displayName,
publicerade event, synliga kort/totaler, box-/handindex samt sluten talpolicy.
Spelar-id, cookie, wallet, framtida shoe, burn och dolt hålkort ingår inte. Flera
boxar/händer bevaras utan att en identitetslänk uppfinns.

Svaret måste vara exakt ett av `recordedLine`, `generatedText` eller `silence`
och eka alla fyra revisions-/identitetsfält. Både Director-adaptern och
produktservern validerar svaret. Produktens befintliga posegrind håller sedan
chattrad och tal till en verkligt presenterad `standard-idle` och använder den
enda befintliga talkön. OpenClaw kan inte ange timing, `playNow`, media, animation
eller köordning. En väntande chattrespons läggs inte i kön före idle och kan
därför inte blockera deal/hit/double/dealer draw.

## Avsedd privata transport

Direkt laptop → privat Gateway är inte konfigurerad: lokal privat miljö saknar
`OPENCLAW_BASE_URL`, och Gatewayens publika Control UI-yta är inte en tillåten
genväg. Den förberedda vägen är därför:

```text
lokal produktserver
  -- HTTPS + separat produkt-speech bearer --> Director /api/product/speech
  -- privat Render-nät + Gateway-hemlighet --> Gateway /v1/chat/completions
  -- agentmål -----------------------------> openclaw/croupier-speech
```

Director-endpointen accepterar bara `POST application/json`, högst 256 KiB, och
det fulla validerade produktkontraktet. Den har processlokal deduplicering på
request-id, konfliktkontroll på ändrat innehåll, högst två samtidiga modellval,
server-timeout och samma maximala svarsstorlek. Produkt-speech-hemligheten måste
vara skild från `LAB_API_TOKEN`; koden vägrar att använda samma värde. Den
hemligheten godkänns inte på `/api/status`, katalog-, studio-, social- eller
operatörsendpoints. Director använder därefter sin befintliga privata
`OPENCLAW_API_KEY`; produktprocessen behöver och ska inte få Gatewayhemligheten.

Säkerhetsgränsen är avsiktligt smal men inte en identitetsleverantör: den
separata bearern autentiserar en betrodd produktprocess, inte en individuell
spelare. Webbläsaren får aldrig hemligheten och får inte anropa adaptern direkt.
TLS termineras på Director. Serverauktoritativ session/revision och den stängda
projektionen är fortfarande det som hindrar en klient från att byta spelare,
dealer, kort eller talpolicy. Processlokal deduplicering begränsar dubbla
modellutgifter inom en Director-process; produktens posegrind svarar för
exakt-en-gång-visning/tal även vid upprepade HTTP-svar.

## Exakt driftplan efter godkännande

### Två lokala klienter, två olika kontrakt

Den riktiga Next-Eventstudion i rotens `lab/` ska fortsatt använda sin befintliga
server-side `LAB_REMOTE_URL` + `LAB_REMOTE_TOKEN` mot
`/api/studio/advice`, `/api/studio/chat`, social och companion. Den är
operatörs-/simuleringsyta och ska **inte** sätta
`OPENCLAW_PRODUCT_SPEECH_TOKEN`, byta sin operatorchatt till
`croupier-speech` eller anropa produktendpointen. Efter en Director-redeploy
räcker en omstart av Next-processen endast om dess redan befintliga env har
ändrats; annars behövs ingen Next-kodändring för den nya produktrollen.

Native-spelet i `web/` är den enda lokala klient som ska sätta
`OPENCLAW_PRODUCT_SPEECH_URL`, `OPENCLAW_PRODUCT_SPEECH_TOKEN` och
`OPENCLAW_SPEECH_AGENT`. Dess browser fortsätter anropa samma serverägda
`POST /chat`; URL och hemlighet finns endast i Node-processen. `web/` skickar
sedan den allowlistade projektionen till Director-adaptern. Detta ändrar inte
spelets befintliga talkö eller renderergrind.

### Driftsättning när Render och token är klara

Den tidigare lokala helpern `services/openclaw/lab/deploy/local-connection.mjs`
(isolerat native-/Next-par på SQLite-tempdatabaser) är pensionerad 27 oktober 2026;
produkten har en väg (Vercel + Render + Neon + Blob). Talrollen provas i isolerad
staging och med de lokala testerna nedan. Credentialgränsen gäller i driftsatta
tjänster: produktservern får endast `OPENCLAW_PRODUCT_SPEECH_URL`,
`OPENCLAW_PRODUCT_SPEECH_TOKEN` och talrollen, aldrig Gateway-bearer.

En ändring i Git under `services/openclaw/` ändrar inte automatiskt den körande
Gatewayen: dess `openclaw.json`, agentarbetsytor och sessioner ligger på Renders
beständiga disk, och rollreconciliation/runtimepaket körs vid nästa explicit
Gatewaystart. På samma sätt läser redan körande Next- och nativeprocesser sina
envvärden vid start. Därför behövs de avgränsade omstarterna nedan efter merge;
en omstart före ny revision/hemlighet skulle bara starta gammalt beteende igen.

1. Merg:a den granskade work-committen. Ändra inte `main` och använd repoets
   spegelhelper för en godkänd push.
2. Använd samma `OPENCLAW_PRODUCT_SPEECH_TOKEN` i Director och den betrodda
   produktservern. En separat slumpnyckel rekommenderas för att hålla
   behörigheter och rotation isär; det är inte ett generellt förbud mot
   tokenåteranvändning. Den extra startspärren mot Gateway-/modellnyckelalias
   är borttagen. Befintligt endpointskydd kräver fortfarande att produkt-token
   skiljer sig från `LAB_API_TOKEN`, så att den inte ger studioåtkomst.
   Hemligheten får inte läggas i Git, URL eller webbläsarkod.
3. Lägg hemligheten endast i Director-processen och den betrodda produktprocess
   som ska nå adaptern. Sätt produktens `OPENCLAW_PRODUCT_SPEECH_URL` till
   Directors exakta bara HTTPS-origin och
   `OPENCLAW_SPEECH_AGENT=openclaw/croupier-speech`. Ge inte produkten
   `OPENCLAW_API_KEY` på adaptervägen. Inga Google/Gemini- eller
   onboardinginställningar ska läggas till.
4. Driftsätt Gateway-revisionen först. Starten ska rapportera
   `reconcile-speech` (eller `reconcile-roles` om även en tidigare additiv roll
   saknas), skapa endast den separata agentposten och installera runtimepaket
   `2026-09-25.1`. Avbryt vid konflikt; skriv inte över handredigerad state.
5. I den privata Gateway-containern: kör
   `node /app/openclaw.mjs --version` och förvänta `2026.9.5`; kör
   `node /app/openclaw.mjs config validate --json`; kontrollera att
   `croupier-speech` har samma `model.primary` som operatörschatten, tom
   fallbacklista, egen workspace/agentDir, `deny:["*"]`, ingen minnessökning och
   `heartbeat.every="0m"`. Kontrollera privat `/v1/models`; publicera inte URL
   eller bearer.
6. Driftsätt Director-revisionen med den nya produkthemligheten och explicit
   speech-agent. Kontrollera med labbtoken att status annonserar
   `product-speech-v1`; kontrollera att produkthemligheten får 401 på
   `/api/status` och att labbtoken får 401 på `/api/product/speech`.
7. Låt den riktiga Next-Eventstudions befintliga `LAB_REMOTE_URL` och
   `LAB_REMOTE_TOKEN` vara oförändrade. Kör dess vanliga studio-status/advice/chat
   som syntetiskt regressionsprov efter Directorstarten; det ska fortfarande
   träffa `croupier-director`/`croupier-chat`, aldrig `croupier-speech`.
8. Starta isolerad native-QA och riktiga byggda Next-Eventstudion på lediga
   loopbackportar, exempelvis 4196/4197, enligt kommandona ovan. De använder ny
   tempkatalog, separata `croupier.db`/`craig.db`, Next-data och syntetisk
   Partner-spelare. Port 4192/4194 och deras processer får inte röras. Helpern
   vidarebefordrar den smala speech-URL:n/hemligheten endast till produktbarnet,
   Director-labbtoken endast till Next-barnet och tömmer providerinställningar.
9. Kör ett enda syntetiskt adapterprov för vardera `recordedLine`,
   `generatedText` och `silence`, plus fel roll, fel revision, saknad koppling,
   timeout, dubbelsvar och promptinjektion. Kontrollera att inga riktiga
   spelar-id:n, konton, plånböcker eller privata kort förekommer i loggar eller
   request capture.
10. I isolerad produktbrowser: kontrollera samma spelares minst två boxar, att
   pending svar överlever till verklig standard-idle, att chattrad/tal kommer en
   gång och att deal/hit/double/dealer draw inte väntar på modell/tal. Detta är
   runtime-QA, inte nytt läppsynkgodkännande.
11. Först efter godkänd säkerhetsgräns och QA får den avsedda nativeproduktprocessens speech-adapter
    aktiveras. Roll tillbaka genom att ta bort produktens speech-URL/token och
    starta om produktprocessen; lämna `croupier-chat` och övriga roller orörda.

Den ursprungliga implementationen utförde inte steg 2–11. Senare godkänd
driftsättning och partiell verifiering redovisas separat i driftkvittot ovan;
tolka inte checklistan eller en grön Render-status som färdig end-to-end-QA.

## Lokala tester

```powershell
node --test test/openclaw-chat-contract.mjs test/chat-decision-player.mjs test/product-chat-http.mjs test/speech-package-contract.mjs test/speech-pose-gate.mjs
node --test services/openclaw/lab/test/product-speech.test.mjs services/openclaw/lab/deploy/gateway-config.test.mjs services/openclaw/lab/deploy/runtime-bundle.test.mjs services/openclaw/lab/deploy/start-gateway.test.mjs
```

Testerna använder fixturehemligheter, HTTP-stubbar, loopback och tempdata. De
gör inga modell- eller molnanrop och ändrar ingen riktig spelare eller Gateway.
`test/product-chat-http.mjs` startar motorn mot Postgres med Studio-policyruntime
och hoppar över med skäl utan motorharnessen; full körning:
`node tools/run-engine-qa.mjs --postgres-bin /absolut/bin test/product-chat-http.mjs`.
