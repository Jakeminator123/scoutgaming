# K05 mappning: Kevins media → Neon-ID → Blob → paket (2026-10-22)

Underlag för K05 enligt [AKTIVITETER.md](../AKTIVITETER.md) och rootens begäran i #312 (6329131459, 6329284466). Rättat enligt rootens granskning 6329902583 (punkterna 1-3 och rootbesluten, se avsnitt 4a, 4b, 6 och 7). Bara dokument och ett fristående valideringsskript. Ingen import, uppladdning, radering, DDL eller skrivning i Neon/Blob. Ingen Blob-hämtning. Den faktiska registreringen i avsnitt 7 är en plan och är **inte utförd**. Molnimport kräver separat auktorisation och eget kvitto.

| Bet. | Källa (fryst) | Används till |
| --- | --- | --- |
| K | `kevin-merge-admin` @ `5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc`, relativt `kevin/croupier-scoutgg/` | bytes per fil (git-blobbar), `dealers.js`, `meta.json`, `media-registry.mjs`, `runtime-event-links.js`, `media_omkodad_crf20_2026-09-25/manifest.json` |
| K-V1 | `c4818f51^` (föräldern till "Remove unused V1 dealer media") | de 28 raderade V1-filerna |
| C4 | `codex/kevin-k04-presentation` @ `e6287ea1ab653a7a9977c426447afc36b1bf3b14` | `presentation/media-catalogue.mjs`, `material-revision.mjs`, `k04-media.tsv` (sha256 `c5e164a7…f4`, = `K04/K04-medie-fack.tsv` `6c82fc4d…af` med sex JS-sökvägar normerade till `public/…`) |
| M | main @ `64e4c680a045eb3aed92043032fdbaa35e666359` | `material-catalog.mjs`, `package-rooms.mjs`, `docs/LOCAL-PRESENTATION-RUNTIME.md`, `media/blob-index.json`, `media/layout.json` |
| J08 | `codex/admin-room-config-j08` @ `f079ecd5` | rootens `room-game-material.mjs` (formen på `identityMap`) |
| N | Neon `croupier_game`, roll `kevin_migration_readonly`, läst 2026-10-22 00:07 UTC; Blob-pathnames och katalogens blobIndex lästa igen efter granskningen (samma roll, bara `SELECT`) | registermetadata, se avsnitt 2 och 4a |

Senare huvuden vid skrivtillfället (main `6bcf812e`, K04 `1148fa76`, J08 `9b43e3e7`) ändrar ingen av ovanstående filer (`git diff --stat` tomt för exakt dessa sökvägar, även `runtime-catalog.mjs`, `media-blob-index.mjs`, `private-media-contract.mjs` och `runtime-media-import.mjs` på main).

Leverans:
- [`K05-matris.tsv`](K05-matris.tsv): 1 321 rader (1 293 K04-rader + 28 V1-rader), 23 kolumner, sha256 `c024d9bc3664dbda7965c29afca6124c700a671b5065b03ad91366ddb1e06227`. Föregående version `08dea8ad…3cf9` (4fbd5467). Rättelsen ändrar bara 216 rader i kolumnerna `urval`, `status`, `acceptans`, `anmarkning` och för de sex JS-raderna även register-/katalogkolumnerna (`-`). Inga rader är borttagna; bytes, sha256 och gitblob är oförändrade.
- [`tools/validate-k05-manifest.mjs`](tools/validate-k05-manifest.mjs): validerar ett manifest mot matrisen. Ren Node, inget nätverk.

## Metod

1. **Oberoende bytehash.** Varje K04-rad hashades om från den frysta git-bloben (`git cat-file --batch` på `5aa7ed10:<sökväg>`, sha256 i Python). TSV-hashen används inte som observerat bevis. Resultat: 1 293/1 293 rader har samma sha256 och bytes som K04-katalogen. Inga ändrade hashar mellan K04 och den frysta källan.
2. **Neon.** Endast `SELECT` med uttryckliga kolumner på `croupier_studio.{media_records, runtime_media_catalogs, speech_reply_records, documents, operator_packages, operators, forge_dealers, forge_jobs}`. Inga `croupier_auth`-tabeller, inga spelar-/kontotabeller, ingen credentialkolumn. Paketens `branding` avkodades lokalt (gzip/brotli base64url) och varje payload verifierades mot sin egen `sha256` (16/16 rätt).
3. **Jämförelse.** Endast exakt sha256 plus bytestorlek. Namn, etikett, mapp och längd används aldrig som identitet. De förekommer bara som förklarande text.
4. **Urval.** "Vald" betyder K04:s `activationSet(dealer)` för språk en/sv (beslut 6328064364 p5) **minus** de 155 uppskjutna raderna (154 G13-repliker och Table Studio-hälsningen, granskning 6329902583 p2) och de sex JS-källfilerna (källbevis, inte runtimeidentitet, p3). Före rättelsen: 743 sökvägar, 0 differens mot den körda K04-modulen. Nu: 582 valda. Kontrollerat mot K04-modulen @ `1148fa76` med ändringen i avsnitt 4b tillämpad lokalt: alla tio dealer/språk-mängder är identiska med K05 (0 differens, union 582). K04 själv är ännu inte ändrad.

## 1. Sammanfattning

| | Rader | Anmärkning |
| --- | ---: | --- |
| Valda (en/sv, fem Kevin-dealers, utan uppskjutna och källbevis) | 582 | |
| — befintlig identitet (exakt sha256 + bytes i Neon) | 52 | 51 `media_records` (46 olika Neon-ID, alla i `review/uploads`, avsnitt 4a) + 1 katalogpost (`media/startbild.png`) |
| — ny post planerad (saknas i Neon) | 530 | 518 media (503 olika sha256, 471 355 053 bytes): 514 mp4 (499 sha256, 467 770 994 bytes) + 4 png-stillbilder (3 584 059 bytes); 12 JSON-dokument (84 916 bytes) |
| — ändrad/okänd hash | 0 | K04-katalog = fryst blob för alla rader |
| Uppskjutna (`uppskjuten`, finns kvar i K04:s aktiveringsmängd tills 4b är gjord) | 155 | 154 G13-repliker + `media/repliker/greeting_1.mp4`; 155 sha256, 76 896 982 bytes |
| Källbevis (`kallbevis`, versionsbundna JS-källfiler) | 6 | `public/dealers.js`, `public/idle-chain.js`, `public/dealer-card-tracks-{dragge,paow,astrid2,marten}.js` |
| Ej valda (pt/ko/es/fr/zh, Table Studio, ansikten, delade UI-/rumsbilder) | 550 | `media/cards/back-scout.png` har katalogidentitet men är ej vald |
| V1, avvisade (raderade i `c4818f51`) | 28 | 0 träffar i Neon, katalog eller main |

**Kontroll mot granskningens siffror.** Granskningen anger ny-medieplanen utan G13 som 519 rader / 504 sha256 / 472 098 193 bytes. Omräknat ur matrisen: exakt 519 / 504 / 472 098 193 när bara G13 tas bort. Granskningen ber också om att Table Studio-hälsningen ska vänta. Den har egna bytes (743 140, ingen delad sha256), så med båda uppskjutna blir planen **518 / 503 / 471 355 053**. Det är skillnaden, och K05 använder 518.

Per dealer (valda rader, befintlig/ny):

| Kevin-dealer | Registrerad dealer i Neon | Befintlig | Ny | Paket med befintliga |
| --- | --- | ---: | ---: | --- |
| dragge | `dragan` (belagt av 43 exakta hashar) | 43 (40 deal-tagningar, 3 sv-repliker) | 112 (108 mp4, 1 png, 3 JSON) | 40 rader i `dragan-test@1-6` och `swedish-games@3-6` |
| paow | `paow-kevin` (arkiverad i projektets `dealerTrash` 16/10) | 8 (pos1-7, posdealer bas) | 149 | inget paket |
| astrid2 | saknas | 0 | 105 | — |
| marten | saknas | 0 | 137 | — |
| astrid (classic) | saknas för Kevins bytes | 1 (startbild = mains `astrid_startbild_spel_1080x1920.png`) | 26 | — |
| shared (manifest.json) | dokument | 0 | 1 | — |

Ny media per dealer (rader / sha256 / bytes): dragge 109 / 109 / 93 823 047, paow 146 / 141 / 136 061 833, astrid2 103 / 98 / 116 626 639, marten 134 / 129 / 106 304 681, astrid 26 / 26 / 18 538 853. Ingen sha256 delas mellan dealers.

**Ingen vald post är bindbar i dag via rootens adapter.** `resolveRoomGameMaterial` kräver för varje post en `blobIndex`-rad (logicalPath) i den importerade runtimekatalogen. De 46 befintliga media-ID:na har bara `media_records` med Blob-pathname i `review/uploads` och ingen katalograd, och katalogen nekar `review/uploads`-objekt (avsnitt 4a). Valideringen i bindläge ger därför 0 godkända rader (avsnitt 6).

**Inget inspelat tal är godkänt.** De tre befintliga Dragan-replikerna (sv `goodluck_1`, `double_1`, `insurance_1`) har `recordedSpeech` med `recording: pending` och `review: pending`, kalibrering `kevin-original-mux-unreviewed-v1`. Rootens adapter kräver godkänt `recordedSpeechForVideo`.

## 2. Vad Neon har i dag (sammanfattning, inga hemligheter)

Allt ligger i `production` / `croupier`. Andra miljöer har inga rader i dessa tabeller.

- **`media_records`: 79 poster.** dragan 56, paow-kevin 11, astrid 10, anna-jonsson 2. Senast ändrad 2026-10-16 17:54 UTC. Varje post har `id` (UUID), `sha256`, `size`, `contentType`, `pathname` (privat Blob, `croupier/media/dealers/<dealer>/{review/uploads|runtime/retained-bank}/<uuid>/<sha256>.mp4`) och `classification` (dealerId, eventId, situation, role, label). Mot Kevin:
  - 46 poster = exakta bytes ur Kevins runtimeuppsättning vid 5aa7ed10 (38 dragan, 8 paow-kevin).
  - 6 poster = Kevins **utfasade** `idle-v2/{breath,glance,smile}` för dragge och paow. De finns kvar i 5aa7ed10 men nås inte av koden (K01). `Kevin V2 · andning` (`2f3955b0-b450-4cc2-a9f5-ac80f10abd2f`) är grundloop (`registeredDealers.idle`) i det levande Dragan-paketet och projektets talprofilreferens.
  - 1 post = **äldre bytes** för `dragge/repliker/sv/win_1.mp4`. Neon `efd551ec-a27c-4cb1-aff3-3848109df8fa` (694 471 bytes) är filen vid f15b2af1/315cfc55. Vid 5aa7ed10 är filen 287 921 bytes, `d5d71ff6…27ae9`. Det är en ändrad hash, så posten accepteras inte för Kevins rad.
  - 26 poster utan Kevin-bytes: Dragans standardtagningar `deal_pos1-7/poshole/posdealer` (10, varav `deal_pos4` två gånger), 2 idle, 2 `transition.shoe`, Astrids 10 (5 `retainedBank` från commit `365f283b`), Annas 2.
- **`runtime_media_catalogs`: 1 rad.** Revision `9201007d27c7b6464cbd905123c59b48608083a1af726ee9f896767e6e7bff20`, 2026-10-16 18:38 UTC. Innehåll: layout 760, blobIndex 542, presentation 51, legacy 18 JSON-original. `layout` är identisk med mains `media/layout.json`. Mains `blob-index.json` (985) är en övermängd av katalogens 542. Kevin-träffar: bara `media/startbild.png` och `media/cards/back-scout.png`. Inga Kevin-videor och inga av `media_records`-pathnames finns i blobIndex.
- **`speech_reply_records`: 12.** paow-v2 9, paow 3. Genererade samtalssvar med review `pending`, inga Kevin-bytes.
- **`forge_dealers`, `forge_jobs`:** 0 rader.
- **`operator_packages`: 16 revisioner.**
  - `dragan-test` 1-6: aktiv operatör, rum `room-8bd056a2-d5c5-a622-2766-faf75dbbcfa2` "Dragan · dynamiskt taltest", live. Lane `dragan-separat-taltest-413cea16-014d-4625-a613-4c6eeb5f693c`, dealer `dragan`.
    - Rev 6 har presentationshash `0c84601b…7c27` och projectRevision `studio-27792a59-…`.
    - Den fryser 38 media, varav 35 exakta Kevin-bytes, plus grundloopen ovan.
  - `swedish-games` 1-7 och `scoutgaming-demo` 1-3: suspenderade, arkiverade 16/10 via `_scoutLifecycle`.
  - `nordic-bet`: aktiv operatör utan paket.
- **`documents`:** `project`, `administration` (ett rum, ovan) och `social-policy`.
  - Projektets dealers är `astrid` och `dragan`.
  - `paow-kevin`, `anna-jonsson`, `jakob` och `adminprov-2026-10-13` ligger i `dealerTrash`.

## 3. Manifestmatrisen

`K05-matris.tsv`, en rad per Kevin-sökväg. Kolumnerna följer kedjan `käll-SHA/sökväg → hash → Neon-ID → Blob-identitet → paket/händelse → acceptans`:

| Kolumn | Innehåll |
| --- | --- |
| `kalla_sokvag`, `kalla_gitblob` | Kevin-sökväg (relativ `K/public`, eller `public/…` för JS) och git-blobens SHA-1 vid 5aa7ed10 (V1: `c4818f51^`) |
| `bytes`, `sha256`, `k04_lika` | oberoende hashat ur git-bloben; `ja` = lika med K04-katalogen |
| `kevin_dealer`, `k04_kalla`, `main_fack`, `kevin_variant`, `sprak`, `replik` | Kevins identitet: dealer, källtyp, mains fack, **Kevins variantnamn** (bas/i/u/iu/v/iv), språk, `<line>_<take>` |
| `urval` | `vald` eller `ej-vald:<skäl>` / `avvisad:V1` |
| `registrerad_dealer`, `neon_media_id`, `neon_fack`, `fack_overens` | befintlig Neon-post: dealerId, UUID, `eventId/situation` och om den stämmer med `main_fack` (51/51 `ja`) |
| `katalog_logicalPath`, `blob_identitet` | runtimekatalogens logicalPath (finns bara för 2 bilder) och Blob-pathname (ur `media_records` eller katalogens `storage.pathname`) |
| `paket`, `projekt` | operatör@revisioner som fryser Neon-ID:t; projektläge (`aktiv`, `arkiverad:<dealer>`) |
| `status`, `acceptans`, `anmarkning` | se nedan |

`status`:
- `befintlig-identitet`: exakt sha256 och bytes i en Neon-post. Acceptans = "identitet exakt; ej visuellt/talgodkänd".
- `ny-post-planerad`: ingen Neon-post. Acceptans = "ej accepterad (saknar registerpost)". Kolumnerna dealer, logicalPath och Blob är `planerad`. Inget UUID är påhittat.
- `ej-vald`: utanför urvalet, kan inte väljas.
- `v1-avvisad`: kan aldrig väljas.
- `uppskjuten`: urval `uppskjuten:G13` (154) eller `uppskjuten:table-studio` (1). Fil, rad och historik bevaras; raden registreras inte och får inte stå i en identitetskarta (`deferred`) förrän ett nytt beslut flyttar tillbaka den till `vald`.
- `kallbevis`: urval `kallbevis:versionsbunden` (6 JS-filer). Raden bevisar vilken källversion K04:s portade konstanter kommer från (5aa7ed10 + gitblob + sha256 + bytes). Den är ingen runtimeidentitet och får inte stå i en identitetskarta (`source_evidence_not_runtime`).
- `andrad-hash` finns som status men förekommer inte (0 rader).

**Identiteter som hålls isär.** Exempel ur matrisen och Neon:

| Begrepp | Exempel | Är inte |
| --- | --- | --- |
| Design-ID (M `material-catalog.mjs`) | `blackjack-green-felt`, sha `1a88e822…88b4` | ett Kevin-rum. Kevins `rooms-v2/*.png` har ingen sha-träff och är ej valda (parallell rumskatalog) |
| Uppladdad lager-UUID | `ca96f462-9dcd-4160-bb11-e898c2feb934` (privat bibliotek, samma design) | design-ID:t |
| Neon media-ID | `e4080094-6c4e-4746-a186-31c139a94b1c` = Kevin `dragge/v2/pos1-v.mp4` | Kevins variantnamn: posten säger bara `deal.player.left/box0`, role `alternative` |
| Blob-identitet | `croupier/media/dealers/dragan/review/uploads/e4080094-…/5cc61060…2621.mp4` | ett katalog-logicalPath (saknas) |
| Kevin-dealer / registrerad dealer | `dragge` / `dragan`, `paow` / `paow-kevin` | namnmatchning: kopplingen bärs av exakta hashar |
| Rum | `room-8bd056a2-d5c5-a622-2766-faf75dbbcfa2` (operatör `dragan-test`) | paketet |
| Fryst paket | `dragan-test@6`, presentationshash `0c84601b…7c27` | projektets aktuella urval |

**Bytedubbletter.** 15 sha256 bärs av 38 Kevin-sökvägar. Bland dragges befintliga är `hole.mp4` = `hole-u.mp4`, `hole-i` = `hole-iu`, och `flip` = `flip-i` = `flip-u` = `flip-iu`. Därför ger 40 deal-rader 35 Neon-ID. Samma Neon-ID får bära flera Kevin-varianter, men varianten (och därmed kortspår och kontaktruta) binds av identitetskartans `source.variant`, aldrig av Neon-facket eller posealiaset u→v (beslut 6328064364 p4).

**Saknas för dragge trots befintligt paket:** `pos1-7` och `posdealer` i `-u` och `-iu` (16 tagningar) samt alla 21 idle-tagningar i `v2/`. Neon har dem inte, så Kevins nuvarande vilokedja och REDO→VILA-tagningar kan inte väljas.

## 4. Accepterat, oaccepterat, avvisat och bevarat

- **Identitet accepterad för bindning (inte visuellt):** de 52 befintliga raderna. Byte-acceptansen gäller bara oförändrade bytes. Visuell, ljud- och lipsyncacceptans saknas för alla.
- **Oaccepterat:** 530 nya rader. Hit räknas även `dragge/repliker/sv/win_1.mp4` (äldre Neon-bytes, se 2).
- **Uppskjutet (granskning 6329902583 p2, grundfunktion först):** de 154 extra replikerna (`twentyone`, `remark`, `banter`, `greet_*`, `table_*`, G13; 22 per dealer och språk för dragge/paow/marten en+sv och astrid2 en) och Table Studio-hälsningen `media/repliker/greeting_1.mp4`. De har inga talfack i main. Raderna står kvar i matrisen med status `uppskjuten`; filerna och historiken hos Kevin rörs inte. De registreras inte, ingår inte i fullständighetskontrollen och nekas i en identitetskarta.
- **V1 avvisas:** de 28 filer som `c4818f51` raderade.
  - `dragge/green/*` (10 mp4)
  - `dragge/green-startbild.png`
  - `dragge/idle/*` (5 mp4 + `report.json`)
  - `dragge/{room,startbild}.png`
  - `dragge/timing.json`
  - `rooms/*` (8 bilder)

  Ingen av dem finns i Neon, katalogen eller main. De står i matrisen som `v1-avvisad`, och validatorn avvisar varje referens (`v1_reference`). Även `media_omkodad_crf20_2026-09-25/` (66 omkodade kopior plus egen manifest) saknas i urvalet. Ingen kod refererar mappen (K01), och dess `manifest.json` (18 097 bytes, sha256 `83c3c4613be50e1ab464985158a9d10377b8c1646c01f8f8ee47b0f3c1728b32`) pekar bara på mappens egna omkodade kopior. De är oregistrerade träningskopior och importeras inte. Ingen av mappens 66 mp4 har träff i Neon. Bara mappens `startbild.png` och `deal/kortpositioner.json` har samma bytes som mains Astrid-katalogposter.
- **Astrid classic** (Kevins v1-Astrid, `dealers.js:104`-reserven) bevaras enligt 6328064364 p5.
  - Hennes 27 nya rader och startbilden är valda.
  - Startbilden har samma bytes som mains Astrid-katalogpost.
  - Inga av hennes klipp eller rotrepliker finns i Neon. Mains `astrid` (10 poster, legacyreferens med eget `retainedBank`) är andra bytes.
  - Kevins Astrid classic ska inte registreras under mains `astrid` utan separat beslut. Reserven `pick()` → `astrid` får inte bli en tyst fallback i main.
- **Bevaras i main (ingen radering):**
  - alla 79 `media_records`, inklusive de 26 utan Kevin-bytes
  - de 6 utfasade Kevin-idle-v2 (en av dem är det levande Dragan-paketets grundloop)
  - den äldre `win_1`
  - Astrids `retainedBank`
  - katalogens 542 blobIndex-poster
  - alla 16 paketrevisioner

  Att en post saknas i Kevins urval ger ingen raderingsgrund.

## 4a. Katalogspärrar: `review/uploads`, JS-källfiler och PNG (granskning 6329902583 p3)

Mains katalog (`runtime-catalog.mjs:29-30`, `media-blob-index.mjs:7-8`) nekar varje blobIndex-rad vars `storage.pathname` ligger under `croupier/media/dealers/<dealer>/review/uploads/`. `legacy.entries` tar bara text som går att `JSON.parse` och vars bytes är exakt layoutradens (`runtime-catalog.mjs:37-43`, `runtime-media-import.mjs:43-60`). `MEDIA_MIME` har ingen JS-typ, så en `.js`-fil kan inte heller bli en privat blobIndex-rad. Spärrarna kringgås inte.

**Befintliga poster i `review/uploads`.** Läst i Neon (bara `SELECT`, `id`, `record->>'sha256'`, `record->>'size'`, `record->>'pathname'`, `record->'classification'->>'dealerId'` ur `croupier_studio.media_records`; `logicalPath`, `sha256`, `size`, `storage.pathname` ur katalogens blobIndex):

| | Antal |
| --- | ---: |
| `media_records` totalt | 79: dragan 56, paow-kevin 11, anna-jonsson 2, astrid 4 i `review/uploads`; astrid 6 i `runtime/retained-bank` |
| K05-rader med befintligt media-ID | 51 (46 ID, 46 sha256): dragan 43 rader, paow-kevin 8 rader, **alla i `review/uploads`** |
| av dessa med en runtimekopia (samma sha256 i `media_records` utanför `review/uploads` eller i katalogens 542 blobIndex-rader) | **0** |
| `media/startbild.png` | redan katalograd under `dealers/astrid/runtime/presentation/…` (ingen spärr) |

Ingen av de 51 raderna har alltså en verifierad befintlig runtimekopia. Varje rad kräver en **planerad, auktoriserad promotion med återhashning** (avsnitt 7 steg 2). Raderna har det i matrisens `acceptans`. Promotionen ändrar inte media-ID:t: J08-adaptern jämför bara `record.id`, `record.sha256` och `record.size` mot paketets frysta media och katalogens blobIndex-rad, inte Blob-pathname. Nya uppladdningar hamnar också i `review/uploads` (`studio-upload-service.mjs:64`, `upload-native-video.mjs:27`) och behöver samma promotion före katalogbindning.

**Källbevis och runtimeidentiteter, åtskilda.** De 18 dokumentraderna delas i två slag:

| Slag | Rader | Hur identiteten bärs |
| --- | --- | --- |
| Runtimeidentitet (JSON) | 12: `media/manifest.json`, 4 × `v2/meta.json`, 7 × `repliker/<en|sv>/texter.json` | layout + privat blobIndex-rad (`application/json`, runtimesökväg) + exakt text i `legacy.entries['media/<logicalPath>']`. Står i identitetskartan med `mediaId: null`. |
| Versionsbundet källbevis (JS) | 6: `public/dealers.js`, `public/idle-chain.js`, `public/dealer-card-tracks-{dragge,paow,astrid2,marten}.js` | bara matrisraden: Kevin-commit `5aa7ed10`, sökväg, gitblob, sha256, bytes. K04 binder samma version i varje revision genom `CATALOGUE_SOURCE.kevin` och `CATALOGUE_SOURCE.sha256`. Ingen katalograd, ingen identitetskarta. |

`READY_CONTACT` i K04 är redan portad ur `dealers.js` (avsnitt 5), och kortspåren läses inte i runtime från Kevins JS. Källbeviset styrker att portningen kommer från exakt den versionen; det gör inte JS-filen spelbar.

**PNG-stillbilder (4 × `v2/vila.png`, `media/startbild.png`).** Mediaregistret tar bara MP4/WebM, och inget video-ID hittas på. En stillbild binds bara genom katalogen: en layoutrad plus en privat blobIndex-rad (`image/png`) under `croupier/media/dealers/<dealer>/runtime/…/<uuid>/<sha256>.png`, samma mönster som Astrids `ZONE_REFERENCE_PATH` (`dealers/astrid/runtime/presentation/astrid_startbild_spel_1080x1920.png`, redan i katalogen). I identitetskartan har stillbilden `mediaId: null` och `speech: null`, precis som ett dokument. Ingen schemautökning beställs. Kvar hos root: J08-adaptern godtar i dag bara `data-beroende` utan media-ID och kräver ett paketmedia för alla andra källtyper, så `still`/`keyed-still` behöver adapterns katalogväg (blob-raden räcker, ingen legacy-text) innan en verklig bindning. Det är en ändring i rootens adapter, inte i registret.

## 4b. K04 måste justeras på samma sätt (PR #333, ändras inte här)

K04:s `activationSet` i `services/game/games/blackjack/presentation/media-catalogue.mjs:112-118` (@ `1148fa76`) är ursprunget till K05:s urval. Den innehåller fortfarande de 155 uppskjutna raderna, och `planningRevision` (`material-revision.mjs:82`) kräver alla rader i den som observerade hashar, även de sex JS-filerna. Eftersom J08 bara observerar hashar ur katalogens blobIndex kan JS-raderna aldrig observeras, och `planningRevision` nekar då varje Kevin-dealer (`media_set_not_verified`). Två ändringar behövs i PR #333:

1. **Uppskjutna rader ut ur aktiveringsmängden** (G13 = `replik` utan main-fack, Table Studio = källa `studio`):

   ```js
   export function activationSet(catalogue, dealer) {
     const lang = r => !r.language || LANGUAGES.includes(r.language);
     // Deferred (K05 / review 6329902583 p2): G13 lines without a main slot and the Table Studio greeting.
     const deferred = r => r.source === 'studio' || (r.source === 'replik' && !r.slot);
     return catalogue.filter(r => !deferred(r) && ((r.dealer === dealer && lang(r) && r.source !== 'face')
       || (r.dealer === 'shared' && r.source === 'data-beroende')
       || (dealer === 'astrid' && r.source === 'replik-rot' && r.language === 'en')));
   }
   ```

   Tar bort exakt 155 rader (dragge, paow, marten 44 vardera, astrid2 22, astrid 1). Ingen rad i `k04-media.tsv` tas bort.
2. **Källbevis ut ur den mängd som måste observeras i runtime**, i `planningRevision`:

   ```js
   const required = activationSet(catalogue, dealer).filter(r => !languageOf(r) || languageOf(r) === language)
     .filter(r => !r.path.startsWith('public/')); // version-bound source evidence, pinned by CATALOGUE_SOURCE
   ```

   `verifyActivation` kan behålla JS-raderna som lokal källkontroll (testet `test/blackjack-presentation.mjs:241-253` använder `public/dealer-card-tracks-dragge.js` så).

Kontroll: med båda ändringarna tillämpade lokalt på K04 @ `1148fa76` är den språkfiltrerade mängden lika med K05:s `plannedManifest` för alla tio dealer/språk (dragge 118/118, paow 120/120, astrid2 106/68, marten 100/100, astrid 28/17 för en/sv), 0 differens. Revisionshashen från `planningRevision` ändras, eftersom medielistan ingår i den; tidigare beräknade revisioner gäller inte efter ändringen.

## 5. Kontaktavvikelse dealers.js ↔ meta.json (beslut 6328762858)

`READY_CONTACT` i C4 `media-catalogue.mjs` är identisk med K `public/dealers.js` (`*_READY`, kontrollerat för alla fyra). `meta.json` `land` är en annan mätning. Klientens kontakt följer `dealers.js` plus rätt kortspår. Meta styr variantlängder. Ingen automatisk omtimning görs.

| Dealer | `in` (js/meta) | Spår | Avviker | Avvikelser `spår:js/meta` |
| --- | --- | ---: | ---: | --- |
| dragge | 27/27 | 18 | 17 | 1:29/25 2:27/25 3:27/24 4:24/23 5:26/23 6:27/22 7:33/28 dealer:35/27 flip:23/15 1v:36/26 2v:37/23 3v:37/25 4v:37/25 5v:35/21 6v:37/21 7v:37/19 dealerv:37/22 (bara `hole` lika) |
| paow | 21/21 | 18 | 17 | 1:28/26 2:33/26 3:27/23 4:27/24 5:26/22 6:27/24 7:28/22 dealer:37/23 flip:31/25 1v:34/25 2v:33/23 3v:31/22 4v:37/21 5v:31/19 6v:31/21 7v:34/20 dealerv:23/22 (bara `hole` lika) |
| astrid2 | 24/24 | 18 | 0 | — |
| marten | 24/24 | 18 | 17 | 1:28/25 2:28/26 3:27/24 4:25/22 5:26/22 6:30/21 7:33/24 dealer:34/20 flip:27/18 1v:26/22 2v:27/24 3v:36/23 4v:25/19 5v:34/19 6v:35/20 7v:33/19 dealerv:36/19 (bara `hole` lika) |

Båda ingår i identiteten men på olika sätt: meta.json är en runtimeidentitet (JSON-dokument i katalogen), och `dealers.js` och kortspåren är versionsbundna källbevis (avsnitt 4a).

## 6. Validator och negativa fall

`node migrering/kevin-ks-migrering/K05/tools/validate-k05-manifest.mjs --matrix <K05-matris.tsv> --manifest <m.json> [--mode plan|bind] [--language en|sv]`, eller `--selftest`. Manifestet har formen av rootens `identityMap` (`{operatorId, packageRevision, roomId, presentationLaneId, dealerId, sourceDealer, entries[{source{dealer,path,source,slot,variant,language,bytes,sha256}, logicalPath, mediaId, speech}]}`).

Regel för hela manifestet: `sourceDealer` måste vara en Kevin-dealer med valda rader i matrisen (dragge, paow, astrid2, marten, astrid). Okänd dealer, `shared` och registrerade namn som `dragan` ger `unknown_source_dealer` innan någon post prövas. Tidigare godtogs en okänd dealer med bara de tre delade dokumenten som komplett plan, eftersom fullständighetskontrollen då letade efter 0 egna rader (reproducerat mot 4fbd5467: `ok: true`; nu `unknown_source_dealer`).

Regler, i ordning per post:
1. Sökvägen måste finnas i matrisen. Annars `unknown_path`, även om bytes eller namn liknar en känd post.
2. V1 ger `v1_reference`, ändrad hash `changed_hash`, uppskjuten rad `deferred`, JS-källbevis `source_evidence_not_runtime`.
3. sha256 och bytes måste vara exakt lika (`hash_mismatch`, `bytes_mismatch`).
4. `dealer/source/slot/variant/language` måste vara exakt lika (`source_identity_mismatch`, vilket fångar posealias u→v).
5. Bara valda rader (`not_selected`) och bara manifestets `sourceDealer` eller `shared` (`source_dealer_mismatch`).
6. logicalPath krävs. Samma logicalPath får bara bära samma bytes (`logical_path_conflict`), och en befintlig katalogsökväg måste återanvändas.
7. Dokument har `mediaId` och `speech` null (`document_with_media_id`). Stillbilder (`still`, `keyed-still`) likaså (`still_with_media_id`); de binds bara via katalogen.
8. Befintlig registrerad dealer måste vara manifestets `dealerId` (`registered_dealer_mismatch`). Befintligt Neon-ID måste återanvändas exakt (`media_id_mismatch`). En planerad post får inte bära ett ID (`media_id_unregistered`).
9. Repliker kräver `speech` = `{lineId, takeId}` ur exakt `<line>_<take>` (`speech_identity_mismatch`).
10. Bindläge kräver dessutom Neon-ID för media (`identity_missing`) och katalogens logicalPath för media, dokument och stillbilder (`catalog_entry_missing`).
11. Med `--language`: hela den valda en/sv-mängden för dealern måste finnas (`incomplete_set`). Uppskjutna rader och källbevis ingår inte i mängden.

Körning (Node 22.22.0, `--selftest` mot den levererade matrisen): **36/36 fall som förväntat**, exit 0 (tidigare 26; 10 nya).

| Fall | Resultat |
| --- | --- |
| positivt, syntetisk fixture (alla identiteter ifyllda, inga riktiga ID:n): bind dragge/sv | ok, 118 poster |
| positivt: plan dragge/sv komplett / plan paow/en komplett / plan astrid/en komplett (startbild via katalog) | ok, 118 / 120 / 28 poster |
| sha256 ändrad / bytes ändrad | `hash_mismatch` / `bytes_mismatch` |
| `pos1-u` med variant `v` (posealias) | `source_identity_mismatch` |
| `pos1-u`-sökväg med `pos1-v`-bytes | `hash_mismatch` |
| V1 `dealers/dragge/green/…` | `v1_reference` |
| namnlik sökväg `dealers/dragan/v2/pos1.mp4` med samma bytes | `unknown_path` |
| pt-replik | `not_selected` |
| befintligt Neon-ID utelämnat / annan posts ID | `media_id_mismatch` |
| planerad post med påhittat ID / gammal `win_1`-post på ändrade bytes | `media_id_unregistered` |
| dubblett / repliktake ändrad / replik utan speech | `duplicate_entry` / `speech_identity_mismatch` ×2 |
| meta.json med media-ID | `document_with_media_id` |
| meta.json borttagen | `incomplete_set` |
| `dealerId: astrid` för dragges poster | `registered_dealer_mismatch` ×43 |
| paow-post i dragge-manifest | `source_dealer_mismatch` |
| logicalPath återanvänd för andra bytes | `logical_path_conflict` |
| okänd nyckel i manifestet / komplettering för pt | `manifest_shape` / `language_outside_en_sv` |
| **ny:** okänd `sourceDealer` med bara de tre delade dokumenten (granskningens repro) / med bara manifest.json | `unknown_source_dealer` / `unknown_source_dealer` |
| **ny:** `sourceDealer: shared` / `sourceDealer: dragan` (registrerat namn) | `unknown_source_dealer` / `unknown_source_dealer` |
| **ny:** känd dealer (dragge) med bara manifest.json, `--language sv` | `incomplete_set` |
| **ny:** `dealers.js`, `idle-chain.js`, dragges kortspår som poster | `source_evidence_not_runtime` ×3 |
| **ny:** G13 `twentyone_1` (sv) / Table Studio `greeting_1` i astrid/en | `deferred` / `deferred` |
| **ny:** `dragge/v2/vila.png` med media-ID | `still_with_media_id` |
| **verkligt läge**, bind dragge/sv i dag | nekas: `identity_missing` 71, `catalog_entry_missing` 47 |
| **verkligt läge**, bind bara dragges 43 befintliga | nekas: `catalog_entry_missing` 43 |

Verkligt läge per dealer och språk (planläge godkänt för alla; bindläge nekat för alla):

| | Poster (media / still / dokument) | Repliker | Med Neon-ID | Bind: `identity_missing` / `catalog_entry_missing` |
| --- | ---: | ---: | ---: | --- |
| dragge/sv | 118 (114 / 1 / 3) | 37 | 43 | 71 / 47 |
| dragge/en | 118 (114 / 1 / 3) | 37 | 40 | 74 / 44 |
| paow/en, paow/sv | 120 (116 / 1 / 3) | 37 | 8 | 108 / 12 |
| astrid2/en | 106 (102 / 1 / 3) | 37 | 0 | 102 / 4 |
| astrid2/sv | 68 (65 / 1 / 2) | 0 | 0 | 65 / 3 (inga sv-repliker; K04 nekar redan) |
| marten/en, marten/sv | 100 (96 / 1 / 3) | 37 | 0 | 96 / 4 |
| astrid/en | 28 (26 / 1 / 1) | 11 | 0 | 26 / 1 |
| astrid/sv | 17 (15 / 1 / 1) | 0 | 0 | 15 / 1 (inga sv-repliker) |

Validatorn ersätter inte rootens adapter. Den kontrollerar inte Blob-tillgänglighet, paketets innehåll eller talgodkännande. Den nekar bara poster vars identitet inte är exakt den granskade.

## 7. Registrerings- och importordning för plattformsägaren (root), INTE utförd

**Rootbeslut (6329902583), inarbetade här:**
- Planera dragge → `dragan` först, med uttryckligt rum och paket och ett **nytt granskat utkast**.
- Ingen automatisk återställning av `paow-kevin` ur `dealerTrash`, inga nya dealers eller rum, ingen ändring av den levande grundloopen (`Kevin V2 · andning` `2f3955b0-…` står kvar i `dragan-test`).
- Identiska bytes får dela media-ID. Exakt källväg och variant behålls i identitetskartan (`source.path`, `source.variant`). Olika `-u`/`-v`-bytes aliasas aldrig (validatorn: `hash_mismatch`, `source_identity_mismatch`).
- Astrid classic förblir en separat legacyreferens (registreras inte under mains `astrid`).
- Mårten är `PUBLIC_HIDDEN`.
- Faktisk molnregistrering kräver separat mål, separat mandat och återläsning. Inget steg nedan är utfört.

Därför planeras nu **bara dragge → `dragan`**. paow (kräver återställning eller ny dealer), astrid2 och marten (nya dealers), och Astrid classic (separat legacyreferens) planeras inte. Deras rader står kvar i matrisen som `ny-post-planerad` utan ordning och utan mandat.

Förutsättningar: uttryckligt mandat för molnskrivning; verifierad målidentitet (`production`/`croupier`, katalogrevision `9201007d…`); uttryckligt rum och paket: operatör `dragan-test`, rum `room-8bd056a2-d5c5-a622-2766-faf75dbbcfa2`, lane `dragan-separat-taltest-413cea16-…`, baserat på `dragan-test@6`, som ett nytt utkast (rev 7) som inte publiceras utan granskning. Rum och paket är rootens val; detta är det enda live-rummet för `dragan` och inget nytt rum skapas. Frysta indata: matrisen `c024d9bc…6227`, K04 `6c82fc4d…` (efter 4b ny K04-head), Kevin 5aa7ed10. Varje steg har plan → granskning → apply → återläsning och ett eget kvitto. Inget steg ändrar inspelade bytes eller befintliga poster.

0. **K04 justerad** enligt 4b och omgranskad, så att `planningRevision` kräver samma 118 rader som K05 för dragge en/sv.
1. **Dragges omfattning (sv och en).** 155 egna valda rader: 43 befintliga (40 deal-tagningar på 35 Neon-ID plus 3 sv-repliker på 3 ID, totalt 38 ID), 108 nya mp4 (108 sha256, 92 946 683 bytes), 1 ny png (`v2/vila.png`) och 3 nya JSON (`v2/meta.json`, `repliker/{en,sv}/texter.json`), plus delade `media/manifest.json`. Utanför: 44 uppskjutna G13 och 1 källbevis (`dealer-card-tracks-dragge.js`).
2. **Promotion av befintliga `review/uploads`-objekt (inget nytt media-ID).** För var och en av de 38 dragan-ID:n i dragges urval (av de 46): läs Blob-objektet i `review/uploads/<id>/<sha256>.mp4`, kontrollera sha256 och storlek mot posten, kopiera till en runtimesökväg under `croupier/media/dealers/dragan/runtime/…/<id>/<sha256>.mp4`, återläs och hasha kopian, och lägg sedan layout- och blobIndex-rad med exakt sha256/size. Det kräver ett eget auktoriserat promotionssteg; något sådant verktyg finns inte i main i dag. `review/uploads`-originalet och `media_records`-posten lämnas orörda.
3. **Nya medier för dragge.** Per fil: privat Blob-grant, uppladdning, sha256-återläsning, `media_records`-commit med klassificering ur matrisens `main_fack` och `dealerId: dragan`, därefter samma promotion som i steg 2. Samma bytes laddas upp en gång och får ett media-ID; varje Kevin-sökväg och variant står ändå som egen post i identitetskartan. Repliker får `recordedSpeech` med `pending`.
4. **Stillbild och dokument via katalogen.** `v2/vila.png` som layout + privat blobIndex-rad under `dealers/dragan/runtime/…` (ingen mediapost). JSON-dokumenten som layout + blobIndex + exakt text i `legacy.entries`. Steg 2-4 ger tillsammans en ny katalogrevision via `ops/neon-studio/runtime-media-import.mjs` (förberedelse → läsande plan → apply med mål/scope/revision). JS-källfilerna registreras inte.
5. **Talgranskning.** Inspelning och review per språk och take (människa) innan `recordedSpeechForVideo` godtar posten. Skilt från registreringen.
6. **Nytt paketutkast (J08).** Välj media i projektet för `dragan`, bygg utkastet `dragan-test@7` utan att ändra `registeredDealers.idle`. Bygg `identityMap` och kör `validate-k05-manifest.mjs --mode bind --language <en|sv>` (ska ge ok), därefter rootens `resolveRoomGameMaterial` med K04 `planningRevision`. J08 behöver dessförinnan katalogvägen för stillbilder (avsnitt 4a). Publicering är ett eget beslut.
7. **Kvitton, åtskilda.** Registreringsbevis (Neon-återläsning, katalogrevision), Blob-återläsning per promotion och uppladdning (sha256), visuell granskning (oförändrade bytes i rätt rum och paket). Inga befintliga poster raderas eller skrivs över. V1, omkodade kopior, ej valda språk, uppskjutna rader och källbevis importeras inte.

## 8. Öppna frågor till root

Besvarade av 6329902583: rum/paket (dragan-test, nytt utkast), Paow (ingen automatisk återställning), bytedubbletter (ett media-ID per sha256, varianten i kartan), Table Studio-hälsningen (uppskjuten, K04 enligt 4b), grundloopen (orörd).

1. Vem bygger promotionssteget `review/uploads` → `runtime/` (avsnitt 7 steg 2), och vilken undermapp under `runtime/` ska användas?
2. Tar J08-adaptern in katalogvägen för `still`/`keyed-still` (blob-rad, `mediaId: null`) i samma våg, eller väntar `vila.png` tills dess?
