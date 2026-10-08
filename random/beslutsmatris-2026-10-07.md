# Beslutsmatris, 7 oktober 2026

Arbetsanteckning för Jakob. Återvänd hit inför samtal med John och Kevin.
Inga hemligheter här. Status uppdateras i `docs/JOHN-HANDOFF.md`, inte i den här filen.

## Jakobs policy (7 okt)

| Område | Regel |
|---|---|
| Repots logik | Facit. Varken Kevin eller John ändrar hur logiken i repot fungerar. |
| Design | Får ändras efter John. |
| Kevins nivå 2 | Var inte koherent med repot vid import. Kevins kod ändrar inte repot; repot får tweaka Kevins kod. Kevins kopplingar anpassas till repot. |
| Öppna punkter | Kör på orkestratorns rekommendation. Jakob har sista ordet på nytt tveksamt. |
| Leverans | Agenter via Jakob pushar direkt till main. Kevin, Emil, John via PR från sina grenar. |

## Rader 1–11, med beslut

| # | Tveksamt | Alternativ | Beslut | Status |
|---|---|---|---|---|
| 1 | Fyra menyval i Drift/Åtkomst gick till samma administrationssida utan flikbyte | A: behåll fyra. B: ett val "Administration" tills sidan har flikar. C: sektionsankare | **B nu, C i steg 3** | Gjort 7 okt |
| 2 | Bakgrundszoner och Händelser låg i sidfoten, utanför Johns fem grupper | A: kvar i foten. B: in under Studio. C: ta bort | **B** | Gjort 7 okt |
| 3 | Ljust läge: skalet ljust, inre sidor mörka | Vänta tills ingen inre sida är mörk | **Vänta** | Sidmallen rapporterar klart; verifieras i produktion |
| 4 | Nivåväxlare och chips 40 px, Johns bild 36 px | A: 40 enligt hans regel 10. B: 36 enligt bilden | **A** | Ingen ändring |
| 5 | Inloggningssidor visade sidomenyn | A: behåll. B: ren inloggningssida | **B** | Gjort 7 okt |
| 6 | Översiktens lime-knapp är "Lanes, bord & konton" | A: behåll. B: "Ladda om från servern" när livedata finns | **A nu, B senare** | Ingen ändring |
| 7 | "Skydd för sista administratören" står som kvar i T2, ingen kod finns | A: bygg i nästa partnerpass. B: stryk | **A** | Gjort i operatörslagret 7 okt natt (`186c6bc4`); ingen rutt eller vy skriver ännu (T2, Kevin) |
| 8 | Nivå 1 står som "påbörjad" fast sidorna fungerar | A: behåll. B: "klart" | **A** | Ingen ändring |
| 9 | Agentmodeller: "Spara alla" sparar en agent per klick | A: behåll. B: riktig batch | **A nu** | Ingen ändring |
| 10 | Dealerns gamla `<select>` ligger dold bakom chipsen för ett gammalt test | A: behåll dold. B: skriv om testet, ta bort | **B i nästa pass** | Öppet |
| 11 | Klipplistans filterchips och triggerpiller från Johns bild saknas | A: eget pass. B: hoppa över | **A, steg 3** | Öppet |

Rader 12–14 kom från produktionskontrollen av `661de97b`, inloggad som LLM.

| # | Tveksamt | Alternativ | Rekommendation | Vem |
|---|---|---|---|---|
| 12 | Administration har redan sex flikar (Drift & spelintegritet, Spel/lanes/bord, Konton, Partner, Betalningar & journal, Talgranskning). Rad 1 C blir därför billig: djuplänk per flik | A: en meny­rad "Administration" (nu). B: återinför Johns fyra etiketter som djuplänkar till rätt flik | **B i nästa designpass** | John |
| 13 | "Sparad"-pillret visas två gånger på Dealers & klipp: i topplisten (skalets statusfält) och i sidhuvudet | A: bara topplisten. B: bara sidhuvudet. C: båda | **A** | John |
| 14 | Inloggningskortet ligger kvar i gammal stil: toppjusterat, grå knapp, ingen lime | A: eget litet pass med sidmallens tokens. B: lämna | **A, lågprio** | John |
| 15 | Sökfältet i topplisten är en attrapp ("Inte ansluten ännu") | A: behåll som platshållare. B: dölj tills sökning finns | **B**. Johns regel: visa inget som inte fungerar | John |

Rader 16–20 kom från inventeringen av `/control` 7 okt, kväll. Underlag och arbetsordning: `random/prompt-control-koherens.md`.

| # | Tveksamt | Alternativ | Rekommendation | Vem |
|---|---|---|---|---|
| 16 | Sju sidor (`events`, `tree`, `videos`, `activity`, `probe`, `guide`, `operator-chat`) renderar gamla `studio.tsx` med egen sidomeny inuti Johns skal; `changeView` byter innehåll utan att byta URL | A: flytta vy för vy till sidmallen, ta bort `studio.tsx` till sist. B: lämna | **A**, i ny chatt med prompten ovan | Jakob |
| 17 | Probe (`ProbeEditor`) finns på två ställen: sidan `/control/probe` och fliken Probe i Dealers & klipp. Administrationens flik "Talgranskning" är en annan funktion (betald speech-QA, avstängd med 501) men delar namn med menyraden Talgranskning → `/control/probe` | A: en plats, sidan `/control/probe`. B: flik i Dealers & klipp, ta bort sidan. C: lämna. Plus: döp om administrationens flik så namnen inte krockar | **A**, och omdöpning till John | John |
| 18 | OpenClaw två gånger: Agentmodeller (`/control/openclaw`) och Operatörschatt (`/control/operator-chat` = gamla OpenClaw-vyn) | A: behåll båda men ge Operatörschatt sidmallen och eget innehåll. B: slå ihop till en sida med två flikar | **B** | John |
| 19 | Bakgrund på tre ställen: flik i Dealers & klipp, `/control/zones`, alias `/control/backgrounds` | A: fliken länkar till `/control/zones`, aliaset pekar dit. B: zoner in som flik, sidan bort | **A** | John |
| 20 | Nio döda Kevin-slugs under `/control` (`roulette`, `baccarat`, `statistics` …) visar översikten med notis | A: ta bort ur `CONTROL_PREVIEW_VIEWS`, behåll de 15 som omdirigerar. B: lämna | **A** | Jakob |

Rader 21–30, 7 okt kl 18:45. Jakob delegerade alla beslut om `/control`, även Johns rader, till orkestratorn. Underlag: `random/control-inventering-2026-10-07.md` (C1–C265, beslut i "Kortversion" och "Beslut 7 okt kl 18:45"). Tabellen ligger som kommentar i #2 så John kan invända.

| # | Beslut | Avviker från | Status |
|---|---|---|---|
| 21 | Rad 16–20 verkställs: 17A, 18B, 19A utan att vänta på John | Rekommendationen att vänta två arbetsdagar | Gjort 7 okt kväll: alla sju sidor utbrutna, `studio.tsx` borttagen, Probe på en plats, OpenClaw med två flikar, Bakgrund via länk, nio döda adresser 404 |
| 22 | Sparstatus bara i topplisten (rad 13 A) | Johns rad 13 var öppen | Gjort |
| 23 | Sökfältet i topplisten tas bort (rad 15 B) | Johns rad 15 var öppen | Gjort |
| 24 | Administrationens flik Partner heter Partnernycklar | Kevins etikett | Gjort; id `partners` oförändrat |
| 25 | Sidrubrik, fliktitel och menyrad har samma namn ("Händelser → klipp", "Uppspelning", "Guide & hjälp", "Översikt"), alla titlar slutar "· Croupier Studio" | Gamla namnen Nodträdet, Händelselogg, Kontrollpanel | Gjort; `lab/docs/guide.json` använder fortfarande gamla namn |
| 26 | Chattgenvägar, kort logg längst ner och sidfoten "Croupier Lab" på de gamla sidorna tas bort | – | Gjort på tre sidor |
| 27 | Händelseloggen följer med vid sidbyte i `sessionStorage`, 150 poster, töms när fliken stängs | Tidigare bara i minnet | Gjort |
| 28 | Dealers & klipp: flikarna Probe och Bakgrund blir länkar; gamla `#probe`, `#background`, `#stream` leder till sina sidor | – | Gjort |
| 29 | Händelser: villkorsbibliotek (nu även för Astrid), eventnamn och testbänk. Astrids klippregler stannar på Händelser eftersom de visas för vald händelse; samma redigerare finns i Dealers & klipp per mapp. Idle är en länk. Varianter för Vera, Amira och Mei märks "används inte av spelet ännu" (L19) | Rad D4 i inventeringen; tidigare förslag att göra Astrids klippregler till en länk | Gjort |
| 30 | Rotens startfiler (Start-Lab.cmd m.fl.) borttagna av Jakob; `launcher.test.mjs` borttagen; dokumentationen pekar på `node lab/start.mjs --no-open` | – | Gjort |
| 31 | Valet av variant följer med i adressen (`?variant=`) på Händelser och Klippbibliotek | Ursprungligt villkor: bara dealer och event i adressen | Gjort; annars kopplas video till fel variant vid sidbyte |
| 32 | OpenClaw-fliken Chatt har ingen sparknapp | Rad C77 (Spara bara där något redigeras) | Gjort; chattens läge sparas inte i projektet |
| 33 | Systemkartans baslinje uppdateras inte | Handoffens "uppdatera vid avsiktlig ruttändring" | Uppdaterad 7 okt natt (`8ebb53e2`) sist i pass B, efter granskning. Kartan är grå: 0 gula, 0 röda. Varje ändrad post och dess commit står i commit-texten |

Rader 34–36, 7 okt natt: pass A–C enligt `random/handoff-2026-10-07-kvall.md`. Underagenter körde, orkestratorn granskade och levererade.

| # | Pass | Gjort | Kvar |
|---|---|---|---|
| 34 | A. Teststädning (`1aba4ff6`) | Sex gröna testfiler utan körare och tre frontendtester i `pre-commit-full`. Dold text och `studio-navigation.mjs` borta; skyddet för gamla menyadresser är en fast lista. Pensionerade namn i tester; `backup-lab-state` med oförändrat format. GitLab-inboxens verktyg borta, `identity` och låset i chefen. Död CSS för gamla sidomenyn borta | `test/backoffice-lab-browser.mjs` är opt-in och inte körd. Chefens register ligger kvar i `.croupier-inbox/chef.json` och låsets feltext säger "Inbox busy". CSS utanför listan (`studio-shell`, `studio-brand`, `main-nav`, `studio-body`, `dealer-selector`, `studio-footer`) är kvar |
| 35 | B. Dokumentation mot kod (`a2402600`, baslinje `8ebb53e2`) | D1–D32 rättade i `AGENTS.md`, `CLAUDE.md`, README-filerna, labbguiden, `guide.json`, `docs/` och `.cursor/rules`. "Kopplingar som saknas" och GPU-påminnelsen i handoffen. Kommentar i #2 om rad 13 och 15 | Gränssnittstexter som ligger efter koden (L20–L22). Rullande observationsfönstret monteras inte (L23). GPU-workflows låses före 19 okt |
| 36 | C. Sista operatörsadmin och sqlite (`186c6bc4`) | Lagret avvisar en medlemskaps- eller rolländring som lämnar bolaget utan aktiv medlem med `team.roles.assign`: 409 i samma transaktion, låst bolagsrad. Utan pool med `connect()` stängs sådana skrivningar med 503. Sqlite-vägen granskad, inget borttaget (tabellen nedan) | Ingen rutt eller vy skriver (L5, L11). Skrivande rutt måste skicka poolen (L24). Ingen databasspärr och inget samtidighetsprov mot riktig Postgres |

Granskning av sqlite-vägen i `web/server.mjs` (pass C, endast läsning). Handoffens "11 grenar, 15 P6" stämmer inte med dagens fil: omkring 20 postgres-villkor och drygt 20 `nativeP6`-referenser, och P6 är en QA-router som inte hör till sqlite.

| Fråga | Rekommendation | Bevis |
|---|---|---|
| Vad kör produktion? | Postgres; behåll | `docs/ENVIRONMENT-VARIABLES.md:64`, `:107`; `web/server.mjs:52-59` |
| Läge utan miljövariabel | Sqlite är standard; låt det vara kvar | `web/server.mjs:52`, `:86` |
| Domänmoduler | Produktion laddar `web/storage/async-*.mjs` (10), sqlite `web/*.mjs` | `web/server.mjs:78-82` |
| Plånbok, spelare, bord | Produktion kör postgres-grenarna | `web/server.mjs:175-237`; `test/postgres-persistence.mjs`, `test/postgres-native-table.mjs`, `test/player-auth.mjs` |
| Speladministration | Bara postgres, annars null | `web/server.mjs:253-254`; `test/player-password.mjs` |
| Lokalt konto och schema | Bara sqlite skapar schema och lokal superadmin | `web/server.mjs:255-325`; `test/cloud-admin-bootstrap.mjs`, `test/craig-login.mjs` |
| Probe-lagring | Sqlite kan använda `dataDir/studio`; produktion använder Neon | `web/server.mjs:99-101` |
| Lokala profiler (`lissabon-stream-lane`) | Bara sqlite med lokala flaggor; postgres får en tom ersättare | `web/server.mjs:547-551`; `test/lissabon-profiles.mjs` |
| `preview_sessions` | Schemat skapas bara i sqlite | `web/server.mjs:553` |
| P6 | Ingen sqlite-gren; avstängd som standard | `web/native-p6-qa-hook.mjs:28-33`; `ops/cloud/test/native-p6-router-hook.test.mjs` |
| Om sqlite pensioneras | Förloras: offline-labbet, lokala profiler, sqlite-fixturer i testerna, `tools/backup-lab-state.mjs`, `lab/data`, `test/sqlite-postgres-migration.mjs` | `lab/start.mjs:16-21`, `:68-72`; `tools/backup-lab-state.mjs:166` |
| Beslut nu | Ta inte bort något | – |

## Rader 37–44, natten 7–8 oktober

Från Jakobs genomgång av `/control`, agentens Tveksamt efter pass A–C, och Vercel-listan.
Rekommendationerna är orkestratorns; Jakob avgör.

| # | Tveksamt | Alternativ | Rekommendation | Vem |
|---|---|---|---|---|
| 37 | Händelser (`/control/events`) och Händelser → klipp (`/control/tree`) visar samma data: en redigerar ett event, den andra är översikten över alla | A: en sida; översikten blir läget utan valt event. B: två sidor som nu | **A**, i klipplogikpasset | John |
| 38 | Klipp vid kortutdelning finns i två system: `events`/`lines`/`variants`/`triggers` (Händelser) och `legacyClipPolicy` (Kort & deal, frekvens per klipp). `web/clip-mapping.mjs` läser det ena, `web/presentation-api.mjs` det andra | A: ett system; avgör först vilket spelet faktiskt använder, flytta det andras data dit, ta bort det andra. B: lämna | **A**. Det är kärnan i Jakobs klipplogik. Egen brief: `random/prompt-klipplogik.md` | Jakob |
| 39 | L23: rullande observationsfönster monteras inte sedan `studio.tsx` togs bort; Uppspelning stannar vid 300 meddelanden eller 4 MiB | A: montera rullande läge på `/control/activity`. B: lämna | **A**. Beteendet fanns; regeln säger att det ska tillbaka | Jakob |
| 40 | Vercel `scoutgaming-legacy-frontend`: frontenden före Services-bytet. Git är fortfarande kopplat, varje push startar ett bygge som avbryts | A: radera. Koden finns i Git, miljönamnen i `docs/ENVIRONMENT-VARIABLES.md`; förlorar deploy-historik. B: koppla loss Git, behåll som reserv | **A**. Reserven är repot | Jakob |
| 41 | Vercel `croupier-native-qa-abc92154cb15` och `croupier-native-studio-qa-abc92154cb15`: isolerad testmiljö (frontend + Studio, egen databas), ingen Git | A: behåll, kostar inget, är testbänken för att prova lane-export utan att röra produktion. B: radera, återskapa vid behov (~1 h) | **A** | Jakob |
| 42 | Systemkartan: 24 kontrakt, varav 9 är miljöfakta (`environment.*`) som aldrig blir gröna lokalt; gul läses som fel fast det betyder "indata ändrad, granska" | A: trimma till kontrakt som skyddar något (rutter, scheman, spelhändelser, integritet); miljöfakta blir en vanlig tabell; gul får svensk text "granska" med commit som ändrade. B: lämna | **A**, eget litet pass | Jakob |
| 43 | `/control/zones` har eget skal (mörkgrön bakgrund), för mycket text | A: in på sidmallen, korta texten. B: lämna | **A** | John |
| 44 | Jakobs UI-lista rad 3–6: rullgardin med anslutna bolag på Översikt, spelare per bolag, "SG test game provider" som demo-operatör | Är lane-flödet (L1–L3, L15) i UI-form. Demo-operatören är ett bra första steg: en intern operatör att exportera till | Ingår i klipplogik/lane-passet, inte separat | Jakob |

Avgjort på Jakobs delegering: L20–L22 (tre texter) rättas i nästa mekaniska pass. GPU-workflows låses till `ubuntu-24.04` före 19 oktober.

## Rader 45–48, natten 8 oktober (orkestrator 2, pass M)

Underagenter M1 (CI) och M2 (UI) körde parallellt; orkestratorn granskade och rättade. Uppföljning i `random/checklista-2026-10-08.md`.

| # | Tveksamt | Alternativ | Beslut | Status |
|---|---|---|---|---|
| 45 | Rad 39: underagenten monterade `focused` på Uppspelning. Det ger rullande fönster men döljer *Visa spelfliken här*, Partner-SSE och lokala knappar | A: `focused` (gamla observationspanelen i Dealers & klipp). B: separat `rolling`-prop, allt annat kvar | **B**. Ingenting får bli sämre; testet bevisar både rullande text och att knapparna finns | Gjort `820709dd` |
| 46 | ffmpeg-cache: vid cacheträff hoppas `apt-get update` över, så ny ffmpeg kommer först när cacheposten faller (7 dagar oanvänd). Jobben `presentation-studio` och `lipsync-worker` får `permissions: actions: write` för att kunna spara cache | A: acceptera; `dealer-regression` utan cache tills vidare. B: cacha även `dealer-regression` (ffmpeg + jq) | **A nu, B om jobbet hänger** | Gjort (pass M) |
| 47 | Orphan-undantag: `test/fuzz-blackjack.mjs` är ett manuellt fuzz-skript mot klientmodulen `web/public/blackjack.mjs` (T1–T3-eran) och räknade 85 820 invariantbrott på 12 s. Servern äger korten (`web/shoe-game.mjs`), så det är inte produktionsrisk, men skriptet är antingen föråldrat eller pekar på något | A: undantag nu, egen granskning senare. B: ta bort skriptet | **A**; Jakob avgör om skriptet ska uppdateras mot `shoe-game` eller tas bort | Öppet |
| 48 | Commiten för punkt 4 (cache) tog med raden `Orphan tests` i `croupier.yml` eftersom filen stagades hel; skriptet kommer i nästa commit. Mellancommiten är inte CI-ren ensam, pushen som helhet är det | – | Till kännedom | – |

## Avgjort av orkestratorn, till kännedom

| Tveksamt | Vad som gjordes |
|---|---|
| Historiksidan sa "ingen publik rutt" fast rutten finns | "Inga avslutade rundor ännu" |
| `/api/history` tar bara POST | Behölls, samma som `/api/balance` |
| Transaktions-id borttagna ur historiksvaret | Behölls, spelaren behöver dem inte |
| Migration 005 | Körd mot produktions-Neon, status rättad |
| "Nivå 1 · ScoutGamingGroup" dold text | Behålls tills testet skrivs om |
| `/` och `/studio` markerar Dealers & klipp | Rätt, labbets rot är klippsidan |
| Agentmodeller hade två lime-knappar | Radens Spara är sekundär (Johns regel 2) |
| Skalet läste React-internals för att hoppa över hooks i test | Borttaget 7 okt. Statusfältet är en egen komponent |
| Offline-labbet ger 500 på alla sidor utom Agentmodeller | Förväntat sedan `45ae2752`: sidorna kräver Neon, ingen diskfallback. Inte en regression. Verifiera UI i produktion eller med Neon-anslutning |
| Administrationens eyebrow sa "// ÅTKOMST" fast menyn har sidan under Drift | Ändrad till "// DRIFT" |
| Pre-commit-kroken körs inte i den här klonen (`core.hooksPath` är inte satt) | Kontrollerna kördes för hand med `node tools/precommit-checks.mjs --full`; bara ffmpeg-testerna föll, de kräver ffmpeg lokalt. Sätt `git config core.hooksPath .githooks` |
| `next/font/google` hämtade typsnitt från Google vid bygge; gav flakigt CI-fel | Tre variabla woff2 (OFL-1.1, 110 KB) ligger i `lab/app/fonts`, laddas med `next/font/local`. `6ffd7c78` |
| Sidtitlar "Backoffice/Lab" på Händelser, ingen titel på Talgranskning, "← Backoffice/Lab" i Bakgrundszoner | Rättade till "Croupier Studio" och "← Dealers & klipp" |

## Till Kevin

| Punkt | Läge |
|---|---|
| Team-vyn utlyft ur `original-views.jsx` till `views/team.jsx` (5990 → 5915 rader) | Klart 7 okt, pushat i `661de97b` |
| Fixture-sidan `/partner/demo-north/team` är inte pixel-identisk: svenska kolumner, rollväljare per rad, formuläret Bjud in; knappen Invite people borta | Repot får tweaka Kevins kod (Jakobs policy). Kevin bör se det |
| Inbjudan, rollbyte och `team.suspend` är inte kopplade till servern; verkligt läge är läsbart | Kräver Jakobs godkännande innan koppling. Hör ihop med rad 7 |
| `preview.test.mjs` träffar fortfarande gamla `ScopedTeamPreview`; `TeamView` testas i `partner-team.test.mjs` via `renderToStaticMarkup`, inte i webbläsare | Täckning att komplettera när vyn får serverkoppling |
| `port-source.mjs` skulle återställa fabrikens `Team` om porten körs om | Varningsrad tillagd i skriptet 7 okt |
| Resten av hans 13 vyer rörs inte förrän de får riktig data | Policy |
| Hans kopplingar anpassas till repots API och sessioner, inte tvärtom | Jakobs policy 7 okt |
| Rad 7: skydd för sista administratören | Byggt i lagret (`186c6bc4`). En skrivande rutt måste skicka poolen med `connect()`, inte `{ query }` (L24) |

## Större beslut som väntar på Jakob

| Fråga | Rekommendation |
|---|---|
| `web/server.mjs` har dubbla vägar sqlite/postgres | Granskad 7 okt natt (rad 36 och tabellen under den): produktion kör postgres, sqlite bär offline-labbet och lokala fixturer. Ta inte bort sqlite utan beslut |
| Render `croupier-v2` har autodeploy av; `/bo`-redirects och `/api/history` är inte deployade | Manuell deploy i Render-konsolen, eller ge API-nyckel |
| Neon-rollen `croupier_game` visades i klartext i en MCP-session | Rotera lösenordet, uppdatera Vercel-env |
