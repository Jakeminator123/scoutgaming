# Nyckel → bolag

Plan för punkt 5 under "Efter O03" i [MASTERPLAN](../../migrering/MASTERPLAN.md): partnernyckeln binds till ett bolag och motorn kontrollerar bindningen. Skriven 28 oktober 2026 mot `main` d3bab9b970. Raderas när punkten är verifierad i drift. Radnumren gäller den SHA:n.

## 1. Mål

- En partnernyckel (`croupier_auth.api_keys`) tillhör exakt ett bolag (`croupier_studio.operators.operator_id`). Partnerspelarna hör redan till nyckeln (`partner_players.key_id`), så varje partnerspelare hör därmed till exakt ett bolag (Jakobs beslut om steg F).
- En launch-session bär bolaget: token-claims har `operator`, och sessionens bolag läses ur nyckeln, som aldrig byter bolag.
- **Motorn** kräver, efter verifierad signatur, att bolaget i adressen (`?operator=<slug>`) är nyckelns bolag. Bryggan (`packages/navigation/server/platform-routing.mjs`) skickar bara adressen vidare och kontrollerar ingenting (granskarens anmärkning på #513).
- Delat bord släpper in en partnerlanserad session i bolagets rum med samma rättigheter som en inloggad spelare: authorize, revalidate, revalidateLocked och kommandon.
- Fel bolag ger ett tydligt 403 med kod och texten "Nyckeln gäller ett annat bolag", i stället för 1006 och 60 sekunders återförsök som slutar på felsidan.

## 2. Datamodell

**Kolumn, ingen ny tabell:** `croupier_auth.api_keys.operator_id text NOT NULL` med samma CHECK som `operators.operator_id` (`^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$`) och indexet `api_keys_operator_idx (operator_id)` för listningen per bolag. Produktionen har 0 rader, så ingen backfill behövs och NOT NULL kan läggas direkt.

- **Ingen främmande nyckel.** `operators` har nyckeln `(environment_id, workspace_id, operator_id)` och ägs av Studio-schemat. Motorn kör i ett scope (`studioPolicyRuntime.scope`), så koden kontrollerar att bolaget finns och är `active` i det scopet, både när nyckeln skapas och vid varje launch och binding.
- **Bolaget är oföränderligt.** Ingen kod uppdaterar `operator_id`. Byte av bolag kräver en ny nyckel. 012 lägger en `BEFORE UPDATE OF operator_id`-trigger som avvisar ändringen, så att garantin inte bara vilar på koden.
- **Sessionen behöver ingen ny kolumn.** `player_sessions.source_stamp` är `partner:<keyId>:<stamp>`, och bolaget läses ur nyckelraden i samma uppslag som `partnerAllowed` redan gör. Rotation och återkallelse raderar redan sessionerna (`services/game/server.mjs:553–558`).

**Migrering `ops/neon-game/012-api-key-operator.sql`**, i samma form som 011:

- `SET LOCAL`-tidsgränser, målkontroll (`{{database}}`, `{{role}}`, PG ≥ 16, inte read-only), `pg_advisory_xact_lock` och `LOCK TABLE croupier_auth.api_keys IN ACCESS EXCLUSIVE MODE`.
- Preflight: `product-v1` har rätt checksumma, `game-012-api-key-operator` saknas, kolumnen saknas, och tabellen är **tom** (annars `api_key_operator_not_empty`). Testnycklar i preview eller staging raderas först, eftersom Jakob vill radera i stället för att arkivera.
- Gränsen `-- MIGRATION MUTATIONS`: `ALTER TABLE … ADD COLUMN operator_id text NOT NULL CHECK (…)`, `CREATE INDEX`, triggern, och sedan ledgerraden `INSERT INTO croupier_game.storage_migrations` med `game-012-api-key-operator`, `{{migrationChecksum}}` och `{{evidence}}`.
- Postflight kontrollerar kolumnen, indexet och ledgerraden.
- Ett offlineverktyg, `tools/prepare-api-key-operator.mjs`, kopierat från `tools/prepare-lissabon-retirement.mjs`, renderar `--sql` och `--readiness-sql` (preflight plus ROLLBACK). Verktyget ansluter aldrig till databasen.
- `test/fixtures/pglite-pool.mjs:31–33` får 012 som valfri migrering i PR A och som framåtmigrering i PR C.

**Ordningen** följer [AGENTS.md](../../AGENTS.md) (tolerant kod → godkänd migrering → kravhöjning):

1. PR A fungerar både med och utan kolumnen. Den läser `to_jsonb(k)->>'operator_id' AS operator_id`, som ger `null` när kolumnen saknas, i stället för att namnge kolumnen.
2. Jakob kör 012.
3. PR C kräver ledgerraden vid start, på samma sätt som `product-v1` i `packages/storage/server/postgres-store.mjs:159–160`, och läser kolumnen explicit.

## 3. Kodpunkter

| Var | I dag | Ändring | PR |
| --- | --- | --- | --- |
| `apps/studio/lib/studio-admin-accounts.mjs:88–97` `apikeys/create` | `name, scopes, walletUrl, ipAllow`; INSERT utan bolag | Kräver `operatorId`. Bolaget slås upp i scopet (finns och är `active`, annars 422 `partner_key_operator_invalid`). INSERT med `operator_id`. Saknas kolumnen svarar Studio 503 `partner_key_operator_schema_pending` och skapar ingen obunden nyckel, så att tabellen förblir tom inför 012. Om #512 är mergad behålls dess `purpose`. | A |
| `apps/studio/lib/studio-admin-data.mjs:109` `GET apikeys` | listar globalt | Returnerar `operatorId` och bolagsnamn. Partnerportalens Integration listar `WHERE operator_id = <sessionens bolag>`. | B |
| Admin › System › Integration (`studio-administration.tsx:218, 296–316`) | ingen bolagsväljare | Admin väljer bolag när nyckeln skapas. Listan visar bolaget. | B |
| Partnerportalens Integration (`apps/studio/components/kevin-bo/views/integration.jsx`, nivå 2 #518) | statustext, inga nycklar | Maskerade nycklar för det egna bolaget. Om partnern får skapa nycklar tas `operatorId` från arbetsytans session; ett `operatorId` i bodyn avvisas (400). Annars bara "begär rotation" enligt ADMIN-FORENKLING C. | B |
| `services/game/storage/async-partner-api.mjs:31–46` `mintLaunch` och `:146–151` `/api/v1/launch` | `jwtSign({sub, partner, partner_key_stamp, …})` | Lägg `operator: row.operator_id` i claims (`:38`, `:150`). Den returnerade `url` bär `?operator=<slug>` (slug slås upp via operator store). En obunden nyckel får inget `operator`. | A |
| `async-partner-api.mjs:76–90` `authenticate` | `SELECT *` | Ingen ändring i A. I C nekas en nyckel utan bolag med 403 `partner_key_unbound`. | C |
| `async-partner-api.mjs:21–30` `keys.list`, `keys.create` | inga anropare i repot | Raderas. Studio äger skapandet. | C |
| `services/game/server.mjs:479` `partnerAuthority` | `SELECT id,secret,revoked_at,wallet_url` | Tar också med `operator_id` (A: via `to_jsonb`). | A |
| `services/game/storage/async-player-auth.mjs:119–128` `fromPartner` | kontrollerar nyckel och stämpel | I samma transaktion: `claims.operator === key.operator_id`. Är båda `null` gäller dagens beteende i A. I C ger `null` på någon sida felet `partner_launch_unbound`. | A |
| `async-player-auth.mjs:68–77, 87–94` `validatedSession`, `bindingById` | `{actorId, sessionId, expiresAt, partnerKeyId}` | Bindningen får `operatorId` från nyckelraden (`null` för infödda och obundna). | A |
| `services/game/server.mjs:629–641` launchrouten (motorn) | signatur, spelare, `launchGameStart` | Efter `jwtVerify` och `fromPartner`: slugen `?operator=` slås upp till `operator_id`. Avviker den från `claims.operator` svarar motorn 403 med HTML-sidan "Nyckeln gäller ett annat bolag" (kod `partner_operator_mismatch`) och sätter ingen cookie. Saknas `?operator=` sätts nyckelns slug. | A |
| `services/game/game-start.mjs:18–25` `launchGameStart` | utan `?operator=` rensas dealer, lane och table, och spelaren hamnar i lobbyn | Tar emot `{operator}` från motorn. En bunden launch landar alltid hos sitt bolag. Kommentaren "A partner key names no company" skrivs om. | A |
| `services/game/shared-room-access.mjs:17–24` `session()` | nekar allt med `partnerKeyId !== null` ("Legacy partner keys have no canonical operator/room grant") | Godtar en partnersession när `operatorId` är giltigt. I `bind` (`:82–89`) jämförs `publication.operatorId`; avviker den nekas sessionen med `StudioStorageError('partner_operator_mismatch', 403)`. Gäller authorize, revalidate och revalidateLocked (`:90–121`). En obunden partnersession nekas med `partner_key_unbound`. | A |
| `services/game/storage/shared-command-auth.mjs:53–56, 80` | `partner:`-stämplar ger `null`; returnerar `partnerKeyId: null` | Ny gren för `^partner:([^:]+):([a-f0-9]{64})$` (stämpel krävs, aldrig äldre stämpellösa): `api_keys` läses `FOR SHARE` i boDb (inte återkallad, ingen `wallet_url`, stämpeln = sha256(secret), `operator_id` satt) och spelaren `FOR SHARE`. Craig-länken hoppas över. Returnerar `{…, partnerKeyId, operatorId}`. Låsordningen: P → api_keys → session sist, samma som i dag. | A |
| `services/game/server.mjs:1100–1112` spelsidan `/blackjack` | `withSharedRoomEntry` utan sessionskontroll | När delat bord är på och `selection.roomId` finns: en partnerbindning vars `operatorId` inte matchar rummets bolag får 403-sidan "Nyckeln gäller ett annat bolag" i stället för spelet. Klienten startar då aldrig sin socket. | A |
| `services/game/shared-room-upgrade.mjs:91` och klienten `public/shared-room-client.mjs:102, 175–178` | upgraden ger 403, webbläsaren ser 1006 och försöker igen i 60 s (`reconnectBudgetMs`) | Upgraden svarar fortfarande 403; det är bara reservskyddet. Det användaren ser kommer från sid- och launchkontrollen ovan, som gör samma jämförelse. Ingen ny retry-logik i klienten. | A |
| `services/game/shared-room-entry.mjs:5–19` | ingen nativ reserv när flaggan är på | Oförändrad. Med bindningen behövs ingen reserv. | – |
| Demo-byggaren (#512, `apps/studio/client/admin/lib/demo-builder.mjs`) | `DEMO_LAUNCH_ENABLED=false`; `apikeys/create` utan bolag | Skickar `operatorId` (valt bolag) till `apikeys/create`, och länken bär operator och `table=<rum>`. Konstanten och `DEMO_LAUNCH_OFF_TEXT` raderas och knappen "Skapa demolänk" är alltid aktiv. | B |
| `packages/navigation/server/platform-routing.mjs:12–16` (bryggan) | behåller `?operator=` | Ingen logikändring. Bara kommentaren "Binding a key to an operator comes later" skrivs om. | C |
| `async-player-auth.mjs:25, 33` `allowLegacyPartnerSessions` | stämpellösa sessioner tillåts utanför Neon-policyn | Raderas. Varje partnersession har stämpel och bolag. | C |

Felkoderna är `partner_operator_mismatch`, `partner_key_unbound`, `partner_launch_unbound`, `partner_key_operator_invalid` och `partner_key_operator_schema_pending`. Texterna läggs i spelets och Admins texter, inte i bryggan.

## 4. Prov

**Enhets- och integrationsprov** (PGlite, med och utan 012):

- `test/api-key-operator-migration.mjs` (mall: `test/lissabon-retirement.mjs`): 012 lyckas på en tom tabell, nekas med `api_key_operator_not_empty` på en tabell med rader, nekas en andra gång (ledgerraden finns), triggern stoppar UPDATE av `operator_id`, och `--readiness-sql` slutar på ROLLBACK.
- `test/studio-admin-accounts.mjs`: create utan `operatorId` ger 400, ett okänt eller suspenderat bolag ger 422, saknad kolumn ger 503 `partner_key_operator_schema_pending` och ingen rad, rätt bolag ger en rad med `operator_id`.
- `test/game-entry-partner.mjs` och `test/partner-launch-route.mjs`: claims bär `operator`. `?operator=` med ett annat bolag ger 403 `partner_operator_mismatch` och ingen `Set-Cookie`. Utan `?operator=` landar spelaren hos nyckelns bolag. En förfalskad token med ändrat `operator` faller på signaturen. En token utan `operator` för en bunden nyckel nekas (A), liksom varje token utan `operator` (C, `partner_launch_unbound`).
- `test/shared-room-access.mjs:229–250`: de fall som i dag nekar `partnerKeyId:'key-a'` delas upp. En bunden session i rätt rum godtas i authorize, revalidate och revalidateLocked. Ett annat bolags rum ger `partner_operator_mismatch`. `operatorId:null` ger `partner_key_unbound`. Revalidate efter rotation eller återkallelse nekas.
- `test/shared-command-auth.mjs:105`: `partner:key` utan stämpel nekas fortfarande. Med stämpel och bunden nyckel ges en binding med `operatorId`. Fel stämpel, en återkallad nyckel, `wallet_url` eller en nyckel utan bolag nekas.
- Delat bord från början till slut (`tools/run-shared-table-qa.mjs`-fixturen): en partnerlanserad spelare i rätt bolag spelar en hel hand (insats, beslut, utbetalning, plånboksrader), och en spelare från ett annat bolag får 403 vid sidan och vid upgraden.
- Negativa partnerprov i `test/partner-access-policy.mjs` och en ny `test/partner-key-operator.mjs`: partnerportalen kan inte lista eller skapa nycklar för ett annat bolag (`operatorId` i bodyn ger 400), och `GET apikeys` filtreras per bolag.

**Preview-prov**, med K06/K07-harnessens metod: syntetiskt bolag och rum i preview-grenen, en syntetisk nyckel skapad via Admin, launch, en hand på delat bord, sedan fel bolag (403-sidan syns, ingen återförsöksloop i konsolen) och sist en återkallad nyckel. Nyckeln raderas efteråt. Råkvittot läggs utanför Git enligt staging-rutinen och bara ett sanerat kvitto (`docs/<datum>-NYCKEL-BOLAG-ACCEPTANCE.json`) checkas in. Inga hemligheter i Git.

## 5. PR-sekvens, Jakobs steg, risker, radering

1. **PR A: tolerant motor och migreringsfil** (före DDL). 012, prepare-verktyget, PGlite-fixturen, claims, `fromPartner`, bindningar, shared-room-access, shared-command-auth, motorns launch- och sidkontroll, och `apikeys/create` som kräver bolag (503 tills kolumnen finns). Med 0 nycklar i produktionen ändras inget beteende där. Provas i preview, både utan och med 012 på grenen.
2. **Jakob:** backupgren `backup-api-key-operator-<datum>` enligt [ENVIRONMENT-RESTORATION](../ENVIRONMENT-RESTORATION.md), `node tools/prepare-api-key-operator.mjs --evidence <privat-json> --readiness-sql` och sedan `--sql`, körs som `croupier_game` mot produktionen. Därefter kontrolleras kolumnen och ledgerraden. Samma sak på preview- och staginggrenar, där testnycklar raderas först.
3. **PR B: Admin och demo** (efter DDL, ovanpå #512 och #518). Bolagsväljare i Integration, partnerportalens egna nycklar, demo-byggaren slås på och `DEMO_LAUNCH_ENABLED` och `DEMO_LAUNCH_OFF_TEXT` raderas.
4. **PR C: kravhöjning och radering.** Motorn kräver ledgerraden `game-012-api-key-operator` vid start, nycklar och token utan bolag nekas, `allowLegacyPartnerSessions`, legacygrenen och kommentaren i `shared-room-access.mjs:18–19` ("no canonical grant") samt `keys.list` och `keys.create` raderas, och kommentarerna i bryggan och `game-start.mjs` skrivs om. B och C kan slås ihop om de blir små.

**Risker:**

- En obunden nyckel skapad mellan A och DDL blockerar 012. Det förhindras av att create svarar 503 tills kolumnen finns.
- Ren start ([REN-START](REN-START.md)) raderar bolag. Bolagets nycklar måste raderas först, annars nekas varje launch med `partner_key_operator_invalid`.
- `croupier_auth` och `croupier_studio` saknar FK mellan sig. Bolagets existens kontrolleras därför i koden vid varje launch och binding.
- Låsordningen i shared-command-auth: api_keys läses `FOR SHARE` mellan P och sessionen. Rotation tar api_keys före sessionerna, så ingen cykel uppstår. Det provas med samtidig rotation under en hand.
- En session som redan sitter vid bordet när nyckeln roteras eller återkallas stängs med 1008 vid nästa revalidate, vilket är avsiktligt.
- Tal och spelares egna konton påverkas inte.

**Raderas:**

- legacygrenen i `shared-room-access.mjs:17–24`
- `allowLegacyPartnerSessions`
- `DEMO_LAUNCH_ENABLED` och `DEMO_LAUNCH_OFF_TEXT`
- `keys.list` och `keys.create` i `async-partner-api.mjs`
- kommentarerna om att en partnernyckel saknar bolag
- den här planen, när punkten är verifierad
