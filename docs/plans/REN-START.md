# Ren start: radering i Neon och Blob

> **Plan. I repot är K1 och repo-PR 2 byggda, mergade och driftsatta (avsnitt 3); i Neon och Blob är inget utfört.** Underlaget lästes 28 oktober 2026 från `main` `5bed596d0a` och från produktionens Neon (`wandering-hill-60561912`, branch `br-flat-fog-b161a6r8`, databas `croupier_game`), bara med SELECT. Siffrorna ändras så fort Admin eller talet används; läs om dem omedelbart före start (avsnitt 3). Stagingen (`red-violet-36066351`) ingår inte, och dess bevisdata står kvar till O03.

## Beslut och avgränsning

**Behålls exakt (Jakob 27 oktober):**

- bolaget `johns-bet` och rummet `room-76640ca1-b619-7948-596e-3d102202b7d0`;
- dealern `paow`;
- paketrevision 1–11;
- spelinställningarna: head `room-config-4ad8301e-fbcd-4a42-8a0a-7fb791a85163` och den föregående `room-config-133cfffc-…`;
- de 53 klippen i headen: 15 godkända taltagningar, 35 giv-, hål- och revealklipp och 3 idle-klipp (de 3 idle-klippen saknades i uppdraget);
- bordet `f00be01d-…` och bakgrunderna `6daa1434-…` och `2c7feba2-…`;
- de auth-konton Jakob använder.

**Talkedjan behålls (Jakob 28 oktober).** AI-tal med läppsynk ska generaliseras till alla dealers, med Dragans rörliga tal som referens.

**Dragan: dealer, talbank och bindningar behålls som referens för generaliseringen; rum och bolag utöver Johns Bet kan tas bort bara om inget i talkedjan refererar dem (visa det).** Beviset finns i avsnitt 2, punkt 7.

Orörda är också:
- `services/moving-gpu-worker/**`;
- `CROUPIER_MOVING_SPEECH_ENABLED` och övriga talflaggor;
- `moving_drift_control`, `moving_speech_bindings` och `moving_speech_budget_amendments`;
- de generiska taltabellerna (`speech_requests`, `gpu_sessions`, `gpu_reservations`, `speech_execution_leases`, `fullfile_*`, budgetpolicyerna);
- de 12 genererade PAOW-svaren i `speech_reply_records`.

**Raderingskandidater:** Astrid (data, media och filer), dealerna i papperskorgen och bolagen utöver Johns Bet med deras rum, paket och media, med förbehållet ovan. Jakob prioriterar radering framför arkiv.

**Regeln i AGENTS.md** är ändrad enligt Jakobs beslut 28 oktober: Astrid, också hennes märkta legacy-referens, tas bort helt ([AGENTS.md](../../AGENTS.md#data-media-och-avveckling)).

## 1. Inventering

Scope `environment_id='production'`, `workspace_id='croupier'` (den enda i produktionen). JB = Johns Bet.

| Resurs (tabell) | Behålls | Raderingskandidater |
| --- | --- | --- |
| Bolag (`croupier_studio.operators`, 8) | `johns-bet` | Utan Dragan-koppling (6): `west-bet`, `paow-studio`, `godmorgon-bet` och `nordic-bet` (aktiva) samt `scoutgaming-demo` och `swedish-games` (avstängda). **`dragan-test`** är Dragans enda rum och kräver ett eget beslut (avsnitt 2, punkt 7). Inget bolag heter Astrid. |
| Rum (`documents` kind `administration`, 4 rum, samt `croupier_game.roulette_tables`) | JB-rummet | `room-a8ffcb55-…` (west-bet) och `room-65390c43-…` (paow-studio). `room-8bd056a2-…` (dragan-test) har eget beslut. Rouletterummen `room-1bc1b407-…` (nordic-bet) och `room-d685ca7b-…` (scoutgaming-demo). |
| Dealers (`documents` kind `project`) | `paow`, **`dragan`** (referens) | `astrid`. I papperskorgen (`dealerTrash`): `paow-kevin`, `anna-jonsson`, `adminprov-2026-10-13`, `jakob`, `ol-tjejjen` och `jacke`. Ingen post heter `dragge`; namnet förekommer bara i Dragans anteckningar. |
| Paketrevisioner (`operator_packages`, 47) | JB 11 (rev 1–11) | 21 för de 6 bolagen utan Dragan-koppling: swedish-games 7, paow-studio 5, west-bet 4, scoutgaming-demo 3, godmorgon-bet 2, nordic-bet 0. dragan-test har 15. |
| Utkast, roller, bolagslogg (`operator_branding_drafts` 10, `operator_roles` 24, `operator_audit_events` 79, `operator_memberships` 0) | JB 2, 3 och 15 | Alla bolag utom JB: 8, 21 och 64. Därav har dragan-test 4, 3 och 19. |
| Spelinställningar (`croupier_game.shared_table_configs` 2, `_heads` 1) | Alla (de är JB:s) | 0 |
| Media (`media_records`, 268) | JB-headens 53 (64 465 013 B) och dragan 65 (85,9 MB, referens) | astrid 10, varav 6 i retained bank (31,4 MB). paow-kevin 11 (14,8 MB) och anna-jonsson 2 (14,1 MB), båda arkiverade. **PAOW utan referens: 127 (110,2 MB, varav 22 godkända tal); Jakob avgör.** |
| Lager (`project.layerAssets` 21, `layerAssetTrash` 2) | 3 för JB; dessutom alla som Dragans sammansättning använder | Lager som varken JB eller Dragan använder (räknas om före steget). Papperskorgen: 2 (9,0 MB). |
| Runtime-katalog (`runtime_media_catalogs`, 1 rad, revision `9201007d…`) | Spelets och sajtens publika tillgångar: kortbaksida, bord, sko, marker, ljud och scen | Astrids bank: 51 presentationsposter, 524 Blob-rader (264,5 MB) och 17 legacy-JSON |
| Tal (`speech_reply_records` 12, `moving_speech_bindings` 44, `moving_speech_budget_amendments` 17, `speech_requests` 153, `gpu_sessions`/`gpu_reservations` 104/104, `speech_execution_leases` 2, `moving_drift_control` 1, läge `saving`, rev 13) | **Allt** | Inget |
| Dokument (`documents` 3, `document_history` 301 rader, 14,9 MB) | Dokumenten skrivs om men raderas aldrig | Historiken: 278 rader nämner astrid. Den spärrar inte radering. |
| Spel (`croupier_game`) | Spelare, saldon och transaktioner | `roulette_tables` 2 (S2), chattminne för astrid 6 (S5). **De 7 spelarna delas av alla bolag, och `transactions` (198) är plånbokens journal. Ingetdera raderas.** |
| Auth (`croupier_auth.users` 7, `tokens` 2, `bo_lab_handoffs` 1) | Konton Jakob använder | 1 superadmin och 6 admin, utan bolagsroller. Jakob pekar ut vilka som tas bort. Tokens och handoff har gått ut. |

**Blob per prefix**, enligt `media_records` och katalogens `blobIndex`:

| Prefix | Antal | Storlek | Hantering |
| --- | --- | --- | --- |
| `croupier/media/dealers/paow/review/` | 180 | 174,6 MB | 53 behålls (64,5 MB) |
| `dealers/dragan/` | 65 | 85,9 MB | Behålls |
| `dealers/astrid/` | 10 | 31,4 MB | Raderas |
| `dealers/paow-kevin/` | 11 | 14,8 MB | Raderas |
| `dealers/anna-jonsson/` | 2 | 14,1 MB | Raderas |
| `backgrounds/` | 13 | 43,6 MB | JB:s 2 behålls (7,4 MB) |
| `tables/` | 8 | 11,6 MB | JB:s 1 behålls (1,6 MB) |
| Katalogens `dealers/astrid/` | 524 | 264,5 MB | Raderas |

Dragans talbank (`CROUPIER_MOVING_SPEECH_BANK_RECORD`) och allt som talkedjan har skrivit, till exempel `runtime/generated/` och `runtime/conversation-replies/`, behålls. Objekt utan register hittas med en läsande listning av storen `store_AqwvebTbBHarOjvG` i steg 0.

**Repot.** PR:en för ren start (#474) tog bort 622 av Astrids 706 filer (88,4 MB). Repo-PR 2 (#488) tog bort de sista 84 (166,0 MiB): presentationsbanken `media/dealers/astrid/runtime/presentation/**` och `runtime/composited/astrid-green-speak/speak.json`. Samma PR tog bort spelets och sajtens media utan konsument (M1–M3, 11 filer, 11,2 MiB): `game/runtime/assets/table.png` och `room-extended.png`, `game/runtime/scene/dealer-fallback.png` och `scene.jpg`, `game/runtime/cards/back-scout.png` och `site/runtime/backoffice/img/` (6 filer). Produktionen läser katalogen ur Neon och byten ur Blob, inte ur repot, så raderingen påverkade inte driften. Admins legacyklippinventering tål att `review/astrid-green-speak/speak.json` saknas i katalogen (`packages/presentation/server/legacy-clip-inventory.mjs`, prov i `apps/studio/test/legacy-clip-policy.test.mjs`). Kvar i repot med levande konsumenter, utanför de 84: `astrid-look.mp4` och `astrid.jpg` (lobbyns och Admins porträtt), `astrid-card.mp4` och introfilmerna (startsidan) samt GPU-arbetarens bilder (talkedjan behålls); de hör till K2 och startsidans spår.

## 2. Korsreferenser som styr ordningen

1. **Allt delat ligger i två dokument.** `project` innehåller dealers, lines, lanes, lager och policyer. `administration` innehåller rummen och gameLanes. Kandidaterna försvinner när dokumenten skrivs om via Admin, aldrig med SQL. Dokumenten har revisionskontroll i appen, men databasen har inget motsvarande skydd.
2. **JB delar sammansättning och spelbana med andra bolag.** Sammansättningen `paow-studio-blackjack-e9a6193d-…` används också av paow-studios rum. Spelbanan `room-lane-dbd89b0595acafdbe5883208` används av rummen för JB, west-bet och paow-studio. Arkivera de andra rummen. Banorna står kvar så länge JB-rummet använder dem.
3. **Globala standardvärden.** `administration.gameLane` är Dragans `room-lane-fb6961b5b28bef3a30f09c1f` och står kvar så länge Dragans rum finns. Projektets översta `idlePolicy`, `mediaPolicy` och `clipLabels` pekar på Astrid; när Astrid läggs i papperskorgen flyttas hennes globala policyer dit.
4. **Paketspärren.** Permanent radering av en dealer stoppas med `studio_dealer_published` om dealer-id:t förekommer i någon paketrevision, också en historisk och också i den komprimerade presentationen (`apps/studio/lib/dealer-lifecycle.mjs:73`). För Astrid och dealerna i papperskorgen avgör `dealers/delete-check` frågan i steg 4. I JB:s rev 1–11 saknar de okomprimerade fälten `astrid` och `dragan`, och den avkodade rev 11 är ren. Rev 1–10 är inte avkodade.
5. **Retained bank.** De 6 Astrid-posterna (`croupier/media/dealers/astrid/runtime/retained-bank/…`) är oföränderliga i koden (`packages/studio-registry/server/storage-contract.mjs:83-118`) och spärrar Astrids radering med `studio_retained_media_immutable`. De går bara att ta bort med SQL (S3) och manuell Blob-radering. Proven `test/studio-repository.mjs` och `test/studio-retained-bank.mjs` kör mot minnespool och PGlite och påverkas inte.
6. **Runtime-katalogen är Astrids bank och spelets tillgångar i samma rad.** Före K1 godtog kontraktet (`packages/studio-registry/server/runtime-catalog.mjs`, `video-manifest.mjs`) bara Astrids 28 familjer under `dealers/astrid/runtime/presentation/` eller en helt tom katalog, och en tom katalog hade tagit bort kortbaksida, marker och ljud i produktionen. K1 godtar också spelets och sajtens tillgångar med tom presentation, och fortfarande den nuvarande katalogen med banken.
7. **Talkedjan och bolagen (beviset).** I talkedjan förekommer inget av de 7 bolags-id:na, rummen `room-8bd056a2`, `room-a8ffcb55`, `room-65390c43`, `room-1bc1b407` och `room-d685ca7b`, banan `room-lane-fb6961b5` eller sammansättningen `dragan-separat-taltest`. Det gäller i `moving_speech_bindings` (binding, media_references, project_revision), `speech_requests` (package_id, package_metadata, capability), `speech_reply_records`, `moving_drift_control` och `gpu_sessions`. Det enda undantaget är budget-id:t `dragan-test-20261017`, som står i alla 44 bindningar och 17 tillägg. Det är en konstant i `services/game/moving-speech-budget.mjs:15`, inte en nyckel till `operators`, och koden slår inte upp bolaget. Bolagen har alltså ingen datareferens från talkedjan. Funktionellt är dock `room-8bd056a2` (dragan-test, sammansättning `dragan-separat-taltest`) det enda publicerade rum som visar Dragan. Därför ska dragan-test, rummet och banan stå kvar tills Jakob har beslutat (S1b).
8. **En öppen GPU-session spärrar all medieradering.** En session i läget `reserved`, skapad 22 oktober 14:43 UTC, saknar `released_at_ms`. `inspectMediaDeletion` (`packages/studio-registry/server/repository.mjs:470`, kontrollen på rad 520–533) stoppar då varje permanent medieradering i miljön, också Astrids. Talkedjan ska inte röras med SQL. Sessionen släpps av produktens egen återhämtning (`sessions.reconcile()` när `croupier-v3` startar med rörligt tal på, eller av Taldrift-flödet). Om den inte släpps är det Jakobs beslut hur den ska stängas. Livslånga leases och oavslutade fullfile-förfrågningar finns inte i dag; 56 stream-förfrågningar `submission_uncertain` spärrar inte.
9. **Rörligt tal i drift.** Med `CROUPIER_MOVING_SPEECH_ENABLED=1` hashar `croupier-v3` Dragans talbank vid start (`services/game/server.mjs:1218-1240`, låst till Dragan på rad 1226). Banken raderas därför aldrig i ren start.
10. **Samma bytes under två dealers.** 8 av JB:s klipp har samma sha256 som arkiverade paow-kevin-poster, men sökvägarna skiljer sig, så att radera paow-kevins objekt påverkar inte paow.

## 3. Före start

**Kodförutsättningar.** Var och en levereras som en egen PR med grön CI och deploy enligt publiceringsordningen.

- **K1, katalog utan Astrid: byggd.** Kontraktet godtar en katalog med spelets och sajtens publika tillgångar och tom presentation (`source: 'scoutgaming-empty'`), och fortfarande produktionens nuvarande med banken (`9201007d…`); båda fallen har prov (`test/neon-runtime-catalog.mjs`, `test/runtime-media-catalog.mjs`, `test/runtime-media-import.mjs`, `apps/studio/test/neon-video-registry.test.mjs`). K1 (#480) och repo-PR 2 (#488) mergades tillsammans i `6ceb797af6` den 28 oktober; `build-lab-video-manifest --check` är struken ur `.githooks/pre-commit-full`, och `build-runtime-media-catalog --check` kontrollerar katalogen utan bank. Sedan #546 läser katalogbygget och Blob-exporten ingen bank från disk, arkivaliaset `emil/dealklipp-v1` är borta och det historiska migreringsverktyget `tools/migrate-media-layout.mjs` är raderat.
  - **Driftsatt före steg 6.** Vercel och `croupier-v3` måste köra en `main` som innehåller `6ceb797af6`. Det gjorde de vid kontrollen 28 oktober cirka 19 UTC: Vercels produktion `e83cd4819b` och `croupier-v3` (`/__cloud/version`) `6e9c8f4855`. Kontrollera igen före importen med `git merge-base --is-ancestor 6ceb797af6 <sha>`. Ingen ytterligare deploy krävs för steg 6.
  - **K1b, efter steg 6 och minst ett verifierat dygn.** Banken läses i produktionen tills katalogen är bytt: Admins videoregister listar dess 51 poster ur katalogen, och en återställning från backup-branchen (avsnitt 7) ger tillbaka en katalog med bank, som koden då måste godta. Därefter tas bankformatet bort i en egen PR, och konsumenterna följs först:
    - `runtime-catalog.mjs` godtar bara tom presentation; `validateLabVideoManifest` och `readLabVideoManifest` i `video-manifest.mjs`;
    - `registry-core.mjs`: bankläget (`presentationBankRoot`, `bankBlobIdentity`, familjeposterna "Astrid · …") och diskarkivlägena `archiveDir` och `snapshotPath`. De nås via provfixturen `apps/studio/test/fixtures/local-video-registry.mjs` men också via produktionsmodulen `services/game/storage/video-registry.mjs`, dit `services/game/presentation-api.mjs` skickar sina `registryOptions` (prov: `test/vercel-presentation-video-origin.mjs`). K1b följer den vägen och visar vilka alternativ motorn skickar innan lägena tas bort;
    - `PRESENTATION_BANK` i `media-layout.mjs`, `LAB_VIDEO_ARCHIVE` (`ops/cloud/config.mjs`, `container-entry.mjs`, miljöförteckningen), `tools/media/build-lab-video-manifest.mjs`, `apps/studio/schemas/lab-video-manifest.schema.json`, `test/fixtures/presentation-bank.mjs` och proven som bygger banker;
    - `ops/neon-studio/retained-bank.mjs` och `test/studio-retained-bank.mjs` efter S3;
    - ruttprefixen som bara den gamla katalogens adresser använde (`kevin-cards`, `bo`, `lab` i `packages/navigation/server/platform-routing.mjs` och `packages/studio-registry/server/media-runtime.mjs`), efter kontroll av övriga träffar;
    - familjedefinitionerna (`packages/presentation/runtime/media-families.mjs`) bara efter egen genomgång: uppladdningens intag (`video-intake.mjs`) och `clip-label.mjs` läser dem också. Det samordnas med K2.
- **K2, hårdkodat `'astrid'`.** Koden stänger säkert utan Astrid, men funktionerna blir döda eller visar fel:
  - granskningens standardval i `apps/studio/components/studio-administration.tsx:633,653`;
  - global `idlePolicy` som bara får ha familjen `astrid/idle.ready/ready` (`packages/studio-registry/server/studio-model.mjs:408,594`);
  - voicelines-rostern i `apps/studio/lib/studio-voice-lines.mjs:9`;
  - social chatt i `packages/director/social.mjs:5` och `apps/studio/lib/social-server.mjs:92`;
  - proben i `services/game/server.mjs:538,652,1289` och `storage/async-probe-runtime.mjs:64`;
  - Partner-API:ts standarddealer i `storage/async-partner-api.mjs:142-145`;
  - filbygget av tal i `packages/presentation/contracts/studio-speech.mjs:45`.

  Generaliseringen av talet berör samma ställen och samordnas med den.
- **K3, spelmotorns K04-katalog.** `services/game/games/blackjack/presentation/k04-media.tsv` är kod, inte Neon-data. Den har rader för astrid (65, "Astrid classic", märkt legacy), astrid2 (245), dragge (317), marten (299), paow (319), shared (21) och studio (27). Filen läses av `media-catalogue.mjs`, `material-revision.mjs` och `test/blackjack-presentation.mjs`. Kandidaternas rader rensas i en egen kodändring, som ska visa att paows materialrevision (`k04-material-revision/1`) och JB:s publicerade spelinställningar är oförändrade. Den ingår inte i Neon-raderingen.
- **K4 (valfritt), `DEMO_OPERATORS`.** `packages/operators/contracts/demo-operators.mjs` definierar förhandsfixturerna `demo-north`, `demo-south` och `sg-test`. De finns inte i Neon och är inte bolagen som ren start raderar. Fixturerna används av `apps/studio/lib/partner-preview-policy.mjs` och `services/game/public-operators.mjs` och låses av ett tiotal prov under `apps/studio/test/**`. Kontraktet tas bort bara om Jakob vill att partnerförhandsvisningen ska vara utan demobolag.
- **K05 klar** och K06-provet i staging opåverkat. Ren start är ett eget spår efter K05 (`docs/NEXT-AGENT.md`).

**Steg 0: backup och frysning.** Inget raderas innan allt detta är klart.

1. **Neon-branch:** skapa en branch från `br-flat-fog-b161a6r8` med Neon MCP `create_branch` (till exempel `backup-ren-start-<datum>`), eller ett snapshot med `create_snapshot`. Det kräver Jakobs ja. Anteckna branch-ID och LSN eller tidpunkt.
2. **pg_dump**, som Jakob kör lokalt mot den direkta anslutningen (inte poolern). Anslutningssträngen tas från Neon-konsolen och skrivs aldrig i Git eller chatt:
   ```sh
   pg_dump "$NEON_DIRECT_URL" --format=custom --no-owner --no-privileges \
     --schema=croupier_studio --schema=croupier_game --schema=croupier_auth \
     --file arkiv/<datum>/neon/croupier_game-fore-ren-start.dump
   pg_restore --list arkiv/<datum>/neon/croupier_game-fore-ren-start.dump | head
   ```
   Lägg dumpen under gitignorerad `arkiv/<datum>/` enligt `tools/retention-policy.json`.
3. **Blob:** Blob har ingen ögonblicksbild, och radering går inte att ångra.
   - Lista storen läsande (GET, med Blob-CLI eller token på Jakobs dator).
   - Spara sökvägar, storlek och sha256 för allt som ska raderas i `arkiv/<datum>/blob/ren-start-sokvagar.json`.
   - Ladda ned objekten om Jakob vill.
   - Blob raderas sist (steg 8).
4. **Exportera roulette (bara läsning).** Produktionens enda rouletterum försvinner med sitt bolag:
   - rummet "Anna · Roulette · Demo" (`room-d685ca7b-f52b-eb41-7cad-7b6f4e3c11ea`) hos bolaget `scoutgaming-demo`, arkiverat 16 oktober;
   - spelbanan `room-lane-2c36f04c114ccedb86297510` ("Anna · Roulette · Demorum");
   - sammansättningen `anna-roulette-demorum-fc7785ae-6747-4a5e-b229-04c1ce4247c4`;
   - dealern `anna-jonsson`, som ligger i papperskorgen;
   - bordet "Roulette · Anna · godkänt bord" (`7e31ab32-8074-4b63-b1bb-4e6bee772421`).

   Skriv JSON till gitignorerad `arkiv/<datum>/roulette-anna/`, en fil per fråga, så att roulette kan återskapas för JB eller ett annat bolag. Inget publiceras och ingen SQL skriver.
   ```sql
   -- R1 paket rev 1–3 (lanes, games, tables, branding med _scoutPresentation/_scoutLifecycle) och bolaget
   SELECT * FROM croupier_studio.operator_packages WHERE environment_id='production' AND workspace_id='croupier' AND operator_id='scoutgaming-demo' ORDER BY package_revision;
   SELECT * FROM croupier_studio.operators WHERE environment_id='production' AND workspace_id='croupier' AND operator_id='scoutgaming-demo';
   SELECT * FROM croupier_studio.operator_roles WHERE environment_id='production' AND workspace_id='croupier' AND operator_id='scoutgaming-demo';
   -- R2 projektets delar: papperskorgsposten (dealer, lines, idle-/mediaPolicy, compositions) och bordslagret
   SELECT e FROM croupier_studio.documents d, jsonb_array_elements(d.value->'dealerTrash') e WHERE d.environment_id='production' AND d.workspace_id='croupier' AND d.kind='project' AND e->'dealer'->>'id'='anna-jonsson';
   SELECT e FROM croupier_studio.documents d, jsonb_array_elements(d.value->'layerAssets') e WHERE d.environment_id='production' AND d.workspace_id='croupier' AND d.kind='project' AND e->>'id'='7e31ab32-8074-4b63-b1bb-4e6bee772421';
   -- R3 Annas media (2 klipp, 14,1 MB)
   SELECT id, revision, record FROM croupier_studio.media_records WHERE environment_id='production' AND workspace_id='croupier' AND record->>'pathname' LIKE 'croupier/media/dealers/anna-jonsson/%';
   -- R4 spelets tillstånd och kvitton (12 transaktioner)
   SELECT * FROM croupier_game.roulette_tables WHERE room_id='room-d685ca7b-f52b-eb41-7cad-7b6f4e3c11ea';
   SELECT id, player_id, type, amount, currency, meta, at FROM croupier_game.transactions WHERE meta LIKE '%room-d685ca7b-f52b-eb41-7cad-7b6f4e3c11ea%' ORDER BY at;
   ```
   Hämta också `GET /studio/api/admin/resource-lifecycle`, som visar det arkiverade rummet, och `GET /studio/api/admin/room-game-config?operatorId=scoutgaming-demo&roomId=room-d685ca7b-f52b-eb41-7cad-7b6f4e3c11ea`, om den svarar för ett arkiverat rum. Rouletten har inga rader i `shared_table_configs`; spelinställningarna finns i paketets presentation, som är brotli+base64url, och i livscykelposten, som är gzip+base64url. Avkoda dem lokalt och spara också den läsbara formen.

   Bytes ingår inte i JSON-exporten. Bordet `croupier/media/tables/7e31ab32-…/dde67a01….png` (1 079 892 B) och Annas 2 klipp ska därför hållas utanför steg 4 och 8 tills Jakob har valt mellan att ladda ned dem till `arkiv/<datum>/roulette-anna/` och att avstå. Bolaget `nordic-bet` har en rad i `roulette_tables` (`room-1bc1b407-…`) men inget paket. Den raden är en provrest och exporteras med R4-frågan, med det rummets id.
5. **Frys och anteckna:** JB:s paketrevision 11, head `4ad8301e…` och presentation-sha `058861ae…`, katalogrevisionen `9201007d…`, revisionerna för `project` och `administration`, talkedjans antal (44, 17, 153, 12 och drift rev 13) och antalen i avsnitt 1. Ingen använder Admin under fönstret.

## 4. Ordning

Följ konsumenterna först: route → UI → tjänst → adapter → data.
- Admin-vägarna kräver rollen `admin` och same-origin. Basen är `https://www.scoutgaming.tech/studio/api`.
- Talflaggorna och `croupier-v3`:s miljö ändras inte.
- Varje steg avslutas med kontrollerna i avsnitt 5.

| Steg | Vad | Väg | Spärr och förväntat utfall |
| --- | --- | --- | --- |
| 1 | **Arkivera rum** för west-bet och paow-studio | `POST /admin/room-lifecycle` (Admin → Rum → Arkivera), ett rum i taget med `expectedRevision`. Läs `GET /admin/resource-lifecycle` först. | JB-rummet är orört. Spelbanan `room-lane-dbd89b…` står kvar. |
| 2 | **Arkivera bolag** utan Dragan-koppling | `POST /admin/operator-lifecycle` med `archived:true` för west-bet, paow-studio, godmorgon-bet och nordic-bet. scoutgaming-demo och swedish-games är redan avstängda. | Varje bolag får en ny paketrevision. JB får ingen. |
| 3 | **SQL S1a: de 6 bolagen**, först när rouletteexporten (steg 0.4) är klar | Se nedan. | `operators` innehåller bara `johns-bet` och `dragan-test`. |
| 4 | **Dealers: papperskorg och permanent radering** | `POST /dealers/archive-check` och `/dealers/archive` för `astrid`. Efter 15 minuter `POST /dealers/delete-check` och sedan `/dealers/delete` för astrid och de 6 i papperskorgen. Kör S3 före Astrids `delete`. `anna-jonsson` raderas först efter rouletteexporten och Jakobs val om dess bytes (steg 0.4). | Spärras tills GPU-sessionen i avsnitt 2, punkt 8 är släppt. `delete` raderar dealerns klipp i Blob (`pending → Blob → deleted`; raden står kvar som gravsten) och sist papperskorgsposten. `studio_dealer_published` betyder att en kvarvarande paketrevision binder dealern; stoppa och rapportera. |
| 5 | **SQL S3: retained bank** | Se nedan. | Astrids 6 retained-poster är borta. |
| 6 | **Katalog utan Astrid** (steg 6 och 7 i en import, eftersom K1 och repo-PR 2 är mergade) | Med `ops/neon-studio/runtime-media-import.mjs`: `prepareRuntimeMediaImport` → `planRuntimeMediaImport` (läsande; ger `planHash` och `operation:'replace'`) → `applyRuntimeMediaImport({confirm:true})`, via körskriptet `ops/neon-studio/runtime-media-import-run.mjs` (se körinstruktionen under tabellen). | Katalogen får en ny revision utan presentationsbank, och `blobIndex` saknar `dealers/astrid/`. `/review/astrid-*`, `/lab/astrid-*`, `/dealers/astrid*` och M1–M3-adresserna (`/assets/table.png`, `/assets/room-extended.png`, `/scene.jpg`, `/dealer-fallback.png`, `/kevin-cards/back-scout.png`, `/bo/img/*`) ger 404, medan `/assets/cardback.png`, `/assets/chip-gold.png`, `/assets/shoe.png`, `/sfx/ambience.mp3` och `/speech-media.json` ger 200. Utöver Astrid och M1–M3 försvinner ingen publik adress (jämfört med produktionens katalog 28 oktober). |
| 7 | **Ingår i steg 6** | Källan på `main` saknar redan banken. Kodstädningen K1b (avsnitt 3) kommer först efter steg 6 och ett verifierat dygn. | Se steg 6. |
| 8 | **Blob**, sist och minst ett verifierat dygn efter steg 6 | Radera det från listan i steg 0 som Admin inte redan har raderat: retained-bank (6), katalogens `dealers/astrid/` (524), oregistrerade Astrid-objekt och lager som varken JB eller Dragan använder. Rouletterummets bord `7e31ab32-…` tas bara med efter Jakobs val i steg 0.4. Använd Blob-API med token på Jakobs dator, ett prefix i taget. Kör `HEAD` mot JB:s 53 klipp och 3 lager och mot Dragans bank före och efter. | JB:s och Dragans objekt ger 200. Inget under `dealers/dragan/` raderas. |
| 9 | **Valfritt**, bara efter Jakobs beslut | PAOW:s 127 klipp utan referens: `POST /videos/archive` → `/videos/delete-check` → `/videos/delete`, ett klipp i taget. Lager: `POST /admin/material-trash`; Blob-bytes tas i steg 8. Auth-konton: `POST /admin/users/remove`, aldrig sig själv eller sista admin. Dessutom S1b, S2, S5 och S6. | – |

**Körinstruktion, steg 6.** Skapa först en Neon-branch från `br-flat-fog-b161a6r8` omedelbart före körningen, som i steg 0.1; utan den körs inte steg 6. Kör sedan i Jakobs terminal från en ren checkout av exakt den `main`-SHA som ska importeras. Scope anges alltid uttryckligen. `prepare` läser ingen databas, `plan` läser bara och vägrar skriva över en tidigare plan, och `apply` skriver bara när `CROUPIER_RUNTIME_IMPORT_CONFIRM` är den granskade planens `planHash`. Utdata innehåller koder, hashar och antal, aldrig anslutningssträngen.

```powershell
$env:CROUPIER_STUDIO_ENVIRONMENT_ID = 'production'; $env:CROUPIER_STUDIO_WORKSPACE_ID = 'croupier'
node ops/neon-studio/runtime-media-import-run.mjs prepare
$env:CROUPIER_GAME_DATABASE_URL = '<från Neon-konsolen>'
node ops/neon-studio/runtime-media-import-run.mjs plan --out arkiv/<datum>/neon/katalog-plan.json
# Granska: operation 'replace', expectedRevision 9201007d…, revision som i prepare (3e09fe6e… på main e83cd4819b),
# counts layout 15, blobIndex 7, presentation 0, families 0, legacy 1.
$env:CROUPIER_RUNTIME_IMPORT_CONFIRM = '<planHash>'
node ops/neon-studio/runtime-media-import-run.mjs apply --plan arkiv/<datum>/neon/katalog-plan.json --actor jakob
Remove-Item Env:CROUPIER_RUNTIME_IMPORT_CONFIRM, Env:CROUPIER_GAME_DATABASE_URL
```

`apply` stoppas utan skrivning om källfilerna, scope, målet, migreringsledgern eller katalogens revision har ändrats sedan planen. **Ingen väg tillbaka via Git.** Produktionens katalog (`9201007d…`) går inte att återskapa exakt med import från Git: `5bed596d0a` har layoutens 760 rader men saknar körskriptet, och `a2898e0767`, som har både skriptet och banken, har 111. Vägen tillbaka är branchen från körinstruktionens första steg.

**SQL-fallback.** Kör varje block i en egen transaktion.
- Räkna med `SELECT count(*)` och samma villkor före `DELETE`.
- Gör `ROLLBACK` om något antal avviker från kommentaren.
- Neon MCP `run_sql_transaction` kräver Jakobs ja för varje block.
- Alla främmande nycklar är `NO ACTION` och inga triggers blockerar, så ordningen nedan är bindande.

```sql
-- S1a Bolag utan Dragan-koppling (efter steg 1–2). Förväntat: utkast 4, bolagslogg 45, medlemskap 0,
-- roller 18, paket 21, bolag 6.
BEGIN;
CREATE TEMP TABLE gone(operator_id text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO gone VALUES ('west-bet'),('paow-studio'),('godmorgon-bet'),('nordic-bet'),('scoutgaming-demo'),('swedish-games');
DELETE FROM croupier_studio.operator_branding_drafts t USING gone g WHERE t.environment_id='production' AND t.workspace_id='croupier' AND t.operator_id=g.operator_id;
DELETE FROM croupier_studio.operator_audit_events  t USING gone g WHERE t.environment_id='production' AND t.workspace_id='croupier' AND t.operator_id=g.operator_id;
DELETE FROM croupier_studio.operator_memberships   t USING gone g WHERE t.environment_id='production' AND t.workspace_id='croupier' AND t.operator_id=g.operator_id;
DELETE FROM croupier_studio.operator_roles         t USING gone g WHERE t.environment_id='production' AND t.workspace_id='croupier' AND t.operator_id=g.operator_id;
DELETE FROM croupier_studio.operator_packages      t USING gone g WHERE t.environment_id='production' AND t.workspace_id='croupier' AND t.operator_id=g.operator_id;
DELETE FROM croupier_studio.operators              t USING gone g WHERE t.environment_id='production' AND t.workspace_id='croupier' AND t.operator_id=g.operator_id;
SELECT operator_id FROM croupier_studio.operators;  -- johns-bet, dragan-test
COMMIT;

-- S1b dragan-test (bara efter Jakobs eget beslut och efter att Dragan har ett annat publicerat rum eller inte längre
-- behöver ett). Arkivera först rummet room-8bd056a2 och bolaget via Admin och byt administration.gameLane till JB:s bana.
-- Kör sedan S1a:s satser med gone = ('dragan-test'). Förväntat: utkast 4, bolagslogg 19, roller 3, paket 15, bolag 1.
-- Budget-id:t dragan-test-20261017 i talkedjan påverkas inte.

-- S2 Rouletterum för borttagna bolag (valfritt; saldon och transaktioner rörs inte). Förväntat: 2.
DELETE FROM croupier_game.roulette_tables WHERE operator_id IN ('nordic-bet','scoutgaming-demo');

-- S3 Astrids retained bank (före /dealers/delete för astrid). Förväntat: 6. Blob-objekten raderas i steg 8.
DELETE FROM croupier_studio.media_records
 WHERE environment_id='production' AND workspace_id='croupier' AND record ? 'retainedBank'
   AND record->>'pathname' LIKE 'croupier/media/dealers/astrid/runtime/retained-bank/%';

-- S5 Chattminne för Astrid (valfritt). Förväntat: 6.
DELETE FROM croupier_game.player_chat_memory_profiles WHERE dealer_id='astrid';

-- S6 Historik (valfritt, bara om Jakob uttryckligen vill tömma den). Förväntat: upp till 301.
-- DELETE FROM croupier_studio.document_history WHERE environment_id='production' AND workspace_id='croupier';
```

Följande raderas inte:
- `players`, `transactions` och saldon: plånbokens journal, som är bolagsoberoende;
- `audit_events`, `storage_migrations` och hela talkedjan (se Beslut och avgränsning);
- JB:s utkast, roller och bolagslogg;
- Dragans dealerpost, media och bank.

## 5. Verifiering efter varje steg och efter sista steget

1. **JB-kedjan, kontrollerad med SELECT:**
   - `operator_packages` har johns-bet rev 1–11 orörda, och rev 11 har presentation-sha `058861ae…`.
   - `shared_table_config_heads` för JB-rummet pekar på `room-config-4ad8301e…`.
   - De 53 media-ID:na i headen finns i `media_records` med samma sha256 och utan `deletion`: 15 `approved` tal, 35 klipp och 3 idle.
   - `HEAD` via de behöriga medievägarna ger 200 för de 53 klippen och de 3 lagren.
2. **Talkedjan är orörd:** `moving_speech_bindings` 44, `moving_speech_budget_amendments` 17, `speech_requests` 153 eller fler, `speech_reply_records` 12 och `moving_drift_control` med oförändrad revision, om inte talet har använts under tiden. Dragans 65 media saknar `deletion`, och Dragans bank svarar på `HEAD`.
3. **Drift:**
   - `https://croupier-v3.onrender.com/__cloud/health` och `/__cloud/version` ger 200.
   - `GET /api/operators` på motorn visar `johns-bet` och, tills S1b, `dragan-test`. Demofixturerna i `packages/operators/contracts/demo-operators.mjs` syns oavsett.
   - Dessa anrop svarar: `GET /studio/api/admin/resource-lifecycle`, `GET /studio/api/admin/room-game-config?operatorId=johns-bet&roomId=room-76640ca1-b619-7948-596e-3d102202b7d0` och `GET /studio/api/admin/presentation-room?operatorId=johns-bet&presentationLaneId=paow-studio-blackjack-e9a6193d-6bf3-4774-b505-538d6507bf3d`.
4. **Produkt:** `/lobby` visar JB-rummet, och `/game?game=blackjack` från lobbyn ger 200. Spela en hand och ladda om. Jakob bedömer tal och läppsynk; hash och provpass räknas inte.
5. **Rester:** `POST /dealers/delete-check` och `/videos/delete-check` hittar inga kvarvarande kandidatposter. Räkna om avsnitt 1.

## 6. Jakobs uttryckliga go, punkt för punkt

1. ~~Ändra regeln i AGENTS.md om Astrids legacy-referens.~~ Gjort i repo-PR 2 enligt beslutet 28 oktober.
2. Neon-branch eller snapshot (steg 0.1) och pg_dump (steg 0.2).
3. Blob-listning med token, och beslut om nedladdning eller ingen kopia (steg 0.3).
4. Arkivera rum och bolag för west-bet, paow-studio, godmorgon-bet och nordic-bet (steg 1–2).
5. S1a: radera 6 bolag med 21 paketrevisioner, efter rouletteexporten (steg 0.4). Dessförinnan: välj om rouletterummets bytes laddas ned (bordet `7e31ab32-…` och Annas 2 klipp) eller inte.
6. Hur den öppna GPU-sessionen från 22 oktober ska släppas, om produktens återhämtning inte gör det (avsnitt 2, punkt 8).
7. Permanent radering av dealerna, en i taget (steg 4), och S3 för retained bank.
8. Byte av produktionens runtime-katalog (steg 6, som också omfattar steg 7), med en ny Neon-branch omedelbart före.
9. Blob-radering per prefix (steg 8).
10. Var för sig:
    - S1b (dragan-test, dess rum och bana);
    - PAOW:s 127 klipp utan referens;
    - oanvända lager och papperskorgen för material;
    - vilka auth-konton som tas bort;
    - S2, S5 och S6.
11. Merge av K1b, K2 och eventuellt K4. K1, repo-PR 2 och K3 är mergade (#480, #488 och #545). Git-historiken (filter-repo) är ett separat beslut.

## 7. Återställning

- **Neon:** läs ur backup-branchen och skriv tillbaka exakta rader per tabell i omvänd ordning: bolag, paket, roller, utkast och logg. Alternativt `pg_restore --data-only --table=<tabell>` från dumpen till en tom kopia, följt av `INSERT … SELECT`. Hela branchen återställs med Neon `restore_snapshot` eller `reset_from_parent` bara efter Jakobs ja. Det skriver över allt som har hänt efter backupen, även talkedjans nya rader.
- **Admin-steg:** arkiverade rum och bolag återställs via samma livscykelväg med `archived:false`. Ett återställt rum kommer tillbaka som `pending`, aldrig live. Dealers i papperskorgen kan återställas i Admin fram till `delete`.
- **Katalogen:** går inte att importera exakt från Git (körinstruktionen för steg 6). Skriv tillbaka raden i `croupier_studio.runtime_media_catalogs` ur Neon-branchen som skapades omedelbart före steg 6. Koden godtar en katalog med bank fram till K1b.
- **Blob:** en raderad blob går inte att återställa utan en egen kopia. Därför kommer steg 8 sist, efter verifiering, och bara med Jakobs val i steg 0.3. En gravsten i `media_records` kan inte peka på bytes igen. Återimport ger en ny tillgång och kräver nytt audiovisuellt godkännande.
- **Repot:** Git-historiken innehåller alla raderade filer tills Jakob beslutar om filter-repo.
