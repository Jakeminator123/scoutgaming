# K05: Kevins mappningssystem → mains klippkarta

Reviderad 26 oktober 2026. **Mains tre separata lager, identiteter och publiceringskontrakt är målmodellen.** Ett saknat Kevin-namn är inte automatiskt en saknad funktion. Aktuell prioritet och urval finns i [masterplanen](../../../docs/history/MASTERPLAN-2026-10.md#prioriterad-väg-till-910); detta dokument förklarar mappningen, inte en andra migrationsstatus.

Den tidigare importpausen från 22 oktober är historisk. Handoffens äldre kvitto redovisar 153 importerade original (56 pose, 23 idle, 37 sv, 37 en) under dealer-ID `paow`, egna UUID/hash i privat Blob; `paow-kevin` ligger kvar i papperskorgen. Den tidigare Admin-läsningen den 25 oktober visade 34 idlefiler och obundna giv-/visnings-/talfack. **Det senare kvittot i [PR #382](https://github.com/Jakeminator123/scoutgaming/pull/382) anger att 24 valda idleoriginal redan är publicerade i West Bet revision 2.** 24/24 exakta media är återlästa; åtta klipp har bild-/uppspelningskvitto under 45 sekunder, nio identiteter observerades. Ingen insats eller full spelrunda utfördes. Detta är utförandeagentens dokumenterade delkvitto, inte omkört här. Återanvänd intag, policy och paket; historiska mängder är ingen ny uppladdningslista. Giv-/talacceptans och full spelacceptans återstår.

| Källa | Fryst version | Bevisgräns |
| --- | --- | --- |
| Kevin, begrepp och äldre K05-matris | `kevin-merge-admin@5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc` | K01/O01:s accepterade referens under `kevin/croupier-scoutgg/` |
| Main, aktuell utförandeväg | `8fcb920a930d7459273be3a495f8474137203abd`, inklusive #399/#403/#405/#407 | Native materialbindning, uppmätta tidsbudgetar och inspelat MP4-tal v2 finns i kod. Den äldre begreppsmatrisen behåller sitt historiska underlag; kodstöd är inte mediaacceptans. |
| J08, integrerad kod | [PR407](https://github.com/Jakeminator123/scoutgaming/pull/407), granskad head `857347de6bc802463aaed9e39a6e4a16ebd44ded` | Grön CI inklusive verklig Chrome. Render LIVE på PR-head, Vercel READY på merge-versionen. Verkligt molnsamprov med PAOW återstår. |
| PAOW-importens källmanifest | `kevin-staging@c713875923cd854b26f89c1db0d0f47064619c1d` | Separat importurval, inte automatiskt ny källa för hela K05 |
| Historisk torrkörning i avsnitt 5 | 22 oktober, 159cc134 + fyra greetingrader | Mängderna beskriver dåvarande registerläge och får inte användas som dagens uppladdningslista |

Tabellerna behåller Kevins källbegrepp för spårbarhet. Main-motsvarigheter är kontrollerade i den frysta main ovan; “finns” avser kod/kontrakt, inte automatiskt godkänt media eller aktiverad runtime.

## Aktuellt utförande genom Admin, Neon och Blob

| Del | Återanvänd och konvertera till | Återstående kontroll och gräns |
| --- | --- | --- |
| Klipp och klassning | **Admin → Klippkarta**, befintligt video-intag och Neon-register; privat Blob lagrar originalbytes | Återläs UUID, hash, storlek, dealer och klassning; gamla filnamn/antal får inte initiera omimport eller en lokal filkatalog |
| Idle | Befintlig **Körregel → Basloop / Beteendeklipp**. #378/#381 och #382:s sparade/publicerade 24-originalpolicy återanvänds | #386 annonserar specifikt v28-stöd, verifierat live på Render `23debde7`. Denna komplettering kräver det före skrivning av aktiv/arkiverad/fryst rotationspolicy; 71/71 readinessprov och oberoende kodreview. Admins CI/deploykvittens redovisas separat i handoffen. Gammal läsare på `34c6c22f` avvisar formatet och är ingen kompatibel återgång. Komplettera full spelacceptans; ingen omimport eller ompublicering följer av planen |
| Rumsval och mall | **Admin → Spelbolag & rum** binder rum och väljer material; **Studio → Sceneditor** (`/admin/scenes`) redigerar gemensam mall för mobil/desktop | #385 är målvägen. Preview ändrar inte standard; visa berörda rum. Återskapa inte separat placeringseditor eller den borttagna `update-scene-layout`-writern |
| Fryst publicering | Befintligt operator-package-API och `publish-scene-layout`, Neon-transaktion, actor/scope samt projekt-/paket-/registerrevisioner | Geometri läses från sparad kanonisk mall; patchen bevarar frysta material/media, andra dealers, branding och historik. Materialutbud publiceras separat. Redundant kastat Dragan-utkast återställs inte |
| Giv/reveal/tal | Mains filmprofil, tidslinje, mediaattestering och committade spelhändelser; tre separata visuella lager | Exakta pose-/track-/kontaktvärden och två följande spel. Saknade bevis betyder fortsatt avstängt, inte tyst fallback eller lägre valideringskrav |
| Delad spelkonfiguration (J08) | Befintligt `room-game-config`-API, fryst paket och materialadapter | Prioritera den versionsbundna materialkopplingen nedan; vanlig rumspublicering eller startad spelvy öppnar inte denna grind |
| QA | [Masterplanens tre bevisnivåer](../../../docs/history/MASTERPLAN-2026-10.md#qa-sql-och-lagring-utan-återinförd-legacy) | Lokal mediemapp/minnesprov bevisar inte Neon/Blob-flödet. Ingen ny SQLitefixture eller connected-local-produkt beställs |

#378:s separata källurval är `kevin@f664c54dfce870a4ea048ed93dfda181d0df9600`; det flyttar inte K01/O01-baslinjen. [Masterplanens PR-tabell](../../../docs/history/MASTERPLAN-2026-10.md#förnyad-admin--och-pr-granskning-25-oktober) anger granskade heads. Begreppsmatrisen nedan behåller sitt `34c6c22f`-underlag; utförandet ovan gäller aktuell main. Mergade #380/#383/#384/#385 återanvänds: Studio → Sceneditor (/admin/scenes) är enda placeringseditorn. publish-scene-layout publicerar geometri från kanonisk sparad mall med projekt-, paket- och registerrevisioner; materialutbud publiceras separat. Den separata bolagsgeometrin och update-scene-layout är borttagna och ska inte återskapas. PR385:s driftkvitto och handoffens kompletta Dragan-demohand är delacceptans; fysisk Safari och sju samtidiga händer är inte verifierade. Redundant Dragan-materialutkast är kastat, medan aktuella material, fem bordsprofiler och PAOW-data bevaras. Planrevisionen i PR #379 förbereder Jakobs beställda fortsatta implementation. [Motivering och slutkriterier](../../../docs/history/MASTERPLAN-2026-10.md#motivering-och-när-migreringen-är-klar) skiljer dokumentleverans och delacceptans från färdig migration.

### Prioriterat: verifiera den implementerade materialbindningen

Main har nu native materialresolver, serverägd tidsmätning och strikt `recordedSpeech` v2 för original med bild och ljud i samma MP4. Tidigare instruktioner att först bygga dessa delar är ersatta. Följ [runtimekontraktet](../../../docs/LOCAL-PRESENTATION-RUNTIME.md#inspelat-tal-med-bild-och-ljud-i-samma-mp4) och återanvänd befintliga Admin-tjänster, Neon-register och privata Blob-objekt.

| Del | Finns i kod | Nästa verifiering |
| --- | --- | --- |
| Exakt fryst urval | Native-resolvern binder filmprofil, tagningar, UUID/hash/storlek, rum och presentation. | Återläs rätt PAOW-profil med dess 35 filmade tagningar, avsett idle-urval och de tio obligatoriska talplatserna. Gissa inte tagning från filnamn eller ersätt profil med dealer-alias. |
| Verklig tidsbudget | Befintliga `POST /api/videos/measure-timing` mäter exakta Blob-bytes och skriver revisionsskyddat mätkvitto. Materialproducenten budgeterar tal, giv och reveal. | Mät valda original genom tjänsten och återläs resultatet. Inga SQL-genvägar, omkodade bytes, schablontider eller nya lokala register. |
| Bild och ljud i samma MP4 | V2:s `embedded-mp4-av` binder original, text, språk, tagning, poser och uppmätta spår. Endast mätwritern skapar `verified-embedded-av`. | Källkontroll och AV-godkännande är separata. Jakob har bett om omkontroll av dagens tidigare PAOW-godkännande: välj exakta original för de tio talplatserna och granska dem; återskapa inte godkännanden från en lyckad mätning. |
| Aktiv hand och ny publicering | PR407 fryser fönstrets material och städar avbrutna laddningar; [CI40347468353](https://github.com/Jakeminator123/scoutgaming/actions/runs/40347468353) är grön på ovanstående head. | Driftsätt kompatibla läsare i releaseordningen från PR407. Bevisa i isolerad miljö att pågående hand behåller rätt dealer, bakgrund och bord medan nästa hand får ny version. |
| Samlat produktprov | Kontraktsprov och syntetiska PG-/HTTP-/Chrome-prov finns. | Admin → publicering → spel på samma kandidat, tre separata lager, två följande händer, multitable och återanslutning med avsett material. Tekniska testpass ersätter inte denna acceptans. |

V1:s ljud-/index-/kalibreringskrav gäller fortfarande dess befintliga format. De ska inte fabriceras för V2:s inbäddade MP4-ljud. V30-readiness krävs för V2, även dess pending-metadata. Det finns inget generellt krav att omgodkänna oförändrade original, men Jakobs uttryckliga begäran om PAOW-omkontroll gäller här. Saknad spårbarhet till exakt original måste lösas före publicering.

De tidigare 78 transport-/intagskontrollerna och 30 draft/CAS-kontrollerna gäller sina historiska versioner och syntetiska underlag, inte nuvarande materialacceptans. Se [K06/K07-underlaget](../K06-K07/K06-K07-forberedelse.md) och [aktuell överlämning](../../../docs/NEXT-AGENT.md). Utförandestatus kvarstår endast i `migrering/status.json`.

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
- **Poseversioner** (`clip-naming.mjs`): `base` REDO→REDO, `i` VILA→REDO, `v` REDO→VILA, `iv` VILA→VILA; `u`→`v` och `iu`→`iv` är *alias* vid namntolkning. Klassificeringen lagrar `startPose`/`endPose` (`video.schema.json`, `validateClipPoses`). **Filmad profil** (`filmed-profile.mjs`) tar däremot varianterna `'', i, u, iu, v, iv` med eget `track` (`<take>v`), `frames`, `contactFrame`, `landFrame`, `clearFrame`, `startPose`, `endPose`; `planFilmedDealSequence` räknar `i`/`u` per steg och uppgraderar `u`→`v` när en rest take finns (`filmed-deal-sequence.mjs:54-58`). `filmed-deal-timeline.mjs` är Kevins `readyTimeline` (80 ms, 700/1500 ms, handover 1,5 rutor). Dragan har profil `kevin-dragan-f15b2af1` med 35 takes (alla `base/i/v/iv` för 1–7 och dealer, `hole:base/i`, `flip:base`); **inga `u`/`iu`-takes** PAOW har motsvarande 35 takes i `kevin-paow-c7138759` och 18 egna kortspår, inklusive `hole`. Astrid2/Mårten saknar profiler.
- **Idle** (`idle-policy.mjs`): `base` 1–4 grundloopar med `weight` (summa 100) och `durationMs`; `variants` ≤ 30 engångsklipp. Ursprungliga användningar är `manual | automatic | rules | openclaw`. Efter #378 tillkommer valfri `rotation` och `use: rotation` med explicita faser/poser; detta gör inte 24 klipp till 24 basloopar. Äldre strikta läsare kräver särskild kompatibilitetsgrind. `automatic {averageEveryMs, jitterMs, cooldownMs, maxPerMinute}` och beskrivning ≤ 80 tecken behålls. K04:s `room-idle`/server-chain är en separat befintlig konsument, inte bevis för att hela nya Adminflödet fungerar.

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
| `faceTracks` (kortets planara spår per tagning) | `profile.tracks[name].frames[{q,p,body,paper}]` | finns för Dragan och PAOW | PAOW binds till egna frysta bytes/spår från c7138759. `dealers.js` land och `meta.json` land har olika källvärden; profilen följer den befintliga runtimeöverstyrningen. `releaseFrame` granskas separat, se nedan. Astrid2/Mårten är inget automatiskt utökningsmål. |
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
| V1-attestering (`audioSha256`, `indexSha256`, `audioDelayMs`, poser, `calibrationRevision`, `verified-recording`, `approved`) | Befintligt V1-kontrakt i `recorded-speech.mjs` | Gäller V1-material, inte ett generellt krav på alla importerade MP4-original | Bevara befintligt underlag och godkännande. Importören producerar inte saknade attesteringar eller visuell acceptans. |
| V2-original med inbäddat ljud (`embedded-mp4-av`) | Servermätning av exakt original, `verified-embedded-av` och separat AV-review | Implementerat i main; verklig PAOW-bindning/acceptans återstår | Återanvänd original och befintligt godkännande med exakt spårbarhet. Fabricera inte separata ljud-/indexhashar eller kalibreringshistorik. |

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

1. **Exakta takes och kontakt före fler klipp.** Återanvänd profilens sex posevarianter och K04:s exakta bindning. Bevara källvariant/track/hash vid Admin-intag; avvisa tvetydighet. Välj minsta fungerande godkända set och verifiera kontakt, handfrigörande, fog och två följande uppspelningar i mains tre lager. PAOW:s profil använder hennes egna spår och den frysta runtimeöverstyrningen; de 17/18 skillnaderna mot råmetadata är inte skäl att kopiera Dragans profil.
2. **Fullfölj befintlig publicering.** Återläs aktuell inventering och rums-/paketversion. Använd befintlig importplanering, klassificering, scoped writer och fryst materialrevision. Ett lyckat uppladdningskvitto eller en återställd notis är inte en godkänd spelbindning.
3. **Lugn idle genom befintlig kedja.** `room-idle` och `server-chain` har redan determinism, viktning och skydd mot upprepning. Den möjliga luckan är ett begränsat Adminval för vänteläge kontra mellanrunda. Belägg aktuell writer/konsument först. Varken fler än fyra basklipp, ny pooltyp eller ny scheduler är förvalt krav.
4. **Inspelat tal med rätt versionskontrakt.** Använd V2 för avsedda original med bild och ljud i samma MP4: exakt identitet, servermätning och separat spårbart AV-godkännande. Bevara V1:s underlag för befintligt V1-material. Återanvänd talfack och redan godkända oförändrade original; mätning är inget nytt synkgodkännande. Schemaläggning och taltidsfönster måste provas mot mains tidslinje, inte kopieras från Kevins absoluta tider.
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

## PAOW: sammanhängande givbank, 25 oktober 2026

- Originalfilmerna behålls byte för byte. Samma 56 actionfiler verifierades på `kevin`, `kevin-staging` och `kevin-merge-admin`; ingen separat till/från-skon-film finns i denna bank.
- Runtime använder 35 unika tagningar: `base/i/v/iv` för plats 1–7 och dealer, `hole:base/i`, `flip:base`. `i` har 21 inledande bildrutor. `u/iu` är äldre påbyggda återgångar och får inte döpas om till de andra `v/iv`-filmerna. Identiska hole/flip-alias väljs bara en gång, med originalnamnet först.
- Till/från skon är en rörelseförmåga, inte obligatoriska separata filer. För en komplett bank börjar kedjan i VILA, fogar REDO till REDO och slutar i VILA. Tomma skofack döljs i klippkartan för sådana profiler; uttryckliga befintliga skobindningar förblir synliga. Övriga dealerbankers separata övergångar stöds fortfarande.
- Admins **Koppla hela givbanken** binder de 35 exakta, tillgängliga och rätt ägda filmerna atomiskt i projektutkastet. Saknad film stoppar hela bindningen. Vanligt regel-, modell- och slumpurval stängs för dessa referenser; spelserverns sekvens väljer mål, pose och kort. Sparning och rumspublicering är separata steg.
- `kevin-paow-c7138759` binder 18 egna bildrutespår. Alla 56 original avkodades vid 1080×1920/24 fps och SHA/storlek kontrollerades mot registret. Spår granskades mot första synliga kort, kontakt, land och slutruta för samtliga bas-/v-tagningar. Källans landvärden bevaras; efter separat bildrutegranskning sker överlämning tidigast ruta 25 i `dealer:v` (46 i `dealer:iv`) och 35 i `flip:base`, när fingrarna är fria från kortet.
- Spelkort och serverns kortsko behålls. Filmerna innehåller rekvisita; rätt valör/färg och kvarvarande kort bestäms av servern, inte filmen eller klippnamnet.
- Verifiering: `test/paow-filmed-profile.mjs` provar egna bytes, fel ägare/fack, ofullständig bank, alias, sparning, fryst paket samt öppningsgiv, extra kort, dolt kort och vändning. Isolerad Admin med syntetiska identiteter sparade samtliga 35 bindningar. Detta är inte produktionsacceptans av en spelrunda; aktuell leveransstatus hanteras i befintlig handoff/status.

## 7. Beslutsregel vid osäkerhet

- Bevara exakt teknisk take-identitet; skapa inget publikt begrepp bara för att namntolkningen skiljer sig.
- Välj en liten redan godkänd pool och befintliga repliker innan gränser eller kataloger utökas.
- Om klippet eller den nya funktionen har svagt belagt implementationsvärde och hög risk för legacy/begreppsförvirring: avstå och ange vilket observerbart behov som skulle motivera en senare omprövning.
- Genomför ingen import, återställning av dealer, publicering eller GPU-körning med detta dokument som ensamt mandat. Utförandestatus och acceptans kvarstår i `status.json`.
