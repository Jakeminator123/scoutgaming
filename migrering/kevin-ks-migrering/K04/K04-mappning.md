# K04 mappning: committade händelser → presentation → exakta medier (2026-10-22)

Underlag för K04 enligt [AKTIVITETER.md](../AKTIVITETER.md) (K04, med K05 som mottagare). Bara dokument. Ingen runtimekod, import, radering, DB-åtkomst eller GPU-körning. Aktiv inkoppling väntar på J07 (avsnitt 4).

| Bet. | Källa (fryst) | Sökvägar relativa till |
| --- | --- | --- |
| C | `codex/kevin-k03-bord` @ `b8e1c957c99c5a16ee861f9767ec28041b2270dd` (K02-kärna + K03-koordinator) | `services/game/games/blackjack/` |
| K | `kevin-merge-admin` @ `5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc` (fryst produkt) | `kevin/croupier-scoutgg/` |
| M | main @ `95ac98dcb1608bd89bb2ac44488b2a82a376682d` | reporoten |

Medieidentiteter (sökväg, bytes, sha256) kommer från K01:s `K01/media-runtime.tsv` (1 267 rader, 5aa7ed10, oförändrad: sha256 `5fa64609c24a…`). [`K04-medie-fack.tsv`](K04-medie-fack.tsv) är samma rader plus mains fack per fil, och 26 data- och kodberoenden med egna hashar (meta.json, kortspår, texter.json, manifest.json, dealers.js, idle-chain.js), sammanlagt 1 293 rader.

Metod: kodläsning, plus en lokal körning av de rena funktionerna C `core.mjs` (`newGame`/`step`), M `services/game/partner-presentation.mjs` (`presentationEvents`) och K `public/game-events.js` (`planDraws`) med deterministisk sha256-slump (seed `s0`, `s1`). Inget annat kördes. Visuell granskning och lipsyncacceptans ingår inte.

## 1. Händelse → presentation

### 1.1 Vad C faktiskt publicerar

- **Kärnan** (C `core.mjs:124-127`) returnerar `publicEvents` och `view`. Publika händelsetyper:
  - `shoe.opened {shoeId, commitment, rules, coverage}` (`:79-80`)
  - `shoe.closed {shoeId, proof}` (`:61`)
  - `engine.<op>` för start/act/insurance/collect, med `{…params, shoeId, version, draws, phase}` (`:239-240`). `draws[].card` är `'hidden until settlement'` utom vid fas `settled`/`collected` (`:117-122`).
  - Rundans interna logg (`round.dealt`, `card.dealt`, `dealer.peek`, `dealer.reveal`, `dealer.draw`, `hand.split`, `round.settled`, C `round.mjs:87`) publiceras **inte** (`core.mjs:103-104`).
- **`publicView`** (`core.mjs:105-114`): `{version, roundId, turnSeq, shoe, round:{boxes, hands, dealer, phase, active, holeDraw, legalActions}}`. Hålkortet ligger utanför `dealer[]` tills det avslöjas, och bara `holeDraw` syns. Formen är densamma som M `services/game/shoe-game.mjs:27-35` `gameView`, plus `roundId`/`turnSeq`.
- **Outboxraden** (C `table/coordinator.mjs:102-112`) har formen `{roomId, auditSeq, talkId: plan.id, ver: ++presentationVer, payload:{roundId, planId, language, startAt, endAt, events: out.publicEvents}}`.
  - Tiden är `endAt = startAt + cfg.leadMs + draws·cfg.cardMs`, alltså konfig och inte klipplängd.
  - `present()` anropas från start (`:166`), insurance (`:181`), act (`:374`) och autostand (`:535`). **Inte** från `round.settle`/collect (`:186-208`).
- **Snapshot** (läsning, ingen händelse; `:560-576`) innehåller `phase, roundId, turnSeq, owners, bets, deadline, actionDeadline, plan{id,startAt,endAt,turnAt}, round, shoe, players, serverNow, me{…, insuranceDue, lastSettlement}`.
- **Bara audit**, inget presentationsflöde: `player.<op>`, `round.started`, `wallet.settlement`, `table.tick`, `player.pause`, `presentation.plan` (`:33-34`, `:108-109`, `:154`, `:200`, `:266`, `:418`, `:521`).

### 1.2 Tabell

Fack = mains katalognyckel `<dealer>/<eventId>/<situation>` (M `packages/presentation/contracts/clip-naming.mjs:32,119-123`, `policies/studio-contract.json` events). `boxN` är 0-baserad: Kevins `posN` = `box(N-1)`, vänster box0-1, mitten box2-4, höger box5-6.

| C-händelse (fält) | Kevins beteende i dag (K) | Mains konsument/insättningspunkt (M) | Fack | Gap |
| --- | --- | --- | --- | --- |
| `engine.start` + view `phase=decisions/insurance` | `sequence(r,null,{opening,prefix:['goodluck']})` `server/shared-table.mjs:231,136-201`. `planDraws` lägger kort i shoeDraw-ordning, hålkortet som `deal_hole` och sist `reveal` (`public/game-events.js:28-57`). `sidebet` vid sidovinst (`:174`), `insurance` (`:175`), `turn` (`:188`). Ready-dealer: varianter i/u/v via `readyTimeline` (`:114-135`) och `turnAt` = 62 % in i sista dealen (`:198-200`). | `presentationEvents(prev, view, 'start')` `services/game/partner-presentation.mjs:46-56` (goodluck `:53`, dolt kort `:54`, deals `:55-56`, insurance `:57`, turn `:70`). Lagras per spelare `postgres-native-table.mjs:36-40`. Klienten sekvenserar själv `public/app.mjs:1376-1384` → `deliverCard` `:1214-1225` → `local-presentation.mjs:227` `present()` → `POST /api/presentation/select`. Kontroll mot committad instruktion `presentation-api.mjs:42-58,170-171`. | `speak.goodluck/goodluck`, `deal.player.*/boxN`, `deal.dealer/dealer-up`, `deal.dealer/dealer-hole`, `speak.other/sidebet`, `speak.insurance/insurance` | G1 outboxen saknar view: korten måste tas från `publicView` före/efter, eftersom `draws` är dolda. G2 main skickar ingen `sidebet`. G3 tidsplan från konfig, inte från klippens `frames` (meta.json). |
| `engine.start` + view `phase=settled` (naturlig BJ eller dealer-BJ direkt) | Samma ordning: hålkortet läggs dolt först och vänds sedan (`game-events.js:34-37,55`). Resultatreplik `outcomeSpeech` (`:59-71`). | `presentationEvents` `:59-68`: **`reveal` läggs först** (`:67` `ev.unshift`). | `reveal.dealer/dealer-hole` + `speak.other/<utfall>` | **G4 ordningsfel (kört):** seed `s1` ger i main `reveal#5 > goodluck > deal box3#2 > dealer#3 > box3#4 > dealer#5(dolt)`. Kevin ger `deal 4#2 > dealer#3 > 4#4 > deal_hole#5 > reveal`. Kevin räknar platser 1-7, så 4 = box3, och goodluck är ett prefix i `sequence`. |
| `engine.act {action}` hit/stand/double/split | `sequence(r,before,{prefix: double?['double']:[]})` `:240-246`. Per kort `bust` (`game-events.js:50-51`). `twentyone`/`blackjack`-call med `calls` (`:52-53`, `shared-table.mjs:141`). Reveal före första dealerkort > holeDraw (`:45-46`). Utfall och namnad cheer (`:180-187`, `:219`). | `presentationEvents(prev, view, 'act', {action})`: double `:58`, deals `:55-56`, settle `:59-68`, turn `:70`. | `speak.double/double`, `deal.*`, `reveal.dealer/dealer-hole`, `speak.other/bust`, `speak.other/<utfall>` | G4 igen (kört, seed `s0`): main `reveal#5 > deal box3#6 > dealer#7 > dealer#8`, Kevin `deal 4#6 > reveal > dealer#7 > dealer#8`. G5 main saknar `bust` per hand och `twentyone`. G6 main `outcome` testar `!h.split` (`:64`) men C har `splitFrom`, så 21 på två kort efter split talas som `blackjack`. Detta finns även i main i dag. G7 utfallsregler skiljer sig: dealerbust/push (K `game-events.js:64-69` mot M `:66`). |
| `engine.insurance {take / takeBoxes}` | `sequence(r,before)` `shared-table.mjs:240`: reveal + `dealerblackjack`, eller turn. | `presentationEvents` `:59-70`. Insurance-UI från `me.insuranceDue` (snapshot). | `reveal.dealer/dealer-hole`, `speak.other/dealerblackjack` | `peek` finns i båda katalogerna men används inte av någon. Inget gap. |
| `engine.collect {}` (tick `round.settle`) | Ny runda: `placebets`/bordsprat (`public/shared-table.js:87-92`). `waits` töms (`shared-table.mjs:251`). | `presentationEvents` `op==='collect'` → `speak placebets` + `idle` (`:72`). | `speak.other/placebets`, `idle.ready/ready` | **G8:** C:s settle anropar inte `present()`, så ingen outboxrad finns. Placebets och idle måste triggas av snapshotens fasbyte `settled→bets`. |
| turn (view `phase=decisions`, `active`, `legalActions`) | `turn`-steg (`:188`). Väntekedja `r.waits` med lugna tagningar från planens slut (`:202-213`). | `turn`-händelse `:70` → `local-presentation.mjs:60-84` (idle-regler). | `idle.ready/ready` (`turn.player` är tom i kontraktet) | Se avsnitt 3. |
| Outboxrad `{roomId, auditSeq, talkId, ver, payload}` | `state.plan {id, language, before, steps[], startAt, endAt, turnAt}`, `state.talk[]`, `state.waits[]` (`shared-table.mjs:195,201,213`). Klienten använder `plan.before` för vilka kort som syns (`public/shared-table.js:172-190`). | En rad per spelare i `native_presentations` + `out.presentation` (`app.mjs:544-556`). | — | G1. G9 inga `steps`/`talk`/`waits` i payload. G10 main är en spelare per bord (player_id). Rumsläge kräver lagring per `roomId`/`ver` och sändning till alla i rummet. |
| `shoe.opened` / `shoe.closed` | Skoindikator ur snapshot `shoe`. | `showShoe(out.shoe)` `app.mjs:589`. | — | `shoe.closed.proof` innehåller den stängda skons återstående kort. Adaptern ska inte rendera det, bara skicka vidare om det behövs. |
| snapshot (återanslutning) | `accept()` versionsspärr och klockoffset `public/shared-table.js:60-62`. Talens `catchUp` `public/lip-layer.js:96-108`. | `prepareTable()` `app.mjs:585-600`. | — | G11 ingen talåterupptagning i main för rumsrepliker (se 3). |

Slutsats för insättning: C:s `publicView` passar direkt in i M `presentationEvents`. Adaptern behöver alltså view före och efter varje committat steg (G1). Ordningen för reveal ska följas enligt Kevins `planDraws`, inte `ev.unshift` (G4).

## 2. Exakta medier per dealer

Hela listan med sökväg, bytes och sha256 per fil och fack finns i `K04-medie-fack.tsv` (kolumnerna `dealer, k04_kalla, main_fack, kevin_variant, main_posevariant, sprak, path, bytes, sha256, anmarkning`). Inga filer saknas: alla 1 267 runtimefiler finns i 5aa7ed10 enligt K01. Neon-ID och Blob-identitet ingår inte här (K05).

| Dealer | deal.player.* | deal.dealer | reveal.dealer | idle.ready | speak.* (inom mains 17 rader) | Utan fack i main |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| dragge | 42 | 10 | 4 | 21 (11 lugna, 10 livliga) | 144 | 88 |
| paow | 42 | 10 | 4 | 23 (13 lugna, 10 livliga) | 144 | 88 |
| astrid2 | 42 | 10 | 4 | 9 (4 lugna, 5 livliga) | 107 | 66 |
| marten | 42 | 10 | 4 | 3 (Kling, ingen calm-flagga) | 144 | 88 |
| astrid (classic) | 7 | 2 | 1 | 5 | 44 | 0 |

### 2.1 Keyed dealers (dragge, paow, astrid2, marten)

- **Deal-tagningar.** `media/dealers/<id>/v2/`:
  - `pos1-7` och `posdealer` finns som `{bas, -i, -u, -iu, -v, -iv}`.
  - `hole` och `flip` finns som `{bas, -i, -u, -iu}`.
  - Steget får variant av `readyTimeline` (K `server/shared-table.mjs:124-128`). Klienten väljer med `readyVariant`/`dealerClipUrl` (`public/dealers.js:112-133`).
  - **G12 kollision:** main tolkar `u`→`v` och `iu`→`iv` (M `clip-naming.mjs:22`). Kevins `-u` (REDO-tagning plus gång till VILA) och `-v` (Emils vilotagning, eget kortspår `'<n>v'`, K `shared-table.mjs:125-128`) är olika filer med olika land-frames. Det gäller 8 fack × 2 par per dealer. Fackens pose-variant räcker inte som identitet. Bindningen måste ske per sha256 plus Kevins variantnamn.
- **Bindande data.** Följande filer finns inte i media-runtime.tsv men styr exakt frame och kortplacering. De står i TSV:n som `data-beroende`:
  - `media/dealers/<id>/v2/meta.json`: `frames` per variant, `land`, `centre`, `restStart`/`restEnd`. Läses av `READY_TAKES` (K `server/server.mjs:82`).
  - `public/dealer-card-tracks-<id>.js`: kortets planara spår per tagning.

  | Dealer | meta.json (sha256, bytes) | dealer-card-tracks (sha256, bytes) |
  | --- | --- | --- |
  | dragge | `4e0cb4fb…c9822`, 1 081 | `d077cc95…08d9`, 75 934 |
  | paow | `07d4ddaa…ca81`, 1 081 | `ec28e71b…e13c`, 80 282 |
  | astrid2 | `031fca9e…445a`, 1 825 | `bc1e4b9b…ab35`, 84 344 |
  | marten | `cef92edf…df67`, 1 825 | `0c405246…c073`, 75 250 |

  Klientens `land` i `dealers.js:23,28,31,64` skiljer sig från `meta.json` `land` (dragge box1: 29 mot 25). Det är två mätningar. K04 måste ange vilken som styr kortlandningen.
- **Idle.**
  - dragge och paow: `v2/<take>.mp4`. Både H3-tagningar (1,625 s) och nya `*61xx` med vikt 6.
  - astrid2: `idle-v2/` med 9 H3-tagningar, 3,04 s.
  - marten: `idle-v2/{breath, glance, smile}`, Kling, 5,04 s, utan calm-flagga.
  - Lugn/livlig följer regexen `CALM_IDLE` (`dealers.js:39-40`). Fördelningen står i TSV-kolumnen `anmarkning`.
- **Repliker.** `media/dealers/<id>/repliker/<lang>/<line>.mp4`. Språk: dragge och paow sv/en/pt/ko, astrid2 en/pt/ko, marten sv/en/es/pt (`dealers.js:71,76,85,91`).
  - Inom mains rader (M `speech-lines.mjs:2-20`): goodluck, insurance, double, bust_1-7, blackjack_1-7, win_1-3, dealerblackjack, dealerbust, push, lose, sidebet, placebets_1-3, greeting, chatter1/2.
  - **Utan fack (G13):** `twentyone_1-7`, `remark_*`, `banter_1`, `greet_<namn>`, `greet_guest`, `table_cash_1`, `table_trust_1`.
  - **G14:** main tolkar språk ur filnamn bara för sv/en/es/no/da/fi/de/fr (`clip-naming.mjs:17,98`). pt, ko och zh måste anges uttryckligen vid registrering. `recorded-speech.mjs:25` accepterar dem.
  - Textning: `repliker/<lang>/texter.json` (15 filer, i TSV:n).
- **Stillbild VILA** (talkroppens vila): `v2/vila.png`.
  - dragge `b83b74ad…6744`
  - paow `7274b685…b2f4`
  - astrid2 `667ca81d…4a5f`
  - marten `7a6f6e1a…0da5`
- **Lipsync.** marten saknar avatarpaket på workern (K01 `medieinventering-avatarer.md:64`). Repliker spelas som inspelade steg utan rörlig mun.

### 2.2 Rotkatalogen `/media/repliker` (kodberoende för alla dealers)

Servern bygger alltid replik-URL:er under roten, för alla dealers: `speechForEvent` (K `public/dealer-language.js:9-11`), `ownLine` (`server/shared-table.mjs:57`) och `variantOf` (`:75-81`). Keyed dealers skriver om URL:en med regexen `/media/repliker(?:-[a-z]+)?/([a-z0-9]+_\d)` → `<linesDir><lang>/<id>.mp4` (`public/dealers.js:145-151`).

Roten är alltså **URL-nyckeln** för varje replik. Manifestets `dur` (`media/manifest.json`, 45 180 bytes, `07bf0212646da4726cff90125162b3e4e5e109760441058c4db6fd8a1adf5ee3`) ger stegets längd när ingen worker är varm. De aktiva id:na kommer från `GAME_SPEECH` (`server/media-registry.mjs:3-5`, `sidebet_2` kanoniskt). `bust_2-7`, `twentyone_1` m.fl. finns inte i roten utan existerar bara efter omskrivningen. Ingen rotfil får tas bort och ingen URL-form får ändras utan en ersättande nyckel i adaptern.

| Fil (`media/repliker/`) | bytes | sha256 |
| --- | ---: | --- |
| goodluck_1.mp4 | 458 911 | `e01820d0d1ecf578ad06552a2082f28a4c8f62d26d5b08aa3f1e1d0f39cd146f` |
| sidebet_2.mp4 | 487 477 | `7c4c9ad64d74b581533cd76e64a2611d8633e985a188325d85aec8d8fca08b84` |
| insurance_1.mp4 | 451 937 | `7d029becc3a2ea4b4ef07b6b548305f845f3dedc1ae4d2a033eb66d90eae20f0` |
| double_1.mp4 | 586 589 | `520afc5a4fff08429cfedb053d71b02f07cbc90fbb2c453c9d52f88fe5060ead` |
| bust_1.mp4 | 627 278 | `5ef2c9252098d42009a58cb7c96d58f4194e33710d70fa5b29041813f53b7015` |
| blackjack_1.mp4 | 674 731 | `2d3922a4e335e816f1b480f8d66b0c296c1266bf0cbfa1057de17f0781aeaa37` |
| dealerblackjack_1.mp4 | 487 382 | `20fe023478e42e0344fb0c059967f2a6031d55385e53e3491d2eca09076c81e8` |
| dealerbust_1.mp4 | 631 353 | `010d90f651eef76c43adf563f97e708ada66500b217c9bb31736ef7bc0b31db2` |
| win_1.mp4 | 455 214 | `489f4b6236ec7d68b78f4859edd0e6c99ecc77d01c5df72f094a828d031ba0a5` |
| push_1.mp4 | 686 190 | `a99eaf09d84c8ae10c70936143edaa42fcb04a7420014a030f46edde0f1caf32` |
| lose_1.mp4 | 461 852 | `9edda151b28b90ed81ce6c759a1c208c6312757968829027837306f2fb643b57` |

Samma 11 id finns i `repliker-es/-fr/-zh` (`<id>_<lang>.mp4`, i TSV:n). `greeting_1` hör bara till Table Studio och ligger utanför K04.

### 2.3 Astrid classic som reserv (`dealers.js:104`)

`pick()` returnerar `'astrid'` för okänd eller saknad dealer och vid undantag (`public/dealers.js:97-106`). Då gäller `isAlternative=false` och manifestets filmade klipp spelas direkt.

Astrids fack är exakt dessa filer. Hennes repliker är rotfilerna i 2.2 plus es/fr/zh.

| Fack | Fil | bytes | sha256 |
| --- | --- | ---: | --- |
| deal.player.left/box0 | media/deal/pos1.mp4 | 1 097 504 | `5b9a64e02a112f19624420d9d9fca4f4f3257d3c0d16ffa029895e7c77a70a8d` |
| deal.player.left/box1 | media/deal/pos2.mp4 | 1 033 405 | `596cc3bb4cb381c0eac2521c011f7177734c5db83142d7e748e3f0f091ffc41e` |
| deal.player.centre/box2 | media/deal/pos3.mp4 | 1 024 197 | `f57419df75a07c9c6429478df2507b138d187b6dcbcc6d1fbd92ad92b7513222` |
| deal.player.centre/box3 | media/deal/pos4.mp4 | 1 004 780 | `fdf0f906c4f294473a6d27f7c11a7ba2a2557dd78f53b72a7544440728b2e1d4` |
| deal.player.centre/box4 | media/deal/pos5.mp4 | 931 563 | `f83af80e37820a523aad6ae41db00b1f8e9460e6eae2a6303a6f9c5f8828ca43` |
| deal.player.right/box5 | media/deal/pos6.mp4 | 956 398 | `d59ee75ea7d9538655ad5e9462b7d0143640a579cd3897e133af955ac75b3aa2` |
| deal.player.right/box6 | media/deal/pos7.mp4 | 983 309 | `d3476641345f1f87eadeec1e907de9d8d7b21ab7e8a7660515f5a2c7e4b6a9ba` |
| deal.dealer/dealer-up | media/deal/posdealer.mp4 | 789 847 | `0df5e1fdc679412f056ba74c36e23ae7f8f605e335344a1f4f7cf10bbaea8460` |
| deal.dealer/dealer-hole | media/deal/hole.mp4 | 802 580 | `4a04464e6365054c219a042ddfd20138370f0b94959037be4be54dadf4b1c96e` |
| reveal.dealer/dealer-hole | media/deal/flip.mp4 | 607 616 | `189f67cc15a5d7915cc7a073bbd7653bc1d3147ddb94dd1f00fc05953194427e` |
| idle.ready/ready (vikt 40/14/12/3/1) | media/idle/{still,breath,glance,cheek,insulted}.mp4 | se TSV | `a10bed72…`, `331e50bd…`, `2ba80ca0…`, `c80b4ed3…`, `f189e260…` |
| vilobild | media/startbild.png | 1 628 428 | `eda87f9e877b00dbd2f02479db44ae5f41e2f182563825304906880ceee0088a` |

Studion har pensionerat astrid (K01), men reserven finns kvar i spelet. Den kan tas bort först när `:104` pekar på en dealer med fullständiga fack, till exempel astrid2. Det är ett Admin-/K05-beslut, inte K04:s.

Kontroll mot main:

- M `services/game/public/card-presentation/README.md:18-21` hänvisar till `calibration.mjs` med "the ten standard local MP4 SHA-256 hashes". Filen finns inte i main 95ac98dc.
- Alla 1 293 sha256 i TSV:n jämfördes med mains authoringkällor `media/blob-index.json` och `media/layout.json` (1 104 unika hashar). Bara två träffade: `media/startbild.png` och `media/cards/back-scout.png` (`9c2b3289…8720`). Inget spelklipp från 5aa7ed10 finns där, inte heller Astrids tio deal-klipp. Enligt M `docs/LOCAL-PRESENTATION-RUNTIME.md:162-166` är dessa filer inte runtimeregister.
- Om Neon har dem eller inte avgör K05. Tills dess räknas varje post som "planerad ny post", inte som befintlig.

## 3. Idle och lipsync

### 3.1 Idle-kedja → `live-idle`

| Kevin (K) | Main (M) | Kontraktspunkt |
| --- | --- | --- |
| Vila utan tal: viktad slump ur **lugna** tagningar, aldrig samma två gånger i rad (`public/idle-chain.js:37-43,104-107`, `app.js:105-106`). | `createLiveIdleController` (`packages/presentation/runtime/live-idle.mjs:23`): `base[]` viktat (`:63-74`), vikter ska summera till 100 (`runtime/idle-policy.mjs:36`), varianter automatiskt eller efter regler. Familj `<dealer>/idle.ready/ready`, krävs i `services/game/public/local-presentation.mjs:39-41`. | I1: lugna tagningar → `base`, med vikt normerad till 100. Main saknar regeln "inte samma två gånger". Den måste in i kontrollern eller adaptern. Första `base` är `standardBase` och öppnar talgrinden (`live-idle.mjs:73`, `local-presentation.mjs:199`). Kevins grind är VILA i alla tagningars start och slut. |
| Väntan på spelare: `r.waits = {from, until, seed: plan.id, takes}` lagt av servern (`server/shared-table.mjs:207-213`). Samma kedja för alla tittare och för workern (`idle-chain.js:62-97`). Nästa tagning startar på klippgräns (`shared-table.mjs:153-154`). | Klientens slump `seed = crypto.getRandomValues` per tittare (`local-presentation.mjs:40`). Ingen serverlagd kedja. | I2: rumsdelad väntekedja kräver att servern lägger `{from, until, seed, takes}` i outbox/snapshot. Seed = `talkId` eller `planId`, sha-bundna tagningar. Då behöver `live-idle` ett läge som följer en given kedja i stället för egen slump. |
| Tal i vila: `talk.idle` = livlig kedja `layChain(…, seed)` (`idle-chain.js:45-60`, `shared-table.mjs:64-70`). Gaplös: `LEAD` 100 ms, överlämning 1,5 frame före slut, nästa klipp förladdas ≤ 2,5 s (`idle-chain.js:6,113-122`, `app.js:144-155,313-321`). | En förberedd video (`services/game/public/performance-player.mjs:42-57`), `film()` sekventiellt (`local-presentation.mjs:110-134`). | I3: en lookahead räcker för Kevins kedja om nästa klipp är känt ≥ 2,5 s före. Adaptern ger `prepareSequence`/`prepareLocalClip` nästa kedjeklipp (`local-presentation.mjs:315`). Livliga tagningar får inte hamna i `idle.ready`-viloläget. De behöver en egen kedjeroll, se 3.2. |

### 3.2 Moving lipsync → `setMovingSpeechLayer`

| Kevin (K) | Main (M) | Kontraktspunkt |
| --- | --- | --- |
| Talspår per rum `state.talk[]` `{id, kind, startAt, endAt, kartaStart, idle?, flex}` (`shared-table.mjs:191-195,463`). Patchar skickas till **alla** i rummet: `{t:'lip', talk, del, fran, till, rutor, ver}` + binärram (`server/server.mjs:123`, `public/app.js:414-431`). | En session per svar: `/moving-speech-stream` med biljett (`runtime/moving-speech-player.mjs:24-58`), en tittare. Strikt ordning `fran === received` (`:305-315`). | L1: rumsbroadcast med `talkId` från outboxen. Mains strikta sekvens per socket passar inte en tittare som ansluter mitt i (K `lip-layer.js:96-108` catchUp). Transporten ägs av J07 eller en mottagare som J07 binder. |
| `ver` per tal = omplanering. Klienten ersätter aldrig nyare med äldre (`lip-layer.js:72-75,86-87`). I dag en minnesräknare (`server/rorlig-lipsync.mjs:242-246`). | Mottagarspärr per rum `ver > lastAccepted`, `'duplicate'` vid samma ver (C `table/ports.mjs:40-46,90-102`). `deliverOutbox` (`table/coordinator.mjs:583-594`). Mains plan binder `talkId#revision#planSha256` (`services/game/moving-speech-plan.mjs:70-71`). | L2: i C är `talkId = plan.id`, som är nytt för varje `present()`. Kevins omplanering behåller samma tal-id med högre ver. Antingen behåller C talkId över omplanering, eller så mappar adaptern `(roomId, ver)` → Kevins `(talk, ver)`. Patchar med lägre ver än mottagarens senaste för samma tal kastas. Spärren måste vara varaktig (O01 2.9). |
| Patch ritas bara om `take:frame` på skärmen matchar (`lip-layer.js:53-60,143-156`, `dealer-layer.js:200`). ±48 frames. VILA-ekvivalens. | `matchFrame` kräver exakt `take`, `frame`, `sourceSha256` och `planSha256` (`moving-speech-plan.mjs:87-98`). `setMovingSpeechLayer(layer)` byter eller tar bort munlagret (`runtime/presentation-composition.mjs:90-97`, anropas `moving-speech-player.mjs:301`). | L3: kroppens tidslinje ska anges som sha-bundna källor. Mains `sequence.steps` accepterar bara `event.type === 'deal'` (`moving-speech-player.mjs:91-95`) och bara registrerade videor. Idle-tagningar under tal (3.1 I3, väntekedja) kräver att `sequence` tillåter idle-steg med `videoId`/`sha256`. ±48 är tolerans, inte synkbevis (O01 2.10). |
| Ingen varm worker eller sen patch: kropp och ljud utan mun. Repliken blir inspelat steg (`shared-table.mjs:163-164`, `lip-layer.js:7-10`). Mobilljud via pool av 3 `Audio` (`public/voice-pool.js:13-47`). | Utan talfilm → `skipped`/`failed`-kvitto, spelet fortsätter (`local-presentation.mjs:250-259,307-309`). | L4: fallback ska vara inspelad replik med exakt sha (2.1). Aldrig fristående mun eller frys på VILA. Ljudpool behövs för iOS (main har ingen motsvarighet i dessa filer). |

### 3.3 Kontraktspunkter för K04-adaptern (sammanfattning)

1. Ta emot outboxrad `{roomId, auditSeq, talkId, ver, payload}` efter COMMIT. Svara `'applied'`/`'stale'` via atomisk spärr per rum (C `ports.mjs:40-46`).
2. Få `publicView.round` **före och efter** varje committat steg (G1) och kör `presentationEvents`. Reveal ska placeras som i Kevins `planDraws` (G4). Bust, sidebet och twentyone ska läggas till (G2, G5).
3. Committat kort först, animation sedan. Klienten avslöjar bara kort som finns i den committade händelsen. `presentationInput` (M `presentation-api.mjs:42-58`) slår upp per `roomId`/`ver` i stället för `player_id` (G10).
4. Speltid kontra presentationstid: `turnAt`/`actionDeadline` kommer från C (konfig). Klippens faktiska längd från `meta.json frames` får inte flytta spelets deadlines. Ett glapp redovisas som presentationsavvikelse (G3).
5. Rundslut: placebets och idle från snapshotens `settled→bets` (G8).
6. Idle: lugn pool → `base` (I1). Servern lägger väntekedjor (I2). Livliga tagningar bara under tal (I3).
7. Lipsync: rumsbroadcast, `(talkId, ver)` och exakt `take:frame:sha` (L1-L3).
8. Medier: bindning per sha256 och Kevins variantnamn, inte pose-suffix (G12). Data-beroendena i TSV:n är del av identiteten.
9. Laddningsfel, talfel och replay ändrar aldrig saldo, sko eller utfall. Adaptern har bara läsportar mot spelet.

## 4. Öppna frågor och vad som väntar på J07

**Väntar på J07** (Postgres-adapter, transaktioner, lås):

- Bindning av `tx.outbox.put`, `store.outbox.{pending, deliveredVer, ack}` och varaktig `lastAccepted` per rum (C `ports.mjs:29,36-46`). Var mottagaren/sinken körs.
- Var den rumsbundna presentationen lagras, i stället för `native_presentations` per spelare (M `postgres-native-table.mjs:36-40`, `presentation-api.mjs:170,232`).
- Rumstransport (WS) för outboxrader och lipsyncpatchar. Snapshot-läsväg för återanslutning.
- `ConfigPort.frozen` med `leadMs`, `cardMs`, `actionMs` och `language` per rum/dealer (J08 äger Admin-värdena).

**Kräver beslut innan K04 kopplas in:**

1. G1/G8/L2 är ändringar i C, som Kevin äger: view före/efter (eller färdig `presentationEvents`-lista) i outboxens payload, en outboxrad vid collect och stabilt `talkId` vid omplanering. Ska de göras i K03 eller lösas i adaptern?
2. G4/G6/G7: rättas mains `presentationEvents` på main, eller använder K04 Kevins `planDraws`/`outcomeSpeech` för C-rum? Felet gäller även mains nuvarande bord.
3. G12: hur registreras `-u`/`-v` och `-iu`/`-iv` som skilda poster i katalogen (K05)?
4. G13: får main nya talfack (`twentyone`, remarks, `greet_<namn>`, banter, table_*) eller avstår K04 från dem?
5. Vilken `land`-tabell gäller (`dealers.js` eller `meta.json`)?
6. Astrid-reserven (`dealers.js:104`): ska den ersättas av astrid2 innan V1-klipp tas bort (K05/Admin)? Rotkatalogen `/media/repliker` får inte röras förrän adaptern har egen nyckel.
7. Mårten: bara inspelade repliker, eftersom avatarpaket saknas. Ska K04 visa honom alls utanför studiobord (`PUBLIC_HIDDEN`, `dealers.js:96`)?
8. Mains README hänvisar till en borttagen `calibration.mjs`. Hasharna för Astrid-klippen kan bara jämföras i Neon (K05).
