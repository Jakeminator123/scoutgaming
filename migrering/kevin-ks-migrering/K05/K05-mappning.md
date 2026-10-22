# K05 mappning: Kevins media → Neon-ID → Blob → paket (2026-10-22)

Underlag för K05 enligt [AKTIVITETER.md](../AKTIVITETER.md) och rootens begäran i #312 (6329131459, 6329284466). Bara dokument och ett fristående valideringsskript. Ingen import, uppladdning, radering, DDL eller skrivning i Neon/Blob. Ingen Blob-hämtning. Den faktiska registreringen i avsnitt 7 är en plan och är **inte utförd**. Molnimport kräver separat auktorisation och eget kvitto.

| Bet. | Källa (fryst) | Används till |
| --- | --- | --- |
| K | `kevin-merge-admin` @ `5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc`, relativt `kevin/croupier-scoutgg/` | bytes per fil (git-blobbar), `dealers.js`, `meta.json`, `media-registry.mjs`, `runtime-event-links.js`, `media_omkodad_crf20_2026-09-25/manifest.json` |
| K-V1 | `c4818f51^` (föräldern till "Remove unused V1 dealer media") | de 28 raderade V1-filerna |
| C4 | `codex/kevin-k04-presentation` @ `e6287ea1ab653a7a9977c426447afc36b1bf3b14` | `presentation/media-catalogue.mjs`, `material-revision.mjs`, `k04-media.tsv` (sha256 `c5e164a7…f4`, = `K04/K04-medie-fack.tsv` `6c82fc4d…af` med sex JS-sökvägar normerade till `public/…`) |
| M | main @ `64e4c680a045eb3aed92043032fdbaa35e666359` | `material-catalog.mjs`, `package-rooms.mjs`, `docs/LOCAL-PRESENTATION-RUNTIME.md`, `media/blob-index.json`, `media/layout.json` |
| J08 | `codex/admin-room-config-j08` @ `f079ecd5` | rootens `room-game-material.mjs` (formen på `identityMap`) |
| N | Neon `croupier_game`, roll `kevin_migration_readonly`, läst 2026-10-22 00:07 UTC | registermetadata, se avsnitt 2 |

Senare huvuden vid skrivtillfället (main `6bcf812e`, K04 `1148fa76`) ändrar ingen av ovanstående filer (`git diff --stat` tomt för exakt dessa sökvägar).

Leverans:
- [`K05-matris.tsv`](K05-matris.tsv): 1 321 rader (1 293 K04-rader + 28 V1-rader), 23 kolumner, sha256 `08dea8ad55964df0e41e9ae62640941ef0f9163cd0c233f216e11a3d7c063cf9`.
- [`tools/validate-k05-manifest.mjs`](tools/validate-k05-manifest.mjs): validerar ett manifest mot matrisen. Ren Node, inget nätverk.

## Metod

1. **Oberoende bytehash.** Varje K04-rad hashades om från den frysta git-bloben (`git cat-file --batch` på `5aa7ed10:<sökväg>`, sha256 i Python). TSV-hashen används inte som observerat bevis. Resultat: 1 293/1 293 rader har samma sha256 och bytes som K04-katalogen. Inga ändrade hashar mellan K04 och den frysta källan.
2. **Neon.** Endast `SELECT` med uttryckliga kolumner på `croupier_studio.{media_records, runtime_media_catalogs, speech_reply_records, documents, operator_packages, operators, forge_dealers, forge_jobs}`. Inga `croupier_auth`-tabeller, inga spelar-/kontotabeller, ingen credentialkolumn. Paketens `branding` avkodades lokalt (gzip/brotli base64url) och varje payload verifierades mot sin egen `sha256` (16/16 rätt).
3. **Jämförelse.** Endast exakt sha256 plus bytestorlek. Namn, etikett, mapp och längd används aldrig som identitet. De förekommer bara som förklarande text.
4. **Urval.** "Vald" betyder exakt K04:s `activationSet(dealer)` för språk en/sv (beslut 6328064364 p5), kontrollerat mot den körda K04-modulen: 743 sökvägar, 0 differens.

## 1. Sammanfattning

| | Rader | Anmärkning |
| --- | ---: | --- |
| Valda (en/sv-aktiveringsmängd, fem Kevin-dealers) | 743 | |
| — befintlig identitet (exakt sha256 + bytes i Neon) | 52 | 51 `media_records` (46 olika Neon-ID) + 1 katalogpost (`media/startbild.png`) |
| — ny post planerad (saknas i Neon) | 691 | 673 media (658 olika sha256, 548 252 035 bytes; 669 mp4 + 4 png) och 18 dokument |
| — ändrad/okänd hash | 0 | K04-katalog = fryst blob för alla rader |
| Ej valda (pt/ko/es/fr/zh, Table Studio, ansikten, delade UI-/rumsbilder) | 550 | `media/cards/back-scout.png` har katalogidentitet men är ej vald |
| V1, avvisade (raderade i `c4818f51`) | 28 | 0 träffar i Neon, katalog eller main |

Per dealer (valda rader, befintlig/ny):

| Kevin-dealer | Registrerad dealer i Neon | Befintlig | Ny | Paket med befintliga |
| --- | --- | ---: | ---: | --- |
| dragge | `dragan` (belagt av 43 exakta hashar) | 43 (40 deal-tagningar, 3 sv-repliker) | 157 | 40 rader i `dragan-test@1-6` och `swedish-games@3-6` |
| paow | `paow-kevin` (arkiverad i projektets `dealerTrash` 16/10) | 8 (pos1-7, posdealer bas) | 194 | inget paket |
| astrid2 | saknas | 0 | 128 | — |
| marten | saknas | 0 | 182 | — |
| astrid (classic) | saknas för Kevins bytes | 1 (startbild = mains `astrid_startbild_spel_1080x1920.png`) | 27 | — |
| shared (manifest.json, dealers.js, idle-chain.js) | dokument | 0 | 3 | — |

**Ingen vald post är bindbar i dag via rootens adapter.** `resolveRoomGameMaterial` kräver för varje post en `blobIndex`-rad (logicalPath) i den importerade runtimekatalogen. De 46 befintliga media-ID:na har bara `media_records` med Blob-pathname och ingen katalograd. Valideringen i bindläge ger därför 0 godkända rader (avsnitt 6).

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
- **Oaccepterat:** 691 nya rader. Hit räknas även `dragge/repliker/sv/win_1.mp4` (äldre Neon-bytes, se 2). Alla 154 valda extra repliker (`twentyone`, `remark`, `banter`, `greet_*`, `table_*`, G13) ligger i K04:s aktiveringsmängd men har inga talfack i main. De är markerade "frågepott" och ska inte registreras före beslut.
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

## 5. Kontaktavvikelse dealers.js ↔ meta.json (beslut 6328762858)

`READY_CONTACT` i C4 `media-catalogue.mjs` är identisk med K `public/dealers.js` (`*_READY`, kontrollerat för alla fyra). `meta.json` `land` är en annan mätning. Klientens kontakt följer `dealers.js` plus rätt kortspår. Meta styr variantlängder. Ingen automatisk omtimning görs.

| Dealer | `in` (js/meta) | Spår | Avviker | Avvikelser `spår:js/meta` |
| --- | --- | ---: | ---: | --- |
| dragge | 27/27 | 18 | 17 | 1:29/25 2:27/25 3:27/24 4:24/23 5:26/23 6:27/22 7:33/28 dealer:35/27 flip:23/15 1v:36/26 2v:37/23 3v:37/25 4v:37/25 5v:35/21 6v:37/21 7v:37/19 dealerv:37/22 (bara `hole` lika) |
| paow | 21/21 | 18 | 17 | 1:28/26 2:33/26 3:27/23 4:27/24 5:26/22 6:27/24 7:28/22 dealer:37/23 flip:31/25 1v:34/25 2v:33/23 3v:31/22 4v:37/21 5v:31/19 6v:31/21 7v:34/20 dealerv:23/22 (bara `hole` lika) |
| astrid2 | 24/24 | 18 | 0 | — |
| marten | 24/24 | 18 | 17 | 1:28/25 2:28/26 3:27/24 4:25/22 5:26/22 6:30/21 7:33/24 dealer:34/20 flip:27/18 1v:26/22 2v:27/24 3v:36/23 4v:25/19 5v:34/19 6v:35/20 7v:33/19 dealerv:36/19 (bara `hole` lika) |

Båda dokumenten ingår i identiteten: meta.json och kortspåren är egna rader i matrisen (`data-beroende`, nya dokumentposter).

## 6. Validator och negativa fall

`node migrering/kevin-ks-migrering/K05/tools/validate-k05-manifest.mjs --matrix <K05-matris.tsv> --manifest <m.json> [--mode plan|bind] [--language en|sv]`, eller `--selftest`. Manifestet har formen av rootens `identityMap` (`{operatorId, packageRevision, roomId, presentationLaneId, dealerId, sourceDealer, entries[{source{dealer,path,source,slot,variant,language,bytes,sha256}, logicalPath, mediaId, speech}]}`).

Regler, i ordning per post:
1. Sökvägen måste finnas i matrisen. Annars `unknown_path`, även om bytes eller namn liknar en känd post.
2. V1 ger `v1_reference`, ändrad hash `changed_hash`.
3. sha256 och bytes måste vara exakt lika (`hash_mismatch`, `bytes_mismatch`).
4. `dealer/source/slot/variant/language` måste vara exakt lika (`source_identity_mismatch`, vilket fångar posealias u→v).
5. Bara valda rader (`not_selected`) och bara manifestets `sourceDealer` eller `shared` (`source_dealer_mismatch`).
6. logicalPath krävs. Samma logicalPath får bara bära samma bytes (`logical_path_conflict`), och en befintlig katalogsökväg måste återanvändas.
7. Dokument har `mediaId` och `speech` null (`document_with_media_id`).
8. Befintlig registrerad dealer måste vara manifestets `dealerId` (`registered_dealer_mismatch`). Befintligt Neon-ID måste återanvändas exakt (`media_id_mismatch`). En planerad post får inte bära ett ID (`media_id_unregistered`).
9. Repliker kräver `speech` = `{lineId, takeId}` ur exakt `<line>_<take>` (`speech_identity_mismatch`).
10. Bindläge kräver dessutom Neon-ID (`identity_missing`) och katalogens logicalPath (`catalog_entry_missing`).
11. Med `--language`: hela en/sv-mängden för dealern måste finnas (`incomplete_set`).

Körning (Node 22.22.0, `--selftest` mot den levererade matrisen): **26/26 fall som förväntat**, exit 0.

| Fall | Resultat |
| --- | --- |
| positivt, syntetisk fixture (alla identiteter ifyllda, inga riktiga ID:n): bind dragge/sv | ok, 143 poster |
| positivt: plan dragge/sv komplett / plan paow/en komplett | ok, 143 / 145 poster |
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
| **verkligt läge**, bind dragge/sv i dag | nekas: `identity_missing` 94, `catalog_entry_missing` 49 |
| **verkligt läge**, bind bara dragges 43 befintliga | nekas: `catalog_entry_missing` 43 |

Verkligt läge per dealer och språk (planläge godkänt för alla; bindläge nekat för alla):

| | Poster | Repliker | Med Neon-ID | Bind: `identity_missing` / `catalog_entry_missing` |
| --- | ---: | ---: | ---: | --- |
| dragge/sv | 143 | 59 | 43 | 94 / 49 |
| dragge/en | 143 | 59 | 40 | 97 / 46 |
| paow/en, paow/sv | 145 | 59 | 8 | 131 / 14 |
| astrid2/en | 131 | 59 | 0 | 125 / 6 |
| astrid2/sv | 71 | 0 | 0 | 66 / 5 (inga sv-repliker; K04 nekar redan) |
| marten/en, marten/sv | 125 | 59 | 0 | 119 / 6 |
| astrid/en | 31 | 11 | 0 | 28 / 3 |
| astrid/sv | 19 | 0 | 0 | 16 / 3 (inga sv-repliker) |

Validatorn ersätter inte rootens adapter. Den kontrollerar inte Blob-tillgänglighet, paketets innehåll eller talgodkännande. Den nekar bara poster vars identitet inte är exakt den granskade.

## 7. Registrerings- och importordning för plattformsägaren (root), INTE utförd

Förutsättningar: uttryckligt mandat för molnskrivning, verifierad målidentitet (`production`/`croupier`, katalogrevision `9201007d…`, paket `dragan-test@6` eller annat utpekat), och frysta indata (matrisens sha256 ovan, K04 `6c82fc4d…`, Kevin 5aa7ed10). Varje steg har plan → granskning → apply → återläsning och ett eget kvitto. Inget steg ändrar inspelade bytes eller befintliga poster.

0. **Beslut före start.**
   - Registrerad dealer per Kevin-dealer: dragge→`dragan` (belagt), paow→`paow-kevin` (återställa från `dealerTrash`?) eller ny. astrid2 och marten nya. Astrid classic separat från mains `astrid`.
   - G13-replikerna (vänta).
   - Hur bytedubbletter får separata variant-ID:n i paketet (en mediepost per sha256 eller per Kevin-variant).
   - Hur dokument (meta.json, kortspår, texter.json, manifest.json, dealers.js, idle-chain.js) registreras i katalogen (legacy + blobIndex).
   - PNG i mediaregistret: 001-008 tillåter bara MP4/WebM (4 `vila.png`).
1. **Katalograder för befintliga Blob-objekt (ingen uppladdning).** 46 `media_records` får blobIndex-/layoutrader med exakt pathname, sha256 och storlek. Läs Blob och kontrollera sha256 före plan. Görs via `ops/neon-studio/runtime-media-import.mjs` (förberedelse → läsande plan → apply med mål/scope/revision) och ger ny katalogrevision.
2. **Dokumentidentiteter.** 18 nya dokument: exakta bytes till katalogens `legacy.entries` och blobIndex, så att `planningRevision` får hashkontrollerade timingdokument.
3. **Nya medier per dealer, i ordning dragge → paow → astrid2 → marten → Astrid classic.**
   - Omfattning: 673 rader / 658 unika sha256 / 548 252 035 bytes, utan G13 om beslut 0 håller dem utanför.
   - Per fil: privat Blob-grant, uppladdning, sha256-återläsning, sedan en `media_records`-commit med klassificering ur matrisens `main_fack`.
   - Kevins variantnamn hålls i identitetskartan.
   - Repliker får `recordedSpeech` med `pending`. Samma bytes laddas upp en gång.
4. **Talgranskning.** Inspelning och review per dealer/språk/take (människa) innan `recordedSpeechForVideo` godtar posten. Det är skilt från registreringen.
5. **Projekt och paket (J08).**
   - Välj media i projektet och publicera en ny paketrevision för målrummet.
   - Bygg `identityMap` och kör `validate-k05-manifest.mjs --mode bind --language <en|sv>` (ska ge ok).
   - Kör sedan rootens `resolveRoomGameMaterial` med K04 `planningRevision`.
6. **Kvitton, åtskilda.**
   - Registreringsbevis: Neon-återläsning och katalogrevision.
   - Mediehämtning: Blob sha256-återläsning.
   - Visuell granskning: oförändrade bytes i rätt rum och paket.

   Inga befintliga poster raderas eller skrivs över. V1, omkodade kopior och ej valda språk importeras inte.

## 8. Öppna frågor till root

1. Ska K05:s identitetskarta bindas till `dragan-test`-rummet (enda live-rummet), eller till ett nytt rum per Kevin-dealer?
2. Ska `paow-kevin` återställas ur `dealerTrash` eller ersättas av en ny registrerad dealer? Dess 8 befintliga poster ligger inte i något paket.
3. Ska bytedubbletter (t.ex. `hole` = `hole-u`) få en mediepost var för att ge separata variant-ID:n, eller räcker en post med varianten i identitetskartan?
4. `astrid` greeting_1 (Table Studio) ingår i K04:s `activationSet(astrid)`. Ska K04 ta bort den ur aktiveringsmängden?
5. Kevin-media som idag finns i det levande Dragan-paketet men är utfasade hos Kevin (`idle-v2/breath` som grundloop): ska paketets grundloop bytas mot en vald `v2`-idle vid nästa publicering? Det kräver ingen radering.
