# K01: urvals- och beroendematris (svar på #312)

## Underlag

- **Kevin, fryst:** `kevin-merge-admin` @ `5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc`. Förälder är `c4818f51…`; deltat är 4 klientfiler och 2 tester. Alla K-sökvägar är relativa till `kevin/croupier-scoutgg/`.
- **Main:** `15988f32fd572c453d2189502acbe324c4566815` (`origin/main` vid hämtning 2026-10-21; HEAD = #310). M-sökvägar är relativa till reporoten.
- **Plan:** `codex/migrering-masterplan` @ `34109aa3`. Kraven för K01 kommer från `migrering/kevin-ks-migrering/AKTIVITETER.md`, avsnitt K01.
- **Miljö:** Node v22.22.0 (macOS, arm64).

**Vad som är kört och vad som bara är läst:**
- *Kört:* hela testsviten, mätningen av tidig retur (200 körningar) och patchtestet (50 körningar). Auditkedjan räknades om på en nyskapad databas. Medieinventeringen gjordes mot git-trädet med sha256.
- *Läst, inte kört:* all main-mappning (M fil:rad är verifierade med `sed -n`) och WebKit-förklaringen. Den senare bygger på kod och sondlogg; ingen ny GPU-körning har gjorts.

**Bifogade filer i `scratchpad/k01/`:**

| Fil | Innehåll |
|---|---|
| `test-run-5aa7ed1.log` | full testkörning |
| `test-400-deterministic.patch` | fix för den tidiga returen; ej applicerad |
| `media-runtime.tsv` | 1 267 rader: dealer, syfte, sökväg, bytes, sha256, referens, git-blob |
| `media-summary.md` | upplösningsregler och listor över orefererade filer |
| `tools/verify-audit-chain.mjs` | omräkning av hashkedjan |
| `instr/runs.log` | 200 instrumenterade körningar |

## 1. Matris: beteende → K fil:rad → M-konsument → beslut → kontrakt → test

**Beslutskoder:**
- **P** = porta
- **M** = ersätt med main (main är bas)
- **D** = släpp/importeras inte
- **U** = utreds i O01

"saknas" betyder att main inte har någon motsvarighet. Närmaste anslutningspunkt anges då.

### 1a. SQL-konsumenter

Det finns nio produktionsmoduler med SQL: `shared-table`, `game-audit`, `transactions`, `operations`, `bo-workspace`, `table-service`, `safety-audit`, `dealer-memory` och `studio-activity`. Dessutom skriver fyra QA-verktyg direkt i databasen.

Alla tabeller i `demo.sqlite` öppnas via `TABLE_DB` (`server/server.mjs:64`). `dealer-memory.sqlite` och `studio-activity.sqlite` ligger bredvid (`server.mjs:67,69`).

| # | Beteende | K fil:rad | M-konsument | Beslut | Kontrakt | Test |
|---|---|---|---|---|---|---|
| S1 | Rumsstate: en JSON-rad per rum, sparas per kommando | `server/shared-table.mjs:47` (DDL), `:91` load, `:92` save (anropar `audit.sync`) | Saknas för fleraspelarbord. Main har `blackjack_tables(player_id PK)` per spelare (`services/game/native-table.mjs:7`, `services/game/postgres-native-table.mjs:8-16`) och dispatch i `services/game/server.mjs:319`. | P (ny rumsstore bredvid `postgres-native-table`; J07 äger adaptern) | `state` = `{language, game, version, owners[7], bets[7]{main,pp,tp}, history, ready[], phase, deadline, actionDeadline, insurance{}, plan, round, talk[], waits[], leaving[], prevSteps, lastVariant, lastBets, roundId}`. Läses även av S8 och S9. | `test/shared-table.test.mjs` "turn ownership, split draws and payouts survive restart for both players" (:49); "server starts after 20 seconds and recovers abandoned turns without double dealing" (:81) |
| S2 | Saldo per (rum, gäst-token). Debitering och kreditering sker i samma transaktion som rummet. | `shared-table.mjs:48` (DDL), `:96-101` `amount`. Punkter: insats `:229`, försäkring `:239`, double/split `:245`, utbetalning `:282`, påfyllning `:383`, startkredit `:364`. Saldokontroll `:223`. | `services/game/server.mjs:265` `postgresWallet` (FOR UPDATE), `:209` `logTx`, `services/game/postgres-native-table.mjs:14-16` | M (mains wallet). Kevins saldon per rum importeras inte. | Port: `debit/credit(playerId, cents, kind, roundId, idemKey)` i rumskommandots transaktion. K har REAL (`ROUND(…,2)`, `:98`); main har `NUMERIC` (`ops/neon-game/product-schema.sql:7`). | `shared-table.test.mjs` "transactions follow real balance changes once, survive restart…" (:210); "double debits exactly one additional stake…" (:120) |
| S3 | Settlement, idempotent per (rum, round_id, player_id) | `shared-table.mjs:49-50` (DDL), `:278-282` (kvitto → INSERT → auditevent → utbetalning) | Saknas. Närmast är ledgern i `postgres-native-table.mjs:14-16`. | P (idempotensnyckeln mot mains ledger) | `receipt = {roundId, settledAt, returned, staked, net, hands[]}`, PK (room, round_id, player_id) | "reported scenario: losing hand plus $1,000 blackjack returns exactly $2,500…" (:91); "winning side bets are announced, paid once through split…" (:107) |
| S4 | Request-idempotens (rum, token, requestId) med jämförelse av input | `shared-table.mjs:52` (DDL), `:339-342` kontroll, `:435` INSERT | `services/game/shoe-game.mjs:40-43` (`g.last` per bord); `croupier_game.partner_idem` (`product-schema.sql:39`) | P, med nyckel (rum, main-`player_id`, requestId) i stället för cookie-token | Samma `requestId` med annan input ger fel; samma input ger samma svar | `test/backoffice.test.mjs` "…retries and rejected actions do not add audit rows" (:56) |
| S5 | 24-timmarspaus (demo break), gäller alla bord | `shared-table.mjs:51` (DDL), `:94`, `:348-353`, `:266-269` | Saknas | U (spelansvar hör till plattforms- eller spelarnivå i main) | `until_ms` per token | "24-hour break blocks betting and refills across tables…" (:151); "break during active hand…" (:163) |
| S6 | Audit: sko plus hashkedjade händelser, append-only, låst commitment | `server/game-audit.mjs:5-18` (DDL + 4 triggrar), `:19-24` `event`, `:25-44` `sync`, `:45-70` `read`. Anropare: `shared-table.mjs:105-108,214,225,281,343,381,483`. Läsning: `:479`. | Saknas i speldomänen. `croupier_studio.audit_events` (`ops/neon-studio/001-studio-metadata.sql:39`) gäller studiodokument, inte spel. | P (K02; nya append-only-tabeller i `croupier_game`) | Se avsnitt 2 (serialisering) | `backoffice.test.mjs` "real shared engine closes shoe, replays RNG and accounts for burn…" (:35), (:56), "legacy shoe is marked incomplete…" (:73); `shared-table.test.mjs` "OpenClaw context is read-only and speech decisions link to the existing audit chain" (:226) |
| S7 | Transaktionsledger i cent, append-only, plus husrapport | `server/transactions.mjs:3-9` (DDL + triggrar), `:11-13` `record`, `:15-18` öppningssnapshot vid start, `:28-45` rapport (`json_extract`, `rowid`, `room‖':'‖round_id`) | `services/game/server.mjs:209` `logTx` → `croupier_game.transactions` (`product-schema.sql:11-13`, `amount NUMERIC`, `at TEXT`) | M för ledgern, P för rapportfrågorna som studio-läsmodell | `kind ∈ {opening_snapshot, opening_credit, stake, insurance, double, split, payout, demo_refill}`; `amount_cents`, `before_cents`, `after_cents` | `test/transactions.test.mjs` "house totals include all pages…" (:6), "opening snapshots and credits are excluded…" (:16) |
| S8 | Driftvy per bord | `server/operations.mjs:2-32` (SQL `:4`, `:7`, `:14`). Exponeras via `shared-table.mjs:484` `backoffice({view:'operations'})` → `server.mjs:427` (`internal/game-audit`, loopback + `AUDIT_TOKEN`, `server/audit-access.mjs:3-5`). | Saknas. Närmast är `apps/studio/lib/studio-admin-data.mjs:120` (översikt). | P som skrivskyddad läsmodell i studio-admin | `{view, demo, serverNow, tables[{id, phase, roundId, occupiedSeats, players[], onlinePlayers, deadline, lastActionAt, openStakesCents, preparedBetsCents, shoe{id, dealt, remaining}}], summary}`. Läser interna fält i S1-staten. | `backoffice.test.mjs` "operations reports real seats and stakes without exposing cards or mutating gameplay" (:102) |
| S9 | Johns workspace: spelare, settlements, rörelser, skor | `server/bo-workspace.mjs:5-18` (SQL `:7-14`, `rowid` på `:8`). Exponeras via `shared-table.mjs:484` (`view:'workspace'`, plus `manifest`). | `apps/studio/lib/studio-admin-data.mjs:127` (players), `:132` (transactions) | M där main täcker, P för sko- och settlementdelen | Utdata i cent, inga kort | "John workspace reports only recorded settlements, hides active cards and is a pure read" (:124) |
| S10 | Plånbok och påfyllning för enspelarbord | `server/table-service.mjs:10-16` (DDL), `:18-46` `run`, `:26-36` idempotent påfyllning. Läses även av `shared-table.mjs:361-363` (övertagande av gammalt saldo). | `services/game/native-table.mjs:7`, `services/game/server.mjs:273` `apiDeposit` | D. Över HTTP kan `run()` inte nås, eftersom `table-service.mjs:58` kräver `session` när `shared` finns, och `server.mjs:140` skickar alltid `shared`. | – | `test/game-integration.test.mjs` "SQLite demo wallets persist…" (:49), "demo refills are fixed, durable…" (:73) |
| S11 | Säkerhetsaudit för chatt/LLM: bara hashar, 30 dagars gallring | `server/safety-audit.mjs:3-12`. Anrop: `server.mjs:162,187,577,711`. | Saknas. Närmast är `services/game/openclaw-chat.mjs:11` (gränser). | U (obs: `DELETE` vid gallring, `:5`) | `detail` = whitelist av 8 nycklar, högst 128 tecken var (`:9`) | `test/dealer-safety.test.mjs` "audit persists versions and hashes without raw sensitive fields, and purges old records" (:56) |
| S12 | Dealerns minne per (besökare, dealer) | `server/dealer-memory.mjs:10-48`. Anrop: `server.mjs:226-234`. | `services/game/player-chat-memory.mjs:30`, `product-schema.sql:26-28` | M | – | `test/dealer-memory.test.mjs` "the dealer remembers a visitor across visits, never their personal data" (:8); main: `test/player-chat-memory.mjs` |
| S13 | Studioaktivitet per inloggning | `server/studio-activity.mjs:11-55`, med skrivskyddad läsning mellan databaser av `shared_players` och `shared_settlements` (`:33-46`) | `packages/operators/server/operator-store.mjs:408` (`operator_audit_events`) | M; kopplingen mellan databaserna släpps | – | `test/studio-activity.test.mjs` "a sign-in is followed by its sid…" (:11) |
| S14 | QA-verktyg som skriver `shared_rooms` direkt | `tools/check-leave-table.mjs:8`, `check-side-chip-motion.mjs:4`, `check-win-feedback.mjs:4`, `profile-phone.mjs:27` | – | D | – | – |

**Ytterligare kopplingar för SQL-mappningen:**
- `rowid` används i `bo-workspace.mjs:8`, `transactions.mjs:32` och `game-audit.mjs:54`. Postgres har ingen `rowid`, så tabellen behöver en explicit identity-kolumn.
- Index och frågor bygger på `json_extract(payload,'$.shoeId')` (`game-audit.mjs:13,28`) och `json_extract(receipt,…)` (`transactions.mjs:28`).
- `tick()` kör `BEGIN IMMEDIATE` per rum var 250:e ms (`shared-table.mjs:443-444`, `server.mjs:141`). Det serialiserar allt i en process. Med flera instanser behövs ett lås per rum (main har `pg_advisory_xact_lock` i `packages/storage/server/postgres-store.mjs:96`).

### 1b. Auth, wallet, timers, manifest

| # | Beteende | K fil:rad | M-konsument | Beslut | Kontrakt | Test |
|---|---|---|---|---|---|---|
| A1 | Spelaridentitet = gästcookie `astrid_guest`/`astrid_demo`. Den lagras som sha256 och fungerar som spelarnyckel. | `server/request-safety.mjs:13` `guestToken`; `server/table-service.mjs:52-56` sätter cookien; `shared-table.mjs:35` `keyFor`; WS `server.mjs:669` | `services/game/storage/async-player-auth.mjs:24` (`player_session` HttpOnly `:82`), `services/game/server.mjs:631`, `:848` `/api/auth/session` | M | Spelmodulen tar emot `{playerId, displayName}` från mains auth och läser aldrig cookie själv | `test/security-http.test.mjs` "actual HTTP and WebSocket routes enforce the public/trusted boundary" (:11); main: `test/player-auth.mjs`, `test/game-entry-auth.mjs` |
| A2 | Backoffice-inloggning (`bo_jwt` mot en lokal BO-tjänst) | `server/bo-session.mjs:7-42`; `server.mjs:457-531,647` | `services/game/bo-game-auth.mjs:34`, `packages/studio-access/studio-native-auth.mjs:49` | M | – | `test/bo-session.test.mjs` (:20, :29, :36, :45, :51) |
| A3 | `API_TOKEN` bearer för `/api/chat|speak|event`; auditbrygga via loopback | `server.mjs:60,545`; `server/audit-access.mjs:3-5`; `server.mjs:412-428` | Partner-HMAC (`services/game/storage/async-partner-api.mjs`); studio-admin | D (rutterna). Auditläsningen ersätts av studio-admin. | – | `backoffice.test.mjs` "audit bridge fails closed…" (:81) |
| A4 | Lösenordsgrind för demo, som loggar in ett delat BO-konto | `server/demo-gate.mjs:7-12`; `server.mjs:620-632,645-648` | `services/game/server.mjs:638` `DEMO_GUEST_ACCESS`; `apps/web/app/demo/page.tsx:10` | D/M | – | `test/demo-gate.test.mjs` (:5, :14) |
| W1 | Startkredit per rum = bordets `balance` i studio-presetet, plus påfyllning | `shared-table.mjs:363-364,383`; `server/studio-tables.mjs:8-14` | `services/game/server.mjs:259-262` (startsaldo 1000), `:273` `apiDeposit` | U (main har ett globalt saldo) | – | `test/table-limits.test.mjs` "a refill adds the table preset balance…" (:45) |
| T1 | Nedräkning för insatser, 20 s, startar vid första marker | `shared-table.mjs:45` (`betMs=20000`), `:413-414`, `:270-271` | Saknas. Main har request/response (`server.mjs:319`); närmast är `nativeOptions.publish` (`:300-318`). | P (serverägd schemaläggare plus lås per rum) | `deadline` (ms) i rumsstaten | `shared-table.test.mjs` (:81) |
| T2 | Beslutstid 15 s: auto-stand, försäkring nekas automatiskt | `shared-table.mjs:45` (`actionMs=15000`), `:215`, `:284-287` | Saknas | P | `actionDeadline` | "15 second server decision deadline survives restart and stands only at expiry" (:132); "leaving declines insurance automatically…" (:186) |
| T3 | Övergiven plats efter 120 s; "online" inom 15 s | `shared-table.mjs:262-265`; `operations.mjs:9` | Saknas | P | `players.seen` | "disconnected owners cannot strand a settled table" (:193); "leave during dealing survives restart…" (:177) |
| T4 | Server-tick 250 ms över alla rum | `server.mjs:141`; `shared-table.mjs:443-444` | Saknas | P (O01: en ledare eller lås per rum) | – | (indirekt i T1–T3) |
| T5 | Klienten pollar state var 700 ms; uppspelningssynk var 50 ms. Rums-WS används för chatt och läppbitar. | `public/shared-table.js:123,367`; `public/app.js:414` | Saknas för spelarpush. Main har WS bara för tal/läppsynk (`packages/server-transport/node-server.mjs:33`). | U | `POST /api/table {session, op, version, requestId, …}` | – |
| T6 | Klientens rundklocka (visning, pausas av klipp och dold flik) | `public/round-clock.js:3` | Saknas | P som kandidat | – | `test/round-clock.test.mjs` (:4, :11) |
| E1 | Gräns mellan regler och server: `command`, `newGame`, `gameView` | `vendor/croupier/shoe-game.mjs:4` (SHOE_RULES), `:12` (`randomUUID` + `openProof`), `:44` `command`. Anrop: `shared-table.mjs:103-108`. | `services/game/shoe-game.mjs:4-85`; `packages/shared/blackjack-shoe-rules.mjs:1` (identiska SHOE_RULES) | P (K02, explicit slump) | `command(g, {op, version, requestId, …}, balance) → {delta, view}` | `test/croupier-shoe.test.mjs` (skript, inga testnamn); `test/game-integration.test.mjs` (:19, :28, :42) |
| E2 | Utdelningsplan och tal | `public/game-events.js:28` `planDraws`, `:59` `outcomeSpeech`; import på `shared-table.mjs:9` | `services/game/public/local-presentation.mjs`, `packages/presentation/contracts/speech-lines.mjs:2` | U (jämförs i O01) | – | `game-integration.test.mjs` (:99, :109) |
| C1 | Callbackar `talk`, `readyFor`, `onPlan`, `winners`, `onWelcome`, `limitsFor`, `languageFor` | Deklarerade `shared-table.mjs:37-45`, kopplade `server.mjs:127-138` | Saknas (presentationsport) | P som explicit presentationsport | Se kommentaren på `shared-table.mjs:37-44`. `onPlan(room, plan, ready, {nya, omplanera, steg})`. | `test/rorlig-lipsync.test.mjs` (:76, :96) |
| MF1 | Manifestet filtreras på servern och serveras via `/api/clips` | `server.mjs:52` (`classifyManifest`), `server/media-registry.mjs:3-15`, `server.mjs:436`; klient `public/app.js:527,634`; tabellen `shared-table.mjs:50-51,170-172` | `tools/runtime-media-catalog.mjs:7`; `packages/studio-registry/server/runtime-catalog.mjs:15,65` (Neon `runtime_media_catalogs`, `ops/neon-studio/012-runtime-media-catalog.sql`) | M (katalog). Urvalet i avsnitt 3 blir katalogposter. | Post: `{id, url(blob), sha256, bytes, dealer, purpose, lang, frames?}` | `backoffice.test.mjs` "media registry preserves legacy takes but removes them from all runtime variant picks" (:89) |
| MF2 | Filgenomgång av hela `public/` som medieregister; auditrutten kan serva vilken mediefil som helst | `server/media-registry.mjs:16-31`; `server.mjs:54,420-425` | `services/game/blob-media.mjs:4-6`; `packages/studio-registry/server/private-media-contract.mjs:9` | D | – | – |
| MF3 | Taglängder hos färdiga dealers läses från `v2/meta.json` och mp4-huvuden vid serverstart; varianter räknas från filernas existens | `server.mjs:81-82` (`idleTakes`, `READY_TAKES`), `:91-106` (`VARIED`, `texter.json`); `public/dealers.js` (import `server.mjs:40`) | Saknas (närmast är runtime-katalogen) | P: värdena flyttas in i katalogen, inte filsystemsläsning vid start | `meta.json`: `{frames:{<take>:{'-'|'-i'|'-u'|'-iu'|'-v'|'-iv': n}}, restEnd[], restStart[]}` | `table-limits.test.mjs` (:64, :82, :100, :115); `test/ready-dealer.test.mjs` |

### 1c. Läppsynk, idle, röst, studio, audit, demo, dealerchatt

| # | Beteende | K fil:rad | M-konsument | Beslut | Kontrakt | Test |
|---|---|---|---|---|---|---|
| L1 | Workerprotokoll för läppsynk på rörliga klipp | `server/rorlig-lipsync.mjs:12-15` (protokoll), `:380-401` `adoptWorker` (token/podToken `:384`, `pong` med `gpu`/`rutor_per_s`/`forsta_bit_ms`/`takes`, `MIN_FPS` `:391`, `forhamta` `:401`), `:287-296` (`start`/`avbryt`/`end`, binär PCM i bitar om 32 KiB), `:277-279` (`lapp`/`done`/`error`). Uppgradering: `server.mjs:663-664` (`/lipsync-worker`, `/lipsync-rorlig`). Vidarebefordran: `server.mjs:123`. Klient: `public/lip-layer.js:71-92`, `:78` och `:101` (`/api/lip/:talk/:del`). | `services/moving-gpu-worker/contracts.py:77` `validate_job`, `:205` `validate_start`; `services/moving-gpu-worker/serverless.py:39`; `services/astrid-gpu-worker/gateway/relay.mjs:9` (subprotokoll `astrid-v2`) | U. Protokollen skiljer sig; Kevins worker är `EmaCodeHero/croupier-lipsync-worker`. | `start {t, id, karta:[[take, firstFrame, count]…], ljud_url \| ljud_id + PCM, rate:24000, fran_ruta}`. Svaret `lapp {id, del, fran, till, rutor:[{tagning, ruta, rect} \| null]}` följs av H.264 Annex B 256×512 per 0,5 s. `null` i `rutor` betyder tyst ruta (`lip-layer.js:90`). | `rorlig-lipsync.test.mjs` (31 tester, t.ex. :132, :164, :435, :464, :547); `test/pod-lipsync-pool.test.mjs` (:48, :65, :79); main: `services/moving-gpu-worker/tests/test_contracts.py`, `gateway/test/relay.test.mjs` |
| L2 | Astrids dedikerade pod och serverless (PCM → mp4) | `server/pod-lipsync.mjs:1-30`, `server/serverless.mjs:28`; `server.mjs:144` | `services/astrid-gpu-worker/handler.py:117` | M | – | `test/pod-lipsync.test.mjs`, `pod-lipsync-pool.test.mjs` |
| I1 | Idlekedja: samma kedja för alla tittare och för workern, seedad med `talk.id`; väntekedja under spelarbeslut; bara lugna tagningar vid vila | `public/idle-chain.js:6` (LEAD), `:12` `chainClipAt`, `:37` `pickWeighted`, `:45` `layChain`, `:69` `waitClips`, `:76` `waitBoundary`, `:86` `waitClipAt`, `:104` `restingPool`, `:113` `upcomingChainAt`. Server: `shared-table.mjs:13,60-73` (`withIdle`), `rorlig-lipsync.mjs:20,89,112`. Klient: `public/shared-table.js:1,392`. | `services/game/public/idle-video-loop.mjs:4`, `astrid-idle-scheduler.mjs:11`, `packages/presentation/runtime/idle-policy.mjs:24,90`, `apps/studio/client/admin/lib/studio-policy.mjs:23` (#310, justerbara idle-beteenden) | P som kandidat (Kevin prioriterar), avstämd mot #310 | `talk.idle[{take, startAt, endAt, frames}]`, `waits[{from, until}]` | `test/idle-chain.test.mjs` (9 tester, :15–:105); `rorlig-lipsync.test.mjs` (:334–:602) |
| V1 | Röstpool: tre `Audio`-element låses upp i gesten (iOS) och förvärms | `public/voice-pool.js:10-…` (`SILENT_WAV`, `createVoicePool`); `public/app.js:2,284` | `services/game/public/speech-playback.mjs:3`, `table-audio.mjs:3` | U (porta om mains uppspelning saknar upplåsning i gesten) | – | `test/voice-pool.test.mjs` (:11, :20, :32, :42); main: `test/speech-playback.mjs` |
| ST1 | Studiobord i en JSON-fil per slug, med val, limits och logotyp | `server/studio-tables.mjs:7-14` (presets), `:19-26` (`STUDIO_CHOICES`), `:16-17` (logo ≤ 400 000 tecken), `:33-73`; `server.mjs:68,520-544`. Gränserna verkställs i `shared-table.mjs:18-25,409`. | `apps/studio/lib/presentation-room-api.mjs:173`, `packages/presentation/contracts/operator-rooms-contract.mjs:38`, `packages/presentation/server/package-rooms.mjs:10,41,44`, `apps/studio/lib/studio-admin-data.mjs:63`, `partner-branding-api.mjs` | M för lagringen (J08). P för serverns verkställande av gränser, som konfigfält. | Fält enligt koden: `dealer, room, felt, lang, limit, logoPos, name, layout, custom, logo, logoName, slug, created, owner?`. **Fältet `game` finns inte i koden** vid 5aa7ed1 (se avsnitt 6). | `test/studio-tables.test.mjs` (:11–:69); `table-limits.test.mjs` (:21, :35, :54) |
| AU1 | Skobevis: commit och reveal, omspelning av shuffle, verifiering | `vendor/croupier/shoe-proof.mjs:2` `digest`, `:5` `material`, `:6-10` `openProof`, `:12-23` `replayShuffle`, `:24-42` `verifyShoe`; `game-audit.mjs:25-44`; redigering av live-hålkortet `:62-63` | `services/game/shoe-game.mjs` (inget bevis); saknas | P (K02) | Avsnitt 2 | `backoffice.test.mjs` (:35, :56, :73) |
| DM1 | Dealerchatt: alternativa dealers med eget minne och egen röst; Astrid får granskade repliker | `server.mjs:162` (OpenClaw eller Gemini, audit-hook), `:226-234`, `:686-705`; `server/dealer-policy.mjs:2-29`; `server/dealer-chat.mjs:48`; `server/openclaw.mjs:15`; `server/llm.mjs:5` | `services/game/openclaw-chat.mjs:125,215`; `services/game/server.mjs:967-983,1069` | M för chatt och minne. U för `localResponse`-filtret (spelansvar och integritet), som saknas i main. | – | `test/dealer-chat.test.mjs`; `dealer-safety.test.mjs` (:14, :26, :32, :37, :46) |

## 1d. Kevins SQLite-tabeller mot Neons faktiska struktur

**Källa:** Jakobs export ur `pg_catalog` i `scratchpad/neon/` (`columns.txt`, `constraints.txt`, `indexes.txt`, `triggers.txt`). Exporten innehåller ingen data och ingen egen anslutning har gjorts. Den har 7 tabeller i `croupier_auth`, 26 i `croupier_game` och 28 i `croupier_studio`.

**Två generella fynd i exporten:**
- **Inga append-only-triggrar finns i Neon.** `triggers.txt` har bara två triggrar, båda på `croupier_auth.users` (`bo_auth_epoch_update`/`_delete`). Kevins sex triggrar har ingen motsvarighet och måste skapas.
- **`croupier_game.transactions` saknar `room`, `round_id` och `before`/`after`.** Kolumnerna är `id bigint`, `player_id text` (FK till `players`), `type text`, `amount numeric`, `currency text`, `meta text` och `at text`. Index finns bara på `(id)` och `(player_id, id)`.

| Kevin-tabell (K DDL) | Neon-mål | Kolumnmappning / lucka | Beslut |
|---|---|---|---|
| `shared_rooms(id, state)` | **Ny tabell krävs.** Närmast är `croupier_game.roulette_tables(player_id, operator_id, room_id, state text)` och `blackjack_tables(player_id, state text)`. Båda är per spelare och har PK på spelare. | `id` → `room_id` (plus `operator_id`, i linje med roulette). `state` → `text` eller `jsonb`; staten ingår inte i någon hash. | P (S1) |
| `shared_players(room, token, id, name, balance, seen, last_return)` | Identiteten ligger i `croupier_game.players(id, name, display_name, balance numeric, currency, status)` och `player_sessions(digest, player_id, expires)`. | `token` utgår (mains session). `id` → `players.id`. `name` → `display_name`. `balance` per rum har **ingen kolumn**, eftersom `players.balance` är globalt. Platsinnehav (`seen`, `last_return`) kräver **ny tabell**, t.ex. `room_seats(room_id, player_id, seen bigint, last_return numeric)`. | M + ny tabell (S2/W1) |
| `shared_settlements(room, round_id, player_id, receipt)`, PK (room, round_id, player_id) | **Ny tabell krävs.** `transactions.meta text` kan bära kvittot men ger ingen unik nyckel för idempotens. | `receipt` → `jsonb` (ej hashad som kolumn) | P (S3) |
| `shared_requests(room, token, id, input)` | **Ny tabell krävs.** Närmast är `partner_idem(key_id, request_id, response)` och `native_presentations(player_id, request_id, version, payload)`, som har en rad per spelare. | `(room_id, player_id, request_id)` → `input text` | P (S4) |
| `demo_breaks(token, until_ms)` | Ingen. `players.status` har CHECK `active/blocked/closed` och ingen tidsgräns; ändringar loggas i `player_admin_events`. | Tidsbegränsad paus kräver kolumn eller ny tabell | U (S5) |
| `audit_shoes(...)` | **Ny tabell krävs** | Kolumnerna 1:1, `opened_at`/`closed_at` som `bigint`, `proof text`, plus 2 triggrar | P (S6) |
| `audit_events(seq, room, round_id, at, parent, type, payload, previous_hash, hash)` | **Ny tabell krävs.** Passar inte i `croupier_studio.audit_events`, se nedan. | `seq bigint identity`, `at`/`parent bigint`, `payload text`, plus 2 triggrar | P (S6) |
| `shared_transactions(id, room, player_id, name, round_id, at, kind, amount_cents, before_cents, after_cents)` | `croupier_game.transactions(id, player_id, type, amount numeric, currency, meta text, at text)` | `kind` → `type`; `amount_cents/100` → `amount`; `at` (ms) → `text`; `room`, `round_id`, `before`, `after` → `meta` eller nya kolumner; `name` utgår (finns i `players`). Rapporterna (S7) filtrerar på room och at, och det kräver kolumner, inte `meta text`. Triggrar saknas. | M + kolumntillägg (beslut J07) |
| `demo_tables(session, balance, state)`, `demo_refills(...)` | Ersätts av `blackjack_tables` och `transactions` | – | D (S10) |
| `safety_audit(id, at, policy, event, detail)` | **Ny tabell krävs**; ingen motsvarighet | `detail` → `jsonb` | U (S11) |
| `dealer_memory(visitor, dealer, name, visits, first_seen, last_seen, notes, lines)` | `croupier_game.player_chat_memory_profiles(player_ref, dealer_id, history text, revision text, touched bigint)` | `visitor` → `player_ref`; `dealer` → `dealer_id`; `lines` och `notes` → `history`; `last_seen` → `touched`. `name`, `visits` och `first_seen` saknar kolumn. | M (S12) |
| `studio_activity(at, user, sid, ip, ua, kind, tbl, guest, detail)` | `croupier_studio.operator_audit_events(…, actor_id, action, resource_type, resource_id, occurred_at_ms, request_id, changes text)` | `user` → `actor_id`; `kind` → `action`; `tbl` → `resource_id`; `at` → `occurred_at_ms`; `detail` → `changes`. `ip`, `ua`, `sid` och `guest` saknar kolumn (avsiktligt eller inte: O01). | M (S13) |
| `studio-tables.json` (fil) | `croupier_studio.operators(operator_id, slug, name, status)` och `operator_packages(…, games, tables, branding text, package_revision, published_at_ms)` | Bordsval → `operator_packages.tables`; logotyp → `branding`; utkast via `operator_branding_drafts` | M (ST1, J08) |

### Hör Kevins hashkedja hemma i `croupier_studio.audit_events`?

**Nej.** Kevins hashkedja behöver en egen tabell i `croupier_game`.

`croupier_studio.audit_events` har kolumnerna:

```
(environment_id text, workspace_id text, event_id uuid, action text, subject text, revision text, actor text, at timestamptz DEFAULT now())
```

Primärnyckeln är `(environment_id, workspace_id, event_id)`.

Den passar inte, av fem skäl:
1. **Kolumner saknas.** Det finns ingen kolumn för `payload`, `previous_hash`, `hash`, `parent`, `round_id` eller `room`, och ingen sekvens (PK är en uuid, utan ordning). Kedjan kräver en total ordning (`seq`) och de exakta bytes som hashas.
2. **`action` är spärrad med CHECK** till `initialize_document`, `save_document`, `import_document`, `register_media` och `classify_media`. Kevins typer (`engine.*`, `player.*`, `round.started`, `wallet.settlement`, `shoe.opened/closed`, `presentation.*`) skulle avvisas.
3. **`subject` är begränsad till 1–100 tecken** och `actor` till 1–128. Där får payloaden inte plats.
4. **`at` är `timestamptz`.** Kevins hash omfattar `at` som ett JS-heltal i ms. En timestamptz kan återskapa värdet, men det kräver en konvertering vid varje verifiering, och ett annat avrundningsbeteende ger en ogiltig hash.
5. **Inga append-only-triggrar finns** på tabellen.

**Förslag:** `croupier_game.audit_events` och `croupier_game.audit_shoes` med Kevins kolumner. `seq` blir `bigint GENERATED ALWAYS AS IDENTITY`; `at` och `parent` blir `bigint`; `payload`, `previous_hash`, `hash` och `proof` blir `text`. Lägg till de fyra triggrarna och ett globalt advisory-lås vid skrivning (avsnitt 2). Domänen är spelet och ska ligga intill `transactions`, inte studions dokumentaudit.

## 2. Auditens hashserialisering och regler för Postgres-mappningen

**Formeln, verifierad i kod:**
- `game-audit.mjs:21`: `data = JSON.stringify(payload)` lagras ordagrant i `payload TEXT` (`:23`).
- `game-audit.mjs:22`: `hash = digest({room, roundId: roundId ?? null, at, parent, type, payload: data, previous})`.
- `shoe-proof.mjs:2`: `digest = sha256(JSON.stringify(value))` som hex. Indata är JavaScript-strängen, kodad som UTF-8; `♠` och andra icke-ASCII-tecken lagras oescapade.

**Detaljer som ändrar hashen:**
- **Nyckelordningen är fast:** `room, roundId, at, parent, type, payload, previous`.
- **`payload` är dubbelkodad:** den hashas som en *sträng*, inte som ett objekt.
- **Typerna:**
  - `at` är ett JS-heltal (ms).
  - `parent` är ett tal (`seq`) eller `null`.
  - `roundId` är en sträng eller `null`.
- **`previous`:** hashen på tabellens globalt senaste rad (`game-audit.mjs:20`, `ORDER BY seq DESC LIMIT 1`, utan rumsfilter), annars `'genesis'`. Det finns alltså **en kedja över alla rum**.
- **Ingen verifiering av kedjan i koden:** ingen kod räknar om kedjan. Endast `chainHead` exponeras (`game-audit.mjs:69`).

**Empiriskt prov** (`tools/verify-audit-chain.mjs`; två rum, 24 händelser):
- Alla 24 hashar och `previous_hash`-länkar räknades om korrekt (`ok: 24, bad: 0`), och rummen `a` och `b` delar kedja.
- Med payloadens nycklar sorterade (som jsonb gör) blir hashen ogiltig.
- Med `at` som sträng blir hashen ogiltig.

**Regler för Postgres-mappningen:**
1. **`payload`:** lagra som `TEXT` med exakt samma bytes, inte `jsonb`. `jsonb` normaliserar nyckelordning och blanksteg. För frågor räcker en genererad kolumn `payload_json jsonb GENERATED ALWAYS AS (payload::jsonb) STORED`, med ett uttrycksindex på `(room, (payload_json->>'shoeId'), seq)` som ersättning för `game-audit.mjs:13`.
2. **Talkolumner:** `at`, `parent` och `seq` blir `BIGINT`. node-postgres returnerar `BIGINT` som sträng, så värdet måste gå genom `Number()` innan det hashas (alla värden ligger under 2^53).
3. **Lås:** kedjehuvudet läses och raden skrivs i *samma* transaktion som spelkommandot, under ett **globalt** lås, till exempel `pg_advisory_xact_lock(<konstant>)` (helper finns i `packages/storage/server/postgres-store.mjs:96`). Annars kan två instanser skapa förgreningar.
4. **Triggrar:** behåll alla fyra (`game-audit.mjs:15-18`): ingen UPDATE eller DELETE på `audit_events`, oföränderlig `commitment`, oföränderlig stängd sko.
5. **`audit_shoes.proof`:** måste också vara `TEXT`.
   - `verifyShoe` jämför `JSON.stringify(proof.rules)` med en literal i fast nyckelordning (`shoe-proof.mjs:29`).
   - Den jämför också `JSON.stringify(proof.commandDraws)` med `drawn` (`:38`). `commandDraws` parsas ur payload-*texten* (`game-audit.mjs:28`).
   - Commitment är `sha256(JSON.stringify({version, shoeId, rules{decks, cutAfter, total, burn}, nonce, samples}))` (`shoe-proof.mjs:5,8`).
6. **Övriga JSON-kolumner:** `shared_settlements.receipt`, `dealer_memory.notes/lines` och `safety_audit.detail` ingår inte i någon hash och kan bli `jsonb`. Kvittot hashas dock separat som en del av payloaden i `wallet.settlement` (`shared-table.mjs:281`).
   - **`shared_rooms.state` ska vara `TEXT`, inte `jsonb` (rättat efter granskning 21/10).** Rumsstate innehåller `game.shoe.proof`, och proof-reglernas och `commandDraws` nyckelordning används vid commitment och verifiering efter återläsning (`shoe-proof.mjs:5,8,29,38`). `jsonb` får inte användas för state förrän en explicit normalisering har provats med bibehållen verifiering.
7. **Migrering:** rader kopieras ordagrant, med `seq`, `previous_hash` och `hash`. Kör sedan omräkningsskriptet mot Postgres-exporten som acceptanstest.

## 3. Medieurval med exakta identiteter

Fullständig lista: `media-runtime.tsv`. Metod, regler och listor över orefererade filer: `media-summary.md`.

**Totalt antal och storlek:**
- **Hela trädet:** 1 790 ljud- och videofiler, 1 032 081 678 byte, alla under K (1 787 mp4, 2 wav, 1 mp3). Kontrollerat med `git ls-tree -l`; binärerna är riktiga blobbar, inte LFS.
- **Nås vid körning:** 1 267 filer, varav 1 215 ljud/video, totalt 807 903 718 byte.
  - Publika demot (astrid, astrid2, dragge, paow och delade filer): 932 filer, 628 967 818 byte.
  - marten (dold publikt, `public/dealers.js:96` `PUBLIC_HIDDEN`; bara via `?table=`): 289 filer, 157 992 256 byte.
  - Table Studio: 46 filer, 20 943 644 byte.
- **Nås inte:** 575 ljud- och videofiler, 246 871 240 byte (1 215 + 575 = 1 790).
  - Hela `public/media_omkodad_crf20_2026-09-25/` (66 filer).
  - Astrids 40 träningsrepliker per språk (156 filer).
  - 346 repliker hos andra dealers som ingen regel når.
  - `idle-v2/` för dragge och paow (6 filer).
  - `verktyg/prov.wav`.

**Per dealer och syfte (antal filer):**

| Dealer | v2-tagningar | Idle | Repliker | Övrigt |
|---|---:|---:|---:|---|
| astrid | 10 deal-klipp | 5 | 44 | still, ansikte, 4 studio |
| astrid2 | 56 | 9 (idle-v2) | 170 | – |
| dragge | 56 | 21 (v2/H3) | 228 | – |
| paow | 56 | 23 (v2/H3) | 228 | – |
| marten | 56 | 3 (idle-v2) | 228 | – |

Delade filer: 9 rum (4 rum, 4 tumnaglar, 1 brett), `sfx/ambience.mp3` och `media/silent.wav`.

**Saknas:** inget. Alla 1 267 expanderade sökvägar och alla 220 URL:er i manifestet finns.

Två mallar ger aldrig en filbegäran:
- `hands.mp4`, eftersom ingen `meta.json` har `hands`.
- Platshållaren `/media/repliker/twentyone_1.mp4` (`shared-table.mjs:57`), som alltid skrivs om.

**Förbehåll:** "nås vid körning" betyder nåbar via en upplösningsregel i koden, inte observerad i nätverkstrafik. Några vägar är villkorade:
- `-v`/`-iv`-tagningarna och repliker i flera varianter kräver en färdig dealer på rummet.
- `goodluck_2/3` på en/sv kräver workern på staging.

Servern servar hela `public/` statiskt, och MF2 kan serva vilken mediefil som helst. Det är inte samma sak som runtime-urvalet.

## 4. `test/rorlig-lipsync.test.mjs:400`: tidig retur

**Två ställen:**
- `:400`, i testet "between rounds an answer runs over his idle takes…" (:382).
- `:502`, i "while the player decides, a wait chain runs…" (:492).

Båda använder en slumpad sko (`talkTable`, `:62-74`; skon skapas med krypto-slump i `vendor/croupier/shoe-game.mjs:11-12`).

**Mätning:** en instrumenterad kopia i `instr/` (loggar fasen före returen) kördes 200 gånger, se `instr/runs.log`.

| Rad | Når `decisions` | Hoppar över | Varav `insurance` | Varav `settled` |
|---|---:|---:|---:|---:|
| :400 | 178/200 | 22/200 (11 %) | 15 | 7 |
| :502 | 173/200 | 27/200 (13,5 %) | 14 | 13 |

Testet passerar ändå (det rapporteras som `ok`), så hoppen syns inte i 285/285.

**Kommentaren i koden stämmer inte.** Där står "a natural this time". Mer än hälften av hoppen beror i stället på dealerns ess i öppen hand (`insurance`-fasen). Det är inte en natural.

**Fix** (`test-400-deterministic.patch`, inte applicerad):
- `talkTable` får `fixShoe(room)`, med samma fasta sko som testet på `:216-228` redan använder: 5 och 7 mot 6, sedan små kort.
- Båda testerna anropar `fixShoe` efter `join`.
- Båda returerna ersätts med `assert.equal(phase, 'decisions')`.

**Verifierat på en kopia:**
- `git apply --check` går igenom mot 5aa7ed1.
- Den patchade filen gav 31/31 i 50 av 50 körningar.
- Assertionerna efter returen körs nu varje gång.

## 5. WebKit-sonden: 481 rutor, 463 träffar, 13 missar

Källa: `scratchpad/mob/wkcopy/run.log`. Sonden är `mob/sound-probe-wk.mjs`.

**Räknaren:** `public/dealer-layer.js:202`, som är oförändrad mellan c4818f5 och 5aa7ed1. För varje `draw()`, alltså **varje requestAnimationFrame-tick** (`:233`, `:235`) och inte varje videoruta, gäller medan `lips.active()`:
- `frames++`;
- om det finns en patch: `hits++`;
- annars, om `lips.silentNow()`: `silent++`;
- annars, om `misses.length < 80`: en post läggs i `misses`.

**De 5 återstående är tysta rutor:**
- Sonden skriver bara ut `frames`, `hits` och `misses.slice(-80)` (`sound-probe-wk.mjs:46`), inte `silent`.
- Listan har 13 poster, alltså under taket 80, så inget har kapats och `slice` påverkar inget.
- Grenarna utesluter varandra. Därför är `silent = 481 − 463 − 13 = 5` exakt.
- En tyst ruta är en ruta som workern med avsikt skickat utan patch: `rutor[i] = null` ger `t.silent.add(k)` (`lip-layer.js:90`). Det är paus, upprampning eller nedrampning i ljudet (`lip-layer.js:157-163`).
- Vilka fem ticks det var går inte att avgöra, eftersom sonden inte loggar dem.

**De 13 missarna:**
- **10 poster `andas:39:vila`, map-rutor k2–k7** (k2 ×3, k3 ×2, k4 ×3, k5, k7). Patchen fanns *exakt* på k (avstånd 0) men var taggad `vridhoger7105:k`. Skärmen visade fortfarande sista rutan av föregående tagning `andas`, i vila. Svarets karta började alltså på kedjeklippet `vridhoger7105` innan det klippet syntes. `patchKeys` (`lip-layer.js:53-59`) letar `andas:39`, `andas:38` och `vila`, och ingen av dem matchar. Kategori: kroppen ligger efter kartan vid replikens start.
- **3 poster `vikt6103:0`, k196.** Ingen patch fanns inom ±5 rutor; närmaste var k190 (`vikt6101:34`), och `silentNow` var falskt. Biten som täcker k191–k201 var alltså inte avkodad när klippet `vikt6103` visade sin första ruta. Kategori: patchen kom sent vid kedjeövergången.
- Totalt rör det sig om 6 distinkta map-rutor (cirka 250 ms vid 24 fps), fördelade på 13 ticks.

**Precisering av Kevins rapport:** "13 missar vid kedjeklippens första rutor" stämmer i sak. Två saker behöver läggas till:
- Talen 481 och 463 räknar rAF-ticks, inte videorutor.
- Differensen 18 består av 13 missar och 5 avsiktligt tysta ticks.

Att missarna beror på latens i headless-webbläsaren är troligt men inte bevisat. Sonden mäter inte avkodningstiden. Vilken SHA servern på GPU-kopian körde går inte heller att verifiera i efterhand; det går bara att konstatera att räknarkoden är identisk i c4818f5 och 5aa7ed1.

## 6. Testkörning och avvikelser för O01

**Testkörningen:** `node --test --test-force-exit test/*.test.mjs` på 5aa7ed1 gav **285/285 pass**, 0 fail, 0 skipped, cirka 2,5 s (`test-run-5aa7ed1.log`). Det bekräftar Kevins siffra.

**Avvikelser som O01 behöver besluta om:**
1. **`game` i studiobord:** kommentaren i #312 nämner fältet `game`, men det finns inte i `studio-tables.mjs` vid 5aa7ed1. Om det finns i stagingdatan kommer det från annan kod.
2. **Saldo per rum:** `shared_players` har nyckeln (room, token), så en spelare har ett saldo per bord (S2/W1). Main har ett globalt saldo. Beslutet påverkar settlement och rapporter.
3. **Global auditkedja:** kedjan är en enda för alla rum. Det kräver ett globalt lås i Postgres (avsnitt 2.3), eller ett beslut om en kedja per rum. Det senare bryter befintliga hashar.
4. **`table-service.run()` är död kod över HTTP** (S10). Den finns bara kvar för tester och gammal saldoläsning.
5. **Gallring av `safety_audit`:** tabellen gallrar med `DELETE` (S11) och är alltså inte append-only, till skillnad från `audit_events` och `shared_transactions`.
6. **QA-verktyg:** fyra verktyg skriver direkt i `shared_rooms` (S14). De ska inte följa med.
