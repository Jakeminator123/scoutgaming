# Scoutgaming: aktuell källa, drift och leverans

Statusförtydligad 11 oktober 2026. Detta är den enda migrationschecklistan. Daterade kvitton nedan avser respektive leverans; aktuell Studio-/paket-/portalöverlämning finns i [JOHN-HANDOFF.md](JOHN-HANDOFF.md). T2–T4 är fortfarande öppna där full acceptans saknas, även om flera delsteg nu är levererade.
Äldre checkpoints och avslutade delstegs detaljer finns i
[fryst historik på 4ed55a56](https://github.com/Jakeminator123/scoutgaming/blob/4ed55a5624a28cdd82d8a0c252ead7a24ef3165e/docs/CLOUD-MIGRATION.md).
Privata kvitton, FAIL-historik, journaler och backups bevaras på sina platser.
Aktuell terminologi och flödeskarta finns i [systembeskrivningen](LOCAL-PRESENTATION-RUNTIME.md).
Senare kodversion uppgraderar inte ett äldre acceptansprov automatiskt.

## Aktuellt testmandat och N2-snabbkontroll, 11 oktober 2026

Jakobs standardtestbudget är **högst 5 USD totalt per avgränsad testomgång**. Större budget kräver nytt mandat; historisk kostnad och tekniska budgetspärrar återställs inte. Punkt 1 (ny läppsynksacceptans) hoppas över på Jakobs begäran; han verifierar PAOW i runtime.

86 riktade N2-tester passerade på `2fb18004` med högst fyra workers och syntetiska minnes-/SQLite-fixturer. Begränsade/återkallade roller, bolagsgränser och revisionsskydd ingår. Riktig PostgreSQL-konkurrens och komplett acceptans med separata konto-/operatörsdatabaser är fortfarande **ej verifierade**; JN2-A/B/C stängs inte av detta kvitto. Inga produktionsskrivningar eller betalda provideranrop. Detaljer och testfiler finns i aktuell handoff.
## Tre åtkomstnivåer på www.scoutgaming.tech

Apex `scoutgaming.tech` är en 308 till www. Vercelprojektet heter `scoutgaming`.
Spelmotorn ligger kvar på Render-tjänsten `croupier-v2`. `/studio` är Next.js-basePath
för labb-servicen, inte en fjärde produkt och inte namnet i gränssnittet.
`/lissabon`, `/lab`, `/labb` och `/bo` är avvecklade alias. Flaggningen
`lissabon-stream-lane` är inte en produktadress.

### Ett gemensamt Vercelprojekt — 6 oktober 2026

Efter uttrycklig samordning har Kevin-chatten släppt alla anspråk. Services i
rotens `vercel.json` samlar webb (`apps/croupier-frontend`) och labb (`lab`,
basePath `/studio`) i ett bygge/projekt utan att slå ihop deras Next-versioner.
Aktiverad `CROUPIER_VERCEL_UNIFIED_UI` flyttar den befintliga exakta ingressgränsen
till labb-servicen när Services skickar dit dokument/API direkt. Render behåller spel/live.
T2 är påbörjad, inte klar. Levererat till 11 oktober: 005-lagring, partner_session, scoped snapshot, N1:s Bolag & team samt publicerade paket/spelrum. Kvar är komplett mottagaraktivering/N2-sparprov, åtkomstjournal för operatörsskrivningar och spelare/transaktioner/rapporter. T3 och T4 behåller sina öppna acceptanspunkter; paketpublicering och bolagslobby är inte längre saknade funktioner.
Tio riktade routingtester och Lab-typkontroll/produktionsbygge är lokalt gröna.
Repo och aktivt Vercelprojekt heter nu `scoutgaming`. Repo-ID `1380630440` och
tidigare Studio-ID `prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD` är bevarade, inklusive
Neon/Blob/Resend. Kod `cef3af5c` är READY på `dpl_J4uTPNKzhaBH1XnNYETX266UfKfV`;
Senaste avslutade dokumentleverans `4ed55a56` är READY på
`dpl_3WvxoXqoraAj3WPBy2zG3pzhQipP`, CI `37451320053` har tre success och fullhook PASS. www, rot, login, spelgenvägar,
API-spärrar och statiska filer är läsande verifierade mot den leveransen.
8 oktober 2026 är Vercel-projektet `scoutgaming` (web och studio, båda services) deployat från `main`: CI grön på `0019df59` och `7445b5a5`. Inget nytt deployment-id är avläst i den här filen. Kevin-chatten har
bekräftat sin befintliga adminsession. Kevins importerade backoffice
(`lab/components/kevin-bo`) på `/partner` har två lägen: intern fixturförhandsvisning och scoped operatörsdata. Det är inte kontrollpanelen.
Båda webbdelarna använder `fra1`; Git-autobyggen från main är på igen.
Den gamla GitHub-adressen och gamla frontend-adressen vidarebefordras.
Det domänlösa frontendprojektet sparas som `scoutgaming-legacy-frontend`, med
autobyggen och domäntilldelning avstängda; isolerade QA-projekt/data bevaras.

Jakob har godkänt överföringen av Kevins backoffice och följande indelning.
Det gäller inloggning och åtkomst på samma sajt, inte separata kodplattformar:

| Nivå | Yta | Behörighet i målbilden |
| --- | --- | --- |
| 1 | `/control` | Intern personal. Verktyg samlas under `/control/clips`, `/control/administration`, `/control/videos`, `/control/openclaw`, `/control/activity`, `/control/guide`, `/control/zones`, `/control/events`, `/control/preview`, `/control/probe`. `/control/tree` och `/control/operator-chat` omdirigerar. |
| 2 | `/partner`, `/partner/login`, `/partner/{operatorSlug}` | Operatör (Unibet m.fl.). PR #12 implementerar riktiga partners även med samma N1-adminlogin; produktionsacceptans återstår. Operatör loggar in via `/partner/login` med `partner_session` och scoped snapshot (partner-API:t svarade 503 i produktion 7–8 okt tills `e97f32df`). Bolag, roller och medlemskap skapas under Administration → Bolag & team på `/control/lanes?tab=companies`; ny e-post får aktiveringslänk. Bolagets utseende (`branding`, bordsfärg) läses och skrivs inom lanen av `presentations.configure`. Spelare, transaktioner och rapporter är inte anslutna (N2.4). T2 är påbörjad, inte klar. |
| 3 | `/play`, `/play/profil`, `/play/historik`, `/play/blackjack` | Spelare. Spellobby, egen profil (namn, saldo, valuta) och egen historik finns som sidor. Profilen kan redigeras (namn och språk) när `006-player-profile.sql` körts mot spel-Neon. Lobbyn visar publicerade bolag och deras verkliga rum. Allmän `/play/blackjack` går till lobbyn; enbart operator går till bolagets lobby. Explicit rumslänk begränsar dealer och miljö till paketet. Renders direkta spelväg behålls. Historiksidan anropar `POST /api/history`. T4 är öppen. |

Samma identitetsresolver ska användas; URL eller ett menyval ger aldrig en roll.
Interna medarbetare har tilldelade rättigheter, och ett spelarkonto får inte
personalåtkomst. `/studio` är labbets basePath. Avvecklade alias är inte
produktadresser. Giltiga signerade direktstarter behåller sin serverkontroll.

- [x] **T1. Överförd och uppdelad intern förhandsvisning.** Redigerbar källa från
  GitLab `codex/john-final-backoffice` på `7dee0901c75b7470c16a178079d5a5ebe4f11b9f`
  anpassas till befintlig React/Studio-runtime. Partnerdelen saknar Dealer archive,
  Rooms legacy, Voice lines, Dealing clips, Game media, Action tree och Generations;
  dessa nås endast genom den interna ytan. Delade vyer skiljer godkända val från
  intern produktion. Samtliga 24 ursprungliga destinationer ska redovisas, med
  fungerande navigation/direktlänkar och tydlig status för oanslutna funktioner.
  Första etappen är enbart för befintligt inloggad intern admin med två isolerade
  exempeloperatörer. Detta inför inte kundinloggning eller en livekundanslutning.
  Det gäller T1:s etapp. Operatörsinloggning är påbörjad i T2, inte klar.
  Verifierat lokalt 6 oktober: alla 24 vyer öppnade i webbläsare, rätt team efter
  operatörsbyte/omladdning, lokala designutkast och stängning vid administratörsbyte
  respektive återkallad session. 24 riktade integrationstester samt frontend- och
  Studio-byggen passerar. Publicerad kod `5524b968` är provad med befintlig intern
  adminsession: båda ytorna, menybyten, operatörsbyte och direktlänkar fungerar.
  Oinloggade besök går till login; API ger 401. Riktig kundinloggning ligger i T2.
- [ ] **T2. Verkliga tre inloggningsklasser och organisationsmedlemskap.** Påbörjad, inte klar. Levererat: migration `005-operators.sql`, `partner_session`, scoped snapshot, N1:s Bolag & team och paketpublicering med verkliga spelrum. Kvar: slutverifierad mottagaraktivering/N2-sparning, åtkomstjournal för operatörsskrivningar, spelardata, transaktioner och rapporter. Behåll
  dagens kollisionssäkra credentialresolver, inför uttrycklig `partner`-klass och
  separat partner-session med färsk identitets-, roll-, auth-epoch- och
  medlemskapskontroll. Inga automatiska reader/staff-uppgraderingar. Nivå 1
  administrerar operatörer och personal; nivå 2 delegerar endast tillåtna roller
  inom sin organisation. Isolerade tester ska bevisa aktivering, login, spärr,
  återkallelse och nekade direkta anrop mellan två organisationer.
  Migration `005-operators.sql` (7 oktober) lägger till `operators`,
  `operator_roles`, `operator_memberships` och `operator_packages` i Studio-schemat.
  Ändra inte den checksumfrysta `product-schema.sql` eller tidigare migrationsledger.
  Native runtime kräver nu exakt migration 001–005: en Neon-databas där 005 inte
  är applicerad svarar `unavailable` tills migrationen körts. Kör den granskade
  migrationen mot produktions-Neon innan koden deployas, aldrig tvärtom.
  Ordning vid ny Studio-migration:
  1. PR mot main.
  2. CI kör readiness mot produktionsledgern och blir röd om migrationen saknas.
  3. Operatör kör `node tools/check-migration-readiness.mjs --apply` med CROUPIER_MIGRATION_CONFIRM=apply-pending från en terminal med produktionsnyckeln.
  4. Merga PR, Vercel bygger.
  7 oktober 2026 pushades migration 005 till main innan den körts mot produktions-Neon; Vercel byggde inom tre minuter och varje /control-sida svarade att labbet inte kunde läsas.
  Åtkomstjournal för operatörsskrivningar saknas; `audit_events` tar bara dokument/media.
  Delsteg 6 oktober: `web/partner-access-policy.mjs` har explicita
  operatörsrättigheter, scope-/organisationsbindning och begränsad rolltilldelning.
  Både aktuell och ny målroll måste vara uttryckligt delegerbara av nivå 1;
  egen rolländring och ändring av överordnad personal nekas. 22 riktade tester
  passerar inklusive befintlig credentialresolver/Studio-policy. Oberoende review
  är avklarad. `lab/lib/partner-data.mjs` anropar `allowsPartnerResource` för den
  scopade snapshoten. Partner-login, medlemslagring och `partner_session` finns.
  Isolerat bevis för spärr, återkallelse, nekade anrop mellan två organisationer
  och skydd för sista administratören återstår. Spärren mot att ta bort sista
  operatörsadmin finns i lagret sedan 7 oktober (`186c6bc4`), provad mot minnesfixtur;
  isolerat bevis mot riktig Postgres saknas. T2 är påbörjad, inte klar;
  rena policytester är inte acceptans för riktiga konton.
  Förtydligande 6 oktober: intern adminpersonal ska ha åtkomst till alla tre
  nivåer med samma konto. Befintlig intern adminauktorisering skyddar redan
  nivå 2:s förhandsvisning. Före PR #12 valde `/partner` exempelvyn utan
  `partner_session`. PR #12 ersätter normal demoväg med lagrade bolag, även
  för färskt auktoriserad N1-admin med samma login; JN2-A nedan kräver fortfarande
  produktionsacceptans. Kundpersonal når bara egna aktiva medlemskap. Val av
  riktiga operatörer och paketpublicering är redan levererade i N1. Operatörslagring, `partner_session`
  och scoped snapshot finns; T2 är påbörjad, inte klar.
- [ ] **T3. Anslut en operatörsfunktion i taget.** Öppen. Scoped snapshot kan visa sparat paket (presentationer, bord, revision) och medlemskap. Spelare, transaktioner och rapporter är inte anslutna. N1:s bolagsadministration och paketpublicering är levererade; N2:s kompletta liveacceptans och övriga integrationer återstår. Koppla revisionerade
  presentationer och egna bord, sedan rapporter, team och integrationer. Varje
  funktion behöver organisationens ägarskap genom UI, API, lagring och export.
  Render behåller kort, regler, plånbok och avräkning. Importera inte Kevins
  SQLite-konton, gamla miljöfiler eller loopbackbrygga. En generell proxy till
  globalt admin-API är inte kundisolering.
- [ ] **T4. Spelarens lobby.** `/play` visar tillgängliga spel i verifierad
  operatörskontext och ger endast spelarens egen profil/historik. Börja med
  Blackjack; giltiga partnerstarter får öppna spelet direkt utan extra login.
  Ändra inte spelaridentitet eller signerade launch-kontrakt genom namnbytet.
  Delsteg 7 oktober: `/play` är spellobby, `/play/profil` visar namn, saldo och
  valuta, `/play/historik` anropar `POST /api/history` för egna aggregerade
  resultat, och `/play/blackjack` återanvänder befintlig sessionskontroll,
  sparad lane och signerad launch. Äldre speladresser leder vidare i det
  gemensamma molnprojektet. Lobbyn kan visa Spelar hos från `?operator=`.
  Profilens namn och språk kan redigeras när `006-player-profile.sql` körts mot spel-Neon.
  Delsteg 11 oktober: Vercels spelstart begränsar dealer/miljö till bolagets publicerade paket och verkliga rum. Den allmänna ingången leder till bolagsportalen. Liveprov av bolagsval → rum → Johanna med tre lager passerade på c48c6754; giltiga signerade starter behåller sin separata validering. T4 förblir öppen för återstående full acceptans, inte för ett saknat bolagsval.

Författaren till det frysta GitLab-headet är ImpactPL; identiteten är ännu inte
bekräftad som Kevin. Överföringens källrevision är därför explicit dokumenterad.
Privata originalanteckningar i `random/` är inte del av produkt eller deployment.

### Johns N2-skiss — implementationsplan, 11 oktober 2026

Denna nedbrytning hör till **T2/T3 i denna tracker**, inte till ett nytt projekt.
Alla JN2-punkter nedan är öppna implementations- och acceptansgrindar. Planen
är inte ett påstående att hela funktionerna är produktionsgodkända. Befintliga N2.2/N2.4-namn
behålls; JN2-ID:n avser endast denna skissintegration.

**Första kodleveransen, 11 oktober 2026 — JN2-A/B för granskning.** Implementerad
på `codex/john-n2-admin-partners`, ursprunglig bas `f8e5bdfd`, synkad med main
`52bcab1f`, på Jakobs uttryckliga begäran om egen branch och PR. Normal `/partner` och `/partner/{slug}` använder
nu det riktiga operatörslagret även för intern admin med samma N1-session. Johns
spelbolag och SG:s bolag kommer från lagret; inget nytt bolag, medlemskap eller
partnercookie skapas. Utan publicerat paket är bolaget fortfarande synligt.
Demo North/South och fallback till exempeldata är borttagna från produktvägen;
den separata N1-skyddade diagnostikförhandsvisningen och dess testfixturer består.

N1-admin och partner är två explicita åtkomstklasser. Färsk adminauktorisering,
workspace/miljö, operatör och rättigheter kontrolleras; när båda sessionerna
finns har N1-kontexten företräde och en ogiltig N1-session får inte falla tillbaka
till partnercookie. Partnerpersonal är fortsatt begränsad till sina medlemskap.
Teamdata kräver `team.read`; varje teamändring återkontrollerar exakt rättighet
under operatörslås. Utseendeskrivning behåller resursvalidering, revisionskontroll
och verklig adminaktör. Konto- och operatörslager är separata: detta är inte en
distribuerad transaktion. Beständig audit återstår i JN2-C.

Johns visuella grund är integrerad i befintliga React-komponenter: sidomeny A,
PageHeader, neutrala ljusa ytor/lime, mörkt läge, EN/SV, bolagsval och mobil
sidväljare. Partneringången har egen avsiktlig CSS i stället för saknade N1-klasser.
Riktiga paket-/bordstal visas; ej ansluten speldata visar tydliga tomlägen, inte
låtsas-GGR. Äldre demoingång och felaktigt delat stylingberoende har städats bort
utan DB-/medieradering eller ändring av N1:s gränssnitt.

**Verifiering före PR:** 44 isolerade backend-/åtkomsttester, 22 navigation-/
visuella regressionstester och 13 ytroutetester passerar. Slutligt Lab-
produktionsbygge/TypeScript och byggspårskontroll passerar (fyra workers,
82 spår, omkört efter main-synk `52bcab1f`). Befintlig previewtestharness har
anpassats till Johns komponenter och passerar 11 tester. Browserprov av de faktiska komponenterna i isolerad UI-fixtur täcker
360/820/1440 CSS-px, bolagssökning, språk/tema, refresh och sidnavigering utan
horisontell overflow. Det är inte ett produktionslogin- eller databasprov.
Ordinarie fullhook är godkänd för kodcommit `684864b618010caf11d2c7bef719b8fa8faf8e17`:
2 442 PASS/9 skip/0 fail (55 testgrupper). Ingen hook eller täckning har kopplats bort.
De tidigare stoppade körningarna räknas separat: äldre previewharness behövde uppdateras
och lokal Gateway-testdependency `ws` saknades; verifieringen kördes därefter om med låsta beroenden.

**Granskningskomplettering i [PR #12](https://github.com/Jakeminator123/scoutgaming/pull/12):**
Byt konto/Logga ut är tillbaka i riktig katalog och bolagsvy, SV/EN och mobil,
via befintliga API:er och serverns uttryckliga åtkomstklass. Admin avslutar
sekundär partnersession och N1; partner endast partnersessionen. Misslyckat
anrop stoppar navigation och kan provas igen. Ogiltig/utgången N1-cookie
går till N1-login med säker exakt partner-undersida som returnTo. Partnerlogin
behåller sin befintliga `/partner`-landning; exakt undersideretur är endast
verifierad för N1. Föråldrade fixturepåståenden i README och inventeringen är
rensade eller historiskt märkta. Sessionssviten ingår i befintlig fullhook.

Kompletteringens 29 ytrouter-/navigationstester och 29 fokuserade sessions-/
visuella-/previewtester PASS, noll skip. TypeScript och Lab-produktionsbygge
inklusive 82 byggspår PASS. Isolerade browserprov av faktiska komponenter
bekräftar kontobyte, utloggning, anropsordning och serverfel utan navigation,
SV/EN, ljust/mörkt och 360/1440 CSS-px. Detta är inte produktionslogin eller
databasacceptans. Ordinarie fullhook på kompletteringens kodcommit
`00511089a922c3df1f7cde81d19701a1094ef194`: 2 453 PASS/9 skip/0 fail
(55 testgrupper), inklusive sessionssviten. Ingen hook eller täckning bortkopplad.

**JN2-A/B är fortsatt öppna acceptansgrindar:** efter granskning/deployment krävs
verklig N1-login → Johns/SG → direktlänk/refresh, begränsad/återkallad identitet,
tenantisolerad skrivning och riktiga Postgres-konkurrensprov. JN2-B:s övriga
affärsformulär och toppmeny B ingår inte i detta grundskal. Ingen produktions-DB,
migration, provider/env eller deployment har ändrats av kodleveransen.

**Underlag och nuläge.** Johns [beskrivning och skiss i inbox #9](https://github.com/Jakeminator123/scoutgaming/issues/9#issuecomment-6099185493)
pekar på `random/n2-skiss-john/index.html` på John-revision `aaadfb49`.
Skissen är fristående HTML/JS med exempeldata och simulerade anrop, inte en
färdig backend. Den historiska kodinventeringen före PR #12 nedan utgår från main
`9d151fa6be364f4af5999c8163a6055dd8fc5fc8`. Webbläsarobservationerna gjordes
11 oktober på www; deras exakta deployment-SHA är inte fastställd av denna kontroll.

| Del | Finns och ska återanvändas | Lucka som faktiskt återstår |
| --- | --- | --- |
| Bolag och åtkomst | Studio `005-operators.sql`: bolag, roller, medlemskap och revisionerade paket; partnerlogin/aktivering; N1 Bolag & team | Adminens N2-ingång väljer fixture utan `partner_session`. Gemensam bolagsingång och separata säkra admin-/partnerkontexter behövs. |
| N2-gränssnitt | Kevins importerade komponenter; riktiga paket-/teamvyer och appearance-loader | Johns navigation, utseende och arbetsflöden är inte genomgående integrerade. Startsidan refererar CSS-klasser som saknas. |
| Anpassning/publicering | `partner-branding-api.mjs` validerar tillåtna ändringar, rättigheter och förväntad revision; N1 äger fryst presentation/rum | Dagens sparning publicerar paketrevision. Johns separat sparade utkast, återställning och granskningsflöde saknas som sammanhängande kontrakt. |
| Speldata | Render/spel-Neon har spelare, transaktioner, partnerrundor och API-nycklar | N2-snapshot markerar players/transactions/reports som ej anslutna. Entydigt bolagsägarskap, läs-API och avstämning krävs före N2.4. |
| Revision/audit | Pakethistorik och befintlig loggning | `operator-journal.mjs` skriver serverlogg, inte en beständig operatörsjournal som går att läsa och exportera. |

**Varför Johns spelbolag saknas i bilden.** Inloggad intern admin såg på
`/partner` Demo North, Demo South och SG-test som demonstrationer. På
`/partner/sg-test` stod uttryckligen intern förhandsvisning/exempeldata.
Samtidigt visade N1 Bolag & team **Johns spelbolag**, slug
`johns-spelbolag`, med ett aktivt medlemskap; `/play` visade också bolaget.
Bolaget saknas alltså inte i den observerade bolagskatalogen. I
`lab/app/control/surface-page.tsx` används riktig N2-data bara när
`partnerSessionPresent(request)` är sann; annars väljs `partnerPreviewInitialData`.
Det är ett åtkomst-/datakälleval, inte något som ska lösas genom att skapa ett
dubblettbolag eller lägga admin som kundmedlem i varje bolag.

**Arkitektur och avgränsning.** Behåll Next/Route Handlers på Vercel för N2,
Studio-Neon för operatörer/paket/konfiguration och Render/spel-Neon som auktoritet
för rundor, kort, regler, saldo och avräkning. Samma konto för intern admin över
tre nivåer betyder inte samma behörighet för varje N1-användare: read-only och
andra begränsade roller får inte automatiskt adminrättigheter. Demo North/South
tas bort ur normal navigering, inte genom att radera verkliga DB-poster eller
testfixturer. Riktiga bolag visas även utan publicerat paket, med korrekt tomläge.

#### Första leveransen: riktig bolagsingång och Johns visuella grund

- [ ] **JN2-A — P0: samma adminlogin, riktiga bolag, inga demokort.**
  **Frontend:** ersätt normal `/partner`-lista med riktiga bolag som den aktuella
  identiteten får se; sök/bolagsval och länkar till `/partner/{slug}`. Visa
  ”Intern admin · Johns spelbolag” respektive partnerns egen identitet. En admin
  ska gå N1 → N2 → N3 utan separat partnerlogin; partnerpersonal når endast sina
  aktiva medlemskap. Ta bort Demo North/South och missvisande footertext; SG:s
  riktiga bolag ska komma från lagret, inte från en namngiven fixture.
  **Backend:** återanvänd N1:s färska adminauktorisering och operatörslager i
  `surface-page.tsx`/`partner-data.mjs`. Inför en explicit intern operatörskontext
  och gemensam snapshotbyggare; behåll partnerpolicyn intakt. Både initial sida,
  omladdning och varje N2-API måste kontrollera identitet, miljö/workspace, valt
  operatorId och rättighet på nytt. Adminskrivningar ska gå genom samma
  resursvalidering/CAS, med verklig admin som aktör; ingen falsk `partner_session`,
  medlemskap eller generell proxy till oskopade admin-API:er. Bestäm explicit
  läge när båda sessionerna finns. Utgången/återkallad session ger login/nekande,
  aldrig automatisk övergång till demo eller högre rättighet.
  **Databas:** återanvänd operators/roles/memberships/packages från 005; ingen
  kontomigrering eller bolagsseed behövs för katalogen. Slug är URL, operatorId
  är ägarskap. Beständig audit för skrivningar färdigställs i JN2-C.
  **Beroenden:** befintlig N1-auth och 005-lagring; första blockerande steg.
  **Verifiering:** admin ser Johns och SG:s riktiga bolag och rätt paket vid
  direktlänk/refresh utan ny login; bolag utan paket är synligt men opublicerat.
  Partner A får 403/404 för B även vid manipulerad URL/body; read-only kan inte
  skriva; indragen adminroll/session slår igenom nästa anrop. Anonym användare
  får ingen privat bolagslista. Inget fixturesvar vid 401/403/503.

- [ ] **JN2-B — Johns visuella språk på befintliga komponenter.**
  **Frontend:** implementera först skissens sidomeny (A), gemensam PageHeader,
  grupper Översikt/Spel/Spelare/Finans/Inställningar, tydligt aktivt bolag och
  konsekventa kort, tabeller, statusmarkeringar, drawers och formulär. Behåll
  befintliga fungerande loaders/komponenter, byt inte till hela HTML-skissens
  globala state. Använd dess ljusa neutrala ytor/limeaccent, med mörkt läge och
  samlade EN/SV-texter. Alternativ toppmeny (B) skjuts upp tills A är godkänd.
  Åtgärda `/partner` separat: `partner-workspace.tsx` använder `tools`, `tool`,
  `help`, `notice`, `levels` som saknas i importerad `control-workspace.module.css`.
  Ge partneringången avsiktlig egen styling eller riktiga gemensamma komponenter
  utan att återställa N1:s nya CSS. Filter visas bara där datakontraktet stöder dem.
  **Backend:** återanvänd snapshot/capabilities från A; exponera unavailable,
  tomt och fel som skilda tillstånd. Inga nya business-API:er för enbart layout.
  **Databas:** inga nya tabeller för UI-skalet; använd befintlig profil för
  språkpreferens där den gäller, lagra inte affärsutkast som endast localStorage.
  **Beroenden:** A:s mode-/bolagskontrakt; kan utformas samtidigt med A.
  **Verifiering:** jämför startsida, översikt, bord, branding och team med Johns
  skiss i 360/820/1440 CSS-pixlar, ljust/mörkt, EN/SV. Kontrollera tangentbord,
  synlig fokus, dialogens fokus/återgång, etiketter, kontrast, tabellscroll och
  laddning/fel/tomläge. Exempeldata får inte se ut som verkliga pengar eller drift.

#### Säker konfiguration och publicering

- [ ] **JN2-C — rättigheter, beständig audit och bolag/varumärkesgräns.**
  **Frontend:** koppla Johns teamvy till befintlig invitation/aktivering och
  team-loader. Visa tillåtna åtgärder och faktiskt aktiva roller, inte bara fem
  hårdkodade rollnamn. Skilj bolag från varumärke/marknad; första leveransen kan
  ha ett varumärke per bolag, men ska inte visa påhittade marknader/licenser.
  **Backend:** mappa skissens Owner/Pit boss/Finance/Branding/Read-only mot
  `web/partner-access-policy.mjs` och befintliga anpassade roller; dokumentera
  delegerbara rättigheter. Nya skrivförmågor för RG/integrationer kräver explicit
  policy, inte återanvändning av `*.read`. Lägg läs-API för journal och skriv
  audit tillsammans med konfigurationsändringen; fail closed vid saknad journal.
  **Databas:** additiv Studio-migration för operatörsaudit (scope/operatorId,
  aktör och accessClass, åtgärd/resurs, gammal/ny revision, tid, requestId;
  inga hemligheter). Bestäm retention och index för operatör/tid. Vid flerbrands-
  leverans: scoped brands/markets och kopplingar till rum, valuta och paket;
  backfyll endast verifierad bolagstillhörighet, bevara befintliga operatorId:n.
  **Beroenden:** A; audit är en grind för nya verkliga skrivflöden D/F/G/I/J/K.
  **Verifiering:** isolerad Postgres, samtidiga rollbyten, sista aktiva admin,
  avstängning och återkallelse; en lyckad ändring ger exakt en beständig auditpost,
  nekad ändring ändrar inga affärsdata. Ingen läsning/export över scopegräns.

- [ ] **JN2-D — brandutkast, preview, granskat publicera/återställ.**
  **Frontend:** integrera Johns logga, filt/rail/tryck, bakgrund, chips och
  knappstilar stegvis med `partner-appearance.tsx`. Visa tydligt utkast kontra
  publicerad revision, sparstatus, ändringslista, berörda rum och versionshistorik.
  Lägg brandstandard, separat rumsöverskrivning och ”använd standard igen”. Preview
  omfattar faktisk tillgänglig speltyp, spelfas och desktop/mobil; N1:s frysta
  placering/skala är inte redigerbar. Chips/knappar får inte markeras klara innan
  samma kontrakt renderas i N3 (inklusive kvarvarande L4-arbete).
  **Backend:** skilj spara-utkast från publicera i befintligt branding-API.
  Validera serverledes allowlist, färger/kontrast, logoformat/storlek, publicerat
  Scout-paket, dealer/bakgrundskompatibilitet och förväntad basrevision.
  Återställ skapar utkast, inte tyst liveändring. 403/409 och ändrat grundpaket
  behåller användarens utkast men blockerar felaktig publicering. Frysta
  presentationer/rum och privata mediereferenser förblir N1-ägda.
  **Databas:** separat scoped utkast med baspaketrevision och egen revision;
  återanvänd `operator_packages` för publicerad historik, skapa inte ett parallellt
  N1-paketsystem. Bestäm och validera explicit lagring av tillåtna brand-/rums-
  overrides. Logo i befintlig behörighetsstyrd medielagring, inte stora data-URL:er
  i paket eller osanerad SVG/HTML. Publicering och audit atomiskt i Studio;
  spelmotorns tillämpning kvitteras separat, inte som en distribuerad DB-transaktion.
  **Beroenden:** A–C, befintligt package-/roomkontrakt och N3-renderer.
  **Verifiering:** två redigerare → konflikt utan förlorat utkast; ändrade
  rättigheter/paket efter öppnad dialog → nekande. Reload behåller utkast;
  publicering syns från nästa runda, pågående runda behåller sin look.
  Brandbyte påverkar rätt rum, rumsundantag består och reset fungerar.
  Prova felaktig logo/kontrast samt alla tillgängliga dealers utan att ändra media.

#### Spelmotorkoppling: data före statistik och driftknappar

- [ ] **JN2-E — N2.4: auktoritativt, bolagsavgränsat läskontrakt.**
  **Frontend:** dashboard/livebord/spelare/transaktioner får samma period-,
  valuta- och bolagskontext. Visa ”inte anslutet”/”data fördröjd” med asOf;
  okänd GGR eller beläggning är inte noll. Dölj ej stödda filter och exportknappar.
  **Backend:** inför autentiserad läsyta på Render med serververifierat operatorId,
  roomId, tidsintervall, valuta, paginering och mätdefinitioner. N2 använder
  server-till-server-adapter, inte globalt spelar-admin-API från browsern.
  Definiera GGR från avräknade insatser minus utbetalningar, separera öppna
  insatser, annulleringar och valutakonvertering; en spelare kan ha olika
  operatörsrelationer. Återanvänd befintliga rund-/transaktionskällor.
  **Databas:** inventera faktisk mål-DB före migration. Granskad bas i
  `ops/neon-game/product-schema.sql` har `partner_players`/`partner_rounds`
  med key_id men saknar explicit operatorId-koppling där; globala transactions
  är player_id-bundna. Inför verifierad API-key → operatorId-bindning samt
  rums-/rund-/varumärkesscope där nödvändigt, med FK/index och unika eventnycklar.
  Backfyll endast bevisad historik; okänd legacydata hålls utanför kundrapporter.
  Härled inte ägarskap från bolagsnamn, key creator eller global player_id.
  Lagra eventuella läsprojektioner idempotent; kopiera inte en skrivbar plånbok
  till Studio. Redovisa valutans precision och hantera pengar utan flyttalsdrift.
  **Beroenden:** A/C och verifierad nyckel-/operatörsmappning; integrationsvyn i
  J kan komma senare. D och E är separata leveranser, inte beroende av varandra.
  **Verifiering:** två operatörer med separata och överlappande spelaridentiteter,
  retry/dubbla events, negativa dagar, öppna/avräknade/annullerade rundor, flera
  valutor och periodgränser. Avstäm varje summa mot motorns ledger. Testa att
  nyckelbyte, URL/body/operatorbyte och export inte läcker ett annat bolags data.

- [ ] **JN2-F — livebord, dealer/limitbyte och schemalagda ändringar.**
  **Frontend:** Johns Floor/List och driftpanel visar faktiska rum, dealer,
  status, platser och väntande åtgärder. Skilj skickad/accepterad/tillämpad/misslyckad
  från live. Paus, återuppta och ändrade limits kräver tydlig bekräftelse.
  **Backend:** återanvänd N1:s atomära presentationsprofil + game lane + room-
  skapande; N2 begär/utför bara tillåtna paketbundna ändringar. Render validerar
  dealer, regler, valuta och limits, kvitterar idempotenta kommandon och tillämpar
  säkra ändringar vid rundgräns. Schemalägg serverledes med uttrycklig tidszon,
  konfliktregel, avbryt och återauktorisering vid exekvering. Klienttimer räcker inte.
  **Databas:** beständig kommandologg/outbox/schemaläggning med operator/room,
  expectedRevision, requestId, önskad tid och engine-ack. Bestäm en enda ägare
  för exekvering i motorn; ingen dubbel sanning mellan Studio och spel-Neon.
  **Beroenden:** C/E samt verifierat package-/room- och revisionskontrakt från D.
  **Verifiering:** pågående runda slutförs före paus; omstart/retry ger inte
  dubbla ändringar; gammal revision nekas, indraget paket/rättighet stoppar
  väntande ändring. Prova alla tillgängliga spel; Roulette/Baccarat förblir
  otillgängliga tills motorn faktiskt stöder dem, oavsett skissens demoväxel.

- [ ] **JN2-G — spelarhistorik och ansvarsfullt spel.**
  **Frontend:** anslut spelardetalj, transaktioner, noter, flagga/block och limits;
  visa källa, faktisk effekt och tid. Inför separata rättigheter för varje
  skrivåtgärd. Självavstängning från operatörsplattformen kan inte hävas i N2.
  **Backend:** ägarskap genom hela läs-/skrivkedjan; Render kontrollerar striktare
  limit och spärr vid varje ny insats. Återanvänd `player_admin_events` där dess
  kontrakt passar och komplettera med operatorscope. Kundvisning väntar på
  motorns ack; en UI-flagga får inte påstå att spel stoppats.
  **Databas:** scoped limits med typ/period/valuta/källa/ikraftträdande, noter och
  audit samt index. Bevara serverägda saldon, historik och kontoidentiteter.
  **Beroenden:** C/E/F:s säkra kommando-/kvittensprincip.
  **Verifiering:** gränsöverskridande insats, samtidiga insatser, striktare av två
  limits, dygn/vecka/månad och tidszon, aktiv runda vid spärr, obehörig upplåsning,
  PII/CSV/export och tvåbolagsisolering i separat testdatabas; aldrig riktiga
  kundkonton för test. Dealerförslag får inte kringgå limits eller exkluderingar.

- [ ] **JN2-H — rapporter, statements och senare intäktsdelning.**
  **Frontend:** börja med sammanfattning/transaktioner/bordsrapport och riktiga
  CSV/XLSX-exporter; därefter månadens öppna respektive låsta statement.
  **Backend:** samma beräkningskontrakt som E i UI/export. Kontraktets avgifter,
  FX-datum, negativ GGR och periodisering ska vara explicit versionsbundna.
  Skissens 10 procent/avgifter och ”Paid” är exempel, inte produktregler.
  Intäktsdelningsavtal och månadsutskick är en separat senare delgrind med
  förhandsgranskning, godkända mottagare, deduplicering och leveransstatus.
  **Databas:** scoped kontrakt/avgifter, frysta statementunderlag och FX-källor;
  senare avtal/report-jobs/outbox. Betaldstatus kräver verklig betalningskälla,
  inte att en månad har passerat. Bevara revisionsspår och undvik dubbelräkning.
  **Beroenden:** C/E och riktiga brand/market-kopplingar innan sådana brytningar.
  **Verifiering:** avstäm UI/CSV/statement mot samma ledger för positiv/negativ
  månad, delmånad, flera valutor och gränsdatum; låst månad ändras inte tyst.
  Export åtkomstkontrolleras på nytt och skyddas mot formelinjektion.

#### Utökningar från skissen — införs bara med verkligt underlag

- [ ] **JN2-I — dealerkatalog, statistik och spelintegritet.**
  **Frontend:** katalog och preview visar publicerade/tilldelade dealers, inte
  Scouts privata mediebibliotek. Statistik och integrity-vy kommer separat när
  underlaget finns; inga simulerade populäritetstal, chattvärden eller proof-hashar.
  **Backend:** aggregera vistelsetid/beläggning/retur med definierad population
  och minsta gruppstorlek; inga privata chattmeddelanden eller obestyrkt kausalitet.
  Katalogbegäran är inte omedelbar tilldelning. Skor/spins/proof måste komma från
  motorns faktiska integritetskontrakt; ingen ny egen slump-/kortlogik i N2.
  **Databas:** scoped aggregat och requeststatus där de saknas; återanvänd
  befintliga motorkällor för rundor/skor/proof. Avstå från ålders-/VIP-segment
  utan verifierad datakälla, tillåten behandling och tillräcklig gruppstorlek.
  **Beroenden:** A/C/D för katalog, E för statistik/integritet, F för tilldelning.
  **Verifiering:** otilldelade/private assets nekas, små grupper maskeras,
  filtrering följer bolaget och flaggade/avstängda spelare utesluts från förslag.
  Prova återspelning/verifiering mot verkligt proof; ändra inte godkända media.

- [ ] **JN2-J — scoped integrationer, återställning av lösenord och 2FA.**
  **Frontend:** sandbox/production, nycklar, wallet-test, webhookstatus och IP-
  regler ansluts en funktion i taget. Visa engångshemlighet bara vid tillåten
  skapning/rotation. Partnerns lösenordsåterställning och riktig 2FA ersätter
  skissens simulerade sexsifferkontroll/QR; de är egna acceptansgrindar.
  **Backend:** återanvänd partner-API och `croupier_auth.api_keys` efter E:s
  operatorbindning; inför separata skrivrättigheter, omauktorisering för känsliga
  ändringar, revokering/rotation och säkert verkligt anslutningstest. Servervalidera
  wallet/webhookdestinationer mot SSRF och begränsa tid/storlek/redirects.
  Produktionsaktivering sker enligt befintlig N1-policy, inte en klientväxel.
  Auth: tidsbegränsade engångstoken, rate limits, sessionsåterkallelse och riktiga
  verifierings-/återställningskoder; inga nya parallella kontodatabaser.
  **Databas:** verifierad nyckelägare och miljö, rotation/revokering, leveranslogg/
  idempotens samt hashade engångstoken/recoverykoder och skyddad 2FA-hemlighet.
  Hemligheter får inte ligga i audit, loggar, vanlig snapshot eller export.
  **Beroenden:** A/C/E:s identitetsbindning; full N2.4 behöver inte vänta på hela J.
  **Verifiering:** ett bolag kan inte lista/rotera ett annat bolags nyckel,
  replay/expired token nekas, gammal session återkallas, rotationens överlapp
  stämmer med kontraktet, felaktig MFA nekas och webhook-retry dubblar inte events.

- [ ] **JN2-K — onboarding och säker brandimport.**
  **Frontend:** Johns setupsteg återanvänder D:s editor och A/C/J:s riktiga
  bolag/team/integration. Separera engångssetup från daglig drift. Review visar
  verkliga blockerare och vad ett go-live-besked innebär; inga lokala checkrutor
  kan aktivera produktion. PDF-/URL-import införs efter manuell branding.
  **Backend:** beräkna readiness från sparat paket, rum, rättigheter och verkliga
  verifieringar. Go-live skapar en spårbar begäran för N1-granskning. Brandimport
  föreslår ändringar som granskas före applicering; begränsad fil-/URL-läsning,
  SSRF-skydd och sanitiserad metadata, inga instruktioner från filer får exekveras.
  **Databas:** scoped setup-/go-live-request med revision/status och audithistorik;
  återanvänd D:s utkast, inte ett parallellt onboardingpaket. Importstatus endast
  om faktisk serverimport levereras; skissens simulerade läsning kopieras inte.
  **Beroenden:** A–D samt relevant F/J-readiness; import är senare förbättring.
  **Verifiering:** reload/annan enhet fortsätter samma utkast, paket- eller
  rolländring efter review blockerar, ofullständiga integrationer kan inte bli
  produktionsklara och upprepad begäran ger inte dubbelt go-live/utskick.

#### Leveransordning och gemensamma slutprov

1. **Första synliga leverans: JN2-A + B.** Admin öppnar Johns och SG:s riktiga
   bolag utan extra partnerlogin; normal partneringång är välformgiven utan
   demokort. Befintliga riktiga funktioner består, oanslutna delar märks ärligt.
2. **Första kompletta konfigurationsflöde: C + D.** Beständig audit, säkra
   rättigheter och utkast → publicering → nästa N3-runda. Inte beroende av färdig
   statistik. Enbart snygg preview eller lyckad spara-knapp är inte acceptans.
3. **Speldataleverans: E → F/G/H.** Gör nyckel-/bolagsmappning och avstämda
   läsdata först; anslut därefter drift, RG och rapporter i separata verifierbara
   deländringar. I:s statistik/integritet följer samma datagrind.
4. **Utökningar: I/J/K.** Katalog kan komma tidigare när paketen stöder det.
   Flerbrand/marknad, intäktsdelning/utskick, brandimport, 2FA och toppmenyvariant
   får inte maskera ofärdig kärna och bockas av var för sig.

**Databassäkerhet:** föreslagna tabeller/fält ovan är designarbete, inte godkända
DDL-körningar. Kontrollera målprojekt/schema och befintlig migrationhistorik
read-only; prova additiva migrationer både på tom och uppgraderad isolerad DB,
inklusive FK, unika nycklar, index, race och återställningsplan. Ingen dump av
verkliga användare, gissad historikmappning eller produktionsbackfill för test.
Produktionsmigration kräver separat mandat och Studio-readiness ska vara uppfylld
före beroende kod levereras till main/deployment enligt befintlig migrationsregel.

**Kodverifiering per delsteg:** kontrollera engines/pins och vald Node före körning;
använd högst fyra testworkers där stödet finns. Utöka befintliga
`lab/test/workspace-surface-pages.test.mjs`, `partner-preview.test.mjs`,
`partner-session.test.mjs`, `partner-team-api.test.mjs`,
`partner-branding-api.test.mjs`, `partner-presentation-flow.test.mjs` samt
`test/partner-access-policy.mjs` och `test/operator-store.mjs` för respektive
ändring; kör dem med `node --test --test-concurrency=4 <berörda testfiler>`.
Följ därefter ordinarie hooks/CI och de runtime-/medieprov som ändringen kräver.
Tester mot minnesfixtur räcker inte som Postgres- eller tenantacceptans.

**Produktacceptans:** dokumentera exakt SHA/deployment och två isolerade bolag.
Prova admin → riktig bolagslista → Johns/SG:s paket → N2-ändring → N3 efter
rundgräns, samt separat partnerlogin → endast egna bolag. Prova 401/403/409/503,
indragna roller, föråldrad browserflik och bolagsbyte utan kvarhängande data eller
utkast från föregående bolag. Jämför visuellt med John efter riktig integration,
inte bara med fixtures. Ingen T2/T3-bock förrän full förväntad effekt verifierats.

**Denna planuppdatering:** kod- och läsande webbläsargranskning; ingen produktkod,
databas, kundinloggning, roll, nyckel, paketpublicering eller driftinställning
ändrad. Separat partnerkontos end-to-end-login och N2-skrivning har inte provats
i produktion. Att adminvägen behöver förbättras är ett bekräftat fynd, inte ett
krav på att användaren ska logga in en gång till för att planeringen ska gå vidare.

### Terminologi och navigation — 6 oktober

Aktiv guide och ordlista skiljer lane, klippuppsättning, adapter, urval,
uppspelningsplan och operatörspaket. PDF:erna används som underlag, aktuell
kod avgör status. Nivå 1 är ScoutGamingGroups gemensamma adminyta på `/control`, med riktiga
verktygsingångar, inte en parallell uppsättning av Kevins exempelpaneler.
`/studio` är labbets basePath, inte produktnamnet i gränssnittet. Nivå 2 på
`/partner` hade i den här passningen den importerade förhandsvisningen; sedan
7 oktober finns också scoped operatörsdata, se T2. Kevins backoffice hör
inte hemma i `/control`. Äldre hashbokmärken fungerar; interna klipp/tal/media/konton
leder till befintliga verktyg och oanslutna vyer får en tydlig förklaring.
Nivå 2:s lane-/designnotiser visar saknad spelkoppling;
lokala utkast fungerar fortsatt i den befintliga bordsförhandsvisningen.
Den här passningen ändrade ingen partner-login, DB-migration, spelregel eller mediefil. `partner_session` och migration 005 kom 7 oktober.

## Öppen arbetschecklista: personalyta under /control

Målet är att `/control` samlar tidigare Lab- och personalverktyg: samma
inloggning, begriplig navigation och fungerande dealer-, klipp-,
administrations- och OpenClawflöden. `/studio` är labbets basePath, inte
ytans namn. Kevins backoffice stannar på `/partner`. Detta är den öppna arbetslistan för fortsatt
arbete, inte en ny migrationsplan. Huvudagenten samordnar och uppdaterar den.
En ruta kryssas först när resultatet nedan har verifierats; äldre PASS räcker
inte för ett ändrat flöde. Senaste gemensamma startversion: `3e613186`.

- [ ] **A. Administratör kan logga in till `/control`.** Jakob har bekräftat att han
  skapade `john.g` i Backoffice från det inloggade kontot `Jakob`. `john.g`
  fungerar som blackjackspelare. Synlig kontometadata bekräftar aktivt
  spelarkonto, ingen synlig Studio-användare med samma namn. Spelarkonton har
  enligt nuvarande kontrakt ingen Studioåtkomst; headerns Administratör gäller
  inloggade Jakob. Kontoformulären förtydligas. Ett separat administratörskonto
  behöver invitation/aktivering via e-post; produktionsmail är punkt F.
  Klart när det avsedda administratörskontot når `/control`, med rätt behörighet,
  och spelarkonton fortfarande nekas. Kontodata ändras först utifrån belagd orsak.
- [ ] **B. Backoffice går rimligt snabbt att navigera i.** Föreprov på
  `3e613186` gav fyra gruppbyten 7,468 / 4,944 / 4,859 / 10,018 s.
  Authrättningen grupperar fyra färska identitetsläsningar i en transaktion
  (12→6 databasfrågor, utan cache). Produktionsomprov på `ba0cb7ee` gav
  7,195 / 3,325 / 5,937 / 2,913 s: varierande väntan kvarstår och 18 GET
  var oförändrat. Nästa riktade rättning tar bort sju extra sessionanrop:
  varje native data-GET lämnar identiteten från sin färska behörighetskontroll,
  och klienten avvisar identitetsbyte, saknade headers och revoke före visning.
  81 riktade tester passerar; legacy- och skrivkontroller kvarstår. Klart när
  faktiskt publicerat flöde är ommätt med rätt data och bevarad behörighet.
  Publicerat `cb8e5254`: 11GET200, fyra fulla mätningar 2,553 / 4,834 /
  6,653 / 2,682s. Anropsminskning bevisad, latenstoppar kvar. Publicerat cd9f5b21
  sammanför färska authprojektioner (utan cache): två SELECT/fyra frågeanrop
  mot tidigare fyra/sex. 118 riktade PASS; signer/sessionförst, collision,
  roll/stamp/epoch och mutationslås bevarade. Numerisk Server-Timing skiljer
  runtimeväntan från API/auth; 18 riktade PASS. SQL8 och CI37305177411 passerar.
  Live cd9f5b21: 11GET200, 9,361 / 2,112 / 2,088 / 1,426s. Första bytet
  innehöll 3,04 respektive 2,76s serverinitiering; senare initiering under1ms.
  Ingen generell latensgaranti. Publicerat 34f64e34 tar bort fyra inledande
  sessionGET och tillåter menybyte under läsning, med gemensam färsk identitet
  kontrollerad före bodyläsning, sena svar avvisade och skriv-/utkastspärrar kvar.
  101 riktade PASS, oberoende review och fullhook 1554PASS/9skip/0fel.
  CI37307380711 har tre successjobb. Live:7dataGET200/0session/0POST,
  1,472 / 5,544 / 4,709 / 1,181s. Byte under pågående läsning fungerade;
  gammalt anrop avbröts och rätt vy visades utan fel. Latenstoppar i initiering
  och dataläsning kvarstår; punkten förblir öppen för dem.
  Regionprov 6 oktober på samma `019dba6d14c0b8b9c9de900af572e916316649b3`:
  Studio-projektets sparade Vercelregion ändrades från `iad1` till `fra1`,
  nära Neon i Frankfurt. Aktiv produktion är
  `dpl_24S1idmMEHgzpPYqrwPPLf2P6YNk`, READY, med oförändrad Studio-adress.
  Första Studio→Backoffice gav 7,879→3,041 s. Overview GET gav
  7,208→2,449 s (runtime 2646,53→319,49 ms; API 1307,22→88,18 ms),
  shoes 3,648→0,934 s (runtime 2683,45→546,38 ms; API 666,36→63,00 ms).
  Varm omläsning gav overview 1,595→0,328 s och shoes 0,866→0,267 s.
  Båda data-GET var 200 och faktiska svar visade `fra1` i `x-vercel-id`.
  Oinloggade overview/shoes gav 401; Studio-login och game-session GET gav 200.
  Neon-plan, DB-data, behörighetskod och produktkod ändrades inte.
  Ett tidigare redeployförsök är CANCELED: det ärvde `iad1` trots regionoverride.
  Det accepterade provet byggdes från samma explicita Git-SHA efter sparad
  regionändring. Första overview har fortfarande cirka 2,04 s utanför
  Server-Timing-faserna. Detta är ett första-/varmprov med befintlig adminsession,
  inte ett nytt lösenordsloginprov eller en garanti för alla grupper/enheter.
  B förblir öppen. Nästa arbete: lokalisera återstående start-/proxyväntan,
  minska sekventiella startläsningar med bibehållen färsk behörighetskontroll,
  och pröva navigation utan full sidomladdning med bevarade utkast.
- [ ] **C. Personalverktyg samlas under `/control`.** OpenClaw samlas på
  `/control/openclaw` och operatörschatt på `/control/operator-chat`.
  `/studio` är labbets basePath. Intern
  navigation, direktlänk, reload och loginens målroute är rättade. Båda vyerna
  samt spelarkonto/adminförtydligandet är verifierade i publicerad `ba0cb7ee`.
  Native/Neon spärrar det äldre fristående röstprovet; UI ska visa detta och
  göra noll röst-GET/POST, med serverns spärrar kvar. Neutrala miljö-/spartexter
  och denna UIrättning har 65 riktade PASS. Publicerat cb8e5254/reload visar
  otillgängliginfo, inga kontroller/alerts och noll röst-GET/POST/API503.
  Klart när menyrutter/direktlänkar/login fungerar ihop, utkast bevaras och
  kvarvarande desktop-/mobil- och användarflöden faktiskt är verifierade.
- [x] **D. P6:s isolerade SQL/HTTPS-prov — verifierat lokalt och i CI 5 oktober.** Huvudagenten har rättat testfixturens
  saknade `gameDb` i både auth- och kontofabriken samt äldre reader/staff-
  antaganden. Osäker talleverantörssubmission ska förbli spärrad vid shutdown,
  inte förväntas vara rent avslutad. Behåll negativa rollprov,
  verkliga SQL-transaktioner, reset/revoke, omstart och cleanup. Klart när samma
  befintliga provmotor passerar på aktuell källa i eget tillfälligt kluster.
  Körning 3: exit0, 17 äldre och 25 aktuella integrationschecks samt fyra
  retained-bank-kontroller. Verklig SQL/HTTPS/omstart och cleanup passerade;
  versionskvitto har stabila inputbytes. Körning 1–2 FAIL är bevarade. Detta
  stänger den isolerade deluppgiften, inte återstående mänsklig/live-P6 i H.
  Samma motor har nu faktiskt PASS i CI37308717362 på exakt e49f6f36.
- [x] **E. Systemkartan visar faktiskt provutfall — verifierat på e49f6f36.** Samma isolerade SQL-motor
  används i CI. `ba0cb7ee`, CI `37300874695`, failed före databasstart när
  runnerns installerade PGDG-libpq saknade nedladdningskälla. Exporten är
  korrekt röd för `studio.sql-restart-https`, med exakt SHA och observationstid.
  Failure-exporten bevaras privat.
  Rättningen använder egen tom paketstatus och installerar/ändrar inget på
  värdsystemet. Klart när ett faktiskt SQL-prov och exporter visar rätt
  resultat/SHA/datum; saknat eller skippat prov får aldrig bli grönt.
  Nästa `cb8e5254`-CI37303118034 stoppade efter databasstart vid delprovets
  resultatavläsning: CI använder Node24.21.0, lokal Node22.22.x. Runnern väljer
  nu uttryckligen TAP, som dess räknare läser, och CI=true lokal SQL7 passerar.
  Även denna exakta failureexport är röd och bevarad. CI37305177411 har tre
  successjobb och faktiskt SQL PASS på exakt cd9f5b21, med observationstid.
  Export: 19green/0red/5grey, inga valideringsfel; okända delar förblir grå.
  routes.studio saknade ett befintligt event-treeprov i CI. CI37307380711 på
  exakt 34f64e34 kör det:14PASS, routekontrakt GREEN. Färsk export har20green/
  0red/4grey och faktiskt SQL PASS. Två ytterligare kvittoluckor är rättade:
  befintligt shoe-prov körs före exporten/genom reportern utan dubbelkörning,
  och befintligt zone-cloud-store-prov ingår fullhook;15lokalaPASS/0skip.
  CI37308717362 på exakt e49f6f36 har tre successjobb och export22green/0red/
  2grey, errors[], observedAt2026-10-05T12:22:56.667Z. Faktisk SQLentry
  passed1/failed0/skipped0; event-tree14PASS, zone14PASS och shoe1filPASS
  med197internaassertions. Spel-/zonkontrakten är GREEN. Fullhook1569PASS/
  9befintligaskip/0fel/cancel. De två persistencekontrakten behåller
  GREY: deras riktiga concurrency/persistenceprov kräver isolerad
  croupier_game_qa och kördes inte. Separat Studio-SQL-PASS ersätter det inte.
  Efterföljande dokumentcommit04baf354, CI37309484604, stoppades före första
  steg i alla tre jobb. GitHub anger betalningsfel eller Actionsgräns utan att
  särskilja orsakerna. Ingen ny kodprovning utfördes. Actions-budgeten är därefter rättad av Jakob; senare 6 oktober-körningar
  har tre successjobb. Det äldre hindret är historik. Funktionsbeviset på e49 och privata failurekvitton bevaras.
- [ ] **F. Produktionsmail och användbar invite/reset.** Samordnad Resend-leverans
  6 oktober har återläst produktionsnyckel och `no-reply@scoutgaming.tech` i
   samma Studio-projekt som nu heter `scoutgaming`. Den befintliga nyckeln har avgränsad sending-access för den
  verifierade domänen. READY-deployment `dpl_G7tZPZ5QAPTdppLhHuGgkpPWwnxh`
  publicerar fryst `184fe66ba22acf63704f2a955f895b359e05027e` i `fra1` utan
  partnerarbetets då lokala ändringar. Den verkliga native mail-adaptern fick
  HTTP 200 och Delivered för både invite och reset till Resends sandbox
  `delivered@resend.dev`. Login och set-password gav 200, utloggad session 401;
  reset-formens action är `/studio/api/auth/reset-request`.
  Den oanvända extra Marketplace-installationen är borttagen efter kontroll av
  noll resurser/projekt/fakturor och noll env-referenser i 71 lästa projekt.
  Fungerande Resend-konto, domän och QA-koppling är bevarade. Tidigare QA-401
  vid domänlistning betydde restricted_api_key för sending-only, inte ogiltig nyckel.
  Produktionskonfiguration och providertransport är därmed verifierade.
  Verklig kontoinvitation, token/aktivering, återställning och mottagarens inkorg
  återstår; inga riktiga konton eller tokens ändrades i sandboxprovet. F förblir
  öppen. Privat kvitto: `lab/data/platform-private/resend-setup-20261006.json`.
  Förtydligande 6 oktober: native Resend-mejl har nu både text och HTML med
  avsändarnamnet ScoutGamingGroup, uttrycklig **intern adminpersonal, nivå 1**
  och åtkomst till hela nivå 1, nivå 2 samt nivå 3 med samma konto/lösenord.
  Mejlet förklarar att nivå 2 tills vidare visar demonstrationer. Formuläret
  i Administration → Konton säger samma sak. Engångslänkarna behåller 72 timmar
  för aktivering och två timmar för återställning. Spelarroller får egna
  mejltexter utan adminbehörighet; okända roller skickar inget mejl.
  Riktade mail/auth/UI-tester och Lab-typkontroll PASS. De två begärda verkliga
  personalinbjudningarna och mottagarnas aktivering/inkorg verifieras separat;
  denna kodleverans markerar inte F komplett och ändrar inga lösenord.
  Jakob tar över de två verkliga utskicken enligt senaste instruktionen.
  Agenten skickar inga mejl eller skapar konton i denna fortsättning.
  Senare läsande kontroll den 6 oktober visar Johns inbjudan som **Bounced**:
  **Recipient not found**, adressen ligger på Resends suppression-lista och
  kontot väntar på aktivering. Rätt adress krävs före nytt utskick; spärren är
  oförändrad. Jakobs dg97-adress visar **Delivered** och kontot är aktiverat.
  Den tidigare begärda Gmail-adressens leverans, faktisk inkorg och resetflöde
  är inte verifierade. F är fortsatt öppen. Privata mottagar-/providerkvitton:
  `lab/data/platform-private/level-two-takeover-delivery.json`.
- [ ] **G. GitGuardian-fynd utredda och hanterade.** Senast återläst
  workspace795524/source30689542 den 6 oktober: 12 öppna och fem ignorerade,
  komplett incidentlista (1 incident-/17 locationsidor). Sex positionerade
  öppna fynd täcker sju källhashpositioner i `docs/system-map/contracts.json`,
  verifierade mot exakt e49f6f36. Senaste nya ID är 37880359/60. Äldre matchning
  för 37867512/37879729 är fryst eftersom deras källfiler har ändrats och dagens
  metadata saknar positioner. Även 37862641/37863164/65/66 saknar positioner.
  Totalt nio positionsluckor, varav sex öppna. Historisk fixtureklassning är
  inte ett nytt bevis för saknad metadata.
  Klart när varje fynd har aktuell belagd klassning och konkret hantering.
  Alla tolv är fortsatt öppna; ingen automatisk ignore/resolve eller breda
  filundantag. GitHub queued/missing GitGuardianrun betyder inte incidentfrihet.
- [ ] **H. Återstående spel-, media- och enhetsacceptans.**
  **Nytt bildfynd 5 oktober:** upload `kortflipp_kling_1080p.mp4` (8,29 MB)
  visas sparad/återläst i ready med användning Idle, men Jakob kan inte
  placera den som idle-variant; ”Välj hur klippet ska användas →” upplevs
  inte reagera. Utred ready-listning, filtrering och knappens navigation/fokus.
  Separat klartkrav: isolerad upload går att hitta, tilldela som idle-variant,
  spara och återläsa efter omladdning. Rotorsak ännu inte reproducerad;
  ingen ändring/aktivering av produktionsmedia utförd. Övriga krav: fyra dealers/två
  faktiska plays, privat media, AI/tal/fullfil/stream, cancel/terminal/journal/
  omstart och naturligt provider-COMPLETED där det saknas. Mänsklig läppsynk,
  kortkontakt och fysisk mic/kamera/mobil/Safari redovisas separat. Klart när
  varje krav har aktuellt bevis eller ett exakt kvarstående hinder. QA AI/GPU
  förblir OFF; betalda prov kräver färsk avgränsad auktoritet.
- [ ] **I. Resterande drift och backup.** Läsutredningen skiljer följande krav:
  frame-varningen täcker saknad uppspelningsstart, presenterad bildruta eller
  avslut; ursprungskvittot saknar flaggorna. Nästa steg är snäv diagnostik
  och reproduktion med exakt idlefilm, med bildrutespärren kvar. Zoner har
  separat editorlagring/versionsskydd och styr ännu inte spelet; full isolerad
  spar-/återläsnings-/omstartsacceptans saknas. Startsidan byter asynkront
  hero-layout och introoverlay; möjlig flimmermekanism kräver faktisk bildserie
  och laddningsmätning innan rotorsak/rättning hävdas. Extern produktbackup har
  matchande verifierat kvitto, men Director/Gateway saknar angivna fullbackup-
  och återläsningskvitton. Nästa steg är samordnad faktisk skrivarfrysning,
  export av `/data/catalog` respektive `/data/openclaw`, extern kopia och
  hash-/SQLitekontroller enligt återställningsreglerna. Exportåtkomst är inte
  prövad. Klart när omprov/fix eller exakt kvarstående hinder är belagt per
  driftfel, och båda tjänster har verifierad extern fullbackup.
Detaljer och kvittoplatser: [den enda löpande handoffen](JOHN-HANDOFF.md#nästa-arbete-och-viktiga-gränser).
Avslutade migrationssteg och deras historiska bevis står kvar nedan.

## Källa och historiska driftkvitton

Aktiv källa är [Jakeminator123/scoutgaming](https://github.com/Jakeminator123/scoutgaming),
enbart main. Gamla github-work-adressen vidarebefordras; skapa inte ett nytt
repo där. GitLab är fryst proveniens och används inte för leverans.
Samlad tidigare drift-/importhistorik finns i den frysta historiklänken ovan.
Nuläge, acceptans och historiska kvitton ska aldrig blandas ihop.

## Fem dokument i docs

- [JOHN-HANDOFF.md](JOHN-HANDOFF.md): verifierat nuläge, överlämning och öppna fel.
- [ENVIRONMENT-RESTORATION.md](ENVIRONMENT-RESTORATION.md): backup/återställning och data/mediaregler.
- [ENVIRONMENT-VARIABLES.md](ENVIRONMENT-VARIABLES.md): namn, tjänsteplacering och villkor.
- [LOCAL-PRESENTATION-RUNTIME.md](LOCAL-PRESENTATION-RUNTIME.md): ansvar/kontrakt/uppspelning.
- Detta dokument: källa, målbild, checklista, driftskarta och leverans.

Behåll högst fem Markdownfiler i docs; uppdatera dem i stället för nya rapporter/
sprintarkiv. [Labbguiden](../lab/docs/README.md) och
[OpenClaws versionsbundna källindex](../open-claw/lab/docs/README.md) ligger nära koden.
JSON-register/systemkarta, media/baseline och privata QA-kvitton bevaras.
Tre ersatta Lab-dokument och redundant `Start-Lissabon.ps1` är borttagna.
Cmd-startfilerna i roten är borta. `node lab/start.mjs` och sessionsvakten
i `open-claw/lab/deploy/local-session.mjs` består.
Take/preview/tillgänglighetsregler finns i guiden.
Gallringen i `6ced437e` tog bort fem historiska V3-kartfiler under `docs/animation-events/`,
en ersatt releaseinventering och två Polarlotto-filer om andra operatörer:
åtta filer/1 143 070 byte. De har inga aktiva konsumenter och finns i Git `6b9dad55`.
Två QA-kvitton med öppna takebeslut och alla aktiva miljö-/baseline-/kartregister behålls.
De tekniska guiderna kortas; inaktuella produktdiskkommandon ersätts av aktuella
Neon-/Blobregler. Inga `.env`-filer, providerinställningar eller databasvärden ändras.

## Masterplan: en sajt, tre nivåer

### Mål och städprincip

En sajt och ett repo, tre åtkomstnivåer enligt systembeskrivningen.
Städa ersatt kod och dokumentation efter verifierad ersättning. Bevara privata
backup-/QA-/kostnadskvitton och andras arbetsdata. Radera inte en tjänst för
att dess UI-namn har ersatts: verifiera dess aktiva läsare och ansvar först.

### Gemensamma kontrakt

1. **Identitet:** gemensamt username/e-post/lösenord, ingen kontotypsväljare.
   Admin får spel och hela personalytan på `/control`; superadmin är adminalias; reader/staff är game-only.
   Befintliga råroller/IDs/saldon/historik bevaras, ingen ny OAuth/kontoreset.
   Credentialresolver kräver exakt en kandidat; collision/pending/fel lösenord ger
   generiskt avslag utan fallback/klientroll. Kapabilitet `sharedCredentials`
   läses före dispatch; misslyckad läsning blockerar, inte alternativ namespace.
   Sessions-/Origin/CSRF/Host/JSON/roll/fingerprint/auth_epoch gäller på servern.
2. **Sparad policy:** Render och labb-servicen använder samma explicita Neonmiljö/workspace.
   `CROUPIER_STUDIO_NEON_POLICY=1` och native `CROUPIER_STUDIO_NATIVE_ADMIN=1`
   får inte skapa två writers. Gemensam spelrevision binder projekt/adminrevision,
   exakt projektrevision består i spelarens kvitto. Repeatable-read/CAS/transaktion/
   historik/audit och bevarade utkast krävs; disk-lock/rename räcker inte.
   ”Profiler” avser presentationsinställningar, inte companion-minne/agentstate.
3. **Media/jobb:** privat objekt-ID/hash/metadata, behörig tidsbegränsad upload/commit,
   servervaliderad filtyp/storlek/hash och säker delete. Ingen Blob-/providerhemlighet
   till klienten. HEAD/Range och privat source/layout-spärr består.
   Blob ersätter filer, inte idempotens, ägare, lease/budget eller GPU-reservationer.
   Fullfil får Blobpaket; stream får inte tvingas genom Blob/betald fullfilsfallback.
4. **Spel/AI-gräns:** Vercel gör lätta adminanrop; Render/RunPod äger live spel/
   långvariga jobb. `/speech-stream` och `/lipsync-worker` bevarar auth/workerbiljetter.
   Reconnect återspelar inte gammal kö/startar inte nytt betalt GPU-jobb.
   OpenClaw får tillåten publik kontext/katalogrevision, ingen direkt saldoauktoritet.
   Kamera består; mic transkriberas före modellen. Råljud/modell-/GPU-uppgradering ingår inte.
5. **Schema/authkommandon:** checksumlåst product-v1/`ops/neon-game/product-schema.sql`
   ändras inte retroaktivt. Separata additiva 001–005 och återläsningsprov krävs.
   `/api/bo/config` är aktiv Neon-spelprojektion, inte generell raderingskandidat.
   Spelarstatus/partner rotate/revoke/launch/credit kräver signerad Renderauthority,
   nonce/tidsfence och verklig runtimecancel före OK; Vercel skriver inte eget saldo.
   Självrollbyte/radering/sista-admin-race skyddas. Engångstokens är atomiska;
   partnerhemligheter visas tillfälligt, aldrig i listmetadata/storage/audit.

### Migrationsstatus och beroenden

P0–P5 och P7–P9 är levererade med sina dokumenterade avgränsningar.
Fulla acceptansvillkor, importparitet, källhashar och rollbackkvitton finns i
[den frysta migrationschecklistan](https://github.com/Jakeminator123/scoutgaming/blob/4ed55a5624a28cdd82d8a0c252ead7a24ef3165e/docs/CLOUD-MIGRATION.md#checklista-och-beroenden).
P7:s avgränsade aktivering var inte ett godkännande av full P6.

- [ ] **P6 — samlad helhetsacceptans.** Fyra dealers/två faktiska plays,
  auth/revoke, privat media, AI/tal/fullfil/stream, cancel/terminal/journal/
  omstart och naturligt provider-COMPLETED där bevis saknas. Mänsklig läppsynk,
  kortkontakt, fysisk mic/kamera/mobil/Safari är separata krav i H.
- [x] P6:s isolerade SQL/HTTPS-fixtur och faktisk CI-resultatkoppling är rättade;
  se D/E. Äldre misslyckade kvitton bevaras. Separat game-persistenceprov saknas.
- [ ] Produktionsmailens hela användarflöde återstår enligt F trots konfigurerad Resend.
- [ ] GitGuardian-fynd och positionsluckor återstår enligt G.

Framtida migration börjar med källinventering och frysta skrivare, därefter
kontrakt/lagring/UI och integration; acceptans, aktivering och avveckling
samordnas. Historiskt godkännande är ingen ny budget eller driftauktoritet.

### P6: kostnadsundantag och acceptansgränser

Jakob beställde AI/GPU/produktion/avveckling med QA kvar och tillät egna worker-
brancher/worktrees för uppdraget. Bara MERGE integrerar main.
Exakta Cartesia/counting-priser är backlog, inte ny blockerande förstudie:
funktionstester får dokumenterad okänd USD/null och mätt usage inom befintlig
numerisk budget/reservation/dispatchauktoritet. Ingen nolltariff/faktura,
automatisk förlängning/refund/journalreset eller generell kostnadsapproval.

Originalkampanj f2c28b62-9ae7-4cd6-abcd-e2137f2206d6, totaltak 10 USD inklusive
alla försök, ankare
`d1a8f8fedb96008369a9ec87091744718d03f2678a465a80d147101271f6c523`.
Historisk reservation 5,251152/oreserverat 4,748848 USD; ingen nollställning.
Jakob höjde tvåtaket till sex genereringar totalt. Closed39:
usage 4 gen/5 SDK/2 TTS/4 GPU, unresolved 0/refund 0/USD null; två generationer var kvar,
inte färsk dispatchauktoritet. Head
`8e7f3e2ee1a31e03291da5b59c40b7d695d4a40b156170e909853c5a1c9f03a6`.
Den gamla policyn rymde inte ytterligare 1 USD inom oreserverat 4,748848.
Generationstak är inte monetärt utrymme; förbrukat/pending/uncertain återanvänds inte.
Originalets tio SDK-dispatchexempel är historiska; läs aktuell usage före nytt prov.

Fullfilsbelopp reserveras före TTS/GPU; stream/fullfil delar UTC-dygnstak.
Originalets tolvminutersfönster kräver åtta minuter kvar; klientdeadline 300 s och
RunPod-TTL 180 s förlängs inte tyst. Utgången auktoritet återöppnas aldrig.
Successor append-only binder föregående journalhash; ingen retry/dubbeljobb.
Nytt prov kräver färska Gitblobs/immutable image/worker-router-entrymanifest,
SDK 7.12.1 och faktisk processreadback, separata Render/Web-child/SDK-envbindningar.
Prepare-only/router404/SDKimport/deterministisk baseline/WSbinary är inte acceptans.

Bind Director/SDK/Cartesia/RunPod, sparad Neonpolicy, serverägd session/runda,
request/jobID och mediahashar till samma körning. Tre cookieägda kontroller före
connect/play/efter END. Redan utfärdad descriptor går genom posegrind/talkö/
`playGeneratedSpeech` i samma produktspelare/WS/video.
`decoded-product-game-queue` behöver faktisk integration/laddad källa,
presenterade avkodade frames/hörbart ljud och två verkliga ended/playbackACK.
Wrappermount utan spelkö, extra WS/video, greeting och framehash räcker inte.
Retry/restart/cancel/terminal/drain/journal före-efter och SQL/HTTPS/restart
krävs också. fullP6Passed förblir false tills hela kontraktet uppfylls.

Prisbacklogens befintliga underlag:
`lab/data/platform-private/p6-cost-evidence-20261004.json`.
Cartesia-nyckelägarens credit/overage/plan, counting-tariff/uttryckligt gratisbevis,
RunPods hela startup/execution/idle/stopp/lagringstak saknas.
Jakob saknar externa Cartesia-kontots inloggning; begär inte nya loginförsök.
Historisk RunPod-UI: endpoint zsudl8tmzcmiv1, RTX 4090 ×1, 1,10 USD/h, max 1/active 0,
idle 5 s/execution 600 s/20 GB disk/ingen networkvolume/FlashBoot Standard ON.
UI-ms mot docs sekundavrundning och kallstart/rabatt/lagring är inte fulltariff;
600 s execution eller TTL404 bevisar inte workerstopp. Daterat underlag,
inte aktuell prisgaranti eller skäl till ny providerinventering.
Historiska primärkällor: [Cartesia](https://www.cartesia.ai/pricing),
[OpenAI tokenräkning](https://developers.openai.com/api/docs/guides/token-counting),
[RunPod debitering](https://docs.runpod.io/serverless/pricing).

Fysisk mic/kamera kräver samtycke/browserpermission och startar OFF på sidöppning;
bilder kräver Luna/Terra. Manuell engångsmic finns utan lokal wakeword.
Produktkameran ON/configGET/ett syntetiskt STT-prov är inte fysisk acceptans.
Ändrad text/audio/video/revision invalidaterar mänsklig approval; baseline/test/
waveform/stillbild/mun-onset bevisar inte synk/kortkontakt.
Fyra dealers delar spelare, två rehearsalplays krävs vid media/spelarändring.
Gamla tysta BO-videor är inte aktivt lipsyncmaterial. Granskad svarskatalog
och automatisk global spelararkivering är inte infört. Katalogens framtida återbruk
kräver godkänt exemplar/exakt paketrevision/ägare/aktuell kontext; namn/klockslag/
rundor/saldo får inte globalåterbrukas. Gallring nollställer inte kostnadsjournaler.

### Avvecklad källa och ansvar som består

| Avvecklad ersatt del | Aktivt ansvar som bevaras |
| --- | --- |
| Adminiframe/BackofficePanel/CSS, legacyadministration, gamla BO-HTML | Nativegrupper/behörigheter, auth/mail/media/operatorhandlers och sparad data |
| boLoad/boSave/bo.json och ersatta konto/partner/adminskrivare | /api/bo/config Neonprojektion; Render spelkommando/wallet/handoff/cancellation |
| Produktens diskprojekt/social/historik/profil/videoindexskrivare | NeonCAS/revision/audit; StudioPage/Studio har tree/activity/events/guide/probe/videos |
| Gamla beständiga generations/speech/voicecachegrenar | Privat Blobpaket/Neonrequest/cost/GPU/operatorjournaler, aktiva klipp/index/kalibrering |
| Legacy produktdisk/envgrenar, CROOT/LAB_VIDEO_ARCHIVE | BO_URL/origins/auth/ingress, Neon/Blob/provider/streamnycklar, QA/Director/Gatewaydisk |

Historiska disk-envmål LAB_STUDIO_DATA_DIR/CROUPIER_PRESENTATION_STUDIO_DIR/
CROUPIER_GENERATIONS_DIR/CROUPIER_GENERATED_SPEECH_DIR avvecklades först efter
ersatta child-config/läsare/skrivare. QA:s 37 envvärden/disk/SDK/journal består OFF.
Dolda pitboss/turnerings-API är inte nya raderingsmål.
Aktiva GPUworker-testmappar, rotens sex testfixtures, tools/web/pipeline/open-claw/
medier/konton/kostnadsjournaler består. De föreslagna services/test/test/ttols/
test/web-vägarna fanns inte. Disponibel byggcache är inte Labtestruntime.

### Import, rollback och backups

P7:s frysta underlag/paritet och P8:s faktiska borttagningar finns i handoffen.
Käll/SQL/manifest/index binds till exakt main; gamla 132-filersplaner/source-artifacts
är historik, inte återanvändbara råhashar efter ändring.
Fyra SQL-checksummor/elva kostnadstabeller/18 aktiva+sex retainedposter/
32 konto-/speltabeller bevaras. Avslutad import återkontrolleras läsande,
inte med nyimport/ändrade kvittotider. Receiptfel ger transaktionsrollback;
ändrad lease/förbrukning blockerar merge/reset. Rättat transportformat fick
separata fortsättningskvitton, inte fabricerad kontinuerlig TTL.

Full extern backup:
`C:/Users/jakem/CroupierBackups/production-disk-retirement-20261004`.
206 filer/10 mappar/125 745 905 källbyte; inventering/metadata/arkivläsbarhet/
remote-lokal-arkivhash PASS. Receipt
`12e99320409fab6b0dc9f3e475d06b4d9aa950d3f87d31cae0b3bf22530596b9`.
Importreceipt
`0f6907e41944f8c142381ffc2e02f218aeda53ea345dfcc38067a5245879b58d`.
Admission/plan/BEFORE/runtime/postdelete står i JOHN och snapshoten.
Gamebackup `C:/Users/jakem/CroupierBackups/neon-game-20261002-132437`:
24 källtabeller/102 rader, 32 Postgrestabellers rad-/sekvensparitet.
Labbbackup/syskonstädning/privat OpenClawdevice-backup står i handoffen.

Återgång kräver stoppade/frysta skrivare, separat kopia av senaste Neon/ledger,
rätt scope/schema/media, aktuell paritet och samordnad rollbackpunkt.
Äldre SQLite/disk aktiveras aldrig blindt efter nya Postgresskrivningar.
Produktbackupen är historisk, inte fallback; aldrig två aktiva writers.
tools/backup-render-state.mjs produktprofil är historisk diskbackup, inte den
nya Neon/Blob-metoden. --quiesced är operatörsförsäkran, inte mätt writerdrain.
QA/Director/Gateway har separat backupansvar; aktiv disk/state består.
[ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md) beskriver procedurerna.

QA:s äldre player_probe_sessions-gap 17→15 och 19→18 består. 24h TTL är möjlig
men inte radvis verifierad utan gamla seen-metadata. Övriga 31 kontotabeller matchar;
original FALSE/compose=false ändras inte. Senare 10/10-bevarandekvitton ersätter
inte äldre luckor. Parent-envs direkta EACCES efter UID-byte är ett redovisat gap,
med barnprocess/källa/stabil deploy/envbindning i stället.

## Ytor och datalagring — produktion och nya QA

| Ansvar | Aktiv källa / gräns |
| --- | --- |
| Publik webb | Vercelprojekt scoutgaming på www.scoutgaming.tech (apex 308 till www). Ytor: `/control`, `/partner`, `/play`. Service web från apps/croupier-frontend; service studio är labb-appen med basePath `/studio`, inte en egen produkt. Spelmotor: Render `croupier-v2`. |
| Konton/wallet/rundor | Neon croupier_game/croupier_auth; Render äger spelauktoritet |
| Zoner | separat croupier_zones/CROUPIER_ZONES_DATABASE_URL, ingen DBfallback |
| Studio/adminpolicy/historik/mediaregister | Neon croupier_studio med scope/CAS/history/audit; Render samma policy |
| Mediefiler/färdiga talpaket | gemensam privat Blob; exakt ägarmetadata/hash i Neon |
| LiveAI/GPU/stream | Render/Director/Gateway/RunPod, Neonjournal/lease/reservation |
| Isolerad nativeQA | separat DB/scope/hostname, befintlig disk/SDK/kvitton, AI/GPU OFF |
| Lokal utveckling | ett koordinerat par, sessionsvakt/lab/data; privata utkast/cache |

### Blob är ett gemensamt filarkiv, inte två tjänster

`store_AqwvebTbBHarOjvG`/`croupier-media-private` är privat Stockholm.
croupier/media/dealers/{astrid,vera,amira,mei}/{runtime,source,review,staging}
samt game/site är filgrupper, inte tjänster. runtime är usage, inte visuell approval.
Layout/blobindex binder ID/path/URL/hash/storlek/proveniens/kalibrering.
Gamla astrid-roten/tolv croupier/videos-adresser är avvecklade efter exakt
migrering; ersättningar består. source/staging kan fortfarande ha aktiva beroenden.

5 oktobers rensning: 2 410 lokalfiler/2 133 120 568 byte,
2 313 Blobobjekt/2 131 771 483 byte. Dedup: 64 lokalkopior/14 216 404 byte,
58 Blobobjekt/12 787 392 byte. Alla 2 514 logiska ID/hash/URL-gränser består
via exakt canonicalPath. Kvar 2 450 fysiska/764 115 959 byte;
Blob 1 800 objekt/769 901 848 byte. 62 huvudobjekt HEAD/fullSHA och 88
prod/QA-GET/fullhash/storlek PASS. Kompletta efterlistor och privata
`lab/data/lane-media-audit/`-receipts/plan/hashar bevaras.
Ingen generell medieradering eller ny mänsklig synkapproval följer av dedup.

### Vad ligger kvar på Render-diskarna?

| Tjänst | ID / disk | Ansvar |
| --- | --- | --- |
| croupier-v2 | srv-datg3j6gekts73amgli0; gamla 5 GB-disk borta | Diskfri Neon/Blob, backup kvar. Historiskt var `autoDeployTrigger: off`. Den 11 oktober nådde c48c6754 Render genom Auto-Deploy och exakt SHA verifierades via /__cloud/version; kontrollera aktuell deploystatus före en eventuell manuell åtgärd. 8 oktober 2026 kl. 12:45 återstartade Jakob manuellt; den deployen innehåller L8/N3. `/api/profile` och `/api/operators/<slug>` svarar live. `ops/neon-game/006-player-profile.sql` kördes 8 oktober 16:48 mot databasen `croupier_game` i Neon-projektet `croupier-production` (hette `croupier-astrid-background-zones-db` till 17:15 samma dag); kolumnerna verifierade, 4 spelare oförändrade. |
| croupier-vercel-preview-qa | srv-datj7l893c1s73ar3u50; /var/data, 1 GB | Separat QA/SDK/data/journal/cache |
| croupier-lab-director | /data/catalog, 1 GB | Katalog/historik/CompanionDB |
| croupier-lab-openclaw | /data/openclaw, 1 GB | Konfiguration/agentfiler/sessioner/sökDB |

Studio-projekt betyder sparade presentationsinställningar/revisioner i Neon,
inte en app eller spelarkontosamling. Vercel-projekt betyder webbpublicering.
Produktens diskfria restart/hash/paritet är verifierade; QA/Director/Gateway behålls.
spelsajt-game-server tillhör Jakeminator123/spelsajt och openclaw-sajtagenten tillhör
Jakeminator123/sajtmaskin; de är inte Croupiers avvecklingsmål.
Karta/envregister anger tjänstebindning/nyckelnamn, aldrig hemliga värden.

### Varför finns flera kort kvar i Vercel? — verifierat 6 oktober

| Projekt | Roll |
| --- | --- |
| scoutgaming | Enda aktiva produktionsprojektet; web + studio från samma repo/main, region fra1. Deployad 8 okt: CI grön `0019df59` och `7445b5a5` |
| scoutgaming-legacy-frontend | Tidigare croupier-frontend; domänlös reserv med Git-byggen och automatisk domäntilldelning avstängda |
| croupier-native-qa-abc92154cb15 | Befintlig isolerad testfrontend |
| croupier-native-studio-qa-abc92154cb15 | Tillhörande isolerad Studio |
| croupier-player-preview-qa | **Raderat 8 okt 18:40** på Jakobs beslut (legacy; inga egna domäner). Hade förlorat Neon-kopplingen 17:25 när Neon `croupier-production` och Blob `croupier-media-private` flyttades till teamet `scoutgaming` (se `ENVIRONMENT-VARIABLES.md`) |

Ett repo/en produktionssajt finns genom ett projekt med två Services.
Det gamla croupier-lab-ui-ID:t bär nu hela projektet, vilket bevarar dess
Neon/Blob/Resend och nycklar. croupier-lab-ui.vercel.app består som kompatibelt
Studio-alias; croupier-frontend.vercel.app ger 308 till www.scoutgaming.tech.
Reservprojektets pause-API gav invalid_deployment eftersom aktiv produktion
saknas; det är inte markerat paused och får inte beskrivas som raderat.
NativeQA byggs manuellt/API från samma explicita reposSHA; ConnectGitRepository
betyder saknad automatisk Gitkoppling.
Äldre player-preview är READY på 22dca5c4/dpl_6ksHgAKr7NoW5NEAuP4xVcJucAok;
proxyrot apps/croupier-frontend, session-GET 421 och /studio 500 i avläsningen.
Den är inte fungerande alternativfront, men Blob/Neonägarskap får inte blindraderas.
Produktionen kräver inte QA-fronter; deras data/delade media ska ändå skyddas.
QA behålls/AI-GPU OFF. Webbapparnas paket/Next-versioner är fortfarande separata.

Frontendpreview kan peka mot produktion; syntetiska konton/rundor kräver isolerad
backend/annan hostname. presentation=local gäller också i molnet.
Speluppspelning/Studioobservation/PartnerSSE/genererat tal är olika kvittoflöden;
Studio startar inte andra uppspelningar. Originalpolicy legacyClipPolicy och
Astrid mediaPolicy/idlePolicy sparas i samma projekt; gamla BO-val read-only 410/
explicit exakt import. Privat Blob går via servern; frontend får inga hemligheter.
Vercelkoppling kopierar inte nycklar till Render.

## Nyckelansvar, säkerhet och kvarvarande luckor

Serverkonfiguration äger hemligheterna: Studio DB/Blob/auth/OpenClawadmin,
Render spel/signering/provider/stream, Director/Gateway egen state/pairing.
QA saknar Cartesia-/RunPodnycklar. Vercelkeys är inte automatiskt Renderkeys.
OPENCLAWAPI_KEY/OPENCLAW_STUDIO_ADMIN_DEVICE_KEY är adminservervägen,
inte runtime-token eller publik credential. Jakobs egna lokala Cartesiakey
ligger ignorerad i `.env`/`lab/.env.local` med förebackup; driftkey är inte därmed bytt.
Bevara privata anslutnings-/utvecklarprofiler och hemligheter utanför Git.

GitGuardian följer scoutgaming i workspace 795524/source 30689542.
Senast verifierat: 12 TRIGGERED/5 IGNORED, en incidentsida/17 locationsidor,
partiell fil-/radtäckning. Se G för öppna fynd och bevisgränser. Historiska
färre incidenter eller fixtureklassningar ersätter inte aktuell läsning.
GitHub queued/no runs, vanlig grön CI eller neutral/skipped är inte incidentfrihet.
Följ AGENTS metadataredaktion; använd befintlig läsbrygga, inga nya scopes
eller automatiska resolve/ignore-ändringar.

Öppna restpunkter: full P6/ny take/läppsynk/kortkontakt, fysisk mic/kamera/
mobil/Safari, ursprunget till ”Film ended without a presented frame”, kvarvarande menyfördröjning,
full zonlagringsacceptans/startsidesflimmer/extern Director/Gatewaybackup och
produktionsmail/invitation/reset. Auth/session-GET200 observerades 1,3–6,45 s,
static mest 0–15 ms; ingen totalmätning eller isolerad rotorsak/freeplan-/providerförklaring.
Två begränsade rättningar ingår: oanvända BO-anrop tas bort utan ändrat authskydd,
och gammal idle-feltext rensas först vid aktuell faktiskt visad bild. Rotorsaken till
den historiska frame-varningen och authlatensen är fortfarande okänd.
QA Resend Free/delivered→Skräppost/testkontocleanup är avgränsat historiskt,
inte användbar invitation/reset i produktion; nya mejl/konton följer inte automatiskt.
Produktion har nu giltig domänbegränsad Resend-sändnyckel och
`CROUPIER_STUDIO_MAIL_FROM=no-reply@scoutgaming.tech`. Sandboxtransporten är
verifierad; full riktig invitation/reset återstår enligt F. Sending-only ger
inte behörighet att lista domäner och en sådan 401 bevisar inte ogiltig sändnyckel.
GPUshutdown/privat zonbild/OpenClawnavigation är rättade och verifierade avgränsat,
inte kvarstående obehandlade funktionsfel; detaljer/shutdownbudget i JOHN.

## Lokal start och sökning

Starta bara när begärt: `node lab/start.mjs --offline --no-open` är isolerad
preview; `node lab/start.mjs --no-open` följer sparad ansluten profil.
Ett serverpar/sessionsvakt, bevarade utkast/spel och återanvända browserflikar.
Efter Neoncutover kan offlineStudio ge 503 studio_read_storage_unavailable,
ingen auth/lagringsfallback till QA. Lokal guestpolicy består enligt AGENTS.
Byggcache rensas bara utan berörda sessioner/processer; behåll Labtestruntime.

.ignore/Cursorignore begränsar sök/context/index, inte Git/build/filernas existens.
Sök riktat källtext/JSON; binärer/cache/dependencies/private state undantas.
Personarkivets gräns kringgås inte med no-ignore/Githistorik/backups.
Tools används delvis i runtime; test/pipeline/media är inte generella raderingsmål.

## Leverans och kontroll

Filclaims via absoluta agent-talk, status mellan steg och .git-claim vid commit.
Före integration/push: `node tools/croupier-chef.mjs status`, ingen autoroll.
Samordna med eventuell aktiv ägare innan gemensam integration. Gamla
arbetsfördelningar i historiken gäller inte automatiskt ett nytt uppdrag.
Leverans: `node tools/push-github-work.mjs --check`, sedan helpern utan --check.
Verifiera repo/main/fast-forward/remoteSHA, aldrig forcepush/annan destination.
Hooks ny checkout: core.hooksPath=.githooks. GPUimage är separat release.

Rena docs/indexignorecommits kan ha snabba env/GitHubpolicy/hooktester;
kod/config/test/media fullregression, CI alltid full.
Fullmanuell: `sh .githooks/pre-commit --full`.
Plan: `node tools/precommit-checks.mjs --plan`.
Media/spelarändring kräver audit--probe, fyra dealers/två rehearsalplays och
ny visuell approval för ändrad audio/video/hash. Här ändras inga sådana bytes.
Efter push återläs SHA/CI/Vercel/Render/GG; testpass/hash är inte synk/mobil/backup.

Systemkartans exporter är frysta till sitt käll-SHA och observationstid.
Aktuell resultatkoppling beskrivs i E. Saknat eller skippat prov är inte grönt.
Den passiva CI-reportern och dess artifacts gör inga provider-/DB-mutationer.

## Historik

Den fullständiga tidslinjen och tidigare deployments ligger i den frysta
historiklänken överst. Privata loggar och backupfiler är inte borttagna.
Den aktiva checklistan ovan är statuskällan.
