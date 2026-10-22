# K04: Kevins övergångar och klippsekvenser mot tre lager (2026-10-22)

Svar på #312 6337998848. Jakobs modell gäller: mains Admin, Jakobs klippkarta och tre separat valbara lager (bakgrund, dealer, bord). Kevins tvålagersmodell ska inte in. Det här är bara dokument: ingen kodändring, inga nya regler, inget kört.

| Bet. | Källa (fryst) | Sökvägar relativa till |
| --- | --- | --- |
| K | `kevin-merge-admin` @ `5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc` (Kevins produkt) | `kevin/croupier-scoutgg/` |
| M | `codex/kevin-k04-presentation` @ `eb6ab455` (K04) | reporoten |
| J | `codex/shared-room-transport` @ `87765066`, bara `docs/JOHN-HANDOFF.md` för ordvalen | reporoten |

Metod: kodläsning med radnummer. Granskad av e2e (27 stickprov, rader 22–24 tillagda efter granskningen). Radnummer gäller exakt de två heads ovan. Medieidentiteter och fack står redan i [K04-mappning.md](K04-mappning.md) och [K04-medie-fack.tsv](K04-medie-fack.tsv); de upprepas inte här.

## 0. De två modellerna, som koden har dem

**Main (tre lager).** En presentationslane har `layers: {background, dealer, table}` (M `packages/presentation/contracts/presentation-layers.mjs:44-55`, `:64-65`); bakgrunden har `mode: baked|image|video`, bordet en färglista (`:51`, `:53`). Lagertillgångar finns bara för bakgrund och bord (`layer-asset-contract.mjs:4`, sökväg `:28-32`); dealern är alltid en källa med grön nyckling eller alfa (`dealer-compositing.mjs:3-5`; `presentation-composition.mjs:13` `compatibility: full-frame|per-clip`, `:52` `data-presentation-standard='three-layer'`). Placering per mobil och desktop: dealer `{scale,x,y}`, bakgrund `{scale,x,y}`, bord `{width,x,y}`, `tableFront` (`composition-settings.mjs:13-17`, `:18-24`); kort och insatser per borddesign som `blackjackTables[].{mobile,desktop}.{cardWidth, dealer, seats[].{card,bet}}` i 0..1 av bordets rektangel, med valfria `anchors` vars `target` är `table|dealer|scene` (`:34-50`). Geometrin räknas i `compositor/geometry.js:2-6` (`stageGeometry`), `:8-16` (`backgroundRect`), `:18-26` (`tableRect`); ritordningen i `compositor/compositor.js:85-105`: bakgrund, bord, dealer med nyckel/`splitY`/handmask, före eller bakom bordet efter `tableFront` (`:97-102`); korten läggs av `game-overlay-layout.mjs:25-57` (`layoutTableGameOverlay`) och `composition-anchors.mjs:4-9`, `:10-19`.

**Kevin (två lager).** (1) En rumsstillbild med bordet inbakat: `<img class="still">` (K `public/index.html:26`), `ROOMS` med `rooms-v2/<rum>.png` (`public/dealers.js:185-191`) och kommentaren "Every room shares Astrid's table pixel for pixel" (`:181-184`). (2) En keyad dealer-canvas ovanför korten (`public/dealer-layer.js:3-7`, monterad efter `#gameCards` `:139-140`), som läser den aktiva av två videoelement `#va`/`#vb` (`index.html:32-33`, `dealer-layer.js:185-190`). Allt annat är SVG i samma 1080 × 1920-plan: `#feltBrand`, `#tableBoxes`, `#gameCards` (`index.html:34-36`). Stillbilden och videon delar en och samma ram (`public/style.css:13-17`). Bordets geometri är alltså plattans pixlar, och dealerklippen är filmade mot just det bordet.

## 1. Återanvändbara övergångsfunktioner och klippsekvenser

"Fungerar med separata lager" betyder: funktionen rör bara dealerkällan, bara sekvensens ordning/tid, eller ett överlägg vars ankare kan komma från mains bord- eller dealerrektangel i stället för plattans pixlar.

### 1.1 Dealerlagret: posekedja och tagningsval (fungerar oförändrat)

| Funktion | K fil:rader | Vad den gör | I main @ eb6ab455 |
| --- | --- | --- | --- |
| `readyTimeline(steps, ready)` | `server/shared-table.mjs:114-135` | Varianten per steg ur grannarna: `i` öppnar en körning (VILA → REDO), `u` stänger den, `''` när två dealtagningar fogas REDO → REDO (`:119`, `:124`); `v`/`iv` när tagningen slutar i vila och en `-v`-fil finns (`:127-128`); längden är `meta.frames[track][-variant]/24` (`:129-130`); 80 ms mellan tagningar som inte fogas (`:132`); `restStart`/`restEnd` ur meta.json (`:118`). | `planFilmedDealSequence` (`packages/presentation/runtime/filmed-deal-sequence.mjs:29-72`) gör samma variantval (fogning `:47`, variant `:52-53`, separata `toShoe`/`fromShoe`-klipp `:50-51`, `shoe-transitions.mjs:26`). Tidsättningen per tagning finns inte: `material-revision.mjs:18-23` tar längsta tagningen + 80 som `cardMs` (K04-mappning G3). |
| `readyVariant`, `dealerClipUrl`, `dealerClipVariants`, `REST_TAKES`, `variantOffset` | `public/dealers.js:130-133`, `:112-116`, `:119-122`, `:137`, `:139` | Klienten spelar serverns variant, annars hela rörelsen `iu`; förladdar alla fyra varianter; `-i` börjar med in-övergången `ready.in/24` s som dras av från korttiden. | Tagningarna har `offsetFrames` i profilen; `resolveFilmedDealTake` (`contracts/filmed-profile.mjs:66-71`). |
| meta.json | `public/media/dealers/<id>/v2/meta.json`, läses av `READY_TAKES` `server/server.mjs:82`, varianter/längder/texter `:91-105` | `in`, `ut`, `land`, `centre`, `frames[track][variant]`, `props`, `restEnd`, `restStart`, `card`. | `contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs`: 35 tagningar med `startPose`/`endPose`, `offsetFrames`, `firstFaceFrame`, `contactFrame`, `landFrame`, `clearFrame`, sha256; `positions`, `tracks`, `card` 78 × 106. |
| Klippspelaren | `public/app.js:127` (`next`), `:192` (överlämning 1,5 bildrutor före slutet), `:195-207` (`finish`/handover), `:214-246` (`start`) | Två element växlar: en vilotagning lämnar över på sin sista bildruta (VILA) till det förberedda elementet, inte på `ended` (`:192`, `:203-206`); ett kedjeklipp väntar på sin tid (`:218`) och söker in i fas från bordsklockan (`:234-236`); en tagning kortare än sin lucka sträcks med `playbackRate` 0,6–2 (`:223-227`); `.on` sätts före `play()` (`:238-239`, `:245-246`). | Finns inte (ingen `handover`, ingen `playbackRate`-passning, ingen fas-sökning i `packages/presentation/runtime/`). `live-idle.mjs` har bara valet av klipp. |
| Dealerns matte och spill | `public/dealer-layer.js:21` (`solid`), `:29-30` (`unspill` mot hudtonen), `:54` och `:98` (hud framför kortet), `:58-62`, `:63-80` (kantrening 3 px / 6 px, choke), `:59-60` och `:155` (`finished`: Emils färdiga plattor utan rening), `:105-118` (`pickSkin` ur vilobilden) | Bara dealerkällan. | Kompositorn har tröskel, mjukhet och despill (`compositor/compositor.js:22-24`, `dealer-framing.mjs:26`); ingen unspill, kantrening eller hudskydd. |
| Dealerns kort keyas ut | `public/dealer-layer.js:195-199` (tagning/bildruta ur käll-URL:en, vila), `:216-221` (`land[track]` avgör när propkortet keyas), `:222-229` (följer kortets spår `faceAt`, sedan vilokonturen) | Fungerar med separata lager om `cardAt(seat)` ges i dealerplanet (profilens `positions`), inte i bordets. | `filmedFaceAtTime` (`contracts/filmed-profile.mjs:73-80`) och `test/local-card-overlay.mjs:318-340` använder profilens `positions` och `sourcePlane`. |

### 1.2 Vila och väntekedja (fungerar oförändrat, redan portat)

| Funktion | K fil:rader | Vad den gör | I main @ eb6ab455 |
| --- | --- | --- | --- |
| `layChain`, `pickWeighted`, `waitClips`, `waitBoundary`, `waitClipAt`, `chainClipAt`, `upcomingChainAt`, `restingPool`, `LEAD` | `public/idle-chain.js:45-60`, `:37-43`, `:69-73`, `:76-80`, `:86-97`, `:12-24`, `:113-122`, `:104-107`, `:6` | Deterministisk kedja av VILA-till-VILA-tagningar från ett frö, viktad, aldrig samma två gånger i rad; klipp är aktuellt från 100 ms före sin start; gapfri så att överlämningen på sista bildrutan hittar nästa. | `services/game/games/blackjack/presentation/room-idle.mjs:12-57` (samma funktioner, enligt filhuvudet byte för byte), `:59-82` (`roomWait`, `endWait`, `waitClipAt`, `serverChainEntry`); `live-idle.mjs:30-56`, `:95-99` läge `server-chain`. Fryst kopia: `test/fixtures/kevin-5aa7ed1/public/idle-chain.js`. Paritetstest på `codex/kevin-k07-tester` a18e240f. |
| Lugna tagningar | `public/dealers.js:39-40` (`CALM_IDLE`), `:52`, `:62` (`calm`, `vikt`, `dur` per tagning) | Under en väntan på spelaren bara andning, axlar, rygg, vikt, fingrar. | Klassificering per registrerad vilofil (`presentation-layers.mjs:98-101` `idle.ready`); urvalet av lugna ligger i `room-idle.mjs restingPool`. |
| Serverns väntan | `server/shared-table.mjs:202-213` (väntekedjan läggs från planens slut ur den lugna poolen, bara tagningar en ansluten worker har), `:151-154` (nästa tagning startar på en klippgräns, `until`) | Samma kedja för alla tittare och för workerns karta. | `room-idle.mjs:59-67`. |
| `withIdle`, `idleFrom`, `idleChain`, `kartaFor`, `takeOf`, `idleTakesIn`, `vilaMap` | `server/shared-table.mjs:64-74`; `server/rorlig-lipsync.mjs:89-102`, `:112`, `:62-88`, `:50-53`, `:27-29` | En replik i vila går över en kedja (väntans egen om en pågår, annars från den sista tagning som slutar i vila, aldrig efter en tagning som slutar i REDO eller när nästa tagning kommer inom 500 ms); `kartaFor` ger workerns karta tagning + bildruta per utbildruta, sista bildrutan hålls i gapen, `vila` annars. | Finns inte. Läppsynk ligger sist (J). |
| Klientens vila | `public/app.js:103-110` (`pickIdle`), `:113` (`chainItem`), `:118-125` (`prepareNextIdle` i det dolda elementet) | | Finns inte som spelare; se 1.1 klippspelaren. |

### 1.3 Tal över klipp (bara dealer och ljud, fungerar oförändrat)

| Funktion | K fil:rader | Vad den gör | I main @ eb6ab455 |
| --- | --- | --- | --- |
| `scheduleTalks` | `server/rorlig-lipsync.mjs:120-130`, `LJUD_FORE` `:22` | En replik börjar 62 % in i föregående tagning, före första kortet 600 ms in i greppet mot skon; 250 ms mellan repliker; kartan börjar 0,22 s före ljudet. | Finns inte. |
| Talfönstret i `sequence` | `server/shared-table.mjs:147-150` (ledtid 700 ms, 1000 ms när han talar, 1500 ms när planen öppnar på vändningen), `:191-195` (`talkUntil`, `omplanera`), `:217` (`onPlan`) | | Ledtiden är konfig (`leadMs`), K04-mappning G3. |
| `turnAt` | `server/shared-table.mjs:196-200`; klient `public/shared-table.js:36-39` (`busy`, `shownTurn`) | Nästa spelare får agera 62 % in i sista dealtagningen när turen följer direkt, annars vid planens slut. | `plan.turnAt` i koordinatorn (K04-mappning §1.1). |
| Munnen | `public/lip-layer.js:53` (`patchKeys`), `:62` (`createLipTracks`), `:96-108` (`catchUp`); `dealer-layer.js:44-47`, `:206-211` | Munplåstret läggs in före nycklingen, per tagning och bildruta. | `packages/presentation/runtime/moving-speech-frame-layer.mjs:97` (port från kevin-staging ae9fedc5), `speech-pose-gate.mjs:68`. |

### 1.4 Kortsekvensens ordning (inget lager alls)

| Funktion | K fil:rader | Vad den gör | I main @ eb6ab455 |
| --- | --- | --- | --- |
| `planDraws`, `cardsIn`, `outcomeSpeech` | `public/game-events.js:28-57`, `:18-25`, `:59-71` | Kort i shoeDraw-ordning; hålkortet dolt först (`deal_hole`), vändningen före första dealerkortet efter hålkortet (`:44-46`, `:55`); bust/blackjack/twentyone ropas när kortet landar (`:50-53`). | `orderFilmedPresentationEvents` (`filmed-deal-sequence.mjs:7-28`) och `partner-presentation.mjs presentationEvents`; ordningsfelen G4–G7 i K04-mappning kvarstår. |
| `sequence` | `server/shared-table.mjs:136-220`: prefix goodluck `:165`, händertagningen vila-till-vila `:166-168`, steg `:169-173`, sidebet `:174`, insurance `:175`, utfall/cheer `:176-187`, tursteg `:188`, `catalogEventForStep` `:189` | | Händelse → fack i K04-mappning §1.2. |
| Klientens steguppspelning | `public/shared-table.js:304-328` (`syncPlayback`: steg ur bordsklockan `:308`, förladdning 1200 ms före `:310`, `playNow` med `fit`/`startOffset`/`timelineTime` `:320`, `beginDeal` `:321`, `advanceDeal` + landljud vid `DEAL_CONTACT` `:322`), `:170-192` (`drawCards`: ett kort syns från `firstFaceTime` i sin tagning `:178-183`, `plan.before` tills planen är slut `:174-176`) | Kräver bara dealerkällans tid. | `local-card-overlay.mjs` (lokal Astrid); rumsvarianten saknas (K04-mappning G9–G11). |

### 1.5 Kortöverlägget i dealerplanet (fungerar om ankaret byts)

Dessa är rena funktioner i plattans 1080 × 1920-pixlar. Kortet i luften följer dealerns spår (dealerplanet); kortet i vila ligger på bordet. Med separata lager måste vilopunkten komma från bordets ankare (`anchors.cards.target: 'table'`) och flygspåret från dealerns (`'dealer'`), samma uppdelning som `packages/presentation/runtime/composition-anchors.mjs:10-19` redan tillåter.

| Funktion | K fil:rader | Vad den gör | I main @ eb6ab455 |
| --- | --- | --- | --- |
| `cardPose`, `SLIDE_SECONDS`, `fanOffset`, `dealerFanOffset`, `splitFanOffset`, `splitHandAnchor`, `trackLean`, `feltMatrix` | `public/card-table-layout.js:99-108`, `:40`, `:44`, `:57`, `:72`, `:69`, `:83`, `:110` | Glid in från kontakt på 0,38 s, solfjäder per hand, split-rader. | Portat: `services/game/public/card-presentation/card-table-layout.js:26-75` (med `depth`). |
| `DEAL_CONTACT`, `touchFrame` | `public/card-table-layout.js:25-34` | Kontakt = spåret inom 6 px från viloläget, annars två bildrutor före `land`. | Profilens `contactFrame`/`landFrame`/`clearFrame` per tagning; `card-presentation/card-table-layout.js:9-23` (Astrid). |
| `firstFaceTime`, `faceAtTime`, `faceTriangles`, `triangleMatrices`, `GRID` | `public/card-face-projection.js:19-25`, `:28-39`, `:41-72` | Kortets tryck följer det mätta spåret som ett plan i perspektiv (hörnfäste, 3 × 3 mesh). | `card-presentation/card-face-projection.js`; `filmedFaceAtTime` ur profilens `tracks`. |
| `createGameCards`: `move`, `beginDeal`/`advanceDeal`/`endDeal`, glid 260 ms | `public/game-cards.js:148-176`, `:166-172` | Handklipp, reservation av det inkommande kortets plats, glid när inget delas. | `card-presentation/game-cards.js:12`, `:58-118` (`filmedProfile`-läge). |
| `TABLE_LAYOUT`, `pack`, `ladders`, `layoutPlayers`, `dealerRow`, `placeTotals`, `topLimit`, `diagonal`; `fixedLayout` | `public/table-layout.js:14-28`, `:61`, `:108`, `:136`, `:153`, `:168`, `:32`, `:93`; `public/game-cards.js:77-114` | Bredd efter behov, diagonal A, split-stegar, totalpiller utan överlapp. Aritmetiken är ren, men konstanterna (`table`, `zone`, `hands`, `shoe`, `edgeTop`, `rail`) är mätta på plattans vilobild (`:17-22`). | Finns inte (`splitGap`/`ladders` saknas i M). Går att porta först när konstanterna uttrycks i bordsrektangelns andelar. |

Beteendelås som följer med (K `test/`): `ready-dealer.test.mjs:11` (hela rörelsen utan fryst lucka), `:43` (varianten slutar inom luckan), `:58` (REDO → REDO), `:79` (kortet följer spåret till vila), `:105`, `:126` (lugna tagningar); `idle-chain.test.mjs:15` (gapfri kedja, överlämning 62 ms före slutet); `card-table-layout.test.mjs:10-136`; `game-cards-fixed.test.mjs:26-53`; `dealer-hand-occlusion.test.mjs:18-42`.

## 2. Beroenden till tvålagersrenderern som måste bort

| # | K fil:rad | Vad den antar | Mains motsvarighet |
| --- | --- | --- | --- |
| 1 | `public/dealers.js:185-191` (`ROOMS`), `:181-184`; `:69`, `:74`, `:83`, `:89` (`still: rooms-v2/darkhall.png`) | Rumsbilden är bakgrund och bord i ett; alla rum delar Astrids bord pixel för pixel; skon i rooms-v2 är ritad där KLARA-plattorna drar. | Bakgrund som eget lager med `mode` (`presentation-layers.mjs:44-52`), bordet som egen tillgång (`layer-asset-contract.mjs:4`). En rooms-v2-bild kan bara vara `baked` bakgrund, och då bara med plattans bordgeometri. |
| 2 | `public/stage-pending.js:8`, `:20-24` | Hårdkodade listor av dealers och rum; scenen väntar mörk tills rumsbilden och `vila.png` finns. | `render()` med väntade laddningar per lager (`presentation-composition.mjs:143-160`). |
| 3 | `public/app.js:627-633` | `.still` får `savedRoom().still`; `--plate-bg` är en suddig kopia av rummet; `deskMode.setRoom`. | Bakgrundslagrets placering (`geometry.js:8-16`). |
| 4 | `public/app.js:635-638` | Kortpositionerna `at` hämtas ur `/api/clips` (`manifest.deal[].kort`, Astrids platta), `at.dealer = [540, 895]`, `at.hole`; `createDealerLayer` får `scale: layerScale`, `inFrames`, `finished`, `keyHalf` ur `ready.card`. | Positioner ur den filmade profilens `positions` (dealerplanet) och vilopunkter ur borddesignens `seats[].card` (`composition-settings.mjs:34`, `:46-50`); aldrig ur manifestet. |
| 5 | `public/style.css:13-17` | `.still` och `.v` ligger `inset: 0`, `object-fit: contain`, `center top`: rummet och dealervideon är samma 9:16-ram. | `stageGeometry`/`backgroundRect`/`tableRect` placerar varje lager för sig per mobil/desktop (`geometry.js:2-26`). |
| 6 | `public/desk.css:20`, `:26`, `:34-39`; `public/desk-mode.js:15-21`, `:66` | Desktop = samma 1080 × 1920-ram inuti en breddad rumsbild (`--room`, `rooms-wide/`); stillbilden göms när rummet är brett. | `composition.desktop.{dealer, background, table}` (`composition-settings.mjs:13-17`). |
| 7 | `public/desk-felt.js:19-56`, särskilt `:33-36` | Färgar om den inbakade duken i den breddade rumsbilden med en fast avbildning ram → rum ((0, 90) = (740, 0)) och duk mellan ram-y 733–744 och 1694. | Bordslagrets `colors` (`presentation-layers.mjs:53`) eller en annan bordstillgång. Inget att färga om i en bakgrund. |
| 8 | `public/table-style.js:9`, `:91-107`, `:85`, `:109-123` | Målar duken ovanpå `.still` (keyad dealer) eller den aktiva videon (Astrid) i en canvas före `#tableBoxes`; "rounded"/"extended" är en plåt (`variant-b.png`) ritad över det inbakade bordet; `data-felt-color` styr desk-felt. | Bordstillgång + `colors`; en annan bordsform är en annan tillgång. |
| 9 | `public/dealer-layer.js:34-42` | Skalningen `S0` delas vid bordskanten y 715, glider tillbaka till 1 mellan händerna 760–900, korten på y ≥ 895 ligger kvar där de filmades: "Astrid's size and seat". | Dealerns ram (`dealer-framing.mjs:12-25`) och `composition.dealer.{scale,x,y}`; ingen delad skalning. |
| 10 | `public/dealer-layer.js:82-90` | Dealern står bakom rummets räcke (y 710–739) medan plattans eget räcke ligger på 746: en band-maskering av torson. | `tableFront`/`splitY`/handmask i kompositorn (`compositor.js:97-102`; `sceneForComposition` `composition-settings.mjs:72-82`). Med bordet som eget lager finns inget räckesglapp att dölja. |
| 11 | `public/dealer-layer.js:120-133`, `:172-178`, `:181-184`, `:173` | `roomGrade`: dealerns svartpunkt och vitbalans tas ur rumsbilden över bordet; canvasen visas först när `.still` är laddad. | Finns inte i M. Antingen bort, eller som dealeruniform matad av bakgrundstillgången (dealerlagret rör bara sig självt). |
| 12 | `public/dealer-layer.js:139-140`, `:3-7`; `public/index.html:32-36` | Ordningen är DOM-ordning: video, feltBrand, tableBoxes, gameCards, dealer-canvas överst. | Ritordning i kompositorn efter `tableFront`/`layerMode` (`compositor.js:85-105`); kort via `paintCards` (`:68-84`) eller överlägget. |
| 13 | `public/index.html:34`; `public/felt-logo.js`; `public/felt-brand-hands.js:10-14` | Dukens logotyp på fasta plattkoordinater (x 360, y 994, `matrix(1 0 0 .8 0 206.4)`); på Astrid målas videons händer tillbaka över märket genom jämförelse med `startbild.png`. | Logotypen hör till bordslagret och bordets ankare (`composition-anchors.mjs:10-19`). Keyade dealers behöver redan inget (`:11`). |
| 14 | `public/table-boxes.js:78-83` | Insatsringarna på `manifest.deal[].kort` (cx, cy + 108) i plattpixlar. | `seats[].bet` (`composition-settings.mjs:46-50`; `game-overlay-layout.mjs:36-41`). |
| 15 | `public/game-cards.js:12`, `:76` | `positions` = `manifest.deal[].kort`. | `seats[].card` via `local(point)` (`game-overlay-layout.mjs:28-33`). |
| 16 | `public/table-layout.js:14-28` | `table [20, 1060]`, `zone [459, 618]`, `hands [365, 705]`, `shoe [740, 910]`, `edgeTop 862`, `rail 778`: mätta på plattans vilobild. | Måste bli andelar av bordsrektangeln eller utgå (se 1.5). |
| 17 | `public/card-table-layout.js:10-21`, `:38` | `EMIL_CONTACT` (Astrids film); "the manifest dimensions are ALREADY projected pixels measured in the video": kortstorleken `manifest.kort_storlek` är plattans projektion. | Profilens `card` 78 × 106 i dealerplanet och `cardWidth` per borddesign (`composition-settings.mjs:44`). |
| 18 | `public/dealers.js:23`, `:28`, `:31`, `:64` (`land`, `card`, `layerScale: 1`) mot `meta.json land` | Två mätningar av landningsrutan (K04-mappning §2.1: dragge box1 29 mot 25); `card` dubbleras. | En källa: profilens `landFrame`/`clearFrame` per tagning (kevin-dragan-f15b2af1). |
| 19 | `public/dealer-hand-occlusion.js:11-17` + `dealer-hand-tracks.js`; `public/card-face-projection.js:8-17` (`flipFace`) + `card-face-tracks.js` | Astrids handmatte och vändning i hennes filmade bord; keyade dealers får `FULL_TABLE` (`handMatte: false`). | Hör till Astrid classic, inte till trelagersflödet (porten ligger i `card-presentation/` för det lokala bordet). |
| 20 | `server/server.mjs:82`, `:91-105`; `/api/clips` (`public/app.js:635`) | Servern lämnar Astrid-plattans positioner och meta.json direkt till klienten. | Paketet: registrerad dealer + filmad profil + sammansättning (`presentation-layers.mjs:86-116`). |
| 21 | `public/shared-table.js:320` (`fit`) | När servern inte tidsatt tagningen sträcks den till Astrids lucka (`readyVariant` → `iu`). Med konfigtid (`leadMs`/`cardMs`) skulle varje tagning sträckas eller få frysta gap. | Antingen tidsättning per tagning (1.1 `readyTimeline`) i planen, eller uttalat accepterad sträckning. |
| 22 | `public/studio-table.js:17-20` | Ett Table Studio-bord slår på `#feltBrand` och `keepHandsOverFeltBrand`: utlösaren till rad 13. | Logotypen följer bordslagret i paketet (`branding`, `presentation-layers.mjs:68`). |
| 23 | `public/scout-ui.css:22-26` | `.felt-brand` ligger absolut över hela 1080 × 1920-ramen, "printed on the clean felt between the filmed arc and box 4", under boxar och kort. | Bordets ankare (`composition-anchors.mjs:10-19`). |
| 24 | `public/game-table.js:119`, `:123` | Enspelarbordet spelar `manifest.deal`-klippen, även `deal_flip`, direkt ur Astrid-plattans manifest. | Samma som rad 19–20: Astrid classic och paketets profil. |

Rader 1–8 är rummet. Rader 9–13 och 22–23 är dealerlagrets och dukmärkets antaganden om rummet. Rader 14–18 är kortöverläggets ankare. Rader 19 och 24 är Astrid classic. Rader 20–21 är transporten av geometri och tid.

Ingen åtgärd: `public/dealer-hand-matte.js` har plattkoordinater (x 320, y 844) men importeras inte någonstans i `public/`.

## 3. Redan i main, så att inget görs dubbelt

- Vilokedjan: `room-idle.mjs`, `live-idle.mjs` läge `server-chain`.
- Posekedjan och varianterna: `filmed-deal-sequence.mjs planFilmedDealSequence`, `shoe-transitions.mjs` (in/ut mot skon som egna klipp i stället för `-i`/`-u`-halvorna).
- Dragans tagningar, spår och positioner: `contracts/filmed-profile.mjs`, `filmed-profiles/kevin-dragan-f15b2af1.mjs` (källor pinnade med sha256 mot `f15b2af1`: `dealer-card-tracks-dragge.js`, `meta.json`, `dealers.js`, `manifest.json`).
- Kortöverlägget: `services/game/public/card-presentation/` (`card-table-layout.js`, `game-cards.js` med `filmedProfile`, `card-face-projection.js`), `local-card-overlay.mjs`, `test/local-card-overlay.mjs:318-340`.
- Munnen: `moving-speech-frame-layer.mjs`.
- Tid: `material-revision.mjs` (längsta tagning + 80 ms, inte per tagning).

Saknas i main: tidsättning per tagning (`readyTimeline`), klippspelarens överlämning/fas-sökning/`fit`, `scheduleTalks`/`idleFrom`/`kartaFor`, `TABLE_LAYOUT`-stegarna, Kevins matte-förfining (unspill, kantrening, hudskydd, propkort), `roomGrade`.

## 4. Val som är Jakobs

1. Ankare: kort i luften ur dealerplanet (profilen), kort i vila ur bordets ankare. När bordets placering skiljer sig från plattans måste flygspårets slutpunkt mappas till bordets vilopunkt; funktionerna i 1.5 tar redan `anchor` som parameter.
2. rooms-v2: `baked` bakgrund med plattans geometri, eller delas i rum + bord. Ett delat exempel finns lokalt från 28 sep (croupier-lang-bo, Astrid/Amira: rum utan bord, `table.png`/`table.glb`, utklippt dealer), inte för Dragan.
3. Dealern bakom bordet: Kevins räckesband (rad 10) motsvarar `tableFront: false` plus `splitY`; plattans räckesoffset försvinner när bordet är ett eget lager.
4. Tid: `readyTimeline` per tagning i planen, eller konfigtid med sträckning (rad 21, K04-mappning G3).
