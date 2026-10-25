# K05: Kevins mappningssystem → mains klippkarta

Reviderad 25 oktober 2026. **Mains tre separata lager, identiteter och publiceringskontrakt är målmodellen.** Ett saknat Kevin-namn är inte automatiskt en saknad funktion. Aktuell prioritet och urval finns i [masterplanen](../../MASTERPLAN.md#prioriterad-väg-till-910); detta dokument förklarar mappningen, inte en andra migrationsstatus.

Den tidigare importpausen från 22 oktober är historisk. Handoffens senare PAOW-kvitto redovisar **153 importerade original** (56 pose, 23 idle, 37 sv, 37 en) under dealer-ID `paow`, med egen UUID/hash i privat Blob. `paow-kevin` ligger kvar i papperskorgen och ska inte återställas för att matcha den äldre matrisen. Bara `andas.mp4` är grundloop; givfilmer och repliker är inte aktiverade eller visuellt godkända. Importnotiserna har återställts genom #370 med bevarade identiteter. Detta är daterade leveransbevis i [handoffen](../../../docs/JOHN-HANDOFF.md), inte en ny liveinventering.

| Källa | Fryst version | Bevisgräns |
| --- | --- | --- |
| Kevin, begrepp och äldre K05-matris | `kevin-merge-admin@5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc` | K01/O01:s accepterade referens under `kevin/croupier-scoutgg/` |
| Main, aktuell kodgranskning | `34c6c22f60ac75f335f647c83af06e7d0514476b` | Kontrakt och konsumenter i `packages/presentation/`, `apps/studio/` och `services/game/` |
| PAOW-importens källmanifest | `kevin-staging@c713875923cd854b26f89c1db0d0f47064619c1d` | Separat importurval, inte automatiskt ny källa för hela K05 |
| Historisk torrkörning i avsnitt 5 | 22 oktober, 159cc134 + fyra greetingrader | Mängderna beskriver dåvarande registerläge och får inte användas som dagens uppladdningslista |

Tabellerna behåller Kevins källbegrepp för spårbarhet. Main-motsvarigheter är kontrollerade i den frysta main ovan; “finns” avser kod/kontrakt, inte automatiskt godkänt media eller aktiverad runtime.

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
- **Tal**: `SPEECH_LINES` och `speech-slot-bindings` äger accepterade repliker/fack. Varje `recordedSpeech` kräver dealer-/line-/take-ID, språk, exakt text, video-/ljud-/indexhash, fps, frameCount, audioDelayMs, entryPose, exitPose och calibrationRevision samt verifierad inspelning och godkänd review. `CLIP_LANGUAGES` innehåller redan sv, en, es, no, da, fi, de, fr, ko, pt; bordsspråk en/sv är ett separat accepterat urval.
- **Klippguiden** (`dealer-clip-guide.mjs:84-100`) förklarar redan Kevins namn (`pos<n>[-i|-v|-iv]`, `hole/hole-i`, `flip`, VILA/REDO-skillnader mot Forge) utan att göra dem till identitet.

## 3. Jämförelsetabell: Kevin-begrepp → main-begrepp → status

Status: **finns** = samma begrepp; **annat namn** = finns med annan benämning/plats; **delvis** = finns men inte hela Kevins betydelse; **saknas** = ingen motsvarighet i mains klippkarta.

### 3a. Dealer och scen

| Kevin-begrepp | Main-begrepp | Status | Anmärkning |
| --- | --- | --- | --- |
| `DEALERS[id]` dealer-ID `dragge`, `paow`, `astrid2`, `marten`, `astrid` | `project.dealers[{id,label}]`, `isDealerId` | annat namn | `dragge`→`dragan` är belagt för exakt mappade bytes. PAOW har senare importerats som `paow`; gammal `paow-kevin` ligger kvar i trash. Inga globala namnalias, automatiska återställningar eller antagna Astrid-identiteter. |
| `name`/`label` (Dragan visas, id dragge) | `dealers[].label` | finns | |
| `still` = rumsbild med inbakat bord (`rooms-v2/*.png`) | Bakgrundslager + bordslager (`material-catalog.mjs`, `layer-asset-contract.mjs`), TERMINOLOGI tre lager | annat namn / avsiktligt ej | Inbakat bord kan inte bytas separat; tvålagersmodellen är utesluten (MASTERPLAN). K05: `ej-vald:delad-ui/rum`. |
| `ROOMS` (darkhall, mahogany, golden, azure; `still`, `thumb`, `wide`) | `BACKGROUND_MATERIALS` design-ID:n med sha256/size/width/height | annat namn | Mains ID är design, inte rum. Kevins PNG har ingen sha-träff i katalogen. |
| `keyed.still` (`v2/vila.png`, frilagd VILA) | `pose/vila` referensbild (`clip-naming.mjs:126`, `dealer-clip-guide.mjs:44-52`); K05: katalogpost `still/keyed-still` med `mediaId:null` | finns (referens) | Lagras inte i klippbanken; via katalog + J08-adapterns stillbildsväg (PR334). |
| `redo.png` | `pose/redo` | finns | |
| `face` (ansiktsbild i väljaren) | Mains dealerporträtt i lobbyn | finns under annat kontrakt | Behåll publicerings-/dealeridentiteten; den äldre K05-radens `ej-vald:ansiktsbild` är ett urvalsbeslut, inte skäl att bygga en parallell väljare. |
| `layerScale`, `handMatte` | `composition-settings.mjs`, `dealer-compositing.mjs`, K04-matte på main | annat namn | |
| `PUBLIC_HIDDEN` (dölj Mårten publikt) | Operatörens tillåtna dealers / `dealerSets` / rumspublicering | annat namn | Ingen dealerflagga; synlighet styrs per operatör och rum, vilket täcker behovet. |
| `pick()` → tyst fallback till Astrid | Ingen tyst fallback; saknat stöd nekas vid publicering | avsiktligt saknas | K05-regel. |
| `card: [78,106]`, `props` per plats | `profile.card {width,height}` och mains dealerbaserade kort-/chipsskalning | delvis / valt annat | Befintlig skalning återanvänds. Per-plats-utökning kräver visad kalibreringsbrist; importera inte Kevins pixelgeometri som standard. |

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
| Variant `-u` (tagning + gång tillbaka till VILA), `-iu` | Alla sex varianter stöds i `filmed-profile.mjs`; namnrådet har alias `u→v`, `iu→iv` | delvis i intag/klippkarta | Tekniska takes kan ha olika bytes och landningsrutor trots samma start-/slutpose. Bevara exakt källvariant + track + hash vid bindning; generisk namnnormalisering får inte ersätta identitet. Ändra inte historiska ID:n eller alla alias utan konsumentprov. |
| `readyVariant`/`readyTimeline` (i öppnar, u stänger, fog REDO→REDO, 80 ms, 700/1500 ms) | `planFilmedDealSequence` + `filmed-deal-timeline.mjs` | finns | K04 på main. |
| `restStart`/`restEnd` per take | `startPose`/`endPose` per take i profilen | finns | |
| `meta.frames[track][variant]` | `take.frames` | finns | |
| `land[track]` (två mätningar: dealers.js och meta.json) | `READY_CONTACT` (dealers.js-värdena, `media-catalogue.mjs:26-31`), `take.landFrame/contactFrame/clearFrame`; `timingEvidence: kevin-runtime-land-override` | finns | Avvikelsen dokumenterad i K05-mappning §5; klientkontakt följer dealers.js. |
| `in` (rutor som `-i` lägger före tagningen) | `contactFrame` = land + in (`media-catalogue.mjs:80-86`), `variantOffset` | finns | |
| `ut` | – | saknas (används ej) | Kevins runtime använder inte `ut`. |
| `centre[track]` inkl. `hole`, `flip` | `profile.positions 1-7, dealer {cx,cy}` | delvis | Hole/flip har ingen egen position; dealerpositionen används. |
| `faceTracks` (kortets planara spår per tagning) | `profile.tracks[name].frames[{q,p,body,paper}]` | finns för Dragan | PAOW har importerade videor men ingen verifierad filmprofil; 17/18 käll-landmarks skiljer sig och handfrigöranderuta saknar separat bevis. Astrid2/Mårten är inget automatiskt utökningsmål. |
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
| Språk `sv, en, pt, ko` och rot `es, fr, zh` | `CLIP_LANGUAGES` sv, en, es, no, da, fi, de, fr, ko, pt; bordsspråk en/sv | delvis / valt urval | `pt` och `ko` finns redan i namnrådet; `zh` saknas. Namntolkning är inte språkacceptans. Utöka inte publicerade språk utan exakt godkänt tal och produktbehov. |
| `rost` (Cartesia/ElevenLabs-röst per dealer) | `dealer-voice-catalog`, `dealer-speech-profile` | annat namn | |
| `category gameplay / legacy_training`, `binding` | `role standard/alternative`, `archived`, oregistrerat = ej i banken | annat namn | "training only" ≈ ej registrerad/arkiverad. |
| `sidebet_2` som aktiv variant | standardtagning per fack (`speechSlotStandard`) | finns | |
| Attestering (`audioSha256`, `indexSha256`, `audioDelayMs`, `entryPose/exitPose`, `calibrationRevision`, `verified-recording`, `approved`) | krävs av `recorded-speech.mjs` | underlag saknas hos Kevin, kontrakt finns i main | `dealer-import-plan.mjs` kan validera exakta källalias/UUID/hash och återanvända redan godkänt tal; den producerar inte saknade attesteringar eller visuell acceptans. Framtagning och granskning av saknat underlag återstår. |

### 3e. Händelsekoppling och klassning

| Kevin-begrepp | Main-begrepp | Status | Anmärkning |
| --- | --- | --- | --- |
| `catalogEventForStep` (steg → `deal.player.*`, `reveal.dealer`, `speak.*`, `settle.*`, `idle.ready`) | mains händelsekatalog | finns | Kevin använder redan mains ID:n (`CATALOG_COMMIT d321e3f5`). |
| `placebets` → `idle.ready` (runtime-event-links) men `speak.other/placebets` i K04 | `speak.other/placebets` | annat namn (inkonsekvens hos Kevin) | Följ K04/main: placebets är tal. |
| `manifest.handelser[event].varianter` | fackets standard + alternativ | finns | |
| `manifest.format`, `kort_storlek`, `startbild` | KLIPP-OCH-FORMAT, `profile.card`, Astrid-presentationsbank | finns | |
| `media-registry.mediaInventory` (okända filer = training only) | ingen filskanning; bara registrerade poster | annat namn | |
| `CATALOGUE_SOURCE` (K04-raden binder Kevin-commit + sha) | finns i `media-catalogue.mjs:12-14` | finns | |

## 4. Prioriterat urval på mains villkor

1. **Exakta takes och kontakt före fler klipp.** Återanvänd profilens sex posevarianter och K04:s exakta bindning. Bevara källvariant/track/hash vid Admin-intag; avvisa tvetydighet. Välj minsta fungerande godkända set och verifiera kontakt, handfrigörande, fog och två följande uppspelningar i mains tre lager. PAOW:s 17/18 motstridiga landmarks är ett granskningsbehov, inte tillstånd att kopiera Dragans profil.
2. **Fullfölj befintlig publicering.** Återläs aktuell inventering och rums-/paketversion. Använd befintlig importplanering, klassificering, scoped writer och fryst materialrevision. Ett lyckat uppladdningskvitto eller en återställd notis är inte en godkänd spelbindning.
3. **Lugn idle genom befintlig kedja.** `room-idle` och `server-chain` har redan determinism, viktning och skydd mot upprepning. Den möjliga luckan är ett begränsat Adminval för vänteläge kontra mellanrunda. Belägg aktuell writer/konsument först. Varken fler än fyra basklipp, ny pooltyp eller ny scheduler är förvalt krav.
4. **Inspelat tal med mains attestering och timing.** Producera saknat ljud-/index-/kalibreringsunderlag från exakta källbytes och gör faktisk synkgranskning. Återanvänd befintliga talfack. Schemaläggning, taltidsfönster och eventuell fördröjning är presentationskontrakt; lyft inte in Kevins absoluta tider utan prov mot mains tidslinje.
5. **Avstå från lågprioriterad breddning.** G13-fack (`twentyone`, remarks, banter, table_cash/table_trust och personhälsningar), fler språk, fler dealers, höjda alternativgränser samt per-platsgeometri ligger senare tills ett konkret main-behov är visat. Behåll nuvarande gränser och välj godkända takes. Namnrådet har redan pt/ko.

**Redan täckt eller avsiktligt annorlunda:** `pos<n>`→`box<n-1>`, `posdealer`→`dealer-up`, `hole/flip`→`dealer-hole`, poser/frames/kontakt i filmprofilen, tidslinje/förladdning, Dragan-spår, serverkedjad idle, basrepliker, dealerporträtt och separata materiallager. Kevins `ROOMS` är källmaterial, inte automatiskt mains operatörsägda rum. `PUBLIC_HIDDEN` ger ingen ny dealerflagga; faktisk publicering och tillåtna val styr synlighet. Tvålagersscener, tyst dealer-/språkfallback och egna lokala register är uteslutna.

## 5. Historisk inventering — torrkörning 22 oktober

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

## 6. Befintligt intag och återstående bindning

Använd mains aktuella Admin-intag, `dealer-import-plan.mjs` och ordinarie register-/Blob-/klassificeringskontrakt. PAOW:s 153 original ska återfinnas genom sina exakta identiteter; kör inte om 22 oktobers äldre uppladdningslista. Återläs inventeringen och kontrollera dubbletter, tillgänglighet, ägarskap och revision före en föreslagen skrivning.

`review/uploads`, runtimekatalog och fryst paket är skilda kontrakt. Om den valda konsumenten kräver runtimepromotion ska just den vägen beläggas och granskas; gamla storleksbegränsningar eller filnamn motiverar inte ett parallellt register. Bevara privata Blob-objekt, källhistorik och befintliga godkännanden. Nytt material eller ändrade bytes behöver eget mål/mandat och ny relevant acceptans.

## 7. Beslutsregel vid osäkerhet

- Bevara exakt teknisk take-identitet; skapa inget publikt begrepp bara för att namntolkningen skiljer sig.
- Välj en liten redan godkänd pool och befintliga repliker innan gränser eller kataloger utökas.
- Om klippet eller den nya funktionen har svagt belagt implementationsvärde och hög risk för legacy/begreppsförvirring: avstå och ange vilket observerbart behov som skulle motivera en senare omprövning.
- Genomför ingen import, återställning av dealer, publicering eller GPU-körning med detta dokument som ensamt mandat. Utförandestatus och acceptans kvarstår i `status.json`.
