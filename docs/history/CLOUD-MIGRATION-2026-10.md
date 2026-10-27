# Scoutgaming: målbild, migrationsstatus och kvarvarande arbete

Kevin-planen avstämd 25 oktober 2026. Övriga delkvitton är daterade var för sig; detta är produktens övergripande migrationsöversikt.
Aktuell överlämning och nästa leverans finns i [NEXT-AGENT](../NEXT-AGENT.md); daterade kvitton i [handoffhistoriken](JOHN-HANDOFF-2026-10.md).
Begrepp ägs av [TERMINOLOGI](../../apps/studio/docs/TERMINOLOGI.md), tekniska format av
[runtime-referensen](../LOCAL-PRESENTATION-RUNTIME.md).

## Selektiv Kevin-integration — avstämd 25 oktober 2026

[Masterplanen](../../migrering/MASTERPLAN.md) och befintliga aktivitetsfiler är reviderade mot main `0e457589e84dcef3147ee54f01883ce5e459e356` efter #378/#380–#385. **Procentsatsen finns bara i [STATUS.md](../../migrering/STATUS.md) och mäter helt verifierade aktiviteter, inte andelen importerad kod (vid denna avstämning 9/20).** PR #334/#336/#345/#348 är mergade. #333:s produktinnehåll är redan representerat på main; #315/#323 är äldre test-PR:ar och utgör ingen produktmergekö.

Nästa värde ligger i exakt medie-/posebindning och full Admin → publicering → spel-acceptans. #386 har gjort de fyra befintliga K07-sviterna obligatoriska och annonserar idle-rotation i capability v28; Render `23debde7155346e30ee5a3f3dfbe54cd09ea2789`, hälsa och v28 är återlästa. #378/#381:s 24-klippspolicy är publicerad enligt #382: West Bet revision 2, 24/24 exakta media och avgränsad faktisk uppspelning; ingen PAOW-insats/full runda. Mergade #380/#383/#384/#385 återanvänds: Studio → Sceneditor (/admin/scenes) är enda placeringseditorn. publish-scene-layout publicerar geometri från kanonisk sparad mall med projekt-, paket- och registerrevisioner; materialutbud publiceras separat. Den separata bolagsgeometrin och update-scene-layout är borttagna och ska inte återskapas. PR385:s driftkvitto och handoffens kompletta Dragan-demohand är delacceptans; fysisk Safari och sju samtidiga händer är inte verifierade. Redundant Dragan-materialutkast är kastat, medan aktuella material, fem bordsprofiler och PAOW-data bevaras. Admins specifika rotationsgrind kompletteras med 71/71 prov och oberoende review; leveranskvittot finns i handoffen. Kompatibel restore samt film-/tal- och samlad molnacceptans kvarstår. [Motivering och slutkriterier](MASTERPLAN-2026-10.md#motivering-och-när-migreringen-är-klar) skiljer färdig dokumentation från färdig migration; den tekniska Neon-/Blob-flyttens avslut nedan gäller fortfarande.

**Ingen återinförd lokal produktväg:** Neon använder PostgreSQL/SQL; återanvänd parameteriserade adapterfrågor och Admins behörighets-/revisionsstyrda writers. Originalklipp ligger i privat Vercel Blob, metadata i Neon. Inga nya SQLitefixtures, lokala filregister eller connected-local-starter ingår. Befintliga isolerade kod-/PG-prov är delbevis; molnacceptans kräver godkänd isolerad Neon/Blob-miljö och identifierade driftsversioner. Aktiva moduler med äldre namn och verifierad tillfällig Blob-cache får inte förväxlas med lokala produktregister. Se [utökad prioriteringsmatris](MASTERPLAN-2026-10.md#prioriterad-väg-till-910) och [QA-gränser](MASTERPLAN-2026-10.md#qa-sql-och-lagring-utan-återinförd-legacy).

[Utförandestatus](../../migrering/STATUS.md) genereras fortsatt från en enda status.json. Status/beroenden/vikter är oförändrade; detta dokumentarbete ger inga poäng. Det historiska `kevin-merge-admin@5aa7ed10...` förblir accepterad generell referens; senare källor kräver avgränsad deltareview. Den avslutade Neon-/Blob-flytten återöppnas inte.

## Aktuellt flöde på main — 19 oktober 2026

Öppna den publicerade produkten från [Admin](https://www.scoutgaming.tech/admin)
eller [lobbyn](https://www.scoutgaming.tech/lobby). Följ de aktuella
[användarstegen](../../apps/studio/docs/README.md); produktens namn och ansvar förklaras
i [TERMINOLOGI](../../apps/studio/docs/TERMINOLOGI.md). Sparat bolag, rum,
sammansättning och spel följer länkarna. Rumsändringar använder befintlig scoped
writer; scen-/dealermall och rum är skilda skrivmål.

PR274–283 är levererade. Rumsflödet och den verifierade legacy-/teststädningen
är integrerade i main `a2dc503e2c63ef49107c0a1074880349e1898c61`, med grön
[main-CI](https://github.com/Jakeminator123/scoutgaming/actions/runs/39206231216).
Vercel och Render körde samma SHA vid MERGE4:s egen kontroll 19 oktober
05:55:42 UTC; spelmotorns hälsa var ok. UI/UX2:s separata N1-läsning verifierade
rätt rum/scen och rensat gammalt dealerbokmärke utan spel eller sparningar.
[Handoffens slutkvitto](JOHN-HANDOFF-2026-10.md#merge4-verifierad-legacy-städning-och-main-flöde--19-oktober-2026)
skiljer dessa bevis från senare driftprov. Läs faktisk deployment och
`/__cloud/version` inför återställning eller nytt prov.

Kontrollplanet för Av/Sparläge och executor är kodleverans. PR276 dokumenterar
den separat utförda behörighetsrättningen; PR279 rättar molnstartens child-env.
POST-LIPSYNC5:s senare GPU-jobb avslutades med workerfel vid bankhämtningen
(HTTP403), utan godkänd taluppspelning. Normal Av, noll workers/öppna sessioner,
profilens preparation-läge och avstängd talflagga verifierades av POST före
fortsatt merge. Terminaljobbets callbackväntan och bankens HTTP-åtkomst hanteras
separat; inga nya budget-/kapacitetsgränser införs av UI-/städleveransen.
Aktiverat rörligt tal, bildkvalitet och budgetavstämning kräver sina egna belägg.
Aktuellt prov och nästa konkreta rättning finns i
[talhandoffen](JOHN-HANDOFF-2026-10.md#post-lipsync5-produktionsprov).

Normal lokal start visar produktens adress. Den SQLite-baserade `--offline`-fixturen
och de anslutna lokallägena är pensionerade 27 oktober 2026 (en produktväg). Äldre lokala
register, engångsexporter eller testspelare ska aldrig återinföras som fallback
för publicerad drift. Den avslutade registerflyttens oanropade
`prepareLegacyStudioSnapshot` och dess enda test är pensionerade. Generella
snapshot-/importformat, återställningsunderlag och aktiva kompatibilitetsregler
behålls. En provfil tas bort när beteendet är ersatt eller konsumenten saknas;
aktuella auth-, rum-, spel-, media- och kostnadsgränser verifieras fortsatt.

## Teknisk register-/runtimeflytt: avslutad i produktion

Neon som produktregister och Blob som källa för registrerade spelmedia är implementerat, mergat
och driftsatt. Migrationsbaseline från 16 oktober bevaras som historiskt
kvitto nedan. Den beslutade strukturflytten är också slutverifierad,
inklusive den reproducerade lokala klippmappningsregressionen i PR237.
Accepterad strukturrevision är `2ba5bf03437b8f7da8a60d06335831abaf50f162`:
main-CI 39112728886 SUCCESS, Vercel READY och Render LIVE med rätt SHA den
18 oktober. Inga ytterligare rotflyttar återstår i strukturplanen.

[Handoffens slutkvitto](JOHN-HANDOFF-2026-10.md#strukturens-slutkvitto) skiljer CI,
frontend, game och Gateway/Director åt. Senare PR238:s workerdiagnostik och
PR240:s budgetkontroll är levererade på apprevision
`209d62f436786f9dae69c7ee6f1b256253ab6805`, med grön main-CI, verifierad
produktion och publicerad privat workerimage. De är separata från strukturens
acceptans. Den äldre bankhämtningens chunked-brist rättades i PR242; senare
prov nådde GPU/TTS. PR250:s buffertfix slutförde ett tekniskt vilotalprov med
54/54 rutor. Det är inte slutgodkänd läppsynk under utdelning. Aktuellt
rörelseprov, prestanda, bevaring, kostnadsmandat och avveckling finns endast i
[talhandoffen](JOHN-HANDOFF-2026-10.md#dragan-talstatus). Publicerad modellcache och
varm serverantagning är levererade i PR255–257; isolerat RTX4090-prov har
verifierat återanvändning samt avbrott och omladdning. PR262 är verifierat
på både www och croupier-v2; migration 015 applicerades och återlästes
21:24:12 UTC utan ändrad beviljad budget eller reservationshistorik.
Denna leverans gör 015 obligatorisk för readiness, Studio och båda
importörerna. Driftkvittot för `4cee9bc2` är daterat före denna slutleverans.
T3/T4 slutförde vardera en produktionsreplik; T5 avbröts av inspelningsverktyget.
T6 slutförde därefter två vilorepliker på samma A40-worker med cachemiss följd
av cacheträff och komplett mediefångst. Ingen produktions-DEAL eller insats
ingick. T6 är avvecklat, talflaggan av och fem privata Blob-manifest är
fullåterlästa. Faktisk providerdebitering är ännu inte slutavstämd för T6;
reserver behålls enligt handoffen. Automatisk lagring av moving-resultat i
svarsbiblioteket återstår. Dessa produktfrågor återöppnar inte den genomförda
Neon-/Blob-migreringen.

## Ytor och datalagring — produktion och nya QA

| Ansvar | Aktiv källa och tjänst |
| --- | --- |
| Intern personal, bolag, spelare | `/admin`, `/partner`, `/lobby` på www.scoutgaming.tech. Ett Vercel-projekt/team: `scoutgaming`. |
| Webb och Studio | `apps/web/` och `apps/studio/`; Vercels webb-/Studio-tjänster. `/studio` är teknisk basePath. |
| Spelmotor och live-transport | Render `croupier-v3`, källkod i `services/game/`; kort, shoe, saldo och avräkning är serverägda. |
| Produktregister | Neon: konton/spel, Studio-projekt, administration, scoped rum/publicering, mediekatalog och svarsbibliotekets metadata. |
| Mediebyte | Privat Blob; exakta identiteter, hashbindningar och behörigheter följer registret. |
| Director/Gateway | Aktiva OpenClaw-tjänster med egen konfiguration/sessioner på `/data/catalog` respektive `/data/openclaw`; inga alternativa produktregister. |
| Isolerade tester | Egna tillfälliga data/scope. QA/Preview-utbyggnad är pausad; ingen automatisk återstart eller produktionsfallback. |

Aktuell motor är `croupier-v3`, enligt gällande AGENTS och handoffens versionsbundna driftkvitton. [Driftreceptet](../../ops/cloud/RENDER-V3.md) beskriver spelmotorn utan Studio-process (`ops/cloud/Dockerfile.game`, `CROUPIER_CLOUD_LAB_CHILD=0`); läs aktuella tjänst-ID:n i återställningsguiden inför driftåtgärd. Den tidigare uppgiften att v3 endast var ett planerat recept är förbrukad.

Normal start `node apps/studio/start.mjs --no-open` skriver den publicerade lobbyns
adress. Den tidigare `--offline`-fixturen är pensionerad 27 oktober 2026.
Lokala arbetsfiler, katalogexporter och SQLite-backuper är authoring/historik,
inte produktens runtimefallback. `apps/studio/lib` innehåller aktiva appkopplingar; gemensamma tjänster finns
också i `packages/`. Se README:s aktuella ansvarskarta.
Äldre Control-komponenter och sparade ID:n behålls där konsumenter finns.
Dragan är ordinarie dealer; Astrid är märkt legacyreferens utan trelagersversion.

## Levererat och verifierat

| Leverans | Exakt bevis |
| --- | --- |
| Admin-konsolidering, scenzoom, filmvisare, Astrids märkning | [PR185](https://github.com/Jakeminator123/scoutgaming/pull/185), main `3165ab6df94c965aa3db1f986b8532a0f9260073`; föregick registeromkopplingen. |
| Schema 012 och import | Befintliga Neon `production/croupier`, databas `croupier_game`, projekt `wandering-hill-60561912`, branch `br-flat-fog-b161a6r8`. Separat återläsning 16 oktober 18:38 UTC. |
| Schema 013 för rörligt tal | Additiv migration tillämpad och återläst 17 oktober 12:46 UTC i samma speldatabas och scope. Binder antagna talsessioner till exakta mediereferenser. Verifierar schemat, inte GPU-drift eller synlig läppsynk. |
| Runtime kräver 012, läser katalog/replikmetadata från Neon och byte från Blob | [PR186](https://github.com/Jakeminator123/scoutgaming/pull/186), main `2ea080bc3e75cf0207e3c155f9b4018f6a8d301e`. [PR-CI 38953385914](https://github.com/Jakeminator123/scoutgaming/actions/runs/38953385914) och [main-CI 38954442660](https://github.com/Jakeminator123/scoutgaming/actions/runs/38954442660) gröna, inklusive isolerad riktig PostgreSQL, omstart, HTTPS och migrationsberedskap. |
| Schema 014 och strukturens slutrevision | Required budget-/journalmigration installerad; readiness ready med pending=[] 18 oktober 08:53:56 UTC. [PR237](https://github.com/Jakeminator123/scoutgaming/pull/237), main `2ba5bf03437b8f7da8a60d06335831abaf50f162`, [main-CI 39112728886](https://github.com/Jakeminator123/scoutgaming/actions/runs/39112728886) SUCCESS. Fullt driftkvitto i handoffen. |
| Historisk samlad slutredovisning | [PR187](https://github.com/Jakeminator123/scoutgaming/pull/187), migrationsbaseline `b38c56572158d6deaeb6823b3a66bf5fbca8af7e`. |

012:s SQL-kontrollsumma:
`5618ae06bcae43c77778f2d7bc777e86d2fabafa2f26c5f139d90d06dc72d291`.
Katalogrevision:
`9201007d27c7b6464cbd905123c59b48608083a1af726ee9f896767e6e7bff20`.

Importkvittot omfattar 760 layoutposter, 542 Blob-referenser, 51 bankklipp,
18 exakta JSON-manifest och 12 historiska replikposter. Alla 514 unika
katalogobjekt strömlästes mot SHA-256, storlek och medietyp. De 79 befintliga
medieposterna samt project/administration/social-policy var hashoförändrade.
Inga filmer regenererades eller mediebyte flyttades.

### Historiskt läsande produktionskvitto — 16 oktober 2026

Huvudagentens kontroll vid denna historiska baseline: Vercel `dpl_FuDAT4aRmniTWGbvgEPXpa874rip` READY
och Render `dep-db97r50ae00c739b10d0` live på samma fullständiga `b38c5657`-SHA
ovan. Render health/version gav 200. Neon-identiteterna i tabellen stämmer;
ledgern är 001–008, 011, 012 och 012:s kontrollsumma matchar LF-normaliserad
källa. Katalogrevisionen ovan är oförändrad: 760 layoutposter, 542 Blobrefs,
51 presentationposter och 12 talposter.

Två nya GET-/hashstickprov via `www.scoutgaming.tech/media/` matchar Neon exakt:

- `dealers/astrid/runtime/assets/lab/astrid-pilot.mp4`: 200, 667 364 byte,
  SHA-256 `61d7d1c57b1cf720113bfa12dc8ad63175f5000fb6c2b29685229aa450523ed5`.
- `dealers/astrid/runtime/composited/astrid-blue-box4/mask-manifest.json`:
  200, 626 byte, SHA-256 `bf5122706cc1ff3228565a1e42b61b96ed9bda3ee196a8ee24dd53401019d3aa`.

De 514 fulla Blob-återläsningarna tillhör det äldre PR186-importkvittot,
inte den nya stickprovskörningen. Ingen ny skrivning eller visuell
läppsynk-/spelbedömning ingår i den färska kontrollen.

### Föregående PR186-kvitto

16 oktober 19:32 UTC: Vercel `dpl_9k1cogPcn5zh6wxZJxoN97iXtoYV` READY,
Render `dep-db97ls49v7es73f419v0` live på `2ea080bc`. Engine version
bekräftade full SHA och health gav 200. Publikt manifest (626 byte) och
`astrid-pilot.mp4` (667 364 byte) gav 200 med exakt kataloghash;
direkt Render-media gav förväntad ingressspärr 421. Detta var läsande
driftverifiering utan nya produktionsdata, inte läppsynk- eller spelprov.

## Verkliga migrationsfel och kvarvarande utredningsspår

Inget register-/lagringsfel identifierades i baselineavstämningen.
Den senare lokala klippmappningsregressionen från rotflytten är rättad
och verifierad i PR237. Ingen äldre öppen checkbox är ensam bevis på ett sådant fel.
Nytt reproducerat fel i auth, bolags-/rumsgränser, publicering, schema eller
beständig lagring ska behandlas som fel i den berörda kedjan, inte döljas
som kosmetik. De äldre observationerna här har inte omverifierats i detta pass:

- Blandade frysta 16/17-eventpaket har gett publiceringskonflikt 409.
  En tidigare kompatibilitetsrättning levererades; återstående fall kräver
  exakt paket/revision och isolerat omprov, inte omskrivning av historik.
- `studio_request_rejected` vid automatisk korsdomänsnavigering och
  auth/session-GET på 1,3–6,45 s är äldre observationer. Manuella returer och
  senare Admin-login/navigation har egna kvitton; full roll-/destinationsmatris
  är inte därmed nyverifierad. Behåll skydden och reproducera konkret fel.
- Äldre uppladdning `kortflipp_kling_1080p.mp4` kunde inte väljas som
  idle-variant. Kontrollera listning → val → sparning → återläsning med
  isolerade data om felet återkommer; inget aktuellt rotorsaksbevis finns.
- Historisk ”Film ended without a presented frame”, zoners
  spar-/omstartsflöde och startsidesflimmer saknar full rotorsaksutredning.
  Detta är separata funktionsspår, inte belagda fel i Neon-omkopplingen.

Avstämningen 18 oktober 18:32 UTC fann dessutom 56 äldre generiska
`submission_uncertain`-poster utan moving-bindning, aktuell aktivitet eller
levande lease. De är olöst historisk observationsskuld, inte frikända eller
återbetalda jobb. Ingen rensning ingick i det aktuella moving-provets
journalamendment. Exakt avgränsning och kvitto finns i
[talhandoffen](JOHN-HANDOFF-2026-10.md#dragan-talstatus); fyndet är inte i sig ett
belagt fel i den genomförda register-/lagringsflytten.

## Separat produktarbete och öppna driftansvar

| Område | Kvarstående konkret ansvar |
| --- | --- |
| N2/operatörsdata | Spelare, transaktioner och rapporter från motorns auktoritativa ledger; bolagsbunden nyckel-/spelaridentitet, valuta/precision, idempotens och exportisolering. Ingen andra skrivbar plånbok i Studio. |
| Adminlogg och spelarflöde | Global ändringslogg saknar anslutet API. `/lobby` saknar fortfarande `/play`-vyns bordval enligt baselinen; båda är öppna produktluckor och har inte omverifierats eller åtgärdats i detta pass. |
| Konto och integration | Partnerreset, riktig 2FA, scoped API-nycklar/rotation, wallet-/webhookprov och säker onboarding/brandimport. Livebord, dealer-/limitbyten, schemaläggning, spelaransvar och rapport/statistik/revshare hör till senare produktleveranser. Marker/chips (L4) är inte klara. |
| Riktig invite/reset | Resendtransport till sandbox är verifierad; verklig mottagaraktivering, inkorg och resetkedja saknar komplett kvitto. John-adressen studsade och var spärrad hos provider; bekräfta adress och providerstatus före nytt utskick. Jakob äger de tidigare verkliga utskicken. |
| OpenClaw/Adminrobot | N1-engångslänk, ny profil, negativa roller, session efter sajtutloggning och driftsatt modellkonfiguration kräver avgränsade funktionsprov. Fem roller bevisar inte fem servrar eller inaktiv trafik. Mät före pensionering. |
| Nytt tal/läppsynk | Exakt tidigare film med självutdelning är visuellt godkänd; nya cache-/replayfiler är inte det. Publicerad modellcache klarade isolerat kallt/varmt RTX4090-prov, avbrott och omladdning. Varm serverantagning och PR262:s tekniska kapacitet är levererade; 015 är applicerad och denna leverans gör den obligatorisk. T6 verifierade två kompletta vilorepliker på samma A40-worker, cachemiss följd av cacheträff, utan DEAL/insats. Talflaggan är åter av och provresurserna avvecklade; 24 timmars varm drift är inte aktiverad eller verifierad. Automatisk beständig lagring av moving-resultat och riktig mikrofon-/bild-E2E återstår. Fem privata Blob-manifest är fullåterlästa och bevarar källreferenser, isolerade resultat samt T3/T4/T6 utan nya Admin-klipp. Tekniska reservationer och kvarhållna reserver är inte faktisk debitering; T6:s slutkostnad är ännu obekräftad. [Handoff](JOHN-HANDOFF-2026-10.md#dragan-talstatus) äger exakta versioner, filgodkännanden och daterade drift-/kostnads-/avvecklingskvitton. |
| Riktad test- och instruktionstädning | PR243 och PR246 är mergade: gemensamt dokumenturval, rätt klient-/migrationsurval, riktad agentstatus och Moving-workerns CPU/image-kontroll i obligatorisk CI. Efterfixen ersätter chattestets källutskärning med importerad logik och beteendeprov samt förtydligar Next-/verktygs-env och daterad dokumentstatus. Efterfixen är levererad i PR252. Separat direktklon av main `2e9b53388636effa42bea27f451845280375b9ef` passerade låsta installationer, byggen/typkontroller, fokuserade tester, verklig offline-start, Director och isolerad SQL/omstart/HTTPS utan gamla projektfiler. Organisationsavslutet är verifierat; [renklonkvittot](JOHN-HANDOFF-2026-10.md#huvudagent5-renklon-och-organisationsavslut--18-oktober-2026) redovisar isoleringsgränser och separata privata QA-krav. Begränsad browser-importupptäckt och äldre timeout-/lagringsuppgifter är separata underhållsobservationer, inte belagda orsaker till workerfelet. Auth, ägare, session, revision, mediahashar, avbrott och serverägda spelregler består. |
| Radering och äldre mediereferenser | B18: permanent klippradering med beroendespärr/journal; B19: nya talklipp från grundbild. De planerade 009/010-numren är historiska förslag, inte tillstånd att ändra dagens ledger. Gamla bankindexreferenser, saknade `speech-media`-filer och äldre `runtime/hands`-byggare behöver separat konsument-/källbedömning. |
| Plattform | A22b/`packages/platform` väntar på Jakobs beslut i [ärende #52](https://github.com/Jakeminator123/scoutgaming/issues/52). Ingen katalogflytt eller full frikoppling är beställd genom detta statuspass. |
| Backup och QA | Extern fullbackup/återläsning av Director/Gateway återstår. QA:s tidigare probeparitetsluckor (17→15, 19→18) och EACCES-åtkomstgräns är historiska, inte förklarade av antagen TTL. Ursprunglig Preview-ingresshemlighet är inte återställd. Se återställningsguiden. |

PAOW-historikens 12 replikposter har 24 sedan tidigare saknade Blob-filer.
De återaktiverar ingen dealer. Blob/Neon-inventeringen fann även 30 registrerade
klipp utan explicit aktuell prodreferens och 602 objekt utan referens i lästa
källor; detta bevisar inte raderingsbarhet. Metod och gränser finns i
[lagringsavstämningen](../storage/BLOB-NEON.md) och
[inventeringen](BLOB-NEON-INVENTERING-2026-10-16.md).

## Admin checkpoints C1C9

Detta är en kort kontinuitetslista, inte nio nya manuella godkännandegrindar.

| Del | Bevarat kontrakt och återstående avgränsning |
| --- | --- |
| C1–C3 | Ansvar, navigation och sammanhållen N1-layout är levererade i flera steg. Nya layoutfel testas där de uppstår; äldre kvitton friskförklarar inte varje vy. |
| C4 | Dealer, bolag, verkligt rum, spel och sammansättning följer meny/direktlänk/loginretur/historik. Full roll-/destinationsmatris är inte omverifierad här. |
| C5 | Spara/återläsa, 409-konflikt, historik och verkliga osparade ändringar har riktad täckning. Ett valt rum gör inte en gemensam mallskrivning rumsspecifik. |
| C6 | Behörighet, scoped `roomOverrides`, granskad revision och N1→N2→N3-publicering har isolerade prov. Baselinekvittots noll aktiva bolag/rum/sammansättningar var avsiktligt; antalet är inte omverifierat här och gamla raderade demorumsprov är historik. |
| C7 | Riktad verifiering av ändrade spel-/mediebeteenden; generellt krav på två spel eller manuell spelacceptans är ersatt. Ingen ny visuell synkbedömning påstås. |
| C8–C9 | Konsumentstyrd städning, kanoniska guider, liten PR, ägarskapskontroll och obligatorisk CI. Aktiva Control-komponenter/`apps/studio/lib` är inte förbrukade bara genom sina namn. |

## Verifiering, leverans och återställning

Jakob har ersatt det generella tvåspelskravet och manuell spelacceptans som
grind för commit, PR, merge eller avslutad uppgift. Välj riktade prov efter
ändringen och konkret risk. Upprepad uppspelning testas när återstart,
städning eller flera uppspelningar är det ändrade beteendet. Auth, rumsgränser,
revision, sparande, pengar och spelregler behåller relevant täckning; full CI
är kvar. Äldre P6-/fyradealerskrav är inte automatiska migrationshinder.
Visuell läppsynk får fortfarande inte påstås från hash eller gröna tester.

Obligatoriskt nytt schema ska finnas före merge. Undantaget
`deploymentOptional` kräver först tolerant kod, sedan uttryckligt auktoriserad
migration och därefter en PR som gör versionen obligatorisk. Ändra aldrig
checksumfrysta scheman/ledger för att få grön CI.

Migration 018 (`018-gpu-daily-budget-40.sql`, 19 oktober 2026) höjer
dygnstaket för GPU-reservationer 20 → 40 USD på Jakobs beslut och är
`deploymentOptional`: koden fungerar vid min(sparad policy, konfigurerat tak)
tills den är applicerad. Appliceras med `node tools/check-migration-readiness.mjs
--apply` (`CROUPIER_MIGRATION_CONFIRM=apply-pending`); därefter höjs själva
policyraden med `journal.amendBudgetPolicy` och dess bekräftelse. Status för
produktion står i [NEXT-AGENT](../NEXT-AGENT.md).

Migration 019 (`019-trial-budget-ceilings.sql`, 21 oktober 2026) vidgar på
samma sätt grantens CHECK-gränser (moving_speech_bindings och
moving_speech_budget_amendments) 45 → 150 USD och dygnstaket 40 → 60 USD;
`deploymentOptional`, samma appliceringsväg. En befintlig grant kräver
fortfarande sin egen finansierade amendment efteråt.

GitGuardian: läsningen 18 oktober gav 2 öppna och 18 ignorerade incidenter.
Platsmetadata är delvis ofullständig och historisk skanning har status too_large.
Grön produkt-CI bevisar inte full säkerhetstäckning. Inga incidenter ändras här.

[ENVIRONMENT-RESTORATION](../ENVIRONMENT-RESTORATION.md) är proceduren för
backuper och rollback; [ENVIRONMENT-VARIABLES](../ENVIRONMENT-VARIABLES.md)
äger konfiguration, profiler och nyckelansvar. Bevara senaste Neon/ledger och
frys skrivare före återgång. Historisk diskbackup är aldrig automatisk fallback
eller en andra writer. Privata original, env och importkvitton stannar utanför Git.

## Exakt historik i stället för upprepade kvitton

- [Migrationsbaseline: CLOUD på b38c5657](https://github.com/Jakeminator123/scoutgaming/blob/b38c56572158d6deaeb6823b3a66bf5fbca8af7e/docs/CLOUD-MIGRATION.md).
- [Migrationsbaseline: handoff på b38c5657](https://github.com/Jakeminator123/scoutgaming/blob/b38c56572158d6deaeb6823b3a66bf5fbca8af7e/docs/JOHN-HANDOFF.md).
- [Levererat strukturpass på f066ba4d](https://github.com/Jakeminator123/scoutgaming/blob/f066ba4d713f5af0191b7ba09f4b299755ad55c3/docs/JOHN-HANDOFF.md), [PR190](https://github.com/Jakeminator123/scoutgaming/pull/190).
- Separat [PR188](https://github.com/Jakeminator123/scoutgaming/pull/188), head `1eb42c3e`: frivillig kartrapportering hålls skild från produktprov; [full CI 38961755164](https://github.com/Jakeminator123/scoutgaming/actions/runs/38961755164) grön. PR188 och PR190 verifierades på produktionens `d7dd04dcbc1c3eab6358ac64b63ad7b5d97a9166` den 17 oktober; detta är ett historiskt kvitto.
