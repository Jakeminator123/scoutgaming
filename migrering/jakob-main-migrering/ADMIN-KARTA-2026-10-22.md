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


## 6. PR #359 — rättad CSS och samlad navigation — 23 oktober 2026

Jakobs utökade uppdrag ersätter PR1:s ursprungliga begränsning till yttre navigation. Branch `codex/admin-en-ingang` har integrerat main 7e51bb550ed078e75e561a0ca00fc5d79bc7a842, inklusive #354. Konflikten i JOHN-HANDOFF är löst med båda ägarnas avsnitt bevarade. #358 är nu mergad och integrerad från main. Denna PR gör inga egna ändringar i dess lobbyfiler eller rumssidan.

### Rotorsak och åtgärd

- Admin använder en separat esbuild-klient. GatewayPanel förlitade sig på gamla globala CSS-regler som inte laddades där. Komponenten har nu egen CSS-modul. Tailwind-bygget söker också i återanvända Studio-komponenter, så deras layoutklasser följer med.
- Gamla hela editorsidor låg inbäddade i nya skal. LabStudio, ControlVideosPage, ControlPreviewPage, ControlActivityPage och ControlProbePage samt deras exklusiva tester är borttagna. Den befintliga klippkartan äger nu tal, dealerinställningar och scenredigering. Materialskapandet har en egen fokuserad sida med bevarat skydd för osparat arbete.
- Brödsmulor, verktygens extra länkrad, registret i klippkartan och den extra importflikraden är borta. Kartans zoomkontroller visas endast i kartvyn. Hela editorsidor får full bredd. System har en enda enkel grupp med länkar.
- Hjälpens separata menykarta hade andra namn och adresser. Hjälp och sidomeny läser nu samma definition i packages/navigation/admin-navigation.mjs. /admin förblir översikt även om ett gammalt bokmärke har dealer- eller rumsparametrar.

### Nuvarande karta

```text
/admin  Översikt: Skapa dealer | Fortsätt redigera | Hantera spelbolag
|
+-- Studio
|   +-- Dealers /admin/dealers: skapa, välj, arkivera/återställ
|   +-- Klippkarta /admin/clips: vald dealer + valt spel
|   |   +-- Klippkarta: standardklipp, varianter, uppladdning
|   |   +-- Röst & tal ?panel=room: inspelat, generering, realtid
|   |   |   +-- Dialogtest /admin/dealer-agent
|   |   |   +-- Tal vid inaktivitet: bara där stödet finns (Astrid)
|   |   +-- Svarsbibliotek /admin/replies: vald dealers svar
|   |   +-- Skapa material /admin/dealer-studio?view=generate
|   |   +-- Inställningar ?panel=dealer: dealer och användning
|   |   +-- Scen & lager ?panel=layers: en gemensam mallredigerare
|   +-- Bord & bakgrunder /admin/assets: gemensamt materialbibliotek
|
+-- Administration
|   +-- Spelbolag & rum /admin/rooms
|   +-- Bolag & team /admin/companies: journal på valt bolag
|   +-- Spelarkonton /admin/players
|   +-- Drift /admin/drift: även taldrift
|   +-- Ekonomi /admin/ekonomi: även betalningar
|
+-- System: Systeminställningar | Kopplingar & användning
            Integrationer | Konton & åtkomst | Hjälp
```

Spelhändelser/regler och talgranskning behåller sina specialiserade kontroller. De är inga extra huvudmenyer. Datamodell, behörighet, lagringsägare och publiceringskontrakt är oförändrade.

### Bokmärken

| Gammal adress | Destination |
| --- | --- |
| /admin/dealer-studio utan view=generate | /admin/clips; speech → panel=room, settings → panel=dealer |
| /admin/videos | /admin/clips |
| /admin/compositions | /admin/clips?panel=layers |
| /admin/probe | /admin/clips?panel=room |
| /admin/rehearsal | /admin/rooms |
| /admin/tools | /admin/dealers |
| /admin/admin/payments | /admin/ekonomi?tab=payments |
| /admin/admin/log | /admin/companies |
| /admin/ai/chat | /admin |
| /admin/openclaw, tab=drift | /admin/drift?tab=speech |
| /admin/openclaw?tab=models | /admin/ai/models |
| /admin/openclaw?tab=agent | /admin/dealer-agent |
| /admin/openclaw?tab=probe | /admin/clips?panel=room |
| /admin/openclaw?tab=assistant | /admin |

Motsvarande gamla /control- och /studio/control-bokmärken leder direkt till samma destinationer. Endast dokumentläsning omdirigeras; API:er och mutationer gör det inte. Dealer, spel, sammansättning, rums-/bolagsval och fragment bevaras. Upprepade identiteter behålls för mottagarens validering. lane normaliseras till composition; pensionerade view/tab-parametrar förbrukas när målpanelen ersätter dem. Inloggningsreturer accepterar bara avsedda lokala dokument och tillåtna parametrar.

### Raderingsgräns och verifiering

Den ursprungliga städningen av 7 oanvända lib-moduler, 2 komponenter och 6 oanropade API-routes ingår. Social-store städades separat i #354; dealer-import-plan har aktiv verktygsanropare och behålls. De senare editorborttagningarna avlägsnar deras exklusiva tester; behörighet, CAS, rumsisolering, osparade utkast och sparade förhandsvisningsrevisioner testas i de aktiva ytorna.

Faktiska slutkontroller och produktionsgräns finns i [JOHN-HANDOFF](../../docs/JOHN-HANDOFF.md). Webview-provet använder byggda produktionsfiler och syntetiska, skrivskyddade serversvar. Det verifierade dialoglayout, flikbyten, scenval och skapande av scen i minnesutkast; det är inte produktionsacceptans. Ingen databas, media, drifttjänst eller produktion har ändrats. Ingen planaktivitet markeras klar.

## 7. Visuell målbild och återstående produktarbete

Utgå från TERMINOLOGI: dealer, klipp, lager, sammansättning, spel, bolag och rum har separata identiteter. En dealer ska kunna återanvändas i flera kompatibla scener utan att kopieras för varje bakgrund.

**Ansvarsfördelning i arbetsytan:** Studio är utvecklarens/skaparens plats för dealers, klippkartor, scener och spelupplägg. Administration hanterar bolag, konton, tillgängligt spelutbud, drift, ekonomi och system. Studio producerar de återanvändbara delarna; administrationen kopplar dem till bolagens erbjudanden. Detta är en uppdelning av arbetsuppgifter och navigation, inte nya roller, behörigheter eller parallella appar i PR1.

Jakobs förtydligade visuella hierarki: **Spelbolag/domän → spel (Blackjack, Roulette, …) → valbara dealers och spelspecifika bord**. Bakgrunder utgör ett **gemensamt, speloberoende bibliotek** vid sidan av trädet och kan växlas mellan spelen. Spelregler avgör dealer-/bordskompatibilitet; bakgrunder ska inte kategoriseras eller låsas efter spel. Det är arbetsytans relationer, inte ett beslut att införa en ny datamodell i denna PR.

1. **Skapa dealer.** Namnge dealern och öppna dess klippkarta direkt. Behåll en enda ingång för personens namn och identitet.
2. **Sätt klippen.** Arbeta med kategori, situation, standardklipp och varianter på klippkartan. Posevarianter, idlepool och talfack ska följa samma modell efter K05-besluten. Grundloop, Klipp och Vila blir delar av denna editor.
3. **Sätt scenen.** Välj dealer och bord som passar spelet, och en bakgrund från det gemensamma speloberoende biblioteket, i en gemensam sceneditor. Scen & lager och Avancerad sammansättning förenas här; separata lagers identiteter och sparade kompatibilitetsregler bevaras.
4. **Tilldela alternativen.** Ange vilket spel och vilket bolag/rum som får använda vilka dealers, bakgrunder och bord. Rumsspecifika val följer roomOverrides; ett valt rum får inte ändra en gemensam mall av misstag.
5. **Prova och publicera.** Visa exakt vad som är valt, vad operatören får byta och vad som saknas. Återanvänd befintlig publicering/versionering och speltransport. Inga nya parallella register eller launchvägar.

**Visuell målbild för operatören:** välj bolag/domän och se dess spel som stora kort eller noder i en mindmap med verklig förhandsvisning. Dealers och bord visas under respektive spel; det gemensamma bakgrundsbiblioteket ligger vid sidan om och kan användas över spelgränserna. Varje kort visar bakgrund, dealer och bord som valbara lager. Lägg till/ta bort tillåtna spel och alternativ direkt med tydliga knappar; drag och släpp kan vara ett komplement, med tangentbordsalternativ. Sparat, osparat och publicerat ska vara lätt att skilja åt. Inga små pilrader som ersättning för arbetsytan. Detta är ett kommande gränssnitt, inte en funktion som PR1 påstår sig leverera.

Exempel: ett Blackjack-erbjudande kan tillåta **två dealers och tre bakgrunder**, tillsammans med angivna kompatibla bord. Operatören väljer bland godkända alternativ. Det kräver inte sex kopior av dealern eller automatiskt alla tänkbara kombinationer; kompatibiliteten styr.

Den sammanhållna operatörsytan och ändrade kombinationsregler kräver K05-besluten; #358 är nu integrerad. CSS- och navigationsstädningen i avsnitt 6 ingår redan i #359. Innan kodstart ska omfattning och acceptanskriterier tas in som en aktivitet i den befintliga masterplanen med status.json som enda statuskälla. Detta förslag skapar ingen separat tracker och ändrar inte nuvarande datamodell.
