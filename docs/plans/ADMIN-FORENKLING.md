# Målbild: Admin, Partnerportalen och spelaren

> **En målbild för alla tre nivåer**, verifierad mot `main` 34fc4cdc02 den 28 oktober 2026. Den ersätter utkastet från 27 oktober ("en knapp för att publicera rummet"), som lever vidare som leveranssteg D nedan, och Jakobs paket från claude.ai (README, NIVAER, MATRIS-N1-N2, N1-ADMIN, N2-OPERATORSPORTAL, BESLUTSKARTA, PR-ORDNING), som skrevs utan repotillgång och är inarbetat här med avvikelserna rättade. Läget i koden står i [ADMIN-KARTA.md](ADMIN-KARTA.md); skissen är [ADMIN-MALBILD-PROTOTYP.html](ADMIN-MALBILD-PROTOTYP.html) (en fil, exempeldata i minnet).
>
> Det här är ingen tracker: `migrering/status.json` är enda statuskällan, och den här planen finns inte i masterplanen. Bygget startar efter O03, nivå 2 först, och varje steg visas i staging innan det mergas. Jakob avgör UX. Koden på `main` vinner alltid över texten här.

## 1. Tre regler som allt annat följer

1. **Admin skapar och tilldelar. Bolaget väljer. Spelaren spelar.** Allt ett bolag kan ändra är en delmängd av det Admin kan ändra på samma objekt, begränsad av tilldelningen (paketet) och av personens roll.
2. **Samma komponenter, olika navigation, egen serverkontroll.** En dold meny är inte åtkomstkontroll. Varje skrivning kontrolleras på servern per bolag, resurs, åtgärd och revision.
3. **Inga låtsasfunktioner.** Saknas datakoppling visas det rakt ut ("Inte anslutet"), aldrig påhittade siffror.

## 2. Jakobs beslut som styr målbilden

| Datum | Beslut | Följd här |
|---|---|---|
| 2026-10-27 | En produktväg (Vercel + Render + Neon + Blob), `main` enda produktvägen; `/control`, `/lab`, `/bo` pensionerade | inga nya kopior av Admin-flöden; alla gamla adresser omdirigeras |
| 2026-10-28 | Delat bord blir enda spelvägen från O03; nativebordet pensioneras; "Slå på ljud" struken | nivå 3 i målbilden är bara delat bord; nativebordets lagerkedja och `/game?dealer=` försvinner med det |
| 2026-10-28 | Varje spelare tillhör exakt ett bolag; byggs efter O03, före första riktiga bolaget | steg F; tills dess visar Spelare och Rapporter i nivå 2 ärliga tomlägen |
| 2026-10-28 | Insatsprofil får ändras i nivå 2 bara om Admin låser upp det per bolag, bland profiler Admin godkänt; låst som standard | `allow.limit` i tilldelningen, låst som standard |
| 2026-10-28 | Talkedjan (Dragans AI-tal med läppsynk) är pausad; efter migreringen byggs en dealer-generisk kedja; Dealer Forge orörd | Dealers › Röst och tal visar dagens verktyg oförändrade; inget byggs om där före den separata talaktiviteten; Skapa material flyttas in i navet men ändras inte |
| 2026-10-28 | Händelseträdet är borttaget (#468) | frågan om Regler-fliken är borta; körreglerna är `studio-policy-panel` |
| 2026-10-28 | Dealers blir ett nav som samlar **alla** dealerverktyg | avsnitt 4.2 |
| 2026-10-28 | Nivå 2 får Johns operatörsmeny med ärliga tomlägen | avsnitt 5 |
| 2026-10-28 | Radera hellre än arkivera; inga nya mappar eller trackers | en plan, en karta, en skiss; dubbla ytor tas bort, inte göms |

## 3. Nivåerna: vem äger vad

| Nivå | Vem | Ingång | Äger | Gör | Ser |
|---|---|---|---|---|---|
| 1 Admin | Scoutgamings personal | `/admin` | dealers, klipp, tal, mallar, material, bolagen | skapar innehåll och rum, tilldelar till bolag, publicerar, låser upp val | allt, över alla bolag |
| 2 Partnerportalen | bolagets personal (administratör, redaktör, läsare) | `/partner/<bolag>` | sitt team, sina val inom tilldelningen, sina rum | väljer dealer, bakgrund, bordsgrafik, språk och tillgänglighet inom det som är upplåst; publicerar sina rum; hanterar team; begär material | bara sitt bolag |
| 3 Spelaren | spelare hos ett bolag | `/lobby`, `/game` | sitt konto, sin historik, sina lobbyval | spelar | bara publicerade rum hos sitt bolag |

Regeln per inställning. Admin bestämmer läget per bolag (fliken *Bolagets val*, lagrat i paketet):

| Inställning | Nivå 1 | Nivå 2 | Nivå 3 |
|---|---|---|---|
| Spel (blackjack, roulette) | skapar, tilldelar | ser tilldelade | ser publicerade |
| Dealer | skapar, tilldelar, kan låsa per rum | väljer bland tilldelade om upplåst | ser |
| Klipp, varianter, tal | skapar, godkänner | ser status, förhandsvisar, begär | hör och ser |
| Mall (placering av lager) | skapar, tilldelar | ser vilken som används | ser |
| Bordsgrafik, bakgrund | laddar upp, tilldelar | väljer bland tilldelade om upplåst | ser |
| Bordsspråk | sätter standard | ändrar om upplåst | ser |
| Insatsprofil | sätter, godkänner profiler | ändrar bara om upplåst (låst som standard) | ser |
| Tillgänglighet (öppet/pausat) | pausar | pausar egna rum om upplåst | ser bara öppna |
| Publicering | publicerar | publicerar egna rum med granskning | får ny version vid nästa runda |
| Team | skapar bolag, utser administratör | administratör bjuder in redaktör och läsare | – |
| API-nycklar | skapar, roterar, återkallar | ser status, begär rotation | – |
| Spelare och transaktioner | ser alla, för support | ser egna, spärrar egna om rollen tillåter (efter steg F) | ser sig själv |

Där gränsen läcker i dag (fil:rad i kartan): spelarna är inte knutna till bolag; `/game?dealer=` utan bolag läser sparat i stället för publicerat (faller med nativebordet); Admin och portalen redigerar samma utseendeutkast per bolag; sex av tolv partnerbehörigheter kontrolleras aldrig på servern; rummens namn och läge läses levande ur administrationsdokumentet, inte ur paketet.

## 4. Nivå 1: Admin

### 4.1 Meny: från 17 sidor till 8

Nya namn kräver inga nya adresser: alla omdirigeringar i `packages/navigation/admin-workspace-routes.mjs` och `apps/studio/middleware.ts` behålls, och gamla djuplänkar landar på rätt flik med bibehållen bolag, rum, dealer och revision.

| Menyval | Ersätter i dag | Innehåll |
|---|---|---|
| **Översikt** | `/admin` | det som väntar: opublicerade utkast, ändrad tilldelning, inbjudningar som inte accepterats, dealers som inte är godkända. Varje rad leder till platsen där det åtgärdas. Inga genvägskort utan uppgift. |
| **Spelbord** | rumsdelen av `/admin/rooms` | alla bolags rum, filter per bolag, en editor (4.3). |
| **Bolag** | `/admin/companies`, bolagsdelen av `/admin/rooms`, `/admin/admin/api`, `/admin/players`, `/admin/ekonomi` | ett nav per bolag (4.4). |
| **Dealers** | `/admin/dealers`, `/admin/clips` med alla flikar, `/admin/dealer-studio?view=generate`, `/admin/replies`, `/admin/dealer-agent` | ett nav per dealer med alla dealerverktyg (4.2). |
| **Scenmallar** | `/admin/scenes` | egen sida, inte längre samma instans som klippkartan. Visar vilka rum och bolag som använder mallen. Får knappen **Exportera landningsmall** (4.5). |
| **Material** | `/admin/assets` | enda stället där bordsgrafik och bakgrunder laddas upp. |
| **System** | `/admin/drift`, `/admin/ai/models`, `/admin/admin/accounts`, `/admin/structure`, `/admin/lobby` | Drift, AI-agenter, Scoutgamings personal, Beroenden, Intern lobby. |
| **Hjälp** | `/admin/guide` | begrepp, vem som får ändra vad, länkar till guiden och ordlistan. |

### 4.2 Dealers: navet som samlar alla dealerverktyg

Dealern är arbetsobjektet för allt innehåll. Navet har en dealerväljare överst och flikar. Allt som i dag ligger utspritt på klippkartans flikar och Studio-verktygen samlas här, med samma komponenter och samma API:er som i dag:

| Flik | Samlar i dag | Komponent i dag | Ändras |
|---|---|---|---|
| **Klipp** | Klippkarta (`/admin/clips`), Lägg till klipp (`?panel=intake`), Importassistenten (`?tool=import`), körregler (`studio-policy-panel`) | `connected-clip-map.tsx`, `clip-intake-panel.tsx`, `dealer-import-assistant.tsx` | en ingång "Lägg till klipp" (uppladdning och mappimport är två steg i samma flöde, inte två flikar); kortstatus "Standard (sparad)" och "Ändrat sedan publicering"; frivilliga fack hopfällda; fackräknare "Krävs för spel: 10/10 tal · 34/34 giv · 1/1 vila"; klick på kortet öppnar detaljpanelen |
| **Röst och tal** | Röst & tal (`?panel=room`), Svarsbibliotek (`/admin/replies`), Dialogtest (`/admin/dealer-agent`), Taldrift (`/admin/drift?tab=speech`) | `studio-speech-panel.tsx`, `control-replies-page.tsx`, `control-openclaw-chat.tsx` + `gateway-panel.tsx`, `moving-drift-controls.tsx` | bara flyttas in; livemärke per replik ("Live: goodluck_1 · Utkast: goodluck_3"); "Använd i spelet" ersätter "Sätt som standard i talfacket" och sparar utkastet i samma steg. Talbygget, proben och AI-delarna rörs inte förrän talkedjan generaliseras (egen aktivitet efter O03) |
| **Scen** | dealerns del av Sceneditorn | `studio-composition-panel.tsx` öppnad med dealern förvald | samma editor som under Scenmallar; här syns vilka mallar som tillåter dealern och knappen "Öppna i Scenmallar" |
| **Skapa material** | Skapa material (`/admin/dealer-studio?view=generate`) | `dealer-forge-page.tsx` | bara flyttas in; orörd tills Jakob beslutat om nya dealers filmas eller genereras |
| **Används av** | Kopplingar & användning filtrerat på dealern | `resource-connections.tsx` | läsvy: rum, bolag, mallar och tilldelningar som använder dealern |
| **Inställningar** | Dealers › arkivera/radera, `?panel=dealer` (Dealer & användning), godkännande | `studio-lifecycle-panel.tsx`, `dealer-directory.tsx` | **en** livscykel i stället för två; nytt status "Godkänd" som krävs för att dealern ska kunna tilldelas (lagras i projektet; schema oförändrat) |

Flödet för en ny dealer är en sekvens med tydliga klart-lägen: Skapa (namn, spel, språk) → Skapa material (valfritt) → Lägg till klipp → Klipp per situation → Röst och tal → Godkänn → Tilldela under Bolag › Tilldelat och publicera. Varje situation visar Klart / Saknar variant / Saknas, och Bolagens dealervy visar samma status i läsläge.

Klippkartan organiseras per situation, inte per fil (grupperna Vila, Spelhandlingar, Repliker, Övergångar). Beteenden är dagens körregler (`studio-policy-panel`); ingen ny regelmodell.

### 4.3 Spelbord: en editor, två nivåer

Admins editor har flikarna Utseende, Dealer, Spelinställningar, Tillgänglighet, Bolagets val, Historik. Bolagets editor (avsnitt 5.2) är samma komponent med färre flikar och filtrerade val.

*Bolagets val* är där Admin låser upp eller låser varje inställning för bolaget: dealer, bordsgrafik, bakgrund, bordsspråk, insatsprofil (låst som standard), tillgänglighet. Valen sparas i bolagets paket, inte på rummet.

Publiceringen är gemensam för båda nivåerna och går via en kontrollerad serverväg (avsnitt 7). Granskningen visar ändringar, berörda rum, ersatt version och eventuell delad mall. Tills dess finns dagens åtta knappar kvar (kartan, avsnittet "Knappar som höjer paketrevisionen"); specialknappen *Publicera PAOWs viloklipp* tas bort först när ersättaren bevisligen bevarar övriga publicerade medier och placering.

### 4.4 Bolag: navet för nivå 2 sett från nivå 1

| Flik | Innehåll | Ersätter |
|---|---|---|
| Tilldelat | spel, dealers, mallar, material och upplåsta val för bolaget; publiceras som ny paketrevision | `A:operator-package` i `/admin/rooms` ("Spelmallar för bolaget") |
| Spelbord | bolagets rum med länk till editorn, "Nytt rum för bolaget" (dagens "Lägg till spel") | listan i `/admin/rooms` |
| Spelare | bolagets spelare och transaktioner; kräver steg F, tills dess "Inte anslutet" | `/admin/players`, `/admin/ekonomi` |
| Team | medlemmar, roller, inbjudningar, sista-administratör-spärr | `/admin/companies` |
| Integration | API-nycklar (skapa, rotera, återkalla), testsession, demokrediter | `/admin/admin/api` |
| Journal | bolagets händelser | journalen i `/admin/companies` |
| Inställningar | stäng av, flytta till papperskorg, återställ | livscykeln i `/admin/companies` |

Knappen *Förhandsvisa portalen i läsläge* öppnar portalen som en läsare hos bolaget ser den, med serverbegränsning och loggning. Den är ingen rollväxlare.

### 4.5 Scenmallar: rita bordet efter dealern

Korten ritas av klienten där dealerns hand landar i filmen; landningspunkterna kommer från dealerns registrerade filmprofil (`registeredFilmedProfile`, till exempel `packages/presentation/contracts/filmed-profiles/kevin-paow-c7138759.mjs`). Mobilen visar tre av sju platser i ett glidande fönster runt den egna eller aktiva platsen (`services/game/public/shared-room-presentation.mjs:249`); placeringsredigeraren (`components/blackjack-scene-placement-editor.tsx`) har per bord mobil tre platser och dator sju, med valet att följa filmen (`autoScale.landing`) eller placera manuellt. En bordsgrafik som är bredare än filmen får boxar där handen inte landar, och då börjar man zooma och flytta i stället.

Målbildspunkt (nivå 1, efter O03, samordnad med spåret för flerspelarbordet och mobilvyn 2026-10-28): **rita bordet efter dealern, inte dealern efter bordet.** Placeringsredigeraren får knappen **Exportera landningsmall**, som ger en PNG eller SVG med dealerns sju landningspunkter, dealerplatsen och mobilens treboxram, hämtade ur den registrerade filmprofilen för vald dealer (inte ur den manuella geometrin, så att mallen gäller även bord som inte kalibrerats). Bordsdesignern målar boxarna efter mallen, och samma bordsgrafik fungerar på mobil och dator utan nya klipp. Utanför målbilden: zoom och panorering på mobil, kameravinklar per plats (alla ser samma frontfilm) och fler än tre synliga boxar på telefon. "Neutral giv" (dealern lägger kortet framför sig och renderingen glider det till platsen) är en filminspelningsfråga, inte Admin.

### 4.6 System

Drift (status, skor, delade bordets prov; Taldrift flyttar till Dealers › Röst och tal), AI-agenter (modell per agent, OpenClaw-panelen under det namnet bara i detaljer), Scoutgamings personal (bara nivå 1-konton; egen komponent i stället för CSS-delning med Spelarkonton), Beroenden (var används dealer, material, mall och rum; visas också som *Används av* på varje objekt), Intern lobby (visar även opublicerat, bakom inloggning).

### 4.6 Beslutskarta: dagens sidor och deras nya plats

Alla omdirigeringar behålls. Kolumnen "i dag" är verifierad mot koden i kartan.

| I dag | Adress | Beslut | Ny plats |
|---|---|---|---|
| Översikt | `/admin` | behålls | Översikt, med det som väntar |
| Sceneditor | `/admin/scenes` | behålls, egen instans | Scenmallar; dealerns del som Dealers › Scen |
| Klippkarta | `/admin/clips` | slås ihop | Dealers › Klipp |
| Röst & tal | `/admin/clips?panel=room` | slås ihop | Dealers › Röst och tal |
| Inställningar / Dealer & användning | `/admin/clips?panel=dealer` | slås ihop, en livscykel | Dealers › Inställningar |
| Lägg till klipp | `/admin/clips?panel=intake` | slås ihop | Dealers › Klipp › Lägg till klipp |
| Importassistent | `?tool=import` | slås ihop | andra steget i Lägg till klipp |
| Dealers | `/admin/dealers` | behålls | navet; Astrid-kortet med legacyreferens tas bort i ren start |
| Skapa material | `/admin/dealer-studio?view=generate` | slås ihop, orörd | Dealers › Skapa material |
| Svarsbibliotek | `/admin/replies` | slås ihop | Dealers › Röst och tal |
| Dialogtest | `/admin/dealer-agent` | slås ihop | Dealers › Röst och tal › Testa dialog |
| Talgranskning | `/admin/media-review` | tas bort (#477) | – |
| Bord & bakgrunder | `/admin/assets` | behålls, byter namn | Material |
| Spelbolag & rum | `/admin/rooms` | delas upp | editorn till Spelbord; bolagsval, livscykel och paket till Bolag › Tilldelat; rubriken Spelutbud försvinner |
| Bolag & team | `/admin/companies` | slås ihop | Bolag › Team, Journal, Inställningar; projektet och videolistan hämtas inte längre |
| Integrationer | `/admin/admin/api` | slås ihop | Bolag › Integration |
| Spelarkonton | `/admin/players` | slås ihop | Bolag › Spelare (efter steg F); egen komponent, inbäddad Logga ut bort |
| Ekonomi | `/admin/ekonomi` | slås ihop | Bolag › Spelare; en läsning i stället för två |
| Drift | `/admin/drift` | till System | System › Drift; dolda gruppen `tables` och dess actions tas bort |
| Systeminställningar | `/admin/ai/models` | till System | System › AI-agenter |
| Kopplingar & användning | `/admin/structure` | till System | System › Beroenden, plus *Används av* på objekten |
| Konton & åtkomst | `/admin/admin/accounts` | till System | System › Scoutgamings personal |
| Intern lobby | `/admin/lobby` | till System | System › Intern lobby (får en länk) |
| Hjälp | `/admin/guide` | behålls | Hjälp |
| Inloggning | `/admin/login` | behålls | sidtiteln "Croupier Admin" blir "Scoutgaming Admin" |
| Publicera PAOWs viloklipp | `/admin/rooms` | tas bort i steg D | gemensam publicering |

## 5. Nivå 2: Partnerportalen

Målet: varje bolag får ett eget, litet adminsystem. Det ser ut som Admin och använder samma komponenter, visar bara det egna bolaget, erbjuder bara de val Admin har tilldelat och låst upp, och kontrollerar allt på servern per bolag, resurs, åtgärd och revision.

### 5.1 Meny (Johns operatörsmeny)

| Menyval | Behörighet (kodens namn) | Syfte | Data i dag |
|---|---|---|---|
| Översikt | overview.read | status för rummen, det som väntar, meddelanden från Admin (ny tilldelning), ingång till "Begär material" | snapshot (paketrevision, mallar, rum); spelsiffror saknas → tomläge |
| Spelbord | tables.read | lista och editor; det dagliga arbetet | snapshot + branding; spelinställningar och tillgänglighet saknas i partner-API:t |
| Dealers | presentations.read (dealers har ingen egen behörighet i dag) | de dealers Admin tilldelat: profil, språk, klippstatus, var de används, förhandsvisning, "Begär annan dealer"; inget redigerbart | paketets `registeredDealers` och mallarnas dealerval |
| Spelare | players.read | bolagets spelare och transaktioner | saknas helt tills steg F → "Inte anslutet" |
| Rapporter | reports.read | publiceringar ur journalen fungerar i dag; sessioner, omsättning och talanvändning som planerade kort utan siffror | journalen |
| Team | team.read | medlemmar, roller, inbjudningar, avstängning, journal | finns (`team`, `journal`) |
| Integration | integrations.read | status, startadress, nycklar maskerade med status, "begär rotation", testsession, kontakt | saknas; `api_keys` saknar bolag → status och kontakt visas, nycklar efter steg F |
| Hjälp och kontakt | alla | begrepp, vad man får ändra, "Begär material" | statisk |

Redaktör ser inte Team eller Spelare (partner-editor saknar team.read och players.read). Läsare ser bara läsvyer. Allt rollen inte får visas inte i menyn, **och direktadressen nekas på servern**. I dag kontrolleras bara overview.read, team.*, presentations.configure på servern; players.read, tables.read, tables.configure, presentations.read, reports.read och integrations.read måste börja kontrolleras när vyerna byggs (steg A).

### 5.2 Spelbord: editorn

Samma grundkomponent som Admins editor, med tre skillnader: färre flikar, varje val filtreras på tilldelningen, och låsta val visas som *Låst av Scoutgaming* i stället för att döljas.

| Flik | Innehåll | Styrs av |
|---|---|---|
| Utseende | förhandsvisning (samma som spelaren ser), bordsgrafik, bakgrund | `allow.tableAsset`, `allow.background` |
| Dealer | välj bland tilldelade dealers | `allow.dealer` |
| Spelinställningar | bordsspråk, insatsprofil | `allow.language`, `allow.limit` (låst som standard) |
| Tillgänglighet | öppet eller pausat; pausat rum syns inte i lobbyn, pågående rundor spelas klart | `allow.pause` (finns i Admin som `A:room-state`, saknas i partner-API:t) |
| Historik | publicerade versioner med vem och vad | – |

Publiceringsflödet: Ändra → Spara utkast → Granska → Publicera. Granskningen visar ändringarna, vilka rum som påverkas och ersatt version. **Så länge utkastet är ett per bolag** (`operator_branding_drafts`, en kedja per bolag) säger granskningen det rakt ut och listar alla bolagets rum; etiketten "bara detta rum" används inte förrän servern avgränsar skrivningen (steg D). Bolaget skapar inte nya rum själv; portalen erbjuder "Begär ett rum till".

### 5.3 Tilldelningen: det portalen bygger på

Bolagets paket (`operator_packages`) utökas från "vilka mallar" till hela tilldelningen:

```
paket (per bolag, versionerat, bara tillägg)
  spel[]            blackjack, roulette
  dealers[]         id, godkänd
  mallar[]
  bordsgrafik[]
  bakgrunder[]
  insatsprofiler[]  godkända profiler att välja bland
  allow             dealer, tableAsset, background, language, limit, pause
```

Admin publicerar paketet som ny revision. Portalen läser den publicerade revisionen och visar "Tilldelning version N" i sidomenyn plus en rad på Översikt när en ny kommit. Ett rum kan bara referera till sådant som finns i paketet; servern avvisar annat. Datamodellen ändras inte (ingen ny tabell): tilldelningen ligger i paketets `branding`, som redan bär den frysta presentationen.

### 5.4 Behörigheter

Kodens tolv (`packages/studio-access/server/partner-access-policy.mjs:12-19`) och standardrollerna (`apps/studio/lib/operator-admin-api.mjs:16-25`) behålls:

| Behörighet | partner-admin | partner-editor | partner-viewer | Kontrolleras på servern i dag |
|---|---|---|---|---|
| overview.read | x | x | x | ja |
| tables.read / tables.configure | x / x | x / – | x / – | **nej** |
| presentations.read / presentations.configure | x / x | x / x | x / – | nej / ja |
| players.read | x | – | x | **nej** |
| reports.read | x | – | x | **nej** |
| integrations.read | x | – | x | **nej** |
| team.read / team.invite / team.roles.assign / team.suspend | x | – | team.read | ja |

Administratör utses bara av Admin och kan inte delegeras. Den sista administratören kan inte stängas av (409). Nya behörigheter som behövs: tables.pause (eller `allow.pause` + tables.configure), players.block, integration.request, material.request. De läggs till i samma lista, inte i en ny modell.

### 5.5 Vad partner-API:t saknar (verifierat)

| Behov | Finns i Admin som | Partner-API |
|---|---|---|
| läsa tilldelningen (hela paketet) | `A:operator-package`, `GET presentation-room` | snapshot ger paketets presentation och branding (`partner-package-view.mjs`) men ingen tilldelningsvy |
| pausa eget rum | `A:room-state` | saknas |
| byta dealer inom tilldelningen | `A:room-game-config` + branding | branding täcker bara dealerval per mall och rum (`roomOverrides`) |
| spelinställningar (språk, insatsprofil) | `A:room-game-config` | saknas |
| spelare och transaktioner | `A:players`, `A:transactions` (globala) | saknas; kräver steg F |
| begära material | – | saknas; kan börja som journalpost (`operator_audit_events`) |
| nyckelstatus, begära rotation | `A:apikeys` (globala) | saknas; `api_keys` saknar bolag |

Bygg dem i den ordningen. Ingen av dem får gå via Admins endpoints med en partnersession.

### 5.6 Acceptans

- Direktanrop mot ett annat bolags resurs nekas utan dataläckage.
- Redaktör kan inte nå Team eller Spelare via adress, inte bara via meny.
- Ett val som inte finns i tilldelningen avvisas av servern även om det skickas direkt.
- Publicering av rum A ändrar inte rum B utan att granskningen visade det.
- Indragen behörighet mellan laddning och publicering stoppar publiceringen och bevarar utkastet.
- Pausat rum försvinner ur lobbyn; pågående runda spelas klart.
- Läsare ser publicerad version, aldrig ett utkast.
- 390 px, 768 px och desktop; tangentbord; läsbara fel.

## 6. Nivå 3: spelaren

Nivå 3 ingår för gränsens skull. Spelarens egna val (språk, ljud, sparade val i `player-choices.mjs`) ändrar aldrig vad ett rum är, bara hur det visas för just den spelaren.

Vad som ska gälla: spelaren ser bara publicerade, öppna rum hos sitt bolag; aldrig ett utkast, aldrig ett pausat rum, aldrig innehåll som inte är tilldelat bolaget. Målbilden räknar bara med delat bord (`shared-room-app.mjs`), som läser paketrevisionen, de publicerade spelinställningarna och klipp ur `media_records` + Blob.

Det som saknas (kartan, Nivå 3): spelare är inte knutna till bolag (steg F); `/game?dealer=` utan bolag och `GET /api/presentation/config?dealerId=` lämnar ut sparat material (hanteras i O02; faller med nativebordet); rummens namn och läge läses levande ur administrationsdokumentet, inte ur paketet (bokförd avvikelse mot TERMINOLOGI; åtgärdas i steg D genom att rumslistan fryses i paketet eller genom att TERMINOLOGI skrivs om, Jakobs beslut). Lobbyns bolagsval (`?operator=`) behålls för demo; i drift kommer spelaren från bolagets sajt via testsession eller nyckel.

## 7. En publicering för båda nivåerna (steg D)

Från utkastet 27 oktober, verifierat: datamodellen ändras inte (bolag, rum, mallar, frysta paket och spelinställningar står kvar). Det som ändras är flödet och **en** orkestrerad serveråtgärd som kombinerar dagens skrivningar.

**Vad Admin ser.** Rummet får en primär knapp **Publicera**, inaktiv med texten "Inget att publicera" när sparat läge inte skiljer sig från live. Knappen öppnar rutan *Det här ändras jämfört med live*: tal per replik (tagning före → efter, godkänd av vem), antal klipp som byts, vila, placering ändrad/oförändrad, inställningar (språk, insatsprofil), rummets val (bakgrund, dealer, bord) och hinder i rött med länk till rätt ställe ("Försäkring · sv: ingen godkänd tagning → Öppna i Röst och tal"). **Publicera nu** är aktiv bara när hinderlistan är tom. Efteråt ett kvitto: "Publicerat · version 8 · 27 okt 21:14 · av jakob", med `configVersion` och paketrevision före och efter under Detaljer och länken Öppna rummet.

**Server.** Ny action `POST /studio/api/admin/operator-package` med `action:'publish-room'` på samma endpoint som `refresh-dealer-idle` och `publish-scene-layout`, för att återanvända preparation-kedjan (`operator-package-api.mjs:161-163`, `studio-admin-api.mjs:132-138`). Kropp: `{action, operatorId, roomId, gameConfig:{language,limitPreset}, expectedPackageRevision, expectedProjectRevision, expectedAdministrationRevision, previewToken}`.

1. *Prepare* (utanför SQL-låset): bolaget aktivt, rummet live; `current.revision === expectedPackageRevision` annars 409; fånga materialet med samma `captureFrozenPresentation` och `selectedRegisteredIdleDefaults` som i dag; `videoRegistry.verifyCapturedMedia`; kandidatens branding med `withPackagePresentation`; skillnadens hash måste vara `previewToken`, annars 409 `studio_release_preview_stale` (som partnergranskningens `reviewToken`).
2. *En SQL-transaktion* med bolagslås och N→N+1: läs om revisionerna (409 `studio_conflict` med `step`); `assertCapturedPresentationMedia`, `assertPublishedRoomBindings`; lös rummets material mot kandidaten med `resolveNativeRoomGameMaterial` plus dagens kontroller i `room-game-config-api.mjs:58-89` (422 `studio_room_game_material_unavailable` med `materialReason` ur den fasta listan); `operators.publishRoomGameConfig(...)` (den befintliga J08-skrivaren, rumslås och CAS på head); ta bort rummets `roomGameConfigs`-utkast med CAS; svara med kvitto `{ok, operatorId, roomId, previousPackageRevision, packageRevision, configVersion, publishedAt, actor, changes}`.
3. *Rummets utseende:* första versionen stoppar med 409 `studio_room_choices_draft_pending` om bolaget har ett opublicerat utseendeutkast; andra versionen tar utkastet med i samma transaktion (`changeBrandingDraft` och `publishWithin` delar `txQuery`). Samma åtgärd används av portalen med partnersession, med samma kontroller.
4. *Förhandsvisning:* `GET /studio/api/admin/room-release?operatorId&roomId` i `STUDIO_ADMIN_ENDPOINTS` och listan över tillåtna läsfrågor; returnerar live och kandidat per område, `ready` med hinder och kod, alla revisioner och `previewToken`; ingen provider-I/O.
5. *Felkontrakt* `{error, code, step}` med fasta koder: 409 `studio_conflict` (package/project/administration/room_config_head), 409 `studio_release_preview_stale`, 409 `studio_room_choices_draft_pending`, 422 `studio_room_game_material_unavailable` + `materialReason`, 422 `studio_release_invalid`, 404 `studio_room_not_found`, 503 `studio_presentation_runtime_update_required`, 503 `studio_room_config_storage_missing` (kontroll med `to_regclass` innan något skrivs), 503 `studio_media_registry_unavailable`. Klienten försöker aldrig igen automatiskt.

**Därefter tas bort:** knapparna 1, 3, 5 flyttar till Avancerat eller försvinner (vila och placering ingår i full infångning: `dealerIdlePolicies` i `frozen-dealer-idle.mjs:156-161`, `composition` i `frozen-presentation-capture.mjs:57,81`); knapp 2 blir fält som publiceras med Publicera; "Granska publicering"/"Publicera granskat utkast" i Admins rumsläge tas bort (portalen behåller sin granskning); klippkartans "Rum och publicering" blir en statusrad "Johns Bet · PAOW Blackjack · Live v7 · 3 ändringar ej publicerade → Publicera i rummet"; texterna "publicera paketet igen och därefter spelinställningarna" ersätts med "Publicera i rummet". Rumslistan fryses i paketet (eller TERMINOLOGI skrivs om, avsnitt 10).

**Detta får inte gå sönder:** J08:s CAS och isolering (bolagslås, rumslås `room-game-publication.mjs:109-110`, CAS på head `:179-184`, förbud mot att ändra andra rums bindningar `:99-100`, 404 mellan bolag `room-game-config-api.mjs:46-52`); K05:s materialgrindar (samma `resolveNativeRoomGameMaterial`, samma `recordedSpeechForVideo`-kontroll, samma revisionskontroll av mediaposter, ingen reservdealer); beständighet över omstart (kvittot läses alltid ur `operator_packages` och `shared_table_configs`); portalens granskningsflöde; flera bolag (mallurvalet och provet "advanced republication" i `operator-package-api.test.mjs`).

## 8. Språk

Användarspråk; inga tekniska id:n eller tabeller byter namn.

| Används i dag | Målbild |
|---|---|
| rum, spelrum, spelutbud, room, table, bj, game-tables | **Spelbord** (beslutat 2026-10-28; äldre dokument säger rum) |
| bord som material | **Bordsgrafik** |
| mall, spelmall, gemensam mall, sammansättning, lane, composition | **Scenmall** (TERMINOLOGI: mall) |
| paketversion, publiceringsrevision | **Publicerad version** (teknisk revision under Detaljer) |
| spelbolag, bolag, operator, partner, company, operatör | **Bolag**; portalen heter **Partnerportalen** |
| forge, dealer-studio | **Skapa material** |
| speech, voice, probe, media-review, taldrift | **Röst och tal** |
| OpenClaw, ai/models, dealer-agent, operator-chat | **AI-agenter**, **Dialogtest** |
| Croupier Admin, Croupier-konto, N1-session, Dealerregister, Ny arbetsyta | **Scoutgaming Admin**, konto, inloggning, Dealers, (tas bort) |
| Nivå 1 / 2 / 3 i användartext | Admin / Partnerportalen / spelaren |

## 9. Leveransordning

Små PR:er, en sak i taget; docs, UI och server blandas inte. Varje steg har ett klart-kriterium som går att testa. Inga PR:er mergas av Admin-arkitekten: PR-nummer och head-SHA går till orkestratorn efter grön CI. Rena strängtester ersätts (AGENTS.md); prov för behörighet, isolering, sparning, samtidighet och spelregler behålls.

### Före frysningen av O02-kandidaten (nivå 1, inget runtime, inga publiceringskontrakt)

| PR | Innehåll | Filer | Klart när |
|---|---|---|---|
| **0 docs** | den här planen, kartan, skissen; gamla kartan raderad | `docs/plans/*`, `docs/NEXT-AGENT.md` (en rad) | mergad |
| **P1 död klientkod** | `components/project-conflict.tsx`, `video-metadata-fields.tsx` + `video-intake.module.css`, `selectCompositionLayer`, `useStudioSession().save/rescan`, läskontraktets sektioner `compositions/videos/rehearsal/probe`, `client/source-provenance.json`, `lib/control-flow.d.mts`, `lib/media-file-types.d.mts`, reservlänken `/control/library`, klippkartans felhänvisning till Kopplingar & användning | `apps/studio/components/**`, `apps/studio/client/admin/**`, `apps/studio/lib/admin-workspace-data.mjs` | konsumentanalys i PR:en (git grep över apps, packages, services, ops, tools, test); `studio`- och `admin`-sviterna gröna |
| **P2 ord** | menynamn = sidrubrik (Spelutbud, API & integrationer, Dealer & användning); "Dealerregister", "Ny arbetsyta", "Din N1-session", "Croupier Admin" enligt avsnitt 8; mallens fyra namn blir ett | klientkomponenter och `studio-login.tsx` | inga strängtester låser gamla ord; Jakob har sett skärmbilder |
| **P3 startsida** | neutral Scoutgaming-startsida utan Astrid-material (`jakob/par-web-start-wip`, 50 filer, −18,8 MiB), allowlistraderna strukna | `apps/web/**`, `tools/repo-limits-allowlist.json` | `apps/web`-testerna gröna; skärmbild till Jakob före merge |
| *(väntar på #477)* | Spelarkonton/Konton & åtkomst som två komponenter; Ekonomis dubbla läsning; dolda gruppen `tables` med actions tournament, pitboss, tier, room, game-lane(s) och de handlerlösa clip-*/gen-* | `studio-administration.tsx`, `connected-services.tsx`, `studio-admin-contract.mjs`, `studio-admin-data.mjs` | delar filer med #477; görs efter dess merge, före eller efter frysningen beroende på orkestratorn |

### Efter O03 (nivå 2 först)

| Steg | Innehåll | Filer | Klart när |
|---|---|---|---|
| **A nivå 2: meny och ärliga tomlägen** | Johns åtta menyval filtrerade på rollens behörigheter; Dealers, Spelare och Rapporter som vyer med ärliga tomlägen; Integration med status, maskerade nyckelnamn och kontakt; `DISCONNECTED`, `INTERNAL_LINKS`, döda förhandsvisningsgrenar bort; Kevin-djuplänkarna omdirigeras till rätt ny vy; serverkontroll av alla sex behörigheter som i dag saknar kontroll | `components/kevin-bo/**`, `lib/partner-data.mjs`, `lib/partner-session.mjs`, `packages/studio-access/server/partner-access-policy.mjs` | alla menyval nås av rätt roll och nekas av fel roll via meny **och** direktadress; inga påhittade värden; staging visad för Jakob och John |
| **B nivå 2: editorn** | flikarna Utseende, Dealer, Spelinställningar, Tillgänglighet, Historik; val filtrerade på tilldelningen; *Låst av Scoutgaming*; granskningen säger att utkastet är gemensamt per bolag och listar alla rum; bordsfärg bort ur formuläret | `components/partner-appearance.tsx`, editorkomponenten från Admin | bolaget kan bara välja det som finns i paketet, servern avvisar annat, granskningen visar rätt påverkan |
| **C partner-API** | läsa tilldelning, byta dealer inom tilldelning, spelinställningar, pausa eget rum, begära material (journalpost), nyckelstatus och begäran om rotation; varje åtgärd kontrollerar bolag, resurs, åtgärd och revision | `apps/studio/lib/partner-*.mjs`, `packages/operators/**` | acceptanslistan i 5.6 passerar mot staging |
| **D en publicering** | avsnitt 7: `publish-room`, `room-release`, felkontrakt, kontroll av 009-lagringen; sedan tas de åtta knapparna och PAOW-knappen bort; rumslistan fryses i paketet | `operator-package-api.mjs`, ny `lib/room-release.mjs`, `studio-admin-contract.mjs`, `studio-access-policy.mjs`, `studio-admin-api.mjs`, `registered-studio.tsx`, `room-game-config.tsx`, `partner-appearance.tsx` | en publicering ökar versionen med exakt 1; inaktuell förhandsvisning ger 409 utan skrivning; saknad 009 ger 503; grannrummet oförändrat; bolag B får 404; `/game` visar `data-game-package-revision = N+1`; J08-harnessen återanvänd i staging |
| **E nivå 1: meny och nav** | åtta menyval; Dealers blir nav med flikarna i 4.2; Bolag blir nav med flikarna i 4.4; `/admin/rooms` delas; Scenmallar egen instans med **Exportera landningsmall** (4.5); `viewPaths` och omdirigeringar rättade | `packages/navigation/admin-navigation.mjs`, `admin-workspace-routes.mjs`, `client/admin/entry.tsx`, `registered-studio.tsx`, `dealer-directory.tsx`, `connected-clip-map.tsx`, `workspace-tools.tsx` | varje uppgift nås från menyn utan djuplänk; gamla djuplänkar landar rätt med bibehållen bolag, rum, dealer och revision; staging visad för Jakob |
| **F spelare knyts till bolag** | bolagsfält på `players`, inloggningsnamn unika per bolag, bolaget i sessionen, saldo per bolag, API-nycklar per bolag, bolag i varje skapväg, bolagskontroll i `/game` och delade bordets kommando/socket, lobby och `/player-login` med bolagskontext; `players/create` och `GET players` med bolag; Spelare-vyerna i båda nivåerna får data | `ops/neon-game/*.sql` (DDL, Jakob applicerar), `services/game/**`, `packages/storage/**`, Admin- och partner-API | schemamigrering före kravhöjning; en spelare hos A kan inte spela i B:s rum; negativa prov per väg |
| **G städning** | dubbla livscykler (Dealers mot `panel=dealer`), fem uppladdningsingångar till en, `operator-create-demo` och `sg-test`, `nora`, `remote-ui`, döda Forge-exporter, mappnamnet `kevin-bo`, `lissabon_*`-tabellerna (011), `bo_*`-rester | per område | inga medier, revisioner eller tabeller raderas som bieffekt av UI-städning |
| **H verktygskedja och struktur** | React, TypeScript och byggen mellan `apps/studio` och `apps/studio/client`; "ett repo, en sajt"; Node- och Next-versioner | egen plan efter O03 (orkestratorn) | ren klon, låst installation, båda frontendbyggena |
| **Tal** | dealer-generisk talkedja (text → röst → läppsynk) konfigurerad per dealer via registret; Dragan och Astrid som exempel, inte specialfall; Röst och tal får livemärke och "Använd i spelet" | egen aktivitet (Jakobs beslut 2026-10-28) | – |

Efter att Admin-kedjan (#519, #512, #532, #518) är mergad:

- F16: Johns Bets bordsgrafik i produktionen (f00be01d) är ungefär dubbelt så bred som PAOW:s räckvidd (boxarna x 490–1 495 mot landningarna x 740–1 238 i en 3 107 px bild), därför hamnar markörerna fel. Åtgärd: byt till en bordsgrafik ritad efter PAOW:s landningar (bordsmallens 'Johns Bet · Grön filt', 1920×1404, eller Skapa med AI › Bordsgrafik i Johns Bets scenmall) och sätt scenmallens placering till dator {width 0.5, x 0, y 0.35}, mobil {width 1.58, x 0, y 0.35}. Jakob publicerar i produktionen.

## 10. Beslut

Tagna 2026-10-28 (Jakob gav Admin-arkitekten fria händer för ordlistan och godkände namn, dotfiler och godkännande):

1. **Spelbord** är ordet för `room` i menyer, rubriker och ny text; bordslagret heter **bordsgrafik**. TERMINOLOGI är omskriven.
2. **Spelbordets namn och läge fryses i paketet** i steg D, så att spelet bara läser paketet. Tills dess beskriver TERMINOLOGI undantaget ärligt.
3. **Scoutgaming Admin** ersätter "Croupier Admin" (P2).
4. **Dotfil-städningen** görs som egen PR.
5. **Dealer-godkännande**: ett enkelt statusfält "godkänd" i projektet (inget schema), krav för tilldelning. Bolaget tilldelas en **uppsättning** dealers, bordsgrafik, bakgrunder och insatsprofiler att välja bland, aldrig bara en.
6. **Astrid-kortet "Legacyreferens"** i Dealers tas bort i ren start tillsammans med Astrid som dealer.

Kvar: **nya dealers filmas eller genereras** (avgör Skapa materials framtid); efter O03.

## 11. Avvikelser mot Jakobs paket

Paketet skrevs utan repotillgång; det här har rättats mot koden: `/admin/events`, `/admin/admin/operators` och fem testimporterade komponenter är redan borta; Talgranskning tas bort i #477; `lab/lib/*` finns inte (koden ligger i `apps/studio/lib`); `operator-membership` och `/api/partner/team` skriver samma tabell (verifierat); de tolv behörigheterna heter som i 5.4, inte som paketets förslag; `/play/blackjack` är en omdirigering; `A:room-state` och `A:operator-package` finns med samma form; händelseträdet är ingen fråga längre; nativebordet ingår inte i målbilden; "Operatör/Operatörsportal" i paketet heter här Bolag/Partnerportalen enligt TERMINOLOGI; skissen är uppdaterad så att Dealers-navet har fliken Scen och händelseträdet är borta.

## 12. Funktionsregister

> Jakobs beställning 28 oktober 2026: ett register över vilka namn som används till vad och var uppgifterna hämtas. En rad per *funktion* (inte per sida), nivå 1 och 2, verifierad mot kartan och faktabladet på `main` 3415c310ce. **Beslut** är Jakobs (skiss 2 godkänd 28 oktober); **Datakälla** är det UI:t läser eller skriver i dag. Byggs på grenarna `jakob/par-admin-ny-n1` (nivå 1), `jakob/par-admin-ny-n2` (nivå 2) och `jakob/par-admin-ny-demo` (demo-byggaren) som draft-PR:er; inget mergas före O03. Samma tabell visas förkortad under Hjälp › *Var uppgifterna kommer ifrån*.

Beslutsord: **behåll** (samma komponent, ny plats), **flytta**, **slå ihop**, **ta bort** (med konsumentbevis), **ny** (byggs nu, bara UI på befintliga API:er), **efter O03** (kräver ny data, runtime eller nytt API; väntar).

### Nivå 1: Admin

| # | Funktion | Namn i nya Admin | Var i dag | Beslut | Ny plats | Datakälla | Skäl, bevis |
|---|---|---|---|---|---|---|---|
| 1 | Det som väntar | Översikt › Väntar på dig | `/admin` (`admin-home.tsx`, tre länkar) | ny | `/admin` | `/admin/_data/catalog`, `/studio/api/videos` | målbild 4.1; inga genvägskort utan uppgift |
| 2 | Demo åt ett bolag | Skapa demo | finns bara som launch-knapp i Integrationer (`studio-administration.tsx:567-587`) | ny | `/admin/demo` | catalog; `A:apikeys/launch` (Render) | Jakob 28 okt; orkestratorn: operatör och rum i länken, inga fixturbolag |
| 3 | Dealerlista, skapa dealer | Dealers | `/admin/dealers` (`dealer-directory.tsx:17,45-54`) | behåll | `/admin/dealers` | K-doc `dealers[]`, `lines[]` | – |
| 4 | Klippkartan: fack, standard, varianter, körregler | Dealers › Klippkarta | `/admin/clips` (`connected-clip-map.tsx`, `connected-clip-card.tsx`, `studio-policy-panel.tsx`) | flytta (dealerväljaren blir navets dealer) | `/admin/dealers/<id>?flik=klipp` | K-load; K-doc `lines[]`, `idlePolicy`, `dealerIdlePolicies`, `mediaPolicy`; `media_records` | Jakob: kartan behålls; målbild 4.2 |
| 5 | Lägg till klipp (uppladdning) | Lägg till klipp | `/admin/clips?panel=intake` (`clip-intake-panel.tsx`) | slå ihop med 6 | Klippkarta › Lägg till klipp | K-upload, K-classify, `POST import-proposal` | kartan: fem uppladdningsingångar |
| 6 | Importassistent (mapp, skapa dealer) | steg 2 i Lägg till klipp | `?tool=import` (`dealer-import-assistant.tsx`) | slå ihop | samma | `dealer-import-api.mjs`; förslag via `OPENAI_API_KEY` (`dealer-import-model.mjs:32`) | dubblett uppladdning och skapa dealer |
| 7 | Skapa material (Forge) | Lägg till klipp › Generera (avstängt) | `/admin/dealer-studio?view=generate` (`dealer-forge-page.tsx`) | flytta, orörd | samma | `/studio/api/forge/*`; `forge_dealers`, `forge_jobs` | avstängd utan `lissabon-stream-lane`; beslut filmas/genereras kvar |
| 8 | Roulettekort (referens, vila, kulsläpp) | Klippkarta | `/admin/clips` (`roulette-*-editor.tsx`) | behåll | Klippkarta | K-doc `dealers[].rouletteStart/rouletteIdle` | – |
| 9 | Röst & tal: repliker, tagningar, talfack | Dealers › Röst och tal | `/admin/clips?panel=room` (`studio-speech-panel.tsx`) | flytta | `?flik=tal` | K-doc `speechProfile`, `lines[]`; `POST videos/speech-review`; `media_records.recordedSpeech` | talkedjan pausad; byggsteget (`speech-build`) kan inte lyckas och visas inte som fungerande |
| 10 | Svarsbibliotek | Röst och tal › Svarsbibliotek | `/admin/replies` (`control-replies-page.tsx`) | flytta | `?flik=tal` | `GET/PATCH /studio/api/replies` → `speech_reply_records` | – |
| 11 | Dialogtest | Röst och tal › Dialogtest | `/admin/dealer-agent` (`gateway-panel.tsx`) | flytta | `?flik=tal&verktyg=dialog` | `POST /api/chat` | fungerar i molnet: oklart |
| 12 | Taldrift | Röst och tal › Taldrift | `/admin/drift?tab=speech` (`moving-drift-controls.tsx`) | flytta | `?flik=tal` | `A:moving-drift` → `moving_drift_control` | – |
| 13 | Tal vid inaktivitet | Röst och tal › Tal vid inaktivitet (Av / klipp efter N min / AI-tal) | bara Astrid (`probe-editor.tsx`, `probePolicy`) | slå ihop → generisk; tills talkedjan "Inte anslutet" | `?flik=tal` | K-doc `probePolicy` | orkestratorn 1c; Astrid bort |
| 14 | Talgranskning | – | `/admin/media-review` | ta bort (klart, #477) | – | – | – |
| 15 | Dealerns landningar (filmad profil) | Dealers › Landningar | ingen vy; profilen i kod (`filmed-profiles/registry.mjs`: dragan, paow) | ny läsvy; Mät landningar och Exportera landningsmall efter O03 | `?flik=landningar` | filmad profil (kod) → registret efter O03 | generaliseringsspåret; målbild 4.5 |
| 16 | Används av (dealer) | Dealers › Används av | `/admin/structure` (`resource-connections.tsx`) | flytta (filtrerad läsvy) | `?flik=anvands` | catalog, project, videos | – |
| 17 | Dealerlivscykel i Dealers | Dealers › Inställningar | `dealer-directory.tsx:76-90` | slå ihop med 18 | `?flik=installningar` | K-life `/studio/api/dealers/*` | kartan: tre knappar för samma livscykel |
| 18 | Dealerlivscykel i klippkartan (Dealer & användning, Klipp & arkiv) | samma | `/admin/clips?panel=dealer` (`studio-lifecycle-panel.tsx`) | slå ihop → en | samma | K-life, K-doc `dealerSets` | dubblett |
| 19 | Radera klipp från kortet | Klippkarta › åtgärdsmeny | `clip-delete-action.tsx` | behåll | Klippkarta | K-life `videos/*` | – |
| 20 | Dealergodkännande | Inställningar › Godkännande | finns inte (registret: `unreviewed`; Jakobs ok i kvitton) | ny checklista (läsvy); statusfält godkänd i projektet när Jakob säger till | `?flik=installningar` | doc.project | målbild 10.5; orkestratorn 1b |
| 21 | Astrid Legacyreferens | – | `dealer-directory.tsx:127` | ta bort | – | – | ren start |
| 22 | Sceneditor: placering, lager, dealerval, publicera placering | Scenmallar | `/admin/scenes` (`studio-composition-panel.tsx`, `blackjack-scene-placement-editor.tsx`) | behåll, egen instans | `/admin/scenes?tab=mallar` | K-doc `lanes[]`; `A:operator-package publish-scene-layout` | målbild 4.6; ett ord: Scenmall |
| 23 | Exportera landningsmall | Scenmallar › Landningsmall | – | efter O03 | samma | filmad profil | målbild 4.5 |
| 24 | Bord & bakgrunder (uppladdning) | Bakgrunder, Bordsgrafik | `/admin/assets` (`registered-material-library.tsx`) | behåll, ett ställe | `/admin/scenes?tab=bakgrunder` och `?tab=bordsgrafik` | K-layer; `layerAssets`; Blob | dubbel montering i Sceneditorn bort |
| 25 | Materialpapperskorg | Papperskorg | `layer-asset-manager.tsx` | behåll | `?tab=papperskorg` | `A:material-trash(-check)` | – |
| 26 | Bordsfärg | – | `partner-appearance.tsx:243`, `branding.color` | ta bort ur UI | – | sätter bara `data-table-color` (`player-choices.mjs:111-115`) | arkitekten och orkestratorn: kosmetisk |
| 27 | Uppspelningsregler för bakgrund och bord | Scenmallar › Automatik och uppspelning | `studio-composition-panel` | behåll | `/admin/scenes/<id>` | `lanes[].backgroundPlayback`, `tablePlayback` | – |
| 28 | Bolagslista, skapa bolag | Bolag | `/admin/companies` (`control-operator-directory.tsx`) | behåll; läsningen av hela projektet (`workspace/companies`) bort | `/admin/companies?tab=bolag` | `A:operator-create`; `operators` | kartan: onödig läsning |
| 29 | Tilldelning (Spelmallar för bolaget) | Bolag › Tilldelning | `/admin/rooms` (`registered-studio.tsx:271-289`) | flytta nu; hela uppsättningen (dealers, material, insatsprofiler) efter O03 | `/admin/companies/<slug>?flik=tilldelning` | `A:operator-package {lanes}` → `operator_packages` | Jakobs lanepaket; målbild 5.3 |
| 30 | Bolagets val (upplåsningar) | Tilldelning › Bolaget får välja | finns inte (`operatorAdjustable` per mall) | efter O03 (`allow` i paketet) | samma | paketets `branding` | målbild 4.3 |
| 31 | Spelbordslista, alla bolag | Alla spelbord | `/admin/rooms` (`operator-game-board.tsx`) | flytta | `/admin/companies?tab=spelbord` | catalog | – |
| 32 | Nytt spelbord | Nytt spelbord | `presentation-room-create.tsx` | behåll | samma | `A:presentation-room` | – |
| 33 | Spelbordets utseende (admin-läge) | Spelbord › Utseende | `registered-studio.tsx:261` via `partner-appearance` | behåll | `/admin/rooms/<id>?flik=utseende` | `/studio/api/partner/branding` (ett utkast per bolag) | dubblett med portalen, bokförd |
| 34 | Spelinställningar | Spelbord › Spelinställningar | `room-game-config.tsx` | behåll | `?flik=spel` | `A:room-game-config` → `roomGameConfigs`, `shared_table_configs` | – |
| 35 | Pausa/Öppna | Spelbord › Tillgänglighet (gäller direkt) | `control-resource-lifecycle.tsx:122-146` | behåll | `?flik=tillganglighet` | `A:room-state` → `rooms[].state` (levande) | L3 |
| 36 | Rum till papperskorg, återställ | Spelbord › åtgärdsmeny | `A:room-lifecycle` | behåll | samma | administration + pkg+1 | – |
| 37 | Publicera PAOWs viloklipp | Publicera (tills steg D) | `registered-studio.tsx:257` | ta bort i steg D | `/admin/rooms/<id>` | `A:operator-package refresh-dealer-idle` | målbild 4.3 |
| 38 | Åtta publiceringsknappar | en Publicera | kartan: Knappar som höjer paketrevisionen | slå ihop i steg D (ny action) | samma | `A:operator-package publish-room` (efter O03) | målbild 7 |
| 39 | Bolagets team | Bolag › Team | `/admin/companies` | flytta | `?flik=team` | `A:operator-membership`, `A:operator-role` | samma tabell som portalen |
| 40 | Journal | Bolag › Journal | `/admin/companies` | flytta | `?flik=journal` | `GET /studio/api/partner/journal` → `operator_audit_events` | – |
| 41 | Bolagets livscykel | Bolag › Inställningar | `control-resource-lifecycle` kind operator | flytta | `?flik=installningar` | `A:operator-lifecycle` | – |
| 42 | API-nycklar, launch, credit | System › Integration (tills steg F) | `/admin/admin/api` | flytta; per bolag efter steg F | `/admin/system?flik=integration` | `A:apikeys/*` → `api_keys` (saknar bolag) | steg F |
| 43 | Spelarkonton | System › Spelarkonton | `/admin/players` (`accounts-pages.tsx`, CSS-dold delning) | flytta; egen komponent; per bolag efter steg F | `/admin/system?flik=spelare` | `A:players`, `players/*` → `croupier_game.players` | dubblett med Konton & åtkomst |
| 44 | Ekonomi (transaktioner) | System › Spelarkonton › Transaktioner | `/admin/ekonomi` (`connected-economy.tsx`) | slå ihop; etiketter för payout, refill, consume | samma | `A:transactions` | #500 gjorde en läsning |
| 45 | Förhandsvisa portalen som läsare | Bolag › knapp | finns inte | ny (länk; serverbegränsad roll efter O03) | `/admin/companies/<slug>` | – | målbild 4.4 |
| 46 | Drift: status, skor, prov | System › Drift | `/admin/drift?tab=status` | flytta | `/admin/system?flik=drift` | `A:overview`, `A:shoes`, `A:shared-table-proof` | – |
| 47 | OpenClaw agentmodeller | System › AI-agenter | `/admin/ai/models` (`openclaw-workspace.tsx`) | flytta, byter namn | `?flik=agenter` | `GET/PATCH /studio/api/openclaw/admin` → Director | – |
| 48 | OpenAI-nyckelns status | System › AI-agenter › OpenAI | nyckeln finns på Vercel, läses av `dealer-import-model.mjs:32` | ny statusvisning (bara finns/finns inte) | `?flik=agenter` | `process.env.OPENAI_API_KEY` | Jakob 28 okt; AI-hjälp i nivå 2 efter O03 |
| 49 | Scoutgamings personal | System › Scoutgamings personal | `/admin/admin/accounts` | flytta; egen komponent | `?flik=personal` | `A:users/*` → `croupier_auth.users` | – |
| 50 | Kopplingar & användning | System › Beroenden (+ Används av på objekten) | `/admin/structure` | flytta | `?flik=beroenden` | catalog, project, videos | – |
| 51 | Intern lobby | System › Intern lobby | `/admin/lobby` (ingen länk) | länk | `?flik=lobby` | `/admin/_data/catalog` | – |
| 52 | Hjälp och datakällor | Hjälp | `/admin/guide` | behåll + tabellen Var uppgifterna kommer ifrån | `/admin/guide` | statisk | Jakobs register |
| 53 | Dold grupp `tables`, actions utan handler | – | `studio-administration.tsx:466-508` (UI borta i #500) | ta bort ur kontraktet efter orkestratorns ok | – | – | ingen anropare (kartan) |
| 54 | tournament, pitboss, operator-create-demo | – | `studio-admin-contract.mjs` | ta bort efter orkestratorns ok | – | – | ingen anropare |
| 55 | Inloggning | Logga in | `/admin/login` | behåll | – | `/studio/api/auth` | #497 |
| 67 | Skapa bakgrund med AI | Scenmallar och material › Bakgrunder › Skapa med AI | knappen bredvid uppladdningen (`registered-material-library.tsx`), dialogen `ai-background-dialog.tsx` i kitet | ny | Scenmallar och material › Bakgrunder | `OPENAI_API_KEY` och `CROUPIER_AI_IMAGE_ENABLED=1` → `POST /studio/api/layer-assets/generate` (1–3 förslag, sparar inget) → befintlig layer-asset-uppladdning | Jakob 28 okt; godkännandet är människan (Använd), sedan befintlig grind: scenmall och publicering |
| 68 | Skapa bordsgrafik med AI | Bordsgrafik › Skapa med AI | samma knapp och dialog, `role="table"` | ny | Scenmallar och material › Bordsgrafik | samma väg; servern ritar insatsboxarna ur den filmade profilen och scenmallens placering (`filmed-table-template.mjs`); etiketten bär dealer och placeringshash; scenmallens bordsval, Tilldelningens publicering (förkontroll i klienten) och servern (422 `ai_table_misfit`) spärrar fel mall | bara Blackjack-dealers med filmad profil; målbild 4.5 |

### Nivå 2: Partnerportalen

| # | Funktion | Namn i nya portalen | Var i dag | Beslut | Ny plats | Datakälla | Skäl, bevis |
|---|---|---|---|---|---|---|---|
| 56 | Översikt | Översikt (var ni är publicerade, rundor, väntar, er tilldelning) | `/partner/<bolag>` (`overview.jsx`; `playersToday/roundsToday` hårdkodat 0) | byggs om | samma | snapshot (`partner-data.mjs:148`) + läsande aggregat ur `shared_table_audit` | orkestratorn 4 |
| 57 | Spelrum och utseende | Spelbord (Utseende, Dealer, Spelinställningar, Tillgänglighet, Historik) | `/partner/<bolag>/rooms` (`rooms.jsx`, `partner-appearance.tsx`) | behåll som flikar; låsta val visas | `/partner/<bolag>/rooms(/<rum>)` | `GET/POST /studio/api/partner/branding` | spelinställningar och paus saknas i partner-API:t → läsvy tills steg C |
| 58 | Dealers (portal) | Spelbord › Dealer | finns inte | ingen egen sida | samma | snapshot `registeredDealers` | skiss 2 |
| 59 | Spelare (portal) | Spelare | finns inte (`PD:142` tom) | tomläge; data efter steg F | `/players` | – | steg F |
| 60 | Rapporter | Ekonomi | finns inte (`PD:144` tom) | ny: rundor, insatser, utbetalt, netto per rum | `/reports` | `shared_table_audit` (wallet.settlement), journal | orkestratorn 4; per spelare efter steg F |
| 61 | Team | Team | `/partner/<bolag>/team` (`team.jsx`) | behåll | `/team` | `team`, `journal` | – |
| 62 | Integration | Integration | `integration.jsx` (bara text) | byggs om ärligt | `/integration` | snapshot; nycklar efter steg F | – |
| 63 | Begär material, hjälp | Hjälp och kontakt | finns inte | ny; begäran som journalpost i steg C | `/help` | mailto tills steg C | målbild 5.5 |
| 64 | Serverkontroll av sex behörigheter | – | bara overview.read, team.*, presentations.configure kontrolleras (`PS:466`) | ny kontroll per vy | `partner-data.mjs`, `partner-session.mjs` | `partner-access-policy.mjs` | kartan: Sex av tolv |
| 65 | Kevins vy-id:n, DESTINATIONS, INTERNAL_LINKS, DEFAULT_ROLES, source-provenance | – | `kevin-bo/navigation.mjs`, `team.jsx` | ta bort | – | – | död kod (kartan: Döda vägar) |
| 66 | Operatörspersonal, Intern administratör, Partnerportal, Spelbolag, Partners | ordlistans ord | `partner-copy.mjs` | byt ord | – | – | TERMINOLOGI |
| 69 | Önska bakgrund | Hjälp och kontakt › Begär material | finns inte | ny; bara en förfrågan till Scoutgaming, aldrig en tillgång i bolagets paket | `/help` | via Begär material (rad 63) tills steg C | AI-bilder skapas bara av Scoutgamings personal (rad 67) och når bolaget via tilldelning |
| 70 | Bolagets eget material | Bakgrunder och bordsgrafik som bolaget laddar upp eller skapar med AI; Scoutgaming godkänner varje material i Admin | finns inte | PR 1 datamodell och sammanfogning vid publicering (`jakob/par-admin-ny-egna-material`); 021 väntar på Jakobs ja; portalen (PR 2) och godkännandet i Admin (PR 3) byggs efter | portalen och Admin › Bolag | `operator_materials`, `operator_material_policies`, `operator_ai_attempts` (021); läggs in i bolagets eget frysta paket av alla fyra publicerare (`operator-material-merge.mjs`) | Jakobs mandat 28 okt: egen tabell (arkitektur C); bara bilder; bordsgrafik bara via dealerns landningsmall; AI-tak 0 tills Scoutgaming slår på |
