# A04 · Medieinventering

Mätt på `43bb429c` (denna bas). `media/` är identisk med baslinjen `00ea55c5` och med `origin/main` `91969107`: **731,74 MB · 2 455 filer**. Inget i `media/` skiljer mot någon av de två. `origin/main` har två senare commits (Node 24-pin och migration 008) som inte rör media eller urvalskoden nedan.

Storlek är Git-blob. Blob-kolumnen är `media/blob-index.json` (1 855 rader, alla `vercel-blob`, 0 hash-/storleksavvikelser mot `layout.json`). Objektens existens i Blob är inte läst. Render: `ops/cloud/Dockerfile` `COPY . .`; `.dockerignore` rad 43–46 utesluter `media/**/source`, `staging` och `review`, så all `media/**/runtime` följer med. Studio-bundle: `lab/next.config.mjs:25` utesluter `media/dealers/**`; rad 29 tar med `layout.json`, `blob-index.json` och `media/catalog/*.json`.

`layout.json`: 2 514 rader (1 004 public, 1 510 source). 65 rader finns i layout och blob-index men inte i Git (0 storleksfel på rader som finns i båda). De tre Git-filer som inte är layout-rader är registren själva och `dealers/astrid/source/calibration/lipsync-overrides.json.pre-retime` (167 byte).

## Tabell

| träd | MB | filer | klass | konsumenter (fil:rad) | Blob | Render | Studio-bundle | åtgärd | aktivitet |
| --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- |
| `astrid/runtime/indexed/performance` | 100,40 | 115 | partnerprotokoll + studio-reserv + ci-kontroll | `web/partner-presentation.mjs:27`, `lab/lib/original-media-server.mjs:69`, `pipeline/audit-dealer-sync.mjs:55`, `.githooks/pre-commit-full:67` | ja, layout 118/118 (3 rader bara i registret) | ja | nej | behåll tills partnerkontraktet bytt källa | A30, B11 |
| `astrid/runtime/indexed/rig` | 61,98 | 23 | pipeline + test-fixtur | `pipeline/bake-dealer-collection.py:11`, `test/dealer-face.mjs:6` | ja, 23/23 | ja | nej | ta bort | A10, B4 |
| `astrid/runtime/indexed/streams` | 20,68 | 38 | partnerprotokoll + studio-reserv + ci-kontroll | `partner-presentation.mjs:16`, `original-media-server.mjs:51`, `studio-voice-lines.mjs:52`, `sync-existing.py:12` | ja, 38/38 | ja | nej | behåll | A30, B11 |
| `astrid/runtime/indexed/actor` | 13,22 | 26 | pipeline | `pipeline/audit-astrid-actor.mjs:8`, `build-astrid-actor-mattes.py:11` | ja, 26/26 | ja | nej | utred med A05 om aktören är live; ingen träff i spelklienten | A30 |
| `astrid/runtime/indexed` övrigt (scene, table, speech, audio, preview) | 17,41 | 65 | partnerprotokoll + studio-reserv | `partner-presentation.mjs:30`, `original-media-server.mjs:54`, `app.mjs` använder dem inte | ja | ja | nej | behåll speech/audio/scene med banken; speech är 3,84 MB / 2 filer | A30 |
| `amira/runtime/indexed` | 41,94 | 108 | partnerprotokoll + studio-reserv + ci-kontroll | samma tre läsare, bas `dealers/amira` (`partner-presentation.mjs:7`) | ja, 109 layoutrader varav 1 bara i registret | ja | nej | behåll | A30, B11 |
| `vera/runtime/indexed` | 48,41 | 178 | partnerprotokoll + studio-reserv + ci-kontroll | bas `dealer` → `vera/runtime/indexed` (`media-layout` rot) | ja; 13 layoutrader (6,52 MB orig-strömmar) saknas i Git men finns i blob-index | ja | nej | behåll | A30, B11 |
| `mei/runtime/indexed` | 36,92 | 102 | partnerprotokoll + studio-reserv + ci-kontroll | bas `dealers/mei` | ja; 1 layout-rad (0,59 MB) bara i registret | ja | nej | behåll | A30, B11 |
| `vera/runtime/hands` | 2,96 | 30 | pipeline | `pipeline/build-hands.sh:92` | ja, 30/30 | ja | nej | ta bort med hands-skripten | A15 |
| `astrid/runtime/hands` | 0,32 | 3 | partnerprotokoll | `partner-presentation.mjs:7` (`dealers/astrid-hands`) | ja, 3/3 | ja | nej | behåll så länge assets-manifestet gör det | A30 |
| `astrid/runtime/presentation` | 165,93 | 83 | studio-reserv + ci-kontroll | `lab/lib/video-registry.mjs:80`, `tools/media-layout.mjs:6`, `pipeline/build-lab-video-manifest.mjs:14`, krok `build-runtime-media-catalog.mjs --check` | 51/51 mp4 (164,34 MB) hashok; 29 utan blob är `.gitkeep` och två README | ja | nej | behåll. Inte spelklientens källa | B6, B11 |
| `astrid/runtime/composited` | 80,67 | 189 | ingen i spelaren | `web/clip-mapping.mjs:90` (`actualPlayback: false`), `pipeline/test-astrid-green-box-right.mjs:10` | ja, layout 191/191; 2 filer (3,57 MB) bara i registret | ja | nej | ta bort efter att granskningssidorna pensionerats | A16, B10 |
| `amira/runtime/composited` | 10,36 | 62 | ingen i spelaren | `clip-mapping.mjs:44` via `review/amira-green-speak` | ja, 62/62 | ja | nej | ta bort tillsammans med Astrids composited | A16, B10 |
| `astrid/runtime/assets/astrid-collection-sweep.glb` | 38,50 | 1 | pipeline + test-fixtur | ingen träff i `web/public/app.mjs` eller `web/layer-packs.mjs` | ja | ja | nej | ta bort | A10 |
| `*/runtime/assets/lab` (amira 3,11, vera 3,26, mei 2,71, astrid lab 2,93) | 12,01 | 16 | pipeline | pilot/atlas, ingen spelklient | ja | ja | nej | ta bort med 3D-spåret om A05 inte hittar en Studio-läsare | A10 |
| `astrid/source/3d` | 23,01 | 26 | pipeline | `pipeline/assemble-blackjack-project.py:11` | binärer ja; tre README saknar blob | nej | nej | ta bort | A10 |
| `game/runtime/assets/casino-floor.glb` | 17,53 | 1 | runtime-spel bara via `/casino.html` | `web/public/floor-test.html:15`, ingress `vercel-ingress.mjs` `/casino.html` | ja | ja | nej | pensionera med sidan | A11, B5 |
| `game/runtime/assets/blackjack-3d` + `player.glb` | 6,81 | 4 | samma | `web/public/casino.mjs:48` laddar `player.glb` | ja | ja | nej | samma | A11 |
| `game/runtime/assets/table.png` | 6,55 | 1 | ingen i spelklienten | publik alias-rot `web/public/assets`; ingen import i `app.mjs` | ja | ja | nej | utred om `/casino.html` begär den; annars A11 | A11 |
| `game/runtime` små livefiler (`ambience.mp3` 0,23, `cards/back-scout.png` 0,02, `speech-media.json`) | 0,25 | 3 | runtime-spel + studio-reserv | `app.mjs:258`, `app.mjs:214` → `game-cards.js:39`, `original-media-server.mjs:38` | ja | ja | nej | behåll | – |
| `game/runtime/scene` (`dealer-fallback.png` 1,96, `scene.jpg` 0,74) | 2,70 | 2 | studio-reserv | `platform-routing.mjs:71` släpper fortfarande in sökvägarna | ja | ja | nej | behåll tills A12 visat att inget anropar dem | A12 |
| `game/staging` | 9,11 | 852 | pipeline + test-fixtur | `test/dealer-reach.mjs:6` läser `per-seat-video/targets.json`; `verify-dealer-ik-panel.py:4` skriver `dealer-controls`. Resten ingen | delvis | nej | nej | ta bort; flytta eller pensionera reach-fixturen | A14, B8 |
| `astrid/staging` | 6,04 | 452 | pipeline bara `2026-09-10/astrid-head-v2` | ansiktsskripten i A10. Övriga mappar: ingen träff utanför `media/` | delvis | nej | nej | ta bort. Läppsynk läser dem inte | A14, B8 |
| `amira/staging` | 0,32 | 37 | ingen | ingen kodträff | delvis | nej | nej | ta bort | A14, B8 |
| `site/source/design-kit` | 2,32 | 8 | ingen | ingen produktträff | nej (HTML) | nej | nej | ta bort ur trädet, historiken räcker | A17 |
| `site/runtime/backoffice/img` | 0,23 | 9 | ingen i spelaren | layout-rot `web/public/bo/img` | ja, 9/9 | ja | nej | behåll tills en route-koll visar att de är döda | A05 |
| `layout.json` + `blob-index.json` + `catalog/*.json` | 3,02 | 4 | ci-kontroll | krok rad 59, Studio-include rad 29 | registret är indexet | ja | ja | behåll | – |

Indexerad bank utöver Astrids rigg: **278,98 MB** (Astrid indexed 213,69 − rigg 61,98 + Amira 41,94 + Vera 48,41 + Mei 36,92). Det är A30:s siffra. Allt det ligger i Render-imagen.

Composited tillsammans: **91,03 MB** Git och Render.

Staging tillsammans: **15,47 MB** Git, **0 MB** Render.

## Per dealer

Spelklienten väljer inte media ur de här träden.

```text
game-entry-contract (local|layered)
        │
        ▼
gamePresentationForDealer: portrait-video → local, layered → layered
        │                      indexed-video → throw
        ▼
/api/presentation/config|select|videos
        │
        ▼
Neon-register + fryst paket (video-registry / frozen dealer context)
```

`web/public/app.mjs:78` kastar om presentationen inte är `local` eller `layered`. `web/public/game-lanes.mjs:8` kräver `portrait-video` eller `layered`. En lane med `indexed-video` ger tom dealerlista (`game-lanes.mjs:167`) och kan inte starta (`test/registered-cloud-playback.mjs` och `test/game-lanes.mjs:31`). `dealerVersionPath` tar emot `'original'` från `app.mjs:114` men ignorerar argumentet (`dealer-version-switcher.mjs:6`) och behåller dokumentets presentation.

Layer-lane (`/layer-packs/`) läser `test-videoeditor/program/web` (`web/layer-packs.mjs:7`). Den läser inte `media/dealers`.

| Dealer | Vad spelaren kan välja | Vad som fortfarande läser Git-banken |
| --- | --- | --- |
| Astrid | `local` om lane är `portrait-video` och dealern finns i registret. Filmen kommer från Neon/fryst paket, inte från `runtime/indexed`. | Partnerns `/api/v1/assets` (`partner-presentation.mjs:14`), Studio-reserven, talrader, katalogkontrollen. 20 klipp i `streams/index` (17 tal, 1 idle, 2 actions), 4 performance-tagningar med status `review`. Native speech i `speech-media.json`: bara `win` och `goodluck`. |
| Vera | Samma `local`. Ingen egen presentation-bank. | Samma läsare, bas `web/public/dealer`. 39 klipp varav 32 tal, 0 performance-tagningar. Största Git-banken efter Astrid (48,41 MB). |
| Amira | Samma `local`. | 16 klipp, 15 tal, 0 actions, 0 performance. |
| Mei | Samma `local`. | 15 klipp, 14 tal, 0 actions, 0 performance. |
| Paow, Dragge | `layered` på `layer-preview`. Media i `test-videoeditor/preview/site`, inte i `media/`. | – |

Gamla sökvägar `/dealer/…` och `/dealers/{astrid,vera,amira,mei}/…` svarar 410 `local_dealer_retired` (`web/server.mjs:1167`). `/api/presentation/legacy-config` svarar 410 (`presentation-api.mjs:118`).

Studio-reserven (`original-media-server.mjs:44`) tar idle-klippet, talrader utom `rules_decks` och `fair_rng`, och för Astrid de fyra review-tagningarna. Den läser inte `runtime/presentation`. Presentation-banken är labbets videoarkiv: 28 familjer, 51 mp4, 172 323 710 byte, alla i blob-index. `lab/docs/README.md:430` beskriver den som Astrids källa för Studio, vilket stämmer för arkivet och inte för `/play`.

**Shoe.** `web/frozen-dealer-playback.mjs:41` tar bort `transition.shoe` när de frysta raderna saknar händelsen. Samma rad finns på `origin/main` `91969107`. `test/frozen-dealer-events.mjs:50` bevisar en syntetisk paketkropp utan händelsen (16 händelser kvar, 17 när den finns). Testet namnger inte johns-spelbolag rev 14, sg-test rev 15 eller nordic-bet rev 1.

**Sex hårdkodade bankidentiteter** (`web/storage/studio-contract.mjs:120`, tillsammans 8 262 169 byte) pekar på samma relativa sökvägar som dagens varianter, men hash och storlek stämmer inte med Git, layout eller blob-index. Dagens filer på de sökvägarna är större och har andra hash (de finns i blob-index). De sex gamla hasharna finns inte i något av registren. Deras tänkta Blob-sökväg är `croupier/media/dealers/astrid/runtime/retained-bank/<id>/<sha256>.mp4`.

**B6.** Spelarens originalmotor är redan stängd. Reservvisningen i Studio kan tas bort (A12) om luckor utan Neon-video får texten "Ingen spelbar video". Behåll presentation-banken och den indexerade banken. Avregistrera inga blob-objekt.

**B8.** Staging är inte läppsynkskedjan. `pipeline/sync-existing.py:11` och `audit-dealer-sync.mjs` läser `runtime/indexed` och `docs/dealer-sync-baseline.json` (hashar, inte staging-sökvägar). Ingen av Astrids mappar från 2026-09-19 eller 2026-09-20, inklusive `astrid-green-speak-elevenlabs` och `astrid-seam-repair/calibration.json` (15 240 byte), refereras av `sync-*`, `retime-*` eller `measure-*`. `calibration.json` är alltså inte den enda källan till ett godkännande som koden läser. Ta bort staging i A14 (15,47 MB checkout, 0 MB image). Undantag som måste följa med: `astrid-head-v2` tas av A10, `targets.json` ägs av kroktestet `dealer-reach.mjs`, och `lipsync-overrides.json.pre-retime` står redan på A14:s fillista.

**B10.** Composited (91,03 MB) spelas inte av `local`/`layered`. `clip-mapping.mjs` märker kandidaterna `actualPlayback: false`. De ligger i Render-imagen och i blob-index. Granskningssidorna under `web/public/review/` är fortfarande nåbara, så filerna tas bort först när A16 pensionerar sidorna. `/v2` pekar på `game.html` (`apps/croupier-frontend/lib/server-ui.mjs`); spelklienten där kräver ändå `local` eller `layered`. Vad mer `/v2` gör lämnas till A05.

**B11.** Ta inte bort den indexerade banken i den här vågen. Spelaren behöver den inte, men tre saker gör det: partnerns asset-manifest (URL:er till streams, ljud, scene, table, poster och performance), Studios talrader och originalreserv, och krokens `audit-dealer-sync` plus `catalog/legacy.json` som bäddar in streamindex och Astrids performance-manifest. Blob-index har hashträff för varje Git-fil i banken. Det ersätter inte ett levande objekt och inte partnerkontraktet. Render-vinsten om banken lämnar imagen är cirka 279 MB plus Vera-händer 2,96 MB, utöver A10:s rigg.

## T1

Handoffens mening att Amira, Vera och Mei använder originalmotorn, och att Astrid använder en lokal spelare, stämmer inte med spelklienten.

Koden ger alla fyra samma regel: `portrait-video` blir `local`, och `local` hämtar registrerad media. Ingen av dem kan starta på den indexerade banken. Argumentet `'original'` vid dealerbyte ändrar inte motorn. 410-svaren stänger de gamla fil-URL:erna.

Det som fortfarande är dealer-specifikt är inte spelmotorn: partner-manifestet och Studio-reserven läser Vera, Amira och Mei ur den indexerade banken, medan bara Astrid har en presentation-bank och performance-tagningar. Om ett sparat rum fortfarande har renderer `indexed-video` blir rummet ospelbart i stället för att falla tillbaka till originalmotorn (`public-operator-rooms.mjs` kastar `UnplayableOperatorRooms` när selektorn säger `Registered cloud presentation required`).

Det som bara produktion kan avgöra står under Produktionsfrågor: om något live-rum fortfarande är `indexed-video`, och om Amira, Vera eller Mei har Neon-video för de händelser reserven visar.

## Produktionsfrågor

1. Vilka 12 sökvägar och SHA-256 i den sparade projektkonfigurationen summerar till 72 276 298 byte under `runtime/presentation`? Är de en delmängd av katalogens 51 mp4 (alla finns i blob-index)? `docs/qa/cloud-media-import-2026-09-29.json` är ett annat tolvtal: 44 574 024 byte, uppladdade 2026-09-29, och de hasharna matchar dagens Git-filer. Blanda inte ihop dem med §8:s 72,3 MB.
2. Finns de sex `RETAINED_BANK_VARIANTS`-objekten i Blob på `retained-bank`-sökvägarna? Hasharna finns inte i Git, layout eller blob-index.
3. Finns blob-objekten kvar för composited (91,03 MB) och för hela den indexerade banken, eller bara indexraderna? 65 layout-rader saknas redan i Git men står kvar i blob-index (bland dem Veras orig-strömmar, 6,52 MB).
4. För varje dealer: vilka av reservens händelser (idle, talraderna ovan, Astrids fyra deal-tagningar) har en spelbar Neon-post i dag? §8 säger att Astrids 10 registerposter inte matchar gamla Git-filer. Amira, Vera och Mei är inte specificerade där.
5. Anropas `POST /api/v1/assets` av någon partnernyckel? Manifestet är det som fortfarande publicerar bankens URL:er. `presentationEvents` i samma fil skickar händelsetyp och klippnamn, inte fil-URL.
6. Avkodas johns-spelbolag rev 14, sg-test rev 15 och nordic-bet rev 1 av den deployade servern? Koden på denna bas och på `origin/main` `91969107` klarar ett paket utan `transition.shoe`. Testet använder inte de revisionerna.

## Tveksamt

- De 12 klippen på 72,3 MB är inte identifierade i Git. QA-kvittot från 29 september är ett mindre och äldre tolvtal. A12 och A30 får inte behandla dem som samma mängd.
- De sex behållna identiteterna är inte de filer som ligger på sökvägarna i dag. Att radera presentation-banken raderar inte de gamla bytena (de finns inte i trädet) och återskapar dem inte heller.
- `origin/main` flyttades med force-update under mätningen, från den utgångna referensen `5ebe3ff4` till `91969107`. Media och urvalsfilerna är lika. De två nya main-commits är inte inmergade i `43bb429c`.
