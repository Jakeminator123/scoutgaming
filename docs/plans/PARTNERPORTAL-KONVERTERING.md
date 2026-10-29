# Partnerportalen: från `kevin-bo` till mains mönster

> **Konverteringsplan, ingen tracker.** Skriven 29 oktober 2026 mot `main` 6f2d8236 (efter #556, #559, #560, #561, #562, #563 och #564); koden som planen pekar på är oförändrad på 2a4cc9c4 (där ändrades bara `apps/studio/docs/README.md` och en inledning i ADMIN-KARTA). Uppdraget kommer från Jakobs beslut samma kväll: "`components/kevin-bo/**` är jättelegacy, men precis som i migreringen finns ofta funktioner från Kevin vi vill ha; de ska konverteras till hur vi och main fungerar." Målbilden är [ADMIN-FORENKLING](ADMIN-FORENKLING.md) avsnitt 5 (nivå 2) och 9 (steg A–C), kartan är [ADMIN-KARTA](ADMIN-KARTA.md) (avsnittet Nivå 2), och arbetssättet är detsamma som i [KEVIN-PORT](KEVIN-PORT.md): ett bra beteende skrivs om i mains moduler, ingenting kopieras från Kevins grenar. `migrering/status.json` är fortfarande enda statuskällan. Radnummer åldras fort; läs om koden innan ett steg byggs.

## 1. Läget i dag, kort

Mycket av det som målbilden kallar steg A är redan gjort på `main`, i commit-serien från 28 oktober (`bbca235`, `8791253`, `fe50c87`, `15bd567`, `69e1809`, `68668ad`, `466c8dc`, `7132499`, `f065c72`) och i #561 (Integration med bolagets egna nycklar). Planen bygger därför inte om det som finns, utan flyttar, städar och knyter ihop det med Admins mönster.

| Det ADMIN-FORENKLING 5 och 9 A beskriver | Läget på `main` 6f2d8236 | Bevis |
|---|---|---|
| Kevins `navigation.mjs` (DESTINATIONS, INTERNAL_LINKS, STUDIO_GROUP), `preview.css`, `john-foundation.css`, `views/live.css`, `views/shared.jsx`, `source-provenance.json` | borttagna | `git log --diff-filter=D -- apps/studio/components/kevin-bo` → `fe50c874`, `68668adc` |
| `team.jsx` DEFAULT_ROLES med technician/analyst | borttagen; rollerna kommer ur snapshoten och heter administratör, redaktör, läsare | `69e18099`; `views/team.jsx:22-36`, `lib/partner-words.mjs:7-8`; låset `test/partner-team.test.mjs:35` |
| Integration `DISCONNECTED` och döda grenar | borttagna; #561 visar bolagets egna nycklar maskerade | `views/integration.jsx:12-59`, `lib/partner-api-keys.mjs`, `lib/partner-data.mjs:270,290` |
| `playersToday`/`roundsToday` hårdkodade 0 i Översikt | borttagna; siffrorna kommer ur spelets journal (`shared_table_audit`) och saknas de visas inget | `8791253b`; `views/overview.jsx:27-46`, `lib/partner-game-readout.mjs`; låset `test/partner-view-access.test.mjs:153` |
| Kevins gamla adresser omdirigeras | gjort | `packages/navigation/workspace-surfaces.mjs:9-20`, `components/workspace-surface-page.tsx:39-42` |
| Servern avgör varje vy, 403 på direktadress | gjort för alla sju vyer | `partner-access-policy.mjs:26-29`, `lib/partner-data.mjs:227-228`, skalets 403-kort `kevin-bo/partner-operator-workspace.jsx:199-207` |
| "sex av tolv behörigheter kontrolleras aldrig" (ADMIN-FORENKLING 5.1 och 5.4, ADMIN-KARTA rad 178) | **inaktuellt**: fem av de sex styr nu vy, snapshot eller API (se 2.4); `players.read` styr vyn men har inga data före steg F, och `tables.configure` kontrolleras ingenstans eftersom partner-API:t saknar skrivväg för spelinställningar och paus | avsnitt 2.4 |

Det som återstår är tre saker: (1) mappen och ett fåtal Kevin-rester, (2) att portalens UI-primitiver, meny och redigerare följer samma mönster som Admin, och (3) steg B och C (redigerarens flikar och partner-API:ts saknade åtgärder).

## 2. Inventering fil för fil

Konsumentbevis med `git grep -F <filnamn> -- apps packages services ops tools test .githooks .github ':!*.md'` på 6f2d8236. "Produkt" är import från körbar kod; prov räknas separat. Alla sökvägar under `apps/studio` om inget annat står.

### 2.1 `components/kevin-bo/**`

| Fil (rader) | Vad den gör | Levande? Produktkonsument | Kevin-rest i dag | Beslut |
|---|---|---|---|---|
| `README.md` (22) | beskriver kedjan och filerna | dokument | rad 3-4: "Mappnamnet `kevin-bo` är historiskt" | **konvertera**: flyttas med mappen och skrivs om (PR 1) |
| `partner-operator-workspace.jsx` (224) | skalet: sidomeny, tilldelningsrad, roll, språk/tema, ⌘K-palett (cmdk), toasts (sonner), vyväxling, rumsval i adressen, utkastvakt, 403-kortet `DeniedView` | ja: `components/workspace-surface-page.tsx:3` | `preview!==false`-vakten `:42,173` (försvar mot fixtursnapshots, behålls); vyerna väljs med en if-kedja `:215-220` | **behåll, konvertera**: flytt (PR 1), meny ur `packages/navigation` (PR 3), TSX och kit-paritet (PR 4) |
| `partner-copy.mjs` (91) | orden sv/en, menyfiltret `partnerNavigation`, preferenser i localStorage | ja: `partner-operator-workspace.jsx:23`, `views/team.jsx:6`, `components/partner-session-actions.tsx:5`, `components/partner-workspace.tsx:5` | oanvända nycklar `signedIn` (`:13`), `directory` (`:18`), `lane`/`lanes` (`:26`), `close` (`:27`) och deras engelska par; `HIDDEN_VIEWS = players` (`:66`) döljer Spelare i menyn | **konvertera**: menyn flyttar till `packages/navigation/partner-navigation.mjs` (PR 3); döda nycklar bort (PR 2) |
| `partner-navigation-guard.mjs` (16) | utkastvakten: fråga innan osparade val kastas | ja: `partner-operator-workspace.jsx:26` | – | **behåll** |
| `partner-workspace-context.mjs` (30) | klientens andra kontroll av bolagskontexten: fel bolag i `tables`, `team`, `presentations` eller `apiKeys` fäller vyn | ja: `partner-operator-workspace.jsx:19` | `OWNED` innehåller `presentations` (`:1`), som ingen vy läser | **behåll** (isolering); `presentations` bort ur `OWNED` när fältet tas bort (PR 2b) |
| `partner-portal.css` (305) | portalens tokens och alla stilar, fästa under `.partner-portal` | ja: `partner-operator-workspace.jsx:27`; `partner-workspace.module.css:1` och `partner-appearance.module.css` läser tokens | `.kevin-appearance`, `.kevin-appearance-state` (`:235-236`); kommentaren `:2` pekar på `ny-admin-skiss/` som inte finns i repot; egna tokennamn (`--surface`, `--line` …) med `--sg-*`-alias (`:17-20`) | **konvertera**: klassnamnen (PR 2), tokens till `--sg-*` som Admin (PR 4) |
| `views/overview.jsx` (93) | Översikt: var bolaget är publicerat, siffror ur journalen, det som väntar, tilldelningen | ja: `partner-operator-workspace.jsx:11` | inga | **behåll** |
| `views/rooms.jsx` (104) | Spelbord: kort med `SceneThumb`, editorn monterad dold så att val inte tappas | ja: `partner-operator-workspace.jsx:12` | inga | **behåll**; flikarna i steg B |
| `views/players.jsx` (13) | tomläge för Spelare | ja: `partner-operator-workspace.jsx:13` (menyn döljer vyn, adressen fungerar) | – | **behåll** tills steg F; menyvalet är ett Jakob-beslut (avsnitt 4.2) |
| `views/reports.jsx` (61) | Ekonomi: rundor, insatser, utbetalt, netto per spelbord, en valuta i taget | ja: `partner-operator-workspace.jsx:14` | – | **behåll** |
| `views/integration.jsx` (59) | startadress och bolagets egna nycklar, maskerade (#561) | ja: `partner-operator-workspace.jsx:15` | – | **behåll**; inget i den här planen rör nycklarna (NYCKEL-BOLAG C äger kravhöjningen) |
| `views/help.jsx` (60) | rollens rättigheter, orden, Begär material som e-postutkast | ja: `partner-operator-workspace.jsx:16` | – | **behåll**; e-postutkastet ersätts av en journalpost i steg C |
| `views/team.jsx` (130) | team, inbjudan, åtgärdsmeny med bekräftelse, sista-administratör-märket | ja: `partner-operator-workspace.jsx:17` via `partner-team-loader.mjs:176-183` | – | **behåll**; kit-paritet (PR 4) |
| `views/ui.jsx` (143; läget före steg 4, nu `views/ui.tsx`) | portalens egna primitiver: `Page`, `Crumbs`, `Card`, `Chip`, `Btn`, `Row`, `Empty`, `KV`, `Note`, `Stat`, `Tip`, `Bars`, `TrendChart`, `ActionMenu`, formatering | ja: alla sju vyer | parallellt kit till Admins `client/admin/components/ui/*` | **konvertera**: samma namn och props som Admins kit (PR 4) |
| `views/report-figures.mjs` (81) | siffror per valuta och dag ur `snapshot.reports` | ja: `views/overview.jsx:8`, `views/reports.jsx:7` | – | **behåll** |

### 2.2 Komponenter utanför mappen som portalen använder

| Fil | Vad | Konsument | Kevin-rest | Beslut |
|---|---|---|---|---|
| `components/workspace-surface-page.tsx` (74) | serverdelen av `/partner/**`: omdirigering av gamla adresser, inloggning, serverläsning, 403-beslut | `app/partner/[[...path]]/page.tsx:1` | – | **behåll**; importen `:3` byts i PR 1 |
| `components/partner-workspace.tsx` (54) + `.module.css` | bolagslistan på `/partner` | `workspace-surface-page.tsx:4` | – | **behåll** |
| `components/partner-session-actions.tsx` + `.module.css` | Logga ut / Byt konto | `partner-operator-workspace.jsx:25`, `partner-workspace.tsx:6` | – | **behåll** |
| `components/partner-login.tsx` (72) | `/partner/login` | `app/partner/login/page.tsx:1` | – | **behåll** |
| `components/partner-team-loader.mjs` (183) | teamets klient, adapter och laddare | `partner-operator-workspace.jsx:22`, `views/team.jsx` (indirekt) | kommentarerna `:10` ("lab/lib/partner-team-api.mjs", sökvägen finns inte) och `:21` ("Kevin's TeamView"); grenen `snapshot?.preview === true ? snapshot` (`:170`) nås aldrig, eftersom `validatePartnerSnapshot` nekar allt utom `preview: false` | **konvertera**: död gren och kommentarer bort (PR 2) |
| `components/partner-appearance.tsx` (357), `partner-appearance-loader.mjs`, `-preview.tsx`, `-state.mjs`, `.module.css` | spelbordets redigerare med utkast, granskning och publicering | portalen (`views/rooms.jsx:5`) **och Admin** (`client/admin/components/studio/registered-studio.tsx:5-6`, `companies-page.tsx:12`) | klassnamnen `kevin-appearance*` i `partner-appearance-loader.mjs:53,58,67` | **behåll** som den gemensamma redigeraren (regel 2 i målbilden); klassnamnen byts i PR 2 |
| `components/partner-journal-loader.mjs` | journalen | portalen (`views/rooms.jsx:6`, `partner-team-loader.mjs`) och Admin (`companies-page.tsx:19`, `control-operator-directory.tsx`) | – | **behåll**, gemensam |
| `components/partner-preview-media.mjs` (51) | bilder ur paketets frysta förhandsvisning (`/api/operators/<bolag>/rooms/<spelbord>/preview`) | `views/overview.jsx:6`, `views/rooms.jsx:7`, `partner-appearance.tsx:15`, `appearance-choices.tsx` | – | **behåll** |

### 2.3 `lib/partner-*.mjs`

| Fil (rader) | Vad | Produktkonsument | Kevin-rest | Beslut |
|---|---|---|---|---|
| `partner-data.mjs` (308) | snapshoten: session, bolag, medlemskap, roll, behörigheter, vy-beslut, avsnitt per behörighet | `workspace-surface-page.tsx:7`, `partner-session.mjs:627` | reservgrenar för paket utan frusen presentation: `parseList(pack?.presentations ?? pack?.lanes)` (`:238`) och `parseList(pack?.tables)` med Kevins `playerCount` (`:262`) via `owned()` (`:41-51`); fält utan klientläsare: `presentations` (`:237,281`), `roomBindings: 'operator-owned-v2'` (`:282`), `summary` (`:291`), `mode`/`schemaVersion` (`:139-141`) | **konvertera** (PR 2b); de två reservgrenarna bort först efter en läsfråga i Neon som visar att varje aktuellt paket har `branding.presentation` (PR 2d). `owned()` **behålls**: `teamRow` använder den (`:88`) och den nekar en rad för fel bolag (`:44`) |
| `partner-session.mjs` (645) | inloggning, sessioner, API-routern med vitlista (`:323`), Origin/CSRF (`:334-338`), bolagskontext (`:370-395`), branding (`:420-489`), journal (`:491-500`), team (`:502-550`), set-password | `app/api/partner/[...action]/route.ts:1`, `workspace-surface-page.tsx:8`, `partner-data.mjs:7` | – | **behåll**; nya åtgärder i steg C läggs i vitlistan `:323` med egen behörighet |
| `partner-branding-api.mjs` (320) | utkast, granskning (`reviewToken`), publicering, återställning | `partner-session.mjs:422` | – (direktpubliceringen `read`/`write` är borttagen i #587; proven är portade till `readState`/`command`, se PR 2c) | **behåll** |
| `partner-team-api.mjs` (202) | team läs/skriv med behörighet per åtgärd | `partner-session.mjs:17` | – | **behåll** (inbjudningslogiken finns också i `operator-admin-api.mjs:152-191`; det är kartans dubblett, inte den här planens) |
| `partner-workspace-access.mjs` (67) | intern admin får alla tolv i alla aktiva bolag; delegeringsregler | `partner-data.mjs:4`, `partner-session.mjs:5`, `partner-team-api.mjs:8` | – | **behåll** |
| `partner-game-readout.mjs` (158) | Ekonomi ur `shared_table_audit` | `partner-data.mjs:15` | – | **behåll** |
| `partner-api-keys.mjs` (54, #561) | bolagets egna nycklar, maskerade | `partner-data.mjs:16` | – | **behåll**, rörs inte |
| `partner-package-view.mjs` (52) | mallens val och lager | portalen, `partner-appearance.tsx:12`, `partner-branding-api.mjs:12`, `partner-data.mjs:9` | – | **behåll** |
| `partner-presentation-choices.mjs` (21) | dealerval per mall | `partner-branding-api.mjs:11` | – | **behåll** |
| `partner-room-selection.mjs` (+ `.d.mts`) | rumsval i adressen (`?room=`, `?scope=company`) | `partner-operator-workspace.jsx:10`, `views/rooms.jsx:8` | – | **behåll**; `.d.mts` saknar i dag TS-konsument (vyerna är `.jsx`) och får en när vyerna blir TSX i PR 4 |
| `partner-words.mjs` (25) | roll- och behörighetsord, rena (servern läser dem) | `partner-data.mjs:17`, `partner-copy.mjs:5`, `views/help.jsx:6`, `views/team.jsx:7` | kommentaren `:4` pekar på `kevin-bo/` | **behåll**; kommentaren i PR 1 |
| `partner-login-return.mjs` (+ `.d.mts`), `partner-session-actions.mjs` | säker återvändsadress, utloggning | inloggningssidan, `partner-login.tsx:4`, `workspace-surface-page.tsx:9`, `partner-session-actions.tsx:4` | – | **behåll** |
| `partner-launch-url.mjs`, `partner-preview-policy.mjs`, `partner-reference.mjs`, `partner-observer.mjs`, `partner-trace.mjs` | Admins launchregel (`studio-administration.tsx:8`, `demo-builder.mjs:11`), Admins interna förhandsvisning av demobolag (`operator-package-api.mjs:2`), BettaLotto-referensen (`app/api/inputs/reference/route.ts:1`, `presentation-sequence.mjs:1`) | se föregående kolumn | namnet "partner" vilseleder; inget av det hör till portalen | **utanför planen**; byter namn eller raderas i städsteget G |

### 2.4 Delade paket och behörigheterna

| Fil | Vad | Kevin-rest | Beslut |
|---|---|---|---|
| `packages/navigation/workspace-surfaces.mjs` (103) | `PARTNER_VIEWS` (`:7`), Kevins gamla adresser → ny vy (`:9-20`), adressbyggare (`:50-58`, `:60-97`) | `CONTROL_PREVIEW_VIEWS`, `WORKSPACE_VIEW_SLUGS`, `legacyControl`, `staffTools` (`:22-47`) gäller bara `/control`-omdirigeringarna (`lib/control-workspace.mjs:1`) | **behåll** partnerdelen och omdirigeringarna (målbild 4.1: alla omdirigeringar behålls); `/control`-delen är inte portalens och rörs inte här |
| `packages/studio-access/server/partner-access-policy.mjs` (150) | de tolv behörigheterna (`:12-19`), administratörsbehörigheten (`:22`), vykartan (`:26-29`), regler för resurs, roll, inbjudan, avstängning | kommentaren `:1` ("deliberately not connected to login or HTTP handlers") stämmer inte längre | **behåll**; kommentaren rättas i PR 2; nya behörigheter läggs i samma lista |

Serverkontroll per behörighet, verifierad på 6f2d8236 (ersätter kolumnen "Kontrolleras på servern i dag" i ADMIN-FORENKLING 5.4):

| Behörighet | Kontroll i dag | Lucka |
|---|---|---|
| `overview.read` | hela portalen (`partner-data.mjs:217`, `partner-session.mjs:380`) | – |
| `tables.read` | vyn Spelbord (`partner-access-policy.mjs:27`); spelbord och spelinställningar i snapshoten (`partner-data.mjs:229,239,251`) | branding-GET returnerar spelbordslistan (`partner-branding-api.mjs:130-131`) med bara `presentations.read` (`partner-session.mjs:475`). Standardrollerna har båda, men en roll som Admin skapar med `presentations.read` utan `tables.read` får spelbordens namn |
| `tables.configure` | **ingen**: det finns ingen skrivväg för spelinställningar eller paus i partner-API:t | varje ny skrivväg i steg C kräver den |
| `presentations.read` / `.configure` | branding GET/POST (`partner-session.mjs:436-444,475,478`), omprövad i transaktionen (`:438-444`); snapshotens tilldelning och utkast (`partner-data.mjs:229,282-287`) | – |
| `players.read` | vyn Spelare (`partner-access-policy.mjs:27`) | inga data före steg F |
| `reports.read` | vyn Ekonomi; `reports` och `publications` i snapshoten (`partner-data.mjs:266,288`) | journalen kräver `team.read` och `team.roles.assign` (`partner-session.mjs:496`), så spelbordets Historik visas bara för administratören (`views/rooms.jsx:61`); en läsare med `reports.read` ser ingen historik |
| `integrations.read` | vyn Integration och nycklarna (`partner-data.mjs:270`, #561) | – |
| `team.*` | läsning `partner-team-api.mjs:109`; skrivning `:102-105`; inbjudan och avstängning `partner-access-policy.mjs:122-150` | – |

## 3. Kevin-beteenden som behålls, uttryckta i mains mönster

| Beteende | Var i dag | Uttryck i main | Steg |
|---|---|---|---|
| **Spara utkast → Granska → Publicera** (plus Kasta utkast och Återställ version) | server: `partner-session.mjs:479-485` (fasta fält per åtgärd), `partner-branding-api.mjs:307-363`; klient: `partner-appearance.tsx:30,143-186`, granskningsdialogen `:280-306` | samma serverväg; dialogen byggs med Admins `ConfirmDialog` och `consequences` (`client/admin/components/ui/dialog.tsx:89-127`) när kit-pariteten finns, med texten "Utkastet är gemensamt för bolagets spelbord" kvar (`partner-appearance.tsx:295`) så länge utkastet är ett per bolag | B |
| **`reviewToken`** | hash över scope, bolag, revisioner och kandidat (`partner-branding-api.mjs:268-271`); publicering med fel token ger 409 (`:358`) | behålls oförändrad; målbildens `previewToken` för `publish-room` (ADMIN-FORENKLING 7) byggs efter samma mönster | B, D |
| **Utkastkedjans CAS** | `expectedDraftRevision` och `expectedPackageRevision` (`packages/operators/server/operator-store.mjs:719-727`) | oförändrad | alla |
| **Sista-administratör-spärren** | lagret: `rejectIfRemovesLastAdmin` (`operator-store.mjs:414-418`, 409 `studio_last_operator_admin`); API: 409 `last-admin` (`partner-team-api.mjs:96`); UI: märket "sista administratören" (`views/team.jsx:57-58,85-87`); `partner-admin` kan inte delegeras (`lib/operator-admin-api.mjs:17`) | oförändrad; UI-märket blir Admins `Badge`, åtgärdsmenyn Admins `ActionMenu` (`client/admin/components/ui/menu.tsx:7-10`, där `disabled` är en sträng som säger varför) | PR 4 |
| **SceneThumb** (scenens publicerade lager på spelbordskortet, bara alfadealer, aldrig rå green screen) | `views/rooms.jsx:29-50` via `partner-preview-media.mjs:15-27` | behålls i portalen. Admins `RoomPicture` (`client/admin/components/studio/room-picture.tsx:10-19`) visar bara `environment.image` eller insatsprofilens bild; att ge Admin samma lagerbild är ett eget Jakob-beslut, inte en del av konverteringen | – |
| **Utkastvakten** | `partner-navigation-guard.mjs`, skalet `:59-62,72-78,97-103,170` | behålls; Admin har motsvarande per sida (`connected-clip-map.tsx:225`, `dealer-directory.tsx:46`) | – |
| **403-kortet i skalet** | `DeniedView` (`partner-operator-workspace.jsx:199-207`), servern bestämmer (`partner-data.mjs:227-228`) | behålls; kortet byggs av kitets `Card`, `Badge` och `TechnicalDetails` (`kit.tsx:88`) | PR 4 |
| **⌘K-palett och toasts** | cmdk och sonner i skalet (`:181-191`) | behålls; Admin har egen palett (`client/admin/components/ui/command.tsx:29`) och egna toasts (`toast.tsx:12-21`); ett gemensamt bibliotek hör till steg H | H |
| **En valuta i taget** | `views/report-figures.mjs`, `CurrencySwitch` (`views/overview.jsx:13-16`) | behålls; samma regel som Admins Ekonomi (`connected-economy.tsx:57`) | – |
| **Begär material** | e-postutkast (`views/help.jsx:18-24`) | ärligt mellanläge; blir en journalpost i steg C (kräver DDL, se avsnitt 5) | C |
| **Språk och tema per tittare** | localStorage (`partner-copy.mjs:73-91`) | behålls som bekvämlighet per tittare | – |

Det som **inte** tas (redan borta, återinförs inte): DESTINATIONS, INTERNAL_LINKS och STUDIO_GROUP; rollerna technician och analyst; `DISCONNECTED`; förhandsvisnings- och fixturlägena; hårdkodade nollor; `owner==='planned'`.

## 4. Målstruktur

### 4.1 Mappen: `apps/studio/components/partner/`

**Varför där och inte i Admin-SPA:n.** Admin-SPA:n (`apps/studio/client`) har ett eget bygge med Tailwind 3 (`client/build.mjs:30-39`) och serveras som statiskt paket bakom personalinloggning (`app/admin/[[...path]]/route.ts:12-31`). Portalen renderas av Next på `/partner/**`, där servern fattar 403-beslutet innan något skickas (`components/workspace-surface-page.tsx:48-73`), och Next-appen saknar Tailwind (ingen postcss-konfiguration i `apps/studio`). Kitets klasser (`client/admin/components/ui/kit.tsx:11-24`) skulle alltså inte få någon CSS på `/partner`. Att flytta portalen in i klientbygget är steg H (verktygskedjan), inte en konvertering. Därför: portalen stannar i Next, i `components/partner/`, och får **samma komponentnamn, props och tokens som Admins kit**, så att en senare flytt in i klienten blir mekanisk.

**Filnamn.** Repots konvention: komponentfiler på engelska i kebab-case (`partner-appearance.tsx`, `control-operator-directory.tsx`), användarord på svenska, flik-id:n i Admins meny på svenska (`adminRoomTabs`, `packages/navigation/admin-navigation.mjs:29-32`), portalens adressled på engelska (`PARTNER_VIEWS`, publika adresser som omdirigeringarna bygger på). PR 1 behåller filnamnen för att flytten ska bli en ren omdöpning; PR 4 byter `.jsx` till `.tsx` (de nio `.jsx`-filerna i repot är alla i `kevin-bo/`).

```
apps/studio/components/partner/
  README.md
  partner-operator-workspace.tsx   skalet (från .jsx i PR 4)
  partner-copy.mjs                 orden; menyn läses ur packages/navigation
  partner-navigation-guard.mjs
  partner-workspace-context.mjs
  partner-portal.css               bara layout; tokens heter --sg-*
  views/
    ui.tsx                         samma API som client/admin/components/ui (Card, Badge/Chip, Row, Rows,
                                   Empty, KV, Note, Stat, ActionMenu, ConfirmDialog, TechnicalDetails)
    overview.tsx  rooms.tsx  players.tsx  reports.tsx  team.tsx  integration.tsx  help.tsx
    report-figures.mjs
```

Den gemensamma redigeraren (`components/partner-appearance*`) och journalen (`components/partner-journal-loader.mjs`) stannar där de är, eftersom Admin importerar dem; de är "samma komponenter" i målbildens regel 2.

### 4.2 Menyn i `packages/navigation`

En ny modul `packages/navigation/partner-navigation.mjs`, i samma stil som `adminNavigationGroups` (`admin-navigation.mjs:2-15`): ett objekt per menyval med `id` (= adressledet i `PARTNER_VIEWS`), `label` (sv/en), `description` (samma text som Hjälp visar) och ikonnamn. Behörigheten läses fortfarande ur `PARTNER_VIEW_PERMISSIONS` (`partner-access-policy.mjs:26-29`), så att menyn och servern aldrig får två kartor. `partnerNavigation` i `partner-copy.mjs:67-70` blir ett filter över modulen, och Hjälp listar menyn ur samma källa.

Menyn enligt ADMIN-FORENKLING 5.1, avstämd mot funktionsregistret (avsnitt 12, rad 56-66):

| Menyval | `id` | Behörighet | Läget | Beslut som behövs |
|---|---|---|---|---|
| Översikt | `overview` | `overview.read` | finns | – |
| Spelbord | `rooms` | `tables.read` | finns | – |
| Dealers | – | – | ingen egen sida; dealern väljs under Spelbord › Dealer | **Jakob**: 5.1 har en egen Dealers-sida, registret rad 58 (skiss 2, godkänd) har det inte. Planen följer registret |
| Spelare | `players` | `players.read` | vyn finns med tomläge men är dold i menyn (`partner-copy.mjs:66`) | **Jakob**: beslutet 28 oktober ("Johns operatörsmeny med ärliga tomlägen") talar för att visa den med tomläge; koden döljer den till steg F |
| Ekonomi (5.1: Rapporter) | `reports` | `reports.read` | finns | registret rad 60 säger Ekonomi; planen följer registret |
| Team | `team` | `team.read` | finns | – |
| Integration | `integration` | `integrations.read` | finns (#561) | – |
| Hjälp och kontakt | `help` | `overview.read` | finns | – |

Spelbordets flikar: `partnerRoomTabs` i `packages/navigation/admin-navigation.mjs` (eller den nya modulen) som en delmängd av `adminRoomTabs` med samma id:n, utan `bolagets-val`: `utseende`, `dealer`, `spel`, `tillganglighet`, `historik`. Samma id:n gör att Admins knapp *Förhandsvisa portalen* kan landa på rätt flik.

### 4.3 Serverkontrollen

Varje partneråtgärd kontrolleras i `partner-session.mjs` med `allowsWorkspaceResource(decided, <behörighet>, {scope, operatorId})`, omprövas inne i skrivtransaktionen på samma sätt som branding (`:436-444`), och bolaget kommer alltid ur sessionens kontext, aldrig ur adressen eller kroppen. Konkret:

1. **`tables.read`**: branding-GET tar bara med `rooms` och `roomDealerChoices` (`partner-branding-api.mjs:130-131`) när rollen har `tables.read`; annars tomma listor. Ingen ändring för standardrollerna.
2. **`tables.configure`**: krävs av steg C:s spelinställningar och paus, tillsammans med `allow.language`, `allow.limit` och `allow.pause` i paketet.
3. **`players.read`**: krävs av steg F:s läsning; vyn finns redan bakom kontrollen.
4. **`reports.read`**: spelbordets Historik läses med `reports.read` i stället för `team.roles.assign` (`views/rooms.jsx:61`), genom en journalläsning som bara returnerar `package.publish` och `draft.publish` för bolaget. Teamjournalen behåller sin kontroll (`partner-session.mjs:496`).
5. **`integrations.read`**: klar (#561). "Begär rotation" får en egen behörighet (`integration.request`) i samma lista, enligt 5.4.
6. **Ett tabellstyrt prov** över alla tolv behörigheter × alla vyer och alla API-åtgärder (GET och POST), med standardrollerna och en egen roll per behörighet, som lägger sig bredvid `test/partner-view-access.test.mjs`.

## 5. PR-sekvens

Små PR:er, en sak i taget; docs, UI och server blandas inte (AGENTS). Varje steg har ett klart-kriterium som går att testa. Prov för behörighet, isolering, sparning, samtidighet och spelregler behålls; rena sträng-, CSS- och markuplås byts mot roll-, aria- eller prop-kontroller när de bryts.

| PR | Innehåll | Filer | Klart när |
|---|---|---|---|
| **0 docs** | den här planen | `docs/plans/PARTNERPORTAL-KONVERTERING.md` (raden i `docs/README.md` läggs av orkestratorn, se avsnitt 7) | mergad |
| **1 mekanisk flytt** | `git mv apps/studio/components/kevin-bo apps/studio/components/partner`, inga andra ändringar i de flyttade filerna utom README. Importerna byts: `components/workspace-surface-page.tsx:3`, `components/partner-session-actions.tsx:5`, `components/partner-workspace.tsx:5`, kommentaren `lib/partner-words.mjs:4`. Dokumentens sökvägar till de flyttade filerna byts i samma PR, så att inga döda `kevin-bo/`-sökvägar blir kvar: `apps/studio/README.md:70`, `docs/plans/NYCKEL-BOLAG.md:43`, `docs/plans/ADMIN-KARTA.md:16,147,156-159,162` (rad 314 och 327 beskriver Kevin-rester respektive borttagen kod och skrivs om, inte bara sökvägen), `docs/plans/ADMIN-FORENKLING.md:305,311,417` (radnummer på 2a4cc9c4). Proven flyttar **inte** (de ligger kvar i `apps/studio/test/`, där `.githooks/pre-commit-full:33` och `tools/precommit-checks.mjs:191` hittar dem); bara deras sökvägar byts: `partner-workspace-visual.test.mjs:7,8,16,213`, `partner-view-access.test.mjs:16`, `partner-login.test.mjs:201`, `workspace-surface-pages.test.mjs:35`, `partner-room-selection.test.mjs:7,12,55,180`, `partner-server-graph.test.mjs:65,66,95`, `partner-session-actions.test.mjs:9,110`, `partner-team-loader.test.mjs:14,176`, `partner-team.test.mjs:7`, `partner-navigation-guard.test.mjs:3`, `partner-workspace-browser.test.mjs:18`, och reporotens `test/admin-publication-chain.mjs:35`. `partner-appearance*.test.mjs` och `partner-set-password.test.mjs` importerar inget ur mappen och ändras inte. | `apps/studio/components/kevin-bo/**` → `partner/**`, filerna ovan | `git diff -M --stat origin/main` visar 100 % omdöpning för de 15 flyttade filerna; `git grep -F kevin-bo -- apps packages services tools test` ger bara låset `partner-workspace-visual.test.mjs:71` (som kräver att ordet *inte* syns), och `git grep -F kevin-bo -- docs` ger bara historiska beskrivningar, inga sökvägar; sviterna `studio` och `contracts` gröna (contracts kör `test/admin-publication-chain.mjs`), Chrome-provet `partner-workspace-browser` grönt i CI; ingen skillnad i renderad markup |
| **2 döda grenar och Kevin-rester (klient)** | `.kevin-appearance*` → `.partner-appearance-panel*` (`partner-appearance-loader.mjs:53,58,67`, `partner-portal.css:235-236`); döda nycklar i `partner-copy.mjs` (`signedIn`, `directory`, `lane`, `lanes`, `close` i sv och en); grenen `snapshot?.preview === true` och kommentarerna i `partner-team-loader.mjs:10,21,170`; kommentaren `partner-portal.css:2`; kommentaren `partner-access-policy.mjs:1` | klientfiler, en kommentar i paketet | `studio`-sviten grön; `partner-workspace-visual`s prov att sv och en har samma nycklar (`:196-198`) gäller fortfarande |
| **2b snapshotens överskott (server)** | bort: `roomBindings` (`partner-data.mjs:282`), `summary` (`:291`), `mode` (`snapshotBase`, `:141`), `presentations` (`:237,281` och grenen utan bolag `:189`, plus `OWNED` i `partner-workspace-context.mjs:1` och omräkningen i skalet `:177`). Behålls: `preview: false` (klientens försvar mot fixtursnapshots, `partner-workspace-context.mjs:4`, prov `partner-workspace-visual.test.mjs:200`) och `schemaVersion` (snapshot-API:ts kontraktsversion, `partner-session.mjs:626-634`). Prov och fixturer som berörs: påståenden `partner-session.test.mjs:241,431-444,467,473,485`, `partner-view-access.test.mjs:148,153,215-224`, `partner-admin-workspace.test.mjs:120`; fixturer `partner-workspace-visual.test.mjs:39,42,51` (och `:200`, som behåller `preview: true` men tappar `mode`), `partner-workspace-browser.test.mjs:38-40`, `partner-team-loader.test.mjs:18`, `partner-team.test.mjs:18`, `partner-room-selection.test.mjs:14`. Påståendena byts från "fältet har värdet X" till "fältet finns inte"; provet för dataminimering (`partner-view-access.test.mjs:209-241`) byts på samma sätt och försvinner inte. Projektionen som `presentations` byggde (`partnerPackageProfiles`) togs bort när den saknade anropare; `partnerLaneState` provas i `partner-package-view.test.mjs` | `lib/partner-data.mjs`, `components/partner/partner-workspace-context.mjs`, skalet, proven ovan | `studio`-sviten grön; en smal roll får fortfarande inga lösa data, och provet säger nu att de borttagna fälten saknas för varje roll |
| **2c direktpubliceringen bort (server)** | **Klar i #587.** `read` och `write` (förut `partner-branding-api.mjs:368-397`) och deklarationerna i `partner-branding-api.d.mts` är borttagna, efter att varje prov som använde dem portats: `read` → `readState` (samma `present()`, alltså samma `adjustable` och `dealerChoices`), `write` → `command` (`save-draft` → `review` → `publish` med `reviewToken`, i proven via `publishThroughDraft` i `apps/studio/test/fixtures/branding-draft-store.mjs`). Proven bevakar verkliga skydd och är portade, inte raderade: `apps/studio/test/partner-branding-api.test.mjs:109-127` (rättigheter bara ur paketets mallar, 404), `:197-208` (fel revision 409, fält utanför mallen 422), `:210-223` (API:ts egen paket-CAS i `review`, 409, utan skrivning), `:170-195` (bara exakt tilldelade lager, 422), `:225-237` (409), `:249-257` (tomma eller olösta val kan inte publiceras igen), `:259-307` (bolagets material kontrolleras inne i skrivningen, 503); `apps/studio/test/partner-presentation-flow.test.mjs:56-74,76-92,111-132` (publicerad presentation, dealerval, 422 och 409); `apps/studio/test/operator-package-api.test.mjs:901-917,940-952` (bolagets eget material och inaktuell revision); `test/presentation-layers.mjs:68-103` (lagerrättigheter; mallbytet både från separata lager och från bakad mall, 422); `test/v3-room-dealer-choices.mjs:147-172` (`dealerChoices` per spelbord, nekat dealerval, återställning). (`test/public-operator-rooms.mjs` har en annan `api.read` och berörs inte.) | `lib/partner-branding-api.mjs`, `.d.mts`, de fem provfilerna, `test/fixtures/branding-draft-store.mjs` | sviterna `studio`, `contracts` och `access` gröna; varje påstående ovan finns kvar mot `readState`/`command`; `git grep -n -E "\.(read|write)\(\{ ?operatorId" -- apps/studio/test test` tomt |
| **2d reservgrenarna (server)** | först en läsfråga i Neon (produktion och preview): finns något `croupier_studio.operator_packages` för ett aktivt bolag, senaste revision, utan `branding.presentation`? Är svaret nej tas bara de två anropen `parseList(pack?.presentations ?? pack?.lanes).map(owned)` (`partner-data.mjs:238`) och `parseList(pack?.tables).map(owned)` (`:262`) bort, och `parseList` (`:35-40`) om den då saknar anropare. `owned()` (`:41-51`) **behålls**: `teamRow` använder den (`:88`) och den är isoleringsskyddet som nekar en rad för fel bolag (`:44`, avsnitt 6) | `lib/partner-data.mjs` | frågans svar i PR-beskrivningen; `studio`-sviten grön; isoleringsproven i avsnitt 6 oförändrade |
| **3 meny i `packages/navigation`** | `packages/navigation/partner-navigation.mjs` enligt 4.2; `partner-copy.mjs` och Hjälp läser den; `partnerRoomTabs`; Jakobs svar om Spelare och Dealers | `packages/navigation/*`, `components/partner/partner-copy.mjs`, `views/help.*` | menyval och Hjälp kommer ur en modul; varje menyval nås av rätt roll och nekas av fel roll via meny **och** direktadress (`partner-view-access`); menyproven läser `aria-current` och `href`, inte ordlistor |
| **4 kit-paritet och TSX** | `views/ui.jsx` → `views/ui.tsx` med Admins namn och props (`Card{title,aside}`, `Badge` med `tone`, `Row`, `Rows`, `Empty` med `chip='Inte anslutet'`, `KV`, `Note`, `Stat{label,value,hint,icon}`, `ActionMenu{name,actions}` med `disabled` som sträng, `ConfirmDialog{consequences}`, `TechnicalDetails`); tokens i `partner-portal.css` byter namn till `--sg-*` (Admins namn i `client/admin/app/studio.css`); vyerna blir `.tsx` en i taget (en PR per två vyer är lagom) | `components/partner/**` | `tsc --noEmit` i `apps/studio` grönt; renderad markup per vy oförändrad i sak (samma roller, rubriker och aria); Jakob har sett skärmbilder 390 px, 768 px och desktop |
| **A-rest (server)** | punkterna 1, 4 och 6 i 4.3: `tables.read` på branding-GET, Historik med `reports.read`, det tabellstyrda provet | `lib/partner-session.mjs`, `lib/partner-branding-api.mjs`, nytt prov | provet passerar för alla tolv × alla vyer och åtgärder; inga ändringar för standardrollerna |
| **B editorn** | flikarna `utseende`, `dealer`, `spel`, `tillganglighet`, `historik` i `partner-appearance.tsx` (i dag bara Utseende och Historik, `:336-337`); `spel` och `tillganglighet` som läsvyer med *Låst av Scoutgaming* (Admins ord, `companies-page.tsx:257`) i stället för "bestäms av Scoutgaming" (`partner-appearance.tsx:223`) tills C finns; granskningen behåller "Utkastet är gemensamt" (`:295`) och listan över berörda spelbord (`:293`); Bordsfärgen finns inte i formuläret (`LAYERS`, `:29`) men lever kvar i serverns fält (`packages/operators/contracts/branding.mjs:2-3`, `partner-branding-api.mjs:144`) och som etikett i granskningen (`:92`); den tas bort i egen PR när Admin slutar erbjuda `table.color` (`packages/presentation/contracts/presentation-layers.mjs:68`) | `components/partner-appearance*.tsx`, `views/rooms.tsx` | bolaget kan bara välja det som finns i paketet, servern avvisar annat (`partner-branding-api.mjs:182-200` + nytt prov), granskningen visar rätt påverkan; Admins rumsläge (`registered-studio.tsx`) oförändrat |
| **C partner-API** | i ADMIN-FORENKLING 5.5:s ordning: läsa tilldelningen; byta dealer inom tilldelningen; spelinställningar (`tables.configure` + `allow.language`/`allow.limit`, återanvänder `lib/room-game-config-api.mjs` med partnersession, aldrig Admins endpoint); pausa eget spelbord (`tables.configure` + `allow.pause`, återanvänder `room-state`-logiken i `lib/resource-lifecycle-api.mjs:179`); begära material; begära nyckelrotation. Varje åtgärd i vitlistan `partner-session.mjs:323`, med Origin-kontroll (`:334-338`), bolag ur sessionen och CAS mot revision | `lib/partner-session.mjs`, `lib/partner-*.mjs`, `packages/operators/**` | acceptanslistan i ADMIN-FORENKLING 5.6 passerar i preview. **Begära material och rotation som journalpost kräver DDL först**: `operator_audit_events.action` har en CHECK-lista (`ops/neon-studio/006-operator-audit.sql:12`) och lagret en spegel (`operator-store.mjs:28`); ordningen är tolerant kod → migrering som Jakob applicerar → kravhöjning |

PR 1 kan gå direkt efter PR 0. PR 2, 2b, 2c och 2d är oberoende av varandra efter PR 1. PR 3 före PR 4. A-rest kan gå parallellt med 3 och 4. B efter 4, C efter B (eller C:s läsdel parallellt med B).

## 6. Vad som inte får gå sönder

| Skydd | Var | Prov som bevakar det |
|---|---|---|
| **CAS på utkastkedjan** | `operator-store.mjs:719-727` (`expectedDraftRevision`, `expectedPackageRevision`, publicering bara från eget utkast) | `test/partner-branding-drafts.test.mjs`, `test/partner-branding-postgres.mjs` (sviten `contracts`) |
| **`reviewToken`** | `partner-branding-api.mjs:268-271,358` | `test/partner-branding-api.test.mjs`, `test/partner-presentation-flow.test.mjs` |
| **Omprövning i transaktionen** | bolagsraden låses (`partner-session.mjs:446-455`), behörigheten läses om (`:438-444`); paketets CAS (`operator-store.mjs:588`) | `test/partner-session.test.mjs`, `test/partner-branding-postgres.mjs` |
| **J08 och spelinställningarna** (när C rör dem) | förbud mot att ändra andra spelbords bindningar (`packages/presentation/server/room-game-publication.mjs:99`), 409 vid konflikt (`:19`), 404 mellan bolag (`lib/room-game-config-api.mjs:46-52`) | `test/room-game-config-api.test.mjs` och J08-proven |
| **Bolagsisolering** | session, bolag, scope och medlemskap (`partner-data.mjs:192-215`, `partner-session.mjs:370-395`); `owned()` nekar fel bolag (`partner-data.mjs:44`); klientens andra kontroll (`partner-workspace-context.mjs:3-17`, även nycklarna från #561); nycklarnas försvar på djupet (`partner-api-keys.mjs:42`); Origin/CSRF på POST (`partner-session.mjs:334-338`) | `partner-view-access.test.mjs:164-192` (annat bolag: sidor, ekonomi, API), `:244-310` (#561: nycklar, inga skrivningar, läget före 012), `partner-session.test.mjs`, `partner-admin-workspace.test.mjs` |
| **403 på direktadress** | vykartan (`partner-access-policy.mjs:26-29`), beslutet (`partner-data.mjs:227-228`), 403-kortet (`partner-operator-workspace.jsx:199-207`); klienten byter aldrig själv till en nekad vy (`:86,108`); API-vägarna svarar 403 | `partner-view-access.test.mjs:93-134` (redaktör nekas Team, Spelare, Ekonomi, Integration; läsare får läsa men aldrig skriva), `:194-207` (anonym eller förfalskad session), `partner-workspace-visual.test.mjs:79-93` |
| **Sista administratören** | `operator-store.mjs:414-418`, `partner-team-api.mjs:96`, `partner-admin` kan inte delegeras (`operator-admin-api.mjs:17`), UI-märket (`views/team.jsx:57-58,85-87`) | `partner-team-api.test.mjs:280-`, `partner-team-loader.test.mjs:99`, `control-operator-directory.test.mjs:97-149` (Admins sida) |
| **Intern admin** | alla tolv behörigheter i aktiva bolag (`partner-workspace-access.mjs:17-27,41-42`), Admin- och lobbylänkar bara för personal (`partner-operator-workspace.jsx:166`) | `partner-workspace-visual.test.mjs:104-120`, `partner-admin-workspace.test.mjs` |
| **Utkastvakten** | `partner-navigation-guard.mjs`, skalet `:59-62,72-78,97-103,170` | `partner-navigation-guard.test.mjs`, `partner-room-selection.test.mjs`, `partner-workspace-visual.test.mjs:252-267` (redigeraren behåller identitet mellan vyer) |
| **Kevins gamla adresser** | `workspace-surfaces.mjs:9-20`, `workspace-surface-page.tsx:39-42` | `workspace-surfaces.test.mjs`, `workspace-surface-pages.test.mjs` |
| **Serverläsningen bakom klientgränsen** | hookmodulen (`partner-copy.mjs`) får inte nå servergrafen | `partner-server-graph.test.mjs:62-66` (sökvägarna byts i PR 1, påståendet behålls) |

## 7. Följdändringar som andra äger

- **`docs/README.md`** (ägdes av #559, nu mergad): lägg till raden
  `| [plans/PARTNERPORTAL-KONVERTERING](plans/PARTNERPORTAL-KONVERTERING.md) | Partnerportalen från kevin-bo till mains mönster: inventering fil för fil, Kevin-beteenden som behålls, målstruktur, PR-sekvens och skydd | Orkestreraren och den som bygger varje PR | Per PR i sekvensen, raderas när den sista är verifierad |`
  efter raden för `plans/KEVIN-PORT`.
- **ADMIN-FORENKLING** 5.1 (sista stycket) och 5.4 (kolumnen "Kontrolleras på servern i dag") och **ADMIN-KARTA** rad 156-159 (kolumnen Legacy-spår), 180 och punkten Kevin under Legacy-spår (rad 314, `kevin-bo` med DESTINATIONS m.m.) beskriver läget före 28 oktober (radnummer på 2a4cc9c4). Admin-arkitekten bör hänvisa till avsnitt 1 och 2.4 här eller rätta raderna.
- Sökvägarna till `kevin-bo/` i NYCKEL-BOLAG, ADMIN-KARTA, ADMIN-FORENKLING och `apps/studio/README.md` byts i PR 1 (listan står där).

## 8. Jakobs beslutspunkter

1. Spelare i menyn med tomläge nu, eller dold till steg F (avsnitt 4.2).
2. Dealers som egen sida (5.1) eller bara som flik under Spelbord (registret rad 58).
3. Om spelbordets Historik ska synas för läsaren (`reports.read`) eller bara för administratören, som i dag.
4. Om Admins spelbordsbild ska få SceneThumbs lagerbild.
5. Migreringen för journalposterna "begär material" och "begär rotation" (steg C).
