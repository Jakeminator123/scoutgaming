# Systemschema, 8 oktober 2026

Hela systemet i ett schema. Namnen följer `docs/system-map/catalog.json` (tjänster), `routes.json`
(sidor), `storage.json` (lagring) och `lab/docs/TERMINOLOGI.md`. Rutor märkta `[KOMMER]` finns inte
i koden ännu; de står här så att kartan kan få samma rutor när de byggs (kartan visar bara det som
är `live-verified`, `code-inspected` eller `documented`; ett `planned`-läge föreslås i pass A5).

## 1. Tjänster och trafik (kartans `services` och `connections`)

```
                      www.scoutgaming.tech  (Vercel-projekt scoutgaming)
   ┌──────────────────────────────────┐   ┌──────────────────────────────────────────┐
   │ frontend  (Vercel service web)   │   │ studio  (Vercel service, basePath /studio)│
   │ Nivå 3: /play /play/profil       │   │ Nivå 1: /control/*   Nivå 2: /partner/*   │
   │ /play/historik /play/blackjack   │   │ Next.js, lab/                              │
   │ apps/croupier-frontend           │   └───────────────┬──────────────────────────┘
   └───────────┬──────────────────────┘                   │ signerade adminkommandon
               │ session · spelaction · presentation · WS │ Studio-adminsession → modellval
               ▼                                          ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │ render-game  (Render croupier-v2, web/server.mjs)  ← SPELMOTORN ÄGER     │
   │ kort, sko, regler, saldo, utfall (web/shoe-game.mjs, plånbok)            │
   │ presentationsadapter web/presentation-api.mjs  (select, config, idle-advice)│
   │ /api/bo/config (gameLane)   /api/probe/decide   /api/presentation/videos/:id│
   └───┬───────────────┬───────────────────────┬────────────────────┬─────────┘
       │ kontext/      │ exakt text → ljud     │ ljud + videokälla  │ kvitton
       ▼ tillåten pres.▼                       ▼                    ▼
   ┌──────────┐   ┌──────────┐   ┌──────────────────┐   ┌─────────────────────┐
   │ director │   │ cartesia │   │ runpod           │   │ Neon (två databaser) │
   │ Render   │──▶│ tal-     │   │ läppsynk-worker  │   │ se avsnitt 3         │
   │ publik   │   │ provider │   │ → autentiserad   │   └─────────────────────┘
   └────┬─────┘   └──────────┘   │ ström → spelaren │
        │ rätt agent/modell      └──────────────────┘
        ▼
   ┌──────────┐      Dokumenterade, utanför kärnan: qa (isolerad testmiljö, egna Vercel-/Neon-scopes),
   │ gateway  │      spelsajt (Render), sajtagenten (Render)
   │ Render   │
   │ privat   │
   └──────────┘
```

## 2. Tre nivåer och vad som finns

```
NIVÅ 1  /control  (intern personal, Kontrollrum)            NIVÅ 2  /partner  (operatör)        NIVÅ 3  /play  (spelare)
├─ Översikt            /control                             ├─ /partner/login   partner_session  ├─ /play           lobby
├─ Dealers & klipp     /control/clips   idle, kort&deal     ├─ /partner/{slug}  scopad snapshot  ├─ /play/profil
├─ Händelser           /control/events  A: events/lines/    │   (Kevins vyer, läsbara)           ├─ /play/historik
├─ Händelser → klipp   /control/tree    variants/triggers   ├─ [KOMMER] skrivande rutter L11     └─ /play/blackjack  spelklienten
├─ Klippbibliotek      /control/videos                      ├─ [KOMMER] spelare/transaktioner L10     (web/public/app.mjs på Render,
├─ Bakgrundszoner      /control/zones   (styr ej spelet L16)├─ [KOMMER] journal L12                    dekorerad av frontend)
├─ Agentmodeller       /control/openclaw  + flik Chatt      ├─ [KOMMER] inbjudan partner-roll L14├─ [KOMMER] operatörskontext L13
├─ Administration      /control/administration (6 flikar)   └─ [KOMMER] designprofil: bordsfärg,  ├─ [KOMMER] redigerbar profil
├─ Uppspelning         /control/activity  rullande fönster      chips, branding L3              └─ [KOMMER] spelarens val: bord,
├─ Talgranskning→Probe /control/probe   probePolicy                                                    bakgrund, dealer (T3–T5)
├─ Guide & hjälp       /control/guide
└─ [KOMMER] Förhandsvisning /control/preview  lagerprov (tre lager) från test-video-jakob
```

## 3. Lagring (kartans `storage.json`)

```
Neon croupier_auth.users (admin, superadmin, staff, reader, player, partner) + tokens, lab_sessions, api_keys
Neon speldatabas: native_presentations (kvitton), plånbok, spelare, bord      ← bara render-game skriver
Neon croupier_studio: metadata, taljournaler, speech-QA, fullfile-reservationer,
                      operators, operator_roles, operator_memberships, operator_packages (005)
Studio-projektet (JSON, schemaVersion 1): dealers, events, lines, triggers, assets, idlePolicy,
                      mediaPolicy, probePolicy, legacyClipPolicy   ← Nivå 1 skriver, render-game läser
Media: media/dealers/<dealer>/runtime/presentation/lab-video-manifest.json (id, familyId, role, relativePath, sha256)
       blob-index när konfigurerat; render-game serverar /api/presentation/videos/:id
Sqlite: bara offline-labbet och lokala fixturer (matris 36)
```

## 4. Klippflödet i produktion i dag (K1-fakta, verifierat 8 okt)

```
spelare → render-game: spelhändelse (kort delas) → kvitto native_presentations
klient (app.mjs, lane mobile-phone, Astrid, presentation=local)
   → POST /api/presentation/select {event, dealerId:'astrid', mode}
   → selection.mjs: läge off|rules|random|shadow|active; frequencyPercent vinner om satt
   → ett klipp ur familjen (deal.player.left/box0 …) → playLocalFilm: EN full-frame mp4
       (bakgrund + dealer + bord inbakade; kort = SVG-lager z4; chips/HUD = DOM)
idle  → GET /api/presentation/config → idlePolicy → live-idle.mjs (grundloop + vikter)
speak → samma select; ljud i klippet
probe → POST /api/probe/decide → genererad text + talpaket (cartesia/runpod), bara Astrid
Vera/Amira/Mei → originalmotorn (CLIP, legacyClipPolicy), inte select
```

## 5. Målbild: lane, paket, tre lager

```
LANE  (byggs på nivå 1, ägs av oss, återanvändbar, har id)             [KOMMER som egen typ]
├─ Dealers: en eller flera, var och en med egen klippuppsättning
├─ Lager per dealer:  z1 bakgrund (bild/video)  z2 bord (färgstyrt)  z3 dealer (keyad overlay)
│                      var och en på/av; standardval + vad bolaget får ändra
├─ Del 1 Idle        grundloop + variationer, vikt/frekvens (gäspning)          finns: idlePolicy
├─ Del 2 Händelser   deal/reveal/speak per situation: varianter, villkor, frekvens  finns: events + mediaPolicy
├─ Del 3 Bakgrund    tillåtna bakgrunder, zoner                                    finns: zoner utan läsare
├─ Del 4 Probe       policy                                                        finns: probePolicy
└─ OpenClaw          per händelsetyp: av | regler | slump | råd | skugga           finns: ett läge per session

OPERATÖRSPAKET  (det bolaget får, en revision per publicering)        finns: operator_packages, ingen läsare
├─ lanes[]           en eller flera lanes
├─ Designprofil      bordsfärg, chips, logotyp – inom lanens tillåtna              [KOMMER] L3
├─ Bord/spel         spelmotorns regler, rörs inte
└─ Spelare           bolagets egna                                                  [KOMMER] L10

SPELAREN (nivå 3)   väljer bland paketets tillåtna: bordsfärg, bakgrund, dealer    [KOMMER] T3–T5

Grundprofil = standardpaket (demo-operatören "SG test game provider") som kopieras till nytt bolag.  [KOMMER] rad 44
```

## 6. Spelklienten efter tre lager (Jakobs gren `test-video-jakob`, ej på main)

```
z1 bakgrund   bild/video, bytbar, borttagbar          ← paket/spelarval
z2 bord       renderat/tonat: bara färgen byts        ← paket/spelarval, rooms[].felt finns i /api/bo/config
z3 dealer     keyad overlay-video: idle, deal, variant, talsynk   ← select (A) väljer klippet som i dag
z4 kort SVG   oförändrat
z5 HUD/chips  oförändrat
Material: Astrid rgb-over-masks och Amira rgb-over-alpha finns i /v2-grenen; Vera/Mei saknar keyning.
Media från grenen stannar som filer; inget till blob eller databas före main-implementation.
```

## 7. Vad kartan behöver för att visa `[KOMMER]`

Kartan har `plans[]` (länkar till PLAN-filer) men ingen ruta med status `planned`. Förslag i pass A5
(matris 42): tillåt `status: "planned"` på `services`, `routes.pages` och `storage.storageLayers`,
rendera grått streckat, aldrig grönt, och kräv ett checklist-id (`random/checklista-2026-10-08.md`)
per planerad ruta. Då är schemat här och kartan samma sak.
