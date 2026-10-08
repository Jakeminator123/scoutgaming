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
| A5 | Systemkartan: trimma miljökontrakt, gul = "granska" | kvar | matris 42 | eget litet pass |
| A6 | Chefens register i `.croupier-inbox/chef.json`, låstext "Inbox busy" | kvar, lågprio | matris 34 | M senare |
| A7 | CSS utanför listan (`studio-shell`, `main-nav` …) | kvar, lågprio | matris 34 | M senare |
| A8 | `test/backoffice-lab-browser.mjs` opt-in, ej körd | kvar; blir undantag i A4 | matris 34 | M |
| A9 | Testping #4 stängs | väntar (Jakob) | inbox #4 | – |

## B. Nivå 1 skal och design

| # | Punkt | Status | Källa | Spår |
|---|---|---|---|---|
| B1 | Johns skal, sidmall, en kodgeneration, sju sidor utbrutna, `studio.tsx` borta | klart | matris 16–33 | – |
| B2 | Uppspelning: rullande observationsfönster (L23) | klart `820709dd`; `rolling`-prop, knappar kvar (matris 45); verifiera i prod | matris 39 | M |
| B3 | Tre texter L20–L22 | klart `a91f92ee`; verifiera `/control` och `/control/guide` i prod | lösa trådar | M |
| B4 | `/control/zones` på sidmallen, kortad text | klart `815b0b76`; verifiera ljust/mörkt i prod | matris 43 | M |
| B5 | Händelser + Händelser → klipp en sida | väntar (K steg 2–3) | matris 37 | K |
| B6 | Klipplistans filterchips och triggerpiller | väntar (efter K steg 3) | matris 11 | D |
| B7 | Johns fyra etiketter som djuplänkar till adminflikar | väntar (John/9 okt) | matris 12 | D |
| B8 | Inloggningskortet på sidmallens tokens | väntar (John/9 okt) | matris 14 | D |
| B9 | Namnkrock Talgranskning (meny → Probe, adminflik = betald QA) | väntar (John/9 okt); rek. nedan | matris 17b | D |
| B10 | Ljust läge på två inre sidor | kvar; verifiera i produktion vilka | matris 3 | D |
| B11 | `lab/docs/guide.json` använder gamla sidnamn | kvar | matris 25 | M senare |
| B12 | Dold `<select>` bakom dealerchipsen (gammalt test) | kvar | matris 10 | M senare |

## C. Klipplogik: ett system

| # | Punkt | Status | Källa | Spår |
|---|---|---|---|---|
| C1 | Fakta: vilket system (A events / B legacyClipPolicy) produktion följer per händelse | klart: **A** (`gameLane: mobile-phone` verifierat mot prod 01:30). B = originalmotorn för Vera/Amira/Mei; `clip-mapping.mjs` är katalog, spelar inte. Frekvens per klipp bor i A (`mediaPolicy.frequencyPercent`) | `random/k1-fakta-spelvagen-2026-10-08.md` | K |
| C2 | Fakta: lagren i spelklienten i dag (bakgrund/dealer/bord/kort), keyat vs fullbild per dealer | klart: prod-vägen spelar **en full-frame mp4** med bakgrund+dealer+bord inbakade; kort = separat SVG-lager; chips/HUD = DOM. Keyat material finns bara i `/v2`-grenen (Astrid `rgb-over-masks`, Amira `rgb-over-alpha`), som kräver `!localPresentationEnabled`. Vera/Mei: fullbild + ev. handmatte | K1 tabell 2 | K |
| C3 | Förslag: ett system, flytt av frekvens per klipp, vad användaren förlorar/ersättning | väntar (C1–C2 + Jakobs svar F1–F5) | brief K steg 2 | K |
| C4 | Jakobs go på C3 | väntar (Jakob) | – | – |
| C5 | Genomför, en commit per flytt, migrering med version och test | kvar; prompt skrivs av orkestratorn, körs av annan agent, granskas här | brief K steg 3 | K |
| C6 | Bakgrund och probe in i samma modell | kvar | brief K steg 4 | K |
| C7 | Varianter/villkor för Vera, Amira, Mei i spelet (L19) | kvar | lösa trådar | K |
| C8 | Zoner styr spelets bakgrund (L16) | kvar; blir del av D-lagret nedan | lösa trådar | K/T |
| C9 | Probe verifierad i produktion (L4) | kvar | lösa trådar | K |
| C10 | Beskrivande klippnamn: manifestet har bara `id` (uuid), `familyId`, `role`, `relativePath`; UI visar id/siffror. Lägg till visningsnamn (`label`) härlett från familj + roll, redigerbart i Klippbibliotek. Inga filbyten: ny hash ogiltigförklarar godkänd synk | kvar; Jakob 8 okt 01:50 | `lab-video-manifest.json` | K steg 3 eller M |

## T. Tre lager (nytt 8 okt: bakgrund, avatar, bord)

| # | Punkt | Status | Källa | Spår |
|---|---|---|---|---|
| T1 | Inventering: finns lagren redan i klienten (`actor-compositor`, `table-scene` palett, zoner)? | klart: ja som kod (`actor-compositor`, `table-scene` palett per dealer, `rooms[].felt` i `/api/bo/config`), **nej i produktionsvägen** (full-frame mp4). Zon-JSON har ingen läsare i `web/`. Tre lager kräver antingen `/v2`-keyningen för alla dealers eller nytt material (F3) | K1 tabell 2–3 | K |
| T2 | Datamodell: lane = dealer(s) + idle + dealsekvenser + bakgrund + probe + OpenClaw-rättigheter | väntar (F1–F3) | nytt | K steg 5 |
| T3 | Bordsfärg som inställning: paket (bolag) → tillåtna val → spelarens val | väntar (F2, F4) | nytt | Lane |
| T4 | Bakgrund som eget lager valbart för spelaren | väntar (T1) | nytt | Lane |
| T5 | Dealerbyte för spelaren inom lanens dealers | väntar (F1) | nytt | Lane |
| T6 | Idle-frekvens ("gäspning") och dealsekvens-varianter som lane-grundinställning | väntar (T1) | nytt | K |
| T7 | Nytt mediearbete (keya Vera/Mei) om fullbild | väntar (T1, F3) | nytt | eget mediespår |
| T8 | Granska Jakobs gren `test-video-jakob` (tre lager, ofullständig): bara läsning via `git show origin/test-video-jakob:<fil>`, ingen checkout, ingen merge. Media där ska **inte** in i blob eller databas; stannar som filer i grenen | väntar (grenen fanns inte på origin 01:50) | Jakob 8 okt | K |
| T9 | Lagerflöde för Astrid: variant/idle/deal/talsynk spelar en dealer-overlay, inte hela filmen; bordsfärg ändrar bara bordslagret; varje lager kan tas bort | väntar (T8) | Jakob 8 okt | K steg 3 |

## L. Lane som produkt

| # | Punkt | Status | Källa | Spår |
|---|---|---|---|---|
| L1 | Lagring `operator_packages` med lanes/spel/bord/branding | klart | 005 | – |
| L2 | Skapa lane av delarna 1–4 i nivå 1 (L1) | kvar; efter C5 | lösa trådar | Lane |
| L3 | Exportera/publicera lane till bolag (L2); `publishPackage` har ingen anropare | kvar | lösa trådar | Lane |
| L4 | Bolagets justeringsyta: bordsfärg, branding, chips (L3) | kvar | lösa trådar | Lane |
| L5 | Demo-operatör "SG test game provider" i fixturen | kvar; första steg i Lane | matris 44 | Lane |
| L6 | Rullgardin anslutna bolag på Översikt, spelare per bolag | kvar | matris 44 | Lane |
| L7 | Adminens val av riktigt bolag (L15) | kvar | lösa trådar | Lane |
| L8 | Spelmotorn läser `operator_packages` | kvar | L2 | Lane |

## N2. Nivå 2 (operatör)

| # | Punkt | Status | Källa | Spår |
|---|---|---|---|---|
| N2.1 | Inloggning, scopad snapshot, medlemskap läsbart, spärr sista admin i lagret | klart | matris 36 | – |
| N2.2 | Skrivande rutter: skapa bolag, roll, medlemskap (L11), pool med `connect()` (L24) | väntar (Kevins svar #3) | lösa trådar | N2 |
| N2.3 | Team-vyns serverkoppling: inbjudan, rollbyte, suspend (L5) | väntar (Kevin, Jakobs godkännande) | lösa trådar | N2 |
| N2.4 | Spelare, transaktioner, rapporter från spelmotorn (L10) | kvar | lösa trådar | N2 |
| N2.5 | Journal för operatörsskrivningar (L12) | kvar | lösa trådar | N2 |
| N2.6 | Inbjudan/återställning för rollen `partner` (L14) | kvar | lösa trådar | N2 |
| N2.7 | Speech-QA 501 (L6) | struket tills vidare (avstängd betald funktion) | lösa trådar | – |

## N3. Nivå 3 (spelare)

| # | Punkt | Status | Källa | Spår |
|---|---|---|---|---|
| N3.1 | Lobby, profil, historik | klart | – | – |
| N3.2 | Operatörskontext i lobbyn (L13) | kvar; efter L3 | lösa trådar | Lane |
| N3.3 | Redigerbar profil | kvar | L13 | N3 |
| N3.4 | Spelarens val: bordsfärg, bakgrund, dealer (T3–T5) | kvar | nytt | Lane |
| N3.5 | Render-deploy av `/api/history` och `/bo`-redirects (L7) | väntar (Jakob: manuell deploy) | lösa trådar | – |

## Hos människor

| Vem | Vad | Status |
|---|---|---|
| Jakob | Bekräfta matrisrader 37–44 | väntar |
| Jakob | Radera Vercel `scoutgaming-legacy-frontend` (rad 40) | väntar |
| Jakob | Render manuell deploy `croupier-v2` | väntar |
| Jakob | Rotera Neon-rollen `croupier_game` | väntar |
| Jakob | Svar F1–F5 nedan | väntar |
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
