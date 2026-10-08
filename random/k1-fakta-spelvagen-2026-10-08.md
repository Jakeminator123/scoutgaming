# Fakta: spelvägen 2026-10-08

Inventering, ingen kodändring. Produktionsantagande: Render har `CROUPIER_STUDIO_NEON_POLICY=1`, `CROUPIER_DATABASE=postgres` och `CROUPIER_STREAM_LANE=lissabon-stream-lane` (`docs/ENVIRONMENT-VARIABLES.md:64`, `:106`, `:231`). Det sparade lane-värdet i Neon är okänt från repot; koden faller tillbaka på `mobile-phone`.

## Ingång `/play/blackjack`

```
/play/blackjack (Vercel)
  → apps/croupier-frontend/app/play/blackjack/route.ts:4
  → lib/server-ui.mjs:32, :40  (unified UI mappar om till /blackjack, fil game.html)
  → gameLaneSelection från GET /api/bo/config  (server-ui.mjs:62-63)
  → data-game-lane/dealer/presentation  (game-entry-contract.mjs:51-56)
  → web/public/app.mjs:60-62
```

Samma HTML-kontrakt på Render `GET /blackjack` när Neon-policy är på: `web/server.mjs:1081`, `:1094-1103`. `?launch=` proxas till backend (`apps/croupier-frontend/lib/platform-routing.mjs:87-89`) och landar i samma dekorerade `index.html`.

Kodens förvalda lane är `mobile-phone`: renderer `portrait-video`, dealer `astrid`, presentation `local` (`web/public/game-lanes.mjs:3-4`, `:35-43`). Då är `localPresentationEnabled` sant (`web/public/app.mjs:62`). `?dealer=` ignoreras på den renderern (`game-lanes.mjs:42`; test `test/game-lanes.mjs:11-12`).

Avstängt i den vägen: `lissabonProfiles` kräver sqlite och är `{ enabled: false }` på postgres (`web/server.mjs:547-548`). `nativeP6` är `null` om `CROUPIER_P6_QA_ROUTER` saknas eller är `0` (`web/native-p6-qa-hook.mjs:28-29`); namnet står inte i Render-raden (`docs/ENVIRONMENT-VARIABLES.md:231`).

## Tabell 1 – klippval i den förvalda produktionsvägen

| Händelse | System i prod (förvald lane) | Väljare | Server → klient | Test | Astrid vs övriga |
|---|---|---|---|---|---|
| deal, box och dealer | **A.** `POST /api/presentation/select`. Frekvens, om den finns, är en gren inuti A, inte B | `present()` `web/public/app.mjs:1566-1574`; server `presentation-api.mjs:106-127` → `selectPresentation` `presentation-runtime/selection.mjs:56-91` | Motorn skriver kvittot `native_presentations` (`web/postgres-native-table.mjs:38-40` via `presentationEvents` `web/partner-presentation.mjs:38-48`). Klienten anropar select. Spelas av `playLocalFilm` `web/public/local-film-player.mjs:3` via `PerformancePlayer.playLocalClip` `web/public/performance-player.mjs:21-36` | `test/local-presentation.mjs:245-249` och `:255` (frekvens). `test/game-lanes.mjs:8` | Select kräver `dealerId === 'astrid'` (`presentation-api.mjs:106`). Övriga når inte A |
| reveal | **A**, samma select | `app.mjs:1633-1639`; familj `reveal.dealer` (`presentation-runtime/media-family-resolver.mjs:5`) | Samma kvitto; reveal i stället för andra deal (`partner-presentation.mjs:42`, `:59`) | samma select-test | bara Astrid på den här vägen |
| turn | **inget klipp.** DOM-markering | `activeBoxHighlight` `app.mjs:1665-1673`. Ingen `present({type:'turn'})` | Partnerlistan kan emittera `turn` (`partner-presentation.mjs:62`) men spelklienten spelar det inte | inget klipptest hittat | — |
| settle / payout | **inget settle-klipp.** Resultatet blir en speak-rad (A). Marker och saldo är DOM | Speak: `partner-presentation.mjs:51-60` och `playRecorded` `app.mjs:2118`. Saldo `app.mjs:1982`. Banner/settlement `app.mjs:763-764` | `settle.*` finns i projektet (`lab/policies/project.seed.json:222-321`) men klienten anropar inte select med `type:'settle'` | speak-vägen som ovan | bara Astrid på den här vägen |
| speak | **A** (`present({type:'speak'})`) | `app.mjs:442`, `:2118`; rad → familj i `local-presentation.mjs:11-14` | `POST /api/presentation/select`. Ljudet är videons eget: deal/idle är tysta, speak är det inte (`local-presentation.mjs:60`, `local-film-player.mjs:6`) | `test/local-presentation.mjs` | bara Astrid. Originalmotorns bank (`app.mjs:2119-2160`) körs inte när local är på |
| idle | **idlePolicy**, hämtad med A:s config. Inte `legacyClipPolicy` | `createLiveIdleController` `presentation-runtime/live-idle.mjs:22-73`; start `local-presentation.mjs:28-29`, `:68-82` | `GET /api/presentation/config` skickar `idlePolicy` (`presentation-api.mjs:75-78`). OpenClaw-råd: `POST /api/presentation/idle-advice` (`local-presentation.mjs:42-50`) bara i läge `active`/`shadow` | `lab/test/studio-model.test.mjs:22-23` (seed har idle). Separat idle-test: se `presentation-runtime/idle-policy.mjs` | Familjen är låst till `astrid/idle.ready/ready` (`presentation-runtime/idle-policy.mjs:6`, `:24`) |
| bakgrundsbyte | **inget system.** Ingen `sourceType` | Kontraktet har speak, deal, reveal, settle, turn, idle (`lab/policies/studio-contract.json:11-35`). Ingen konsument av zon-JSON i `web/` eller `presentation-runtime/` (sökning tom) | — | — | Zoneditorn är Astrid (`lab/components/background-zones.tsx:372`) |
| probe | **probePolicy**, inte A/B-klipp | Klient `web/public/probe-client.mjs:32-35` bara om dealer är Astrid (`app.mjs:2747-2749`). Server `POST /api/probe/decide` `web/server.mjs:736-760` → `web/probe-runtime.mjs:62-91` | Beslutet är genererad text + talpaket, inte ett biblioteksklipp. `visualMode: 'generated-lipsync-preview'` (`probe-runtime.mjs:91`) | L4. Syntetiskt prov spärras i produktion (`web/server.mjs:757-758`) | `probe_astrid_only` (`probe-runtime.mjs:63`) |

L19 stämmer för HTTP-urvalet: `presentation-api.mjs:106` avvisar annan dealer innan `selectPresentation`. `usesMediaFamilies` kan vara sant för en dealer som har familjer i registret (`presentation-runtime/media-family-policy.mjs:37`), men den grenen nås inte för Vera/Amira/Mei via select.

### B körs inte på förvald lane

`loadLabClipConfiguration` returnerar direkt när local är på (`app.mjs:125`). `legacyClipPolicy` läses bara av `GET /api/presentation/legacy-config` (`presentation-api.mjs:80-82`) och skrivs in i `CLIP` (`app.mjs:131`). Det är en exakt fil per del, inte procent (`presentation-runtime/legacy-clip-policy.mjs:4-7`, `:30-40`).

`web/clip-mapping.mjs` är en katalog med `actualPlayback: false` (`clip-mapping.mjs:90-97`), utlämnad på `GET /api/v1/generations/mapping` (`web/generations-api.mjs:20`, anrop `web/server.mjs:241-243`). Den väljer inget klipp i spelrundan. Testet låser `actualPlayback === false` (`test/clip-mapping.mjs:15`).

Frekvens per dealklipp ligger i `project.mediaPolicy[].variants[].frequencyPercent` och används inuti A när läget inte är `off` (`media-family-policy.mjs:45-48`, `selection.mjs:89-91`). UI: `lab/components/deal-frequency-editor.tsx:8-37`, sparas som mediaPolicy (`lab/components/events-inspector.tsx:96`).

Produktions `defaultMode` är `active` när stream-lane är `lissabon-stream-lane` (`presentation-api.mjs:78`). Klienten startar då i OpenClaw (`local-presentation.mjs:18`, `:23-26`). Har familjen `frequencyPercent` vinner frekvensen över modellen (`selection.mjs:89-91`, `:111-113`). Seed-projektet har ingen `mediaPolicy` (`lab/policies/project.seed.json` toppnycklar rad 2–4, 23, 350, 351, 1377). Om produktionsprojektet har procent är okänt från repot.

## Tabell 2 – lager i den förvalda vägen (local / Astrid)

Local-CSS döljer rum, dealer-canvas, bordscanvas, filtplåt och sko (`web/public/local-presentation.css:3-11`). `createTableScene` anropas inte (`app.mjs:202-204`).

| Lager | Modul i prod-vägen | Separat eller inbakat | Vad som styr | z |
|---|---|---|---|---|
| Bakgrund | ingen egen ritare. Filmen är hela rutan | Inbakat i mp4. Spelaren säger full-frame (`local-film-player.mjs:1-6`). Stillbild under filmen är en canvas-kopia, bakgrund `#101618` (`local-presentation.css:14`) | vilket klipp A valde | 1 still, 2 film |
| Dealer | samma `<video class="local-presentation-film">` | Inbakat i samma mp4. Ingen alfa i presentationsindexet | A + idlePolicy | 2 |
| Bord / filt | samma film. 3D-filten ritas inte | Inbakat. `palette[dealer]` i `table-scene.mjs:27-28` används bara när 3D-scenen skapas, alltså inte här. Ingen runtime-setter i den funktionen | hårdkodad palett på originalvägen; prod-vägen har färgen i filmen | — |
| Kort | `createLocalCardOverlay` `web/public/local-card-overlay.mjs:67-76` | Separat SVG ovanpå filmen. Synk mot bildruta (`local-card-overlay.mjs:44-51`). DOM-korten döljs (`local-presentation.css:18-19`) | serverkort + kalibrering `card-presentation/` | 4 |
| Skugga / kontakt | CSS `drop-shadow` på SVG-kort (`local-presentation.css:16`). 3D-skuggor i `table-scene.mjs:15`, `:35-39` ritas inte | Kortskuggan är separat. Kontaktskugga mot filt finns inte som eget lager | CSS | på kortet |
| Chips / HUD | `index.html` + `app.mjs` (`buildChips`, `#hud-top`) | Separat DOM, inte i filmen | insatser i klienten; saldo från `POST /api/table` | HUD 36–50 (`styles.css:112`, `:347`, `:381`). Chips flyg 60 (`styles.css:455`) |
| Ljud | speak: ljudspår i mp4. Övriga filmer tysta (`local-presentation.mjs:60`). Bordsljud `createTableAudio` `app.mjs:13`, `:594` | Speak inbakat i klippet. Effekter separata | mute-knapp; probe kan lägga genererat tal på z 3 (`local-presentation.css:1-2`) | 3 genererat tal |

### Keyning, per dealer, bara JSON

| Dealer | Presentationsbank (prod-vägen) | Annan keyad bank (inte prod-vägen) |
|---|---|---|
| Astrid | `media/dealers/astrid/runtime/presentation/lab-video-manifest.json`. Item-fält: `id`, `familyId`, `role`, `relativePath`, `extension`, `size`, `sha256` (`:346-355`). Inga fält `mask`, `alpha`, `green`, `composite`, `kind`. Alla sedda filer är `.mp4` | `runtime/composited/astrid-table-v2/take.json:12` `layout: rgb-over-masks-r-actor-g-fingers`, `:42` i syskonfil `kind: chroma-card`. Maskmanifest har `alpha` (`astrid-table-v2/mask-manifest.json:51`). Används av `/v2` + green (`app.mjs:107-114`, `astrid-green-dealer.mjs`), och den grenen kräver `!localPresentationEnabled` |
| Amira | Ingen `runtime/presentation`-manifest i trädet | `amira-green-speak/speak.json` `layout: rgb-over-alpha` (rad 49). `amira-composite/profile.json:43-66` kant/alfa-beskrivning, ingen mediabinär. Bara när `/v2` och `composite!==off` (`app.mjs:108-109`) |
| Vera, Mei | Ingen presentation-manifest och inga `mask`/`alpha`/`green`/`composite` i deras `runtime/**/*.json` | Originalmotorn: helbilds-h264 plus valfri hands-matte (`dealer-engine.mjs:33-37`, `:289`). Rummet är en egen plåt (`app.mjs:87-96`, `environment.css:70-73`) när local är av |

Om pixlarna i Astrids presentations-mp4 redan innehåller bakgrund+dealer+bord går inte att avgöra utan att öppna binären. Index och spelare behandlar dem som full-frame.

## Tabell 3 – var de tre valen skulle kopplas

| Val | Finns i dag | Datamodell | Vem som läser | Saknas för spelaren (nivå 3) |
|---|---|---|---|---|
| Bordsfärg | 3D-palett per dealer, inte på prod-vägen (`table-scene.mjs:27-28`). Kevins editor har `felt` i minnet (`lab/components/kevin-bo/original-views.jsx:226`, `:579`) | `operator_packages.branding` är fri JSON (`ops/neon-studio/005-operators.sql:51`, `web/storage/operator-store.mjs:103-108`). Inget fältnamn för filt är krav | Spelmotorn läser inte paketet (L2). `table-scene` läser inte branding | Eget lager som inte sitter i mp4, plus en läsare från paket eller spelarval. Spelarkontot har dealer bara på chattminne (`ops/neon-game/product-schema.sql:27`), ingen filtfärg |
| Bakgrund | Zon-JSON `{schemaVersion:1, zones, blend, playback}` byggs i webbläsaren vid export (`background-zones.tsx:311`, `:372`). Ingen läsare i `web/` eller `presentation-runtime/` | Inte i Studio-projektet (`studio-model.mjs:84` tillåter inte `zones`) | Ingen | Konsument, och en bakgrund som inte redan är inbakad i deal/idle-mp4 |
| Dealerbyte | Server-lane. Förvald lane låser Astrid (`game-lanes.mjs:42-43`). Knapparna sätter `?dealer=` (`app.mjs:2537-2543`, `dealer-version-switcher.mjs:22-24`) men servern stämplar om till lane.dealer | `administration.gameLane` / `gameLanes` (`web/storage/studio-game-policy.mjs:149-153`). Inte spelarprofil | `server-ui.mjs:63`, `app.mjs:60-61` | En lane eller ett spelarval som servern faktiskt tar emot. Indexed-video-lane kan släppa `?dealer=` (`game-lanes.mjs:42`) men den lanen finns inte i kodens katalog (`game-lanes.mjs:3-4`) |
| Idle-frekvens | Ja, för Astrid local: vikt på grundloop och `averageEveryMs` på automatiska varianter (`idle-policy.mjs:33-47`, seed `lab/policies/idle-policy.seed.json:3-26`) | `project.idlePolicy` | `live-idle.mjs` via config | Nivå 3 har ingen yta. Originalmotorns "extra" är hårdkodad 25 % (`app.mjs:335-336`) och används inte när local är på |
| Dealsekvens-variant | Ja, i A: villkor/urval på linjen, eller `frequencyPercent` på Astrids deal-familj (`selection.mjs:68-94`) | `lines`/`variants`/`triggers` och `mediaPolicy` | select, bara Astrid | Nivå 3 kan växla läge i en `<select>` i spelrutan (`local-presentation.mjs:22-27`, `:141`). Valet sparas inte. Vera/Amira/Mei har katalograder i seed (`project.seed.json:615+`) men select tar inte emot dem |
| OpenClaw per händelse | Lägena sitter i klienten, ett läge för hela sessionen, inte per event | Lägen `off/rules/random/shadow/active` (`presentation-api.mjs:17`). Shadow spelar standard (`open-claw/lab/src/engine.mjs:307`, `:318`). Idle-råd bara `active`/`shadow` (`lab/lib/idle-advice-server.mjs:31`, `:196-199`) | `local-presentation.mjs` och `selection.mjs`. Probe är en egen policy (`probe-policy.mjs:23`) | Nivå 3 ärver serverns `defaultMode` (`active` i prod). Ingen sparad per-event- eller per-spelare-policy. OpenClaw anropas inte alls för deal-familjer som har frekvens, utom i läge `off` (`selection.mjs:89`) |

## Tabell 4 – sparat Studio-projekt

| Nyckel | I seed `project.seed.json` | I modellen | Del |
|---|---|---|---|
| `schemaVersion` | `1` (`:2`) | måste vara 1 (`studio-model.mjs:97`). Ingen migreringsfunktion i filen | — |
| `revision` | `studio.2026-09-20.2` (`:3`) | krav | — |
| `gameId` | `blackjack` (`:4`) | krav | — |
| `dealers` | fyra (`:5-21`) | krav | lane pekar på dealer, men dealerlistan är projektets |
| `events` | 16 låsta, sourceType speak/deal/reveal/turn/settle/idle | krav (`:112-119`) | del 2 (och idle som eventrad) |
| `triggers` | `[]` (`:350`) | krav | urval i A |
| `lines` | 64 (`studio-model.test.mjs:19`) | krav | del 2, alla fyra dealers |
| `assets` | finns (`:1377`) | krav | del 2, 2D-reserv |
| `idlePolicy` | inte i JSON; `createSeedProject` lägger på den (`studio-model.mjs:59`) | valfri | del 1, bara Astrid-familjen |
| `mediaPolicy` | inte i seed | valfri (`:93-96`) | del 2, frekvens och urval per familj |
| `probePolicy` | inte i JSON; default från `probe-policy.mjs:18`. Seed-läge `off` (`lab/policies/probe-policy.seed.json:2-3`) | valfri | del 4 |
| `legacyClipPolicy` | inte i seed | valfri (`:85-87`) | originalmotorn (B), inte prod-local |

Lane-id ligger inte i projektet. `operator_packages.lanes` är en JSON-lista av id (`005-operators.sql:48`, `operator-store.mjs:91-99`). Innehållet i en lane som "del 1–4" finns inte som egen typ; administrationens `gameLanes` är `{schemaVersion, id, label, dealer, renderer, mediaCollection}` (`game-lanes.mjs:14-19`).

Test: `lab/test/studio-model.test.mjs:12-26`. Schema `lab/schemas/studio.schema.json` jämförs där. Ingen versionsstege utöver `schemaVersion: 1`.

## 5 – risker

**A är den väg produktion följer om den sparade lanen är kodens förval.** Kedjan är Neon-policy → `mobile-phone` → `presentation=local` → `POST /api/presentation/select` + `idlePolicy`. B:s loader är avstängd i samma if (`app.mjs:62`, `:125`).

**De två systemen motsäger promptens karta på tre punkter.**

1. "B spelas via `clip-mapping.mjs`" stämmer inte för spelrundan. Filen är en katalog med `actualPlayback: false`.
2. "Frekvens per klipp" är inte `legacyClipPolicy`. Den är `mediaPolicy.frequencyPercent` och körs inuti A.
3. `legacyClipPolicy` är en enda fil per motordel (idle, deal, gest, …), och den når klienten bara när presentationen är `original`.

**Om B (`legacyClipPolicy` + legacy-config) tas bort rakt av:** förvald prod-lane tappar inget dealklipp. Det som går sönder är originalmotorn: Vera/Amira/Mei och Astrid med `indexed-video` / utan local, eftersom `CLIP` då stannar på hårdkodningen i `app.mjs:37-44` och labbets sparade bindning ignoreras. Katalogendpointen `/api/v1/generations/mapping` och `test/clip-mapping.mjs` är en tredje sak; de spelar inte rundan.

**Om A tas bort rakt av:** förvald prod-lane förlorar deal, reveal, speak och idle-film. Korten faller till 2D-reserv (`local-presentation.mjs:136-138`). Frekvensen i `mediaPolicy` försvinner med A, eftersom ingen annan spelare läser `frequencyPercent`. `legacyClipPolicy` ersätter inte de per-plats-filmerna (`deal_pos1` …); originalmotorn har en gemensam `CLIP.deal`.

**Osäkert från koden:** vilket `gameLane` och vilken `mediaPolicy` som faktiskt ligger i produktions-Neon. Om någon har sparat en `indexed-video`-lane är prod-vägen B, inte A. Repot kan inte visa det.

## Verifierat mot produktion, 8 okt 01:30 (orkestrator 2)

`GET https://www.scoutgaming.tech/api/bo/config` (publik projektion, `web/server.mjs:866-880`) svarar
`gameLane: "mobile-phone"` och `gameLanes` = kodens förval (en lane, Astrid, `portrait-video`).
Slutsats: **produktion spelar deal via system A.** Kvar okänt: om produktionsprojektet har
`mediaPolicy.frequencyPercent` (kräver inloggad Studio-läsning). Projektionen har också
`rooms[]` med `felt` per dealer (Green, Graphite, Tan, Petrol) från originalmotorn; det är en
befintlig plats för bordsfärg som inte läses av prod-vägen.
