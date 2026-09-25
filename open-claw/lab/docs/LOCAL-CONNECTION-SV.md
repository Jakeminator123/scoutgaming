# Verifierad lokal OpenClaw-anslutning

Den här guiden gäller den isolerade lokala produkt- och labbvägen. Den ändrar
inte Gateway, modellleverantör, roller, Control UI eller den befintliga
offline-jämförelsen. Kontrollen nedan gjordes 2026-09-25 på
`jakeminator123/work` utan att stoppa de delade portarna 4192/4194.

## Tre olika kontrollnivåer

| Väg | Konfigurerad | Nåbar | Funktionellt prov |
| --- | --- | --- | --- |
| Lokal produktserver → OpenClaw Gateway | **Nej.** Privat `.env` har gatewaynyckeln, men saknar `OPENCLAW_BASE_URL`. Nyckeln ensam anger ingen säker nätväg. | Inte provbar utan mål-URL. Den publika `/openclaw/`-proxyn spärrar avsiktligt `/v1` och ska inte användas som genväg. | Inte kört. Nuvarande standardmål är dessutom `openclaw/croupier-chat`, vars runtimekontrakt uttryckligen är labboperatörschatt och inte spelar-/produktchatt. |
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

Om en direkt Gateway-URL senare läggs till medan agentmålet fortfarande är den
konflikterande `croupier-chat`- eller `croupier-director`-rollen vägrar helpern
starta den anslutna produkten. Ett nytt modellprov kräver först ett granskat,
separat talkontrakt.

Port 4192 och 4194 avvisas uttryckligen. Helpern ändrar inte
`tools/start-local-comparison.mjs`; offline-jämförelsen behåller sin fulla
externa nätspärr, blockerade env-filer och tomma providerinställningar.

Med dagens privata konfiguration startar det isolerade labbreläet anslutet till
Director. Produktservern startar med en egen databas, men dess OpenClaw-chat är
fortfarande blockerad eftersom `OPENCLAW_BASE_URL` saknas. Detta visas tydligt i
startutskriften; en fungerande labbanslutning får inte beskrivas som en fungerande
produktanslutning.

## Kontraktskonflikt och exakt driftåtgärd

Produktens [`openclaw-chat.mjs`](../../../web/openclaw-chat.mjs) begär ett strikt
JSON-val mellan `recordedLine`, `generatedText` och `silence`, med ekade
revisioner. Den skickar idag till `OPENCLAW_CHAT_AGENT`, vars default är
`openclaw/croupier-chat`. Den driftsatta rollens hanterade AGENTS-text säger
uttryckligen "NOT player chat" och instruerar fri svensk operatörsdialog. Det är
en konkret kontraktskonflikt även om requestens systemtext ibland kan råka vinna.
Ett lyckat svar får inte godkännas som stabilt rollkontrakt på den grunden.

Föreslagen separat, granskad driftändring:

1. Lägg till en verktygslös, separat `croupier-speech`-roll med exakt
   produktens befintliga speech-choice-JSON-kontrakt, egen workspace/agentDir,
   samma befintliga OpenAI-provider och inga fallbackmodeller.
2. Behåll `croupier-chat`, `croupier-director` och deras ägarskap oförändrade.
3. Ge produktservern en privat Gateway-väg som `OPENCLAW_BASE_URL`; exponera
   inte `/v1` via Control UI. Alternativt bygg en smal, autentiserad
   Director-adapter särskilt för produktens talbeslut.
4. Sätt produktprocessens `OPENCLAW_CHAT_AGENT=openclaw/croupier-speech`.
5. Redeploya/starta om Gateway en gång för den nya rollen och privata vägen,
   verifiera version/config och kör sedan ett syntetiskt produktprov genom den
   isolerade helpern. Starta därefter om den lokala produktprocess som ska läsa
   de nya variablerna.

Ingen av dessa roll-, nät- eller omstartsändringar utfördes i denna uppgift.
Den befintliga Director- och Gatewayprocessen har redan rätt kod/config för
labbets operatörschatt och behöver inte startas om för det verifierade provet.
Om den delade Next-studion på 4192 redan körde före att privat konfiguration
blev tillgänglig ska just den processen startas om av dess ägare efter pågående
UI-arbete; helpern rör den inte.

## Tester

```powershell
node --test open-claw/lab/deploy/local-connection.test.mjs
```

Testerna använder endast fixture-hemligheter, lokala HTTP-stubbar, lediga
loopbackportar och nya tempdatabaser. De verifierar credentialseparation,
redigerad statusrapport, tomma providerinställningar, blockerade env-filer och
externa nätmål, avvisade 4192/4194, start/stopp och säker rensning. De gör inga
modell- eller molnanrop.
