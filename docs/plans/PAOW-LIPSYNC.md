# Paow: tal och läppsynk i mains kedja

Utredning och prov 28 oktober 2026 (session scoutgaming-d6, på Jakobs begäran). Ingen produktkod ändrades och produktionen rördes inte. Beslut samma dag (Jakob, Kevin och orkestratorn): Paow ingår inte i O02/O03; efter O03 byggs talkedjan dealer-generisk med Paow som första testfall, och Dragan byts inte ut i produktionen. O03 är nu genomfört (#527) och talkedjan har en separat genomförandeplan i [TALKEDJA](TALKEDJA.md). Aktuell produktions- och previewstatus finns i [TALKEDJA-RUNPOD](../TALKEDJA-RUNPOD.md). Underlaget utanför Git (filmer, ljud, lappar, röstprov, Emils överlämning) ligger hos Jakob i `Desktop\_SCOUT\info-lipsync`.

## Verifierat läge

| Vad | Läge |
| --- | --- |
| Röst | Paows ElevenLabs-röst (`WZVEBKUreb9jAKojf0QF`, katalogen `packages/presentation/contracts/dealer-voice-catalog.json`) svarar med produktionsnyckeln på Render. Nyckeln är Kevins Pro-konto, där även Dragges röst ligger. Röstproven (7 s respektive 30 s) är hämtade och sparade utanför Git för en egen klon. |
| Registret | Produktionens projektdokument: `dragan` har `speechProfile` (enabled, motion-video). `paow` och `astrid` saknar profil. `media_records` för paow: 56 action, 34 idle (bankkällor i privat Blob) och 90 talklipp. |
| Vercel | Bara driftprofilen `baseline` (Dragans bank). Inga talnycklar, vilket är rätt. |
| Render | `CROUPIER_MOVING_SPEECH_ENABLED=0` (pausat). Streaming och dealerprofiler på. Bankpost, image-digest och endpoint pekar på Dragan. |
| RunPod, vårt konto | `zsudl8tmzcmiv1` stillbild (astrid-gpu-worker, min 0 max 1, idle 5 s, 24 GB Ada) och `zjsdlni6cn8dvo` rörligt (moving-gpu-worker, min 0 max 1, idle 60 s, 48 GB Ampere). Båda friska. Min 0 och kort idle ger kallstart per svar, vilket förklarar att Dragan upplevdes seg. |
| RunPod, Kevins konto | Egna endpoints per dealer (chattsvar Dragan och Paow med alltid en varm worker), Emils rörliga worker `fe1b55e` och poddar. Inget av det används av main. Nyckeln som delades i Slack bör roteras av Kevin. |
| Kevins kod | Kevins aktuella servermodul finns bara i GitHubs `kevin-staging` (`kevin/croupier-scoutgg/server/dragge-voice.mjs`, `rorlig-lipsync.mjs`). GitLab `scout-gg/croupier` är ett äldre projekt; bara grenen `emil/greenscreen-v3` har Paow-råmaterial (VILA.png, REDO.png, utdelningsklipp). |

## Hur kedjan ser ut i main

Spelmotorn på Render äger talprofilen, banken, RunPod-beställningen och budgeten. GPU-workern ringer tillbaka till Renders egen adress (`CROUPIER_MOVING_SPEECH_WORKER_ORIGIN` måste vara lika med `RENDER_EXTERNAL_URL`). Vercel är dörren mot webbläsaren: tjänsten `speech` tar emot WebSocket-vägarna (`/lipsync-moving/*`, `/moving-speech-stream`) och vidarebefordrar till Render, och Admin visar driftväljaren.

- Talprofil per dealer: `dealers[].speechProfile` i projektet (`services/game/dealer-speech-runtime.mjs`). Referens `video-frame` ger stillbildsvägen (ruta ur ett registerklipp via `dealer-speech-reference.mjs`, avatar per session till astrid-gpu-worker). Referens `motion-video` ger rörligt tal mot en bank.
- Banken är en-dealer: `CROUPIER_MOVING_SPEECH_BANK_RECORD` är en post, driftväljaren kräver exakt en profil (`ops/cloud/config.mjs`), och `services/game/moving-speech-runtime.mjs` svarar bara för bankens dealer (`supports: dealerId === bank.sourceSet.dealerId`).
- Vår worker (`services/moving-gpu-worker`) är Emils `rorlig-9` med kvittobundet protokoll: bankarkiv, kvitto, release-SHA och image-digest verifieras per jobb. Den talar inte Emils `prov`- eller sessionsprotokoll.

## Kevins och Emils uppsättning, för jämförelse

- Allt serverless, RTX 4090, en endpoint per dealer, `AVATAR_ID` i env styrde vilobilden. Kevin tog bort stillbildsvägen 27 oktober; dealers talar nu ovanpå idle-klippen.
- Rörlig läppsynk: Emils worker `EmaCodeHero/croupier-lipsync-worker` commit `fe1b55e971b1236fadd445ff6ce94970719b5d72`, image `ghcr.io/emacodehero/croupier-lipsync-worker:fe1b55e…` (manifest `sha256:14899b96…`). Avatarpaket `avatar-paow.tar` (75,1 MB, sha256 `0f1f3d9d…`, byggt ur `paow/v2/*.mp4` vid kevin-staging `74e91b14`) och `avatar-dragge.tar` (76,1 MB, `0280261f…`, ur `1d1a3129`). Vilan är sista rutan i `pos1-v`. Paketet är `pool.mp4` plus `takes.json` plus `prep/` (latents, masker). Vår `tools/build-moving-speech-bank.py` bygger samma sorts paket ur registrets verifierade källor och kan ta ett befintligt paket via `--pool`.
- Protokoll: arbetaren ringer upp spelet (`wss://<spel>/lipsync-rorlig?token=…&avatar=<id>`), får `start` med karta `[[tagning, förstaRuta, antal], …]` och PCM 24 kHz, svarar med `lapp` (H.264 256×512: färg överst, alfamask under, plus tagning, ruta och rect per ruta) och `done`. Ljudet börjar 0,22 s efter kartans första ruta. Spelet kräver minst 30 rutor/s.

## Proven 28 oktober

Båda proven kördes mot Kevins konto (hans varma endpoints), kostade sekunder GPU och rörde inga inställningar.

1. Stillbild. ElevenLabs `eleven_v3` (sv, stability 0,5, similarity 0,85, speaker boost), loudnorm -16 LUFS mono 16-bit, ett `runsync`-jobb `{op: "lipsync", wav_b64, crf: 13, preset: "ultrafast"}` till Paows chattsvars-endpoint, svar `mp4_b64`. 5,9 s tal gav 1080×1920, 24 fps, 160 rutor. Totalt 6,7 s, GPU 1,9 s, kö 0,2 s.
2. Rörligt. Emils rörliga endpoint har ett fristående provläge: `{op: "prov", avatar: "paow", wav_b64, karta: [["pos3-iv", 0, 60], ["vila", 0, 100]]}`. Svar: 14 delar med 160 lappar, 60,2 rutor/s, 3,3 s rendering (56 s kallstart). Lapparna ritades lokalt (PIL) ovanpå `paow/v2/pos3-iv.mp4` och `vila.png` ur kevin-staging, med ljudet 0,22 s efter första rutan. Resultat: Paow delar ut till plats 3 och talar samtidigt. Fem rutor saknade lapp, vilket är normalt vid övergång.

## Varför det inte bara aktiveras nu

1. Proven gick på Emils worker och avatarpaket på Kevins konto. Mains spelmotor kan inte beställa från dem: annat protokoll, och vår worker verifierar bank, kvitto, release och image-digest. Paow behöver en bank i vårt format på vårt konto.
2. Mains kedja klarar en dealer. Att peka bankposten på Paow byter ut Dragan, vilket Jakob och Kevin har sagt nej till. Per-dealer kräver kod.
3. Produktionen är fryst före O03 enligt masterplanen. Kevin: "gör inget nu".

## Aktivitet efter O03: dealer-generisk talkedja, Paow först

Spår 1, stillbild, enbart Admin-konfiguration (kan provas i staging direkt efter O03):

1. Lägg talprofil på paow: röst ur katalogen, `reference.kind = video-frame` mot ett Paow-idleklipp och `offsetMs` för vilorutan.
2. Prova stillbildsvägen per dealer i staging. Verifiera att sessionsjournalen är på (`generated-speech-stream.mjs`, kommentaren om "legacy avatar").
3. Sätt en varm worker (min 1) på stillbildsendpointen under öppettid, annars kallstart per svar.

Spår 2, rörligt tal per dealer, kod (PR på `jakob/claude-*`, review, grön CI):

4. `ops/cloud/config.mjs`: bankpost per dealer (karta dealerId till post, samma validering av `dealers/<id>/runtime/moving-bank/`), driftväljare per dealer, `moving_drift_control` nycklad per dealer.
5. `services/game/moving-speech-runtime.mjs` och `server.mjs`: bankkarta, `supports` per dealerId.
6. Bygg Paow-banken med `tools/build-moving-speech-bank.py` ur registrets 56 action och 34 idle (explicit vila: sista rutan i `pos1-v`), eller ur Emils `avatar-paow.tar` via `--pool`. Arkiv och kvitto till Blob, bankpost.
7. Admin: Paow-profil `motion-video`, driftprofil för Paow på Vercel och Render.
8. Staging med två banker, kvitton per dealer, budgettak. Sedan driftkvitto av O03-typ.

Spår 3, röstoberoende (Jakobs beslut): klona Paow och Dragge i ett eget ElevenLabs-konto från de sparade proven och byt voiceId i katalog och profiler.

## Ersätts och raderas när aktiviteten är klar

- Hårdkodade dealerställen i talkedjan: `dealer-chat-persona.mjs`, `product-speech.mjs`, `speech-routing.mjs`, `generated-speech-stream.mjs`, `server.mjs`, `moving-speech-budget.mjs`, `speech-package.mjs`, och listan med `paow` och `dregge` i `services/astrid-gpu-worker/gateway/moving-transport.mjs`.
- En-dealer-variabeln `CROUPIER_MOVING_SPEECH_BANK_RECORD` och kravet på exakt en driftprofil. Ersätts av per-dealer och dokumenteras i `ENVIRONMENT-VARIABLES.md` och `services/moving-gpu-worker/README.md`.
- Dealer Forge-katalogens hårdkodade PAOW-del (`apps/studio/lib/dealer-forge-catalog.mjs`) om Paow blir en vanlig registerdealer.
- Detta dokument raderas när aktiviteten är verifierad och innehållet står i de levande dokumenten.
