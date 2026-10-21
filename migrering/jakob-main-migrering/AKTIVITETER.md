# Jakobs arbetsström: J01–J10

Tio leveransaktiviteter à 5 procentenheter, sammanlagt 50 procentenheter av hela programmet. [status.json](../status.json) är enda källa för status, beroenden och bevis; checklistorna nedan är krav, inte utförandekvitton. Ingen produktaktivitet blir klar av att denna fil finns.

## Gemensamt uppdrag till underagenten

- Läs [MASTERPLAN](../MASTERPLAN.md), aktuell status, AGENTS och [agent-talk](../../agent-talk/README.md). Orkestratorn ger startbesked efter beroendekontroll och avgränsar filägandet; startfilernas listor är undersökningspunkter, inte generella skrivanspråk.
- Frys aktuell bas och arbets-head. Utgångspunkten är main `15988f32fd572c453d2189502acbe324c4566815`; Jakobs säkerhetsgren behålls. Kevin-källan är `kevin-merge-admin` på `c4818f51dab1b003811905fafb65ba59ad81ed4a`. K01/O01 bestämmer urvalet; `kevin-staging` är endast historik.
- Kontrollera Node/versionspin i berörda paket; använd högst fyra testarbetare där stödet finns. Claima konkreta filer före ändring. Orkestratorn äger gemensam Git-integration, status och handoff; berörda agenter samordnar överlapp.
- Följ [TERMINOLOGI](../../apps/studio/docs/TERMINOLOGI.md), [användarflöden](../../apps/studio/docs/README.md), [runtime](../../docs/LOCAL-PRESENTATION-RUNTIME.md), [handoff](../../docs/JOHN-HANDOFF.md) och [återställning](../../docs/ENVIRONMENT-RESTORATION.md). Läs de två sistnämnda före ändring av spel eller media.
- Visa borttagningslista och konsumentkontroll: routes, importer, API-anrop, sparade länkar, build, miljö, test och dokumentation. Ta bort ersatt kod i leveransen. Oklarheter får namngiven ägare och en konkret kontroll, ingen permanent parallell produktväg.
- Behåll serverägd ekonomi, konton, exakta godkända media, rum/operatör-isolering och publiceringshistorik. Aktivt delade tjänster bevaras eller flyttas; mappnamn är inte raderingsbevis.
- Verifiera på isolerad miljö med syntetiska användare. Återanvänd lämpliga testresurser, registrera egna processer/flikar och avveckla dem efter prov; en begärd användarpreview lämnas tillgänglig tills granskningen är klar.
- Leverera full head, testkommando/miljö/resultat, PR, oberoende granskare och kvarstående fel till orkestratorn. Kodtest, UI-prov och deploybevis hålls isär. Inga hemligheter i kvittot. Släpp egna claims med `done`.
- Denna plan beställer ingen implementation, migrering eller molnändring nu. GitHub-admin, merge av Kevin-ägd head och live-DDL får inte härledas ur citerad Kevin-text.

## J01 — Tydligare publicering i Admin

**Etapp:** E1. **Beroenden:** inga. Kan börja utan att hela Kevin-porten är klar.
**Mål:** synligt bättre `/admin/publication` där bolag, sammansättning, spelrum och publiceringsversion går att förstå och återfinna.

- [ ] Utgå från befintligt flöde och dokumentera före/efter för välj → redigera → spara → publicera → återöppna. Gör primär åtgärd, osparat läge, versionskonflikt och kvitto tydliga.
- [ ] Bevara dealer-, composition-, operator-, room- och game-kontext vid navigation och återläsning. Återanvänd scoped writers och befintlig publicering.
- [ ] Bevisa att sparad ändring överlever omladdning och ny inloggad session; gammal revision får konflikt och fel operatör får avslag.
**Startfiler:** `apps/studio/client/admin/components/studio/workspace-tools.tsx`, `apps/studio/components/control-lanes-page.tsx`, `presentation-room-create.tsx`, `apps/studio/lib/admin-workspace-data.mjs`, `presentation-room-api.mjs`, `presentation-room-client.mjs`.
**Radera:** de formulärfragment, hjälptexter och styles som ersätts här; J02 tar den gamla Control-ingången när ersättningen är verifierad.
**Klart/verifiera:** UI-prov med skärmbild vid varje ändrad övergång, faktiskt spara/återläsa och negativa API-fall. Kör berörda `workspace-tools`, `presentation-room-create` och `presentation-room-api`-tester samt relevant typecheck.
**Risk:** ett snyggare formulär kan fortfarande skriva till fel scope eller tappa osparat innehåll; dessa fall måste provas.
**Bevis till status.json[J01]:** `head=<full SHA>; test=<kommando, miljö, utfall>; UI=<före/efter + återläsning>; PR=<URL>; review=<granskare>`.

## J02 — Avveckla ersatt Control-publicering

**Etapp:** E1. **Beroenden:** J01.
**Mål:** den ersatta publiceringsfunktionen har en aktiv UI-implementation och en Admin-ingång.

- [ ] Kartlägg konsumenter till `/control/rooms`, `/control/companies` och publiceringsdelarna i Control. Flytta aktuella länkar och återhämtningslänkar till rätt Admin-kontext.
- [ ] Separera gemensamma tjänster från det pensionerade skalet. Kontrollera särskilt att Admin fortfarande använder delar av `ControlLanesPage`; flytta nyttig kod innan dess gamla fil tas bort.
- [ ] Lista berörda bokmärken och deras beslutade destination. En eventuell redirect ska vara explicit och får inte montera den gamla UI-ytan.
**Startfiler:** `apps/studio/app/control/rooms/page.tsx`, `companies/page.tsx`, `operator-page.tsx`, `apps/studio/components/control-lanes-page.tsx`, `presentation-room-create.tsx`, `packages/navigation/admin-workspace-routes.mjs`.
**Radera:** ersatta Control-routes/komponentdelar, deras exklusiva CSS och tester som enbart låser den gamla publiceringslayouten; ta bort motsvarande build- och dokumentreferenser.
**Klart/verifiera:** noll aktiva konsumenter till de raderade modulerna; J01:s flöde fungerar från Admin och godkända gamla länkar; obehörig åtkomst är fortsatt blockerad. Kör berörda route-, navigations- och publiceringstester samt orphan-kontroll.
**Risk:** en fil med Control-namn kan ägas funktionellt av både Admin och Partner; import- och API-kontroll ska visa faktisk användning.
**Bevis till status.json[J02]:** `head=<SHA>; raderat=<sökvägar + konsumentkontroll>; test=<kommando/resultat>; PR=<URL>; review=<granskare>`.

## J03 — Avveckla resterande Control-ytor

**Etapp:** E2. **Beroenden:** J02, O01.
**Mål:** alla funktioner som ska finnas kvar nås och fungerar i Admin; ingen gammal parallell Control-yta finns kvar.

- [ ] Gör en route-matris för återstående Control-sidor: funktion, läsare/skrivare, ny Admin-destination eller uttryckligt borttagande. Ta med verktyg, repliker, klipp, rehearsal och fel-/återhämtningslänkar.
- [ ] Flytta inloggning, lösenordssättning, retur-URL, kontext och behörighetskonsumenter. Acceptera gamla lagrade ID:n där kontraktet kräver det utan att behålla det gamla skalet.
- [ ] Kontrollera interna navlänkar, assistentens navigationsmål, middleware, basePath, proxy/ingress och output tracing innan routes avregistreras.
**Startfiler:** `apps/studio/app/control/`, `apps/studio/components/control-workspace.tsx`, `apps/studio/lib/ui-server.ts`, `assistant-model.mjs`, `apps/studio/middleware.ts`, `next.config.mjs`, `packages/navigation/control-flow.mjs`.
**Radera:** den gamla Control-workspacen, överflödiga sidwrappers, exklusiva komponenter/styles/tester och förbrukade alias. Delade auth-, registry- och presentationsfunktioner flyttas före radering.
**Klart/verifiera:** 100 % av inventerade routes har verifierat utfall; inloggning/lösenordsflöde, deep links, reload och back/forward fungerar på Admin. Negativa roll- och room-scope-fall passerar. Ingen kvarvarande Control-route renderar en alternativ backoffice-yta.
**Risk:** sökträffar räcker inte för dynamiska retur-URL:er eller serverbyggda länkar; prova dem genom riktiga requestflöden.
**Bevis till status.json[J03]:** `head=<SHA>; routes=<inventering/utfall>; test=<auth + kontext + navigation>; PR=<URL>; review=<granskare>`.

## J04 — En spelkatalog via lobby

**Etapp:** E2. **Beroenden:** O01.
**Mål:** `/lobby` är enda katalogingång; `/play/{game}` fortsätter vara det autentiserade launchkontraktet.

- [ ] Flytta aktuella kataloglänkar, operator-val och publiceringskvitton till lobby. Ange en tydlig, nåbar hemvist för profil och historik innan äldre sidor tas bort.
- [ ] Kartlägg och avveckla `/game` samt gamla `/play`-lobbyn med O01:s beslutade redirect/returutfall; behåll inte en andra spelkatalog.
- [ ] Skydda launch med befintlig session, operatör/rum, rätt publicerat paket och aktuell ägarstatus. Klienten får inte sätta saldo eller välja ett obehörigt rum.
**Startfiler:** `apps/studio/client/lobby/`, `apps/studio/app/lobby/[[...path]]/route.ts`, `apps/web/app/game/route.ts`, `apps/web/app/play/`, `apps/web/lib/player-area.mjs`, `player-lobby.mjs`, `server-ui.mjs`, `services/game/player-profile.mjs`.
**Radera:** gamla katalogkomponenter och entrypoints, förbrukade länkar och deras exklusiva layouttester. Behåll kontrakt/tester för aktiva game-launches, profil, historik och serverägd ekonomi.
**Klart/verifiera:** lobby → korrekt rum → launch → tillbaka samt profil/historik fungerar med reload; fel rum, stängt rum, obehörig operatör, saknad session och inaktuellt paket nekas. Kör relevanta `game-entry`, `player-lobby`, `player-area`, `player-profile` och profil-API-tester.
**Risk:** URL-radering kan annars bryta sparade länkar eller av misstag ta bort launchens serverskydd.
**Bevis till status.json[J04]:** `head=<SHA>; routes=<gammal → ny/avvecklad>; test=<flöde + negativa fall>; PR=<URL>; review=<granskare>`.

## J05 — Förenkla runtime och byggkedja

**Etapp:** E2. **Beroenden:** J03, J04.
**Mål:** en begriplig produktkedja utan överflödiga UI-processer, API-proxyer eller alternativa starter.

- [ ] Rita aktuell requestkedja för varje kvarvarande API och mediaström: Vercel/Render → process → tjänst → lagring. Inventera externa och interna konsumenter före runtimebeslut.
- [ ] Utgå från att `ops/cloud/Dockerfile` faktiskt bygger Studio och `ops/cloud/config.mjs` startar dess Next-process. Bestäm vilka kvarvarande API:er som kräver den och flytta dem verifierat före eventuell avveckling.
- [ ] Uppdatera build/start, allowlists, health/version, graceful shutdown och miljökontrakt tillsammans; behåll nödvändiga HTTP/WS- och mediafunktioner.
**Startfiler:** `ops/cloud/Dockerfile`, `start.mjs`, `config.mjs`, `gateway.mjs`, `process-group.mjs`, `ops/cloud/vercel-ingress.mjs`, `packages/server-transport/configuration.mjs`, `apps/studio/start.mjs`, `apps/studio/next.config.mjs`.
**Radera:** bara verifierat ersatta processstarter, byggsteg, proxygrenar, flaggor och deras exklusiva tester/artefakter; förbrukade anslutna lokallägen ska inte återinföras.
**Klart/verifiera:** ren container-/byggkontroll och isolerat start/stop-prov; samtliga inventerade aktiva API:er, WS, auth och media har godkänt utfall. Kör berörda `ops/cloud/test` och transporttester. Redovisa före/efter antal processer och byggvägar utan påhittad prestandavinst.
**Risk:** Studio har serveransvar även när det äldre UI:t är borta; ett grönt frontendbygge bevisar inte att dessa konsumenter fungerar.
**Bevis till status.json[J05]:** `head=<SHA>; API-karta=<referens>; build/start/stop=<miljö/resultat>; PR=<URL>; review=<granskare>`.

## J06 — Rensa testlås och rikta CI

**Etapp:** E2. **Beroenden:** J03, J04, J05.
**Mål:** tester skyddar observerbara beteenden; CI kör rätt kontroller för ändringens risk och håller slutgrinden intakt.

- [ ] Koppla varje berört test till ett aktivt beteende. Ersätt relevanta importer/CSS-/stränglås med interaktions- eller kontraktprov; radera tester för avvecklade funktioner.
- [ ] Föreslå smalare CI-spår med en ändringsmatris för docs, klient, tjänst, schema, delat kontrakt och okänd sökväg; okända/riskbärande ändringar får inte hamna i ett för smalt spår.
- [ ] Bevara nödvändig full regression, typecheck, schema-readiness och säkerhetskontroll. Mät faktisk körningstid före/efter på jämförbar miljö om tidsbesparing rapporteras.
**Startfiler:** `apps/studio/client/admin/lib/workspace-tools.test.mjs`, `apps/studio/test/control-*.test.mjs`, `apps/web/test/`, `tools/ci-changes.mjs`, `precommit-checks.mjs`, `regression-group.mjs`, `.githooks/pre-commit-full`, `.github/workflows/croupier.yml`.
**Radera:** överflödiga assertions, tester och byggjobb med dokumenterad ersättning eller bevisat pensionerat ansvar; inga auth-, ekonomi-, samtidighets- eller spelregressioner tas bort för att bli gröna.
**Klart/verifiera:** testurvalsmatrisen täcker alla riskklasser; ett relevant fel når och fäller slutgrinden, och ett avvecklat UI krävs inte längre. Kör `test/ci-changes.mjs`, `test/precommit-checks.mjs`, `test/github-workflow.mjs` och berörda beteendetester.
**Risk:** en ändringsklassificerare kan missa indirekta kontrakt- eller schemaändringar; testa även blandade diffar och saknad/okänd bas.
**Bevis till status.json[J06]:** `head=<SHA>; urval=<matris>; test=<kommando/resultat>; mätning=<faktisk eller ej utförd>; PR=<URL>; review=<granskare>`.

## J07 — Postgres-adapter för delat bord

**Etapp:** E3. **Beroenden:** K03. Dess kontrakt bygger på K02/O01.
**Mål:** Kevins bordstjänst använder mains Postgres utan egen SQLite-, wallet- eller identitetsprodukt.

- [ ] Implementera O01/K03:s lagringsport med explicit transaktionsgräns, låsordning för bord/rum och berörda spelare, idempotensnycklar och sparad konfigurationsversion.
- [ ] Gör insats, saldo, bord/sko, resultat och journal atomiska. Skicka presentationshändelser först för committat utfall; retry, förlorat svar eller omstart får inte ge dubbla ekonomiska effekter.
- [ ] Bestäm och prova återstart/recovery och konfliktbeteende med samma kommando-ID samt med ändrad payload. Rum och operatörer får inte dela tillstånd genom fel nyckel.
**Startfiler:** `services/game/postgres-native-table.mjs`, `native-table.mjs`, `storage/postgres-store.mjs`, `packages/storage/server/postgres-store.mjs`, `ops/neon-game/`. Källjämförelse efter K01: `kevin/croupier-scoutgg/server/shared-table.mjs` och `transactions.mjs` på fryst Kevin-SHA.
**Radera:** ersatta SQLite-kopplingar och dubbla wallet-/transaktionsvägar ur den portade produktkedjan; lämna inte en tyst SQLite-fallback.
**Klart/verifiera:** isolerade PostgreSQL-prov med två samtidiga klienter: samma rum, olika rum, samma spelare, dubbelkommando, timeout, rollback och processomstart. Kontrollera exakt saldo/journal, inga dubbla utbetalningar och samma sparade bord efter återläsning.
**Tester:** utgå från `test/postgres-native-table.mjs`, `test/postgres-persistence.mjs` och K03:s adapterkontrakt; lägg bara till beteendeprov för de nya samtidighets- och recoveryfallen.
**Risk:** nuvarande spelarbaserade lås räcker inte automatiskt för ett delat bord; verifiera deadlock/retry och transaktionsägarskap. Krävd schemaversion följer migrations-readiness före merge.
**Bevis till status.json[J07]:** `head=<SHA>; schema=<version>; PG-prov=<isolerad miljö/utfall>; PR=<URL>; review=<granskare>`.

## J08 — Admin styr versionerad spelkonfiguration

**Etapp:** E4. **Beroenden:** J07, O01.
**Mål:** varje överenskommen spelinställning har en tydlig Admin-kontroll, validerad sparning och bestämd verkan i spelet.

- [ ] Följ O01:s fältmatris: UI-namn → kontraktsfält → scope → validator → writer → publicerad version → spelkonsument → verifiering. Odefinierade fält får beslut före implementation.
- [ ] Pröva Kevins nio kandidater i O01: språk per bord; logga/placering; insatsnivåer; rundtimers; lipsync-worker av/på med nyckelreferenser; RNG shoe-proof-rapport; wallet rollback; dealer → avatarpaket/workerURL; djuplänk dealer/bord. Klassificera varje som accepterad, senare eller avvisad med skäl. Kandidaterna är inte verifierade funktioner eller produktionsmandat.
- [ ] Mappa accepterat urval mot Kevins `dealer`, `room`, `felt`, `lang`, `limit`, `logo`, `layout` och mains talade repliker/idle. O01 bestämmer tillåtna värden, ansvar och verkan per aktiv/ny runda; ingen ny rollback-, worker- eller hemlighetshantering införs genom en UI-kontroll ensam.
- [ ] Bevara skillnaden mellan gemensam mall och `roomOverrides`. Spara med revision, publicera en sammanhängande konfiguration och följ O01:s policy för aktiv hand respektive ny session.
**Startfiler:** `apps/studio/client/admin/components/studio/`, `apps/studio/lib/studio-admin-api.mjs`, `studio-admin-contract.mjs`, `packages/presentation/server/saved-game-policy.mjs`, `packages/presentation/contracts/game-lanes.mjs`. Källjämförelse efter K01: `kevin/croupier-scoutgg/server/studio-tables.mjs`.
**Radera:** ersatta hårdkodade runtimevärden, dubbla formulär/skrivare och Kevin-filregistrets produktkoppling; portera nyttig validering till mains kontrakt.
**Klart/verifiera:** 100 % av O01:s accepterade fält har spårbarhet och ett giltigt/ogiltigt prov. Spara → återläs → publicera visar samma version; fel roll, fel rum och gammal revision nekas. K06 verifierar spelutfallet och omstart mot dessa kvitton.
**Risk:** sparat JSON bevisar inte att spelet använder värdet; konsument och effektiv version måste ingå i kvittot. Fel mellan mall/rum får inte påverka andra bolag. Hemligheter får inte exponeras i klartext-UI, Git eller Slack; endast godkända referenser används.
**Bevis till status.json[J08]:** `head=<SHA>; fältmatris=<referens>; version=<publiceringsprov>; test=<resultat>; PR=<URL>; review=<granskare>`.

## J09 — Förbered avveckling av oanvända databaskontrakt

**Etapp:** E4. **Beroenden:** J05, J07, J08, K05.
**Mål:** konkret oanvända tabeller/kontrakt har avvecklade konsumenter och en testad, granskbar migrerings- och återställningsordning.

- [ ] Inventera kandidater med samtliga läsare/skrivare, FK/index/views/triggers, bakgrundsjobb, backup/restore och publiceringshistorik. En tom tabell eller ett gammalt namn räcker inte.
- [ ] Avveckla kopplingarna i kod; upprätta exakt migrationsfil och versions-/readinesskrav. Dela expansion, tolerant kod och kontraktion om tidigare release behöver fortsätta fungera.
- [ ] Prova migration från stödd äldre version, avbrutet förlopp och återställning i isolerad Postgres. Jämför radantal/integritet och syntetiska konton, saldon, rättigheter och frysta paket före/efter.
**Startfiler:** `ops/neon-game/product-schema.sql`, `ops/neon-studio/migrations.mjs`, befintliga migrationsfiler, `apps/studio/lib/zone-cloud-schema.sql`, `packages/storage/server/postgres-store.mjs`, `tools/check-migration-readiness.mjs`, `tools/postgres-backup-restore.mjs`.
**Radera:** bevisat förbrukade kodläsare/skrivare, överflödiga fixtures och aktuella kontraktsreferenser. Produktionsradering av tabeller verkställs först i O03 med separat mandat; redan tillämpad migrationshistorik skrivs inte om.
**Klart/verifiera:** konsumentavveckling, migrationsfil, isolerad migration/restore och dokumenterad readiness/ordning är granskade. Kör relevanta migrations-, persistence- och restoretester. Kravet betyder inte att live-tabeller är borttagna eller att redan genomförd Neon/Blob-flytt återöppnas.
**Risk:** kodrollback kan vara inkompatibel med ändrat schema; verifiera återställning mot faktisk release-/schemakombination och bevara skyddad historik/media.
**Bevis till status.json[J09]:** `head=<SHA>; kandidater=<konsumentbevis>; migration/restore=<version, miljö, resultat>; liveDDL=ej utförd i aktiviteten; PR=<URL>; review=<granskare>`.

## J10 — Ren klon, start och återställning

**Etapp:** E5. **Beroenden:** J06, J09, K06. K07 kan gå parallellt med egna resurser; båda möts i O02.
**Mål:** kandidaten kan byggas, startas, återstartas och återställas från dokumenterade ingångar utan ignorerad lokal produktdata.

- [ ] Använd ren klon av fryst kandidat med låsfiler och verifierad Node; kopiera inga lokala databaser, mediaregister, cache/junctions eller hemligheter från arbetscheckouten.
- [ ] Tillför enbart dokumenterad isolerad konfiguration, godkända testresurser och explicit fixturedata. Inventera behov av ignorerad metadata snävt; skydda privata original och .ignore.
- [ ] Kör installation/build/start, ett relevant Admin → publicering → lobby → launch-flöde, omstart och kompatibel rollback/restore. Registrera ägarskap och stäng egna temporära processer/flikar när provet är färdigt.
**Startfiler:** `ops/cloud/Dockerfile`, `ops/cloud/start.mjs`, `apps/studio/start.mjs`, berörda package-/lockfiler, `tools/postgres-backup-restore.mjs`, [återställningsguiden](../../docs/ENVIRONMENT-RESTORATION.md) och [miljöregistret](../../docs/ENVIRONMENT-VARIABLES.md).
**Radera:** kvarvarande bevisat obehövliga byggrester, döda startinstruktioner och produktberoenden till lokala filer; rensa endast uppgiftsägda provresurser. För osäkra privata rester gäller avgränsad återhämtningsbedömning, ingen massrensning.
**Klart/verifiera:** en annan granskare kan upprepa den dokumenterade kedjan från samma SHA; inga dolda lokala läsare eller automatiska produktfallbacks används. Exakta schema-/releasepar för återställning finns. O02 gör oberoende integrerat samprov och O03 verifierar faktisk drift.
**Risk:** en lyckad utvecklarcheckout kan dölja saknade buildfiler eller lokala register; ren klon och separat miljö är beviset. Kvarvarande processer/portar och otestad rollback redovisas uttryckligen.
**Bevis till status.json[J10]:** `head=<SHA>; renklon=<kommando/miljö>; build/start/restart/restore=<utfall>; städning=<verifierat>; PR=<URL>; review=<granskare>`.
