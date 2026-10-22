# Admin-karta: sidor, redirects, dubbletter, onådd kod

Läst 22 oktober 2026 på `main` (7afae426). Underlag för Jakobs genomgång av `/admin`; ingen kod ändrad, inte en ny statuskälla
(procent och VERIFIED ligger kvar i `migrering/status.json`). Metod: `git grep` plus en importgraf (regex över `import`, dynamic
`import()`, `new URL`) från sidor, API-routes, middleware, next.config och `apps/studio/tools`. Strängbyggda sökvägar och körtidsflaggor följs inte;
varje "onådd" rad har därför ett bevis att kontrollera.

**Förkortningar.** `doc:project` = `croupier_studio.documents` kind=project (dealers, klipp `lines`, `events`, `triggers`, `idlePolicy`,
`dealerIdlePolicies`, `mediaPolicy`, `probePolicy`, `lanes` = sammansättningar, `layerAssets`, `dealerTrash`) med `document_history` och `audit_events`.
`doc:admin` = kind=administration (rum, nivåer, spelkonfigurationer, `voiceReview`). `doc:social` = kind=social-policy. `media` = `media_records` + privat Blob.
`op*` = operators, operator_memberships, operator_roles, operator_packages, operator_branding_drafts, operator_audit_events.
`konto` = users, tokens, players, player_accounts, player_admin_events, transactions, api_keys, lab_sessions, bo_*/craig_*, blackjack_tables.
API: **P** `/api/project`, **V** `/api/videos` (+upload, classify, archive, delete, rescan), **L** `/api/layer-assets`, **A** `/api/admin/<åtgärd>`,
**W** `/api/admin/workspace/<sektion>` (skrivskyddad), **C** `/admin/_data/catalog` (skrivskyddad katalog), **session** `/api/auth/session`.
Klienten anropar dem som `/studio/api/...`. `/api/studio-preview` och `/api/studio-game/command` ligger inte i `app/api`; de proxas till Render.

## Siffror

| Yta | Sidor | Anmärkning |
| --- | --- | --- |
| Admin | **26** | 17 i menyn (Översikt + 9 + 7 System), 4 under Fördjupning, 5 utan menyväg; dessutom 2 inloggningssidor, 8 pensionerade adresser som bara omdirigerar, 5 flikar i OpenClaw |
| Partner | **7** | katalog, login, set-password, Översikt, Spelrum, Team + Integration (platshållare); 13 extra adressnamn viks in i dessa |
| Lobby | **1** | `/lobby` (+ en intern kopia `/admin/lobby`) |
| API-routes | 49 | 6 utan någon anropare, 16 med bara Control-era-anropare (avsnitt 4) |
| Dubbletter | **13** | 6 hög, 5 medel, 2 låg (avsnitt 3) |
| Onådda | 2 komponentfiler, 4 client-filer, 9 lib-moduler (+1 json) | plus 4 lib-moduler bakom API utan anropare och ca 30 kandidatfiler (avsnitt 4) |

## 1. Sidor

Rendering: `app/admin/[[...path]]/route.ts` kräver personalbehörighet och serverar en enda SPA (`client/admin/entry.tsx`, byggd av `client/build.mjs`
till `design-preview-build/admin`). Giltiga adresser styrs av `lib/design-preview-paths.mjs`. Menyn står i `client/admin/lib/admin-navigation.ts`.

### 1a. Admin (`/admin`)

| # | URL | Menyetikett | Renderas av | API | Neon / kontrakt |
| --- | --- | --- | --- | --- | --- |
| 1 | `/admin` | Översikt | AdminHome. Med `?operator/dealer/composition/table/game` visas Klippkartan i stället | - | - |
| 2 | `/admin/clips` | Klippkarta (Skapande) | `clips/page.tsx` + ConnectedClipMap (+ studio-speech-, -composition-, -policy-, -lifecycle-panel, roulette-start/idle-editor, saved-scene-preview) | C, P (GET/PUT), V, L, `/api/speech-build`, Render: studio-preview | doc:project, media, speech_requests/leases, gpu_* |
| 2b | `/admin/clips?tool=import` | Lägg till dealer eller filmer | DealerAssistantShell > DealerImportAssistant | `/api/dealers/import-proposal`, V (upload), P | doc:project, media; importkatalog (läs) |
| 3 | `/admin/dealers` | Dealerregister (Skapande) | DealerDirectory | P, V, `/api/dealers/{archive,delete}`(+check) via studio-lifecycle | doc:project (dealers, dealerTrash), media |
| 4 | `/admin/assets` | Bord & bakgrunder (Skapande) | RegisteredMaterialLibrary | L (+upload), P, V | doc:project.layerAssets, media |
| 5 | `/admin/rehearsal` | Provspelning (Skapande) | WorkspaceTool > ControlActivityPage (activity-log, game-stream, idle-reactions, partner-reference) | W, A resource-lifecycle, `/api/clip-controls`, `/api/inputs{,/events,/reference}`, `/api/presentation/{decision,idle}`, Render: studio-preview, studio-game/command | läser doc:project/admin, op*; logg i sessionStorage |
| 6 | `/admin/rooms` | Spelbolag & rum (Verksamhet) | RegisteredStudio (rumsvy): RoomGameConfig, PresentationRoomCreate, ControlResourceLifecycle, PartnerAppearanceLoader | C, A operator-package, presentation-room, room-game-config, resource-lifecycle, `/api/partner/*` | op* (packages), doc:admin (rum), croupier_game.shared_table_configs/heads |
| 7 | `/admin/companies` | Bolag & team (Verksamhet) | WorkspaceTool > AdminPublicationPage(initialTab=companies) > ControlOperatorDirectory, ControlResourceLifecycle | W, A operator-create(-demo), operator-membership, operator-role, operator-lifecycle | operators, operator_memberships, operator_roles |
| 8 | `/admin/players` | Spelarkonton (Verksamhet) | PlayerAccountsPage > ConnectedServices > NativeAdministration(accounts) | session, A players, players/{create,status,password} | players, player_accounts, player_admin_events, transactions, tokens |
| 9 | `/admin/drift` | Drift (Verksamhet) | ConnectedServices > StudioAdministration(operations) + SharedTableProof | session, A overview, shoes, shared-table-proof | blackjack_tables, croupier_game.shared_table_* |
| 10 | `/admin/ekonomi` | Ekonomi (Verksamhet) | ConnectedEconomy (recharts) | session, A transactions (GET) | transactions |
| 11 | `/admin/tools` | Fördjupning (System) | WorkspaceToolsHome (länkar till 18-21) | - | - |
| 12 | `/admin/structure` | Kopplingar & användning (System) | ResourceConnections | A resource-lifecycle, P, V | doc:project, doc:admin, op*, media |
| 13 | `/admin/openclaw` | OpenClaw (System), 5 flikar | OpenClawPage: Driftläge = TaldriftPanel/MovingDriftControls; Agentmodeller = OpenClawWorkspace; Dealerns agent = ControlOpenClawChat > GatewayPanel; Tal vid inaktivitet = ControlProbePage > ProbeEditor (bara Astrid); Adminroboten = AdminAssistantPage (en knapp som öppnar widgeten) | A moving-drift, `/api/openclaw/admin` (Director på Render), `/api/chat`, `/api/voice`, `/api/probe`, P, W | moving_drift_control, moving_speech_*, gpu_*; Director-inställningar (Render, inte Neon); doc:project.probePolicy |
| 14 | `/admin/admin/accounts` | Konton & åtkomst (System) | AdminStaffPage > NativeAdministration(accounts) | A users, users/{invite,resend,role,remove} | users, tokens, e-post |
| 15 | `/admin/admin/payments` | Betalningar (System) | ConnectedServices > StudioAdministration(finance) | A transactions | transactions |
| 16 | `/admin/admin/api` | Integrationer (System) | NativeAdministration(partners) | A apikeys, apikeys/{create,revoke,rotate,launch,credit}, emails | api_keys, bo_game_handoffs, `packages/shared/email-templates` |
| 17 | `/admin/admin/log` | Bolagsjournal (System) | CompanyJournal | C | op* (läs); själva journalen visas på `/partner/{slug}/team` |
| 18 | `/admin/media-review` | Talgranskning (Fördjupning) | WorkspaceTool > ConnectedServices(media-review) | A voicelines, voiceline-review, config | runtime_media_catalogs (läs), doc:admin.voiceReview; roster bara Astrid |
| 19 | `/admin/replies` | Svarsbibliotek (Fördjupning) | ControlRepliesPage | `/api/replies` | speech_reply_records, media |
| 20 | `/admin/events` | Spelhändelser & regler (Fördjupning) | ControlTreePage; med `?event=` ControlEventsPage (+ SocialChatPanel, EventsPreview, EventTestPanel) | W, P, V, `/api/social*`, `/api/presentation/decision`, `/api/chat`, `/api/voice` | doc:project (events, triggers, lines), doc:social |
| 21 | `/admin/guide` | Guide (Fördjupning) | ControlGuidePage (`docs/guide.json`) | - | - |
| 22 | `/admin/dealer-studio` | (ingen) Dealerinställningar | LabStudio: vyer idle, clips, generate, speech, settings (+ IdlePolicyEditor, RegisteredIdleEditor, DealerSpeechSlotEditor, LegacyClipEditor, DealerMediaLibrary, DealerRegistration, DealerRemoval, DealerMaterialCreator) | W, P, V, `/api/dealers/*`, `/api/forge`, `/api/clip-controls` | doc:project, media, forge_dealers, forge_jobs |
| 23 | `/admin/videos` | (ingen) Klippbibliotek | ControlVideosPage (DealerMediaLibrary, LegacyClipEditor) | W, P, V | doc:project, media |
| 24 | `/admin/compositions` | (ingen) Sammansättningar | ControlPreviewPage (lane-editor, CompositionPreview, layer-library) | W, P, L, Render: studio-preview | doc:project.lanes, layerAssets, media |
| 25 | `/admin/admin/operators` | (ingen) Spelbolag | RegisteredStudio (bolagsvy: aktiva, papperskorg, pausade) | C, A operator-lifecycle | op* |
| 26 | `/admin/lobby` | (ingen) Spelarlobby, intern | `client/lobby` (samma källa som `/lobby`) | C | publicerade rum ur op* + doc:admin |

Övrigt: `/admin/login`, `/admin/set-password` (Next-sidor), `/admin/_data/catalog` (JSON), `/admin/_assets/*`. Sidor utan menyväg nås bara via inlänkar:
dealer-studio från 14 filer, videos från 7, compositions från 11, admin/operators bara från assistentwidgetens tillåtelselista, `/admin/lobby` från ingen (avsnitt 4).

### 1b. Partner (`/partner`)

Next-sidor under `app/partner/**`; UI i `components/kevin-bo/**` (partnerportalen, inte död Kevin-kod) och `partner-workspace.tsx`. Sessioner i `lab_sessions`.

| URL | Etikett | Komponent | API | Neon |
| --- | --- | --- | --- | --- |
| `/partner` | Spelbolag (katalog) | PartnerWorkspace | `/api/partner/snapshot` | op* (läs) |
| `/partner/login`, `/partner/set-password` | Inloggning | PartnerLogin / StudioLogin | `/api/partner/{login,set-password}` | users, lab_sessions, operator_memberships |
| `/partner/{slug}` | Översikt (ops) | PartnerLiveOverview | snapshot | op* (läs) |
| `/partner/{slug}/rooms` | Spelrum (bj); även `tables`, `presentation`, `table-design`, `backgrounds`, `lanes`, `preview` | PartnerRoomWorkspace > PartnerPackageView + PartnerAppearanceLoader | `POST /api/partner/branding` | operator_branding_drafts, operator_packages |
| `/partner/{slug}/team` | Medlemskap (kräver `team.read`) | TeamView | `POST /api/partner/team`, `GET /api/partner/journal` | operator_memberships, operator_roles, operator_audit_events |
| `/partner/{slug}/integration` | Integrationer (`api`); även players, transactions, reports, statistics, pit-bosses, shoes, roulette, baccarat | PartnerDisconnected ("ej ansluten", ingen data) | - | - |

`/api/partner-preview` (demo-operatörer `operator-demo-north/south`) har ingen UI-anropare.

### 1c. Lobby (`/lobby`)

| URL | Komponent | API | Neon |
| --- | --- | --- | --- |
| `/lobby` | `client/lobby` byggd som `public-lobby` (alias till `runtime/public-lobby-catalog.mjs`): Header, Hero, Operatorer, Rum, Dealers, Så fungerar det, SelectionTicket | `/api/operators`, `/api/operators/{slug}/rooms` (Render via platform-routing), D-ID-assistent `/api/public-assistant` | läser publicerade op*-paket och doc:admin-rum; ingen skrivning |

Spelstart från lobbyn: `/play/{game}?operator=&table=` (`client/lobby/lib/catalog.mjs:86`).

## 2. Redirects in i Admin

| Från | Mekanism | Landar |
| --- | --- | --- |
| `/control/*`, `/studio/*`, `/partner/*`, `/admin/*`, `/lobby/*` | `vercel.json` skickar alla (även `/control`) till studio-tjänsten | middleware nedan |
| `/control/<x>` och `/studio/control/<x>` (GET/HEAD) | `middleware.ts` > `lib/legacy-studio-document.mjs` > `adminDocumentHref` (307, no-store); bara nycklarna dealer, dealerId, operator, room, table, game, composition, lane, tab, role, event, variant, situation, view, category följer med; `lane` blir `composition` | tabell nedan |
| `/login`, `/set-password`, `/control/login`, `/control/set-password` | samma modul | `/admin/login?returnTo=...`, `/admin/set-password?t=...` (token bara om exakt en) |
| toppnivå `/guide /videos /probe /events /tree /compositions /rehearsal /preview /zones /openclaw /operator-chat /clips /administration` (+ `/activity`, `/lissabon`: query släpps) | samma modul | som `/control/<x>`; `/lissabon` > `/admin`; `/activity` > `/admin/rehearsal?<dealer,operator,table,room,game,composition>` |
| `/control/administration?tab=` | `adminDocumentHref` | accounts > `/admin/admin/accounts`, finance > `/admin/ekonomi`, partners > `/admin/admin/api`, tables > `/admin/rooms`, operations > `/admin/drift`, media-review > `/admin/media-review`, utan tab > `/admin/drift` (tab-parametern följer med som skräp) |
| `/control/dealer-forge?dealerId=x` | `canonicalControlHref` | `/admin/dealer-studio?view=generate&dealer=x` |
| `/studio` (rot) | `app/page.tsx`, permanent | `/admin`; med query `adminDocumentHref('/control/clips?...')` = `/admin/dealer-studio?...` |
| `/admin/material-library`, `/admin/deletion`, `/admin/publication` | server 307 (`design-preview.mjs`) och `adminRetiredPaths` | `/admin/assets`, `/admin/structure`, `/admin/rooms` |
| `/admin/ai/models`, `/admin/ai/chat`, `/admin/dealer-agent`, `/admin/probe`, `/admin/admin/players` | klient (`entry.tsx`, `adminRetiredPaths`), query och fragment följer med | `/admin/openclaw?tab=models`, `?tab=assistant`, `?tab=agent`, `?tab=probe`, `/admin/players` |
| `/admin#<vy>` (ops, players, tx, team, api, bj, dealers, shoes, tables, background, voice, clips, media, archive, tree + slugnamn) | `legacyControlBookmarkHref` i `entry.tsx` | `adminDocumentHref('/control/<slug>')`; ankare `#deal` (clips), `#clips` (voice) |
| `/preview/*` | `app/preview/[...path]/route.ts` | 410 "Äldre förhandsvisning avslutad" (utom `compositor.js`, `geometry.js`) |
| `/lab`, `/labb`, `/studio-astrid`, `/studio-lissabon`, `/labb-lissabon`, `/labb/filmer`, `/labb/zoner`, `/labb/guide` | `apps/web/next.config.mjs` > `/control...` > `adminDocumentHref` | `/admin`, `/admin/videos`, `/admin/compositions`, `/admin/guide` |
| `/administration`, pensionerade `/control/*` i unified UI | `packages/navigation/server/platform-routing.mjs` (redirect eller reject) | som ovan |

`/control/<x>` till destination (`adminDocumentHref`): `/admin`: (tom), overview. `/admin/clips`: studio, lab. `/admin/dealer-studio`: clips; `?view=generate`: dealer-forge;
`?view=speech`: speech, voice. `/admin/companies`: companies, `lanes?tab=companies`. `/admin/rooms`: rooms, lanes, legacy-rooms, game-tables, bj, dealers, tables, publication.
`/admin/compositions`: compositions, preview, backgrounds, background, zones. `/admin/rehearsal`: rehearsal, activity. `/admin/assets`: library (`role=background|table` > `tab=backgrounds|tables`).
`/admin/videos`: videos, media, archive. `/admin/replies`, `/admin/guide`. `/admin/events`: events, tree, presentation-events. `/admin/openclaw?tab=`: models (openclaw), probe, drift (ops), agent (operator-chat, `openclaw?tab=chat`).
`/admin/players`: players. `/admin/admin/accounts`: team. `/admin/ekonomi`: transactions, tx. `/admin/admin/api`: integration, api. `/admin/drift`: shoes. `/admin/structure`: deletion.

Partner: `/partner/{slug}/overview` > ops, `integration` > api, `rooms|tables` > bj; `theme, design, background, dealers, test` viks in i Spelrum och `players, tx, reports, stats, pit, shoes, roulette, baccarat` i Integration (`partnerWorkspaceView`).

## 3. Dubbletter

Hög = samma fält i samma dokument skrivs av två eller fler ytor med olika klient eller UI. Bevis är fil och symbol.

| # | Vad | Väg A | Väg B (och C) | Bevis | Allvar |
| --- | --- | --- | --- | --- | --- |
| D1 | Rum och publicering | `/admin/rooms` + `/admin/admin/operators`: RegisteredStudio | AdminPublicationPage publiceringsgren (död sedan `/admin/publication` pensionerades) och Partner `/partner/{slug}/rooms` (branding) | båda filerna importerar `publishOperatorPackage`, `togglePackageLane`, PresentationRoomCreate, ControlResourceLifecycle och postar `operator-package`; `admin-publication-page.tsx:225-297` renderas bara när `initialTab!=='companies'`, och `case 'publication'` nås inte (`redirected`) | Hög |
| D2 | Dealerns klipp, vila, tal | Klippkarta `/admin/clips` (ConnectedClipMap) | `/admin/dealer-studio` (LabStudio), `/admin/videos` (ControlVideosPage) | tre editorer skriver `doc:project.lines/idlePolicy/dealerIdlePolicies/mediaPolicy`; två projektklienter mot `PUT /api/project`: `connected-studio.mjs createStudioClient` mot `studio-session.tsx` + `lab-studio.tsx requestJson`; samma `upsertMediaVariantPolicy` används i `studio-policy.mjs` och `lab-studio.tsx` | Hög |
| D3 | Sammansättningar (lager, mall) | StudioCompositionPanel i Klippkartan (Scen & lager) | `/admin/compositions` (ControlPreviewPage + `lane-editor.tsx`); RegisteredStudio "gemensam mall"; RegisteredMaterialLibrary för lagren | alla skriver `project.lanes` / `layerAssets` via `validateProject({...project,lanes})` | Hög |
| D4 | Skapa, importera, arkivera, radera dealer | `/admin/dealers` (DealerDirectory) + `/admin/clips?tool=import` | `/admin/dealer-studio` (DealerRegistration, DealerRemoval, DealerMaterialCreator/Runway), Klippkartans studio-lifecycle-panel, `/admin/structure` | två livscykelklienter mot samma `/api/dealers/*` och `/api/videos/*`: `client/admin/lib/studio-lifecycle.mjs` och `components/dealer-removal.tsx` + `dealer-media-library.tsx` | Hög |
| D5 | Vila (idle) | StudioPolicyPanel + RouletteIdleEditor (Klippkarta, `studio-policy.mjs:78-104`) | IdlePolicyEditor + RegisteredIdleEditor (`/admin/dealer-studio`, vy idle); "Tal vid inaktivitet" (ProbeEditor) är en tredje yta | samma `draft.idlePolicy` / `dealerIdlePolicies` | Hög |
| D6 | Talade repliker | StudioSpeechPanel (`/api/speech-build`, speech_requests) | DealerSpeechSlotEditor/Settings (`bindSpeechSlotStandard`), `/admin/replies` (`/api/replies`), `/admin/media-review` (voiceline-review), roulette-media-review | fyra vägar till replikens ljud, bild och godkännande | Medel |
| D7 | Spelhändelser och körregler | `/admin/events` (ControlTreePage/EventsPage) | Klippkartans körregel (`IDLE_EVENT_RULES`, `project.triggers`) | båda skriver `project.triggers` och `lines[].variants.triggerIds` | Medel |
| D8 | Bolag, medlemmar, roller | `/admin/companies` (ControlOperatorDirectory) | `/admin/admin/operators` (bolagsvy), Partner `/team` (TeamView); `/admin/admin/log` bara länkar dit | `operator-membership`/`operator-role` mot `POST /api/partner/team` på samma operator_memberships | Medel |
| D9 | Lobby | `/lobby` (public-lobby) | `/admin/lobby` (admin-bygget) | samma `client/lobby`, två byggen i `client/build.mjs`, olika katalog (`/admin/_data/catalog` mot spelarkatalogen); bara `runtime/banner.tsx` (död) länkar | Medel |
| D10 | Menyer och redirecttabeller | `admin-navigation.ts` + `ADMIN_WORKSPACE_TOOLS` | `scout-navigation.mjs` (gammal meny, `/admin/videos > dealer-studio`), `backoffice-navigation.mjs`, `kevin-bo/navigation.mjs` (24 vyer, 4 levande), `workspace-surfaces.mjs` (13 Control-vyer), `control-flow.mjs`, `legacy-studio-document.mjs`, `control-workspace.mjs`, `admin-routing.mjs adminHref`, `adminRetiredPaths` | 10 platser kodar samma omdirigering; `guide.json` länkar till `/admin/publication` | Hög |
| D11 | Ekonomi mot Betalningar | `/admin/ekonomi` | `/admin/admin/payments` | båda läser `GET transactions` och `readEconomyJournal` | Låg |
| D12 | Konton | `/admin/players` | `/admin/admin/accounts` | samma accounts-dokument, delat med `section` (medvetet) | Låg |
| D13 | Assistenter | `assistant-widget.js` på alla sidor (`/api/assistant`) | OpenClaw-flikarna Adminroboten och Dealerns agent (`/api/chat`); DealerImportAssistant chat-läge (död) | tre chattar med tre API:er | Medel |

README (`apps/studio/docs/README.md`) påstår "Ingen funktion finns på två ställen". D1-D8 visar att det inte stämmer.

## 4. Onådd kod

Inventering: `apps/studio/components` 209 filer (111 kod, 46 css, 39 tester, 3 d.mts, 10 övrigt), `apps/studio/lib` 252 (162 kod, 85 d.mts, 3 tester, 2 övrigt),
`client/admin|lobby|runtime` 87 kodfiler, `app/api` 49 routes. Av 322 kod-/css-/json-kandidater i components+lib nås 306 av minst en rot; av de 16 övriga
är `layer-media-inspection-worker.mjs` (startas som Worker via sökväg) och `studio-theme.module.css` (css composes) falska träffar.

### 4a. Helt onådda (ingen sida, route, verktyg eller annan modul importerar dem)

| Fil | Antal | Bevis |
| --- | --- | --- |
| `components/family-video-upload.tsx` | 1 komponent | importeras av ingen; bara `dealer-workspace.test.mjs`, `studio-content.test.mjs`, `test/family-video-upload.test.mjs` nämner den |
| `components/page-template.module.css` | 1 css | `page-template.mjs/tsx` importerar den inte; ingen referens |
| `client/runtime/banner.tsx` | 1 | ingen importör; innehåller enda länken till `/admin/lobby` |
| `client/lobby/components/roulette-wheel.tsx`, `theme-provider.tsx`, `hooks/use-toast.ts` | 3 | ingen importör i lobbyns importgraf |
| `client/admin/public/**` (5 bg/bord, 8 klippbilder, logotyper, placeholders) | 19 bilder | filnamnen finns inte i någon kod; `client/lobby/public` har 9 oanvända ikoner/placeholders |
| `lib/social-store.mjs`, `video-classifications.mjs`, `video-uploads.mjs`, `zone-workspaces.mjs`, `video-alpha-reader.mjs`, `background-zone-schedule.mjs` | 6 | bara tester (`test/social.test.mjs`, `test/cloud-video-upload.test.mjs`, `test/zone-cloud-store.test.mjs`, `lib/background-zone-schedule.test.mjs`) och `tools/studio-isolated-qa.mjs`-kopieringslistan; de tre första skriver lokala filer (`writeFile`) |
| `lib/studio-native-auth.mjs`, `lib/media-family-resolver.mjs` | 2 | tvårads-återexporter ("Compatibility export") utan importör i apps/studio |
| `lib/dealer-import-plan.mjs` + `dealer-import-kevin-source.json` | 1 (+1 json) | bara `tools/dealer-import-plan.mjs` och test (frusen Kevin-import) |

### 4b. Nås bara via API-route som ingen anropar (6 routes)

`/api/zones`, `/api/zones/clips`, `/api/zones/clips/[id]`, `/api/zones/reference` (lib: `zone-cloud-store.mjs`, `zone-reference.mjs`, `zone-cloud-schema.sql`,
egen Neon-databas `croupier_zones` via `CROUPIER_ZONES_DATABASE_URL`), `/api/simulate` (delar `presentation-director.mjs` med `/api/presentation/decision`) och `/api/partner-preview`
(`partner-preview.mjs`, `partner-preview-fixtures.mjs`). Bevis: grep efter `api/zones`, `api/simulate`, `api/partner-preview` ger bara routefilen, `next.config.mjs` och libfilen. 4 lib-moduler + 1 sql.

### 4c. Control-era som fortfarande är monterad i Admin (kandidater, inte bevisat onådda)

Nås från levande sidor men hör till Astrid-/Kevin-/labbtiden.

| Funktion | Komponenter | Lib | API | Bevis |
| --- | --- | --- | --- | --- |
| Dealer-forge (Runway) | `dealer-forge-page.tsx` | `dealer-forge-{api,catalog,images,service,store}`, `runway-client` | `/api/forge` | bara `lab-studio.tsx` vy generate; tabellerna forge_dealers/forge_jobs |
| Social/companion | `social-chat-panel.tsx` | `social-server`, `companion-server` (+`social-store` testbunden) | `/api/social{,/chat,/profile,/status,/voice}` | bara `events-preview.tsx`; Director, lokal fil |
| Röstförhandsvisning | `voice-preview-panel.tsx` | `voice-preview.mjs` (skriver `lab/data/voice-cache`) | `/api/voice{,/[id]}` | bara `gateway-panel.tsx` |
| Äldre klippkontroller | `legacy-clip-editor.tsx` | `legacy-clip-inventory`, `studio-clip-controls-api` | `/api/clip-controls` | `lab-studio.tsx:315,318`, `control-videos-page.tsx:147`; `legacyClipPolicy` |
| Astrids probe | `control-probe-page.tsx`, `probe-editor.tsx` | `probe-server` | `/api/probe` | ProbeEditor renderas bara om `dealerId==='astrid'` (`control-probe-page.tsx:34`) |
| Bettalotto-observer | `partner-reference.tsx`, `activity-log.tsx` (del) | `partner-observer`, `partner-reference` | `/api/inputs{,/events,/reference}` | kräver `BETTALOTTO_PARTNER_*`-env |
| Gateway/agentchatt | `gateway-panel.tsx`, `native-lab-chat.tsx`, `idle-reactions.tsx`, `event-test-panel.tsx` | `studio-server`, `comparison-studio`, `idle-advice-server` | `/api/chat`, `/api/presentation/{idle,decision}` | bara OpenClaw-fliken Dealerns agent, Provspelning och EventsPreview |

Totalt ca 11 komponenter och 19 lib-moduler.

### 4d. Döda grenar i levande filer

- `components/studio-administration.tsx`: sektionerna `lanes`, `rooms`, `dealers` (grupp `tables` filtreras bort av `ACTIVE_GROUPS`, ingen sida skickar `initialGroup="tables"`) med åtgärderna game-lane, game-lanes/{create,remove}, room, tier; åtgärderna tournament, pitboss, clip-landing, clip-never, gen-landing, gen-verdict har ingen knapp men finns kvar i `studio-admin-api.mjs`.
- `components/admin-publication-page.tsx`: publiceringsgrenen (D1), ca 75 rader.
- `client/admin/.../dealer-import-assistant.tsx`: `mode='chat'` och `AdminAssistantPage` fristående (`chatActive={false}` i `entry.tsx`).
- `components/native-administration.tsx`: icke-inbäddat läge (logga ut, `renderOperations`); bara `embedded` används.
- `components/kevin-bo/views/integration.jsx`: `DISCONNECTED` (bara förhandsvisningssnapshot; partner kräver `preview:false`); `kevin-bo/navigation.mjs`: 20 av 24 vyer samt `INTERNAL_LINKS`.
- `packages/navigation/workspace-surfaces.mjs`: Control-ytan (`CONTROL_PREVIEW_VIEWS`, `staffTools`, `legacyControl`) renderas inte längre; används bara för att känna igen gamla adresser.
- Bo/craig-tabellerna (`lab_sessions`, `bo_game_handoffs`, `bo_lab_handoffs`, `craig_player_links`) används av Admin- och Partner-inloggning och kontohantering; inte J09-kandidater förrän sessionerna flyttas.

## 5. Frågor till Jakob

1. Klippkartan, dealer-studio, videos och compositions: vilken väg är kanon för klipp, vila, tal och sammansättning (D2, D3, D5)? Förslag: Klippkarta + Dealerregister + Bord & bakgrunder + Spelbolag & rum, radera `/admin/dealer-studio`, `/admin/videos`, `/admin/compositions` med sina 7-14 inlänkar var.
2. `/control/clips` landar på `/admin/dealer-studio`, `/control/studio` och `/control/lab` på `/admin/clips`. Vilket ska gamla bokmärken få?
3. Astrid-spår: Tal vid inaktivitet (bara Astrid) och Talgranskning (roster `{astrid}`) fungerar inte för Dragan. Ska de bort eller byggas om?
4. `/admin/lobby` har ingen levande länk (banner.tsx är död). Radera, så att bara `/lobby` finns kvar (D9)?
5. `/admin/admin/operators` (papperskorg och pausade bolag) saknar menypost. Behövs vyn eller räcker `/admin/companies`?
6. Ekonomi mot Betalningar läser samma journal (D11). Behåll en?
7. Forge/Runway, social/companion, röstförhandsvisning, Bettalotto-observer och `/api/clip-controls` (4c): radera med sina routes och tester, eller finns ett pågående bruk?
8. Medlemskap skrivs både av Admin (Bolag & team) och Partner (Team). Ska Admin äga det och Partner bara läsa (D8)?
9. Partner: 13 extra adressnamn och platshållaren Integration. Räcker Översikt, Spelrum, Team, och ska övriga slugs ge 404?
10. `/api/zones*`, `/api/simulate`, `/api/partner-preview` och databasen `croupier_zones`: ta bort (4b)?
11. Redirects: vill du ha en enda tabell (`admin-workspace-routes.mjs`) och radera de andra nio (D10) samt `vercel.json`-routen `/control/*` och `apps/web`-redirectarna, eller ska bokmärken leva en release till?
12. Lobbyn länkar fortfarande `/play/{game}`; underlaget säger `/game`. Ska Admin-sidorna (Provspelning, Rum) också peka om?
13. Ska `studio-administration.tsx` städas från de döda sektionerna och åtgärderna (4d), eller behålls kontraktet för `croupier_game`-konfig?


## 6. PR1: en ingång per sak — 22 oktober 2026

Avsnitt 1–5 ovan är kodinventeringen före denna ändring. Detta avsnitt beskriver den avgränsade leveransen på codex/admin-en-ingang, från main 7afae4260c28f1e2a18625879f28a95156fa13e0.

- Översikten har tre stora val: **Skapa dealer**, **Fortsätt redigera**, **Hantera spelbolag**. Pilrader och den parallella länksamlingen är borttagna. Skapa öppnar det befintliga formuläret; klicket sparar ingenting.
- **Dealers** äger registret och dealerns verktyg. Klippkartans extra registerflik är borttagen. Befintlig klippredigering och uppladdning finns kvar.
- **Ekonomi** samlar översikt och betalningar. **Bolag & team** visar befintlig ändringsjournal på valt aktivt bolag, med exakt bolags-ID/slug och ny komponentidentitet när bolag byts. Mellansidan för Bolagsjournal är borttagen.
- Fördjupning är upplöst: dealerbundna verktyg ligger på dealern; guiden heter **Hjälp** under System. Ingen editor har slagits samman i denna PR.
- OpenClaws samlingssida är borttagen: **Taldrift** finns under Drift, **Systeminställningar** under System, och agent/probe under dealern. Adminrobotens separata sida är borttagen; den globala assistenten finns kvar. Befintliga behörigheter och driftspärrar återanvänds.

### Borttagning och avgränsning

7 av de 9 utpekade lib-modulerna tas bort, tillsammans med de 2 komponenterna och samtliga 6 oanropade API-routes i 4b. Deras exklusiva zon-/previewhjälpare tas också bort. Aktiv partner-testdata har flyttats från produkt-lib till test/fixtures. Testerna använder uttryckliga temporära fixtures; ingen alternativ produktdatabas eller lokal produktväg införs.

Två korrigeringar av raderingslistan: **social-store.mjs** lämnas enligt PR #354:s skydd; **dealer-import-plan.mjs** och dess JSON lämnas eftersom tools/dealer-import-plan.mjs är en faktisk anropare och K05-arbetet fortfarande använder underlaget. Borttagning av kod är inte tillstånd att radera den externa zondatabasen, historik, media eller miljövariabler.

Skyddade #354/#358-filer, client/lobby/**, rumssidan /admin/rooms och services/** är orörda. Vid integration finns små överlapp att granska i **.githooks/pre-commit-full** (testlistan, #354) och **test/game-entry-auth.mjs** (direktimport av delad auth, #358). Befintliga API-kontrakt ändras inte; endast de sex uttryckligen pensionerade rutterna försvinner.

### Bokmärken

Dokumentomdirigeringarna är samlade i admin-workspace-routes.mjs. Serverns GET/HEAD autentiserar före omdirigering; klienten använder samma destinationsfunktion. Frågeparametrar och fragment behålls, förutom den pensionerade OpenClaw-fliken som förbrukas och lane som normaliseras till composition. Upprepade bolags-/rumsparametrar lämnas till destinationssidans validering.

| Tidigare bokmärke | Ny destination |
| --- | --- |
| /admin/tools | /admin/dealers |
| /admin/admin/payments | /admin/ekonomi?tab=payments |
| /admin/admin/log | /admin/companies |
| /admin/ai/chat | /admin |
| /admin/openclaw, tab=drift | /admin/drift?tab=speech |
| /admin/openclaw?tab=models | /admin/ai/models |
| /admin/openclaw?tab=agent | /admin/dealer-agent |
| /admin/openclaw?tab=probe | /admin/probe |
| /admin/openclaw?tab=assistant | /admin |

Äldre /control/ops, /control/probe och /control/operator-chat går direkt till samma funktionshem. /control/openclaw behåller sin äldre modell-/chattolkning. Befintliga alias för material-library, deletion, publication och admin/players finns kvar i samma tabell. /studio-prefixet stöds. De sex pensionerade API-rutterna omdirigeras inte till dokument.

### Verifiering och produktionsgräns

- Full Studio-kontroll: frontendtyper godkända, 2 191 tester godkända, 29 överhoppade, 0 fel.
- Full Admin-kontroll: 354 godkända, 1 överhoppat, 0 fel över kontrollens testgrupper.
- Efter sista rubrik-/dokumentändringen: journal och bolagsbyte 12/12; slutlig pre-commit verifierar ändrade källor.
- check-orphan-tests: 572 kandidater, 0 föräldralösa tester (före nytt bolagsbindningstest i befintlig fil).
- raderingsgrind mot main med staged källor: 29 borttagna filer, 0 importer, 0 registerrader. Historiska inventeringsreferenser är dokumentation, inte konsumenter. Den vanliga main-grinden körs även på committad leverans.
- Klientbygget lyckades. Kort isolerad kontroll visade startsidans tre val, direkt öppnat dealerformulär, dealerbundna verktyg, Ekonomis två vyer, Taldrift och Systeminställningar. Bolagsregistrets anslutning stöddes inte av fixturen; journalens bolagsisolering verifieras i kodtester. Fixturen och dess flik stängdes efter Jakobs förtydligande.
- **Detta är inte produktionsacceptans.** Ingen deploy, migrering, providerändring eller produktionsskrivning utförd. Produktionens UI och fungerande navigering är slutmålet; Claude granskar och integrerar PR:n före kontroll i den publicerade produkten. Ingen planaktivitet markeras VERIFIED här.

## 7. Förslag till senare flöde — endast produktförslag, ingen kod i PR1

Utgå från TERMINOLOGI: dealer, klipp, lager, sammansättning, spel, bolag och rum har separata identiteter. En dealer ska kunna återanvändas i flera kompatibla scener utan att kopieras för varje bakgrund.

1. **Skapa dealer.** Namnge dealern och öppna dess klippkarta direkt. Behåll en enda ingång för personens namn och identitet.
2. **Sätt klippen.** Arbeta med kategori, situation, standardklipp och varianter på klippkartan. Posevarianter, idlepool och talfack ska följa samma modell efter K05-besluten. Grundloop, Klipp och Vila blir delar av denna editor.
3. **Sätt scenen.** Välj kompatibel bakgrund, dealer och bord i en gemensam sceneditor. Scen & lager och Avancerad sammansättning förenas här; separata lagers identiteter och sparade kompatibilitetsregler bevaras.
4. **Tilldela alternativen.** Ange vilket spel och vilket bolag/rum som får använda vilka dealers, bakgrunder och bord. Rumsspecifika val följer roomOverrides; ett valt rum får inte ändra en gemensam mall av misstag.
5. **Prova och publicera.** Visa exakt vad som är valt, vad operatören får byta och vad som saknas. Återanvänd befintlig publicering/versionering och speltransport. Inga nya parallella register eller launchvägar.

Exempel: ett Blackjack-erbjudande kan tillåta **två dealers och tre bakgrunder**, tillsammans med angivna kompatibla bord. Operatören väljer bland godkända alternativ. Det kräver inte sex kopior av dealern eller automatiskt alla tänkbara kombinationer; kompatibiliteten styr.

Detta införs först efter #354 och #358 samt K05-besluten. Innan kodstart ska omfattning och acceptanskriterier tas in som en aktivitet i den befintliga masterplanen med status.json som enda statuskälla. Detta förslag skapar ingen separat tracker och ändrar inte nuvarande datamodell.
