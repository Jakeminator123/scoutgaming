# Talkedjan: dealer-generisk, Paow först

Genomförandeplan för punkt 3 i masterplanens [Efter O03](../../migrering/MASTERPLAN.md#efter-o03), skriven 28 oktober 2026 efter att migreringen nått 100 %. Underlaget är [PAOW-LIPSYNC](PAOW-LIPSYNC.md) (#528, proven och verifierat läge) och Jakobs beslut samma natt: behåll hela GPU- och talspåret och gör det lika för alla dealers. Inget här är utfört; varje steg är en egen PR med grön CI och orkestratorn mergar. Bara Jakob godkänner ljud och läppsynk.

## Målbild

1. Varje dealer har inspelade repliker och genererat tal med läppsynk på GPU, styrt av chatten (Dialogtest och spelbordets chatt).
2. Röst, referens (stillbild eller rörligt), bank och driftprofil ställs in per dealer i Admin under **Röst och tal**.
3. Spelmotorn beställer tal som händelser; en taltjänst levererar media och strömmar.
4. Ingen dealer är ett specialfall i kod: inga hårdkodade dealerlistor, ID eller budgetnamn.
5. Dragan blir en dealer bland andra och byts aldrig ut i produktionen under arbetet.

## Nuläge och hinder

| Hinder | Var |
| --- | --- |
| Motorn kör en bank, en driftprofil, en endpoint och en budget per dealer sedan T3 (bankkartan `CROUPIER_MOVING_SPEECH_BANK_RECORDS`, driftläget per dealer i miljöns rad utan ny migrering). En öppen GPU-session åt gången i miljön gäller fortfarande, och en ny dealer behöver en egen endpoint | [ENVIRONMENT-VARIABLES](../ENVIRONMENT-VARIABLES.md#driftväljarens-api) |
| Admins driftväljare styr en dealer; med flera driftprofiler är Admins drift-API stängt tills T5 | `apps/studio/lib/moving-drift-admin.mjs` |
| Fast avatarlista i rörlig transport. Den gäller bara Emils oägda image, som produktionens konfiguration redan avvisar; den ägda vägen använder bankens verifierade `workerAvatar`. Kvar efter T3 (T3b: radera den oägda transportvägen och dess prov) | `services/astrid-gpu-worker/gateway/moving-transport.mjs:19` (`['paow', 'dragge']`), `services/game/moving-speech-transport.mjs` (`IMAGE`, `createMovingSpeechTransport`) |
| Admin kan inte slå på en rörlig referens: referenstypen följer den sparade profilen och rutan "Begär AI-tal" är låst för `motion-video` | `apps/studio/client/admin/components/studio/studio-speech-panel.tsx:114`, `:216` |
| Hårdkodade dealers i talet: personor, Astrids regler, röst och paketkontroll | `packages/presentation/contracts/dealer-chat-persona.mjs:29–33`, `packages/director/product-speech.mjs:132`, `:230`, `packages/director/speech-routing.mjs:11`, `services/game/generated-speech-stream.mjs:91`, `:241`, `packages/presentation/contracts/speech-package.mjs:80`, `:85`, `services/game/server.mjs` (`'astrid'` på 183, 526, 644, 706, 728, 747, 881, 946–947, 958, 1259) |
| Hårdkodade dealers i materialkatalogen | `services/game/games/blackjack/presentation/media-catalogue.mjs:27–30` (kontaktdata för dragge, paow, astrid2, marten), `material-revision.mjs:36–37` (`ASTRID_DEALS`, `KEYED`), `:47` (`timingSourceOf`), `k04-media.tsv` (kolumnen `dealer`, 1 293 rader) |
| Rösterna ligger i Kevins ElevenLabs-konto (Pro, cirka 780 000 av 979 000 tecken använda 28 oktober). Tar det slut tystnar Dragan och Paow | Render `croupier-v3` `ELEVENLABS_API_KEY`; voiceId i `packages/presentation/contracts/dealer-voice-catalog.json` |
| RunPod-mallen `5dkkc3wolw` för `zjsdlni6cn8dvo` har `MOVING_CALLBACK_ORIGIN=https://croupier-v2.onrender.com` (raderad). Workern avvisar varje jobb vars callback-värd inte stämmer | `services/moving-gpu-worker/contracts.py:102–109` |
| Rörligt tal är av i produktionen | Render `CROUPIER_MOVING_SPEECH_ENABLED=0` |
| Preview har ingen taluppsättning (inga talnycklar) och dess Blob tar godkänt material (Jakobs beslut 2026-10-28) | [START-HERE](../../START-HERE.md#preview), Blob `store_7E06N1P4w9Mu1dZD` |

Det som redan fungerar per dealer: talprofilen `dealers[].speechProfile` i projektet (`services/game/dealer-speech-runtime.mjs:82`), stillbildsvägen med `reference.kind = 'video-frame'` (`services/game/dealer-speech-reference.mjs:89` tar en ruta 1080×1920 ur ett registerklipp) och röstkatalogen per dealer.

## PR-sekvens

Ordningen gäller. "DDL" körs av Jakob; "env" dokumenteras i [ENVIRONMENT-VARIABLES](../ENVIRONMENT-VARIABLES.md) och `docs/environment-variables.json` i samma PR. Kodsteg görs av en underagent på `jakob/claude-*`, med review före merge.

### T1. Paow talar via stillbild (spår 1, ingen kod)

- **Syfte:** bevisa att stillbildsvägen lever för en annan dealer än Astrid, med enbart Admin-konfiguration.
- **Görs:** Admin → Dealers → Paow → Röst och tal. Röst ur katalogen (`WZVEBKUreb9jAKojf0QF`; sv `eleven_v3` 0,5/0,85/speaker boost, en `eleven_multilingual_v2` 0,38/0,8/style 0,3), referens `video-frame` mot ett av Paows vilaklipp, `offsetMs` på vilorutan (helst samma ruta som Kevins `talk_base.png`), granska rutan, "Begär AI-tal", spara.
- **Filer:** inga i koden. PR:n är bara ett kvitto `docs/<datum>-TALKEDJA-T1-ACCEPTANCE.json` (profilens revision, referensklippets ID och sha256, journalrad, reservation, GPU-tid).
- **I produktionen krävs:** inget nytt. Prodnyckeln ser rösten `WZVEBKUreb9jAKojf0QF`, streaming och dealerprofiler är på, stillbildsendpointen är `zsudl8tmzcmiv1`.
- **DDL:** nej. **Env:** nej.
- **Prov:** Dialogtest mot Paow: text → röst → läppsynk från stillbild. Kontrollera att sessionsjournalen tar svaret (`generated-speech-stream.mjs:239–243`: utan journal tas bara den gamla avataren emot) och att reservationen räknas mot `CROUPIER_SPEECH_RUNPOD_*`.
- **Preview:** först efter T2. Före dess bara i produktionens Dialogtest, med Paow otilldelad till bolag (Jakobs beslut).
- **Risk:** låg för spelet. Kallstart på `zsudl8tmzcmiv1` (min 0, idle 5 s) ger sega svar; vilorutan kan få grön kant av padden i `dealer-speech-reference.mjs:89`; Kevins teckenkvot.

### T2. Preview får taluppsättning

- **Syfte:** prova talet utan produktionens nycklar och budget (masterplanens punkt 10).
- **Filer:** `docs/ENVIRONMENT-VARIABLES.md` (preview-raden), ingen kod.
- **DDL:** nej. **Env:** ja, på preview-Render `croupier-k06-k07-staging`: egna `ELEVENLABS_API_KEY`, `RUNPOD_API_KEY`, `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`, `CROUPIER_GENERATED_SPEECH`, `CROUPIER_CLOUD_GENERATED_SPEECH`, `CROUPIER_GENERATED_SPEECH_STREAMING` med sina hemligheter, `CROUPIER_DEALER_SPEECH_PROFILES` och `OPENCLAW_PRODUCT_SPEECH_URL`/`_TOKEN`. Produktionens nycklar kopieras aldrig.
- **Prov:** `node ops/cloud/start.mjs --check` på preview, sedan T1:s prov i preview.
- **Risk:** kostnad. Preview-Blob tar godkänt material (Jakobs beslut 2026-10-28), så riktig Paow-media får ligga där men kostnad för generering och bank i preview kräver fortfarande Jakobs beslut.

### Före T3: callback-adressen

Jakob kör `python -I fixa-callback-origin.py --kör` i `Desktop\_SCOUT\info-lipsync` (mallen `5dkkc3wolw` får `https://croupier-v3.onrender.com`; kopian före ändringen ligger bredvid), och sedan `python -I kontrollera.py`. Utan det kan inget rörligt tal fungera, inte heller Dragans.

### T3. Rörligt tal per dealer i motorn (spår 2, kod)

- **Syfte:** flera banker och driftprofiler i samma miljö, utan att Dragan ändras.
- **Filer:** `ops/cloud/config.mjs` (bankkarta dealerId → post, t.ex. `CROUPIER_MOVING_SPEECH_BANK_RECORDS`, samma validering av `dealers/<id>/runtime/moving-bank/`; en driftprofil per dealer med `dealerId`), `packages/presentation/contracts/moving-drift.mjs`, `services/game/moving-drift-*.mjs` och `postgres-moving-drift.mjs` (läget nycklat per dealer), `services/game/moving-speech-runtime.mjs:242` (uppslag per dealerId), `services/game/server.mjs:1188–1249` (ladda alla banker, ta bort `'dragan'`-kravet), `services/game/moving-speech-budget.mjs:15` (budget per dealer), `services/astrid-gpu-worker/gateway/moving-transport.mjs:19` (bara verifierad bindning), `test/cloud-config.mjs`, `services/moving-gpu-worker/README.md`.
- **DDL:** nej om driftläget per dealer ryms i `state` (jsonb, högst 32 kB, en rad per miljö); annars en ny migrering i `ops/neon-studio/` som Jakob kör. Avgörs i PR:n innan kod skrivs.
- **Env:** ja. Den gamla bankvariabeln ersätts och raderas i samma PR. Produktionen har `CROUPIER_MOVING_SPEECH_ENABLED=0`, så bankvariablerna läses inte där och bytet kräver inget samtidigt fönster.
- **Prov:** enhetstester med två syntetiska banker (Dragan oförändrad, en andra dealer), `start.mjs --check` med båda.
- **Preview:** deploy med låst SHA, rörligt tal av: motorn startar som förut. Med på kräver en bank i preview (Jakobs beslut, se T2).
- **Risk:** medel. Kvittobundna kontroller (bank, kvitto, release, image-digest) får inte försvagas när de blir per dealer.
- **Genomfört (#549):** allt ovan utom avatarlistan i `moving-transport.mjs`, som flyttar till T3b. DDL: nej. Env: `CROUPIER_MOVING_SPEECH_BANK_RECORD` och `CROUPIER_MOVING_SPEECH_ENDPOINT_ID` raderade, `CROUPIER_MOVING_SPEECH_BANK_RECORDS` ny, `dealerId` krävs i varje driftprofil på Vercel och Render.

### T4. Paows bank byggs (spår 2, GPU och Blob)

- **Syfte:** en bank i vårt format på vårt konto.
- **Görs:** `sources.json` ur registrets 56 action och 34 vila för paow (UUID, sha256, bytes, 24 fps, frameCount, 1080×1920) och en uttrycklig vila (videoId och ruta; Emils paket använder sista rutan i `pos1-v`). `tools/build-moving-speech-bank.py --prepare-with <worker>` på GPU, eller Emils `avatar-paow.tar` via `--pool`. Arkiv och kvitto till produktionens privata Blob under `croupier/media/dealers/paow/runtime/moving-bank/`.
- **Filer:** inga i koden om verktyget räcker; PR:n är kvittot (bankens sha256, källornas ID och sha256, worker-release).
- **DDL:** nej. **Env:** ja, Paows post i bankkartan på Render (rörligt tal fortfarande av).
- **Prov:** verktygets egen kontroll av källorna och kvittot; motorn verifierar arkivets hash vid start.
- **Risk:** låg för spelet, kostar GPU-minuter. Fel vila ger hopp i övergången till vila.

### T5. Paow får rörligt tal i Admin (spår 2, kod och drift)

- **Syfte:** välja referenstyp och driftprofil per dealer i Admin och prova två banker i samma miljö.
- **Filer:** `apps/studio/client/admin/components/studio/studio-speech-panel.tsx:114`, `:216` (välj `video-frame` eller `motion-video`, låt rutan slås på mot en verifierad bank), Admins driftväljare per dealer, `apps/studio/docs/README.md`.
- **DDL:** nej. **Env:** ja, driftprofil för Paow i `CROUPIER_STUDIO_MOVING_DRIFT_PROFILES` på Vercel och Render (endpointId, releaseDigest, bankHash).
- **Prov:** `CROUPIER_MOVING_SPEECH_ENABLED=1` i preview eller i ett av Jakob godkänt fönster: Dragan och Paow i samma miljö, kvitto per dealer, budgettak, sedan driftkvitto av O03-typ.
- **Preview:** Admin → Paow → Röst och tal → rörlig referens → Dialogtest → spelad hand → omladdning.
- **Risk:** medel. Rörligt tal i produktionen slås på först när Jakob säger till.

### T6. Hårdkodade dealers bort (spår 2, städning)

- **Syfte:** målbildens punkt 4.
- **Filer:** personorna i `dealer-chat-persona.mjs:29–33` flyttar till dealerns post i registret; Astrid-grenarna i `product-speech.mjs`, `speech-routing.mjs`, `speech-package.mjs`, `generated-speech-stream.mjs` och `server.mjs` blir dealergeneriska eller raderas med Astrid; materialkatalogens dealerlistor i `media-catalogue.mjs`, `material-revision.mjs` och `k04-media.tsv` ersätts av registrets data.
- **DDL:** nej. **Env:** nej.
- **Prov:** hela testsviten; gamla tester som låser Astrid- eller Dragan-beteende avvecklas i samma PR.
- **Preview:** spelad hand med Dragan och Paow, Dialogtest för båda.
- **Risk:** medel. Materialkatalogen ingår i materialrevisionens hash (`material-revision.mjs:103`); ändras katalogen ändras revisionen och spelbordets material måste publiceras om. Görs därför som egen PR, gärna i två (tal, material).

### T7. Egen röst (spår 3, ingen kod utom katalogen)

- **Syfte:** bli oberoende av Kevins konto och teckenkvot.
- **Görs:** klona Paow och Dragge i ett eget ElevenLabs-konto ur Kevins originalprov (de sparade proven, 7 s respektive 30 s, räcker men är korta). Byt nyckel och voiceId i **ett fönster**: `ELEVENLABS_API_KEY` på Render, voiceId i `packages/presentation/contracts/dealer-voice-catalog.json` och i talprofilerna i Admin. En saknad röst ger fel, aldrig en annan dealers röst.
- **DDL:** nej. **Env:** ja, en nyckel byts.
- **Prov:** ett svar per dealer och språk i Dialogtest; Jakob godkänner rösten.
- **Preview:** samma prov med preview-nyckeln först.
- **Risk:** låg tekniskt; rösten kan låta annorlunda.

### T8. Taltjänsten ut ur motorn

- **Syfte:** `croupier-v3` blir ren kort, sko och matte. Gränsen: motorn skickar händelser (talbegäran med dealer, spelbord, runda, replik eller chattsvar), taltjänsten levererar media och strömmar till spelaren.
- **Först en plan-PR** (docs) med kontrakt, tjänstens namn (inte `croupier-speech`, som är en OpenClaw-roll), ägarskap för journal, budget, banker och driftväljare, och hur `apps/speech` på Vercel pekar om.
- **Filer, sedan:** `services/game/generated-speech-*`, `moving-speech-*`, `dealer-speech-*`, `moving-drift-*`, `packages/director`, `services/astrid-gpu-worker/gateway/` (det rörliga flyttar ut), `apps/speech`.
- **DDL:** ja (egen roll och behörigheter för talets tabeller), Jakob kör. **Env:** ja, talnycklarna flyttar från `croupier-v3` till den nya tjänsten.
- **Prov och preview:** som T5, plus att spelet fungerar med taltjänsten nere.
- **Risk:** hög. Görs sist, efter Jakobs godkännande av T5 och T7.

## Jakob beslutar och gör

1. **ElevenLabs-konto:** eget konto för klonerna (T7) och vem som betalar.
2. **Be Kevin om originalproven** för Paow och Dragge (ljudfilerna han klonade från).
3. **Preview-taluppsättning (T2):** ja eller nej, med kostnad (egna nycklar, egen budget, GPU), och om riktig dealermedia och bank får ligga i preview-Blob.
4. **T1 i produktionen:** får Paows profil sparas i produktionens Admin för Dialogtest innan preview har tal?
5. **Kör `fixa-callback-origin.py --kör`** före T3:s prov.
6. **När rörligt tal får slås på i produktionen** (`CROUPIER_MOVING_SPEECH_ENABLED=1`), och om en varm worker (min 1, kostar per timme) ska gälla under öppettid för stillbild respektive rörligt.
7. **DDL** om T3 eller T8 kräver migrering.

## Raderas när kedjan är klar

- Avatarlistan i `moving-transport.mjs` och Emils oägda transportväg (T3b). En-dealer-variabeln, kravet på exakt en driftprofil, `'dragan'`-kravet och budgetkonstanten raderades i T3.
- Hårdkodade dealerlistor i talet och materialkatalogen, och tester som låser dem (T6).
- PAOW-delen i Skapa material (Dealer Forge, `apps/studio/lib/dealer-forge-catalog.mjs`), om Paow blir en vanlig registerdealer, enligt [PAOW-LIPSYNC](PAOW-LIPSYNC.md).
- [PAOW-LIPSYNC](PAOW-LIPSYNC.md) och detta dokument, när kedjan är verifierad och innehållet står i de levande dokumenten.
