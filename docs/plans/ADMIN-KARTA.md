# Karta över /admin och /partner

> **Inventering, ingen plan.** Läst på `main` 5bed596d0a, 28 oktober 2026. Bara läsning; ingen kod ändrades. Beställd av Jakob som underlag för att strukturera repot och framför allt för att göra Admin och partnerportalen enklare, smidigare och snyggare. Planen för förenklingen är [ADMIN-FORENKLING.md](ADMIN-FORENKLING.md); den här filen konkurrerar inte med den. Ord enligt [TERMINOLOGI](../../apps/studio/docs/TERMINOLOGI.md). Läs om koden innan något byggs: radnummer och listor åldras fort.
>
> "oklart" betyder att koden inte gav svaret. Underlaget är egen läsning plus tre läsagenter med stickprov.

Sökvägar i tabellerna räknas från reporoten.

## Hur /admin hänger ihop

- `/admin` är en egen React-app i `apps/studio/client/admin`, byggd till `apps/studio/design-preview-build/` och serverad av `apps/studio/app/admin/[[...path]]/route.ts`. Den kräver personalbehörighet.
- Tillåtna sidor listas i `apps/studio/lib/design-preview-paths.mjs`. Klientens router är `apps/studio/client/admin/entry.tsx`.
- Menyn finns i `packages/navigation/admin-navigation.mjs`.
- Pensionerade adresser och omdirigeringar finns i `packages/navigation/admin-workspace-routes.mjs`. Omdirigering sker med 307 på servern och med `navigate` i klienten. `/control/*` omdirigeras av `apps/studio/middleware.ts` via `lib/legacy-studio-document.mjs` och `packages/navigation/control-flow.mjs`.
- `/admin/clips` och `/admin/scenes` är samma monterade komponent (`ConnectedClipMap`). Djuplänkade verktyg går genom `WorkspaceTool` (`client/admin/components/studio/workspace-tools.tsx`), som först hämtar `GET /api/admin/workspace/<section>`. Okända `/admin/*`-sökvägar hamnar i `RegisteredStudio`. Enligt en agent visas där platshållaren "… ansluts i nästa steg"; det är inte stickprovat.

## Pågående ändringar (28 oktober, kväll)

- `main` var rent och uppdaterat mot origin. Enda ospårade fil: `instruktion-infor-20-prc.txt`.
- **Worktrees:** ingen hade ocommittade ändringar i admin eller partner.
  - `par-admin-dubbletter`, `par-admin-events` och `par-admin-orphans` stod på samma commit som main.
  - Mappen `.claude/worktrees/par-admin-inventering` har grenen `jakob/par-admin-orphans` utcheckad.
- **Öppna PR:er** (ingen rör /admin eller /partner):
  - #456: O02-granskning.
  - #457 och #459: kvitton.
  - #458 Städning 1: 14 filer i `apps/web`, `ops/neon-game/core-schema.sql` och `tools/verify-speech-stream-browser.mjs`.
- **Bara lokalt, utan PR:** `jakob/claude-ci-regression`. Det mesta är tester. Två rader produktionskod rör admin:
  - Död funktion `studioViewForPath` tas bort i `apps/studio/components/studio-types.ts`.
  - En länk i `roulette-start-editor.tsx` byts från `/admin/compositions` till `/admin/scenes`.
- **Plan, inte kod:** [ADMIN-FORENKLING.md](ADMIN-FORENKLING.md) är ett obeslutat utkast. Det vill slå ihop de fem publiceringsknapparna på `/admin/rooms` till en.

## Alla sidor under /admin

Förkortningar: **A:x** = `POST /studio/api/admin/x` (hanteras i `apps/studio/app/api/admin/[...action]/route.ts`). `/studio/api/*` är `/api/*` med basePath. **PUT project** = `PUT /studio/api/project`. Komponentfiler utan sökväg ligger i `apps/studio/client/admin/components/studio/` (klientens) eller `apps/studio/components/` (Studios).

| Meny · URL | Huvudfil(er) | Vad man gör | Skriver (API) | Överlapp | Legacy-tecken | Pågående |
|---|---|---|---|---|---|---|
| **Översikt** · `/admin` | `admin-home.tsx` | Tre genvägskort: skapa dealer, fortsätt redigera, hantera bolag | Nej | – | – | Nej |
| **Sceneditor** · `/admin/scenes` | `connected-clip-map.tsx`, `studio-composition-panel.tsx`, `scene-publication.tsx` | Placerar dealer, bakgrund, bord, kort och spelkontroller i mallen och publicerar placeringen | PUT project. POST `/api/layer-assets/upload` + Blob. A:material-trash(-check). A:operator-package `publish-scene-layout`. POST/DELETE `/api/studio-preview` (spelmotorn via `platform-routing.mjs`) | Samma instans som Klippkarta, med `panel=layers` påtvingat. Samma lagerkomponenter som Bord & bakgrunder. Publicerar paketet precis som Rum | `lane`/`?lane=`, rutan "Automatik / OpenClaw", mappen `client/admin/app/control/(studio)` | Plan (knapp 5) |
| **Klippkarta** · `/admin/clips` | `connected-clip-map.tsx`, `connected-clip-card.tsx`, `studio-policy-panel.tsx`, `roulette-*-editor.tsx` | Kopplar klipp och varianter till fack per situation och dealer, sätter körregler | PUT project. POST `/api/videos/classify` (roulette) | Samma instans som Sceneditor | Feltext "Skapa en i Dealerregister", `connectedLane` | ci-regression: länkbyte i roulette-start-editor |
| ↳ **Röst & tal** (flik) · `?panel=room` | `studio-speech-panel.tsx` | Bygger och granskar dealertal | POST `/studio/api/speech-build`, POST `/studio/api/videos/speech-review`, PUT project | Talgranskning: samma data? oklart | ProbeEditor för Astrid. `/admin/probe`, speech, voice och `openclaw?tab=probe` landar här | Nej |
| ↳ **Inställningar** (flik, panelen heter "Dealer & användning") · `?panel=dealer` | `studio-lifecycle-panel.tsx` | Arkiverar, återställer och raderar klipp och dealer | POST `/studio/api/videos/{archive,delete,delete-check}` och `/dealers/{archive,archive-check,delete,delete-check}` | Samma livscykel som Dealers | Fliknamnet och panelnamnet skiljer sig | Nej |
| ↳ **Ladda in klipp** · `?panel=intake` | `clip-intake-panel.tsx` | Laddar upp klipp och får AI-förslag på fack | POST `/api/dealers/import-proposal`, `/api/videos/upload` + Blob, `/api/videos/classify` | Samma API:er som importassistenten | – | Nej |
| ↳ **Importassistent** · `?tool=import` (även på `/admin/dealers`) | `dealer-assistant-shell.tsx`, `dealer-import-assistant.tsx` | Importerar dealermaterial via chatt eller mappning | GET/POST `/api/dealers/import-proposal`, upload | Kartans "Ladda upp klipp" leder hit, inte till intake | – | Nej |
| **Dealers** · `/admin/dealers` (`?view=create`) | `dealer-directory.tsx` | Skapar dealers, ser klipp och rum per dealer, arkiverar och raderar | PUT project (ny dealer). POST `/studio/api/dealers/{archive,…,delete-check}` | Livscykel som `panel=dealer`, import som `clips?tool=import` | Astrid-kort "Legacyreferens … OpenClaw". `/admin/tools` landar här, men `/control/dealers` landar på `/admin/rooms` | Nej |
| **Bord & bakgrunder** · `/admin/assets` (`?tab=tables` eller `backgrounds`) | `registered-material-library.tsx`, `layer-library.tsx`, `layer-asset-manager.tsx` | Laddar upp, slänger och återställer bord och bakgrunder | POST `/api/layer-assets/upload` + Blob. A:material-trash(-check) | Samma komponenter som i Sceneditor | `/admin/material-library` och `/control/library?role=` landar här | Nej |
| **Spelbolag & rum** · `/admin/rooms` | `registered-studio.tsx`, `operator-game-board.tsx`, `room-game-config.tsx`, `presentation-room-create.tsx`, `partner-appearance.tsx`, `control-resource-lifecycle.tsx` | Väljer bolag, lägger till, pausar och tar bort rum, sätter utseende och spelinställningar, publicerar | A:operator-package (mallar och `refresh-dealer-idle`). A:room-game-config (save-draft/publish). A:presentation-room. A:room-lifecycle. A:room-state. POST `/studio/api/partner/branding` | Samma paketlogik finns i en död publish-flik i `AdminPublicationPage`. Utseendet skrivs via samma branding-API som partnerns Spelrum. Livscykeln finns också på `/admin/admin/operators` | Rubriken "Spelutbud" ≠ menynamnet. "Spelmallar" och "Gemensam mall" betyder mall. Hårdkodad knapp "Publicera PAOWs viloklipp". Länkarna till `/admin/compositions` och `/admin/rehearsal` leder tillbaka hit. Texten "Ny arbetsyta" | **Plan: hela ADMIN-FORENKLING** |
| **Bolag & team** · `/admin/companies` | `admin-publication-page.tsx` (companiesOnly), `control-operator-directory.tsx`, `workspace-tools.tsx` | Skapar bolag, hanterar medlemmar och roller, stänger av och arkiverar, läser journalen | A:operator-create, A:operator-membership, A:operator-role, A:operator-lifecycle. Läser `/studio/api/partner/journal` | Partnerns Team använder annat API (`/api/partner/team`); om det är samma tabell är oklart. Bolagslistan finns också på `/admin/admin/operators` | Control*-namn. Länktexten "Spelrum & publicering". Hämtar hela projektet och alla videos utan att använda dem | Plan nämner sidan |
| **Spelarkonton** · `/admin/players` | `accounts-pages.tsx` → `connected-services.tsx` → `native-administration.tsx` → `studio-administration.tsx` | Skapar spelarkonton, ändrar status och lösenord | A:players/create, A:players/status, A:players/password | **Samma komponent och samma läsningar som Konton & åtkomst.** Uppdelningen görs bara med CSS (`client/admin/app/studio.css:640`) | Native*-namn, inbäddad "Logga ut". `/admin/admin/players` landar här | Nej |
| **Drift** · `/admin/drift` (`?tab=status` eller `speech`) | `connected-services.tsx`, `studio-administration.tsx`, `taldrift-panel.tsx` | Ser driftstatus, sko och provet för delat bord. Sätter GPU-läge för dealertal | Bara fliken speech: A:moving-drift | – | Dold grupp `tables` med skrivvägarna game-lane(s), room och tier finns kvar men nås inte. `/admin/openclaw` och `/control/ops` landar här | Nej |
| **Ekonomi** · `/admin/ekonomi` (`?tab=overview` eller `payments`) | `connected-economy.tsx` (+ `components/ops/ui.tsx`), NativeAdministration | Följer transaktionsjournalen i grafer och lista | Nej | Båda flikarna läser `transactions` var för sig | Fliken payments bäddar in hela NativeAdministration inklusive "Logga ut" | Nej |
| **Systeminställningar** · `/admin/ai/models` | `connected-services.tsx` → `openclaw-workspace.tsx` | Väljer AI-modell per agent, öppnar OpenClaw-dashboarden | PATCH `/api/openclaw/admin`. POST samma API med `dashboard.open` | – | Heter OpenClaw överallt bakom ett generiskt menynamn | Nej |
| **Kopplingar & användning** · `/admin/structure` | `resource-connections.tsx`, `client/admin/lib/resource-deletion.mjs` | Ser var bolag, rum, dealers, material och mallar används | Nej | Läser samma data som Rum, Dealers och Klippkarta | Klienten heter "deletion" (`/admin/deletion` är sammanslagen hit) | Nej |
| **Integrationer** · `/admin/admin/api` | NativeAdministration (grupp `partners`) | Hanterar partnernas API-nycklar, ser e-postmallar | A:apikeys/create, revoke, rotate, launch, credit | Partnerns Integration är bara text | Sökvägen `admin/admin/*`, grupp-id `partners`, "Logga ut" | Nej |
| **Konton & åtkomst** · `/admin/admin/accounts` | som Spelarkonton | Bjuder in personal, ändrar roll, tar bort | A:users/invite, resend, role, remove | = Spelarkonton | som Spelarkonton | Nej |
| **Hjälp** · `/admin/guide` | `control-guide-page.tsx` → `studio-guide.tsx` (`apps/studio/docs/guide.json`) | Läser hjälptexten | Nej | Hämtar hela workspace-svaret men ignorerar det | `viewPaths` i `studio-types.ts` pekar på pensionerade `/admin/videos`, rehearsal och probe | Indirekt: ci-regression ändrar samma fil |
| *Skapa material* (Studio-flik) · `/admin/dealer-studio?view=generate` | `dealer-forge-page.tsx`, `dealer-material-page.tsx` | Genererar dealermaterial (Runway-jobb, röst, pose) | POST `/api/forge/<dealer>/{anchor,preview,jobs…,profile,pose/adopt}` | – | Namnet "forge". Utan `view=generate` hamnar man på `/admin/clips` | Nej |
| *Svarsbibliotek* (Studio-flik) · `/admin/replies` | `control-replies-page.tsx` | Kategoriserar dealerns inspelade svar | PATCH `/api/replies/<id>` | – | Control*-namn | Nej |
| *Talgranskning* · `/admin/media-review` (ingen inkommande länk hittad) | `connected-services.tsx` → `native-administration.tsx` | Godkänner eller underkänner talpar per dealer | A:voiceline-review, om åtgärden är ansluten (annars "ännu inte ansluten") | Röst & tal: oklart | Laddar hela workspace men använder bara dealer | Nej |
| *Spelhändelser & regler* · `/admin/events` (`?event=`) (ingen inkommande länk hittad) | `control-tree-page.tsx`, `control-events-page.tsx` | Ser händelseträdet, redigerar händelser och varianter och simulerar | PUT project. POST `/api/videos/rescan`. POST `/api/presentation/decision` (om den sparar något: oklart) | Samma projekt-PUT som Klippkarta | Control*-namn, "äldre händelsegrupper och testanimationer", "OpenClaw" i texten | Nej |
| *Dialogtest* · `/admin/dealer-agent` (länk "Testa dialog" i Röst & tal) | `control-openclaw-chat.tsx`, `gateway-panel.tsx` | Chattar med dealerns AI med genererat tal | POST `/api/chat` (om samtal sparas: oklart) | – | ControlOpenClawChat. `/control/operator-chat` landar här | Nej |
| *Spelbolag* · `/admin/admin/operators` (bara tester länkar hit) | `registered-studio.tsx`, `registered-resource-lifecycle.tsx` | Bolagskort med flikarna Aktiva, Papperskorg och Avstängda | A:operator-lifecycle, A:room-lifecycle, A:room-state | Dubblerar Bolag & team och Rum | "operators", `admin/admin/*` | Nej |
| *Intern lobby* · `/admin/lobby` (enda länken finns i oanvända `client/runtime/banner.tsx`) | `apps/studio/client/lobby` | Visar lobbyn med registrerad men opublicerad katalog | Nej | Publika `/lobby` visar bara publicerat | – | Nej |
| *Inloggning* · `/admin/login`, `/admin/set-password` | `apps/studio/app/admin/login/page.tsx` → `studio-login` | Loggar in eller väljer lösenord | POST `/studio/api/auth/{login,reset-request,set-password}` | Samma komponent som `/partner/set-password` | Sidtiteln "Croupier Admin" | Nej |

### Pensionerade adresser

| Gammal | Ny |
|---|---|
| `/admin/material-library` | `/admin/assets` (`role=` blir `tab=`) |
| `/admin/deletion` | `/admin/structure` |
| `/admin/publication`, `/admin/rehearsal` | `/admin/rooms` |
| `/admin/tools` | `/admin/dealers` |
| `/admin/videos` | `/admin/clips` |
| `/admin/compositions`, `/admin/clips?panel=layers` | `/admin/scenes` |
| `/admin/probe` | `/admin/clips?panel=room` |
| `/admin/ai/chat` | `/admin` |
| `/admin/admin/log` | `/admin/companies` |
| `/admin/admin/payments` | `/admin/ekonomi?tab=payments` |
| `/admin/admin/players` | `/admin/players` |
| `/admin/openclaw?tab=…` | drift → `/admin/drift?tab=speech`; models → `/admin/ai/models`; agent → `/admin/dealer-agent`; probe → `/admin/clips?panel=room`; assistant → `/admin` |
| `/admin/dealer-studio` utan `view=generate` | speech → `/admin/clips?panel=room`; settings → `/admin/clips?panel=dealer`; övrigt → `/admin/clips` |
| `/control/*` | Motsvarande `/admin`-sida. Fullständig lista i `admin-workspace-routes.mjs` (`destinations`, `administration`) och `control-flow.mjs` |

Alla omdirigeringar flyttar `lane` till `composition` och `dealerId` till `dealer`.

### Död kod och komponenter utan användare

- `WorkspaceTool case 'publication'` och publish-fliken (steg 1–3) i `AdminPublicationPage` kan aldrig visas, eftersom `/admin/publication` omdirigeras först. `publication` finns ändå kvar i `ADMIN_WORKSPACE_TOOLS`.
- Bara tester importerar fem filer i `apps/studio/components/`: `blackjack-table-geometry-editor.tsx`, `dealer-registration.tsx`, `dealer-removal.tsx`, `dealer-speech-slot-editor.tsx` och `registered-idle-editor.tsx`.
- Alla filer i `client/admin/components/studio/` används av produktionskod. `components/ops/ui.tsx` används bara av Ekonomi.
- `client/runtime/banner.tsx` importeras inte av någon.
- Drift har kvar en dold grupp `tables`, där skrivvägarna game-lane(s), room och tier inte nås från någon meny.

## /partner (nivå 2)

Ingången är `apps/studio/app/partner/[[...path]]/page.tsx`. Den går via `apps/studio/components/workspace-surface-page.tsx` till `components/kevin-bo/partner-operator-workspace.jsx`. Utan bolag visas `components/partner-workspace.tsx`.

- Menyn har fyra poster (`kevin-bo/partner-copy.mjs`, `NAVIGATION`): Översikt, Spelrum, Team och Integration.
- `partnerWorkspaceView()` i `kevin-bo/partner-navigation-guard.mjs` slår ihop 17 vy-id:n (`PARTNER_PREVIEW_VIEWS`) till fyra vyer som faktiskt visas.
- `kevin-bo` är aktiv partnerkod och inget arkiv.

| URL | Meny | Huvudfil | Vad bolaget gör | Skriver | Överlapp · legacy |
|---|---|---|---|---|---|
| `/partner/login` | – | `partner-login.tsx` | Loggar in | POST `/api/partner/login` | – |
| `/partner/set-password` | djuplänk (mejl) | `StudioLogin` | Väljer lösenord | POST `/api/partner/set-password` | Samma komponent som Admin |
| `/partner` | "Partners" | `partner-workspace.tsx` | Söker och öppnar sina bolag. En admin ser också länkar till `/admin` och `/lobby` | Bara utloggning | – |
| `/partner/<bolag>` | Översikt | `kevin-bo/views/overview.jsx` | Ser paketversion och rum. Rutan om spelkopplingen är statisk | Nej | Vy-id `ops`. Propen `tablesOnly` skickas aldrig |
| `/partner/<bolag>/rooms` (+ `/tables`, `/game-tables`) | Spelrum | `kevin-bo/views/rooms.jsx`, `partner-appearance.tsx` | Redigerar rummets utseende: utkast → granska → publicera | GET/POST `/api/partner/branding` (save-draft, discard-draft, review, publish, restore) | Samma rum och samma publicering som `/admin/rooms`. Vy-id `bj` |
| `/partner/<bolag>/team` | Team & behörigheter (kräver `team.read`) | `kevin-bo/views/team.jsx` | Bjuder in, byter roll, stänger av, läser journalen | POST `/api/partner/team` (invite, role, suspend, reactivate) | Överlappar `/admin/companies` |
| `/partner/<bolag>/integration` | Integration | `kevin-bo/views/integration.jsx` | Bara text om att kopplingen inte är ansluten | Nej | Admin har riktig nyckelhantering. Det döda objektet `DISCONNECTED` länkar till `/admin/admin/players` |
| `/partner/<bolag>/{presentation,table-design,backgrounds,lanes,preview}` | djuplänk | – | Visar Spelrum, och URL:en skrivs om | – | Kevin-id:n theme, design, background, dealers, test |
| `/partner/<bolag>/{players,transactions,pit-bosses,shoes,roulette,baccarat,statistics,reports}` | djuplänk | – | Visar Integration, och URL:en skrivs om | – | Kevin-id:n. Vyerna finns inte |

- Partner-API:t (`apps/studio/app/api/partner/[...action]/route.ts` → `lib/partner-session.mjs`) har bara sju åtgärder: snapshot, journal, branding, team, login, logout och set-password. Det finns inget för spelare, transaktioner eller nycklar.
- I `kevin-bo/navigation.mjs` används `INTERNAL_LINKS` och `STUDIO_GROUP` ingenstans.
- Kevin-spår som finns kvar: CSS-klassen `.kevin-bo`, `data-preview="operator"` och namnet `PARTNER_PREVIEW_VIEWS`.

## Begrepp: olika namn för samma sak

Ordet först är TERMINOLOGI:s ord.

- **Rum** (`room`): spelrum, "Spelutbud" (rubrik), `table` (i URL och data), `bj`, `game-tables`, `legacy-rooms`, `tables`. TERMINOLOGI säger att **Bord** bara är bordslagret i scenen, men `table` används också för rum.
- **Mall** (`lane`, `presentationLaneId`, `composition` i adresser): spelmall, "Spelmallar för bolaget", "Gemensam mall", Sammansättning, Standard- och Lagersammansättning, `connectedLane`.
- **Bolag** (`operator`): spelbolag, partner, company, "Spelbolagsportal", "Partners", `operators`.
- **Paket** (`operator package`): paketversion, "Publicera igen", `publish-scene-layout`, `refresh-dealer-idle`.
- **Spelinställningar** (`room game config`): "Spara/Publicera spelinställningar".
- **Rummets utseende:** branding, presentation, theme, appearance, "rummets val", design, background.
- **Bord och bakgrunder:** material, lagerfiler, `layer-assets`, material-library, assets.
- **Klipp:** video, media, archive, videos.
- **Dealermaterial:** "Skapa material", dealer-studio, forge, dealer-forge.
- **Tal:** "Röst & tal", speech, voice, voicelines, Talgranskning/media-review, Taldrift/moving-drift, probe.
- **AI:** OpenClaw, "Systeminställningar", dealer-agent, operator-chat, "Dialogtest", ai/models.
- **Händelser:** events, tree, presentation-events, "Spelhändelser & regler".
- **Konton:**
  - Spelarkonton, players (nivå 3).
  - "Konton & åtkomst", users, team, staff (nivå 1).
  - "Team & behörigheter", members (nivå 2).
- **Admin:** Studio (bara menydelen för material), lab, control, "Intern arbetsyta", design-preview, "Croupier Admin".
- **Ekonomi:** transactions, tx, payments, finance.
- **Integrationer:** api, integration, `partners` (grupp-id), apikeys.
- **Drift:** ops, operations, sko (shoes), status.

## Var det skaver mest för användaren (underlag till UI/UX)

Iakttagelser från kartan. Beslut och ordning hör till [ADMIN-FORENKLING.md](ADMIN-FORENKLING.md) och Jakob.

1. **Publiceringen är splittrad.** Fem knappar på `/admin/rooms`, en till i Sceneditorn och en tredje väg i partnerns Spelrum skriver alla samma paket. Det beskrivs i ADMIN-FORENKLING avsnitt 0.
2. **Samma sak har flera namn.**
   - Menyn säger "Spelbolag & rum" medan rubriken säger "Spelutbud".
   - Mallen heter "Sammansättning", "Spelmall" eller "Gemensam mall".
   - Fliken heter "Inställningar" medan panelen heter "Dealer & användning".
3. **Dubbla sidor.**
   - Spelarkonton och Konton & åtkomst är samma komponent, delad med CSS.
   - `/admin/admin/operators` dubblerar Bolag & team och Rum.
   - Intake och importassistenten är två uppladdningsvägar mot samma API:er.
   - Ekonomins två flikar läser samma journal var för sig.
4. **Verktyg utan väg in.** Talgranskning, Spelhändelser och den interna lobbyn saknar inkommande länk. Dialogtest nås bara via Röst & tal.
5. **Interna namn syns för användaren.** Bland annat OpenClaw, "Croupier Admin", "Dealerregister", den hårdkodade PAOW-knappen och inbäddade "Logga ut"-knappar mitt på sidor.
6. **Länkar studsar.** Länkar till pensionerade sidor (`/admin/compositions`, `/admin/rehearsal`) leder tillbaka till samma sida.
7. **Onödiga läsningar.** Bolag & team, Hjälp och Talgranskning hämtar hela projektet och videolistan utan att använda dem.
8. **Partnerportalen** har 17 adresser för fyra vyer, och Integration är bara text. Partnerns Spelrum och Team överlappar Admin.
