# O01: Kevins svar, konsoliderat

Kevin-kod: `kevin-merge-admin` @ `5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc`, sökvägar relativa till `kevin/croupier-scoutgg/`, `:NNN` = `server/shared-table.mjs`. Main: `15988f32fd572c453d2189502acbe324c4566815`. Enbart läst, inget kört. Dokumentet ersätter tidigare versioner (24cacc5, aa5b607): avsnitt 1 är fakta, avsnitt 2 är föreslagen specifikation enligt granskningen i kommentar 6320891096 och MASTERPLAN @ `74ef7d9a`, avsnitt 3 är det som inte är beslutat. Ingen runtimeport, DDL eller GPU-körning startas av detta. Låsbeteckningar som i MASTERPLAN: G (advisory 1129467984), R (rum, sorterade), P (spelare, sorterade), A (spel-audit), alltid G → R → P → A utan senare utvidgning.

## 1. Dagens beteende

### 1.1 Kommandon, version, requestId och tidsövergångar

- Varje `POST /api/table` är en `BEGIN IMMEDIATE`-transaktion i SQLite (`:331`). Skrivlåset gäller databasfilen för alla anslutningar och processer (filen öppnas också av `server/table-service.mjs:9`). Ingen `busy_timeout`, så en annan skrivare får "database is locked" direkt. Serialiseringen följer inte med till Postgres.
- `seen` uppdateras (`:335`) och `advance()` körs (`:336`) före varje kommando, även `state`, och före requestId-kontrollen (`:339-341`). En poll eller retry kan därför starta rundan, auto-standa, avgöra insurance eller avräkna, med auditrader (`round.started` `:225`, `presentation.plan` `:214`, `engine.*` `:108`, `wallet.settlement` `:281`) som committas även när kommandot hoppas över.
- `advance()` körs också i `tick()` var 250 ms (`:443-445`, `server/server.mjs:141`), inne i `leave` (`:385`) och för **alla rum** inne i `pause` (`:351-353`). Övergångarna saknar egen identitet; `engine.*` får `cause:{source:'automatic table progression'}` (`:108`).
- `r.version` ökar vid varje lyckat kommando utom `state` (`:435`), vid ny plan (`:216`), auto-lämna/frisläppta platser (`:256`, `:263`) och avräkning (`:284`).
- `onPlan` (`:217`) och `cheer.say` (`:219`) körs inne i transaktionen före `COMMIT` (`:438`). `onPlan` skickar repliker till lipsync-workern (`server/server.mjs:132-138`). Rullas kommandot tillbaka (t.ex. `:346`, `:421`) är workerjobbet redan skickat.

| Trigger | Resultat i dagens kod | Prov / kodref |
|---|---|---|
| `act` med `version` ≠ `r.version` | `Table changed. Please try again`, ROLLBACK. **Enda** op som kräver exakt version. | `:346`; delat bord saknar prov (solo: `game-integration.test.mjs:85`) |
| `act` före `plan.turnAt` / på annans hand | `Wait for your turn` / `It is another player's turn` | `shared-table.test.mjs` rad 46, `:422`; kod `:376`, `:421` |
| `bet`, `undo`, `clear`, `doubleBets`, `allSeats`, `repeat`, `ready`, `insurance`, `join`, `leave`, `refill`, `pause`, `next` med gammal version | Accepteras; styrs av fas, ägarskap och `leaving`. `ready` från sista sittande online-spelare (seen < 15 s) startar rundan i samma transaktion (`:415-419`). Insurance är engångsval (`:426`). `next` kräver `settled` och klar plan (`:430-431`). | `shared-table.test.mjs` rad 37-44, `:71`, `:19`, `:301`, `:322`; versionstolerans för flera op saknar prov |
| Två spelare tar samma box | Först serialiserad vinner, den andra får `Choose one of your boxes` / `That box was just taken` (`:358`, `:393`) | racet saknar prov |
| `language` | Accepteras i `bets` utan satsningar (`:377-381`) | `dealer-language.test.mjs:17` |
| Samma requestId, samma input | Kommandot körs inte igen, ingen `player.*` (`:343`), men `advance` har redan körts. Svaret är **aktuell** snapshot, inte lagrat resultat. | `shared-table.test.mjs` rad 39-40, `backoffice.test.mjs:56-61`; retry över deadline saknar prov |
| Samma requestId, annan input / saknas / > 100 tecken | `Request ID reused with different input` (`:341`) / `Request ID required` (`:339`) | saknar prov |
| Misslyckat kommando, sedan retry | ROLLBACK, requestId sparas inte; retry körs på nytt. Redan skickad presentation rullas inte tillbaka. | saknar prov |
| Klient vid nätfel | Samma payload och requestId igen (`public/shared-table.js:129-131`); lägre version kastas (`:61`); poll 700 ms (`:367`) | saknar prov |

Följd: under `decisions` gör varje lyckat kommando från en annan spelare (`refill`, `leave`, `join`, `pause`) samt auto-stand/leave den aktiva spelarens `act` inaktuell. Klienten visar felet, inget automatiskt omförsök.

### 1.2 Konfiguration och språk

Studiobord är oföränderliga: `createStudioTables` saknar update/publish (`server/studio-tables.mjs:39-72`), ny konfiguration = ny slug (`:54-56`). `READY_TAKES` och idles läses vid serverstart (`server/server.mjs:80-81`).

| Värde | När det läses | Följd | Kodref |
|---|---|---|---|
| `limitsFor(room)` | Vid varje snapshot (`:294`), bet/allSeats (`:395`, `:408`), `checkLimits` (`:410`), refill (`:383`), startsaldo (`:363`), och vid `start()` (`:226-227`) | Nya gränser mot gamla satsningar får `start()` att kasta inne i `advance()` (`:271`) efter deadline. Eftersom `advance` körs före varje kommando rullar även `state`, `clear` och `undo` tillbaka och `tick` sväljer felet (`:444`): spelaren kan inte själv rensa. Låses upp först av paus (`:266-268`), 120 s frånvaro (`:262-264`) eller omstart. | `table-limits.test.mjs:21`, `:35`, `:45`; byte mitt i rundan saknar prov |
| `languageFor(room)` | Bara när rummet skapas (`:91`); `plan.language` fryses per plan (`:201`) | Klienten skickar `language` med länkens `?lang` vid varje poll där fasen är `bets` utan satsningar (`public/shared-table.js:19`, `:70-72`; `gameUrl` lägger alltid till `lang`, `studio-tables.mjs:67`). **En spelares länk kan byta bordets språk** långt efter inloggning. | `table-limits.test.mjs:54`; länkfallet saknar prov |
| `readyFor` / `talk(room)` | Vid varje plan och svar (`:141`, `:145`, `:462`) | Worker kan bli varm eller försvinna mitt i en runda; repliker växlar mellan talk-track och steg (`:163`). Bara presentation. | `rorlig-lipsync.test.mjs:76` |
| Sko | Ny sko bara vid `start` när cut nåtts (`shoe-game.mjs:66`) | Redan knutet till rundstart | `croupier-shoe.test.mjs` |

Naturlig gräns: `start()` (`:221-232`). Mellan `resetRound` (`:248`) och nästa `start` finns inget handtillstånd. Fasen `bets` har ingen egen öppningspunkt: deadline sätts av första main-satsningen (`:413`), och `roundId` nollas inte i `resetRound` (`:251`, `:298`).

### 1.3 Wallet, audit och tal

- Saldot ligger **per rum** (`shared_players.balance`, `:48`, `:96-101`), med `opening_credit` vid join (`:364`). Ledgerraden (`transactions.mjs:12`) saknar id som kvitto (`:280`) eller audit (`:281`) kan referera, och audit skrivs före utbetalningen (`:281` före `:282`).
- Main: `logTx` (`services/game/server.mjs:209-211`) har ingen `RETURNING id`. `credit` (`services/game/partner-api.mjs:52-60`, `storage/async-partner-api.mjs:47-56`) öppnar egen `db.transaction`. Mains saldowriters: `postgres-native-table.mjs:14`, `games/roulette/storage.mjs:44`, deposit/currency `server.mjs:265`, partner/demo/Studio-credit `async-partner-api.mjs:95`, admin `packages/storage/server/player-administration.mjs:23`.
- Spel-audit är en **global** kedja: `event()` läser föregående hash ur hela tabellen (`game-audit.mjs:20`) och infogar i en separat autocommit-sats (`:23`); `room` ingår i hashen (`:22`). `read()` filtrerar per rum (`:56-68`) men returnerar global `chainHead` (`:69`). Ingen verifierare läser `previous_hash`. Shoe proof (`verifyShoe`, `:26-32`) gäller en stängd sko; ordningen är privat tills dess (`:49`).
- `presentation.speech_choice` skrivs av `recordSpeechDecision` (`:480-484`) från OpenClaw-grenen (`server/server.mjs:162`, även `safetyAudit.write`) och verktygsgrenen (`server.mjs:199`, **bara** spel-audit). Parent tas från en separat läsning (`:479`). Allt är synkront i en process, så förgrening kräver konkurrerande skrivare; det är inget observerat fel idag. `safetyAudit` är ingen likvärdig kopia: den gallras efter 30 dagar (`server/safety-audit.mjs:3-6`) och saknar room/round/parent.
- `speak()` (`server/rorlig-lipsync.mjs:242`) sätter `ver = (old?.ver ?? 0) + 1` i minnet vid **varje** anrop (`:246`). Samma replik skickad två gånger blir två versioner; efter omstart börjar `ver` om. Det är inget beständigt dubblettskydd.

### 1.4 Idle, lipsync och fallbacks som ska bevaras

| Trigger | Resultat i dagens kod | Prov / kodref |
|---|---|---|
| Väntan utan tal (före bet, mellan rundor) | Slumpad idle ur calm-poolen, viktad, aldrig samma klipp två gånger i rad | `idle-chain.test.mjs:71`, `:82`; `public/app.js:103-110`, `public/idle-chain.js:37-43` |
| Mitt i rundan utan väntan eller tal | Stillbilden VILA, ingen idle (`app.js:153`) | saknar prov |
| Väntan på beslut/insurance | `r.waits` från planens slut; kandidater = annonserade idles, annars alla; filter calm, annars `andas`, annars ingen kedja; deterministisk FNV-seed (`:207-213`) | `rorlig-lipsync.test.mjs:492`, `:530`, `:573`, `:589` |
| Hit/stand under väntekedjan | Nästa take på nästa klippgräns (`:153-154`); rundslut rensar `waits` (`:251`) | `idle-chain.test.mjs:51` |
| Tal i vila / under väntan / mitt i rundan | Livlig kedja ur alla idles (`:64-74`, `rorlig-lipsync.mjs:89-112`) / väntans kedja (`:68-69`) / ingen idle (`:70`) | `rorlig-lipsync.test.mjs:334`, `:366`, `:382` |
| Gaplös kedja | `LEAD` 100 ms, dolt nästa element, överlämning 1,5 frame före slut, förladdning 2,5 s | `idle-chain.test.mjs:15`, `:92`; klientdelar `app.js:118-326` saknar prov |
| Workerval | Tidigaste deadline, `horizonMs` 3 s, `urgentMs` 2,5 s, < 30 fps bort, hängd 15 s vilar 60 s | `rorlig-lipsync.test.mjs:132-547`; `rorlig-lipsync.mjs:177`, `:311-342`, `:391` |
| Karta / patchar | 24 fps från `startAt − 0,22 s`, glipa håller sista frame (`rorlig-lipsync.mjs:62-82`). `patchKeys` ger exakt `take:frame` plus reservnycklar (sista frames, `frame-1`, `vila`) (`public/lip-layer.js:53-60`); närmaste tidsindex inom ±48 väljs (`:147-152`) utan omkontroll av `tag` (`:153`); ersatt patch lämnar gammal indexnyckel (`:88-89`); ersatt av tyst ruta ger `undefined` som `at()` läser (`:90`, `:153`; läst, inte kört) | `rorlig-lipsync.test.mjs:33`, `:122`, `idle-chain.test.mjs:105` |
| Ny plan under replik | Ny karta från `fran`, högre `ver`, gamla avbryts; klienten ersätter aldrig nyare med äldre (`lip-layer.js:74`, `:87`) | `rorlig-lipsync.test.mjs:164`, `:243`, `:261` |
| Ingen varm worker | Inspelat videosteg, ingen idle under tal; väntekedjan läggs ändå med calm/andas (`:163-164`, `:207-212`) | `rorlig-lipsync.test.mjs:76`, `:408` |
| ko2 (bara deal-takes) | Vilar på stillbilden, mun på VILA | `rorlig-lipsync.test.mjs:419` |
| Worker försvinner mitt i replik | Avslutas direkt; med idle i kartan görs den om **en gång** med `vilaMap`, som bara byter patchkartan (`rorlig-lipsync.mjs:29`, `:260-268`); kroppen spelar idle, mun bara i `rest` | `rorlig-lipsync.test.mjs:189`, `:464` |
| Sen patch / ingen `VideoDecoder` / annat språk | Kropp och ljud utan mun, aldrig frys på VILA (`lip-layer.js:7-10`, `:34`, `:92`; `app.js:566`) | saknar prov |
| Mobilljud | Pool med 3 `Audio`, upplåsning i gesten, "Tap for sound" vid nekad `play()` (`public/voice-pool.js:13-47`, `app.js:256-258`, `:342-368`) | `voice-pool.test.mjs:11-42`, `playback-recovery.test.mjs:63` |
| Återanslutning mitt i replik | `catchUp` pollar `/api/lip/<id>` var 400 ms, buffrar 20 tal, ljud söks in, bitar sparas 10 min (`lip-layer.js:95-136`, `server.mjs:438-451`, `rorlig-lipsync.mjs:461`) | saknar prov |

## 2. Kontraktsgränser (specifikation, inte implementation)

### 2.1 Modulgränser

- **K02** är en ren tillstånds-/händelsefunktion: `(state, command|tick, frozenConfig) → {state', events[], effects[]}`. Ingen I/O, inga portar, inga lås, ingen resurs- eller låsplanering.
- **K03** äger portgränssnitten och koordinatorn som räknar ut låsplanen, läser via portar, anropar K02 och skriver resultatet. Även SQL-fria portar är I/O och hör hit.
- **J07** binder portarna till den redan låsta råa SQL-klienten (`runLocked(lockPlan, work)`). Rå SQL finns bara i J07-adaptrar. Root äger mains wallet- och adaptergräns.

Portar (K03, bundna i J07): `WalletPort` (`available`, `reserve`, `consume`, `release`, `debit`, `credit`; alla returnerar `ledgerId` där pengar rör sig), `RoomStatePort`, `MembershipPort`, `CommandReceiptPort`, `TickPort`, `PausePort`, `GameAuditPort` (bara under A), `PresentationOutbox`, `ConfigPort` (`frozen(roomId, configVersion)`). Koordinatorns `lockPlan(command, preRead) → {global, rooms[], players[]}`; behövs ett lås utanför planen: `LockSetExceeded`, ROLLBACK, nytt försök med större plan.

### 2.2 Kommandokvitto och replay

- Kvitto under `(roomId, actorId, commandId)` med full inputfingerprint och lagrat resultat. Svaret är `{result, snapshot}`; resultatet är lagrat, snapshot är aktuell och hålls separat.
- Replay med samma fingerprint returnerar lagrat resultat plus skrivskyddad snapshot **utan** tick, presence-skrivning eller ny audit. Annan fingerprint: `Request ID reused with different input`.
- Avvisat kommando: ROLLBACK, inget kvitto, ingen audit; får provas om.
- `state` skriver inget och kör ingen tick. `seen` blir en separat presence-skrivning utanför spelets transaktion; den läses av tick `seat.absent` men skriver aldrig rumsstate.

### 2.3 Ticks

- **Beslutat (6321288941):** en självständig scheduler driver alla tidsdrivna övergångar som egna transaktioner. Kommandon, requests och retries driver aldrig spelets tid. First-caller-alternativet är borttaget ur målkontraktet.
- `tickId = roomId : kind : tickAnchor(parts) : scheduledAt`. `tickAnchor` procentkodar varje del och fogar ihop med `,`, så att olika aktör-id:n aldrig kan ge samma tickId (K03 `ports.mjs:82`). `scheduledAt` är den lagrade deadlinen (aldrig `now()`). Resultat i `table_ticks(tick_id PK, room, kind, outcome, result, committed_at)` i samma transaktion som effekterna; `outcome` ∈ `applied | superseded | rejected | blocked`; samma tickId körs aldrig två gånger.
- Auditrad `table.tick {tickId, kind, scheduledAt}` blir parent till följande `engine.*`.

| Rad i `advance()` idag | Tick-kind | anchor | scheduledAt | Lås |
|---|---|---|---|---|
| `:262-263` frånvaro > 120 s i runda | `seat.absent` | `['absent', actorId, memberGen]` (spelarunik) | `seen + 120000` | R → P(spelaren) → A |
| `:264` frånvaro utanför runda, `releaseSeats` | `seat.release` | `['absent', actorId, memberGen]` (spelarunik) | `seen + 120000` | R → P(spelaren) → A |
| `:271` deadline nådd, `start()` | `window.close` | `windowId` | `r.deadline` | R → P(alla med insats) → A |
| `:285-288` insurance-timeout eller lämnande | `insurance.timeout` | `roundId` | `actionDeadline` | R → P(alla tagare) → A |
| `:289` beslutstimeout, auto-stand | `turn.autostand` | `roundId:turnSeq` | `actionDeadline` | R → A |
| `:272-284` avräkning | `round.settle` | `roundId` | `plan.endAt` | R → P(alla med hand) → A |
| `:291` `leaving` släpps efter rundan | `seat.release` | `['leave', roundId, playerId]`. `next` låser även lämnande spelare och verkställer utträdet före rundreset, så väntande release blir superseded. | settle-commit | R → P(spelaren) → A |

`:266-268` (paus rensar) görs av `pause`; `:258`, `:270` (deadline utan main) blir invariant i insatskommandona.

### 2.4 Identitet per kommando

`windowId` präglas i `resetRound` och när rummet skapas. `turnSeq` ökar vid varje godkänt motordrag (start, insurance, varje act, auto-stand). `seatGen` per (rum, box) ökar vid ägarbyte, `memberGen` per (rum, aktör) vid nytt medlemskap och slutligt släpp. Global `version` finns kvar bara som snapshotversion.

| Op (kod idag) | Identitet utöver commandId | Lås | Wallet | Audit |
|---|---|---|---|---|
| `bet`, `doubleBets`, `allSeats`, `repeat` (`:391-402`, `:407-408`) | `windowId` | R → P(aktör) | `reserve` mot `available` | `player.<op>` |
| `undo`, `clear` (`:403-406`) | `windowId` | R → P(aktör) | `reserve` (justera) / `release` | `player.<op>`. **`clear` tillåts även efter deadline så länge rundan inte startat.** Den häver ready och släpper aktörens insatsreservation, så att ett blockerat bord kan gå vidare. `undo` efter deadline är fortsatt stängd (senare fråga). |
| `ready` (`:415-419`) | `windowId` | R → P(alla med insats) | sista ready: `consume` per spelare | `player.ready`; vid start `round.started`, `engine.start`, `presentation.plan` |
| `insurance` (`:425-429`) | `roundId` + `phase:'insurance'` | R → P(aktör; vid sista beslutet alla tagare) | ja: `reserve`; sista beslutet: `consume` per tagare | `player.insurance`, ev. `engine.insurance` |
| `act` hit/stand / double/split (`:420-424`) | `roundId` + `turnSeq` + `box` + `handIndex` | R / R → P(aktör) | double/split: `debit` mot `available` | `player.act`, `engine.act` (+ ledger-id) |
| `next` (`:430-432`) | `roundId` (den avgjorda) | R | - | `player.next` |
| `join` (`:354-371`) | `seatGen` per box, `memberGen` | R → P(aktör) | ingen; `opening_credit` utgår, se 3.1 | `player.join` |
| `leave` (`:384-386`) | `memberGen` | R → P(aktör) | i `bets`: `release` | `player.leave`; auto-stand blir tick |
| `refill` (`:383`) | - | G (om rootens writer kräver det) → R → P | `credit` enligt mains demo-credit-policy | `player.refill` + ledger-id |
| `pause` (`:349-353`) | se 2.6 | R(alla medlemsrum, sorterade) → P(aktör) → A | `release` i alla rum i `bets` | `player.pause` per rum |
| `language` (`:377-382`) | utgår som spelar-op (2.8) | - | - | - |

`next` är giltigt när `round.settle` för samma `roundId` är committad (`now ≥ plan.endAt`, `:272`); planen är ingen uppspelningskvittens (`:214`) och `r.talk` blockerar inte.

### 2.5 Reservationer och wallet

**Omfattning (beslut 6321854403 och Kevins gröna ljus):** spelkärnan (K02) äger inget saldo och anropar inget wallet-API. K03 använder en explicit `WalletPort`. I migreringen kopplar J07 den till mains serverägda **demowallet** i PostgreSQL. Aggregatorn äger verkligt saldo och betalningar i en senare, separat integration. Ingen extern betalningskoppling, ingen SQLite-genväg och ingen tyst demo-fallback när extern wallet är konfigurerad.

Demowalletens saldo är mains globala; `available = balance − öppna reservationer` över alla bord. Varje övergång sker atomiskt under P:

| Händelse | Reservation |
|---|---|
| `bet`/`doubleBets`/`allSeats`/`repeat`/`undo` | `reserve` / justera i samma transaktion som boxändringen |
| `clear`, `leave` i `bets`, `seat.release` (frånvaro), `pause` | `release` av aktörens **insatsreservationer i fasen `bets`** i det rummet. En accepterad insurance-reservation släpps aldrig av dessa (se nästa rader). |
| Rundstart (`ready` sista, `window.close`) | `consume` per spelare: debet som pekar på och stänger reservationen; ingen debet utan motsvarande reservation |
| Tidigt insurance-ja | `reserve` vid valet; `consume` när sista beslutet eller `insurance.timeout` avgör. Valet är bindande: `pause`, `leave` och `seat.absent` efter ett accepterat ja ändrar inte reservationen, den konsumeras när insurance-fasen avgörs. |
| `leave` / `seat.absent` / `pause` mitt i runda | ingen öppen insatsreservation finns (konsumerad vid start). En öppen insurance-reservation från ett accepterat ja **konsumeras** när insurance-fasen avgörs (sista beslut eller `insurance.timeout`); den släpps bara om spelaren aldrig sa ja. |
| double/split | direkt `debit` mot `available` |

- **Alla** mains debetwriters (1.3) måste räkna `available` med reservationerna och vägra debet som skär i dem; valutabyte nekas med öppna reservationer. Detta ägs av root.
- Ordning på samma injicerade klient i samma transaktion: wallet → ledger-id (`RETURNING`) → kvitto (med ledger-id) → audit (med ledger-id). Mains `credit` som öppnar egen transaktion får inte anropas efter R/P/A.
- **Ledgerns idempotensnyckel** (unik): `(namespace ∈ {command, tick}, roomId, actorId, identity, affectedPlayerId, effect)`, där `identity` = `commandId` eller `tickId`, `actorId` = `system` för tick och `effect` t.ex. `consume:stake`, `release`, `payout`, `refill`. Samma scope som kvittot; naket `commandId` räcker inte (kolliderar mellan rum). Ändrad input avvisas via kvittots fingerprint.
- **Nekad `consume` vid start (godkänt av Kevin, 6321685315):** **spel- och walleteffekterna** av `window.close` återställs: ingen debet, ingen rundstart, inga motorevents. Accepterade val och reservationer ligger kvar, och ingen annan spelares insats rensas automatiskt.
  - **Blocked-kvittot committas beständigt i samma yttre transaktion efter `ROLLBACK TO SAVEPOINT`** (Jakobs val för J07, 6322089912). Hela den planerade G/R/P/A-låsmängden tas i ordning före savepointen. Ett nekat `consume` återställer försöket till savepointen: wallet/ledger, spelstate, motorevents och outbox. Låsen behålls, och endast `table_ticks(outcome = blocked, blockedOn = {playerId, reservationId, walletGen})` plus auditraden `table.tick {tickId, kind, outcome: blocked}` skrivs före yttre COMMIT. Misslyckas den skrivningen rullas hela transaktionen tillbaka.
  - Detta gäller bara ett **domänmässigt** nekat consume. Anslutnings- eller transaktionsfel ger aldrig ett blocked-kvitto. Två fulla transaktioner används inte.
  - En omstart efter blockering läser samma kvitto och ser samma stopp och samma ändringsvillkor.
  - **Omprövning utan oändlig loop:** schedulern kör inte samma passerade deadline igen förrän något i `blockedOn` har ändrats. Det gäller nytt `walletGen` för spelaren (insättning eller annan writer), att reservationen släppts eller ändrats (`clear`, `undo`, `leave`, `seat.release`, `pause`) eller en uttrycklig återhämtning från Admin. Varje omprövning får ett nytt `tickId` (`…:retry:<n>` med ändrings-generationen som ankare), så samma tillstånd prövas aldrig två gånger.
  - **Stake och insurance via samma väg (K03):** en saknad eller otillräcklig insats- eller insurance-reservation klassas som `WalletDenied` **före** kärnsteget och ger aldrig nollfinansiering. Detsamma gäller faktisk `WalletDenied` från `consume`. Både `window.close` och `insurance.timeout` ger `blocked` med `blockedOn = {playerId, reservationId, walletGen, reservationGen}`, där saknad generation normaliseras till `null` i kvitto och jämförelse. Omprövning sker exakt en gång efter ändrad generation, utan loop, även efter omstart.
  - **Sista insurance-kommandot** avvisas atomärt utan kvitto (`INSURANCE_NOT_FUNDED`) om avgörandet nekas. Tidigare accepterade ja och deras reservationer består, även genom pause och leave. Timeout-ticken återhämtar läget. Infrastrukturfel ger full rollback och aldrig ett blocked-kvitto.
  - Under blockering står fönstret stängt för nya insatser från andra. Bordet visar att det väntar på en spelare.

### 2.6 Pause, join och leave

- Pause gäller kontot i alla rum. **24 h är effektens längd** från commit (`MAX` med befintlig, som `:350`), inte en giltighetstid för sen första leverans.
- **Beslutat (Kevin, 21/10):** ett pause-kommando **avvisas aldrig som inaktuellt**. Även ett sent första mottaget kommando gäller direkt från commit i 24 h (`MAX` med befintlig paus), för kontot i alla rum. En paus får aldrig tappas. Detta motsvarar dagens beteende (`demo_breaks`, `:349-353`). Replay av samma pause-kommando ger lagrat resultat och förlänger inte pausen. `pauseGen` och `accountMembershipGen` är inte giltighetsvillkor. `accountMembershipGen` används bara för att låsa rätt rumsmängd (nästa punkt).
- Låsning: läs medlemskap utan lås, lås rummen sorterade, lås P(aktör), läs medlemskap igen. Ändrad mängd: ROLLBACK, nytt försök med ny plan. Mängden är fast före A.
- `join` och `leave` tar samma P(aktör) och kontrollerar paus under P, så medlemsmängden kan inte ändras efter pausens omläsning.
- Effekter: i rum i `bets` rensas aktörens insatser och ready med `release` (ersätter `:266-268`). Mitt i runda gäller dagens spärrlista (`:347-348`): bara `stand` och insurance-nej. Dagens `advance` av alla rum inne i pause (`:351-353`) tas bort.

### 2.7 Konfiguration

- `configVersion` (limits, marker, refill, språk, dealer/`READY_TAKES`, `betMs`/`actionMs`) binds till `windowId` när fönstret skapas och lagras i rumsstate. Tomt bord (ingen main, ingen deadline) får byta till ny version och nytt fönster.
- `start()`, kontroller och snapshot läser den frysta versionen, aldrig `limitsFor` live. Då försvinner låset i 1.2. Config-byte rensar eller ändrar aldrig accepterade insatser.
- `round.started` bär `configVersion`.

### 2.8 Bordsspråk (beslutat, alternativ a)

Admin äger bordets språk som del av `configVersion` (issue #312, kommentar 6320750204). Spelar-op `language`, klientens skrivning (`public/shared-table.js:70-72`) och `presentation.language` (`:381`) utgår; språkbyten blir Admin-publicering i Studio-/operatörsaudit (main `apps/studio/lib/studio-native-runtime.mjs:132`). Privat UI-lokalisering (UI-text, undertexter) skriver aldrig bordets media eller ljud.

### 2.9 Presentation-outbox

- Outboxraden `{roomId, auditSeq, talkId, ver, payload}` skrivs i samma transaktion som kommandot/ticken, med **lagrat** `ver` (ersätter `onPlan` före COMMIT, `:217`).
- Leverans direkt efter COMMIT är snabbvägen (budget: plan startar 700-1500 ms efter kommandot, första patch tar 1,15-1,3 s, `:150`, `:452-453`). Ej kvitterade rader återupptas efter krasch eller omstart med **samma** `talkId`/`ver`; äldre planversioner spärras. Workerns dubblettnyckel är `talkId + ver` från outboxen, inte `speak()`s minnesräknare (1.3).

- **Bindande mottagarversion (K03):** ordningsgarantin ligger hos mottagaren. `sink(row)` svarar `'applied'` eller `'stale'` efter en atomisk versionskontroll per rum (avvisar `ver <= lastAccepted`). Allt annat räknas som misslyckad leverans och återupptas. `deliveredVer` är bara en hint för att hoppa över. En fördröjd ver1 appliceras aldrig efter ver2. Att versionsspärren är varaktig över omstart och flera processer verifieras i J07/K04.

### 2.10 Lipsync-identitet

Huvudregel: exakt dealer + take:frame + ljud + planversion. Två deklarerade ekvivalenser: hållen sista frame och `vila` på stillbild/slutframe i vila. Indexrensning vid ersättning (`lip-layer.js:88-90`) och omkontroll av `tag` i `at()` (`:153`) är buggfixar på Kevins sida. ±48 får finnas som tolerans för sen video men är inget synkbevis. Saknad giltig patch = kropp och ljud utan mun. Utan worker: inspelade steg och väntekedja calm/andas; `vilaMap` byter bara patchkartan.

### 2.11 Audit

- Kedjan förblir global. Porten får `verifyChain(fromSeq, toSeq)` över hela seq-serien; en rumsvy är inget kontinuitetsbevis. Per-rum-kedjor föreslås inte.
- Alla append går via en gemensam atomisk A-writer i Postgres (head-läsning och insert under A).
- Inga `player.*` för state, replay eller avvisade kommandon. Behållna typer: `engine.<op>`, `round.started`, `wallet.settlement` (med ledger-id), `player.<op>`, `shoe.opened`/`shoe.closed`, `presentation.plan` (status "scheduled; not a playback acknowledgement"), `table.tick`.
- `presentation.speech_choice` **behålls tills vidare i spelkedjan** genom samma A-writer, med room/round/parent. Flytt till separat tal-/säkerhetslogg är ett eget designval, inte en nödvändig lösning; `safetyAudit` kan inte ersätta den (1.3). Konsumenten `integration-index.mjs:26` påverkas inte.

### 2.12 Negativa prov före acceptans (K03/J07)

Två samtidiga identiska kommandon över deadline ger en effekt och 0 extra tick-/auditrader; samma tickId två gånger ger en effekt; reservationslivscykel över två bord (bet, pause, frånvaro, start, insurance-ja) mot en annan debetwriter; pause med ändrad medlemsmängd och samtidig join; samma commandId i två rum ger två skilda ledgerrader; audit-insert som fallerar rullar tillbaka wallet, ledger och kvitto; konkurrerande append till global kedja verifieras; krasch efter COMMIT före outboxkvittens återlevererar utan ny `ver`.

## 3. Öppna beslut

1. ~~Reservationsmodellen~~ **Beslutat:** demowallet med reservationer bakom `WalletPort`. Aggregatorn senare (Kevin 6321892682, Jakob 6321854403), se 2.5.
2. ~~Nekad `consume` vid rundstart~~ **Beslutat:** Kevin godkände retryförslaget (6321685315), inskrivet i 2.5.
3. ~~Pause, sent första kommando~~ **Beslutat:** pausen gäller alltid direkt i 24 h och tappas aldrig (2.6).

**Beslutat:**
- Självständig scheduler driver ticks (2.3).
- Bordsspråket ägs av Admin (2.8).
- Under migreringen gallras inga kommando- eller tickkvitton och inga idempotensnycklar. Ett senare retentionsbeslut får inte möjliggöra upprepad ekonomisk effekt.
