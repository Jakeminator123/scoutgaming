# Miljöfiler och OpenClaw — aktuell karta 2026-09-29

Det här dokumentet hör till checkouten `C:\Users\jakem\Projects\croupier`
och GitHub-repot `Jakeminator123/github-work`, arbetsbranchen
`jakemanator123-github-work`. Det är en förteckning över nyckelnamn och ansvar,
inte en miljöfil som programmet läser. Inga hemliga värden ska skrivas här
eller i Git. Kopiera inte en gammal `.env` från Scout-Gaming eller ett annat
repo över filerna i denna checkout.

För hela molnläget, se [aktuell driftkarta](docs/CLOUD-CURRENT-STATE-2026-09-29.md).
Det maskinkontrollerade namnregistret finns i
[docs/ENVIRONMENT-VARIABLES.md](docs/ENVIRONMENT-VARIABLES.md) och
[docs/environment-variables.json](docs/environment-variables.json). Den äldre
[miljörestaureringen](docs/ENVIRONMENT-RESTORATION.md) är ett historiskt kvitto,
inte instruktioner för dagens serverstart.

## Filer som faktiskt finns i denna checkout

Kontrollerat lokalt 2026-09-29 utan att skriva ut värden:

- Rotens `.env` finns, är privat/Git-ignorerad och har 17 satta namn. Rotens
  `.env.local` finns inte.
- `lab/.env.local` finns, är privat/Git-ignorerad och har 6 satta namn.
  `lab/.env` finns inte.
- `lab/.env.generated-speech.local` finns, är privat/Git-ignorerad och har 1
  satt namn för det uttryckliga genererat-tal-provet.
- `lab/.env.example` och `open-claw/lab/.env.example` är incheckade mallar,
  inte aktiva hemlighetsfiler.

Ett namn som finns lokalt bevisar inte att värdet är aktuellt på Render eller
att leverantörsnyckeln fortfarande fungerar. Den lokala kontrollen ändrade
inga värden, roterade inga nycklar och gjorde inget debiterbart anrop.
Efter kontobytet har jag inte läst de två Render-tjänsternas hemliga
Environment-värden på nytt; deras aktuella namn/värden måste därför jämföras
mot denna karta i Render innan något ändras där.

### Rotens `.env`: de 17 namnen och avsedd roll

**Lokal Director-/produktkoppling:** `LAB_REMOTE_URL`, `LAB_REMOTE_TOKEN`,
`LAB_API_TOKEN`, `OPENCLAW_PRODUCT_SPEECH_URL`,
`OPENCLAW_PRODUCT_SPEECH_TOKEN`, `OPENCLAW_SPEECH_AGENT`,
`OPENCLAW_TIMEOUT_MS`. Båda URL-namnen pekar lokalt på samma rena HTTPS-origin
för `croupier-lab-director`. `LAB_REMOTE_TOKEN` och `LAB_API_TOKEN` har samma
lokala värde, vilket är rätt när den lokala studion använder Directors
`LAB_API_TOKEN`. Produktens speech-token har ett annat värde och ska vara
separat. `LAB_API_TOKEN` i rotfilen är en lokal kopia/referens; den lokala
anslutningen använder `LAB_REMOTE_TOKEN`.

**Gateway och modell:** `OPENCLAWAPI_KEY`, `OPENCLAW_MODEL_API_KEY`,
`OPENAI_API_KEY`. De första två har olika lokala värden, som avsett.
`OPENCLAWAPI_KEY` är Gateway-behörighet; `OPENCLAW_MODEL_API_KEY` är
modellleverantörens nyckel. `OPENAI_API_KEY` är en separat lokal
leverantörsnyckel som kan användas av andra uttryckliga prov, bland annat
kamerans översättning när OpenAI är vald leverantör. Ingen av dessa ska till
webbläsaren. Den lokala produkt-relayen behöver inte Gateway-nyckeln.

**Andra lokala funktioner:** `BETTALOTTO_API`, `ELEVENLABS_API_KEY`,
`ELEVENLABS_OC_API`, `CARTESIA_API_KEY`, `LAB_PARTNER_KEY_ID`,
`LAB_PARTNER_SECRET`, `LAB_PARTNER_PLAYER_ID`. ElevenLabs-namnen har samma
lokala värde och är två alias för provverktyg. De tre `LAB_PARTNER_*` är äldre
namn/fallback, och deras värden skiljer sig från de tre nuvarande
`BETTALOTTO_PARTNER_*` i `lab/.env.local`. Skillnaden visar inte vilken
uppsättning som är giltig; skriv inte över den ena med den andra. Aktuellt Lab
använder `BETTALOTTO_PARTNER_*` när dessa finns. `BETTALOTTO_API` används
separat av generations-/referenskod.

### `lab/.env.local`: de 6 namnen

`BETTALOTTO_PARTNER_KEY_ID`, `BETTALOTTO_PARTNER_SECRET` och
`BETTALOTTO_PARTNER_PLAYER_ID` hör ihop för Labbs Partner-anslutning.
`RUNPOD_API_KEY` finns för uttryckliga lokala GPU-/talprov.
`RUNPOD_ENDPOINT_ID` är en äldre generell provnyckel och väljs inte som
talendpoint av dagens genererat-tal-helper. `GEMINI_API_KEY` finns lokalt men
ingår inte i nuvarande Render/OpenClaw-kontrakt; för inte över den till Render
utan en namngiven funktion som behöver den.

`lab/.env.generated-speech.local` har
`CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`, den specifika endpoint som dagens
genererat-tal-helper läser när provet uttryckligen slås på. Den är inte en
ersättare för `RUNPOD_API_KEY`.

### Läsordning och vad som inte kopieras automatiskt

`open-claw/lab/deploy/local-connection.mjs` läser rotens `.env`, därefter
`lab/.env.local`, därefter `lab/.env.generated-speech.local`; en redan satt
processvariabel har högst prioritet. Bara helperns tillåtna namn förs vidare
till dess isolerade barnprocesser. Next-studion har egen inläsning i `lab/`;
anta därför inte att varje namn i rotens `.env` syns i studions routes.
Miljöfiler på datorn skickas aldrig automatiskt till Render eller Vercel.
Ändrade lokala eller fjärrmiljövariabler kräver omstart/redeploy av berörd
process innan de gäller.

**Saknas lokalt, med avsikt i nuläget:** `OPENCLAW_BASE_URL` (den lokala
produkten använder Director-relay), `CROUPIER_ASTRID_TRANSLATION_KEY` och
`CROUPIER_ASTRID_CAMERA` (kamera av), `BLOB_READ_WRITE_TOKEN` och
`CROUPIER_ZONES_DATABASE_URL` (QA:s Blob/zon-Neon är knutna till ett annat
Vercel-projekt och ingen lokal synk finns). `LAB_VIDEO_ARCHIVE` och
`LAB_STUDIO_DATA_DIR` är valfria sökvägsöverskrivningar; utan dem används
repots `emil/dealklipp-v1` respektive Labbs standarddatamapp. Det finns
ännu ingen färdig game-Neon-anslutningsnyckel att lägga i rotfilen.

## Render: de två OpenClaw-tjänsterna

Blueprintkällan är [open-claw/lab/render.yaml](open-claw/lab/render.yaml).
Kontrollera Render-tjänstens **Environment** mot namnen nedan. Skapa inte en
andra likadan tjänst för att synka nycklar. För en befintlig Blueprint-tjänst
uppdaterar `sync: false` inte hemliga värden vid senare synkar; sådana
ändringar görs i tjänstens privata Environment-vy.

Gå i Render Dashboard till respektive tjänst → **Environment**. Jämför
nyckelnamnen, lägg till eller korrigera bara den aktuella tjänstens värde,
spara och låt just den tjänsten starta med den nya miljön. Kontrollera sedan
`/healthz` på Director och den privata Gatewayens status innan nästa
ändring. Klistra aldrig in hela rotens `.env` via **Add from .env**: den
innehåller nycklar för flera olika roller.

### 1. `croupier-lab-director` — publik Director

- **Behåll/verifiera hemligheter:** `LAB_API_TOKEN` (Directors eget API),
  `OPENCLAW_PRODUCT_SPEECH_TOKEN` (endast betrodd spelservers speech-anrop)
  samt `OPENCLAWAPI_KEY` som Blueprint-referens till privata Gatewayens
  Gateway-nyckel. Speech-token måste vara samma som i spelservern, och skild
  från `LAB_API_TOKEN`. Skriv inte någon av dem i Blueprintens `value:`.
- **Behåll/verifiera intern väg:** `OPENCLAW_HOSTPORT` ska komma från
  Gateway-tjänstens privata `hostport`. Startkoden härleder
  `OPENCLAW_BASE_URL` från den; fyll normalt inte i en publik Gateway-URL.
- **Blueprintvärden:** `HOST=0.0.0.0`, `PORT=4188`,
  `LAB_DATA_DIR=/data/catalog`, `OPENCLAW_AGENT=openclaw/croupier-director`,
  `OPENCLAW_CHAT_AGENT=openclaw/croupier-chat`,
  `OPENCLAW_SPEECH_AGENT=openclaw/croupier-speech`,
  `OPENCLAW_TIMEOUT_MS=8000`, `OPENCLAW_DASHBOARD_ENABLED=true`.
  Director-disken ska vara monterad på `/data/catalog`. Render tillhandahåller
  `RENDER_EXTERNAL_URL`; duplicera den normalt inte manuellt.
- **Lägg inte hit:** `OPENCLAW_MODEL_API_KEY`, `OPENAI_API_KEY`,
  `RUNPOD_API_KEY`, Partner-nycklar, spelarnas databas-URL eller
  `BLOB_READ_WRITE_TOKEN` för dagens Director-flöde.

### 2. `croupier-lab-openclaw` — privat Gateway

- **Behåll/verifiera två olika hemligheter:** `OPENCLAWAPI_KEY` för Gateway
  och `OPENCLAW_MODEL_API_KEY` för modellleverantören. Den förra refereras av
  Director. Sätt inte ett separat `OPENCLAW_GATEWAY_PASSWORD` manuellt;
  Gateway-starten mappar befintlig `OPENCLAWAPI_KEY` internt.
- **Blueprintvärden:** `OPENCLAW_MODEL_BASE_URL=https://api.openai.com/v1`,
  `OPENCLAW_MODEL_ID=gpt-5.4-mini`, `OPENCLAW_MODEL_API=openai-responses`,
  `OPENCLAW_GATEWAY_PORT=18789`, `OPENCLAW_STATE_DIR=/data/openclaw`,
  `OPENCLAW_CONFIG_PATH=/data/openclaw/openclaw.json`. Den privata disken ska
  vara monterad på `/data/openclaw`.
- **Manuellt värde på Gateway:** `OPENCLAW_DASHBOARD_ORIGIN` ska vara
  `https://croupier-lab-director.onrender.com` som ren origin, utan
  `/openclaw/`, query eller avslutande snedstreck.
- **Endast vid beslutat bildprov:** `CROUPIER_SPEECH_VISION=1`. Låt annars
  funktionen vara av. Lägg inte `LAB_API_TOKEN`, produktens speech-token,
  `OPENCLAW_GATEWAY_TOKEN` eller `OPENCLAW_CONFIG_READONLY` här.

Gatewayens `openclaw.json` och agentarbetsytor ligger på beständig disk. En
ändrad Blueprint-standard byter därför inte säkert en redan sparad
modellkonfiguration. Kontrollera den effektiva konfigurationen innan ett
modellbyte. Ingen hemlighet ska skickas via den publika `/openclaw/`-proxyn.

### Betrodd spelserver: `croupier-v2` är en tredje tjänst

Den är inte en av de två OpenClaw-tjänsterna. För speech-relay behöver den
`OPENCLAW_PRODUCT_SPEECH_URL=https://croupier-lab-director.onrender.com`,
`OPENCLAW_PRODUCT_SPEECH_TOKEN` med exakt Directors produktvärde och
`OPENCLAW_SPEECH_AGENT=openclaw/croupier-speech`. Skicka inte
`OPENCLAWAPI_KEY` eller `LAB_API_TOKEN` till spelets speech-väg. Separata
`LAB_REMOTE_URL`/`LAB_REMOTE_TOKEN` och
`CROUPIER_PRESENTATION_DIRECTOR_URL`/`CROUPIER_PRESENTATION_DIRECTOR_TOKEN`
används bara av de funktioner som uttryckligen behöver operatörsråd.

Kamera kräver ett separat beslut om `CROUPIER_ASTRID_CAMERA=1` och en
serverhemlighet `CROUPIER_ASTRID_TRANSLATION_KEY` (eller kodens uttryckligen
godkända OpenAI-alias). Lokalt finns ingen särskild translation-key; det är
inte ett fel när kameran är av. Genererat tal kräver egna opt-in-flaggor och
`CARTESIA_API_KEY`, `RUNPOD_API_KEY`,
`CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID` på den server som genererar.
Förinspelade Astridklipp kräver inget av detta. Kopiera inte lokala
leverantörsnycklar till båda OpenClaw-tjänsterna som en generell lösning.

## Vercel Blob, Neon och mediegräns

Vercel-projektet `croupier-player-preview-qa` har en privat QA-Blob med
`BLOB_READ_WRITE_TOKEN` i projektets servermiljö och en separat
zon-Neon-integration. Dessa värden finns inte i rotens eller Labbs lokala
miljöfiler och ska inte läggas i de två OpenClaw-tjänsterna. Den nya
Git-kopplade landningen `croupier-frontend` är en annan app; den får inte
automatiskt QA-projektets Blob eller Neon. En privat Blob kräver ett
serverautentiserat uppladdnings-/läs-API och stöd för HTTP Range/206 innan
spelets MP4 kan spelas säkert därifrån. Labbs nuvarande zoner sparas lokalt i
webbläsaren, och `emil/dealklipp-v1` är fortfarande källan för inspelade takes.
Praktiska steg finns i [medie- och zonguiden](docs/MEDIA-UPLOAD-AND-ZONES.md).
Vilka Vercel-miljöer som just nu får token behöver kontrolleras i projektets
Dashboard före ny deploy; den kontrollen gick inte att göra efter kontobytet.

Spelets produktionskonto, session, saldo, spelrundor och chattminne ligger
fortfarande i serverns SQLite. En separat game-Neon och en fullständig
servermigration krävs före byte; QA:s zon-Neon är inte en spelardatabas. Ge
inte OpenClaw en databas-URL. Spelet hämtar och filtrerar den kontext som
OpenClaw får se. OpenClaw äger aldrig saldo eller utbetalning. Se
[Neon-planen](docs/NEON-GAME-MIGRATION.md) och
[OpenClaws speech-kontrakt](open-claw/lab/docs/PRODUCT-SPEECH-DEPLOYMENT-SV.md).

## Åtgärdslista efter inventeringen

1. Behåll de lokala filerna där de ligger. Radera inga gamla Partner-värden
   förrän deras användning och giltighet har verifierats. Ta bort gamla
   hänvisningar till andra checkout-sökvägar ur nya instruktioner.
2. Jämför namn och roll, inte utskrivna hemligheter, i de två Render-
   tjänsternas Environment mot listan ovan. Bekräfta särskilt att Director
   och spelserver har samma produkt-speech-token och att Gatewayens modell-
   och Gateway-nycklar är två olika värden.
3. Kontrollera `OPENCLAW_DASHBOARD_ORIGIN` manuellt på Gateway. Kontrollera
   effektiv `openclaw.json` före modelländring. En lokal `.env`-rad uppdaterar
   ingen Render-tjänst.
4. För framtida genererat tal: använd den specifika
   `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`; tolka inte `RUNPOD_ENDPOINT_ID` som
   samma endpoint. För kamera: lägg en dedikerad översättningsnyckel på
   spelservern först när kamerafunktionen aktiveras.
5. Inför Blob endast i en server med faktisk privat upload- och Range-väg.
   Inför separat game-Neon först efter backup, migrering och isolerat
   återgångsprov. Dessa två steg görs inte genom att fylla i fler OpenClaw-env.

Officiell leverantörsreferens:
[Render Blueprint-env](https://render.com/docs/blueprint-spec#setting-environment-variables),
[Render Environment](https://render.com/docs/configure-environment-variables),
[Vercel privat Blob](https://vercel.com/docs/vercel-blob/private-storage).
