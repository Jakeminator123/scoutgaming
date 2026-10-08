# Aktuell handoff — Scoutgaming

## 8 oktober 2026 eftermiddag: T9 layer-preview bakom flagga

Spelvägen har ett opt-in-spår för tre lager utan att röra Astrids ordinarie local-väg:
ny server-lane `layer-preview` (`renderer: layered`, default dealer `paow`) och ny
Render-rutt `/layer-packs/*` som bara svarar när entrén har satt cookie-flaggan
`croupier_layer_preview=1`. Rutten serverar runtime-moduler från
`test-videoeditor/program/web` och manifest/media från `lab/preview-build`, med
`Range`-stöd och `Cross-Origin-Resource-Policy: same-origin`.

Klienten har ny modul `web/public/layered-presentation.mjs` som monterar canvas i
`#scene`, laddar `/layer-packs/<dealer>/manifest.json` och matar `bridge.consume`
med serverns `presentation[]` från `/api/table`. `unsupported[]` (exempelvis `speak`)
loggas som kvitto i observationsflödet och kastas inte. Om paket saknas visas
`Lagerpaket saknas · 2D-reserv` och ordinarie DOM/SVG-kort fortsätter.

`gameChoices` för `layer-preview` öppnar dealer-val `paow/dragge` och bakgrundsval
från katalog-ID:t; panelen Ditt bord använder samma lagring som N3.4.
`#dealer-options` listar fortfarande bara dealers i `DEALERS`-objektet, alltså inte
Paow/Dragge där ännu; de syns i Ditt bord-panelen.

## 8 oktober 2026 sen eftermiddag: e-postinbjudan för operatörspersonal

`invite` i partner-API:t och `operator-membership` med e-post skapar ett partnerkonto utan
hash, en engångstoken (samma `tokens`-tabell och `studio-sha256:`-hash som Studio) och
medlemskap `invited` när adressen saknas; ett befintligt partnerkonto kopplas `active` utan
mejl. Mejlet (Resend, rubrik "Inbjudan – operatörspersonal, nivå 2") bär bolagsnamn, roll och
länk till `/partner/set-password?t=`. Svaret är alltid `{ invited: true }`; högst 5 per aktör och
timme, sedan 429. `POST /api/partner/set-password` konsumerar token, sätter scrypt-hash, bumpar
auth-epoch och aktiverar inbjudna medlemskap; Studio:s set-password och login vägrar fortfarande
roll `partner`. Journalen loggar maskad e-post. Översikten `/control` läser riktiga bolag via
`listLaneOperators()` när native admin är på. Inte klickat i webbläsare; inget riktigt mejl skickat.
Kvar: glömt-lösenord för partner, journaltabell.

## Nuläge per funktion

| Funktion | Status | Avsnitt |
| --- | --- | --- |
| Klipplogik och lane | påbörjad — system A är det enda urvalssystemet och `select` gäller alla fyra dealers (Astrid bevisat oförändrad, baslinje 160 anrop); `project.lanes[]` redigeras och publiceras på `/control/lanes`; lanen bär zoner, bordsfärger, probe och idle som valfria fält; Render läser paketet på `/blackjack?operator=` och Vercel `/play/blackjack?operator=` hämtar det dokumentet (L8b); kvar: rehearsal Vera/Amira/Mei (2D-reserv tills nya paket), tre lager i spelet (Jakobs gren), klick i prod. Uppföljning: `random/checklista-2026-10-08.md` | 8 okt eftermiddag |
| Nivå 1 /control | påbörjad — en kodgeneration på sidmallen; Händelser en sida, Probe i menyn, Lanes med lane-redigerare, Översikt med anslutna bolag, Uppspelning är loggen, ljust läge rättat på fyra ytor; kvar: filterchips (11), Probe verifierad i prod (C9) | 8 okt middag |
| Nivå 2 /partner | påbörjad — session finns; team och branding skrivs (revision som CAS, sista-admin-spärr i lagret); Bolag på `/control/lanes` skapar bolag, roller och medlemskap; e-postinbjudan skapar inbjudet partnerkonto + engångslänk till `/partner/set-password`, kontot kan sedan logga in på `/partner/login` (5 inbjudningar per aktör och timme); Översikten listar riktiga bolag ur Neon när lagret är på; kvar: journaltabell, glömt-lösenord för partner, speldata, prod-klick | Skrivande partnerrutter, Partnerportal |
| Nivå 3 /play | påbörjad — lobby med `Spelar hos` och senaste bord/dealer från webbläsaren; redigerbar profil (namn, språk; migration `006` väntar); historikrutt; panelen Ditt bord väljer dealer och bordsfärg inom lanen (N3.4). Bakgrund är avstängd när filmen är inbakad. Valet ligger inte på kontot | Spelaryta |
| Tester och dokumentation | klart 7 okt natt — körare för lösa tester, dokumentation mot kod (D1–D32); 8 okt: CI-steget Orphan tests, ffmpeg från cache, GPU-workflows på `ubuntu-24.04` | Pass M |
| Studio-migrationer | klart — 001–005 applicerade på produktions-Neon 7 okt; CI-spärr före deploy | Partnerportal |
| Systemkarta | klart — tre nivåer, CI-spärr; baslinje `8ebb53e2`, grå med 0 röda | Systemkarta |
| Render croupier-v2 | manuell deploy 8 okt 12:45 med L8/N3 (`/api/profile` svarar 401, `/api/operators/<slug>` läser Neon); `006-player-profile.sql` väntar på körning | Aktuell leverans |

Uppdaterad 8 oktober 2026. Detta är den enda löpande handoffen.
[Äldre komplett handoff, fryst på 4ed55a56](https://github.com/Jakeminator123/scoutgaming/blob/4ed55a5624a28cdd82d8a0c252ead7a24ef3165e/docs/JOHN-HANDOFF.md)
bevarar samtliga tidigare statusnotiser och kvittoplatser. Privata bevis,
journaler och backups ligger kvar; detta är dokumentstädning, inte nya order.

## Skrivande partnerrutter, 8 oktober 2026 eftermiddag: bolag, roller, team (N2.2, N2.3)

Byggt på 005 och `ac936377` utan att vänta på Kevins svar (#3); ingen migration. Väntar på orkestratorns granskning.
Nivå 1: POST `operator-create` (bolag med standardrollerna `partner-admin`, `partner-editor`,
`partner-viewer`), `operator-role` (kända behörigheter; `team.roles.assign` bara på `partner-admin`)
och `operator-membership` (befintligt konto med roll `partner`, revision som CAS, sista-admin-spärr).
Kortet Bolag på `/control/lanes` listar bolag och medlemmar, skapar bolag, lägger till medlem via
användarnamn, byter roll och stänger av. Äldre bolag som `sg-test` får rollerna med Skapa saknade
standardroller; först med ett medlemskap som `partner-admin` eller `partner-editor` slutar
branding-skrivningen ge 403. Nivå 2: `GET/POST /api/partner/team?operator=` (GET kräver `team.read`,
POST dessutom `team.roles.assign`). Bjud in kopplar ett befintligt partnerkonto via e-post; ingen
e-post skickas (N2.6). `partner-admin` är inte delegerbar, så operatören kan inte utse, degradera eller
stänga av administratörer. Kevins `team.jsx` har ett additivt `runtime.team`; utan det renderas vyn
som förut. Bjud in och rollbyte anropar API:t i riktig session; avstängning finns i API:t och i Bolag,
inte i Kevins vy. Journaltabell saknas: varje skrivning ger en serverloggrad `[operator-journal]`
(at, actor, action, operatorId, target, ingen e-post). Testat: lab `npm test` (två webbläsartester
hoppas över som förut), `npm run typecheck`, `npm --prefix lab run build`, hela
`.githooks/pre-commit-full` (Kevins portaltest, `test/operator-store.mjs`,
`test/partner-access-policy.mjs`), systemkartan utan fel. Kvar: e-postinbjudan och accept-steg,
journaltabell; en admin-409 skiljer inte sista-admin från revisionskrock; låstimeout i partner-API:t
blir 503. Kevin godkänner rollnamn, standardbehörigheter, placering och journalformat.

## 8 oktober 2026 middag: paketet når spelet, select för fyra dealers, spelarprofil

Tre promptagenter levererade parallellt, orkestratorn löste korsfelen och mergade.
Spelmotorn läser operatörspaketet på `/blackjack?operator=<slug>` (lane och dealer
begränsas till paketet, 30 s cache, okänd slug 404, utan `?operator=` oförändrad väg).
`POST /api/presentation/select` gäller alla fyra dealers; `legacyClipPolicy` översätts till
standardvarianter vid läsning och Astrids svar är bevisat oförändrade (baslinje 160 anrop,
`tools/astrid-select-baseline.mjs`). Vera, Amira och Mei spelar 2D-reserv där klipp saknas
tills nya paket finns. Spelaren kan redigera visningsnamn och språk (`PATCH /api/profile`,
saldo serverägt) och lobbyn visar `Spelar hos`. Migration `006-player-profile.sql` väntar på
körning mot spel-Neon, Render väntar på manuell deploy, rehearsal av tre dealers väntar på Jakob.
Uppspelning är nedbantad till loggen; ljust läge rättat på `/partner`, guiden, chatten och
inspektorn; demo-bolagen bor i `web/demo-operators.mjs` så servern inte importerar `lab/`.

## 8 oktober 2026 eftermiddag: Vercel bär paketet, spelaren väljer inom lanen

L8b och N3.4. Vercel `/play/blackjack?operator=<slug>` hämtar Renders `/blackjack`-dokument
(paketets lane och dealer, bolagets 404, 503 om motorn inte svarar). Ogiltig slug och en
signerad launch med `claims.partner` skickas inte som operatör. Utan `?operator=` är vägen
densamma som förut. Spelet får `gameChoices` från lanen även utan bolag. Panelen Ditt bord
byter dealer via befintlig adress och lägger bordsfärg på filt-märke, plånbokskant och
marker. Inbakad bakgrund går inte att välja. Valet sparas i `localStorage`, inte på kontot.
Testat: spelentré, spelarval, lobbyns text, fuzz 3000 rundor, dealer-probe PASS. Inte klickat
i webbläsaren eller i produktion. N2.2 (skrivande partnerrutter) har ingen kod i den här leveransen.

## 8 oktober 2026 förmiddag: Lanes, clipLabels, CI-actions

`/control/lanes` publicerar ett operatörspaket (POST `operator-package`) och kan skapa
`SG test game provider` på klick (POST `operator-create-demo`). Skrivningar kräver Neon-pool
med `connect()`; `{ query }` ger 503. Spelet läser inte paketet. Klippbibliotek sätter
`project.clipLabels` via sidans Spara. `dealer-regression` använder `pnpm/action-setup@v6`
och `actions/upload-artifact@v7`. Kartans L3-ruta är live.

Andra passet samma förmiddag (fyra parallella underagenter): `/control/lanes` har en
redigerare för `project.lanes[]` (ny lane, dealers 1–4, lager, OpenClaw-läge,
bolagsjusteringar; Spara projekt är sidans lime, Publicera paket sekundär; id låses vid
skapande). Översikten listar anslutna bolag ur fixturen med länk till `/partner/{slug}`.
Partner-API:t har `GET/POST …/branding?operator=` som läser och skriver bolagets utseende
inom lanens `operatorAdjustable` (revision som CAS, rättighet `presentations.configure`,
pool med `connect()`); panelen visas i Kevins vy Färger, marker och kort för inloggad
operatör. Inga roller seedas förrän N2.2, så skrivningen ger 403 i produktion tills dess.
Död CSS borta, guiden har dagens sidnamn, `returnTo` efter utloggning pekar tillbaka på
`/control/preview` och `/control/lanes`. Jakob 10:32: `/control/lanes` ersätter Kevins
gamla alias som ledde till Administration. Promptfiler för L8, C5b och N3 ligger i `random/`.

## Pass S, 8 oktober 2026 natt: klipplogik steg 3a, Händelser en sida, förhandsvisning

Jakob 02:49: "kör enligt rekommendationerna, bortse från John om det blockar". Beslut 49–59 i
`random/beslutsmatris-2026-10-07.md`; förslag `random/k2-forslag-2026-10-08.md`; fakta
`random/k1-fakta-spelvagen-2026-10-08.md`; uppföljning `random/checklista-2026-10-08.md`.
Fyra underagenter parallellt, orkestratorn granskade och rättade.

Ändrat. Studio-projektet har `lanes[]` (presentation lane: dealers, lager bakgrund/bord/dealer,
OpenClaw-läge per händelsetyp, vad bolaget får ändra) och `clipLabels`; `schemaVersion` kvar på 1,
standardlane `mobile-phone` när nyckeln saknas, ingen läsare ännu. Klipp visas med svenska namn ur
`familyId` + roll utan filbyten. Händelser är en sida: `/control/events` utan `?event=` är
översikten, `/control/tree` omdirigerar 308 med frågesträngen kvar. Menyraden heter Probe, Johns
fyra etiketter är djuplänkar `/control/administration?tab=`, inloggningskortet ligger på
sidmallens tokens. `test-videoeditor/` bär lagerprovets material (ursprungligen grenen
`test-video-jakob`, byte-identiskt speglad och raderad 8 okt 18:35; förhandsvisning Paow/Dragge 720p,
12 MB, webbspelare med WebGL-kompositor); `/control/preview`
visar den bakom adminsessionen via `/preview/[...path]` (ingen publik kopia, media som filer,
inget till blob eller databas). `test/fuzz-blackjack.mjs` fuzzar serverns `web/shoe-game.mjs`
(3 000 rundor i kroken, 100 000 gröna). Systemkartan har sidan och handlern; menynamnen är
uppdaterade i `AGENTS.md`, `CLAUDE.md`, README-filerna, labbguiden, terminologibladet och driftdokumenten.

Testat: labbtester 954 gröna (2 skippade sedan tidigare), typecheck, systemkartan 0 röda,
orphan-kontrollen 263 filer, full pre-commit-krok per commit, lab-bygget med prepare-steget.
Produktion verifieras som `LLM`: `/control/events` med och utan `?event=`, `/control/tree?dealer=astrid&event=idle.ready`
(308), `/control/probe`, `/control/administration?tab=accounts`, `/control/login` ljust/mörkt,
`/control/preview` (Paow/Dragge spelas, inget skrivs), `/studio/preview/index.html` utan session
ska leda till inloggning.

Kvar: K steg 3b (select för alla fyra dealers, `legacyClipPolicy` → standardvarianter) kräver
rehearsal med Jakob dagtid. Lane-export, bolagets yta, demo-operatör (L1–L3, rad 44). Redigering
av `clipLabels`. Systemkartans `planned`-rutor (matris 42). Nivå 2-rutter väntar på Kevin.

## Pass M, 8 oktober 2026 natt

Mekaniskt pass enligt `random/handoff-2026-10-08-orkestrator.md`, två underagenter parallellt,
granskat av orkestratorn. Beslut i `random/beslutsmatris-2026-10-07.md` rader 45–48.

Ändrat: `a91f92ee` tre gränssnittstexter (L20–L22). `820709dd` Uppspelning monterar det
rullande observationsfönstret via en egen `rolling`-prop i `ActivityLog`; *Visa spelfliken här*,
Partner-SSE och övriga verktyg finns kvar (rad 39, L23). `815b0b76` Bakgrundszoner på sidmallen
med kortad text, alla funktioner kvar (rad 43). `f95ed1ef` GPU-workflows på `ubuntu-24.04`.
`683dd4fd` ffmpeg i `presentation-studio` och `lipsync-worker` installeras från cachade `.deb`
(`actions/cache`, nyckel `ubuntu-24.04-ffmpeg-<version>`), nedladdning bara vid miss; jobben får
`actions: write` för att spara cache. `9dbfe09e` CI-steget Orphan tests
(`tools/check-orphan-tests.mjs`): 259 testfiler, 0 föräldralösa, 3 undantag med motivering i
`tools/orphan-tests-exceptions.json`; tre gröna tester in i `pre-commit-full`.

Testat: labbtester 941/943 (2 skippade sedan tidigare), typecheck, systemkartan grå, full
pre-commit-krok för varje commit (ffmpeg och jq lokalt). Produktion verifieras som `LLM`:
`/control/activity`, `/control/guide`, `/control`, `/control/zones` ljust och mörkt.

Kvar: `dealer-regression` installerar ffmpeg och jq utan cache (rad 46). `test/fuzz-blackjack.mjs`
är ett manuellt skript mot klientmodulen och räknar invariantbrott (rad 47). Johns rader 11, 12,
14, 17b. Klipplogiken: steg 2-förslaget väntar på Jakobs svar; lagerspåret (tre lager) finns som
lane `layer-preview` (T9) och provas i rehearsal; se `random/checklista-2026-10-08.md`.

## Sista operatörsadmin, 7 oktober 2026 natt

Ändrat (`186c6bc4`): operatörslagret (`web/storage/operator-store.mjs`) avvisar en ändring av
medlemskap (roll eller status) eller av en befintlig roll som skulle lämna bolaget utan aktiv
admin. Admin är en aktiv medlem vars roll har `team.roles.assign`
(`OPERATOR_ADMIN_PERMISSION` och `isOperatorAdmin` i `web/partner-access-policy.mjs`).
Avvisningen är 409 `studio_last_operator_admin`. Kontroll och skrivning sker i en transaktion
med låst bolagsrad; utan en pool med `connect()` avvisas sådana skrivningar med 503. Ingen
migration, ingen vy och ingen rutt. Sqlite-vägen i `web/server.mjs` är granskad utan ändringar:
produktion kör postgres, sqlite bär offline-labbet (beslutsmatrisens rad 36).

Testat: 82 tester för lagret, policyn och partnerdatan, labbtester, typecheck, systemkartan och
full regression lokalt utom `test/bugshot-report.mjs`. Kvar: ingen rutt eller vy skriver
medlemskap (L5, L11), en skrivande rutt måste skicka poolen (L24), ingen databasspärr och
inget samtidighetsprov mot riktig Postgres.

## Teststädning och dokumentation, 7 oktober 2026 natt

Teststädning: sex gröna testfiler utan körare och tre frontendtester (lobby/profil/historik,
landningssida, introenhet) körs nu av `.githooks/pre-commit-full`. Testberoende DOM är borta
(dold text "Nivå 1 · ScoutGamingGroup", konstanterna i `lab/lib/studio-navigation.mjs`); skyddet
för gamla menyadresser är en fast lista i testet. Pensionerade namn i tester är bytta;
`tools/backup-lissabon-state.mjs` heter `tools/backup-lab-state.mjs` med oförändrat backupformat.
GitLab-inboxens verktyg och test är borta; `identity` och låset ligger i
`tools/croupier-chef.mjs`. Död CSS för gamla Studions sidomeny och chattgenvägar är borttagen.

Dokumentation: `AGENTS.md`, `CLAUDE.md`, `README.md`, `lab/README.md`, labbguiden,
`lab/docs/guide.json`, driftdokumenten och `.cursor/rules` följer koden (avvikelserna D1–D32 i
`random/docs-avvikelser-2026-10-07.md`): partnerinloggning och spelarsidorna finns, dagens
`/control`-namn, start med `node lab/start.mjs`, repot `scoutgaming`. T2 och T4 är öppna.

Testat: labbtester, open-claw-tester, typecheck, build, systemkartan och full regression
lokalt utom `test/bugshot-report.mjs` (kräver `jq`). Kvar: `test/backoffice-lab-browser.mjs`
är opt-in och inte körd; tre gränssnittstexter ligger efter koden (lösa trådar L20–L22), och det
rullande observationsfönstret monteras inte längre på någon sida (L23).

## /control-ombyggnad, 7 oktober 2026 kväll

Underlag: `random/control-inventering-2026-10-07.md` (varje knapp och flik, C1–C265),
`random/losa-tradar-2026-10-07.md` (19 ofärdiga kopplingar, inte åtgärdade) och
beslutsmatrisens rader 21–30.

Ändrat: delat tillstånd för Studio-sidorna ligger i `useStudioSession`
(`lab/components/studio-session.tsx`) med vakt mot osparade ändringar. Händelser →
klipp, Uppspelning och Guide & hjälp är egna sidor på sidmallen; val av dealer och
event följer med i adressen (`?dealer=&event=`), loggen i `sessionStorage` (högst 150 poster).
Dealers & klipp har tre flikar; Probe, Bakgrund och Uppspelning är länkar. Nio döda
Kevin-adresser ger 404. Sökattrappen och dubbla sparpiller är borta. Rotens startfiler
är borttagna; start sker med `node lab/start.mjs`.

Andra omgången: Händelser, Klippbibliotek och Talgranskning är egna sidor.
OpenClaw har flikarna Agentmodeller och Chatt (`?tab=chat`); `/control/operator-chat`
omdirigerar dit. Händelser har dealerchips, eventsök och eventlista i sidan, villkors-
biblioteket även för Astrid, idle som länk till Dealers & klipp och en rad om att
Vera, Amira och Mei inte används av spelet ännu (lös tråd L19). Valet av variant följer
med i adressen till Klippbibliotek. Mottaget steg från Uppspelning öppnas i Händelser
via `sessionStorage`. `lab/components/studio.tsx` och `StudioPage` är borttagna;
data laddas med `lab/app/control-studio-data.tsx`.

Testat: 942 labbtester (940 gröna, 2 skippade webbläsartester), typecheck, build,
systemkartan (gul, 0 röda), full regression lokalt utom `test/bugshot-report.mjs`
som kräver `jq` (finns i CI). Omskrivna tester gäller avsiktligt borttagen UI och listas
i commit-texten. Kvar: situationen från en videomapp följer inte med till Händelser.

## CI, 7 oktober 2026 kväll

`dealer-regression` föll två gånger när Ubuntus paketservrar var långsamma:
nedladdningen av PostgreSQL passerade QA-skriptets gräns, och `apt-get install ffmpeg jq`
hängde i 30 minuter. Tredje försöket blev grönt. De tre jobben i
`.github/workflows/croupier.yml` kör nu på `ubuntu-24.04` i stället för `ubuntu-latest`
(som byts till Ubuntu 26 från 19 oktober). Installationen hoppas över om verktyget finns,
har en egen gräns på 8 minuter och tre försök. Den isolerade SQL-acceptansen använder
runnerns PostgreSQL 16 om den finns och laddar annars ner som förut.
`.github/workflows/astrid-gpu-build.yml` (rad 15) och `astrid-gpu-publish.yml` (rad 21)
kör fortfarande `ubuntu-latest` och ska låsas till `ubuntu-24.04` före 19 oktober.
`croupier.yml` är redan låst.

## Kopplingar som saknas

Ytan kan finnas, men kopplingen saknas. Listan följer `random/losa-tradar-2026-10-07.md`.

- **L1** Lane-villkor för idle och kortutdelning skrivs inte in i operatörspaketet, och en ny porträttlane får ingen egen klippuppsättning. `lab/components/studio-administration.tsx`, `web/public/game-lanes.mjs`.
- **L2** Ingen sida anropar `publishPackage`, och spelmotorn läser inte `operator_packages`. `web/storage/operator-store.mjs`.
- **L3** Bolagets filtfärg, marker och kort stannar i minnet och publiceras inte till spelet. `lab/components/kevin-bo`.
- **L4** Probe i Talgranskning är ett textprov utan ljud eller video. Menyn och administrationens talflik är olika saker. `lab/components/probe-editor.tsx`.
- **L5** Team-vyns inbjudan, rollbyte och suspend skriver inte till servern. `lab/components/kevin-bo/views/team.jsx`.
- **L6** Klienten kastar 501 på POST `speech-qa` innan något anrop. `lab/components/studio-administration.tsx`.
- **L7** `POST /api/history` och `/bo`-ompekningarna i `web/server.mjs` är inte deployade på Render.
- **L10** Spelare, transaktioner och rapporter hämtas inte från spelmotorn. `lab/lib/partner-data.mjs`.
- **L11** Ingen rutt anropar `createOperator`, `upsertRole` eller `upsertMembership`. `web/storage/operator-store.mjs`.
- **L12** Operatörsskrivningar får ingen rad i `audit_events`. `ops/neon-studio/001-studio-metadata.sql`.
- **L13** Lobbyn saknar operatörskontext och profilen kan inte redigeras. `apps/croupier-frontend/app/play`.
- **L14** Rollen `partner` kan inte bjudas in eller återställa lösenord. `web/account-role.mjs`.
- **L15** En intern admin-cookie öppnar inte riktiga bolag, och det finns inget bolagsval. `lab/lib/partner-session.mjs`.
- **L16** Bakgrundszoner styr inte spelets bakgrund. `lab/components/lab-studio.tsx`.
- **L19** Varianter för Vera, Amira och Mei sparas men spelets urval använder dem inte. `web/presentation-api.mjs`.
- **L23** Det rullande observationsfönstret monteras inte; Uppspelning stannar vid 300 meddelanden eller 4 MiB. `lab/components/activity-log.tsx`.
- **L24** En skrivande rutt för operatörer måste skicka poolen med `connect()`; partnerdatan skickar bara `{ query }`. `lab/lib/partner-data.mjs`.

## Design, 7 oktober 2026

Johns designpaket (`Croupier-Studio-design`) är infört på nivå 1: sidomeny i fem
grupper (`lab/lib/scout-navigation.mjs`), nivåväxlare, lime/ink-tokens i
`lab/app/scout-theme.css`, ljust och mörkt läge (`theme-toggle.tsx`, sparas i
`localStorage` som `sg-theme`), och en gemensam sidmall (`page-template.tsx`) på
Dealers & klipp, Agentmodeller och Administration. Inloggningssidorna renderas
utan meny. Bakgrundszoner och Händelser ligger under Studio. Administrationen har
ett menyval tills sidan får flikar. Medlemskap i partnerportalen renderas från
`kevin-bo/views/team.jsx`; verkligt läge är läsbart, utkast finns bara i
förhandsvisningen. Testat: 919 labbtester gröna lokalt (två ffprobe-tester
kräver ffmpeg och körs i CI), typecheck, build. Kvar: filterchips i klipplistan,
dold `<select>` bakom dealerchipsen, sektionsankare i administrationen,
"Spara alla" som riktig batch. Beslutsunderlag: `random/beslutsmatris-2026-10-07.md`.
Jakobs regel 7 okt: repots logik är facit, John styr design, Kevins nivå 2
anpassas till repot och inte tvärtom.

## Konton, 7 oktober 2026

Agentkontot `LLM` (roll `admin`, `croupier_auth.users` id 5) skapades på Jakobs
begäran med samma villkor som hans dg97-konto, så att agenten kan granska `/control`
inloggad. Lösenordet är Jakobs, inte i Git. Nivå 1-inbjudningar till Kevin
(`kevin.negash@scoutgaminggroup.com`) och Emil (`emilmattsson@yahoo.se`) skickades
via `POST /studio/api/admin/users/invite` med `emailSent: true`. GitHub-inbjudningar
med skrivrätt: `EmaCodeHero`, Kevins och Johns e-post; grenarna `kevin`, `emil`,
`john` finns, och `main` kräver PR för alla utom repo-admin. Teamets inbox är
GitHub Issues med etiketten `inbox` (`inbox/README.md`, `tools/inbox.mjs`); de
första beslutsärendena är #2 till John och #3 till Kevin.

## Namn, 7 oktober 2026

Denna dokumentpassning samlar personalens gränssnitt under `/control`:
`/control/clips`, `/control/administration`, `/control/tree`, `/control/videos`,
`/control/openclaw`, `/control/activity`, `/control/guide`, `/control/zones`,
`/control/events`, `/control/probe` och `/control/operator-chat`.
Kevins importerade backoffice (`lab/components/kevin-bo`) ligger kvar på
`/partner` och `/partner/{operatorSlug}`. Det är inte kontrollpanelen.
`/studio` är labb-servicens basePath, inte en fjärde produkt och inte namnet i gränssnittet.
Spelarytan är `/play`, `/play/profil`, `/play/historik` och `/play/blackjack`.
`174f893` är pushad till `main`. Gamla `/bo`, `/bo/login.html` och `/bo/set-password.html` svarar 308 till `/control/administration`, `/control/login` och `/control/set-password`. `/api/bo` är kvar som inloggningsbrygga.
Inget öppet acceptanskrav nedan markeras klart av den här passningen.
Äldre meningar som kallar `/studio` för produktionsverktyget är 6-oktoberhistorik.

## Spelaryta, 7 oktober 2026

`/play` är Spellobby, `/play/profil` egen profil och `/play/historik` egen historik,
alla i `apps/croupier-frontend` ovanpå befintliga `GET /api/auth/session` och
`POST /api/player` via ingress-headers. Utan session går profil och historik till
`/player-login?returnTo=…`; lobbyn visar inloggningsknapp. Historiksidan anropar
`POST /api/history` för egna aggregerade resultat. `/api/v1/history` är
partner-API. Spelmotor och signerad direktstart är oförändrade.
Testat före resultatrutten: `apps/croupier-frontend/test/player-area.mjs` 6, `platform-ui` 13,
`game-entry` 12, `tsc --noEmit` grön. Tomt resultat betyder inga avslutade rundor, inte en saknad rutt.

## Spelaryta, 8 oktober 2026

`/play/profil` har ett formulär för visningsnamn (2–40 tecken, inga styrtecken) och språk (`sv`/`en`).
`PATCH /api/profile` skriver bara `display_name` och `locale` på den inloggade spelaren.
Saldo och valuta är text. Produktions-Neon saknar kolumnerna tills Jakob kör
`ops/neon-game/006-player-profile.sql` mot speldatabasen (`croupier_game`, inte zones).
Då visar profilsidan "Inte tillgängligt än". Lokal SQLite får kolumnerna vid start.
Lobbyn visar "Spelar hos" från `?operator=` eller `localStorage['croupier.operator']`
via `GET /api/operators/<slug>` (`{slug, name}`, aktiv, cache 60 s). Utan Studio-pool
gäller fixturen, bland annat `sg-test`. Länken Spela Blackjack bär `?operator=` till
`/play/blackjack`; L8:s `approvedGameQuery` behåller den.
Testat här: `player-area`, `player-profile`, `platform-ui`, `game-entry`, `player-profile-api`, `public-operators`, `game-entry-contract`, `tsc --noEmit`, `fuzz-blackjack` 3000 rundor.
Ingen commit i den här passningen.

## Partnerportal, 7 oktober 2026

Nivå 2-skalet kan visa intern fixtur (`preview: true`) och riktig operatörsdata
(`preview: false`). Parallella filer i samma pass:
`ops/neon-studio/005-operators.sql`, `web/storage/operator-store.mjs`,
`lab/lib/partner-session.mjs`, `lab/lib/partner-data.mjs`,
`lab/app/partner/login` och `lab/app/api/partner`.

Gräns: `partner_session` är en egen cookie med eget syfte. En intern admin-cookie
öppnar inte partnerdata, och partner-cookien öppnar inte `/control`. Medlemskap
ger bara den egna operatörens data; annan operatör eller avstängt medlemskap ger
403, okänd slug 404. Spelare, transaktioner och rapporter är tomma med `notConnected`.
`/partner` utan session går till `/partner/login`. Interna admins ser fortfarande
fixturförhandsvisningen med Partnerportal-rubrik och login-länk.

Testat: `npm --prefix lab test` 909 pass (två ffprobe-tester kräver ffmpeg lokalt),
`npm --prefix lab run typecheck`, `test/operator-store.mjs`, `test/partner-access-policy.mjs`,
`test/studio-migrations.mjs`, `test/speech-ledger-import.mjs` 40 pass,
`docs/system-map/verify.mjs --check` 0 fel. Ingen riktig Postgres-körning här;
`tools/studio-isolated-qa.mjs` hashar nu `005-operators.sql` och körs i CI.

Drift: runtime kräver exakt migration 001–005. Kör `005-operators.sql` mot
produktions-Neon före deploy, annars svarar Studio-admin `unavailable`.
Kvar: operatörs-onboarding-UI, åtkomstjournal för operatörsskrivningar
(`audit_events` tar bara dokument/media), spelardata, transaktioner, rapporter.
Inget krav i T2–T4 är markerat klart.

## Systemkarta, 7 oktober 2026

Kartan beskriver nivå 1 `/control`, nivå 2 `/partner` och nivå 3 `/play`.
En Next-rutt som läggs till eller flyttas utan `routes.json` ger route-drift och CI-fel.
Kontraktens filhasher är prefixade. Inget acceptanskrav markeras klart.

## Aktuell leverans och ansvar

- GitHub: Jakeminator123/scoutgaming, main, repo-ID 1380630440. Gamla
  github-work-adressen vidarebefordras. Återskapa inte namnet.
- Ett Vercelprojekt: scoutgaming, prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD.
  Services bygger web från apps/croupier-frontend och studio från lab, båda fra1.
  Node-middleware och rotens request.path-regler för /control och /partner krävs.
- Render äger spelmotor/live/sessionauktoritet. Vercel visar UI och kör native
  Studio/admin-API; Neon håller policy/metadata/journaler, privat Blob medier.
- www.scoutgaming.tech är huvudadress. scoutgaming.tech och det gamla
  croupier-frontend.vercel.app ger 308. croupier-lab-ui.vercel.app behålls som
  kompatibilitetsalias. Det gamla frontendprojektet är en domänlös reserv med
  autobyggen och domäntilldelning av; det är inte markerat paused. QA består.
- Infrastrukturens tidigare verifierade leverans: 4ed55a56, Vercel
  dpl_3WvxoXqoraAj3WPBy2zG3pzhQipP READY, fullhook och CI37451320053 tre success.
  Läsande HTTP/static-prov och befintlig adminsession verifierade. Inga riktiga
  konto-/spel-/DB-skrivningar. Privat scoutgaming-delivery-final-read.json.

## Tre nivåer: denna ändring

Samordnat med chatten **Hämta Croupier från Kevins branch**, som släppt sina
filanspråk. /control är intern Kontrollpanel, /partner/{operatorSlug} är
Partnerportal och /play är Spelaryta med /play/blackjack. Fliken heter Administration.

Efter Jakobs förtydligande är nivå 1 en gemensam ScoutGamingGroup-adminyta:
/control visar verkliga verktygsingångar, inte Kevins parallella exempelpaneler.
Klipp/tal/media/konton-länkar leder till befintlig Studio med samma huvudmeny.
Oanslutna gamla exempelvyer visar en förklaring; de låtsas inte vara färdiga
produktionsverktyg. Kevin-komponenten renderas på /partner, inte /control.
Nivå 2 använder läsbara menyadresser och popstate. Gamla hashbokmärken fungerar.
Nivå 2:s lane-/designnotiser skiljer lokala marker/kort/bordsprov från faktisk
spelpublicering. Lokala designutkast kan fortfarande granskas i provbordet.
Operatörs-/administratörsbyte och authfel tömmer vyn; inga gamla utkast får
visas för en ny identitet. Klipp, masker, urvalsregler och publicering är interna.

/play/blackjack använder befintlig
sessionskontroll, sparad lane och spel-HTML. Äldre molnadresser går vidare;
giltig launch går genom samma signerade serverhantering och game-audience.
Spelmotor, media, sessionsformat och kunddatabas ändras inte.

Guide, ordlista och systembeskrivning förenar PDF-underlaget med aktuell kod.
Namn på ansvar är inte nya tjänster eller nya scheman. Privata random-förslag
ersätts med en pekare till aktiva dokument; originaltexter och PDF-kopior bevaras.
Den redundanta gamla agentbeställningen tas bort efter extern hashverifierad
backup i C:/Users/jakem/CroupierBackups/terminology-docs-20261006.

Lokalt verifierat: 43 riktade tester, båda typkontrollerna, båda produktionsbyggena
och full regression PASS. Isolerad webbläsare verifierar marker-notis, valt tema
i provbordet, bakåtknapp med bevarat utkast, operatörsbyte med bekräftelse,
omladdning med rätt lane, gamla hash-länkar och historik till annan operatör.
Den korta /administration går vidare till /studio/administration efter observerad
404 på den förstnämnda. Privat provkatalog: lab/data/platform-private/terminology-update.
Testservern och provfliken är stängda. Leverans a72c4bf1 är verifierad på
Vercel dpl_CMCcHtRDDDHxByk3VMRZw8ewtx2k, READY på exakt SHA, och
CI37462222613 har tre successjobb. Samordnaren verifierade 14 läsande
HTTP-prov, åtta JS/CSS-resurser och befintlig jakob-session: /control till
verklig Administration och klippverktyg, gamla #gen till förklaring samt
separat partnerförhandsvisning. Utloggade dokument går till login och
admin-/partner-API ger 401. Inga riktiga konto-/spel-/policy-/provider-skrivningar.
Privata kvitton: terminology-update/live-delivery.json och production-read.json.
Kompletteringen för en gemensam nivå 1 har dessutom 29 riktade tester,
ny Lab-typkontroll och nytt Lab-produktionsbygge PASS. Den behåller samma
färska adminauktorisering, lämnar partnerns data och utkast oförändrade och
skickar inga exempeloperatörsdata till den nya interna ingången.

## Nästa arbete och viktiga gränser

**Övertagande och stoppunkt, 6 oktober:** denna chatt tar över efter
**Hämta Croupier från Kevins branch**. Jakob skickar själv de två
personalinbjudningarna. Inga nya utskick/konton görs av agenten. Intern admin
når nivå 1, 2 och 3 med samma konto; nivå 2 var redan adminauktoriserad men
saknades i inbjudningstexten. Formulär, mejl och båda guiderna är nu samstämmiga.
`/partner` är en separat ingång med explicit val av demonstration, inte ett
automatiskt exempelbolag. Adminens val bland riktiga operatörer är
ännu inte aktiverat. Operatörens egen inloggning står i Partnerportal.
Riktiga kunder ska komma från verifierade organisationsanslutningar, inte namn
eller API-nycklar.
Gamla giltiga hashbokmärken och befintliga demo-adresser behålls.

Den avgränsade leveransen avslutar navigation/åtkomstinformation och
dokumentationsstädning. De öppna A–I-punkterna
är acceptans/driftarbete, inte ett påstående om att allt är produktionsklart.
Lokalt verifierat: 90 riktade UI-, serverrutt-, auth- och mejltester, Lab-
typkontroll och produktionsbygge PASS. Kod 4df5e74a och etikettkomplettering
ec060e73 är pushade; fullhook gav 1626 PASS/9 skip/0 fail vid båda kodcommits.
Vercel dpl_7vDDEzyvkN9ZLjqnyEhoKZHtF2Ny är READY på exakt ec060e73 med
produktionsalias, och CI37496945897 har tre successjobb. Sex läsande HTTP-prov
på första leveransen bekräftar login/401 utan inloggning. Befintlig adminsession
verifierade Kontrollpanel → nivå 2-ingång → Demo South → intern Administration.
Efter senaste publiceringen är även behörighetsvalets etikett verifierad live:
Administratör – nivå 1, 2 och 3. Det befintliga UI-provet bevakar denna etikett.
Privata loggar ligger under `lab/data/platform-private/level-two-takeover-*`.
Inga produktservrar har startats och agenten har inte skrivit konton, policy
eller riktig databas. Inga extra grenar, worktrees eller nya rapportfiler behövs.

Resend återlästes separat den 6 oktober: Johns verkliga inbjudan har **Bounced**
med **Recipient not found**, och mottagaradressen har lagts på suppression-listan.
Kontot väntar på aktivering. Rätt mottagaradress behöver bekräftas innan nytt
utskick; spärren har inte tagits bort. Ett mejl till Jakobs dg97-adress visas som
**Delivered** och det kontot som aktiverat. Det bevisar inte leverans till den
tidigare begärda Gmail-adressen, inte heller mottagarens faktiska inkorg eller
resetflöde. Exakta adresser och provider-ID finns endast i det privata kvittot
`level-two-takeover-delivery.json`. Jakob äger fortsatt utskicken och F:s
mottagaracceptans; denna agent har inte skickat något mejl.

**Personalinbjudningar, första leveransen 6 oktober:** samordnad fortsättning
efter a72c4bf1; åtkomsttexten har därefter kompletterats enligt övertagandet ovan.
Resend-adaptern skickar nu ScoutGamingGroup-mejl i text och HTML med
aktiveringsknapp, e-postadress och giltighetstid. Formuläret anger intern
adminpersonal, nivå 1, med åtkomst till hela nivå 1 och nivå 3 via samma konto
och lösenord. Befintlig serverauktorisering, kontokollisionskontroll,
transaktion och engångstoken används; spelarroller får ingen admintext eller
ny behörighet. Ingen lösenordsändring görs för mottagarna. Riktade mail-,
auth- och UI-tester samt Lab-typkontroll PASS. Kodleverans 6f32a58b är pushad;
full regression gav 1623 PASS, 9 skip och 0 fail. Vercel
dpl_B4kWYUVrsVa5aNmKGxiieQzoUu3s är READY på exakt kod-SHA med
www.scoutgaming.tech som produktionsalias. Befintlig adminsession har läst
den publicerade kontofliken/formuläret: tydlig nivå 1+3, endast adminval och
72-timmars aktivering. Inga konton eller tokens har skapats vid detta prov.
CI37462924847 är komplett med success i alla tre jobb.
De begärda verkliga utskicken
och mottagarnas aktivering/inkorg behöver eget leveransbevis enligt punkt F;
lokala testkonton bevisar inte mottagarnas aktivering.

Den enda arbetslistan är [CLOUD-MIGRATION](CLOUD-MIGRATION.md): T2–T4 för
verklig partneranslutning/lobby, A–I för övrig användar- och driftacceptans.
Pågående uppdrag är inte ett generellt mandat till nya migreringar eller betalda prov.

Resend är konfigurerat i produktion med domänbegränsad sändnyckel och
no-reply@scoutgaming.tech. Native invite/reset är Delivered till Resends
sandbox på 184fe66b; riktigt konto/token/aktivering/reset/inkorg återstår (F).
Den tomma extra Marketplace-installationen är borttagen, fungerande konto och
QA bevarade. Privat resend-setup-20261006.json. Äldre uppgift om tom nyckel är ersatt.

Regionprovet på samma 019dba6d flyttade Studio iad1→fra1: första
Studio→Administration 7,879→3,041 s, varm overview 1,595→0,328 s utan Neonuppgradering.
Färsk auth och anropsminskning består; första-/proxyväntan är inte fullförklarad (B).
Ingen generell latensgaranti. Båda Services använder nu fra1.

GG: senast läst workspace795524/source30689542, 12 TRIGGERED/5 IGNORED,
en incidentsida och 17 locationsidor; fil/rad partiell, sex öppna positionsluckor.
GitHub checks läses på fryst leverans-SHA; queued suite/inga runs bevisar
ingen incidentfrihet. Läs bara säker metadata via befintlig read-only-brygga,
inga secrets/annotationsmeddelanden, inga automatiska ignore/resolve.
Triagestatus och nästa krav finns i G; historiska fixtureklassningar är inte
nya bevis för incidenter utan positioner.

### Läsutredda drift- och backuprester — fortfarande öppna

Frame-varningen i `web/public/local-film-player.mjs:17` använder samma text
för saknad playing/presented/ended. Historiska goodluckprov är inte belägg
för ursprungligt idlefel. Behåll rVFC-spärren; nästa diagnos kräver terminal-
flaggor, readyState/currentTime/duration/visibility och exakt media-ID/SHA.
Zoner är editorlagring (lokala utkast+molnkoordinater+privataBlobklipp), inte
spelstyrning. Befintlig CAS/dimension/hash/Range/partialuploadkontroll saknar
full isolerad zonroundtrip/restartacceptans. Tidigare 88medieURLprov inkluderar
inte reference-poster. Startsideskoden byter SSRhero till annan layout och
asynkront intro; möjlig flimmermekanism kräver bildserie/layoutshift/laddnings-
tider inklusive mobile/reduced-motion före riktad fix.

Backupagenten återläste de uttryckligt angivna metadatafilerna utan bred
backup-/personarkivsökning. Extern produktbackupkvitto matchar dokumenterad
SHA256, 206filer/10mappar/125745905bytes och verifierade hash-/arkiv-/inventory-
flaggor. Gamebackupmanifest finns; tidigare32Postgrestabellers återläsning är
dokumentation, ingen ny DBkontroll. Privat OpenClawenhetsfil finns men är inte
fullbackup. Director `/data/catalog` och Gateway `/data/openclaw` saknar angivet
externt fullsnapshot/återläsningskvitto. Exportåtkomst har inte prövats. Kräv
faktiskt frysta/stoppade skrivare, fullsnapshot, externmanifest/hash och
SQLite integrity/FK/WAL enligt `ENVIRONMENT-RESTORATION.md:74`; maintenanceMode
eller quiesced-markör ensam bevisar inte writerdrain. Inga drift-/DB-/provider-
åtgärder, restore eller nya servertester gjordes i dessa läsutredningar.


## Acceptans som består

Isolerad SQL/HTTPS-fixtur är rättad och verkligt provad i CI; gamla FAIL sparas.
Game-persistence/concurrency är separat och saknar sitt isolerade prov.
Full P6, mänsklig läppsynk/kortkontakt, fysisk mic/kamera/mobil/Safari,
zonroundtrip, startsidesflimmer och externa Director/Gatewaybackups återstår.
Upload-problemet med kortflipp_kling_1080p.mp4 är öppet under H; ingen ny
produktmedia har aktiverats här. Se systembeskrivningen för aktuell arkitektur.

## Lanes och faktisk medierensning

Mobile Phone Lane är sparat förval. Versionerade lane-definitioner har ID/namn/
renderer/dealer/mediesamling i `gameLanes`/`gameLane`. Saknat/äldre `original`
migreras vid läsning till Mobile; HTML binds till serverns val och gamla queryparametrar
kan inte återaktivera Kevin. `web/public/card-presentation` ersätter `kevin-cards`;
kortgrund, källproveniens och kalibrering består.

Admin create/remove är revisionsstyrda. Aktiv lane kräver ersättare eller `null`
för sista lane; då stoppas ny Blackjack-start tills lane läggs till. Nya porträttlanes
delar Astrids bank/policy. Ny renderer/mediebank behöver adapter/verifierad media;
fria URL:er nekas. Lane-borttagning raderar inte delade medier.
Separat lane-publicering, nya dealers/spel och granskad svarskatalog är inte därmed byggda.

| Utförd åtgärd | Exakt omfattning / slutbevis |
| --- | --- |
| Lokal source/staging-rensning | 2 410 binära filer, 2 133 120 568 byte; faktiska hashar/säkra paths kontrollerade |
| Motsvarande Blob-rensning | 2 313 objekt, 2 131 771 483 byte efter `8f265831` LIVE/READY; komplett paginerad efterlista |
| Lokal deduplicering | 64 byteidentiska kopior, 14 216 404 byte; kvar 2 450 fysiska filer/764 115 959 byte |
| Blob-deduplicering | 58 objekt, 12 787 392 byte efter produkt `ebbbeb76`/QA `ee060804` och exakt medieläsarekvivalens |
| Slutlista Blob | 1 800 objekt/769 901 848 byte; just målen saknas, alla andra gamla paths/storlekar oförändrade |
| Bevarade publika adresser | 88 GET200/fullhash/storlek PASS: 44 produktion + 44 QA; dessutom 62 huvudobjekt HEAD/full SHA PASS |

Alla 2 514 logiska poster/ID/hashar/URL/åtkomstgränser består. Layout v1:s
`canonicalPath` pekar direkt på registrerad huvudkopia med samma hash/storlek/ändelse.
Mobile-media, zonreferens, kortbild, runtime/kod/kalibrering, uploadfiler, GPU-resultat,
speechreferenser, journaler och övriga objekt består. Produktion/QA delar Blob;
deras Studio-dokument/historik/mediarecords/speechreferenser och produktzoner
lästes före radering. Ingen ny visuell approval och ingen omskriven Git-historik.

Privata underlag i `lab/data/lane-media-audit/`:
`blob-purge-receipt.json`, `blob-after-purge.json`, `kept-readback.json`,
`dedup-cloud-purge-receipt.json`, `dedup-blob-after.json`,
`dedup-http-verification.json`, plan och lokalkvitto.
35 dedup-prov, hela fysiska bankens hashar och fyra dealer-sync `--probe` PASS.
Lane/CRUD/kort/policy/startprov och TypeScript PASS; äldre fullhook 1 418 PASS/9 skip.
Kontrollens privata cachekopior är hashkontrollerat borttagna; receipts består.

## Produktionsimport, avveckling och återställning

P7 är utförd på b0bc efter fryst export, oberoende admission och faktisk ALL0-drain.
Underhåll `dep-db16rv0u01pc73d442p0` var LIVE/childless: inga barn/skrivare/providers.
RunPod var tillfälligt Max 0/Active 0/FlashBoot OFF och alla sex workerfält/båda jobbfält 0.
Efter import återställdes Max 1/Active 0/FlashBoot ON före provideraktivering.
Gemensam Neon-policy är aktiv; produktens tre tal-/streamflaggor ON, kamera ON.
QA är kvar OFF. Aktiveringen är inte en generell kostnads-/mänsklig acceptans.

Studio 001–004, tre dokument, talhistorik, 18 aktiva och sex retained-mediaposter
är importerade. Sex original (8 262 169 byte) återfanns i `365f283b` och
fullhashades privat; liknande filnamn/familj får aldrig automappas till nya bytes.
Production/version1 fullfilspolicy adopterades via ett additivt INSERT;
numeriska tak/historik/reservationer ändrades inte.
Paritet PASS: 32 skyddade konto-/speltabeller, elva kostnadstabeller och exakta
dokument/media. Alla 17 alias återlästes med historiska mål/domäninställningar/SSO bevarade.
Den avslutade importen körs inte om; nya läskvitton får inte skriva om originaltider.

P8:s slutkod `9ba2fd05`/CI `37222438373` tre success verifierade diskfri drift.
Produktdisk DELETE204/GET404/`service.disk` saknas; tolv äldre Blobalias borta,
gamla-lista0/ersättningar12 och noll gamla Neon-dokument-/historikreferenser.
Explicit restart200: faktisk ny process, 160 rätta källhashar, åtta avvecklade
runtimefiler, AI3/Neon ON/health200 och ingen `/var/data`/persistent produktmount.
TLS `verify-full` bevarades; 51 övriga produkt-envvärden kontrollerades oförändrade.
Parent-env var direkt oläsbar efter UID-byte (EACCES); barnprocess/källa och
stabila deploy-/envavläsningar ger bindningen, inte en påstådd direkt parentläsning.

Privat `C:/Users/jakem/CroupierBackups/production-disk-retirement-20261004`:
206 filer/10 mappar/125 745 905 källbyte; full inventering, oförändrad källmetadata,
arkivläsbarhet och remote/lokal/arkivhash PASS. Behåll backupen efter avveckling.
Befintliga privata P8-journal/kvitton: diskfri `6cf5030f…`, data/HTTP `4615366b…`,
postdelete `bf582b0b…`; fulla pinnar finns i snapshotens importförlopp.

| Verifierat privat kvitto | SHA256 |
| --- | --- |
| P7 admission | `77eccc3a1ca99bca328f2abec8e11d4d37ec62b3797a2a7b25aea1c616b751c1` |
| Cloudplan | `25fe34d42251b1f57de6ff0ae7505459c0448c6d0ba500646aa7281a9115c59d` |
| BEFORE | `0555b7988d5f686d4b918a966bd82d1865a9a83d22c805a076e6f46df648ccb2` |
| Importplan | `94a458599f0c77ca8aaf468feccf4cc7d5e1e050f2f31662be8740796cde7442` |
| Avslutad import | `0f6907e41944f8c142381ffc2e02f218aeda53ea345dfcc38067a5245879b58d` |
| Full diskbackup | `12e99320409fab6b0dc9f3e475d06b4d9aa950d3f87d31cae0b3bf22530596b9` |

Återställning är en samordnad återgång, aldrig en andra writer eller automatisk fallback.
Frys alla skrivare, bevara senaste Neon/ledger separat och verifiera rätt scope,
schema/checksummor, aktuell paritet, media och rollbackpunkt före operation.
Gamla SQLite-/diskbytes får inte aktiveras efter nya Neon-skrivningar utan datatillbakaföring.
Gamebackup: `C:/Users/jakem/CroupierBackups/neon-game-20261002-132437`
(24 källtabeller/102 rader; 32 Postgrestabeller med rad-/sekvensparitet).
Labbbackup: `C:/Users/jakem/CroupierBackups/lab-consolidation-20261002`;
lokal syskonstädning: `C:/Users/jakem/CroupierBackups/local-project-cleanup-20261004T210828Z`
(214 bevarade filer, två verifierade Gitbundlar, workercommits kvar).
Återställningsprocedurer: [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md).
QA-, Director-/Gatewaydiskar är aktiva/bevarade, inte P8-mål; extern Director/
Gatewaybackup är fortfarande separat kvarvarande ansvar.

## P6: delbevis, numeriska skydd och kvarvarande acceptans

### Verifierade delbevis — inte full P6

Historiskt native90/90 på `190399386d93a02882d9b18a5ce5af53bb91fe23`:
alla fyra dealers, två avkodade/hörbara/avslutade plays, samma sparade Neonrevision,
CAS/utkast/privata medier/native administration utan iframe. Projekt/pit återställda
med identiska hashar; browser/route-drain städade; inga mejl/betalda anrop.
Privat `lab/data/platform-private/native-cloud-browser-evidence/7bf33ee7-35a2-470c-a202-c00299af4443/receipt.json`,
SHA `dd67c29f73c24db234f4d079a5e5a241e43e39590eeefb95c2e40fa52faf4e20`.
Åtta layoutbildrutor godkänner inte läppsynk. Äldre FAIL-kvitton består.

På `e461ef073b63b2d1c937454bbfa31289774fcb8f`: 80/80 authkontroller över
68 HTTPS-anrop, 22/22 verkliga login-/städ-/källkontroller och 27 städgrupper PASS.
Admin når spel/Studio/BO, spelare nekas Studio, reader/staff-reset behåller game-only,
lösenord/epoch återkallar gamla sessioner, saldo/historik/paritet består.
Pending provider-cancellation är inte liveprovat av detta authprov.
Privat `p6-shared-auth-evidence/157ef3e2-d91a-4ab9-89b1-515460988c5e/` och
`p6-shared-auth-browser-evidence/1a6a69a9-a9b8-4a3c-94e7-79e67b9d182c/source-reattest.json`
under `lab/data/platform-private/`; egna fixtures borttagna.
Greeting-rehearsal på e461 har matching clip/återaktiverade tvåspelskontroller,
men saknar explicit ended-räknare/nya hashbevis/ny mänsklig approval:
`p6-browser-evidence-e461ef07/receipt.json`.

Faktisk isolerad SQL/HTTPS/restart: 41 grupper, fyra retained-guards och 46
oförändrade källhashar PASS. Täcker CAS/rollback/token/epoch/roller, signerad
actor/scope, walletnonce utan dubbelkreditering, journalimport och kostnads-/QA-rollback,
review exakt talpar/revision/roll, privat media, lokal mailpreview och kortsekretess.
Fixturer/processer städade, inga riktiga konton/molndatabaser/mejl/betalda jobb.

Fullfil `generated-bd1123e6caec51e8a232036547b0f8fc` fick Director/SDK-svar,
Cartesia-ljud och färdigt RunPod-paket. Två game-queue/audio-ended härledda plays;
per-play synliga frame-/ownerobservationer hann inte sparas och är okända.
Privat `verify-final-qa/fullfile-two-play-derived-attestation-8712e00b.json`.
cc77-run `75eaf797-9342-4e2c-8995-f3c759fade75`: 6 562 941 streambyte,
synlig bild, hörbart ljud, faktisk spelkö-END/completed SQL-request och browsercleanup.
Efter END avlästes provider HTTP200 CANCELLED, terminal/released/lease0/uncertain0/OFF.
Det är avslutad speluppspelning enligt Jakobs krav, inte ett naturligt provider-
COMPLETED-kvitto. Exakt tid för providertransition saknas; b0bc:s naturliga COMPLETED
är bara lokalt testat. Sammansatt snäv P7-admission återanvänder dessa delbevis och
oförändrade godkända e461-playbackbytes; full P6 och nya take-approvals förblir öppna.

QA:s äldre närvarogap består: `player_probe_sessions` 17→15 på a0 och 19→18
vid 42→37-övergången. Övriga 31 kontotabeller matchar; 24h TTL är möjlig orsak,
men tidigare radmetadata saknas. Original FALSE/compose=false skrivs inte om.
Senare aktuella 10/10-bevarandekvitton gör inte dessa äldre jämförelser full-PASS.

### Budget och framtida prov

Exakta Cartesia-/counting-priser är backlog enligt Jakob. Avgränsade funktionstester
kan använda dokumenterat okänd USD/null och mätt usage inom ursprunglig numerisk
budget/reservation/dispatchauktoritet. Detta är inget nollpris, verifierad faktura,
extra testfönster eller generell produktionskostnadsapproval.
Upprepa ingen prisinventering utan nytt konto-/tariffunderlag; extern Cartesia-
nyckelägare saknar tillgänglig egen kontoinloggning. Privat `p6-cost-evidence-20261004.json`.

Originalkampanj `f2c28b62-9ae7-4cd6-abcd-e2137f2206d6`, totaltak 10 USD inklusive
alla försök, budgetankare
`d1a8f8fedb96008369a9ec87091744718d03f2678a465a80d147101271f6c523`.
Historiskt reservation 5,251152/oreserverat 4,748848 USD; inget refund/reset.
Jakob höjde testtaket från två till sex genereringar totalt, inte per omstart.
Senaste closed39: usage 4 generationer/5 SDK/2 TTS/4 GPU, unresolved 0/refund 0/USD null,
head `8e7f3e2ee1a31e03291da5b59c40b7d695d4a40b156170e909853c5a1c9f03a6`.
Två av sex generationer var kvar; detta är inte ny färsk dispatchauktoritet.
Den gamla reservationspolicyn rymde inte ytterligare 1 USD inom oreserverat 4,748848.
Återläs faktisk journal före nytt prov; förbrukat/pending/uncertain är aldrig ”nytt”.

Fullfilsadmission kräver explicit belopp/policy före TTS/GPU; stream/fullfil delar
UTC-dygnssumma. Originalets 12 min/krav 8 min kvar, klientdeadline 300 s och separat
RunPod-TTL 180 s får inte förlängas tyst. Utgångna fönster återöppnas inte.
Successor är append-only med föregående journalhash; inga automatiska retries,
budgetrefunds eller nytt providerjobb vid reconnect. Gamla FAIL/manifest/tider bevaras.
SDK-import/prepare-only/router404/WS-binary/deterministisk baseline är inte acceptans.

Nytt liveprov kräver aktuell källa/Gitblobs, immutable basimage, färska worker/router/
entry-manifest, faktisk SDK 7.12.1/readback och separata Render/Web-child/SDK-envbindningar.
Exakt serverägd session/runda/sparad Neonpolicy, request/job/mediahashar och ägargates
måste avse samma körning. Tre cookieägda kontroller före connect/play/efter END;
en produktspelare/WS/video genom posegrind/talkö, presenterade frames/hörbart ljud
och två verkliga playback-ACK. `decoded-product-game-queue`, faktisk integration/
laddad källa och cleanup/cancel/terminal/drain krävs; inga ersättningswrappers.
Full P6 omfattar också text/bild/STT, fullfil/stream, SQL/HTTPS/restart, auth/revoke
och verklig invitation/reset där de återstår. `fullP6Passed` får inte sättas true tidigt.


## Funktionella regler som aldrig får komprimeras bort

Render äger kort/shoe/slump/wallet/rundor/resultat, sessionägarskap och cancellation.
Studio/Vercel sparar revisionsstyrd Neonpolicy, inte osparade utkast eller saldo.
En kandidat vid credentialresolver; collision/pending/fel lösenord ger generiskt
avslag utan fallback/klientroll. Admin får spel+Studio; superadmin är alias,
reader/staff är game-only. Playerlogin rensar gamla BO/Labcookies.
BO-audience/live roll/fingerprint/epoch och Origin/Host/JSON/CAS/audit består.
CRAIG-reset och native playerpasswordbyte behåller rätt identitet/saldo/historik;
Rendercancel kvitteras före OK. Självrollbyte/radering och sista-admin-race skyddas.
Engångstokens förbrukas atomiskt; hemliga partnerresultat är tillfälliga, inte listmetadata.

Alla fyra dealers delar spelaren. Tal är exakt text/audio/video/frame-index/
kalibrering/acceptans; ändrad audio-/videohash ogiltigförklarar visuell approval.
Ingen approximate-duration-match, gammal talvideo till ny text eller munoverlay.
Audit `pipeline/audit-dealer-sync.mjs --probe`, obligatoriska regressioner och
två rehearsalplays per dealer krävs för media/spelarändring, inte bara hashar.
Gamla BO-videopreviews är tysta historikklipp, inte lipsyncmaterial.
Observation följer faktisk spelflik utan andra playback; valt/laddat ≠ spelat.
Originalpolicy `legacyClipPolicy` och Astrid `mediaPolicy/idlePolicy` består;
gammal BO-tilldelning är read-only410 och import kräver explicit exakt match.
Privata chattar, secrets och signerade medielänkar hör inte hemma i publika logs/takes.
Neon/Blob-fel stänger med fel, aldrig diskfallback/fröprojekt/nollbudget.
Aktiva tools/test/fixtures/pipeline/web/media/kalibreringar/OpenClaw-state består.
Svarskatalog/automatiska spelararkiv är inte infört; kostnadsjournaler gallras inte.

GPU-shutdownrättningen börjar cleanup före gatewayväntan och signalerar båda barnen.
15 s naturligt provideravslut +15 s cancel +30 s journalmarginal, sedan högst 5 s HTTP
och 10 s lagring; barnets tvångsgräns 80 s/Render 90 s. Timeout lämnar återhämtningsbar
journal/reservation och felstatus, inte för tidigt släppt shared lease.
Isolerad Linuxkedja 4/4 och close 38/38 PASS, inklusive lease 0 före båda flushar/1 efter.
Zonbilden är registrerad privat PNG 1080×1920/1 628 428 byte,
SHA `eda87f9e877b00dbd2f02479db44ae5f41e2f182563825304906880ceee0088a`;
fel molnkälla ger 503 utan lokal fallback. Export 290×104 var pixelidentisk med befintlig zon.
OpenClawproxy tillåter endast avsedd toppnavigation till exakt /openclaw[/];
API/fetch/iframe/mutation/WS/Origin/Host/auth/pairing behåller separata kontroller.
Dessa prov ändrade ingen zonrevision, pairing, speldata eller betaldispatch.

## Historik (daterade lägesbilder)

Flyttade meningar som motsade nuläget 7 oktober 2026. De är inte raderade.
Kvitton, acceptans, P6, medieregler och privata sökvägar står kvar ovan.

### 7 oktober 2026 — Spelaryta-avsnittet, före resultatrutten i arbetskopian

Ersatt samma dag när historiksidan kopplades till `POST /api/history`. T4 är inte klar.

Historiken är ärligt tom: `readPlayerResults` saknar publik spelarrutt och `/api/v1/history` är partner-API. Ingen ändring i `web/`, spelmotor eller signerad direktstart. Kvar: resultatrutt för spelaren.

### 7 oktober 2026 — Namn-avsnittet, före Spelaryta och Partnerportal samma dag

Ersatt 7 oktober av Spelaryta- och Partnerportal-avsnitten.

Lobby, profil, historik, riktig operatörsinloggning och tenantdata är inte klara.

### 6 oktober 2026 — Tre nivåer: denna ändring

Ersatt 7 oktober av Namn-avsnittet (`/studio` är basePath, inte produktionsverktygets namn). Fliken heter fortfarande Administration.

Intern Studio på /studio är kvar som verkligt produktionsverktyg; fliken heter Administration.

Ersatt 7 oktober av Partnerportal-avsnittet (`partner_session` är en egen cookie; intern admin-cookie öppnar inte partnerdata).

Servern kontrollerar fortsatt intern admin på varje dokument/API-läsning.

Ersatt 7 oktober av Spelaryta-avsnittet (`/play` är Spellobby, med profil och historik).

/play är en enkel Blackjack-ingång.

Ersatt 7 oktober av Partnerportal- och Spelaryta-avsnitten.

Full partner-session/medlemskap/organisationslagring, publicerat operatörspaket,
kundavgränsad sparning samt spelarprofil/historik är fortfarande öppna T2–T4.
Den separata policyn web/partner-access-policy.mjs från cb2673c6 är fortsatt
bara policy; ingen runtime/DB använder den som verklig partnerinloggning.

### 6 oktober 2026 — Övertagande och stoppunkt

Ersatt 7 oktober av Partnerportal-avsnittet (medlemslagring och `partner_session` finns; lane-publicering och operatörsbunden lobby är kvar i T2–T4).

T2–T4 kvarstår för verkligt kundregister, kundpersonal, medlemskap, lane-publicering och operatörsbunden lobby.

Ersatt 7 oktober av en snävare mening i Övertagande: adminens val bland riktiga operatörer är kvar; operatörens inloggning står i Partnerportal.

Kundval är ännu inte aktiverat.
