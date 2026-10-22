# K05: Kevins mappningssystem → mains klippkarta (2026-10-22)

Jakobs beslut 22 oktober (#312, 6348346212 p4 och koordinatorns omprioritering): **inga av Kevins mediabytes importeras nu.** Det som ska över är Kevins *system* för att binda klipp till klippkort, fack och varianter, uttryckt i mains befintliga kategorisystem (TERMINOLOGI: kategori → situation → standardklipp + varianter). Detta dokument jämför de två systemen begrepp för begrepp och listar exakt vad mains klippkarta saknar. Inget här skriver till Neon eller Blob; ingen status ändras.

Källor, lästa read-only:

| Sida | Fryst källa | Filer |
| --- | --- | --- |
| K (Kevin) | `kevin-merge-admin` @ `5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc`, under `kevin/croupier-scoutgg/` | `public/dealers.js`, `public/runtime-event-links.js`, `public/game-events.js`, `public/idle-chain.js`, `server/media-registry.mjs`, `server/shared-table.mjs:56-135`, `server/server.mjs:82-105`, `public/media/dealers/{dragge,paow,astrid2,marten}/v2/meta.json`, `public/media/manifest.json`, `public/media/dealers/dragge/repliker/sv/texter.json` |
| M (main) | `main` @ `7afae426` (bas för `codex/k05-importplan`) | `packages/presentation/contracts/{clip-naming,video-intake,dealer-clip-guide,speech-lines,speech-slot-bindings,filmed-profile,recorded-speech,material-catalog}.mjs`, `contracts/policies/{studio-contract,project.seed}.json`, `contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs`, `packages/presentation/runtime/{media-families,idle-policy,registered-idle-policy,media-family-policy,filmed-deal-sequence,filmed-deal-timeline}.mjs`, `apps/studio/client/admin/lib/connected-studio.mjs`, `services/game/games/blackjack/presentation/{media-catalogue,room-idle}.mjs` (K04 på main), `docs/games/blackjack/DEALERBANK.md`, `docs/games/KLIPP-OCH-FORMAT.md`, `apps/studio/docs/TERMINOLOGI.md` |
| K05-matris | main `migrering/kevin-ks-migrering/K05/K05-matris.tsv` (1 325 rader; 159cc134 + fyra greetingrader enligt 6339673965) | inventeringen i avsnitt 5 |

## 1. Kort: så fungerar Kevins system

- **Dealerregister** `DEALERS[id]` (`dealers.js:66-92`): per dealer `still` (rumsbild med inbakat bord), `keyed.still` (frilagd VILA-bild `v2/vila.png`), `face`, `ready` (`in`, `land`, `card`), `clips` (takemapp), `lines` (språk), `linesDir`, `idles` (lista med `vikt`, `dur`, `calm`), `faceTracks`, `handMatte`, `layerScale`. `PUBLIC_HIDDEN` döljer Mårten i publika demon. `pick()` faller tyst tillbaka på Astrid.
- **Deal-tagningar**: filnamn `pos1..pos7`, `posdealer`, `hole`, `flip` i `v2/`, var och en i varianterna `''`, `-i`, `-u`, `-iu`, `-v`, `-iv` (`dealers.js:14`, `meta.json.frames`). `i` = VILA → in i tagningen, `u` = tagningen → ut till VILA (REDO-tagning plus gång tillbaka), `v` = Emils *rest take* som landar i VILA med eget kortspår `<take>v` (`shared-table.mjs:125-128`). `readyTimeline` namnger varje stegs variant: `i` öppnar en körning, `u` stänger den, tagningar fogas REDO→REDO med 80 ms mellan ofogade tagningar, plan öppnar 700/1500 ms efter kommando. `restStart`/`restEnd` i meta anger tagningar som börjar/slutar i VILA (hole, flip).
- **Kontakt och geometri** (`meta.json`): `in`/`ut` (övergångsrutor), `land[track]` (rutan där kortet vilar; en andra mätning finns i `dealers.js` `*_READY.land`), `centre[track]`, `frames[track][variant]`, `props` (kortstorlek per plats), `card`. `faceTracks` ger kortets planara spår per tagning.
- **Idle**: viktad pool per dealer (`vikt` 20/8/6/4/3), `dur`, `beskrivning`, `calm` via regex `CALM_IDLE` (andas, andasb, djupandetag, fingrar, axlar, rakrygg, vikt). Under väntan på spelare spelas bara `calm` (`shared-table.mjs:208-211`); huvudvridningar, blickar och nickar bara mellan rundor och under tal. `pickWeighted` väljer aldrig samma tagning två gånger i rad; `layChain` lägger en deterministisk kedja som server, klient och lipsync-worker delar (`idle-chain.js`).
- **Repliker**: `repliker/<språk>/<line>_<take>.mp4` + `texter.json` (exakt text per take). Händelsenamn: `goodluck, sidebet, insurance, double, bust, blackjack, dealerblackjack, dealerbust, win, push, lose` (`media-registry.mjs:3` GAME_SPEECH) plus `greeting, placebets, peek, farewell, chatter1, chatter2` (manifest `handelser`) och Kevins egna `twentyone, remark_hit17/hit20/stand11, banter, table_cash, table_trust, greet_<namn>`. Servern räknar antal takes per händelse (`server.mjs:98-105`, allt-eller-inget med `twentyone`) och `variantOf` slumpar bland dem utan upprepning (`shared-table.mjs:75-82`). `calls`: blackjack/21 ropas när kortet landar (`game-events.js:26-53`). `outcomeSpeech` prioriterar dealerblackjack > blackjack > dealerbust (bara om ingen spelare blev tjock) > win > push > lose. `dealerLineUrl` faller tillbaka på engelska när språket saknas; Mårten utan repliker får bara text.
- **Klassning av filer** (`media-registry.mjs`): `category: gameplay | legacy_training`, `binding`-text per klipp; `sidebet` aktiv variant är `sidebet_2`; oregistrerade filer är `training only`.
- **Händelse-ID:n**: `runtime-event-links.js` översätter redan Kevins steg till **mains** katalog-ID:n (`deal.player.left/centre/right`, `deal.dealer`, `reveal.dealer`, `speak.goodluck/insurance/double/other`, `settle.*`, `idle.ready`) mot `CATALOG_COMMIT d321e3f5`. Kevin har alltså redan anpassat sig till mains händelsenamn; skillnaden ligger i situationer, varianter och idle.

## 2. Kort: mains klippkarta

- **Händelser** (`policies/studio-contract.json`, 17 st): `speak.goodluck|insurance|double` (egna), `speak.other` med situationerna `placebets, dealerblackjack, blackjack, dealerbust, win, push, lose, greeting, peek, bust, sidebet, chatter1, chatter2, farewell`; `deal.player.left/box0,box1`, `deal.player.centre/box2-4`, `deal.player.right/box5,box6`, `deal.dealer/dealer-up,dealer-hole`, `reveal.dealer/dealer-hole`, `idle.ready`, `transition.shoe/to-shoe,from-shoe`; `turn.*`/`settle.*` är körvillkor, inte fack (`video-intake.mjs:31`).
- **Fack** = `event/situation` (`connected-studio.mjs:13-26` `clipSlots`), `kind` = idle | action | speech | reaction, `role` = standard | alternativ (`limits.alternatives: 4`), `playback` = bara `once`; loop ligger i idlepolicyn. **Familjer** (`media-families.mjs`, Astrid): `standardIds`/`variantIds`, `playbackType once | idle-pool`. **Variantpolicy** (`media-family-policy.mjs`): högst 4 varianter per familj med `selection {rules, model, random}`, `priority`, `triggerIds`, `frequencyPercent`; standard för nya alternativ är `random:false`.
- **Poseversioner** (`clip-naming.mjs`): `base` REDO→REDO, `i` VILA→REDO, `v` REDO→VILA, `iv` VILA→VILA; `u`→`v` och `iu`→`iv` är *alias* vid namntolkning. Klassificeringen lagrar `startPose`/`endPose` (`video.schema.json`, `validateClipPoses`). **Filmad profil** (`filmed-profile.mjs`) tar däremot varianterna `'', i, u, iu, v, iv` med eget `track` (`<take>v`), `frames`, `contactFrame`, `landFrame`, `clearFrame`, `startPose`, `endPose`; `planFilmedDealSequence` räknar `i`/`u` per steg och uppgraderar `u`→`v` när en rest take finns (`filmed-deal-sequence.mjs:54-58`). `filmed-deal-timeline.mjs` är Kevins `readyTimeline` (80 ms, 700/1500 ms, handover 1,5 rutor). Dragan har profil `kevin-dragan-f15b2af1` med 35 takes (alla `base/i/v/iv` för 1–7 och dealer, `hole:base/i`, `flip:base`); **inga `u`/`iu`-takes** och inga profiler för paow, astrid2, marten.
- **Idle** (`idle-policy.mjs`): `base` 1–4 grundloopar med `weight` (summa 100) och `durationMs`; `variants` ≤ 30 engångsklipp med `use manual | automatic | rules | openclaw`, `automatic {averageEveryMs, jitterMs, cooldownMs, maxPerMinute}`, `description` ≤ 80 tecken. K04 på main (`room-idle.mjs`, `media-catalogue.mjs:107-112`) bär Kevins `vikt` och `calm` (anmärkning `lugn`) för rumskedjan, men utanför Admin-klippkartan.
- **Tal**: `SPEECH_LINES` (17 line-ID:n, `speech-lines.mjs`), standard per fack + alternativ (`speech-slot-bindings.mjs`), `recordedSpeech` per take med `lineId, takeId, language, exactText, videoSha256, audioSha256, indexSha256, fps, frameCount, audioDelayMs, entryPose, exitPose, calibrationRevision` plus `recording verified-recording` och `review approved` (`recorded-speech.mjs:5-6,57-58`). `CLIP_LANGUAGES` = sv, en, es, no, da, fi, de, fr (namnråd); bordsspråk en/sv (beslut).
- **Klippguiden** (`dealer-clip-guide.mjs:84-100`) förklarar redan Kevins namn (`pos<n>[-i|-v|-iv]`, `hole/hole-i`, `flip`, VILA/REDO-skillnader mot Forge) utan att göra dem till identitet.

## 3. Jämförelsetabell: Kevin-begrepp → main-begrepp → status

Status: **finns** = samma begrepp; **annat namn** = finns med annan benämning/plats; **delvis** = finns men inte hela Kevins betydelse; **saknas** = ingen motsvarighet i mains klippkarta.

### 3a. Dealer och scen

| Kevin-begrepp | Main-begrepp | Status | Anmärkning |
| --- | --- | --- | --- |
| `DEALERS[id]` dealer-ID `dragge`, `paow`, `astrid2`, `marten`, `astrid` | `project.dealers[{id,label}]`, `isDealerId` (`dealer-identity.mjs`) | annat namn | `dragge`→`dragan` (belagt av 43 exakta hashar), `paow`→`paow-kevin` (i `dealerTrash`), `astrid2` och `marten` oregistrerade, Kevins Astrid classic ≠ mains `astrid` (andra bytes). Kopplingen bärs av hash, aldrig namn. |
| `name`/`label` (Dragan visas, id dragge) | `dealers[].label` | finns | |
| `still` = rumsbild med inbakat bord (`rooms-v2/*.png`) | Bakgrundslager + bordslager (`material-catalog.mjs`, `layer-asset-contract.mjs`), TERMINOLOGI tre lager | annat namn / avsiktligt ej | Inbakat bord kan inte bytas separat; tvålagersmodellen är utesluten (MASTERPLAN). K05: `ej-vald:delad-ui/rum`. |
| `ROOMS` (darkhall, mahogany, golden, azure; `still`, `thumb`, `wide`) | `BACKGROUND_MATERIALS` design-ID:n med sha256/size/width/height | annat namn | Mains ID är design, inte rum. Kevins PNG har ingen sha-träff i katalogen. |
| `keyed.still` (`v2/vila.png`, frilagd VILA) | `pose/vila` referensbild (`clip-naming.mjs:126`, `dealer-clip-guide.mjs:44-52`); K05: katalogpost `still/keyed-still` med `mediaId:null` | finns (referens) | Lagras inte i klippbanken; via katalog + J08-adapterns stillbildsväg (PR334). |
| `redo.png` | `pose/redo` | finns | |
| `face` (ansiktsbild i väljaren) | – | saknas (ej behov) | K05: `ej-vald:ansiktsbild`. Admin visar dealers via `label`. |
| `layerScale`, `handMatte` | `composition-settings.mjs`, `dealer-compositing.mjs`, K04-matte på main | annat namn | |
| `PUBLIC_HIDDEN` (dölj Mårten publikt) | Operatörens tillåtna dealers / `dealerSets` / rumspublicering | annat namn | Ingen dealerflagga; synlighet styrs per operatör och rum, vilket täcker behovet. |
| `pick()` → tyst fallback till Astrid | Ingen tyst fallback; saknat stöd nekas vid publicering | avsiktligt saknas | K05-regel. |
| `card: [78,106]`, `props` per plats | `profile.card {width,height}` | delvis | Main har en kortstorlek per profil, inte per plats. |

### 3b. Korthandlingar (deal/reveal) och varianter

| Kevin-begrepp | Main-begrepp | Status | Anmärkning |
| --- | --- | --- | --- |
| Take `pos1..pos7` | `deal.player.left/box0,box1`, `centre/box2-4`, `right/box5,box6` | annat namn | 1-baserat ↔ 0-baserat; mappat i `clip-naming.mjs:32,72-75`, `media-families.mjs:6-15`, `media-catalogue.mjs:63-68`. |
| `posdealer` | `deal.dealer/dealer-up` | annat namn | |
| `hole` (REDO→VILA), `hole-i` (VILA→VILA) | `deal.dealer/dealer-hole` + `startPose/endPose` | finns | Klippguiden varnar för Forge-mallens REDO→REDO. |
| `flip` (VILA→VILA) | `reveal.dealer/dealer-hole` | finns | `REST_TAKES` finns i K04 `media-catalogue.mjs:33`. |
| Variant `''` (bas) REDO→REDO | `base` | finns | |
| Variant `-i` VILA→REDO | `i` | finns | |
| Variant `-iv` VILA→VILA (rest take) | `iv` | finns | |
| Variant `-v` REDO→VILA (Emils rest take, eget spår `<take>v`) | `v` | finns i profil, **delvis** i klippkartan | Profilen skiljer `v` från `u`; klassificeringen har bara `startPose/endPose` och ser båda som REDO→VILA. |
| Variant `-u` (tagning + gång tillbaka till VILA), `-iu` | `u`, `iu` i `filmed-profile.mjs:51`; alias `u→v`, `iu→iv` i `clip-naming.mjs:24` | **saknas i klippkartan** | Olika bytes, olika landningsrutor (K05-mappning §3). Dragans profil har inga `u/iu`-takes; namntolkningen slår ihop dem med `v/iv`. |
| `readyVariant`/`readyTimeline` (i öppnar, u stänger, fog REDO→REDO, 80 ms, 700/1500 ms) | `planFilmedDealSequence` + `filmed-deal-timeline.mjs` | finns | K04 på main. |
| `restStart`/`restEnd` per take | `startPose`/`endPose` per take i profilen | finns | |
| `meta.frames[track][variant]` | `take.frames` | finns | |
| `land[track]` (två mätningar: dealers.js och meta.json) | `READY_CONTACT` (dealers.js-värdena, `media-catalogue.mjs:26-31`), `take.landFrame/contactFrame/clearFrame`; `timingEvidence: kevin-runtime-land-override` | finns | Avvikelsen dokumenterad i K05-mappning §5; klientkontakt följer dealers.js. |
| `in` (rutor som `-i` lägger före tagningen) | `contactFrame` = land + in (`media-catalogue.mjs:80-86`), `variantOffset` | finns | |
| `ut` | – | saknas (används ej) | Kevins runtime använder inte `ut`. |
| `centre[track]` inkl. `hole`, `flip` | `profile.positions 1-7, dealer {cx,cy}` | delvis | Hole/flip har ingen egen position; dealerpositionen används. |
| `faceTracks` (kortets planara spår per tagning) | `profile.tracks[name].frames[{q,p,body,paper}]` | finns för Dragan | Saknas för paow, astrid2, marten (inga profiler). K05: JS-filerna är källbevis, inte runtimeidentitet. |
| `game-events.planDraws` (`clipId deal_pos<seat>/deal_hole`, `track`) | `filmedDealTarget(event)` ur serverns `to/box/faceDown` | finns | Main härleder ur spelhändelsen, inte ur klient-ID. |
| Astrids `/media/deal/<id>.mp4` → dealerns take (`dealerClipUrl`) | Astrid-familjer `astrid/deal.*/box*` med `standardPaths` | finns | |

### 3c. Vila/idle

| Kevin-begrepp | Main-begrepp | Status | Anmärkning |
| --- | --- | --- | --- |
| Idlepool per dealer (`idles[]`, 21 takes för dragge, 23 paow, 9 astrid2, 3 marten) | `idle.ready/ready`-familj: `idlePolicy.base` (1–4) + `variants` (≤30) | **delvis** | Mains grundloop är högst 4 viktade basklipp; Kevins pool är 9–23 viktade takes som alla är "grundloop". |
| `vikt` (20/8/6/4/3) | `base[].weight` (summa 100) | delvis | Bara för basklippen; `variants` har intervall, ingen vikt. |
| `dur` | `durationMs` | finns | |
| `beskrivning` | `variants[].description` (≤80) | finns | Saknas för `base`. |
| `calm` (lugn: andas/axlar/rakrygg/vikt/fingrar; livlig bara mellan rundor/under tal) | `media-catalogue.mjs` anmärkning `lugn` + `room-idle.mjs:50-53` (K04-rum) | **saknas i klippkartan** | Finns bara i K04:s katalogfil, inte i Admin/idlepolicy/videoklassificering. |
| Väntan på spelare = bara calm-takes | `room-idle.mjs waitClips` | finns (K04-rum) | Ingen Admin-inställning. |
| `pickWeighted` aldrig samma två gånger i rad | `room-idle.mjs pickWeighted` (K04-rum); live-idle per betraktare saknar regeln | delvis | |
| `layChain` (deterministisk kedja server/klient/worker) | `room-idle.mjs layChain`, live-idle `server-chain` | finns | |
| Tal över idlekedja (`withIdle`, lipsync-worker) | moving-lipsync + live-idle server-chain (K04 I2) | delvis | Utanför klippkartan; kräver worker. |
| Kling-loopar `idle-v2/{breath,glance,smile}` (Mårten; utfasade för dragge/paow) | `idle.ready` grundloop (Kevin V2 andning är levande Dragan-grundloop) | finns | |
| Astrid classic `idle/{still,breath,glance,cheek,insulted}` med vikt | Astrid `idle-pool`-familj | finns | |

### 3d. Talade repliker

| Kevin-begrepp | Main-begrepp | Status | Anmärkning |
| --- | --- | --- | --- |
| `goodluck`, `insurance`, `double` | `speak.goodluck/goodluck`, `speak.insurance/insurance`, `speak.double/double` | finns | Samma namn. |
| `placebets, greeting, peek, sidebet, bust, blackjack, dealerblackjack, dealerbust, win, push, lose, chatter1, chatter2, farewell` | `speak.other/<samma namn>` | finns | Samma namn (`SPEECH_LINES`). |
| `<line>_<take>` (take-nummer i filnamn) | `recordedSpeech.takeId` + `clip-naming` `take` (notering) | finns | Main-takeId är fritt (`[a-z][a-z0-9_-]`); Jakob använde UUID som takeId i 6340621499. |
| `texter.json` (exakt text per take och språk) | `recordedSpeech.exactText` | finns | |
| `twentyone` (21 på fler kort, ropas vid landning) | – | **saknas** | G13, uppskjuten (6329902583 p2). Inget fack i `SPEECH_LINES`/`speak.other`. |
| `remark_hit17`, `remark_hit20`, `remark_stand11` (kommentar på spelarbeslut) | – | **saknas** | G13. Närmast `probe`/OpenClaw-text, men det är genererat tal, inte inspelad take. |
| `banter`, `table_cash`, `table_trust` | – | **saknas** | G13. |
| `greet_<namn>` (personliga hälsningar: guest, kevin, axel, john, emil, fredrik, jakob, ian) | – | **saknas** | G13. Persona-/spelarnamn hör till OpenClaw-flödet (`dealer-clip-guide` `probe`), inte ett klippfack. |
| Antal takes per rad: bust 7, blackjack 7, twentyone 7, övriga 3 | standard + högst 4 alternativ (`limits.alternatives`, `MAX_ALTERNATIVES`) | **delvis** | 7 takes ryms inte (5 platser). |
| `variantOf`: slumpa bland takes, aldrig samma två gånger | `selection.random` (standard `false`), `frequencyPercent`; ingen "inte samma igen"-regel | **delvis** | Kevins regel är ett serverval per händelse; main har flaggan men ingen minnesregel. |
| `ready.variants[event]` allt-eller-inget med `twentyone` | – | saknas (regel) | Kopplingsregel i Kevins server, inte klippkarta. |
| `calls` (blackjack/21 ropas när kortet landar, mitt i givningen) | `speak.other/blackjack` som resultatreplik; timing i K04-presentationen | delvis | Facket finns; "vid landning"-tidpunkten är presentationslogik. |
| `outcomeSpeech` (dealerblackjack > blackjack > dealerbust om ingen tjock > win > push > lose) | `settle.*` körvillkor + talfack; regeln bor i K03/K04-servern | annat ställe | Inte ett klippkartsbegrepp. |
| `dealerLineUrl` fallback till engelska | nekas: "ingen tyst språkfallback" (masterplan N1) | avsiktligt saknas | |
| `lines: null` (Mårten: bara text) | `speech.defaultSource: openclaw-text` | annat namn | |
| Språk `sv, en, pt, ko` (dragge/paow), `en, pt, ko` (astrid2), rot `es, fr, zh` | `CLIP_LANGUAGES` sv, en, es, no, da, fi, de, fr; bordsspråk en/sv | **delvis** | `pt`, `ko`, `zh` saknas i namnrådet; `recordedSpeech.language` tar vilken ISO-kod som helst. K05: `ej-vald:sprak-utanfor-en/sv` (500 rader). |
| `rost` (Cartesia/ElevenLabs-röst per dealer) | `dealer-voice-catalog`, `dealer-speech-profile` | annat namn | |
| `category gameplay / legacy_training`, `binding` | `role standard/alternative`, `archived`, oregistrerat = ej i banken | annat namn | "training only" ≈ ej registrerad/arkiverad. |
| `sidebet_2` som aktiv variant | standardtagning per fack (`speechSlotStandard`) | finns | |
| Attestering (`audioSha256`, `indexSha256`, `audioDelayMs`, `entryPose/exitPose`, `calibrationRevision`, `verified-recording`, `approved`) | krävs av `recorded-speech.mjs` | **saknas hos Kevin**, finns i main | Ljudet är inbäddat i mp4; ingen producent i main (`dealer-import-plan.mjs:173`). Blockerar talgrinden (6336757098). |

### 3e. Händelsekoppling och klassning

| Kevin-begrepp | Main-begrepp | Status | Anmärkning |
| --- | --- | --- | --- |
| `catalogEventForStep` (steg → `deal.player.*`, `reveal.dealer`, `speak.*`, `settle.*`, `idle.ready`) | mains händelsekatalog | finns | Kevin använder redan mains ID:n (`CATALOG_COMMIT d321e3f5`). |
| `placebets` → `idle.ready` (runtime-event-links) men `speak.other/placebets` i K04 | `speak.other/placebets` | annat namn (inkonsekvens hos Kevin) | Följ K04/main: placebets är tal. |
| `manifest.handelser[event].varianter` | fackets standard + alternativ | finns | |
| `manifest.format`, `kort_storlek`, `startbild` | KLIPP-OCH-FORMAT, `profile.card`, Astrid-presentationsbank | finns | |
| `media-registry.mediaInventory` (okända filer = training only) | ingen filskanning; bara registrerade poster | annat namn | |
| `CATALOGUE_SOURCE` (K04-raden binder Kevin-commit + sha) | finns i `media-catalogue.mjs:12-14` | finns | |

## 4. Vad mains klippkarta behöver för att uttrycka Kevins mappning

Konkret, i prioritetsordning. Inget av detta är beställt här; listan är beslutsunderlag för Jakob. Bakgrund, dealer och bord förblir tre separata lager.

1. **Poseversion som exakt fält, inte alias.** Lägg `poseVariant: 'base'|'i'|'u'|'iu'|'v'|'iv'` (K04:s `DEAL_VARIANTS`) i videoklassificeringen för deal-/revealklipp vid sidan av `startPose/endPose`, och sluta normalisera `u→v`/`iu→iv` i `clip-naming.mjs:24` för registrerade poseversioner. Profilen (`filmed-profile.mjs`) kan redan bära alla sex; luckan är Admin-klippkartan och namntolkningen. Per plats blir det då upp till sex tagningar med egna kortspår (`<take>` och `<take>v`), som TERMINOLOGI kallar "tekniska poseversioner, inte beteendevarianter".
2. **Idlepool med fler än fyra viktade takes och en lugn-/livlig-klass.** Dagens `idlePolicy.base` (1–4, vikt summa 100) + `variants` (intervallstyrda engångsklipp) rymmer inte Kevins 9–23 viktade takes. Minsta tillägg: antingen höj `base` till ≥ 24 med relativa vikter, eller ge `variants[]` ett `use: 'pool'` med `weight`. Lägg dessutom `calm: boolean` (eller `idleUse: 'wait'|'between-rounds'|'speech'`) på idleklippet så att "väntan på spelare = bara lugna takes" kan sättas i Admin i stället för i K04:s katalogfil (`media-catalogue.mjs:111`, anmärkning `lugn`). Regeln "aldrig samma två gånger i rad" finns i `room-idle.mjs` och behöver bara dokumenteras som policy.
3. **Fem talfack som saknas** (`SPEECH_LINES`/`speak.other`-situationer): `twentyone`, `remark` (hit17/hit20/stand11 som situation + spelarbeslut som villkor), `banter`, `table_cash`, `table_trust`. Jakob har valt att vänta med dem (G13, 155 rader uppskjutna). Om de tas in: lägg dem som `speak.other/<line>` med exakt text; `greet_<namn>` ska inte bli fack utan hanteras av OpenClaw-persona/greeting-standard.
4. **Fler än fyra alternativ per talfack och slumpval utan upprepning.** Kevins bust/blackjack/twentyone har 7 takes. Antingen höj `limits.alternatives` för `speak.*` eller låt flera takes dela standardplats med `selection.random:true` + "inte samma som senast"-minne i serverns talval. I dag väljs alternativ med regler/modell, standard `random:false`.
5. **Språk i namnrådet.** Lägg `pt`, `ko`, `zh` i `CLIP_LANGUAGES` om Kevins filnamn ska tolkas; bordsspråk förblir en/sv enligt beslut.
6. **Per-plats kortstorlek och hole/flip-position** (`props`, `centre.hole/flip`) i profilen: liten lucka, bara om kalibrering per plats visar sig behövas.
7. **Inte en klippkartsfråga men blockerar användning:** attesteringen i `recordedSpeech` (ljud-/indexhash, poser, kalibrering) saknas i Kevins källa och main har ingen producent (`dealer-import-plan.mjs:173`); filmade profiler saknas för paow, astrid2 och marten; `u`/`iu`-takes saknas i Dragans profil.

Det som **redan finns under annat namn** och inte behöver något nytt: `pos<n>`→`box<n-1>`, `posdealer`→`dealer-up`, `hole`/`flip`→`dealer-hole` (deal/reveal), `i/v/iv`→`startPose/endPose`, `land/in`→`contactFrame/landFrame`, `frames`→`take.frames`, `restStart/restEnd`→poser per take, `faceTracks`→`profile.tracks`, `ROOMS`→bakgrundsmaterial, `keyed.still`→`pose/vila`, `PUBLIC_HIDDEN`→operatörens tillåtna dealers, `lines:null`→OpenClaw-text, `category gameplay/legacy_training`→registrerad/arkiverad, 14 av Kevins 15 replikhändelser → samma namn i `speak.*`.

## 5. Inventering (torrkörning, ingen import)

`node tools/k05-import-plan.mjs --git-repo <read-only klon> --verify vald` läser matrisen, slår upp varje rads Git-blob på den frysta headen (`5aa7ed10`; V1-rader på `238d6dd6`), kontrollerar gitblob-OID och storlek för alla rader och strömmar sha256 för de valda, och klassar mot mains identitetsregler (exakt hash + bytes; aldrig namn eller längd). Inga mediabytes skrivs till disk. Resultatet per rad är ett körresultat och ligger inte i repot: standardutdata är den Git-ignorerade `arkiv/<datum>/migrering/kevin-ks-migrering/K05/importplan.json` (`--out` för annan plats). Tabellen nedan är sammanräkningen från körningen 22 oktober. Test: `node --test test/k05-import-plan.mjs`.

| Klass | Rader | Unika sha256 | Unika bytes | Innebörd |
| --- | ---: | ---: | ---: | --- |
| befintlig | 52 | 47 | 63 799 869 | Exakt Neon-media-ID (51, alla i `review/uploads`, kräver promotion före katalogbindning) eller katalogpost (1, `media/startbild.png`) |
| ny | 534 | 519 | 474 437 370 | Vald, ingen registerpost; 9 av dem är rapporterade som registrerade efter frysningen (#312 6340621499) men inte återlästa här |
| uppskjuten | 155 | 155 | 76 896 982 | 154 G13-repliker + Table Studio-hälsningen; beslut att vänta |
| kallbevis | 6 | 6 | 340 627 | Versionsbundna JS-källfiler; ingen runtimeidentitet |
| ej-vald | 550 | 547 | 170 689 580 | pt/ko/es/fr/zh (500), Table Studio (27), rumsbilder/UI (18), ansikten (5) |
| avvisad | 28 | 28 | 81 136 881 | V1 raderade i `c4818f51`; aldrig valbara |

Valda totalt 586 rader (dragge 43 befintliga + 116 nya, paow 8 + 149, astrid2 0 + 105, marten 0 + 137, Astrid classic 1 + 26, delad 1), 566 unika sha256, 538 237 239 bytes; 51 kräver promotion; 15 sha256 delas av 38 rader (bytedubbletter får dela media-ID, varianten bevaras i identitetskartan). Källverifiering 22 oktober mot klonen: alla 586 valda `ok/ok/ok` (gitblob, bytes, sha256), övriga 739 `ok/ok/ej-kontrollerad` (gitblob och storlek); 0 rader med `sha256_avviker`, `bytes_avviker`, `gitblob_avviker` eller `kallblob_saknas`. Enda avvisningsorsak är `v1_bortvald` (28). Det bekräftar källidentiteten, inte Neon-/Blob-läget eller talgodkännande.

## 6. Om Jakob senare vill ha bytes

Kort, utan kommandon: mains väg är (a) `media_records` via Studios ordinarie uppladdning (`studio-upload-service.mjs`, hamnar i `review/uploads`), (b) katalograd via de spårade källfilerna `media/layout.json` + `media/blob-index.json` (+ `legacy.json` för JSON) och `ops/neon-studio/runtime-media-import.mjs` (prepare → plan → apply med planHash), (c) paketutkast som fryser media-ID:n (J08), (d) talattestering i Admin. Det saknas ett promotionssteg `review/uploads` → `runtime/` (katalogen nekar `review/uploads`, `runtime-catalog.mjs:29`), paketets brandingkolumn rymmer 42–55 medier (6338943386) mot 118–155 valda Dragan-rader, och `media_records` tar bara mp4/webm (`001-studio-metadata.sql`), så PNG/JSON går bara via katalogen. Ordningen i K05-mappning §7 gäller fortsatt som underlag; inget av det är beställt, och V1, omkodade kopior, ej valda språk, uppskjutna rader och källbevis importeras aldrig.

## 7. Öppna frågor till Jakob

1. Ska `u`/`iu` registreras som egna poseversioner (punkt 4.1), eller räcker `v`/`iv` (Dragans profil har bara dem)?
2. Idle: höjd `base`-gräns med relativa vikter, eller en ny `pool`-typ med `calm`-flagga (punkt 4.2)?
3. Vilka av de fem G13-facken (punkt 4.3) ska in i `SPEECH_LINES`, och ska `greet_<namn>` ersättas av OpenClaw-hälsning?
4. Takes per talfack: höja gränsen 4 eller behålla och välja fyra av Kevins sju?
