# Talkedjan och RunPod: Kevins uppsättning, vår kedja, aktivering

Skrivet 2026-10-29 på Jakobs fråga: "Alla värden som finns inlagda ska användas som de fungerar. Vi ska använda Kevins RunPod. Vi ska också ha en endpoint för Kevin. Varför är det här inte dokumenterat, varför fungerar det inte, varför är det inte aktiverat?" Källor: Kevins läge i Slack 28/10 kl 15:30 och hans agents svar 22–28/10 (loggen ligger hos Jakob, utanför Git), [det historiska Paow-underlaget](HISTORIK.md), [TALKEDJA](plans/TALKEDJA.md), [miljöguiden](ENVIRONMENT-VARIABLES.md) och koden på main `c8d784ab`. Det ursprungliga underlaget gjorde inga molnanrop. Färska läsningar och LIPSNK-agentens separat beställda helklippsprov 30 oktober redovisas nedan; äldre uppgifter är historiska, inte aktuell konfiguration. Inga hemligheter finns här.

## Kort svar

**Avslutsstatus 30 oktober 2026:** Jakob-2-läppsynk är pausad. Tre olika preview-hemligheter är verifierade; nyckeln listar fortfarande Jakob/ABYDM, inte Paow/Dragan. Mall `5dkkc3wolw` är rättad till `croupier-v3` och de två olästa produktionsvariablerna är borttagna. Se [miljökvittot från 30 oktober](ENVIRONMENT-VARIABLES.md#verifierad-tal--och-miljöstatus-30-oktober-2026). Aktiveringsstegen nedan är återstartsunderlag, inte ett pågående uppdrag.

- **Inte dokumenterat:** Kevins RunPod-läge fanns bara i Slack. K04:s `lipsync-underlag.md` (endpoint-id och ws-kontrakt, 22/10) flyttades till docs/history och raderades 28/10 (`8ad45fbf`); PAOW-LIPSYNC och TALKEDJA tog bara med delar. Det här är den samlade platsen.
- **Daterad kontroll, 2026-10-30 00:24 UTC:** produktionens stillbildsendpoint `zsudl8tmzcmiv1` gav auth/health HTTP 200. Det bevisar åtkomst och hälsosvar, inte att ljud eller video kan genereras. Rörligt tal är av (`moving flag=0`), `CROUPIER_MOVING_SPEECH_BANK_RECORDS` saknas och basprofilen saknar `dealerId`; rörlig generering är därför inte konfigurerad. I preview är `generated/moving=0` och bank samt endpoint saknas.
- **Separat från nygenererat tal:** teknisk återläsning 2026-10-30 00:38 UTC bekräftar Jakobs publicerade paket v9, 48 medieposter och 10 valbara, godkända förinspelade MP4-repliker. Det bekräftar register- och publiceringsstatus, inte en ny mänsklig AV-bedömning eller att livegenerering fungerar.
- **Historiskt fel, rapporterat 22–23/10:** `croupier-v3` hade enligt en Slack-rapport Kevins/Emils RunPod-nyckel i `RUNPOD_API_KEY` och `kiud9j0a7fp5gn` som endpoint (variabelns namn angavs inte: `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID` eller den olästa `CROUPIER_MOVING_SPEECH_ENDPOINT_ID`). `kiud9j0a7fp5gn` var Kevins staging-**pod**, inte en serverless-endpoint, och `api.runpod.ai/v2/<id>` svarade 404. Rapporten sade också att Kevins nyckel fick 401 mot vår stillbildsendpoint. Den uppgiften är inte aktuell status efter hälsokontrollen 2026-10-30. Mallen `5dkkc3wolw` för vår rörliga endpoint hade `MOVING_CALLBACK_ORIGIN` mot raderade `croupier-v2`; den är nu rättad och återläst 30 oktober 16:46 UTC efter Jakobs uttryckliga godkännande.
- **Aktivering:** beslutet 28/10 pausade talkedjan till efter O03; O03 är sedan verifierat genomfört (#527). Vid statuskontrollen ovan var rörligt tal fortfarande av i produktionen och preview saknade bank och endpoint. Det beskriver inte de separat publicerade, förinspelade MP4-replikerna.

## Kevins RunPod 28/10 kl 15:30 (Kevins Slack, i sak ordagrant)

Prod `croupier.scoutgg.dev` kör release `gh-de31659c13ab` från grenen `kevin` (333/333 tester). Läppsynken går inte genom spelmotorn: motorn skickar händelser och klienten spelar.

| Resurs | Vad | Läge |
| --- | --- | --- |
| Pod Kevins prod-pod | Emils rörliga läppsynk, image `croupier-lipsync-worker:fe1b55e` + `/data/avatars`; RTX 4090, 61 GB RAM, 0,89 $/h. Ringer själv upp prod över websocket som banan `e2e-prod` och annonserar tagningar: paow 90, dragan 85, astrid 65. Första munbit efter 0,25–0,5 s | aktiv, behålls |
| Endpoints Kevins Paow- och Dragan-endpoints | Röst och chattsvar, min 1/max 1, ca 1,1 $/h ihop. Image astrid-gpu-worker `71f47174`/`6e8fff01` (enligt 22/10), `AVATAR_ID` per endpoint, `{op:"lipsync", wav_b64}` → `mp4_b64` | aktiva, alltid på |
| Endpoint Kevins reservendpoint | Reserv när podden faller (0/3), sämre läppsynk, image `6c80fe5`. `POST /v2/<reserv-id>/run {input:{op:"session", ws_url, ttl:3300, avatar}}` med `ws_url = wss://<origin>/lipsync-rorlig?token=<process-token>&avatar=<dealer>`; workern ringer upp, svarar `pong` med tagningar, får `start`/`end` och svarar `lapp` (H.264 256×512) och `done`; ljudet 0,22 s efter kartans första ruta | reserv, kostar vid bruk |
| Pod Kevins tillfälliga H100-pod | H100, 3,99 $/h, renderar Adebayors klipp, stoppas automatiskt | tillfällig |
| Endpoints med max 0 | `tdkbn6qxcyh4so` (klassiska Astrid, `registry.gitlab.com/emacodehero/astrid-gpu-worker:d3a2d0a6`), `9hyt6a6e17223s` (gammal Dragge), `m92ozpmo4dblod` (lokal test) | inaktiva |
| Stoppade poddar, volym | `ocusfoehs1str3` (Emils original, maskinen saknar ledig GPU), `56ztvy7chwmxrh`, `c8ecfltxn0ux91` (migreringar), `xvcvt1wllt5eoa`, `e2l9tjkcewzeeh` (reservförsök), `qrh2uetfnc9l6v` (Adebayor), `wyzggorfuse5cf` (bygg-avatarer); volym `oem9ixhj1q` (30 GB, tom) | kostar lagring |

Emils image är privat på GHCR: varje ny pod eller endpoint behöver registry-auth `ghcr-emacodehero`. Serverless-mallen (Kevin 28/10): RTX 4090, inte 5090 (imagen är cu121), idle 60 s, execution timeout 600 s, flashboot, 20 GB containerdisk. Kevin rättade samma dag att stillbilderna är borttagna sedan 27/10: dealers talar ovanpå vilan. Kevins underhållsmeddelande följer RunPod-läget (`/api/notice`, "runpod" i `/api/lipsync-status`). Staging har ingen pod-läppsynk.

Fällor (Kevins numrering): 1 två poddar på samma bana tar anslutningen från varandra var 10:e s, bara en pod per bana; 2 poddens data ligger på maskinens disk och "migrate" skapar kopior (backup `/root/emil-pod-backup/data-20261027.tgz` på scout-hel1); 3 utan registry-auth `IMAGE_AUTH_ERROR`; 4 chattsvar kräver min 1, annars över 12 s kallstart och bara text; 5 podden behöver RAM, 35 GB gav OOM; 6 en bana delas av alla dealers, två samtidiga köar (Dragan 7–9 s); 7 reserven heter "staging" men är prods reserv, max 0 ger `ENDPOINT_PAUSED`; 8 en worker som annonserar 0 tagningar ger flimrande mun; 9 lokalt ska `RORLIG_ENDPOINT_ID` vara av (`local-none`) och lokala `.env`-värden får aldrig till prod; 10 RunPod-konsolen visar gammalt läge tills sidan laddas om.

Cleanup (Kevins förslag, inget raderas utan hans ja): behåll Kevins prod-pod, Paow-/Dragan-endpoints, reserven (eller max 0 när podden visat sig stabil), Kevins tillfälliga H100-pod tills Adebayor är klar, backupen på scout-hel1. Radera `xvcvt1wllt5eoa`, `e2l9tjkcewzeeh`, `c8ecfltxn0ux91`, `56ztvy7chwmxrh`, `qrh2uetfnc9l6v`, `wyzggorfuse5cf`, endpoints `9hyt6a6e17223s` och `m92ozpmo4dblod`, volymen `oem9ixhj1q` och åtta gamla mallar; `ocusfoehs1str3` först när Emil sagt ok; `tdkbn6qxcyh4so` bara om ingen använder klassiska läget. Kevins nästa steg: Emils `/data` på en nätverksvolym och en andra prod-bana på prod-podden.

## Röst: ElevenLabs och Cartesia

- Båda rösterna ligger i Kevins ElevenLabs Pro-konto: Paow `WZVEBKUreb9jAKojf0QF`, Dragan `7f95xPL4S3ySZ4OS1pw8` (Kevin 28/10). Uppgiften 28/10 att Render-nyckeln ser Paow är inaktuell: läsningen 30/10 listar Jakob/ABYDM men hittar inte Paow. Kevin uppger att den nyckeln hör till Impactwin och att Paow/Dragan finns i hans vanliga konto. Jakob vill samla alla fyra hos Kevin; verifierad målkontonyckel saknas. Se [aktuellt röstläge](NEXT-AGENT.md#jakob-2-och-tal-fortsatt-pausat).
- Paows läsning (Kevin): sv `eleven_v3`, stability 0,5, similarity 0,85, speaker boost; en `eleven_multilingual_v2`, 0,38/0,8, style 0,3; ljud loudnorm −16 LUFS, mono 16-bit; klipp 1080×1920, 24 fps. Vilan `paow_vila2x` är `talk_base.png`. Kevin byggde ingen bank: varje replik (66 sv + 66 en) läppsynkades från vilobilden. Inställningarna står redan i `packages/presentation/contracts/dealer-voice-catalog.json`; loudnorm finns inte i vår kedja (ElevenLabs `pcm_24000` går rakt in).
- **Cartesia är standardkälla i helfilsvägen** och användes som uttrycklig provröst 30/10. Det innebär inte att Cartesia alltid krävs för rörligt tal: dagens konfiguration stöder streaming med antingen komplett stillbildsprovider eller ingen sådan uppsättning. Paow och Dragan använder sin verifierade ElevenLabs-profil. Exakta villkor finns i [miljöguiden](ENVIRONMENT-VARIABLES.md).

## Vår kedja i `croupier-v3`

| Väg | Vad | Fil:rad |
| --- | --- | --- |
| Stillbild (`video-frame`) | ElevenLabs-PCM från dealerns profil; en ruta ur ett registerklipp skickas som avatar per session till vår astrid-gpu-worker. Jobb `{op:"session", ws_url:"wss://<publik origin>/lipsync-worker", ws_token, worker_id, ttl, avatar}`; workern måste svara med bindningen (`x-dealer-id`, profilrevision, bildens sha256, protokoll 3). En endpoint räcker för alla dealers, men bara en GPU-session åt gången i miljön. Vårt konto: `zsudl8tmzcmiv1` (min 0, max 1, idle 5 s) | `services/game/speech-journal-runtime.mjs:208`, `services/astrid-gpu-worker/gateway/worker-binding.mjs:16`, `services/astrid-gpu-worker/handler.py:145`, `services/game/generated-speech-stream.mjs:94`, `:227` |
| Rörligt (`motion-video`) | En bana per dealer med egen verifierad bank, endpoint och budget (T3, #549). Bara vår image `ghcr.io/jakeminator123/moving-gpu-worker@sha256:…`; workern hämtar banken, ringer `wss://<RENDER_EXTERNAL_URL>/lipsync-moving/<slump>` och binder jobbet med kvitto. Vårt konto: `zjsdlni6cn8dvo` (min 0, max 1, idle 60 s) | `ops/cloud/config.mjs:175-212`, `services/game/server.mjs:1212-1242`, `services/game/moving-speech-runtime.mjs:86-90`, `services/astrid-gpu-worker/gateway/moving-transport.mjs:29` |
| Helfil (`op:"lipsync"`) | Spelkopplingen har en standardröst via Cartesia; själva providern kan köras separat med vald provröst och kompatibel endpoint. Helfil i spelkopplingen är av när strömning är på | `packages/presentation/server/generated-speech-provider.mjs:152-170`, `packages/presentation/server/generated-speech-runtime.mjs:43-45`, `:61` |
| Kevins `/lipsync-rorlig` | **Finns inte hos oss** (`git grep lipsync-rorlig -- apps packages services ops tools test` ger 0 träffar). Emils oägda transport finns kvar (`services/game/moving-speech-transport.mjs:5`, image `ghcr.io/emacodehero/croupier-lipsync-worker`), men starten nekar annan image än vår (`config.mjs:197`) och bindningen kräver ägd release (`moving-speech-transport.mjs:79-81`) | se vänster |

Per-dealer-kartan finns redan för rörligt tal: `CROUPIER_MOVING_SPEECH_BANK_RECORDS` och en driftprofil med egen endpoint per dealer, budget per dealer (`services/game/moving-speech-budget.mjs:20`). En-dealer-gränsen vid `moving-speech-runtime.mjs:242` togs bort i T3, och stillbildsvägen har aldrig haft den. Det som stoppar Paow bredvid Dragan är verifierad bank (T4), aktuell provider-/röstbindning och återstående uppspelningsacceptans (T5); referensvalet finns redan i Admin. Därför ingen ny karta i den här PR:n.

## Kan vår kod tala med Kevins endpoints som de är?

**Ja för helklipp; strömmat och rörligt tal har andra kontrakt.** Den befintliga `createGeneratedSpeechProvider` skickar `POST /v2/{endpoint}/run` med `input: {op:"lipsync", wav_b64, crf:13, preset:"ultrafast"}`, följer `GET status/{jobId}` och avkodar videon (`packages/presentation/server/generated-speech-provider.mjs:125,164–185`). Ingen ny transportkod behövdes för provet nedan.

LIPSNK-agentens beställda prov den 30 oktober använde denna modul utan källkodsändring mot Kevins Paow-endpoint `7tcfouz8jib4wb`, avatar `paow_vila2x`, image `registry.gitlab.com/emacodehero/astrid-gpu-worker:6e8fff01`. Jobbet `52f83b83-d178-4354-840d-bbda36ac60b2-e2` gav ett sexsekundersklipp, 1080×1920, 24 fps, 144 rutor och AAC 24 kHz mono; rapporterad GPU-tid 7,987 s. Ljudet var Cartesia Victoria, tydligt märkt provröst. Fil och kvitto finns privat i agentens `.cache/lipsync-20261030/`.

Det är bevis för helklippstransport och syntes, inte Paows originalröst, mänskligt godkänd läppsynk eller aktiverad talfunktion i spelbordet. Produktionsprofiler, rum och talflaggor ändrades inte. Den befintliga spelkopplingen för helfil väljer fortfarande sin standardröst; ett separat modulprov bevisar inte färdig integration per dealer.

Stillbildsströmningen skickar i stället `op:"session"` och kräver avatar-/profilbindning enligt protokoll 3. Rörligt tal kräver verifierad bank, rätt callback, dealeridentitet och exakt källbildrute-/ljudbindning. Kevins `/lipsync-rorlig` är ett separat protokoll; helklippsprovet ändrar inga sådana skydd och bevisar inte kompatibilitet med den vägen.

**Aktuellt beslut:** välj konto med Kevin innan någon ny RunPod-endpoint skapas. Befintliga endpoints kan undersökas inom respektive provmandat. Den äldre aktiveringsplanen nedan är underlag för ett separat beslut, inte ett genomfört eller automatiskt godkänt driftbyte.

## Aktivera

Återstartsunderlag för det pausade uppdraget. Följ aktuellt mandat och
kostnadsram; preview före produktion. Historiska konton, priser och
resurslistor ovan är ingen aktuell instruktion att skapa eller radera något.

1. Läs aktuell röst-, endpoint-, bank- och callbackbindning för rätt konto
   och miljö. `tools/check-provider-profile.mjs` kan kontrollera health och
   röstlista utan generering. Health bevisar inte workerprotokollet.
2. Följ [TALKEDJA](plans/TALKEDJA.md) för kvarvarande kod-/integrationsarbete
   och [PAOW-BANK-KORNING](PAOW-BANK-KORNING.md) för bank och worker. Skapa
   inte om redan fungerande endpoint eller preview-hemlighet på grund av
   den äldre inventeringen.
3. För in varje avgränsad env-ändring i båda miljöregistren. Verifiera
   miljöspecifik callback, budget och nyckelåtkomst; dela inte produktions-
   nycklar med preview som genväg. Render-env kan utlösa deploy.
4. Kontrollera spelstart och separat talberedskap. Valfria bankfel har nu
   begränsad startupdeadline; grön spelhälsa bevisar därför inte fungerande tal.
5. Prova den valda kedjan med profilrevision, mediehashar, journal, jobb-
   identitet och budgetkvitto. För stillbild måste delat bords återstående
   uppspelningsgräns lösas; Admins Provspel har externa tjänster avstängda.
   Jakob bedömer röst, ljud och läppsynk före produktionsaktivering.
