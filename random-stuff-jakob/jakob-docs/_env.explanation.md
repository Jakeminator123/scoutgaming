# API:er och miljövariabler — vad hör ihop?

Kontrollerat mot koden 2026-09-21. Här finns namn, placeringar och ansvar,
**inga hemliga värden**. Filen är dokumentation; programmet läser inte den
som konfiguration. En konfigurerad anslutning är inte ett verifierat driftläge.

## Börja här

- **Repots `.env`:** befintlig lokal Director-koppling, röstnyckel och den
  historiska generations-lästokenen. Behåll fungerande värden.
- **`lab/.env.local`:** den nya Partner-observatörens inställningar och
  valfria sökvägar för labbets data/video. Filen är Git-ignorerad.
- **Render → Environment:** inställningar för de två tjänster som faktiskt
  kör Director respektive OpenClaw. En lokal fil synkas inte dit.
- **Backoffice → API Keys:** där Partner-nycklar och deras behörigheter skapas.
  Att vara inloggad som administratör ansluter inte labbet till Partner API.

För lokala ändringar: stoppa labbservern och starta den igen med
`Start-Labb.cmd`. Startfilen återanvänder annars en redan körande server.
Den skapar eller roterar inga nycklar.

## 1. Bettalottos generations-API — vilket material finns?

**Åtkomst:** `GET https://bettalotto.se/api/v1/generations`, med Bearer-token.
Kevins lästoken har prefixet `gen_`. Det historiska lokala variabelnamnet är
`BETTALOTTO_API` i repots `.env`.

Detta ger läsåtkomst till generationsregistret/materialinformationen.
Det ger inte åtkomst till Partner-eventströmmen eller till OpenClaw.
Variabelnamnet är en lokal konvention; det är inte ett krav från Bettalotto.

**Dagens videobank läser lokalt material och register.** Att lägga en token
i `.env` startar ingen automatisk nedladdning eller synkning av generations-API:t.
`LAB_VIDEO_ARCHIVE` i `lab/.env.local` kan ange var originalarkivet finns.

**Hämta videokarta** på `/activity` läser nu explicit
`GET /api/v1/generations/mapping` med samma separata token. För just den
adaptern läses `BETTALOTTO_API` från rotens `.env`, sedan `lab/.env.local`;
processmiljön vinner. Live verifierat 2026-09-21. Det hämtar metadata,
inte videofiler, och bevisar inte vad originalspelaren faktiskt spelade.

## 2. Bettalotto Partner API — spelanrop och publicerad presentation

**Basadress:** `https://bettalotto.se`. Följande hör ihop och ska finnas
server-side i `lab/.env.local` för labbets observatör:

- `BETTALOTTO_PARTNER_KEY_ID`: hela publika nyckeln med prefix `ck_live_`.
  Trots suffixet `_ID` avses nyckelsträngen, inte backoffices rad-ID.
- `BETTALOTTO_PARTNER_SECRET`: motsvarande hemliga signeringsnyckel, `cs_`.
- `BETTALOTTO_PARTNER_PLAYER_ID`: partnerns valda spelaridentifierare.
  Samma värde och API-nyckel måste användas av den väg som publicerar events.
- `BETTALOTTO_PARTNER_BASE_URL`: valfri adress; standardvärdet ovan räcker.

Anrop signeras med HMAC. Secret ska aldrig skickas till webbläsaren.
De äldre `LAB_PARTNER_*`-namnen stöds som fallback om det nya namnet saknas
i processmiljön. Ett nytt namn med tomt värde tar företräde över det gamla.
Observern läser **inte** automatiskt reporotens `.env`.

API-delar och behörigheter, korrigerat mot Kevins uppdaterade branch och live-ping 2026-09-21:

- `GET /api/v1/events`: live-presentation för en nyckel och ett playerId;
  kräver **events eller play**. Labbet använder en läsande anslutning.
- `POST /api/v1/table`: spela/inhämta tillstånd via Partner-vägen; **play**.
  Spelmotorn äger regler, kort och saldo. Publicerad presentation når strömmen.
- `POST /api/v1/launch`: ge spelaren en spel-URL; **launch**.
- `POST /api/v1/assets` och `/api/v1/lobby`: materialmanifest respektive
  bord/utbud; **lobby**. Dagens observer hämtar inte dessa automatiskt.
- `POST /api/v1/history`: rundhistorik; **history**.
- `POST /api/v1/balance` och `/api/v1/demo-credit`: wallet-funktioner;
  **wallet**. Labbloggen använder dem inte.
- `POST /api/v1/ping`: verifiera signering och läsa nyckelns scopes.

Live-ping verifierade **launch + events**. `events` är en separat lässcope;
nyckeln saknar `play` och `wallet`. Labbet kan verifiera, öppna originalspelet
och observera strömmen; det skickar inga bordskommandon eller saldoändringar.

Kevin beskriver launch → spel → SSE med samma nyckel/spelare. Hämtad serverkod
visar publicering från Partner-table, men ingen motsvarande native-koppling.
Liveöppning och SSE fungerar; faktisk rundpublicering är fortfarande oprövad.
En korrekt ansluten ström kan vara tom. Ingen replay finns efter avbrott.
**Anslut läsande** i Händelseloggen startar observation, inte en spelrunda.

## 3. Vår Director — labbets kontakt med OpenClaw

Lokalt i repots `.env`:

- `LAB_REMOTE_URL`: HTTPS-adressen till Render-tjänsten
  `croupier-lab-director`, utan dashboard-suffix.
- `LAB_REMOTE_TOKEN`: samma värde som tjänstens `LAB_API_TOKEN` på Render.

**`LAB_API_TOKEN` skyddar vårt Director-API.** Det är inte en Bettalotto-nyckel.
För normal fjärrdrift används den lokala kopian `LAB_REMOTE_TOKEN` för anrop.
En extra lokal `LAB_API_TOKEN` behöver inte döpas om eller ersätta något.

Director förmedlar presentationsråd, operatörschatt och sociala svar.
`OPENCLAW_TIMEOUT_MS` styr tidsgränsen för presentationsråd; fel ger standard.
Lokal läsordning är rotens `.env`, sedan `lab/.env.local`, sedan processmiljön.
Senare värde vinner för samma namn. Detta gäller Director-inställningarna,
inte en gemensam filinläsning för alla integrationer.

## 4. OpenClaws Gateway och modellleverantör

På Render-tjänsten `croupier-lab-openclaw`:

- `OPENCLAWAPI_KEY`: Gateway-/dashboard-autentisering. Director får samma
  värde genom Render-konfigurationen.
- `OPENCLAW_MODEL_API_KEY`: autentisering mot den valda modellleverantören.
- `OPENCLAW_MODEL_BASE_URL`, `OPENCLAW_MODEL_ID`, `OPENCLAW_MODEL_API`:
  leverantörsadress, modell och API-format.

Gateway-starten använder även namnet `OPENCLAW_GATEWAY_PASSWORD` internt
för samma Gateway-hemlighet; det är inget nytt lösenord att hitta på.
Director når Gatewayen via `OPENCLAW_HOSTPORT`/`OPENCLAW_BASE_URL`.
`OPENCLAW_AGENT` väljer Director-agent och `OPENCLAW_CHAT_AGENT` chattagent.

För en avsiktlig **direkt lokal Gateway-koppling** används
`OPENCLAW_BASE_URL` och `OPENCLAWAPI_KEY` lokalt. Normal Render-relädrift
behöver inte modellleverantörens nyckel i labbet. En lokal `OPENAI_API_KEY`
kopplas inte automatiskt in som Gatewayens modellnyckel.

## 5. ElevenLabs — text till ljud i labbet

`ELEVENLABS_API_KEY` i repots `.env` används av labbets röstprov och sociala
talprov. `ELEVENLABS_OC_API` är ett valfritt alias. Finns båda måste deras
värden stämma överens. Processmiljön går före filen.

Spelarchattens Ljud-reglage är förvalt på; du kan avmarkera det för enbart
text. Nytt tal genereras när du skickar/provar och kan använda krediter. Befintligt
ljud kan återanvändas från lokal cache. Det ger inte automatisk videoläppsynk
och konfigurerar inte en ny röstintegration på Render.

## 6. Labbets egna API:er — ingen ytterligare leverantörsnyckel

De lokala `/api/...`-vägarna är delar av samma app på `127.0.0.1:4188`:

- `/api/simulate`: prova varianturval med eventexempel och testkontext.
- `/api/chat`: operatörschatt om det senast sparade labbprojektet.
- `/api/social` och `/api/social/chat`: social policy och spelarchatt med Astrid.
- `/api/voice`, `/api/voice/[id]` och `/api/social/voice`: röstprov och ljud.
- `/api/project` och `/api/videos`: lokalt projekt, videofiler och metadata.
- `/api/inputs`: Partner-konfigurationens status utan hemliga värden.
- `/api/inputs/events`: serverns signerade vidareförmedling av Partner-SSE.
- `/api/inputs/reference`: lokal status och explicita verify/launch/mapping-anrop.

Dessa vägar skyddas för lokal användning och rätt origin. Leverantörsnycklar
stannar i serverdelen. Webbläsaren behöver inga egna kopior i `NEXT_PUBLIC_*`.
`LAB_STUDIO_DATA_DIR` väljer lagringsmapp; det är ingen API-nyckel.

## 7. Produkt och utvecklarverktyg — separata från labbkopplingen

**Spelet/backoffice:** användarinloggning och sessionscookies på
`bettalotto.se` respektive `backoffice.bettalotto.se`. Backoffice administrerar
Partner-nycklar. Varken ett administratörslösenord eller en resetlänk ska
användas som Partner-secret. Resetlänkar hör till den privata åtkomstfilen.

### Vad visar de sparade backoffice-loggarna?

De lokala textutdragen i `random-stuff-jakob/jakob-log-files/backoffice.bettalotto`
granskades 2026-09-21. De beskriver backoffice-data, inte en fångad Partner-
eventström. Råfilerna behålls lokalt och används inte som körbar konfiguration.

- **clips:** klippmetadata och `assignments` per dealer och bordsdel. `box0`–`box6`,
  dealer-up, dealer-hole, return och idle är mål/roller. Ett tomt `src` kan
  fortfarande ha en H264-`stream`; det betyder inte automatiskt saknad film.
- **gen-verdicts:** bedömningar av genereringar och `genLandings` som anger
  avsedd landningsdel. En sådan märkning bevisar inte att klippet spelas i drift.
- **generations:** genererings-ID, modell, status, prompt, längd och materiallänkar.
  En prompt beskriver avsikten; den bevisar inte filmens kvalitet eller läppsynk.
- **overview:** administrativ översikt över dealers, rum och aggregerad aktivitet.

Filerna innehåller ellipser och bortklippta delar. De är användbara som
fält-/strukturunderlag, men räcker inte för en komplett automatisk import,
fullständig täckningskontroll eller verifiering av eventströmmen. Inga
videofiler laddades ned eller analyserades i denna granskning. Klipp- och
översiktsstrukturerna kan jämföras med `/api/bo/clips` respektive
`/api/bo/overview` i produktservern; BO-session och Partner-signering är
olika åtkomstvägar.

### Övriga utvecklaranslutningar

**Produktens äldre agentanslutning:** `AXEL_AGENT_URL` och `AXEL_AGENT_TOKEN`
i spelserverns processmiljö. `RESEND_API_KEY` används där för e-post.
Token/mailnyckel kan även läsas från `CROUPIER_ENV_FILE`,
`/etc/croupier/agent.env` eller de legacy-platser som anges i `web/server.mjs`.
`BO_SECRET` hör till produktens backoffice-signering. Lägg inte dessa nycklar
i labbet bara för att aktivera OpenClaw eller Partner-loggen.

**GitLab-inbox för IDE-agenter:** verktyget använder `GITLAB_TOKEN` eller
`GITLAB_TOKEN_FILE` i sin processmiljö. Det är separat från spelets chatt,
OpenClaw och Partner API. Git/GitHub-inloggning för push har också eget
verktygsstöd och är inte en labbnyckel.

## Källor och fortsatt felsökning

- [Labbets start- och anslutningsguide](../../lab/README.md)
- [Detaljerade Render-inställningar](../../_ENVIROMENT-INFO.md)
- [Director-inställningarnas faktiska inläsning](../../open-claw/lab/src/settings.mjs)
- [Studions val av miljöfiler](../../lab/lib/studio-server.mjs)
- [Partner-observer och formatkontroll](../../lab/lib/partner-observer.mjs)
- [Partner API-kontrakt och scopes](../../web/public/docs/partner-api.md)
- [Röstnyckelns inläsning](../../lab/lib/voice-preview.mjs)
- [Render-tjänsterna](../../open-claw/lab/render.yaml)
- [Produktservern](../../web/server.mjs)

Första kontrollen vid fel är **vilken tjänst och vilken fil som läses**.
Byt inte fungerande nycklar för att en annan integration saknar sina uppgifter.
