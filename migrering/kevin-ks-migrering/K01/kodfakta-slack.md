# Kodfakta ur Kevins spel som hittills bara gått via Slack (21 okt 2026)

Källa: kevin-merge-admin **5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc** (= 238d6dd6 + läppsynksfixen, ingen serverändring) om inget annat anges.
WAL-ändringen gäller **kevin-staging 82718307** (live på staging sedan 00:24 den 22 okt). Allt är läst ur koden eller mätt på scout-hel1; radnummer avser 5aa7ed10.

## 1. Upprepade förfrågningar (server/shared-table.mjs rad 336–437)
- Varje anrop kör först `advance(id,r)`: klockstyrd fasflytt (bets-deadline → start, plan.endAt → settled/next) oavsett om kommandot är nytt eller upprepat. Den flytten kan skriva audit-händelser.
- Sedan slås `(room, token, requestId)` upp i `shared_requests` (PRIMARY KEY(room,token,id)).
  - Finns raden med **identisk input** (hela JSON-texten, versionen inräknad): hela kommandogrenen hoppas över, ingen ny `player.*`-audit, ingen tillståndsändring, ingen `version++`. Klienten får aktuell vy.
  - Samma id med annan input: felet `Request ID reused with different input`.
  - Tomt eller saknat id: `Request ID required`.
  - Id:n är per spelartoken: en annan spelare får använda samma id.
- Korrekt kontraktsformulering: *en upprepad förfrågan appliceras inte igen och skriver ingen egen audit-post; bordets klocka går dock vidare i samma anrop, precis som vid en state-poll.*
- Tester: test/shared-table.test.mjs rad 41–42 (refill `same` två gånger), rad 213 (ledger-refill), samt PR #323 (`a request id repeated with the same input is applied once; reused with other input it is refused`).

## 2. Språk (beslut a: admin-ägt)
- Studiobordets `lang` är öppningsspråket (`languageFor`, shared-table.mjs rad 38, 91; test table-limits.test.mjs rad 54).
- I dag finns dessutom op `language` (rad 377–381): en spelare kan byta bara i bets-fasen innan någon insats ligger (`Change dealer language before placing bets`), bytet auditeras som `presentation.language` med playerId. Klienten exponerar det i `#dealerLanguage` (public/shared-table.js rad 345) och skickar studiobordets språk som första kommando (rad 72).
- Beslut a innebär att spelarbytet tas bort i portningen. Det saknar test i dag, så inget test behöver rivas.

## 3. Paus / 24-timmarsrast (shared-table.mjs rad 94, 266–269, 346–352)
- `op: pause` skriver `demo_breaks(token, until_ms = nu + 24 h)`; upprepning behåller det längre slutet (`ON CONFLICT … MAX`).
- Följer spelarens token, inte bordet; överlever omstart (test rad 155–156). Ingen kommando finns för att häva den i förtid.
- Under paus nekas: join, refill, bet, undo, doubleBets, allSeats, repeat, ready, hit/double/split, och att **ta** insurance. Felet: `Your demo break is active for 24 hours`.
- Tillåtet: stand, att **avböja** insurance, state, leave, language. En pågående hand spelas alltså klart med stand (test rad 166; PR #323 `break during insurance lets the player decline but not take it, then stand`).
- I bets-fasen nollas en pausad spelares insatser på alla bord och spelaren tas bort ur ready/history vid varje `advance`; platserna behålls.

## 4. SQL-dialekt och synkron node:sqlite
- 19 DDL-satser (12 tabeller, 7 index), 69 `prepare()`-anrop i serverfilerna. SQLite-specifikt som måste skrivas om för Postgres:
  `INTEGER PRIMARY KEY AUTOINCREMENT` ×2, `json_extract` i index och frågor ×4, `rowid` ×4, `ROUND(x,2)` på REAL, `?`-platshållare (14 ställen), `INSERT OR IGNORE` ×1. `ON CONFLICT … DO UPDATE SET … excluded` ×4 fungerar likadant i Postgres.
- Det stora: all databasåtkomst går via `node:sqlite` **DatabaseSync**. Noll `await` i shared-table.mjs. Varje spelarkommando körs som en synkron transaktion inne i `run()`, som förutsätter att läsning av rummet, `advance()`, kommandot och `save()` sker utan att något annat hinner emellan.
- Med Neon (nätverk, async) måste `run()` och allt som anropar det (server.mjs, table-service, transactions, game-audit) bli async, och serialiseringen per rum lösas på nytt (rådgivande lås eller kö per rum).

## 5. Lås och BEGIN IMMEDIATE
- Inga explicita lås i Kevins kod (ingen mutex, inget busy_timeout, inget `SELECT … FOR UPDATE`).
- Transaktionerna öppnas med `BEGIN IMMEDIATE` på fyra ställen (shared-table.mjs rad 331, 444, 456; transactions.mjs rad 15): skrivlåset tas direkt, så en läsare som ska skriva aldrig uppgraderas mitt i. I en process med synkron åtkomst är det hängslen; i Postgres motsvaras det närmast av ett rådgivande lås per rum (`pg_advisory_xact_lock(hash(room))`) i början av varje kommando.
- Serialiseringen i dag kommer av enkeltrådad synkron körning, inte av låsen. Om Jakobs main har databaslås är orsaken inte något som ärvts från Kevins sida (hans kod har jag inte granskat).

## 6. De sex hasharna (alla sha256)
| Var | Vad | Kopplat till |
|---|---|---|
| shared-table.mjs `keyFor` (rad 35) | spelarens cookie-token → `shared_players.token` | gästidentitet per rum |
| game-audit.mjs `event` (rad 19–23) | hashkedja över `audit_events`: `previous_hash`/`hash`, `genesis` först | rum, roundId, typ, payload-text; payload har playerId (random UUID per plats) och namn |
| table-service.mjs `digest` (rad 17) | token → `demo_tables.session` | gästidentitet |
| dealer-memory.mjs `key` (rad 16) | gäst → minnesnyckel | gästidentitet |
| studio-activity.mjs `h16` (rad 8) | BO-cookie → sid | admin-inloggning (drift) |
| rorlig-lipsync.mjs `podToken` (rad 174) | RunPod-nyckel → pod-token | GPU-worker (drift) |

Dessutom integration-index.mjs `revision` = hash av dokumentet. Ingen hash är kopplad till operatör eller spelbolag; begreppet finns inte i Kevins schema.
I migreringen: audit-kedjan behålls som den är; de tre gäst-hasharna bör bli Jakobs player_id/konto; de två drift-hasharna följer inte med spelkärnan.

## 7. Audit-payload som text: operatorId går att lägga till utan ny genesis
`game-audit.mjs` rad 21–22: `data = JSON.stringify(payload)`; `hash = digest({room, roundId, at, parent, type, payload: data, previous})`. Payloaden hashas alltså som lagrad text. Nya händelser med ett extra fält bryter inte kedjan, gamla rader verifierar som förut, ingen ny genesis behövs.
Enklaste robusta sättet: ge `createGameAudit` ett `operatorId` vid skapandet och låt `event()` lägga det i varje payload (en rad), i stället för att röra de sju anropsställena i shared-table.mjs. Görs i det porterade audit-steget, inte i 5aa7ed10.

## 8. Kapacitet, mätt (inte tumme)
Bänk: `createSharedTable` direkt, 20 rum × 5 spelare, 12-kärnig AMD EPYC-Genoa, allt i en Node-tråd. Klienten pollar var 700 ms; servern kör `tick()` var 250 ms (server.mjs rad 141).

| Operation | 5aa7ed10 (standardjournal, synchronous FULL) | med WAL + synchronous NORMAL (som 82718307) |
|---|---|---|
| state-poll | 0,40–0,46 ms (≈2 300/s) | 0,41 ms (≈2 470/s) |
| insats (bet) | 7,5–8,1 ms (≈130/s) | 3,1 ms (≈325/s) |
| ready (startar rond) | 2,0–2,4 ms | – |
| tick, 20 rum i rond | 13 ms | – |
| tick, 100 rum i rond | 44 ms | – |

- Före WAL var fsync per COMMIT den dominerande kostnaden; solvifyab mätte commit till 3,97 ms → 0,24 ms på samma disk efter WAL (82718307). Resten av insatsens 3 ms är själva kommandot: `advance`, `save` (hela rummet som JSON), audit-hash och vyn.
- Tumregel ur siffrorna: varje skrivning blockerar **alla** rum under sin tid. Före WAL ~130 insatser/s totalt, efter WAL ~300/s. Pollar ensamma tar halva tråden vid ungefär 1 000 samtidiga tittare; tick tar en femtedel av tiden vid ungefär 100 rum i rond.
- Tre sqlite-filer (demo.sqlite med bord/transaktioner/audit/settlements, studio-activity.sqlite, dealer-memory.sqlite) men de jobbar inte parallellt: samma tråd.

## 9. Redis
Finns inte i Kevins kod och inget behöver det i dag: tillståndet ligger i sqlite plus processminne (klient-sockets, worker-anslutningar, talplaner). Redis blir aktuellt först med mer än en serverinstans, och då är det större problemet att spelet bygger på långlivade websockets (tittare och GPU-workern som ringer in), vilket inte går på serverless. Råd: inte nu, inte i kevin-staging; beslutas när hostingen för main är vald.
