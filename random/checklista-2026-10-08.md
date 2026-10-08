# Checklista, orkestrator 2, från 8 oktober 2026

Uppföljning av vad som är gjort och vad som är kvar mot Jakobs målbild. Uppdateras i
den här filen; beslut får rad i `random/beslutsmatris-2026-10-07.md`, lösa trådar i
`random/losa-tradar-2026-10-07.md`, status utåt i `docs/JOHN-HANDOFF.md`.
Startpunkt: `556bf495`, CI grön, trädet rent.

Status: `klart` | `pågår (vem)` | `väntar (på vad)` | `kvar` | `struket (varför)`

## Jakobs två förtydliganden 8 okt

**Lane.** Ett paket med vissa typer av dealers som sätts samman i ett pussel av klipp, där
man bestämmer vad OpenClaw får göra och vad som sker automatiskt. En grundprofil finns för
ett spelbolag att få. När bolaget har fått en lane kan de använda vissa delar, som chips
och färg på bordet. (Skärper 8 okt-definitionen i överlämningen: OpenClaw-rättigheter och
automatik är del av lanen; grundprofil = standardlane.)

**Tre lager.** Klipp- och videologiken i backend struktureras om så att bakgrund, avatar
(dealer) och bord är tre lager ovanpå varandra. Spelaren ska kunna välja bordsfärg, ny
bakgrund och ny dealer. Grundinställningar för idle-frekvens (gäspning) och varianter av
dealsekvenser hör till lanen. 01:50: dagens klipplogik är delvis rätt, Astrid fungerar
mycket bra; det enda tillägget är tre lager (bakgrundsbild/-video, dealer, bord), var och
en borttagbar. Astrids variant/idle/deal/talsynk blir en dealer-overlay i stället för hela
filmen. Jakobs gren `test-video-jakob` visar riktningen; inte redo för main.

## A. Repo-hygien (CI, karta, tester, docs, inbox)

| # | Punkt | Status | Källa | Spår |
|---|---|---|---|---|
| A1 | Pinnad Ubuntu, körare för alla tester, D1–D32, teaminbox, terminologiblad | klart | matris 34–35 | – |
| A2 | ffmpeg `.deb`-cache i CI (hängde två gånger 7 okt) | klart `683dd4fd` + `7d523bde` (cache v6). Verifierat i run 37707970447: båda jobben `Cache restored from key: ubuntu-24.04-ffmpeg-7:6.1.1-3ubuntu5`, ingen nedladdning. `dealer-regression` utan cache (matris 46) | brief M p4 | M |
| A3 | GPU-workflows till `ubuntu-24.04` före 19 okt | klart `f95ed1ef`. `services/astrid-gpu-worker/.github/workflows/checks.yml` har `ubuntu-latest` men körs inte av GitHub | brief M p3 | M |
| A4 | CI-steg orphan tests + undantagsfil | klart `9dbfe09e`: 259 filer, 0 föräldralösa, 3 undantag (matris 47); grönt i CI | brief M p5 | M |
| A5 | Systemkartan: trimma miljökontrakt, gul = "granska", `planned`-rutor (T11) | klart (S5): 10 miljöfakta ur kontrakten, 14 skyddande kvar; gul = svensk granskningstext; 8 planned-rutor | matris 42 | – |
| A10 | `test/fuzz-blackjack.mjs` mot `web/shoe-game.mjs` (J5) | klart natt 8 okt (S3): 3 000 rundor ~5 s i kroken, 100 000 gröna; undantaget borta. CI grön `a4288aa7` | beslut 53 | – |
| A11 | `dealer-regression`: `actions/upload-artifact@v4` och `pnpm/action-setup@v4` kör Node 20 (deprecerat, tvingas till 24) | kod inne (`@v7` / `@v6`); CI omkörs vid push | CI-annotation 8 okt | M |
| A6 | Chefens register i `.croupier-inbox/chef.json`, låstext "Inbox busy" | kvar, lågprio | matris 34 | M senare |
| A7 | CSS utanför listan (`studio-shell`, `main-nav` …) | klart (S4): död CSS borta i 4 filer; `main-nav`, `studio-brand`, `studio-footer` kvar (tester) | matris 34 | – |
| A8 | `test/backoffice-lab-browser.mjs` opt-in, ej körd | klart: fanns redan som undantag (266/0/2) | matris 34 | – |
| A9 | Testping #4 stängs | väntar (Jakob) | inbox #4 | – |

## B. Nivå 1 skal och design

| # | Punkt | Status | Källa | Spår |
|---|---|---|---|---|
| B1 | Johns skal, sidmall, en kodgeneration, sju sidor utbrutna, `studio.tsx` borta | klart | matris 16–33 | – |
| B2 | Uppspelning: rullande observationsfönster (L23) | klart `820709dd`; verifierat i prod 8 okt 10:56 (300-fönster, 0/150) | matris 39 | – |
| B13 | Uppspelning avskalad (Jakob 11:05: rörig, tre saker blandade) | kod inne (U1): status → kedja/tal en rad → Anslut & följ (enda lime, spelbild i details) → Logg → Diagnostik stängd; förklaringar till guiden; inget borttaget | Jakob 11:05 | D |
| B3 | Tre texter L20–L22 | klart `a91f92ee`; verifierat i prod 8 okt (`/control`, `/control/guide` med Lanes/Förhandsvisning) | lösa trådar | – |
| B4 | `/control/zones` på sidmallen, kortad text | klart `815b0b76`; verifierat mörkt i prod 8 okt (referensbild, moln v2); ljust kvar | matris 43 | M |
| B5 | Händelser + Händelser → klipp en sida | klart natt 8 okt (S1); verifierat i prod 8 okt: översikt utan `?event=`, `/control/tree?event=…&dealer=vera` → Händelser med query kvar | matris 37, beslut 52 | – |
| B6 | Klipplistans filterchips och triggerpiller | väntar (efter K steg 3b) | matris 11 | D |
| B7 | Johns fyra etiketter som djuplänkar till adminflikar | klart natt 8 okt (S1): `?tab=tables|operations|finance|accounts`; Administration kvar utan parameter | matris 12 | D |
| B8 | Inloggningskortet på sidmallens tokens | klart natt 8 okt (S1); verifiera ljust/mörkt i prod | matris 14 | D |
| B9 | Namnkrock Talgranskning (meny → Probe, adminflik = betald QA) | klart natt 8 okt (S1) | matris 17b, beslut 52 | D |
| B10 | Ljust läge på två inre sidor | granskat i prod 8 okt 11:30 (U3): trasigt på `/partner` (svart på svart), `/control/guide` (boundaries-blocket), Operatörschatt (textarea), delvis Händelser-inspektorn; förhandsvisningens iframe medvetet mörk. Fix pågår (U4) | matris 3 | D |
| B11 | `lab/docs/guide.json` använder gamla sidnamn | klart (S4): dagens menynamn + poster för Förhandsvisning och Lanes | matris 25 | – |
| B12 | Dold `<select>` bakom dealerchipsen (gammalt test) | klart: fanns inte längre; chips med `aria-pressed` | matris 10 | – |

## C. Klipplogik: ett system

| # | Punkt | Status | Källa | Spår |
|---|---|---|---|---|
| C1 | Fakta: vilket system (A events / B legacyClipPolicy) produktion följer per händelse | klart: **A** (`gameLane: mobile-phone` verifierat mot prod 01:30). B = originalmotorn för Vera/Amira/Mei; `clip-mapping.mjs` är katalog, spelar inte. Frekvens per klipp bor i A (`mediaPolicy.frequencyPercent`) | `random/k1-fakta-spelvagen-2026-10-08.md` | K |
| C2 | Fakta: lagren i spelklienten i dag (bakgrund/dealer/bord/kort), keyat vs fullbild per dealer | klart: prod-vägen spelar **en full-frame mp4** med bakgrund+dealer+bord inbakade; kort = separat SVG-lager; chips/HUD = DOM. Keyat material finns bara i `/v2`-grenen (Astrid `rgb-over-masks`, Amira `rgb-over-alpha`), som kräver `!localPresentationEnabled`. Vera/Mei: fullbild + ev. handmatte | K1 tabell 2 | K |
| C3 | Förslag: ett system, flytt av frekvens per klipp, vad användaren förlorar/ersättning | klart: `random/k2-forslag-2026-10-08.md` | brief K steg 2 | K |
| C4 | Jakobs go på C3 | klart 02:49 ("kör enligt rekommendationerna") | beslut 49–53 | – |
| C5a | Genomför 3a: rad 37, 17b, lane-typ, klippnamn, fuzz, `/control/preview` | klart natt 8 okt (S1–S4) | K2 | K |
| C5b | Genomför 3b: select för alla fyra dealers, `legacyClipPolicy` → standardvarianter | kod i `7445b5a5` (12:35): select för astrid/vera/amira/mei; `legacyClipPolicy` → varianter vid läsning (fältet kvar, disk orörd tills Spara); `local` för annan dealer bara om lanen är portrait för henne. Jakob 12:28: `think`→turn, `gest`→settle godkända; `headTilt`/`deal`/`dealWatch` urval av. Astrid bevisat orörd: baslinje 160 anrop HEAD = arbetsträd (C5c). **Rehearsal Vera/Amira/Mei kvar** (visuell acceptans; de spelar 2D-reserv tills Emils paket, T7) | K2 | K |
| C5c | Astrid-baslinje för select: 16 events × 5 lägen × 2 kontexter | klart: `tools/astrid-select-baseline.mjs` (`--write` kräver Jakobs ok), test i hooken | C5b | K |
| C6 | Bakgrund och probe in i samma modell | kvar | brief K steg 4 | K |
| C7 | Varianter/villkor för Vera, Amira, Mei i spelet (L19) | kvar | lösa trådar | K |
| C8 | Zoner styr spelets bakgrund (L16) | kvar; blir del av D-lagret nedan | lösa trådar | K/T |
| C9 | Probe verifierad i produktion (L4) | kvar: admin på `/control/probe`, läge Textprov, knapp Prova text, modell (seed `gpt-5.6-terra`). Studio behöver `OPENCLAW_BASE_URL` eller `OPENCLAW_HOSTPORT` plus `OPENCLAWAPI_KEY`. Textprovet ger varken ljud eller video. Inte kört i prod | lösa trådar | K |
| C10 | Beskrivande klippnamn: manifestet har bara `id` (uuid), `familyId`, `role`, `relativePath`; UI visar id/siffror. Lägg till visningsnamn (`label`) härlett från familj + roll, redigerbart i Klippbibliotek. Inga filbyten: ny hash ogiltigförklarar godkänd synk | klart natt 8 okt (S2): `lab/lib/clip-label.mjs`, visas i Klippbibliotek, Dealers & klipp, Händelser; `clipLabels` i projektet utan redigeringsyta ännu | `lab-video-manifest.json` | K |
| C11 | Redigeringsyta för `clipLabels` (byta namn på ett klipp i Klippbibliotek) | kod inne; sidans Spara; tomt fält tar bort nyckeln | C10 | M |

## T. Tre lager (nytt 8 okt: bakgrund, avatar, bord)

| # | Punkt | Status | Källa | Spår |
|---|---|---|---|---|
| T1 | Inventering: finns lagren redan i klienten (`actor-compositor`, `table-scene` palett, zoner)? | klart: ja som kod (`actor-compositor`, `table-scene` palett per dealer, `rooms[].felt` i `/api/bo/config`), **nej i produktionsvägen** (full-frame mp4). Zon-JSON har ingen läsare i `web/`. Tre lager kräver antingen `/v2`-keyningen för alla dealers eller nytt material (F3) | K1 tabell 2–3 | K |
| T2 | Datamodell: lane = dealer(s) + idle + dealsekvenser + bakgrund + probe + OpenClaw-rättigheter | klart natt 8 okt (S2): `project.lanes[]` med `layers`, `openclaw`, `operatorAdjustable`; ingen läsare ännu; `project-store` normaliserar inte vid läsning (matris 54) | beslut 49 | K steg 5 |
| T3 | Bordsfärg som inställning: paket (bolag) → tillåtna val → spelarens val | kod inne (N3.4): DOM/SVG (filt-märke, plånbok, marker). Filmen och 3D-filten oförändrade. Inte på kontot | F2, F4 | Lane |
| T4 | Bakgrund som eget lager valbart för spelaren | kod inne som val, avstängt med texten Kommer med nya dealerpaket när `mode` är `baked`. Ingen ritare | T1 | Lane |
| T5 | Dealerbyte för spelaren inom lanens dealers | kod inne (N3.4): knappar bara för `gameChoices.dealers`, samma adressväg som `?dealer=`. Gamla dealer-raden listar fortfarande alla fyra | F1 | Lane |
| T6 | Idle-frekvens ("gäspning") och dealsekvens-varianter som lane-grundinställning | väntar (T1) | nytt | K |
| T7 | Nytt mediearbete (keya Vera/Mei) om fullbild | väntar (T1, F3) | nytt | eget mediespår |
| T8 | Granska Jakobs gren `test-video-jakob` (tre lager, ofullständig): bara läsning, ingen checkout, ingen merge. Media där ska **inte** in i blob eller databas | klart natt 8 okt: grenen = fristående Laneverkstad (Python `program/`, stannar på grenen) + `preview/` (Paow, Dragge, 720p, 12 MB) + webbspelare `program/web/` (WebGL-kompositor, greenscreen, lager, `bridge.js` mot `presentation[]`). Grenen rör bara `apps/croupier-frontend` utanför mappen (`/test`, inte portad) | Jakob 8 okt | K |
| T9 | Lagerflöde: dealer-overlay + bord + bakgrund som lager i spelet | promptfil `random/prompt-T9-lagerspelare-bakom-flagga.md` (Opus/Codex): lane `layer-preview` med renderer `layered`, Paow/Dragge-paketet bakom flagga, `bridge.js` matas med serverns `presentation[]`, dagens Astrid-väg byte-identisk. Astrid-overlay (variant/idle/tal) kräver keyat Astrid-material (T7) | Jakob 8 okt 15:09 | K steg 3 |
| T10 | Grenens utökade test-klippyta som egen sida `/control/preview` | sidan live, men iframen var vit i prod 8 okt 10:53: `/studio/preview/index.html` 404 eftersom `previewBuildDirectory` räknades från bundlat `import.meta.url`. Rättat till cwd-regeln (samma som zone-reference); verifiera igen efter deploy | Jakob 02:39 | K |
| T11 | Systemschema `random/systemschema-2026-10-08.md`; kartan får `planned`-rutor i pass A5 | klart (S5): N2.2, N2.4, L4, L3, N3.2, N3.4, L8, C5b | Jakob 02:39 | A5 |

## L. Lane som produkt

| # | Punkt | Status | Källa | Spår |
|---|---|---|---|---|
| L1 | Lagring `operator_packages` med lanes/spel/bord/branding | klart | 005 | – |
| L2 | Skapa lane av delarna 1–4 i nivå 1 (L1) | live i prod 8 okt 10:53 (S1): redigerare, Spara projekt enda lime, id låst efter skapande. Layout-nits rättade (U2): tre kort, `·`-avgränsad förslagsrad. Prod-Neon har 0 bolag → operatörsval tomt tills `Skapa SG test game provider` klickas (Jakobs klick) | lösa trådar | Lane |
| L3 | Exportera/publicera lane till bolag (L2); `publishPackage` har ingen anropare | kod inne (`/control/lanes` + POST); meny + karta live. Renders `/blackjack?operator=` läser paketet (återstart 12:45, inte beteendeverifierat). Vercel `/play/blackjack?operator=` proxar det dokumentet (L8b, inte klickat i prod) | lösa trådar | Lane |
| L4 | Bolagets justeringsyta: bordsfärg, branding, chips (L3) | kod inne (S3): partner-API `branding` GET/POST (CAS, `presentations.configure`, pool) + panel i Kevins vy Färger, marker och kort för riktig session; prod ger 403 tills roller seedas (N2.2); chips kvar | lösa trådar | Lane |
| L5 | Demo-operatör "SG test game provider" i fixturen | kod inne (`sg-test` i partner-fixturen + knapp Skapa mot Neon); nord/syd kvar | matris 44 | Lane |
| L6 | Rullgardin anslutna bolag på Översikt, spelare per bolag | live i prod 8 okt 10:52 (S2): fixturens tre bolag + länk till `/partner/{slug}`; spelare per bolag väntar N2.4; riktig lista väntar N2.2 | matris 44 | Lane |
| L7 | Adminens val av riktigt bolag (L15) | kvar | lösa trådar | Lane |
| L8 | Spelmotorn läser `operator_packages` | kod inne `19f8073a` på Render (återstart 12:45, inte beteendeverifierat; 30 s cache, okänd slug 404). L8b: Vercel `/play/blackjack?operator=` hämtar samma dokument. Ogiltig slug och `claims.partner` når inte paketet. Inte klickat i prod. Neon-rättighet inte bevisad | L2 | Lane |

## N2. Nivå 2 (operatör)

| # | Punkt | Status | Källa | Spår |
|---|---|---|---|---|
| N2.1 | Inloggning, scopad snapshot, medlemskap läsbart, spärr sista admin i lagret | klart | matris 36 | – |
| N2.2 | Skrivande rutter: skapa bolag, roll, medlemskap (L11), pool med `connect()` (L24) | kod på `main` `5912800e` (PR #5, fast-forward): admin-POST `operator-create/role/membership`, kortet Bolag på `/control/lanes`, standardroller partner-admin/editor/viewer, sista-admin-spärr, CAS. Kevin godkänner rollnamn/behörigheter i efterhand (#3). **Efter deploy:** klicka "Skapa saknade standardroller" för sg-test och lägg till en partner-admin | lösa trådar | N2 |
| N2.3 | Team-vyns serverkoppling: inbjudan, rollbyte, suspend (L5) | kod på `main` `5912800e`: partner-action `team` GET/POST, Kevins `team.jsx` anropar API:t i riktig session (+25/−11, additivt). Inbjudan = koppla befintligt partnerkonto; e-post (N2.6) kvar | lösa trådar | N2 |
| N2.4 | Spelare, transaktioner, rapporter från spelmotorn (L10) | kvar | lösa trådar | N2 |
| N2.5 | Journal för operatörsskrivningar (L12) | kvar | lösa trådar | N2 |
| N2.6 | Inbjudan/återställning för rollen `partner` (L14) | kvar | lösa trådar | N2 |
| N2.7 | Speech-QA 501 (L6) | struket tills vidare (avstängd betald funktion) | lösa trådar | – |

## N3. Nivå 3 (spelare)

| # | Punkt | Status | Källa | Spår |
|---|---|---|---|---|
| N3.1 | Lobby, profil, historik | klart | – | – |
| N3.2 | Operatörskontext i lobbyn (L13) | kod inne `19f8073a`, Vercel-CI grön `0019df59`/`7445b5a5`: `Spelar hos` från `?operator=`/localStorage via `GET /api/operators/<slug>`. API:t ligger på Render (återstart 12:45, inte klickverifierat) | lösa trådar | Lane |
| N3.3 | Redigerbar profil | kod inne `19f8073a`: `PATCH /api/profile` (namn 2–40, språk sv/en; saldo serverägt). Utan kolumner svarar skrivningen 503. **`006-player-profile.sql` är inte körd mot spel-Neon** | L13 | N3 |
| N3.4 | Spelarens val: bordsfärg, bakgrund, dealer (T3–T5) | kod inne: `gameChoices` i datasetet, panelen Ditt bord, `localStorage` `croupier.choices.<slug>`. Bakgrund baked avstängd. Inte på kontot. Inte klickat i webbläsaren | nytt | Lane |
| N3.5 | Render-deploy av `/api/history` och `/bo`-redirects (L7) | väntar (Jakob: manuell deploy) | lösa trådar | – |

## Hos människor

| Vem | Vad | Status |
|---|---|---|
| Jakob | Bekräfta matrisrader 37–44 | väntar |
| Jakob | Radera Vercel `scoutgaming-legacy-frontend` (rad 40) | väntar |
| Jakob | Render manuell deploy `croupier-v2` | återstartat 12:45; inte beteendeverifierat |
| Jakob | Rotera Neon-rollen `croupier_game` | väntar |
| Jakob | Svar F1–F5 nedan | besvarade 02:49 via "kör enligt rekommendationerna" |
| Jakob | Logga in på `www.scoutgaming.tech/control` i Cursor-webbläsaren så orkestratorn kan verifiera B2–B5, B8, T10, L2, L6 live | klart 10:52; B8 (inloggningskort) och B4 ljust kvar att se |
| Jakob | Klicka `Skapa SG test game provider` på `/control/lanes` i prod (första skrivningen till `croupier_studio.operators`) | väntar |
| Jakob | Eget inlogg till orkestratorn (sa 10:52 "du ska ha inlogg själv") – skapa ett admin-konto `orkestrator` under Konton & roller när det passar; inga hemligheter i chatt eller Git | väntar |
| Jakob | Ta bort `LLM_LOGIN_UN`/`LLM_LOGIN_PW` ur Vercel (ingen kod läser dem; panelgranskning antecknad i `docs/ENVIRONMENT-VARIABLES.md`) | väntar |
| Jakob | Beslut 10:32: ja, `/control/lanes` ersätter Kevins gamla alias (→ Administration) | klart |
| Jakob | Kör promptfilerna L8, C5b, N3 i egna agenter | klart 12:05; alla tre levererade och mergade |
| Jakob | Kör `ops/neon-game/006-player-profile.sql` mot spel-Neon (`croupier_game`) | väntar |
| Jakob | Render `croupier-v2` → Manual Deploy → Deploy latest commit (L8 + N3 + C5b) | deploy 12:45 verifierad av orkestratorn (`/api/profile` 401, `/api/operators/sg-test` läser Neon). **Ny deploy behövs** för `ac936377` (N3.4 `gameChoices`) och `5912800e`; Vercel tar sig själv. `006` inte körd |
| Jakob | Efter Render-deploy: `/control/lanes` → Bolag → "Skapa saknade standardroller" för sg-test → lägg till dig som partner-admin | väntar |
| Jakob | Starta `random/prompt-T9-lagerspelare-bakom-flagga.md` (Opus/Codex) i egen chatt | väntar |
| Jakob | Rehearsal lokalt: `/blackjack?dealer=<namn>&rehearsal=1`, Play twice, fyra dealers | väntar |
| Jakob | `LAB_PARTNER_*` vs `BETTALOTTO_PARTNER_*`: vilket namn gäller? | väntar |
| John | Rader 11, 12, 14, 17b; terminologibladet | väntar, tvådagarsregel → 9 okt |
| Kevin | Rad 7, T1–T3; acceptera GitHub-inbjudan | väntar |
| Emil | Acceptera GitHub-inbjudan | väntar |

## Beslut av orkestrator 2 (till kännedom, en rad i matrisen när de verkställs)

| # | Beslut | Varför |
|---|---|---|
| O1 | Brief M delas i M1 (CI: p3–p5) och M2 (UI: p1, p2, p6) som parallella underagenter | Disjunkta filer, halverar väggtid |
| O2 | K steg 1 körs som ren faktainventering (K1) utökad med lagerinventering (T1); steg 2 (förslaget) skriver orkestratorn själv efter Jakobs svar | Jakobs tre-lager-riktning kan ändra förslaget; fakta är oberoende |
| O3 | Spår D skrivs 9 okt om John inte svarat i #2 | Tvådagarsregeln |
| O4 | Checklistan (den här filen) är enda uppföljningslistan; matris/lösa trådar/handoff är källor | Jakob bad om en lista |
| O5 | Terminologibladets Lane-rad uppdateras med Jakobs 8 okt-ord först när F1 är besvarad | "Vissa typer av dealers" kan betyda flera dealers per lane; dagens rad säger en |
| O6 | Stora uppdrag (C5, L2–L4, N2.2) levereras som promptfil i `random/` som Jakob kör i annan agent; orkestratorn granskar | Jakobs instruktion 8 okt |

## Fem beslut för Jakob (02:40), i prioritetsordning

| # | Beslut | Rekommendation | Låser upp |
|---|---|---|---|
| J1 | Lane-modellen (F1 + F5): flera dealers per lane; grundprofil = standardpaket som kopieras | Ja till båda | K steg 2 och 5, lane-typen i koden |
| J2 | Tre lager (F3): konfiguration och datamodell nu mot dagens klipp; lager-spelaren kommer från `test-video-jakob` när den är klar; ingen ny media i K | Alt 3 | K steg 3 kan börja utan att vänta på grenen |
| J3 | Spelarens val (F2 + F4): inom paketets tillåtna; sparas i webbläsaren först, konto när export finns | Ja | Nivå 3-ytan, T3–T5 |
| J4 | Rad 37 + 17b: Händelser och Händelser → klipp blir en sida i K; menyraden Talgranskning döps till Probe | A respektive omdöpning; John ändrar efteråt | K steg 3, spår D |
| J5 | Rad 47: `test/fuzz-blackjack.mjs` skrivs om mot serverns `web/shoe-game.mjs` (samma invarianter: totals, S17, 3:2, dubbling, försäkring, sidovad) eller tas bort | Skriv om, ~1 agenttimme; ett fuzz mot motorn som äger korten är värt att ha | Undantaget försvinner |

Åtgärder som inte är beslut: radera Vercel `scoutgaming-legacy-frontend` (rad 40), Render manuell deploy, rotera Neon-rollen, stäng #4.

## Frågor till Jakob (F)

| # | Fråga | Mitt standardval om du säger "kör" |
|---|---|---|
| F1 | Innehåller en lane flera dealers (spelaren väljer bland dem) eller en dealer per lane och bolaget får flera lanes? | Flera dealers per lane; lanen anger vilka. Paketet kan ha flera lanes |
| F2 | Spelaren väljer bordsfärg/bakgrund/dealer fritt, eller bara inom vad bolagets paket tillåter? | Inom paketet: lanen/paketet anger tillåtna val och standard; spelaren väljer bland dem |
| F3 | Tre lager: bara konfiguration och uppspelning med befintligt keyat material, eller också nytt mediearbete (keya dealers som är fullbild)? | Steg 1: bara konfiguration/uppspelning; media rörs inte. Mediearbete blir eget spår efter K1:s inventering |
| F4 | Var sparas spelarens val: på spelarkontot i databasen eller bara i webbläsaren först? | Webbläsaren i första steget, konto när lane-export finns |
| F5 | "Grundprofil för ett spelbolag": en standardlane per dealer som alla bolag får, eller ett standardpaket (demo-operatören "SG test game provider") som kopieras? | Standardpaket som kopieras till nytt bolag |

## Rekommendationer för Johns öppna rader

| Rad | Rekommendation | Motiv |
|---|---|---|
| 4 | A (40 px), oförändrat | Hans regel 10 väger tyngre än en bild |
| 6 | A nu, B när livedata finns | Oförändrat |
| 11 | A, men först efter K steg 3 | Klipplistan byggs om i K; chips på gammal lista är dubbelarbete |
| 12 | B: fyra etiketter som djuplänkar till adminflikarna | Flikarna finns; billigt; Johns struktur |
| 14 | A, lågprio, i spår D | Liten, synlig |
| 17b | Menyraden "Talgranskning" → "Probe" (`/control/probe`); adminfliken behåller "Talgranskning" | Terminologibladet kallar del 4 Probe; krocken försvinner utan ny text |
| 13, 15, 17, 18, 19 | Verkställda (matris 21–23) | John ändrar efteråt om han vill |
