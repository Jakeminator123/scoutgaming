# Aktuell handoff — Scoutgaming

## Tillägg 13 oktober: avgränsad förenkling av legacy och rumsval

Arbetet började på `cc63db71` och är integrerat med senare `main`
`1d1f4c12` (#73/#75/#76/#77/#79). Leveransen ligger i ett eget worktree på
`codex/simplify-studio-legacy`, med en PR till `main` för Jakobs granskning.
Adminens personväljare heter **Dealer**. Rummets egna val öppnar det befintliga
rumsbundna utseendeflödet för exakt bolag och rum i en ny flik, så Studio-utkastet
behålls. Felaktiga, främmande eller inte längre publicerade rum visar ett hinder
i stället för att öppna bolagets standardinställningar.

Bakgrund/bord/geometri i Studio hör till en gemensam sammansättningsmall.
Den gamla direkta bordsväljaren i rumskontexten är borttagen; mallpanelen visar
berörda bolag/rum och aktiveras genom **Redigera gemensam mall**. Rummets val
använder befintliga `roomOverrides`, revisioner och granskad publicering. Ingen
ny parallell skrivmodell eller automatisk publicering tillkommer.

Moderna operatorägda rum valideras utan obligatoriska `classic/high/vip`,
pitboss eller turneringar. Historiska rumsrader kräver fortfarande dessa
domäner; varje legacyfält som finns valideras strikt. Sparningar bevarar
befintliga fält, CAS, historik och audit. Ingen produktionsrad migreras.

`lab/` är fortfarande aktiv Studio-kod och används även av gemensamma
domänfunktioner. `open-claw/lab/` hör till AI-/talanslutningen.
`lissabon-stream-lane` är en fungerande runtimeflagga för bland annat kamera,
spelresultat och hälsokontroller. `web/lissabon-profiles.mjs` behåller lokala
demoprofiler, avstängda för PostgreSQL/produktion. Astrids tal-/klippkedja,
mediebytes och frysta publiceringar ändras inte av denna PR.

Aktiva guider och agentinstruktioner följer nu `/admin`, `/partner`, `/lobby`
och tre visuella lager, med gamla rutter som kompatibilitet. Ordlistan skiljer
dealeridentitet från klippkategori och återställning av bolag öppnar inte rum.
SL-03:s daterade felpåstående är rättat mot nuvarande kod och regressioner.
Senaste mains produktmodell och spelval bevaras; rapportens flerspelsförslag
införs inte som ett nytt krav. Utökade miljövarianter och publiceringsversion
per användning kräver separata kontrakt och genomförs inte genom namnbyte
eller borttagna konfliktspärrar.

Lokalt: hela Lab-sviten 1 851 godkända/två skips, båda typkontrollerna och
Studio-/designbyggen passerar; noll föräldralösa tester. Full ordinarie hook
körd på den integrerade koden: 3 246 godkända, sju skips och ett oförändrat
OS-test som saknar processens födelseidentitet i denna körmiljö. Loopbackproven
körs med 127.0.0.2 utanför miljöns nätproxy. Webbläsarinstallation kunde inte
slutföras; React-/SSR-/navigationstester är inte visuell browseracceptans.
Slutlig PR-head och ordinarie CI-resultat redovisas i PR:en. Produktionsdatabas,
driftkonfiguration, publicering och betald generering ingår inte.

Mergegranskningen bevarar #77:s korta mappguider och sammanför dessa med
rumsvalens tekniska förtydliganden. 180 riktade regressionsprov passerar på
den kombinerade versionen, inklusive behöriga rumsval, inloggning, explicita
malländringar, frysta paket, legacyvalidering och CI-/hookgränser. Inga tester
är föräldralösa. GitHub kör hela produktkontrollen före merge.

## Tydligare mappansvar och legacyinstruktioner, 13 oktober

Förenklingen utgår från `main` `978f3bce` i eget worktree och har därefter
synkats med dokumenttillägget på `ba2eb2bd`. Rotguiden är
kortad och hänvisar till ordlistan som enda produktmodell. Befintliga guider
och fem nya mapp-README skiljer aktiv frontend/Studio/spelserver/presentation,
talservice och medieverktyg från referensytor och genererade byggmappar.
Gamla kvadratiska/indexerade exportrecept är märkta i fem skripthuvuden;
deras körbara kod är oförändrad. Inaktiv nästlad worker-CI är borttagen;
rotens worker-/gatewaykontroller kvarstår. Dokumentationsläget har en exakt
lista för dessa guider; kod, config, CI och typändringar behåller full regression.

Studio-produktionsbygge och 94 byggspår, 37 riktade repository-/hookprov,
21 gatewayprov, 15 Python-workerprov, 29 rouletteprov samt 95 lokala
dokumentlänkar passerar. Full lokal hook: 3 229 godkända, sju skips, ett fel
i det befintliga processidentitetsprovet. Node-PID och `/proc` har olika
PID-namespaces här; samma oförändrade kod/test på `main` saknar då
födelseidentitet. Isolerad omkörning reproducerar det. PR #77 är mergad
som `1d1f4c12` efter grön full GitHub CI, GitGuardian och Vercel på `b32c0bd`. GitGuardians main-suite var `queued`; incident-/API-täckning
har inte lästs i denna miljö.

Aktiva Astrid-/dealer-talvägar, klipp, kalibrering, lagrade ID:n, publiceringar
och data är bevarade. Gemensamma imports mellan appar/paket och SL-10:s
handmatteaudit är fortsatt öppna; mappnamnen innebär ingen slutförd avveckling.

## PR-städning och CI, 13 oktober 2026

På Jakobs uppdrag är #75 och #73 mergade. #74 behåller rouletteunderlaget
men följer samma ordlista som #73. De tre samtidiga arbetsgrenarna för
adminfrikoppling, mappförenkling och Studio/legacy har separata ägare;
deras lokala filer ändras inte av mergearbetet.

- #41 är stängd som äldre plan; B19-beslut och pilotkrav finns kvar i
  CLOUD-MIGRATION. Den borttagna planmappen återinförs inte.
- #64 är parkerad/stängd utan merge. Kod finns på
  `codex/verified-event-preloading`, commit `0945a25af67f3e6ddc372020aef9372e60dee40c`.
  Återuppta med synk till main, två verkliga rehearsal-uppspelningar per
  berörd dealer samt mobil-/latensprov. Inga uppmätta latensvinster påstås.
- #72 är parkerad/stängd utan merge. Kod finns på
  `codex/dealer-orb-rehearsal-acceptance`, commit `be84e5dad64a5b3552a962cb60b847de2597dc55`.
  Två verkliga rehearsal-uppspelningar med godkända klipp och giltig
  dealer-/rumskontext återstår. De befintliga spelarkontrollerna består.

GitHub-workflowet väljer kort kontroll för rena dokumentations-PR:ar från
hela testmergens diff mot dess första förälder. Okända filer, maskinregister,
runtime-promptar, kod, media och konfiguration kör full kontroll. Main och
manuell körning är alltid fulla. Dokumentationsvägen kräver miljöregister,
leverans-/dokumentationskontrakt och systemkarta. Den rapporterar inte
spel-/mediaacceptans. Lokal pre-commit-policy ändras i separat mappuppdrag.

Studio byggs en gång, i dealer-regression, där launcher- och isolerade
SQL-/omstarts-/HTTPS-prov använder bygget. Befintliga tester och produktions-
migrationens readiness finns kvar; endast den dubbla table-http-körningen
är borttagen. Npm-cache följer alla tre installerade lockfilerna. Slutjobbet
`CI` blir rött om en tillämplig kontroll misslyckas, avbryts eller saknas.
Inga branchskydd, media-, databas- eller providerinställningar ändras.

Lokalt verifierat: verkliga Git-mergar och ytlig checkout, äldre kodändring
följd av dokumentpush, runtimefil flyttad till docs, symboliska länkar och
slutjobbets felvägar. Miljö-, leverans- och orphan-kontroller körs också.
Workflow-PR #76 är mergad som `f00d63ba` efter grön full GitHub-körning
`38392397953` på `16f6fd3`: Studio, dealerregression, OpenClaw-startprov,
isolerad SQL/omstart/HTTPS, worker och slutjobbet CI passerade. GitGuardian
och Vercel var gröna på samma PR-commit. Incidentlista och historisk
säkerhetstäckning är inte verifierade. Dokument-PR #79 verifierade den korta
vägen i körning `38393298682`: 46 sekunder från första jobbstart till grönt
slutjobb. Full regression fortsätter köras på main.

## Nästa agent: roulette i N1:s Labba-yta

Utgå från `/admin` och befintlig Labba/Sammansättningar; `/control` är kvar
under övergången. N1 är intern administration, Studio är innehållsredigering
inom N1, N2 är partner och N3 spelare. Produktmodellen följer den gemensamma ordlistan: spelbolag → spel →
rum/bakgrund med uttryckligt tillåtna bord och dealers. Ändra inte legacy-ID:n
eller beskriv rum/bakgrund-övergången som färdig. Se
[ordlistan](../lab/docs/TERMINOLOGI.md) och runtimekontraktet.

Uppdrag: återanvänd laborationsytan för roulette och visa samma scen på
mobil/desktop, utan nya hjul-/kulanimationer eller betalda genereringsjobb.
Bakgrund är ett separat återanvändbart bild-/MP4-miljölager; blackjack och
roulette har egna bord och geometrier. Samma dealerfilm och avkodade frame
används för kropp bakom bordet och maskerade händer/armar framför.

Senaste privata provprofilen är logisk **1920×1080**, origo uppe till vänster:
bord `(x=134,4; y=270; bredd=1651,2)`, Anna VILA/nya landskapsklipp
`(580; 42; 1104)`, ursprunglig porträtt-hjulstart `(551; −82; 1048)`.
Höjd följer respektive källformats proportioner. Mobil skalar samma scen
och kan använda närbild, utan ny dealerfilm. Detta är provvärden; gesten
träffar ännu inte hjulet korrekt och handmasken är heuristisk.

Det äldre underlagets bord på 2,4×1,35 meter, 25–30° kameravinkel,
desktop-/mobilhörn och centrerade dealer är produktionsförslag, inte denna
provprofil. Blanda inte heller den äldre handkontaktguidens `(960,330)` /
skala 2/3 med profilen ovan. De uppmätta provfilmerna här har 24 fps;
ändra inte mått, bildkvot eller position utifrån filnamn. 4K/16:9 och 30 fps
är ett tidigare föreslaget miljömasterformat, inte ett verifierat krav för
dessa klipp. Format/promptar finns i rouletteunderlaget; aktuell PostgreSQL-
formatgräns finns nedan och i CLOUD-MIGRATION.

Kvar: bygg/kalibrera återanvändbar roulette-Labba med bevarad
operator/table (= rum-ID)/game/composition/dealer-kontext och växling tillbaka till
editorn. Använd privat stillbild/MP4/WebM-prov; ingen produktionsregistrering
av PNG/ljud, publicering eller saldoändring. N1-assistenten i PR #61 är en separat, mergad leverans. Dess import har
fortfarande alfa och roulette avstängda; manuell native-upload har sin egen
MP4/WebM-/v12-grind. AI-aktivering, frameanalys, lipsync och rumsgenerering
är inte verifierade eller färdiga där. Serverkvitto/rund-ID ska styra framtida hjulgest och
0–36-filmval; återförsök behåller requestId/version/satsningar. Saknade filmer
ger stillbord och resultattext. 37-filmsbank, handträff, sömlösa loopar och
produktionsacceptans för Anna är fortfarande **inte godkända**.

## En produktmodell och papperskorg i rumslistan, 13 oktober

`lab/docs/TERMINOLOGI.md` är nu källan för orden bolag, spel, rum/bakgrund,
dealer, bord och sammansättning. Den har kortats från 169 till 85 rader.
`AGENTS.md`, användarguiden och runtime-referensen hänvisar dit. Ett spel
erbjuder kompatibla bakgrunder, dealers och bord; spelarens val bildar scenen.
Samma bakgrundsfil kan användas av flera bolag utan delade rums-ID eller
behörigheter. Format och äldre fullbildsklipp har uttryckliga regler.

Registrerad admin och klippkarta visar spel före rum. Rumslistan i både
`/admin` och `/control` har en direkt ingång till bolags- och rumpapperskorgen.
Smala tester som låste gamla `lane`-länkar och standardnamn är borttagna;
ägarskap, publicering och raderingsskydd är fortsatt testade. Tekniska ID:n,
frysta paket och gamla länkar är oförändrade.

Efter synk till `main` `cc63db71` passerar 101 riktade UI-/dokumentationsprov,
10 raderingsgrindsprov, admin/lobby typkontroll och bygge. Den fulla
commit-hooken passerade utan fel. Ingen produktdata eller Blobfil ändrades. Fortsatt arbete är att
knyta varje aktivt rumsval entydigt till en bakgrund och prova publicerade
dealer-/bordskombinationer i själva spelet.

## Tillägg 13 oktober: gemensam Studioassistent

`/admin/ai/chat`, bubblan nere till höger och `/admin/clips?tool=import`
använder samma Studioassistent, samtal, lokala filer och importutkast.
Assistenten finns direkt på adminstartsidan; klippkartan laddas först vid
Studio-besök och behålls därefter. PR #70:s startsida, ekonomivy, registrerade
rumslista, kontextlänkar och skydd för osparade utkast är bevarade.
Äldre `/control` behåller sin separata Gateway-chatt och sitt API.

Fasta serverroller väljer `gpt-5.6-luna` med `medium` för vanligt samtal och
`gpt-5.6-sol` med `high` för uttrycklig kartläggning. Samtalet behöver ingen
vald dealer och får aldrig ändra filfack eller godkännanden. Högst fyra
lyckade fråge-/svarspar följer med som opålitlig kontext, även till Sol.
Rådgivaren läser en begränsad dealer-/fackkatalog, inte ekonomi, drift eller
rum. Session, scope och origin kontrolleras; behörighet och katalog läses
om efter modellanropet. Modellen har inga skrivverktyg eller rätt att godkänna.

Import kräver bekräftad befintlig dealer, högst tio filer, granskning av
placeringarna och ett separat slutgodkännande. Redigering återkallar detta.
Importer sparas som alternativ genom befintlig N1-/Blob-/registerkontroll;
standardklipp, publiceringar, rumsinställningar och speldata ersätts inte.
Osäkra kvitton försöks aldrig om automatiskt. Navigation, minimering och
415/503-fel behåller filer, fack och samtal.

PR #71:s MIME-spärr ingår. PostgreSQL 001–008 medger bara MP4/WebM i
`media_records`. Hela listan med osparade filer kontrolleras före första
save-API, hash eller uppladdning, även rader med tidigare fel. Bild och ljud
kan granskas lokalt men måste tas bort före videoimport. Samma begränsning
förklaras av UI, serverägda varningar och båda modellrollerna. Alfa och
roulette är fortsatt spärrade i denna importassistent tills dess egen
preflight och granskning är accepterad; det är inget allmänt alfaförbud.

Spelarens blågula orbändring bevaras separat för fortsatt rehearsalacceptans.
Den ingår inte i assistentleveransen; spelarens nuvarande kontroller består.
Assistenten får inga spelbefogenheter och inga mediefiler ändras.

Verifiering efter integration med main #70 och MIME-rättningen #71:
1 843 Lab-tester passerar, med två plattformsberoende skips och inga fel.
Studio-produktionsbygget och kontrollen av 94 byggspår passerar.
159 riktade import-/native-/repositorytester passerar, inklusive tio nya
integrationstester och hela listans förkontroll. Designbygge och admin-/lobby-
typkontroll passerar. Isolerad Chromium vid 320, 390 och 1280 px verifierar
startsida före Studio, samma samtal/File/fack/godkännande genom vybyten,
osparad karta, legacy-kontextlänkar, registrerade rum, fokus och navigationsveto.
Blandade format ger noll save-anrop/hash/uppladdning; borttagning kräver ny
granskning. 415 och båda runtime-503-fallen behåller utkast utan återförsök.
API, Blob och modeller är mockade; dessa prover är inte PostgreSQL-, codec-
eller produktionsacceptans. PR #71:s riktiga PostgreSQL-bevis redovisas nedan.

Orbfixturen verifierar fyra skärmstorlekar, tangentbord/fokus/Escape, reduced
motion och noll enhetsåtkomst före samtycke. Den kör inte den faktiska spelaren;
två följande rehearsal-uppspelningar återstår före orbens separata mergeacceptans.
Lokal inventering hittade endast en Studio-fixtur utan accepterade dealerklipp
eller spelbart rum. Ingen ny server eller betald generering startades.
Produktionsmodell och verklig molnimport är inte verifierade. Den 13 oktober
kl. 11:19 saknades `CROUPIER_DEALER_IMPORT_AI` och `OPENCLAW_MODEL_API_KEY`
i produktionsprojektets metadata. Ingen provider eller konfiguration ändrades.
Utan AI-konfiguration ger kartläggning uttryckliga filnamnsregler och chatten
visar att AI:n är otillgänglig. Bildanalys, pose-/läppsynkflöde och automatisk
rumsproduktion återstår. Se [runtimekontraktet](LOCAL-PRESENTATION-RUNTIME.md#dealerimport-och-samtalskontroll-13-oktober-2026).

## Tillägg 13 oktober: faktisk MIME-gräns i PostgreSQL

PR #65:s PNG-/ljudregistrering är **inte färdig för PostgreSQL**. Migration
001:s `media_records_check`, oförändrad av 002–008, accepterar bara MP4/WebM.
Status-only systemmetadata verifierade samma constraint i Neon project
`wandering-hill-60561912`, main `br-flat-fog-b161a6r8`, `croupier_game`,
`croupier_studio.media_records`. Ingen produktrad eller DDL ändrades.

Riktig isolerad PostgreSQL 16.15 med faktiska 001–008 reproducerade felet:
PNG/WAV/MP3 gav SQLSTATE 23514; MP4/WebM registrerades med audit. Rättningen
returnerar `studio_media_content_type_unsupported` (415) före Blob-grant,
runtimeprobe, bytehämtning och SQL. Äldre signerade tickets spärras också.
Repositoryts `registerMedia` har samma kontroll före transaktionsstart, så
minnespoolen kan inte längre ge falskt positivt intagskvitto för dessa MIME.
Typed API-svar förklarar gränsen utan databasdetaljer. Forge registrerar MP4;
dess privata bildankare/lager ligger i andra strukturer och är inte ändrade.
Controls aktiva native-väljare erbjuder endast MP4/WebM. Droppad PNG/ljud
markeras som fel och blockerar hela den osparade kön tills filen tas bort.
Batchen gör en egen förkontroll före första upload; enskild upload avvisar
typen före filbytes, hash och alfaprov. Parser/v12 och annan lagerlagring
behåller sina bredare format för separat framtida aktivering.

88 riktade prover och 18 verkliga PostgreSQL-kontroller, inklusive omstart,
är gröna. Två egna localhost-kluster är stoppade. Tidigare fyra Anna-importer
bevisade bytes/preview i minnesfixtur, **inte** PostgreSQL-stöd. V12/parser
och WebM-alfa är en separat acceptansgräns. Migrerings-/aktiveringsplan finns
i [CLOUD-MIGRATION](CLOUD-MIGRATION.md#png-och-ljud-i-studios-mediaregister).
001/ledger/checksummor och reserverade 009/010 ändras inte; ingen ny migration
eller produktionsregistrering aktiveras av denna rättning.

## Adminstart: välj arbetsyta före redigering, 13 oktober

`/admin` öppnar en enkel översikt med fem tydliga ingångar: dealers och klipp,
spelbolag och rum, ekonomi, drift samt system. Studio-redigeraren ligger kvar på
`/admin/clips`; befintliga länkar till `/admin/structure`, `/admin/assets` och
övriga arbetsytor behåller sina mål. Sidomenyn har en egen Översikt-länk och
logotypen går hem. Den avancerade klippkartan laddas först när Studio besöks;
redigeraren hålls därefter monterad vid sidbyte så ett påbörjat utkast inte
försvinner. Äldre `/admin?dealer=…` och `/admin?operator=…&table=…` öppnar
fortfarande Studio med sin kontext; en uttrycklig Översikt-klickning rensar den.
`/admin/rooms` fortsätter öppna redigeraren, medan startsidans **Visa spelrum**
använder `/admin/rooms?view=registered` för den riktiga registrerade rumslistan.
Ingen spel-, publicerings- eller databaslogik ändras.

Verifierat i isolerad byggd adminvy: startsidan visar endast vägvalen, länken
till ekonomin öppnar den fungerande diagramvyn och Översikt återgår hem.
Separat navigationsprov med riktig byggd Studio-fixtur bekräftar rumslistan,
äldre bokmärken samt Översikt under laddning och från ett osparat utkast;
utkastet finns kvar när Studio öppnas igen. Fixturen skriver ingen produktdata.
Design-preview typkontroll och bygge passerar; 16 riktade route-, struktur- och
runtimebindningstester passerar. Efter sammanslagning med senaste `main` och
navigeringsrättningen passerar full regressionshook med 3 174 godkända,
11 överhoppade och 0 fel;
typkontroll och bygge passerar också på samma revision. PR70 är sammanslagen
i `main` som `e51f30d3`.

## Tillägg 13 oktober: roulettefack och alfa för Anna-prov

`codex/roulette-alpha-media` lägger till separata roulettefack för VILA-PNG,
andningsvila, glasögonvariant och hjulstart. Handling, spel och start-/slutpose
registreras separat. PNG-validering/preview finns; native PostgreSQL-intag
för PNG är spärrat enligt den senare MIME-kontrollen ovan.
`compositing.mode=alpha` bevarar PNG/VP9-transparens i den gemensamma previewn.
Browsern avkodar tre stickprov före alfauppladdning/omklassificering; servern
kontrollerar PNG-pixlar respektive VP9-alfaspår/payload. Svart/opak film är inte
en fungerande alfamatta. Blackjackfack och Studio seed ändras inte.

MERGE fångade en rolling-deploy-blockerare: PNG/roulette/alfa utökar den
gemensamma strikta StudioMediaRecord. Native intag och omklassificering kräver
nu exakt annonserad capability **v12** (`mediaAlpha=png-vp9-v1`,
`rouletteMedia=action-pose-slots-v1`) före Blob-grant, medieläsning och skrivning,
samt samma featurekontroll i den inre transaktionen. Frysta paket med dessa
media kräver också v12. V11:s dealerSets/materialTrash bevaras oförändrat.
Render ska stödja v12 före första nya registrering; äldre motor ger fast 503
och lämnar utkastet kvar. Ingen datamigration eller produktdataändring ingår.
85 riktade prover är gröna, inklusive noll SQL/grants på v11, avvisat äldre
transaktionsklartecken och positiv registerskrivning/återförsök med v12.

CI fångade ytterligare en konsumentgräns: intagskatalogens fyra roulettefack
får inte bli blackjackens genereringsjobb. `blackjackMediaSlots(project)`
läser endast canonical blackjack-event; Forge behåller sina 40 fack och
avvisar roulette före providersubmission och jobbregistrering. Övriga
`dealerMediaSlots`-konsumenter är bibliotek/intag och navigation. Runtime-
linjer/event accepterar inte rouletteklassificering; seed/kontrakt ändras inte.
Canvasen skiljer bild/video via DOM-taggen och har separat PNG-/alfa-prov.
Forge-, canonical-kontrakt- och canvasproven ingår nu också i fullhooken.
Hela lab-sviten efter CI-reparationen: 1 800 passerade, två avsiktligt
hoppade över, noll fel (fyra arbetare). Produktionsbygge och TypeScript är
gröna. Cacheprovets avsiktliga filbyte har en deterministisk tidsstämpel på
Windows; produktens cachebeteende ändras inte.

Samordnat med mediaagenten och SIDOR3. Den nya separata mediaassistenten måste
anslutas till `dealerMediaEvents(project)` av sin ägare; detta ändrar nuvarande
bibliotek/intag och preview. Ingen dealer eller rumsregel publiceras automatiskt.

Runway har producerat andning och glasögonrengöring med avkodad alfa. Första
glasögonmattan var helt opak och underkänd; v2 fungerar i privat scenprov.
Fyra faktiska Anna-filer har importerats/återlästs byteidentiskt i en isolerad
fixture, med idempotent commit och ny repository-instans. Desktop/mobilbredd
och två starter har provats. Kropp/händer använder en och samma videobildruta.
Detta är inte acceptans på fysisk mobil eller en produktionstestad publicering.

Bordsprovet ändrade hjulrännan och är underkänt. Bakgrundsfilmen är ett separat
10-sekunders prov med matchande stillposter. Ursprunglig handgest träffar ännu
inte spindeln exakt; masken är en heuristisk prototyp. Ingen 37-filmsbank eller
ny spelorkestrering är implementerad. Format, exakta promptar, geometri,
resultatstyrd händelsekedja och bevisgränser finns i
[rouletteguiden](games/roulette/README.md#anna-jonsson-roulettefack-alfa-och-runway-prov-13-oktober-2026).

Privata original, genererade filer, offlineprov och kvitton ligger i
`C:/Users/jakem/.codex/visualizations/2026/10/12/01a1319d-73c5-7801-8e65-27e47532075b/`;
inga binärer eller konversationsexporter läggs i Git. Slutlig regressionsstatus
och exakt leveranshead redovisas i PR:en.

## Ekonomi: enkel översikt i admin, 13 oktober

`/admin/ekonomi` återfår nyckeltal och två diagram i den nya designen;
hela den äldre administrationspanelen bäddas inte längre in på denna sida.
Journalen är en utfällbar detalj. Valuta och 7/30-dagarsfilter arbetar på
serverns högst 100 senaste journalposter, med synlig avgränsning och UTC.
Valutor, även historiska `USD`, `usd` och `USDT`, hålls i separata grupper.
Endast verifierade kontoändringar (insättningar, saldojusteringar och
spelhändelser) summeras. Öppningssaldo och valutabyte visas i journalen och
händelsediagrammet som saldoobservationer utan att räknas som rörelser.
Okända typer behåller sin råtyp men påverkar inte beloppen. Kontorörelser
presenteras inte som GGR, intäkt eller revshare; sådant rapportunderlag
saknas fortfarande. Inga seedade exempelsiffror används som produktionsdata.

Läsningen använder befintligt skyddat transactions-API, aktuell N1-session,
tillåtna actions och verifierad svarsidentitet. Vid navigering, omladdning
eller läsfel rensas tidigare data. Isolerad webbläsaracceptans med testdata
verifierar valutabyte, 7/30 dagar, journal, tomt svar, 401, 503 och återhämtning.
Fem modelltester täcker summering, UTC-gränser, historiska valutor,
saldoobservationer, kända/okända typer och feldata; de ingår i den gemensamma
regressionshooken. Admin-typkontroll och Lab-produktionsbygge passerade på
denna rättning. Full regressionshook: 3 119 godkända, 11 överhoppade, 0 fel.
Produktionsacceptans återstår efter deploy.
Ingen ekonomisk transaktion, behörighetsändring eller databasmigration utförs.

## PR #50: fast rumsmiljö och bevarad fryst film

Nya rum kräver en entydig sparad bakgrund. Om en sammansättning redan
används av publicerade rum jämförs även hela den infångade vilofilmen:
media-ID, hash, sökväg, MIME, storlek och friläggning. Kontrollen sker både
vid förberedelse och under publiceringens revision-/transaktionsskydd.
Ett identiskt nytt rum och exakt retry fungerar; en annan film ger 409
utan att ändra det tidigare paketet. Regressionen föll före rättningen.
PR #63:s levererade HERO, porträtt och dealergrindar bevaras vid integration.
Inga mediebytes, produktionsdata eller rumspubliceringar ändras av arbetet.

## SIDOR3: avslutad Studioleverans, 13 oktober 2026

PR #55, #67 och #69 är mergade. Admin använder registrerade Studio-data,
befintliga skyddade tjänster och tydliga felstatusar. Biblioteket och
kompositionspanelen delar originaluppladdning och impact-tokenstyrd papperskorg.
Osparade utkast spärrar direkta livscykeländringar; sparning använder aktuella
revisioner och konfliktjämförelse per stabilt ID. Ingen annan dealerbank väljs
automatiskt vid saknad koppling. Senare import-, ekonomi- och startsidesarbete
bevaras och redovisas i sina egna avsnitt ovan.

Alla fem oförändrade Blackjack-original är registrerade och återlästa/avkodade
från det privata produktionsbiblioteket. De är fem separata designer, med
gemensamma namn/design-ID och exakt källhash. Bibliotekets lager-UUID är en
separat lagringsidentitet. Importen gav inga tilldelningar eller publiceringar;
Back to Basic valdes senare i PAOW · Studio. Namn, ID och originalmått finns
i [teknikreferensen](LOCAL-PRESENTATION-RUNTIME.md#begrepp-och-ägarskap).

Efter #67 verifierades admin catalog/project/videos och publika bolags-/rumslistor
med 200 i drift. Nordic Bet Roulette har materialvarning för Back to Basics
blackjacktagg. Dess och Blackjack in Snows historiska spelbehörigheter och
playUrl består; nya publiceringar avvisar fel spelmaterial. Detta är ett
läs-/behörighetskvitto, inte ett nytt visuellt media- eller läppsynksgodkännande.

Slutlig källversion för #69 är `c9e9116765ded44b66ecf09ae4452661c5b4416f`.
Ordinarie hook: 3 114 godkända, 11 överhoppade, 0 fel; designbygge, admin-typer
och CI gröna. Verklig LayerAssetManager-markup verifierade namn och hänvisningar
före knappen i fyra aktiva mobilrader och en trashrad; desktopens två kolumner
bevaras. Isolerad HTTP-/browser-QA verifierade sparning/omstart, 409,
401/återanslutning med bevarat utkast, flytt och restore som obundet val.
Kontrollerna ändrade inte produktionsdata och innebär ingen ny scenacceptans.

Vidare produktarbete: uttrycklig övergång från dagens enspelsrum, blinksekvenser
för bord, fullfile-taldriver, generell ändringsloggs läs-API och visuell
spel-/mediacceptans. Följ den aktuella domänmodellen i teknikreferensen och
`lab/docs/TERMINOLOGI.md`; UI-rubriker är inte bevis för genomförd lagringsmigrering.
Det finns ingen osparad produktkod eller återstående aktivering i denna chatt.
Privat verifierad säkerhetskopia innehåller källbundlar, de fem originalen och
kvitton (`studio-delivery-final-c9e91167.zip`); inga binärer eller nyckelvärden
ligger i Git. Vercel-/lokalenvrättningen dokumenteras separat i
[miljövariabler](ENVIRONMENT-VARIABLES.md#avslutsrättning-13-oktober-2026-vercel-och-blob-metadata).

## Tillägg 13 oktober: papperskorg i befintliga Control

`codex/control-trash` bygger vidare på bakgrunds-PR #58. Bolagsarkivering
tar nu bort bolagets rum från aktiv administration och publicering, samt
oanvända genererade uppspelningsadaptrar. Delade adaptrar och andra bolag
behålls. `operator-lifecycle` kräver även `expectedAdministrationRevision`.
Återställt bolag återöppnar inga rum; varje rum återställs separat som pausat.

`/control/library` har beständig papperskorg för både bord och bakgrunder.
`material-trash-check` tar `{id, archived, expectedRevision}` och visar
berörda sammansättningar, rum och bolag. `material-trash` kräver samma
kropp plus `impactToken`, kontrollerar aktuella projekt-/administrations-
och paketrevisioner och sparar hela ändringen atomiskt. Berörda publicerade
sammansättningar avpubliceras och deras rum flyttas till befintligt rumsarkiv.
Aktiva och arkiverade dealerutkast kopplas loss från materialet. Återställning
gör filen valbar igen utan automatiska kopplingar eller publiceringar.

`project.layerAssetTrash` innehåller högst 128 metadata-poster; media kopieras
inte och en borttagning skapar ingen databasrad per beroende. Originalfiler,
pakethistorik och befintlig revisionshistorik behålls. Det är ingen generell
databasstädning eller permanent filradering. Dealers och klipp använder sina
befintliga papperskorgar och skydd för publicerad media. Den gamla direkta
projektvägen får inte kringgå materialens livscykelkontroll.

Synliga gamla Mobile Phone Lane-namn i biblioteksreferenser och speltitel
visas som Standardsammansättning. Det interna `mobile-phone`-ID:t behålls.
Your Company-rensningen är utförd i produktion den 13 oktober: bakgrund
`c0035fc4-cb47-45dc-83de-adb44c14e9fd` flyttades via `/admin/assets` och
`6cd2bf56-4d42-4c7b-848a-087398b38563` via `/control/library`. Varje färsk
påverkanskontroll visade endast Standardsammansättning och inga publicerade
spelrum. Båda vyerna återlästes efter omladdning: 10 aktiva bakgrunder och
två återställbara poster i papperskorgen. Enda kvarvarande aktiva varianten
är `e98f61ca-bb1d-4ba3-b61f-d1089da0c1a4`, tidigare provspelad till slut
(10,041667 sekunder utan videofel). De sex nya bild-/videofilerna och
PAOW · Studios val av Studio · turkos bevarades. Ingen permanent radering.

Integration: PR #60 är mergad som `d595e6b7`, och PR #55 förenar samma
papperskorg med nya `/admin` i `c8f9b99b`. Main-CI och båda driftsättningarna
är verifierade för `c8f9b99b`. Render annonserar runtime **v11**, med både
`dealerSets: 'authoring-categories-v1'` och `materialTrash: 'detached-assets-v1'`.
Ingen Neon-migration krävs. Slutregression för PR #60: 2 988 godkända,
11 överhoppade, 0 fel; den förenade PR #55: 3 093 godkända, 11 överhoppade,
0 fel samt passerat Lab-produktionsbygge och admin-typkontroll.

Katalogregressionen efter PR #55 rättades i PR #67, mergad som `027ceb03`.
En ny materialregel hade slagit ut läsningen av historiskt publicerade rum.
Befintliga spelrum och behörigheter bevaras; inkompatibla material får en
adminvarning och nya publiceringar valideras fortsatt strikt. MERGE verifierade
57/57 main-CI-steg, www/Vercel READY och Render LIVE/version på exakt
`027ceb03`, health 200 och bibehållna v11-förmågor. Publik bolagskatalog och
Nordic Bets två rum svarade 200; admin catalog/project/videos svarade också
200. Rensningen ovan skedde därefter under ett samordnat stabilt releasefönster.
Varningen för Nordic Bet Roulette gäller Back to Basic-materialets blackjacktagg;
historiska publiceringar och frysta PAOW-paket ändrades inte av denna rättning.

Verifiering: riktade server-/UI-tester för bekräftelse, samtidiga ändringar,
tenantgränser, återställning, skyddad historik och full rollback; Lab-
produktionsbygget passerar. Full pre-commit för `133b74f5` passerade:
2 977 godkända tester, 11 överhoppade och 0 fel. Detta är inte en ny
acceptans av externa PostgreSQL-miljöer eller av visuell dealerkomposition.
Inga dealerfilmer, kalibreringar eller rouletteoriginal har ändrats.

## Tillägg 13 oktober: dealerbilder och Labba i sammansättningar

Samordnat med SIDOR3 och MERGE. Den gemensamma förhandsvisningen ritade
tidigare bara video trots att bildfiler kunde läsas. Den ritar nu även
keystone/VILA/REDO-bilder med samma höjdbaserade placeringsfunktion.
En ny Labba-knapp öppnar befintliga lokala lagerprov och behåller filval
och utkast när man växlar tillbaka. Lokala dealerprov accepterar både bild
och video; filernas marginaler bevaras och bara dealerlagret greenscreenas.
Ingen ny route införs under övergången till `/admin`; detta lagar den
befintliga sammansättningsytan och kan återanvändas av central Studio.

Verifierat: 39 riktade tester och Lab TypeScript-kontroll. Regressionerna
täcker bild → video → bild, fördröjt uppspelningssvar, placering utan
omladdning samt Labba utan automatisk sparning. Full ordinarie regression
körs som commitgrind. Inga spelregler, saldon eller publiceringsval ändras.

Anna Jonsson (`anna-jonsson`) är sparad i dealerregistret efter Jakobs
uttryckliga beställning. Hennes oförändrade källfiler ligger fortfarande
utanför Git och har endast provats privat: 1920×1080-scen, separata profiler
för liggande VILA och stående hjulstart, en avkodad videobild för både kropp
bakom och maskerade händer framför bordet. Mobil och desktop använder samma
placering; två hela hjulstarter är kontrollerade. Detta är inte rehearsal-
eller produktionsacceptans. Handmasken är ett prov och den faktiska handen
når ännu inte exakt hjulspindeln. Bild/film har olika pose och bildutsnitt.

Öppet: korrekt registrering av rouletteåtgärden `roulette.wheel-start` och
oförändrad alfa-keystone. Nuvarande klippfack och Forge-normalisering är
blackjackorienterade; Annas hjulstart ska inte läggas i ett kortfack eller
registreras som viloloop. Ingen Anna-media eller nytt rum har publicerats.
Hjulstart bör senare utlösas en gång av serverns accepterade rundkvitto,
kopplat till samma requestId även vid återförsök. Val av marker startar inte
gesten. Hjulstarten ersätter inte de 37 resultatbundna filmerna i
[roulettehandboken](games/roulette/README.md).

## Tillägg 13 oktober: tre valbara originalbakgrunder

Jakobs PNG/MP4-par har registrerats via ordinarie uppladdning på
`/control/library?tab=backgrounds`, utan omkodning. Alla sex återlästes
efter omladdning och visas som lediga för sammansättningar. Importen
ändrade inga rum, dealeranslutningar, standardval eller publicerade paket.

| Material | Bildens upload-ID | Videons upload-ID |
| --- | --- | --- |
| `studio-dark` — Studio · mörk | `830074fa-f6c0-4042-940e-d9e7f6d89154` | `97cc4eb8-7d58-41ba-8988-85c805d7a42b` |
| `lounge-warm` — Lounge · varm | `76586226-e636-4cf6-a08c-be9d83abed31` | `87bca397-cf29-4371-bf95-0fb0653472c7` |
| `studio-teal` — Studio · turkos | `12a8e84d-b8d7-4a3d-8a5b-f3b04e832a9b` | `d9e52013-08e9-4e2e-bf10-e3e527a35e9c` |

`web/public/background-materials.mjs` binder bild och video till samma
material via SHA-256, storlek, MIME och dimensioner. PNG är 1672×941;
MP4 är H.264 High, 1920×1080, 24 fps, cirka 10 sekunder utan ljud.
Originalnamnen följs även där motivet kan antyda ett annat namn.
Filerna ligger i mediebiblioteket; privata sökvägar och binärer läggs inte i Git.

Det gemensamma `material-catalog.mjs`-kontraktet är samordnat med SIDOR3
(PR #55) och innehåller även de nya gröna/svarta blackjackborden.
Spelval, offentlig rums-/previewläsning och partnervy använder gemensamma
materialnamn. Upload-ID, rumstillhörighet och frysta tillåtna alternativ
behåller sin betydelse. Katalogen ger ingen åtkomst eller publiceringsacceptans.
SIDOR3 förenar samma kontrakt med sin nya Studio-UI; bordens uppladdning
och UI-arbete tillhör den leveransen.

Verifiering: 35 riktade tester för innehållsidentifiering, variantkoppling,
spelbordens speltyp, oförändrade paket/val och konsekventa läsarnamn.
Ordinarie full regression körs som commitgrind; checkoutens låsta
testberoenden och produktionsbygge är förberedda.
Ingen dealerfilm har bytts. Val i verkliga rum, komposition, loopskarv och
visuell acceptans i rehearsal återstår tills bakgrunderna används där.

Efter separat instruktion från Jakob togs den oanvända
`background-ditt-spelbolag`-posten `800eb6ee-9e55-40c1-9757-159694422dd2`
ur biblioteket. Vid den första inventeringen bevarades tre andra varianter;
den senare verifierade rensningen ovan flyttade `c0035fc4` och `6cd2bf56`
till återställbar papperskorg. Endast `e98f61ca` är nu aktiv och valbar.
Jakob valde uttryckligen borttagning av `paow3`: rummet
`room-8affe3aa-0a8f-58b7-02df-df67cbba6e6e` arkiverades genom ordinarie
API, togs ur den aktiva strukturen och avpublicerades i Nordic Bet-paket
version 8. Rouletterummet är kvar. Demo North/South återfanns endast i
diagnostiska fixtures, inte bland de registrerade bolagen.
AGENTS anger nu `/admin` och `/lobby` som riktning, med befintliga ytor
kvar under övergången. Den begärda gemensamma papperskorgen för samtliga
resurstyper beskrivs i tillägget ovan. `/admin`-integrationen och driften är
verifierade på `027ceb03`, inklusive riktig flytt och återläsning i båda ytorna.

## Tillägg 13 oktober: samlade spelmanualer

Canonical ingångar finns nu i [docs/games](games/README.md): blackjack,
roulette och gemensamma klipp-/formatbegrepp. Äldre FORMATLASNING och
roulettens tekniska README har en enda aktiv plats med hänvisningar från
de gamla ingångarna. Frysta källunderlag och hashregister skiljs från
dagens kod och öppna produktionsmål. Privata original/konversationer
har inte lagts i Git. Roulettekraven för 37 utfallsfilmer är dokumenterade,
inte implementerade eller beställda. Webbplatsens AI-funktion är utanför.

Dokumentkontroll omfattar relativa länkar, JSON, källhashar, båda
blackjackprofilerna och den bevarade formatlåsningen. Ordinarie hook och
PR:s produktgrindar krävs före merge. Format-/posekonflikter, faktisk
mediaacceptans och kvittots framtida bindning till filmbank är fortsatt
öppna; läs spelmanualerna innan implementation. Ingen produktkod, media,
publicering, databas eller migration ändras i denna dokumentleverans.

## Tillägg 13 oktober: central Studio och rumsmodell

Målkontraktet för nya `/admin` finns i
[LOCAL-PRESENTATION-RUNTIME.md](LOCAL-PRESENTATION-RUNTIME.md#central-studio-rum-spel-och-lager-13-oktober-2026):
spelbolag → rum/bakgrund → spel → dealeruppsättning; bord separat och
bakgrundsautomation på miljön. Det skiljer målmodellen från dagens rum med
ett spel per post. Ingen produktkod, media eller produktionsdata ändrades.

Read-only produktläsning fann `paow3` som öppet Nordic Bet-rum, samma
PAOW-sammansättning som rouletterummet, samt sju videobakgrunder och två
bordsbilder. ID, referenser, filformatregler och kvarstående visuell
acceptans dokumenteras i kontraktet. Sju videor avkodades och spelades till
slut i webbläsaren utan mediefel; codecprofil/loopskarv är inte granskade.
SIDOR3 äger UI-arbetet; första preview använder isolerat QA-underlag.
Verifiering för denna dokumentationsleverans: källkontrakt och synligt
produktregister jämförda; ordinarie dokumentationshook passerade (35 tester).
Rumsövergång, riktiga lager i preview och spelacceptans återstår.

Läget 12 oktober 2026 skrevs om mot koden på `jakob/repo-ordning`.
`origin/main` 13 oktober 2026 är `426fa114` (#54). Planens merge #51 är `a5441feb`.
Äldre avsnitt, inklusive per-rad-kvitton som inte upprepas här:
`git show 00ea55c5:docs/JOHN-HANDOFF.md`.

## 1. Aktuellt läge

### Nya Studio-ytan: första granskningsversion, 13 oktober 2026

Pågående WIP i `codex/studio-workspace`, egen arbetsyta
`C:/Users/jakem/.codex/worktrees/studio-workspace/croupier`, bas
`415afa05053496990211ca29a07f6a21ef55a19d`. Originalets klippcanvas är
designreferens. `/admin` har åtta kompakta kort med exakta fack/varianter,
layoutåterställning, en liten meny och nivå 1/2/3 uppe till höger.
`/admin/structure` är en separat systemkarta. Tal-, policy-, lager- och
livscykelpanelerna ligger i Studio. Inga Control-utgångar krävs där.

Första visningen kör på `http://127.0.0.1:53764/admin` med en isolerad
QA-fixtur, syntetiska register och riktiga byggda UI/API-moduler. Den är
tydligt märkt som testdata och hålls öppen medan Jakob granskar riktningen.
Designbygge och typkontroller passerar; riktade isolerade prov omfattar
exakta klippval med native selector, kategori-/medieskydd och talförberedelse.
Den nya samlade browserregressionen återstår. Fullhooken på källcommit
`8dd6ed7a35cdc08f5fed675ead42524b9ff2eefc` passerar: 3 037 godkända,
11 villkorade skips, 0 fel. Studio-produktionsbygge och byggspårskontroll
passerar. Nya kategori-/policy-/taltester ingår i ordinarie hook.
Källcommitten är pushad och remote-verifierad i draft-PR #55
(`codex/studio-workspace` → `main`). PR:n har mergekonflikter mot aktuell
main; ingen konfliktlösning eller merge har gjorts vid denna WIP-säkring.
En privat hashverifierad återställningsbackup och Git-bundle finns utanför
Git, med exakta vägar i chatten. Leveransen är för kontinuitet,
inte godkänd produktdesign.
Inget har mergats, publicerats eller skrivits i produktionsdata.
Inga betalda genereringsjobb eller mediebytesändringar har gjorts.

Inte accepterat eller färdigt: verkliga sju videobakgrunder/två bord visas
inte i denna QA-vy. Den senaste kontextmodellen bolag → rum/bakgrund →
speltyp → tillåten dealeruppsättning återstår; befintligt register har
ett spel per publicerat rum. `paow3` är ett faktiskt rumsnamn, inte bevis
för en tredje dealeruppsättning. Målkontrakt/inventering finns i separata
docs-PR #54, head `47d6fbc8c8b95f1517dafe750e90b30d94244e77`.

Nya `dealerSets` är fristående arbetskategorier med delade klippreferenser,
arkiv/återställning och CAS-/ägarskydd; de är inga publicerade versioner.
De kräver capability v10 hos spelmotorn före sparande. Talpanelen har 17
exakta SV/EN-mallar och förbered → explicit bygge → resultat, men native
Studio saknar en etablerad fullfil-driver för produktionsbyggen. Arbiträra
dealerprofiler är därför inte produktionsklara. Tal-/läppsynksacceptans,
publicering och spelbeslut behåller sina befintliga skydd.

Publik sajt: https://www.scoutgaming.tech (apex `scoutgaming.tech` är 308 till www).
Vercel-projekt `scoutgaming`. Spelmotor och plånbok: Render `croupier-v2`.
`/studio` är labbets Next-basePath, inte en produkt. Kort, sko, saldo och
utbetalning ägs av servern.

| Nivå | Vem | Adress | Meny i koden |
| --- | --- | --- | --- |
| 1 | Intern personal | `/control` | Studio, Spelbolag, Drift, System. Sidfot: Översikt och Guide & hjälp. Källa: `lab/lib/scout-navigation.mjs`. |
| 2 | Operatör | `/partner`, `/partner/login`, `/partner/{slug}` | Översikt, Spelrum, Team & behörigheter (kräver `team.read`), Integration. Källa: `lab/components/kevin-bo/partner-copy.mjs`. |
| 3 | Spelare | `/play`, `/play/profil`, `/play/historik`, `/play/blackjack`, `/play/roulette` | Lobby, profil (namn och språk), historik. Saldo är serverägt. |

**Nivå 1, sidor.** Studio: Dealers & klipp `/control/clips` (med fliken Skapa
material, tidigare Dealer Forge), Bord & bakgrunder `/control/library`,
Sammansättningar `/control/compositions`. Spelbolag: Bolag & team `/control/companies`, Spelrum
& publicering `/control/rooms`. Drift: `/control/administration?tab=operations`
och `?tab=finance`. System: `?tab=accounts`, `?tab=partners`, Agentmodeller
`/control/openclaw`, Intern agentchatt `/control/openclaw?tab=chat`.
Provspelning & logg `/control/rehearsal` är kontextuell (dealer, sammansättning,
bolag, rum), inte en global driftvy.

Sidor som finns kvar utan egen menyrad: Spelhändelser & villkor
`/control/events` (översikt utan `?event=`, editor med det), Klippbibliotek
`/control/videos`, Svarsbibliotek `/control/replies`, Probe `/control/probe`,
inloggning `/control/login` och lösenord `/control/set-password`.
`/control/administration?tab=media-review` finns kvar i administrationen.

**Omdirigeringar som ska fortsätta fungera.** `/` i labbet (permanent) och
query bevaras till `/control/clips`. `/control/preview` → `/control/compositions`.
`/control/lanes` → `/control/rooms`; `?tab=companies` → `/control/companies`.
`/control/activity` → `/control/rehearsal`. `/control/zones` och `/zones` →
`/control/preview` → sammansättningar. `/control/backgrounds` →
`/control/compositions`. `/control/tree` (permanent, query bevaras) →
`/control/events`. `/control/operator-chat` → `/control/openclaw?tab=chat`.
`/control/dealer-forge` → Dealers & klipp, fliken Skapa material, med dealer-,
sammansättnings-, bolags- och rumskontext bevarad även efter inloggning.
`/lissabon` → `/control`. Oprefixade `/videos`, `/events`, `/guide`, `/probe`,
`/openclaw`, `/administration`, `/activity` och `/tree` leder in i `/control/…`.
Gammal `lane` i Studio accepteras och länkar skrivs som `composition`
(`lab/lib/control-flow.mjs`). `/demo` leder till `/play` och behåller en giltig
`operator`. `/labb-lissabon` svarar 307 till Render-labbet.

**Nivå 2.** Vanliga partnerrutter faller inte tillbaka på demodata. Intern
admin använder samma N1-inloggning. Operatörspersonal ser bara aktiva
medlemskap. Bolag, roller och medlemskap skapas på `/control/companies`; ny
e-post får aktiveringslänk till `/partner/set-password`. Utseende och tillåtna
sammansättningar delar en editor, med `presentations.configure` och
revisionskontroll. `lab/components/kevin-bo/navigation.mjs` är prototypkatalogen
(Livebord, Pitbossar och liknande), inte den levande menyn.

**Nivå 3 och spelare.** Presentationen måste vara `local` eller `layered`.
Allt annat kastas med `Presentation requires registered cloud media`
(`web/public/app.mjs`). Layered använder `layered-presentation.mjs`. Övriga
publicerade rum använder `local-presentation.mjs` tillsammans med
`performance-player.mjs`. Studios originalmediareserv är pensionerad:
registrerad video stannar på den gemensamma scenen, och ett hanterat klipp
utan spelbar fil visar den befintliga statustexten. `/casino.html` svarar
308 till `/play` och behåller query. `/v2` är kvar som 307-omdirigering.
De fem granskningssidorna svarar 404. `/dealer/…` och
`/dealers/{astrid,vera,amira,mei}/…` svarar 410 (`web/server.mjs`). Amira är
inte en aktiv inbyggd dealer. Astrid,
Vera och Mei spelas bara när de är registrerade med giltig media och ingår i
den valda publiceringen. Produktionsläsningen 12 oktober (BASLINJE §8, endast
SELECT): ingen av Astrids 10 registerposter matchar de gamla Git-filerna, och
inget av 29 paket med presentationsdata pekar på dem via hash.

**Drift.** CI och Studio kör Node 24: `lab/package.json` anger 24.x
(`12a12fd6`). Migration 008 är körd i produktion, och båda runtime-kontrollerna
kräver nu exakt 001–008 (`91969107`). Historikrensningen är publicerad:
`Jakobs-v1` är `b9355ab824cd332835e7cc306862fcf53ad35f21`. Återställning:
`docs/ENVIRONMENT-RESTORATION.md`.

**Medieacceptans som fortfarande gäller.** Tal är ett set: exakt text, ljud,
video, frame-index, kalibrering och acceptansnotering. Annan ljud- eller
videohash upphäver tidigare visuellt godkännande. Välj inte talvideo på
ungefärlig längd, loopa inte en inspelad mening över fortsatt ljud, och använd
inte inklistrade munöverlägg. Vid media- eller spelarändring körs testerna i
`.githooks/pre-commit` (kroken anropar `tools/precommit-checks.mjs`). Berörda
registrerade dealers granskas med `?dealer=<name>&rehearsal=1`, två
uppspelningar i rad. Provspelningen använder den faktiska spelaren. En hash,
vågform eller grönt test är inte ett nytt läppsynkgodkännande.
12 oktober: alla fyra medieset matchade befintlig baslinje; inget nytt visuellt
godkännande. Tidigare saknade, ej godkända tagningar står kvar. Per-rad-resultat
och de daterade goodluck-kvittona ligger i den frysta handoffen, avsnitten
från 11 oktober (taltransport, egen röst, klippstyrning) och
"Acceptans som består". Zonbilden som fortfarande är den registrerade privata
PNG:n: 1080×1920, 1 628 428 byte, SHA-256
`eda87f9e877b00dbd2f02479db44ae5f41e2f182563825304906880ceee0088a`; fel molnkälla
ger 503 utan lokal reserv. Export 290×104 var pixelidentisk med befintlig zon.
`lipsync-overrides.json.pre-retime` flyttades byteidentiskt till Astrids
`source/calibration`, SHA-256
`28197cb52298d78842d972c1790373e121a43bb59fee727e66998a0379aa5ef1`.
Sparade projekt refererar 12 bankklipp i
`media/dealers/astrid/runtime/presentation` (72 276 298 byte, BASLINJE §8).
De ska inte avregistreras här.

**Regler som består, komprimerade.** Render äger kort, sko, slump, plånbok,
rundor, resultat och session. Studio sparar revisionsstyrd Neon-policy, inte
osparade utkast eller saldo. Alla fyra dealers delar spelaren. Gamla
BO-videoförhandsvisningar är tysta historikklipp. Observation följer den
verkliga spelfliken. Neon- eller Blob-fel stänger med fel, aldrig med
diskreserv eller fröprojekt. Den långa listan står i den frysta handoffen under
"Funktionella regler som aldrig får komprimeras bort".

## 2. Öppna kontroller och kända fel

### Ny administration och lobby, 12 oktober 2026

`/admin` och `/admin/lobby` är separata interna arbetsytor. `/control`,
`/partner` och `/play` behåller sina befintliga roller. Den gröna toppbaren
och den simulerade rollväljaren är borta; nivålänkar går till befintliga portaler.
N1 kontrolleras av `authorizeUiPage` på varje dokument, tillgång och kataloganrop.
En partner- eller spelarinloggning ger inte intern åtkomst.

`GET /admin/_data/catalog` läser samma scoped operatörsregister och sparade
Studio-policy som produkten. Administrationen visar bolag, rum och dealers;
lobbyn visar endast rum godkända av den kanoniska publicerade rumsväljaren.
Publicerade rum behåller paketets frysta dealers även när rummet inte är live.
Sparad, opublicerad sammansättning märks separat. Blackjack och roulette länkar
till befintlig `/play/{game}` med `operator`, verkligt `table` och tillåten `dealer`.
Spelmotorn omprövar behörighet och publicering vid inträde. Inga DB-skrivningar,
migrationer, nya konton eller publiceringsåtgärder ingår i anslutningen.

Registerfel stänger med tydlig felstatus utan exempeldata som reserv. Övriga
adminvyer, såsom statistik, är kvar som uttryckligen märkta designexempel;
deras simulerade ändringar påverkar inga register. Porträtt, insatser och
statistik hittas inte på för riktiga bolag/dealers. Redigering sker tills vidare
via kontextbevarande länkar till Control. Nuvarande Control ska inte ersättas
innan arbetsytorna är accepterade.

Designprincip för fortsatt integration: den nya, rena layouten styr. Återanvänd
befintliga datakällor och behörigheter; importera inte Controls gamla komponenter
eller hela menyer. Lägg endast till kontroller som behövs för den aktuella uppgiften.

Källzippar och ursprungliga SHA-256: `packages/design-preview/source-provenance.json`.
Zipparnas API:er, SQL och miljöinställningar importerades inte. Separata React/CSS-byggen
bevarar Tailwind 3 respektive 4 och serveras från privata `lab/design-preview-build`.
Svar är `private, no-store`; exakta sökvägar, filgränser, Range/HEAD och N1-returer
  kontrolleras. Lobby-CSP tillåter endast anrop till samma origin och inga formulärpostningar.

Start: `node lab/start.mjs --offline --no-open`. Offlinekörning har INTE produktionsregister
och visar därför datakällans otillgänglighet. Bygg: `npm --prefix packages/design-preview run build`.
Studio-start/-bygge förbereder designerna och deras typkontroll automatiskt.
Inga nya miljövariabler krävs i den befintliga native-deploymenten.

Verifierat: designbyggen, Studio-produktionsbygge/typkontroll och 32 riktade
auth-/routing-/katalogtest på Node 24.21.0. Full pre-commit-kontroll passerade;
katalogtesterna ingår nu i den. Alla fyra medieset matchar befintlig baslinje.
En separat granskning hittade och fick en regression för sammanblandning av sparade
och publicerade dealers. Mediebaslinje är inte nytt läppsynkgodkännande.
PR #43 finns på main `438a48a9`; Vercels produktionsbygge är READY. Det anonyma
liveprovet upptäckte att Route Handler-login tappade `/studio`-prefixet. Admins
egen redirect adapter återställer nu monterad loginadress och no-store; katalog
och tillgångar ger 401 i stället för att omdirigeras. Nytt regressionstest täcker
monterad/friliggande login, tillåtna retursidor och nekade resursanrop.
Det tidigare adminarbetets inloggade produktionsprov den 12 oktober, efter
PR #46 (`e3805b87`), visade 4 bolag, 2 rum och 7 aktiva dealers. Nordic Bets
publicerade blackjack- och rouletterum gav rätt `/play/{game}`-länk med bolag,
verkligt rum och PAOW; rumsbyte återställde dealervalet. Partnerportalen öppnades
med samma internadmin och spelarvyn gick att nå. Provet omfattade läsning och
valflöde, inga insatser eller transaktioner; full spel- och behörighetsacceptans
återstår. Lokal offlinevy eller injicerade testdata ersätter inte detta liveprov.

**Publik lobbyadress, 12 oktober (`codex/public-lobby-entry`).** Startsidan får
knappen Lobby till `/lobby`. Den återanvänder lobbyns design i ett separat bygge,
med befintliga publika läsningar `/api/operators` och `/api/operators/{slug}/rooms`.
Bara kanoniska publicerade spelbara rum och deras tillåtna dealers blir valbara;
registerfel ger felstatus, utan exempeldata som reserv. Startsideslänken i den
publika designen leder hem till `/`. Lobbyfiler och typsnitt har egna begränsade
`/lobby/_assets/`-rutter. `/admin`, `/admin/lobby` och adminkatalogen fortsätter
kräva N1, medan nuvarande Control är kvar. Ingen DB-skrivning, publicering,
speltransaktion eller ändring av roulettebord/animationer ingår. Denna PR är
en adress- och läsanslutning; fortsatt lobbydesign sker i separat arbete.
Verifierat med byggda UI-filer och isolerade publika API-fixturer på 1440 och
390 px: startsidesknapp, båda speltypernas valflöde, återställning efter bolagsbyte,
felstatus och återförsök. Inga adminanrop eller speltransaktioner utfördes.
Detta är inte ett nytt produktionsprov av `/lobby`; det görs efter separat
godkänd merge/deploy. Frontend-/design-/Studio-produktionsbyggen och riktad
lobbyregression ingår i leveranskontrollen.

### Central Studio och dealerporträtt, 13 oktober 2026

Första anslutna etappen på `codex/central-studio-map`, utgående från main
`bb63beabd028b8d35618a98250af8620ab856f67`. `/admin`, `/admin/clips` och gamla
Studio-adresser inom `/admin` visar samma klippkarta. Menyn har en Studio-ingång;
rum, dealer och lager visas som kontextpaneler. Kartan har inga Control-utgångar.
`/control` finns kvar. Drift och ekonomi är fortfarande märkta designexempel.

Kortplatser kommer från sparade events och exakta registrerade mediafamiljer.
Urval, förhandsvisning, drop och filval använder det befintliga privata
uppladdningsflödet: grant, Blob, verifierad commit och exakt återläsning.
Uppladdning registrerar filen; explicit koppling ändrar utkastet. Spara använder
befintliga N1-skyddade `/studio/api/project`, aktuella serverkontroller och
`expectedRevision`. Inga nya skriv-API:er, migrationer eller publiceringsflöden.
Omläsning fryser ändringar, revisionsfel behåller utkast och navigation/växling
skyddar osparat arbete. Bolag, verkligt rum, dealer och sammansättning följer URL.
Endast det N1-skyddade admin-dokumentets CSP öppnar Blob-SDK:s avgränsade
`https://vercel.com/api/blob`-endpoint; lobbyn behåller sin läsande policy.

Bord och bakgrund väljs ur den sparade sammansättningens tillåtna lager.
Roulettebord är skrivskyddat i denna panel tills Jakob lämnat designunderlag.
Dealerbankens val byter inte rummets dealer. Rumspublicering, taluppladdningens
hela text/ljud/video-uppsättning, flerbaspooler/frekvenser, bibliotekets uppladdning
och mobil/desktopjustering är ännu inte anslutna till den nya panelen. Dessa
luckor visas uttryckligen. Hela Studio-ersättningen och produktacceptansen är öppna.

`public.zip` innehåller byte-identiska filer som redan finns i designens public.
Färsk N1-registerläsning 12 oktober 23:47 verifierade aktiv `astrid`/Astrid och
`paow-v2`/PAOW; Dragge/Mårten saknades och äldre `paow` var arkiverad.
Endast de två aktiva identiteterna får sina namngivna bilder/MP4. Lobbyn behåller
den kanoniska publiceringens dealerurval. Samma 1:1-utsnitt används för bild/video;
tysta inline-gester spelas en gång med 45–55 sekunders variation, och avbryts när
kort/flik är osynliga eller användaren valt reduced motion. Admins dealerpanel
använder samma lookup och schemaläggare. Inga assetbytes, talmedia, HERO eller
spelanimationer ändrades.

Verifierat isolerat med riktiga byggda UI-filer och befintliga API-/uploadservice-
implementationer: drop → grant → Blob-fixture → verifierad registercommit →
explicit koppling → revisionssparande → omladdning → samma klippförhandsvisning.
Browserprov på 1440/390 px täcker även N1-fel, utkast, konflikt och kontext.
Porträttagentens 13 browserfall använde riktiga MP4 med posteråtergång,
gemensam geometri, dold flik/offscreen och reduced motion. Nya riktade tester,
designbygge, typkontroller och Studio-produktionsbygge passerade.
Inga produktionsskrivningar, insatser eller speltransaktioner gjordes.
Den gamla instruktionens `pipeline/audit-dealer-sync.mjs --probe` kan inte köras:
filen finns inte på den aktuella main-basen. Speech/player-rehearsal är inte
verifierad av denna porträttändring; mediefilerna är oförändrade.

Den tidigare inloggade produktionsverifieringen av PR #43/#46 ska bevaras:
4 bolag, 2 rum, 7 aktiva dealers; Nordic Bets paow3/blackjack och roulette med
PAOW; korrekta `/play/{game}`-länkar med operator/table/dealer; återställt dealerval
vid rumsbyte; partner- och spelarportaler öppnades med internadmin. Det är ett
tidigare prov, inte acceptans av den nya skrivande klippkartan eller ett nytt
produktionsprov i denna etapp. Full spel- och behörighetsacceptans återstår.

### Talström: röst medan GPU-sessionen startar, 12 oktober 2026

Molnets strömmande tal (`overlapAudio` på cloud-konfigurationen, ingen ny miljövariabel) startar Cartesia först efter att RunPod-jobbet är accepterat, medan workern kopplar upp. PCM stannar i spelprocessen, högst 25 sekunder, och går in i reläet först när webbläsarens engångsbiljett är autentiserad. Avbrott från ägare, spelare eller stängning stoppar hämtningen direkt, även medan GPU-väntan pågår. Ett nekat GPU-jobb startar ingen röst. Utan GPU-session, inklusive lokal förhandsvisning, startar rösten som tidigare först vid ansluten spelare.

Worker-socketen är kvar på den publika Vercel-ingången `/lipsync-worker`. Render tar emot den via ingresshemligheten. Den hemligheten ska inte ligga i RunPod-jobbet, så workern pekas inte direkt på Render. Idle-stopp efter 60 sekunder är kvar: en varm GPU debiteras på riktigt, och sessionsreservationen återbetalas inte.

Verifiering: 84 riktade stream-/session-/journal-/leveransprov passerade på Node 24.21.0 efter integration av main `ef9029a9`. Ordinarie full hook och nya PR-kontroller krävs före merge. Ingen betald generering eller produktionsdataändring. Kall och varm första bildruta är ett separat, ännu omätt uppdrag.

### Bakgrundsklipp och bordsstorlek, 12 oktober 2026

Sammansättningens Bakgrund har nu valfria ljudlösa händelse-/intervallklipp
med maxlängd, tid mellan starter och rullande minutgränser. Basbild eller
videoloop återkommer efter slut/fel; dealerns tal och spelklocka är separata.
Bordet har procentfält och förstora/förminska per mobil-/datorformat.
Kontrakt, frysta lagergrants och capability 8 skyddar beständiga skrivningar.
Ingen SQL-migration, källflytt eller produktdataändring ingår; leveransen
bygger vidare på mergad V1 `dd837cf4`.

Riktade regressionsprov och nio verkliga Chrome-scenprov passerar, inklusive
två på varandra följande bakgrundsfilmer och felåtergång. Mediaaudit med
`--probe` bekräftar oförändrade fyra historiska set. Testerna använder
syntetiskt material och ger inget nytt läppsynkgodkännande. Full build/hook,
PR24 och main-CI passerar; `c320932a` är live på Vercel och Render med
capability 8. Produktionsprov bekräftade bakgrundsåtergång och bord 140→150→140 %
utan sparade dataändringar. Slutbilden fångade en float på fältrubriken som
sköt första bordskontrollen utanför panelen; följande fält bryter nu floaten.
PR25 `ff1d6e53` är verifierad live på Vercel/Render. Bordspanelens innehåll
ryms i sina 378 px och reglagen är cirka 338 px breda utan horisontell klippning.
Separat kvar: landningssidans Vercel-preview på `bf23b987` misslyckades i
befintlig `next/font`-laddare; produktionsbygget passerade. Spelrummens nya regler ska
väljas och publiceras uttryckligen i Studio. Användarguide och tekniskt
kontrakt finns i `lab/docs/README.md` respektive
`docs/LOCAL-PRESENTATION-RUNTIME.md`; A20/A21 bevarar modulerna vid flytt.

### Responsiva insatsplatser och kort, 12 oktober 2026

Spelkontrollerna använde en separat centrerad 9:16-yta även för en förändrad
desktopkomposition. Insatser och kort delar nu grundloopens källinramning,
kompositorns referensplan och canvasens contain-projektion. Kraftig beskärning
får inte lägga spelkontroller bakom HUD eller utanför bilden. Mobilens tre
kolumner flyttar kort och insats tillsammans, behåller verkliga serverplatser
och har separata huvud-/sidobetstryckytor. Dealerinramning, lagerbilder,
serverkort, saldo och publicerade inställningar ändras inte.

Ett talklipps annan beskärning flyttar inte vilande kort. Om spelplanet måste
flyttas, mobilkolumner ordnas om eller källinramningen skiljer sig, används
statisk kortvisning och inspelad kortkontakt får inget kalibreringsgodkännande;
det gäller även storleksbyte mitt i giv. Regression täcker inramning, contain,
ytterplatser, split, hålkort och samma kortnoder vid omprojektion. Full hook och
mediaaudit passerar; Chromeproven använder syntetiskt material, inte nya
läppsynk-/PAOW-kalibreringar. Ändringen använder befintlig runtime och återinför
inget från Kevins branch eller V2:s avvecklade motorer. PR-kontroller ska även
verifiera kombinationen med omorganisationen och den nya rouletteytan på `ef9029a9`.

PR27 `c0cf3b20` är levererad via `3e10a7ad`, med grön main-CI och Vercel/Render
live. Produktionsprovet visade att mobilens gamla vh-placerade statusrad kunde
täcka mittplatsen. Följdrättningen placerar statusraden ovanför den faktiska
insatsgruppen och gör den genomsläpplig för klick. Desktopplaceringen bevaras.

### En ingång till sammansättningar, 12 oktober 2026

Sammansättningar finns i Studios huvudmeny. Den dubbla dealerfliken och
länken längst ned i dealerpanelen är borttagna. Sammansättningssidan visar
en kort sökväg och en tillbakalänk till vald dealer i stället för hela
flikraden. Dealer-, sammansättnings-, bolags- och rumskontext samt befintligt
sparskydd följer fortfarande med navigationen. 104 riktade navigationsprov
passerar; produktionskontroll återstår vid leverans.
### Roulettegenerator och testyta, 12 oktober 2026

`web/games/roulette/` innehåller en fristående servermodul för europeisk
roulette (0–36), `node:crypto.randomInt` och JSON-eventet
`roulette.spin.resolved` med operatörs-, rums- och rund-ID. `/roulette-test`
visar en snurrknapp, nummer/färg, fliklokal historik, JSON och kodexempel.
Tom `POST /api/roulette-test/spin` skapar ett serverägt demoutfall. Den går
via signerad Vercel-transport till befintlig Render-image; Render-bokmärket
omdirigerar till www. Origin, metod, tom kropp och anropsfrekvens kontrolleras.
Ytan är publik/olänkad/noindex och hoppar över konto-/gästflöden. Inga
insatser, saldon, DB-skrivningar, medier eller nya tjänster ingår.

Varje anrop drar ett nytt utfall. Nästa rumsintegration måste stänga
satsningar, låsa rundan, spara utfallet atomiskt och återspela samma sparade
event vid återförsök. Riktigt spelrum, satsningar och avräkning återstår.
Kontrakt och integrationsgränser: `web/games/roulette/README.md`.
Verifierat med Volta Node 24.21.0: nio generatortester och sex HTTP-/proxytest
godkända. Isolerat webbläsarprov visade två serverutfall, korrekt JSON och
rensning av lokal historik. Orphan-kontrollen efter V2: 346 testfiler, 0 orphan.
Testerna ingår i pre-commit/CI. Labbets och frontendens låsta beroenden
installerades för full leveranskontroll; tidigare saknade Next-moduler var
en lokal installationsbrist. Inga befintliga produktservrar startades/stoppades.

PR #28 levererade generatorn till Render; publikt API-prov gav HTTP 200 och
ett servergenererat event. Liveprovet hittade en loop mellan Vercels
slash-normalisering och testsidans redirect. Testytans kanoniska adress är
därför `/roulette-test` utan slutande snedstreck, även i Render-bokmärken.
HTTP-testet kräver nu att redirectmålet ger 200 direkt utan fler redirects.

### Rouletterum per bolag, 12 oktober 2026

Roulette finns som spelval i Studios skapa-/publicera-rum-flöde per bolag.
Partnerportalen visar rummet, dess utseende och provspelningslänk, som för
blackjack. Befintliga rum är blackjack om speltyp saknas. Bolagets lobby
skiljer spelen åt och öppnar roulette via `/play/roulette`. Fryst dealer, bord
och bakgrund återanvänder lobbyns publicerade scen; inga tal-/mediafiler ändras.
Personliga rundor använder befintlig inloggning och demosaldo. Insatser,
utfall, saldo och bokföring sparas atomiskt under plånbokslås. Återförsök
återger samma kvitto, med 20 sparade rundor per spelare/bolag/rum.
Externa partner-launch-konton stöds inte för roulette ännu.

Additiv migration: `ops/neon-game/007-roulette-tables.sql`. Produktions-DDL
utförd med Jakobs godkännande den 12 oktober i `croupier-production`, databas
`croupier_game`: fyra TEXT-kolumner, sammansatt primärnyckel och spelar-FK
verifierade; tabellen var tom efter skapandet. Runtime-kapabilitet 9 spärrar publicering tills både
motor och tabell är redo. Ingen ny Render-tjänst eller miljövariabel behövs.
Spelarvyn har hjul, marker, samtliga standardsatsningar, ångra/rensa/upprepa,
regler, historik och återhämtning av väntande rundor. Gemensam profilstatistik
är fortsatt blackjack; roulettehistorik visas i rummet. Roulette-tal/nya
inspelningar, gemensamma tidsstyrda rundor och riktiga pengar ingår inte.

Verifierat lokalt: satsningskatalog mot alla 37 utfall, idempotens, SQLite-
omstart/rollback, spel-/bolagsisolering, atomisk rumspublicering, faktisk
serverauth/origin, Studio-/frontend-byggen och frontendens typkontroll.
Hela lokala regressionen passerade, liksom integrationen med A20-flytten.
CI `38288136945` är grön för `931dc6cb`, inklusive verklig isolerad PostgreSQL:
samtidiga identiska/olika kommandon, delad plånbok mellan rum, revokerad
publicering, ledger-rollback, omstart och blockerad spelare. Browserkontroll
omfattar desktop, mobil, tappat svar/återförsök och omladdat sparat utfall.
Vercel-preview `dpl_2RWmjsBKynRcnnczoKhReXWEJt7S` är READY för samma kod.
Dealer-audit --probe matchar alla fyra baseline-set,
med tidigare saknade tal-takes och mänsklig läppsynkacceptans fortsatt öppna.
Leverans: PR #35, #36 och #39 är mergade. Slutlig spelkod är
`3e841f826bc0a416a240b454987a7886eec2023b`; main-CI `38294703862` passerade.
Render `dep-db6itqmq1p3s73aiq810` är live och Vercel
`dpl_H2xPS4enfJcVgNVAr4vL34BnaHkR` är READY med produktionsalias för samma SHA.
Live-SHA, HTTP 200-hälsa, kapabilitet 9 och faktisk dealerscen har verifierats.
Studios yttre publiceringstransaktion bevarar speltypen. PG:s omkontroll av
publiceringen använder samma klient som plånboken, i en enda SQL-snapshot.
Regressionerna täcker första publiceringen mot gammal/ny motor och åtta
samtidiga spelare med verklig publiceringskontroll och rollback vid revokering.
Partnerns snapshot bevarar speltypen och öppnar rätt speladress.

Nordic Bet fick på Jakobs begäran sitt första rouletterum,
`room-1bc1b407-9538-9ae8-f7e2-fecf951989a2`, i paketversion 7. PAOW:s redan
uppladdade grundloop `13d044b3-0582-4f8f-a754-75bb099a0237` återkopplades via
Studio till den tomma standardvarianten före publiceringen; inga mediabytes
ändrades. Befintligt blackjackrum `paow3` finns kvar. Publicerad katalog,
partnerlänk och spelarkontots läsflöde verifierades utan insats/saldoändring.
Scenens preview-anrop använder `revision`, inte `packageRevision`, enligt
serverns kontrakt. Lobbyn visar nu roulette som demo i stället för planerat.

**Nästa UI/UX-agent:** arbeta med den spelbara första versionen i
`web/public/roulette/{index.html,style.css,app.mjs,scene.mjs}`. Det är HTML och
ES-moduler som levereras från Render via Vercel, inte en Next-sida.
`web/games/roulette/README.md` beskriver API, filansvar och verifiering.
Behåll serverns regler/RNG/plånbok, inloggning, bolags- och rumskontext samt
exakt återförsök av väntande rundor. Utveckla layout, mobil, satsningsflöde,
återkoppling och tillgänglighet. Senare beslut: inga nya animationer; Jakob levererar MP4. `/roulette-test` är en separat
kontofri generatordemo. Ny UI-kontroll görs med isolerat testsaldo; inga
produktionsinsatser har lagts för verifieringen här.

**Dealerfråga samordnas i MERGE:** PAOW avvecklas parallellt. Återkopplingen
ovan skedde innan den samordningsinformationen nådde roulettechatten. Gör
inga ytterligare PAOW-återkopplingar, raderingar eller godtyckliga dealerbyten.
Den 12 oktober var paket 7 fortfarande publicerat med PAOW. Johanna är ett
verifierat förslag: grundloop `f1e92965-940b-4722-9910-063ff409d110`, SHA-256
`bb0b11931d108d9afef72dd40b4d45a0e864dc12409969be1b315c1c3ebcfbd3`, cirka
10,04 sekunder, aktiv koppling och green-screen-metadata. Två uppspelningar
utan mediafel och lokal paketering med befintliga bord/bakgrunder passerade.
Ingen Johanna-sammansättning eller ersättningspublicering är skapad; visuell
acceptans i ett nytt rum återstår. Förslaget är ett separat Johanna-rouletterum
hos Nordic Bet och därefter paus av PAOW-rouletten efter samordnat beslut.
Blackjackrummet behöver inte ändras. Äldre frysta paket behåller sitt
medieskydd även om ett nytt rum publiceras.

### Nästa uppdrag: lanes blir bara sammansättning, 12 oktober 2026

Jakobs mål: en mycket enklare modell. Behåll sammansättningen (dealer, bord,
bakgrund, placering). Lane-lagret ska inte finnas kvar som eget begrepp. Nivå 1
ska kunna bocka i och ur dealers per spelbolag och publicera. Ingen kod är
ändrad för detta ännu.

Nuläge (läst i produktion 12 oktober):
- Två lane-begrepp finns. Presentation lane = sammansättning: `project.lanes` i
  Studio-dokumentet, fryst i `operator_packages.lanes` vid publicering;
  spelrummet pekar med `room.presentationLaneId`. Game lane = intern
  uppspelningskonfiguration: `administration.gameLanes`
  (`gameLaneConfiguration` i `web/public/game-lanes.mjs`); spelrummet pekar
  med `room.gameLaneId`, och Render väljer med `?lane=`.
- Kompatibilitetsrester: URL-parametern `lane` (Studio skickar `composition`),
  `?lane=layer-preview&rehearsal=1` och flaggan
  `CROUPIER_STREAM_LANE=lissabon-stream-lane`.
- Sammansättningar: `mobile-phone` ("Mobile Phone Lane": amira, paow, astrid,
  vera) och `johns-johanna` ("Johns spelbolag · Johanna": johanna, astrid,
  paow; standarddealer paow). Namnen är missvisande. Bolag: sg-test (paket v15),
  johns-spelbolag (v14), nordic-bet (v1), kevins-spelbolag (v1, tomt).
- Omfång: `lane` finns i cirka 230 käll- och testfiler (web 43, lab/lib 38,
  lab/components 31, test 40, lab/test 55).

Fasta gränser: frysning vid publicering och publicerad historik skyddas;
befintliga rum ska spela oförändrat och gamla paket läsas som de är.
Lagringsfältet `lanes` och stabila ID:n behålls tills en migration är godkänd,
och en Studio-migration körs mot produktion före merge. Spelmotor, plånbok och
mediegodkännande rörs inte.

Start för nästa agent:
1. Läs lab/docs/TERMINOLOGI.md, AGENTS.md, docs/CLOUD-MIGRATION.md,
   web/public/game-lanes.mjs, web/presentation-room-contract.mjs och
   web/game-entry-operator.mjs.
2. Kartlägg utan att ändra var varje lane skapas, läses och fryses. Avgör om
   game lane kan härledas automatiskt från sammansättning plus spelrum.
3. Lägg en etappvis plan och vänta på Jakobs ja: (a) ordet lane syns aldrig i
   gränssnittet, och en kryssvy "Dealers hos bolaget" på nivå 1 skriver bolagets
   egen sammansättning; (b) game lane skapas bakom spelrummet; (c) först sist
   eventuellt schema- och fältnamn.
4. Provspela rummen hos sg-test, Johns och Nordic Bet före och efter varje etapp.

Samordning: plattformsflytten A22 (`packages/platform`, se `docs/CLOUD-MIGRATION.md`)
flyttar samma centrala moduler. Kör inte flytt och lane-förenkling på samma moduler samtidigt.

### Övrigt öppet

- Rättelsen för frysta paket utan `transition.shoe` (`e160af12`) är verifierad
  live på `91969107`: tre gröna GitHub-jobb, Vercel READY, Render live
  (`dep-db6b0649v7es739sh6g0`) och `/api/operators` 200 för Johns och Nordic Bet.
- Blandade frysta 16/17-eventpaket kan ge 409 vid publicering.
- Rotens env-filer är ännu inte konsoliderade.
- Full molnrehearsal och visuell talacceptans återstår. Astrid, Vera och Mei
  saknar `videoGenerationId` på grundloopens `idle.ready` och kan därför inte
  friskförklaras spelbara. Amira ska inte vara aktiv dealer.
- JN2-B: partnerns tema och utseendekontroller är inte visuellt accepterade.
  I ljust läge kan `--sg-text` (`#F2F1ED`) hamna på samma yta. Paketkorten är
  inte en provbordsförhandsvisning.
- Inte gjort: spelare, transaktioner och rapporter från spelmotorn (N2.4),
  marker (L4), partnerns lösenordsåterställning.
- GitGuardians senaste klassning i den tidigare handoffen: 0 öppna, 17
  ignorerade. Historisk skanning är `too_large`. Denna omskrivning läste inte
  om incidentlistan. En grön CI-körning är inte bevis på noll incidenter.
- Automatiserad korsdomänsnavigering till Studio avvisas
  (`studio_request_rejected`). Manuell länk och omladdning fungerade i det
  provet. Ingen skyddsregel lättades.
- Objektens existens i Blob och full visuell liveuppspelning är inte
  verifierade (`ordning/BASLINJE.md` §8 på `faf0e822`).
- Upload-anteckningen om `kortflipp_kling_1080p.mp4` står kvar i
  `docs/CLOUD-MIGRATION.md`. Den är inte stängd här.
- Vercel-byggets nya logg för Node 24-låsningen (`12a12fd6`) är inte verifierad.

### Roulette: responsiv spelvy och kontofritt rörelselabb, 12 oktober 2026

Arbetsbranch `codex/roulette-responsive-experiments` utgår från mergad PR42
(`bf01c8bb`). Avstämning med ROULETTE bekräftade paket 7 och PAOW i Nordic
Bets befintliga rum. Inget dealerbyte, ingen rumspublicering och ingen
ändring i `/admin`, blackjack eller serverns spel-/plånbokslogik ingår.

Mobilvyn har stående satsningsbord utan sidscroll och samma publicerade
dealerfil som desktop. Kontrollraden håller marker, insats, start och
återförsök tillgängliga. Separat kula/hjul visar det bekräftade kvittot;
reducerad rörelse och Visa resultat direkt stöds. Saknad scen har en tydlig
reservtext. `/roulette-test#experiments` har valbar mus-/touchparallax,
mobil-/desktoputsnitt och geststart mot det befintliga kontofria demo-API:t.
Kamera är endast undersökt, inte aktiverad. Bord, miljö och dealerplan i
labbet är tydligt märkta skisser.

27 riktade roulettester passerade på Node 24.21.0. Isolerad webbläsar-QA
med verklig SQLite-avräkning omfattade spel, otillräckligt saldo, kontobyte,
dialogfokus, 1440/390/320 px, geststart, tangentbordsstart och reducerad
rörelse. Avklippt svar efter commit plus omladdning/återförsök gav två exakt
identiska kommandon, en dragning och en insatsbokning. En bruten socket
provade också Chromiums transparenta återförsök utan extra dragning.
`tools/roulette-ui-fixture.mjs` återger dessa fall med egna minneskonton,
utan env-filer eller produktionsdata. Testbevis ligger privat utanför Git.

Mediaaudit `--probe` matchar alla fyra historiska set. Detta ger inget nytt
visuellt/läppsynkgodkännande; verklig dealerrehearsal och nytt hyperrealistiskt
material är fortsatt öppna. Ingen isolerad PostgreSQL-körning utfördes i
denna UI-fixtur. Full regression ingår fortfarande i leveransgrinden.
Runway-prompter, föreslagna bild-/bordsmått, loopacceptans och kamerans
tekniska begränsningar finns i `web/games/roulette/README.md`.

### Roulette: PNG-bord och delade medialager, 12 oktober 2026

Jakobs nya riktning ersätter rörelseprototypen ovan. Spelrummet visar nu den
bifogade transparenta bordsbilden i en gemensam 16:9-scen på mobil/desktop.
Kodritat hjul, kula, väntan på animation och länken till rörelselabbet är
borttagna från spelrummet. Resultat och historik visas direkt från kvittot.
Rörelseexperimentens gamla separata testyta är inte vidareutvecklad.

Bakgrunden väljs endast ur rummets publicerade, tillåtna tillgångar och kan
vara samma bild/MP4 som blackjack. Frilagd dealer hämtas från publiceringen;
inbakat äldre bord ersätts inte genom att lägga ny geometri ovanpå. Saknad
kompatibel dealer/media ger reservbild och status, fortsatt spelbara kontroller.
Ingen dealeridentitet, publicering, databas eller plånboksregel har ändrats.

Gemensam scenspelare har frivillig desktoplayout och en statisk PNG-alfamask
för framtida bordsvideo. Masken måste ha samma registrering/proportioner som
videon. Tidigare anrop behåller sina standarder. Ingen ny animation eller
framtida resultatvideo är byggd. N1:s publiceringskontrakt/maskeditor återstår
som separat integration när materialet finns; lokal media-definition är klar.

Mottagen `roulette-bord-start-stop.mp4`: 1916×1080, H.264, 24 fps,
15,041667 s, utan ljud/alpha. Specifikationens gamla beställningsstatus är
bevarad som källa men kompletterad med verifierade filfakta i
`web/games/roulette/media-specification.json`. Båda PNG-namnen är byteidentiska.
Filmen behöver egen registrerad mask och visuell acceptans; den är inte
aktiverad som spelresultat. Ny dealer-keystone/idle placeras bakom bordet
till höger för betraktaren. Ingen ny rörelse har genererats.

Format, koordinater, keystone-/idle-prompter och reserverad blackjackmall:
`docs/LOCAL-PRESENTATION-RUNTIME.md`, avsnitt Medieformat för roulette och
blackjack. Rouletteguiden länkar dit. Inga nya parallella dokumentationsmappar.

Verifierat: 27 roulettekontroller och 10 gemensamma scenkontroller passerar.
Fullständig pre-commit-kontroll passerar på `77f959db` med Node 24.21.0.
Windows-körningen använder en egen katalog under vanlig LocalAppData/Temp;
en testrot under `.codex` blockeras av byggspårens avsiktliga privatfilter.
Browser: 1440/390/320 px, 44 px minsta satshöjd, PNG med bibehållen alpha,
tangentbordsdialog, spelvarv och tappat svar följt av omladdning/återförsök
(samma requestId/version/bets, en debitering). Riktig lokal H.264-testfilm
avkodad som publicerad bakgrund och maskat bord; paus och reducerad rörelse
verifierade. Testfilen är enfärgad, privat och ingen ny spelanimation.
Dealer-audit --probe matchar fyra baseline-set. PostgreSQL var inte startad
i denna körning; tidigare PG-bevis ersätts inte. Verkliga nya dealerklipp
saknas; mänsklig media-/läppsynkacceptans är fortsatt öppen.

### Roulette: satsningar på det verkliga bordet, 13 oktober 2026

Det separata numrerrutnätet är borttaget. Genomskinliga träffytor för nummer,
dussin och utsidessatsningar följer den bifogade PNG:ns perspektiv. Valda
marker visas som stilla staplar direkt på filten, med samma välj/placera/ångra-
princip som blackjack. Alla satsningar finns även i en tillgänglig dialog;
kolumnfält som saknas i bilden ritas inte till. Senaste utfall/historik är en
kompakt rad. Ingen ny hjul-, kula- eller markeranimation.

Mobilen kan förstora och rulla över samma scen. Scen och markerkontroller
flyttas till dialogen, utan en andra videospelare; Escape återställer fokus.
Första trycket på den lilla översikten öppnar vyn utan satsning. Minsta
nummerträffyta där är 26 px och markerkontrollerna är minst 44 px höga.
Serverkvitto, låsning, saldo och exakt återförsök är kvar.

Fullständig pre-commit-kontroll passerar på `d66f0184` (Node 24.21.0).
29 roulettekontroller inklusive bildregistrering passerar. Browserkontroll
på 1440/390/320 px bekräftar placering, ångra, fokus och frånvaro av sidspill.
Tappat kvitto + omladdning + återförsök ger samma requestId/version/bets och
en enda debitering för den rundan. Lokal H.264-bakgrund fungerar med samma
canvas genom förstoring/återställning; paus och markerplacering är kontrollerade.
Dealer-audit --probe matchar fyra baseline-
set; nya dealerklipp/mediaacceptans och framtida MP4-registrering återstår.

### Roulette: ren spelvy och Mer, 13 oktober 2026

Huvudvyn visar bordet, små saldo-/senaste-resultatfält och marker, ångra,
Spela och Mer. Regler, historik, satsningslista, upprepa/rensa, förstoring,
video och rumsinformation ligger i Mer. Normal hjälptext är tillgänglig
för skärmläsare; laddning, saldofel, sessionsfel och osäkra kvitton är synliga.
Dialoger återställer fokus till Mer. Samma scen och kontroller flyttas vid
förstoring, utan en extra dealer- eller bakgrundsspelare. Inga nya animationer,
gester eller utfallsfilmer är byggda; resultat visas direkt från serverkvittot.

Samordnat med MERGE: canonical spelmanualer ägs av dokumentationsgrenen
`codex/game-documentation`, [PR #56](https://github.com/Jakeminator123/scoutgaming/pull/56),
med [37 utfallsfilmer](games/roulette/UTFALLSFILMER.md)
och [gemensamma klipp och format](games/KLIPP-OCH-FORMAT.md).
Manualerna är integrerade från bekräftad main-merge `ba7601dd`.
UI-grenen inför inget parallellt filmkontrakt. Mediaagentens granskningsflöde
är underlag för nästa implementation, inte färdig automatisk klassificering.
Main `426fa114` är integrerad; central-/admin-målkontrakt och tidigare
rouletteformat är bevarade vid konfliktlösningen.

Fullständig aktuell pre-commit-kontroll passerar på `c3055fc0` (Node 24.21.0).
Även den slutliga manualintegrationen `40926297` passerar hela hooken.
29 roulettekontroller och isolerad browser på 1440/390/320 px passerar:
Mer-dialoger, fokus, placering/ångra, synligt saldofel och historik. Tappat
svar följt av omladdning/återförsök gav samma requestId/version/bets,
en slumpning och en debitering. Avkodad H.264-bakgrund och video-/Mer-kontroller
fungerar även i förstoring, med samma enda canvas/spelare. Äldre överlämning
hänvisade till `pipeline/audit-dealer-sync.mjs --probe`, pensionerat genom B11.
Aktuell main-AGENTS kräver den ordinarie hooken, vars registrerade/frysta dealer-
uppspelningskontroller passerar. Inga pensionerade medier eller verktyg återställs.

## 3. Senaste leveranser

**Slutfix 2, 13 oktober 2026 (`codex/ordning-slutfix-2`, bas `161957f1`).**
SL-01/02 har rename-kontroll, strikt stopp och en separat indexjämförelse;
egna verkliga Git-regressioner passerar 10/10. SL-11:s genererade tabell och
Copy-for-LLM kontrolleras av ett nytt synkprov, inlagt i fullkroken. SL-08:s
aktiva mediekällor och befintliga variabelnamn finns nu i inventeringen;
åtta namn-/inventeringsprov samt CLI-kontrollen passerar. SL-09 är läsande
utredd: 307 på Render och 303 till spelarlogin på www, inget 503 före
inloggning; inloggad rehearsal är fortfarande öppen. Partnerdokumentets
åtkomst är oförändrad (404 på www, 421 direkt på Render). Inga
produktionsskrivningar, migrationer eller medieändringar i slutfixen.
Detaljer och kvarvarande SL-03/06/07/09/10 står i `CLOUD-MIGRATION.md`.

Fjorton dagar räknat från 12 oktober 2026. Högst en kort leveransrad per
ämne. Provantalen är de tidigare agenternas, inte omkörda här.

**Ordning 2026-10 avslutad, 12 oktober (`jakob/ordning-avslut`).**
Planen i `ordning/` (baslinje `00ea55c5`) är genomförd och mappen är borttagen;
historiken har den, till exempel på `faf0e822`. Den generiska raderingsspärren
står kvar som `tools/raderingsgrind.mjs`, med sina prov i
`test/raderingsgrind.mjs` i kroken. Före borttagning eller flytt av filer:
staga den avsedda ändringen och kör
`node tools/raderingsgrind.mjs HEAD --staged --strict`.
Efter commit används jämförelsebasen med `--strict`, utan `--staged`.
Rapporten anger exakt jämförelse och läser samma HEAD-/indexversion av
importer och register. Trasiga importer och aktiva registerrader stoppar;
historiska textomnämnanden rapporteras för granskning. Leveranser: V1 #19 (plan och
regler), V2 #23 (A10–A18: döda moduler, granskningssidor, pipeline, ops och
dokument), #30 (adminlänk på partnerinloggningen), V3a #34 (A20:
`test-videoeditor/` till `packages/presentation/{compositor,docs,preview}`), #44
(PAOW-grundloopen), V4 #40 (B11: indexerade banken, läppsynkverktygen och
bankauditarna) och denna leverans (A21: källkoden `presentation-runtime/` till
`packages/presentation/runtime/`, publik URL `/presentation-runtime/*` oförändrad,
plus A99). En enradig shim `presentation-runtime/live-idle.mjs` finns kvar avsiktligt för
`web/public/local-presentation.mjs`, som laddas i både Node och webbläsare.
#51 är mergad som `a5441feb` (13 oktober 00:35). Det är ett historiskt leveranskvitto.
Delkvitton 13 oktober, inte full produktacceptans. Efterarbetets egen läsande
kontroll cirka 01:03: Render och Vercel körde `a5441feb`, publika sökvägar svarade
som förut och runtime-hasharna var oförändrade. Rum paow3 hos nordic-bet
provspelades av föregående agent 00:45 på `a5441feb`; det provet är inte gjort om.
#53 (`36d6d13f`) är dokumentmergen efter planen. Därefter kom #54 (`426fa114`).
Efterarbetet SL-01..SL-11 (bas `426fa114`, branch `jakob/ordning-slutfix`) har
status per rad i `docs/CLOUD-MIGRATION.md`, "Repo-ordning, slutläge". Rättat där:
SL-04 och SL-05. SL-03 hör till #50. SL-01/SL-02, SL-08, SL-09 och SL-11 är öppna.

| Mått | Före `00ea55c5` | Efter `e602ea91` |
| --- | --- | --- |
| Spårade filer | 4 412 · 790,18 MB | 2 868 · 388,44 MB |
| `media/` | 2 455 · 731,74 MB | 857 · 289,33 MB |
| `web/public`, källfiler | 122: 95 produkt, 12 bara granskning, 11 bara test, 2 bara pipeline, 2 ingen | 102: 99 produkt, 1 bara test, 2 bara pipeline |
| Studio utan importör | 4 | 2 (behållna på beslut) |
| `pipeline/`, skript | 109, varav 87 utan konsument | 21, varav 10 utan konsument |
| Testfiler | 359 · 0 föräldralösa | 355 · 0 föräldralösa |
| Importer `lab/lib → web(server)` · `pipeline → web/public` | 125 · 46 | 135 · 18 |
| Systemkarta | gul · 0 röda · 165 varningar | gul · 0 röda · 5 varningar kvar efter ny baslinje |
| GitGuardian | 0 öppna · 17 ignorerade | 0 öppna · 17 ignorerade |

Efter att planmappen tagits bort har `a5441feb` 2 817 spårade filer och 388,03 MB.
Måttet är spårade filer i trädet, inte `.git`-storlek och inte molnlagring.
Systemkartan är gul med 0 röda. Varningarna gick från 165 till 5 när baslinjen
byttes. Ny baslinje och färre varningar är inte borttagna fel. 5 varningar kvarstår.

Importerna mellan Studio och spelmotorn ökade med ny kod på main under arbetet;
de är A22:s område. Byggjämförelsen i A20/A21 gav 74 genererade filer med 0 byte
skillnad. Separat kontroll av serverade runtime-moduler: `live-idle.mjs` är
byteidentisk; `idle-policy.mjs` fick nya bytes bara i två relativa importvägar
(`../` blev `../../../`) som pekar på samma serverade adresser. Övriga prov på
V4-huvudet: full pre-commit, 0 föräldralösa prov, 0 röda i systemkartan och
raderingsspärren 0. Kvar finns som punkter i
`docs/CLOUD-MIGRATION.md` under "Repo-ordning, slutläge", bland annat B18, B19,
A22b och acceptansen efter deploy.

**Indexerad dealerbank borttagen, 12 oktober (V4, `jakob/repo-ordning`).**
`media/dealers/{astrid,amira,vera,mei}/runtime/indexed` är borta ur Git (598 av
632 filer, cirka 278,0 MiB), liksom layoutrader, blob-indexrader och de auditar som bara
läste banken (`audit-dealer-sync`, `audit-performance`, `audit-astrid-actor`)
och deras baslinje `docs/dealer-sync-baseline.json`. Kvar under
`runtime/indexed/audio/en` står 34 MP3 (17 Astrid, 17 Amira, 1,0 MiB) med
oförändrade layout- och blob-indexrader: de bevarade green-speak-talparen kräver
exakt det ljudet. Blob-objekt är inte
raderade. `runtime/presentation` (83 filer) är orörd. Läppsynkverktygen i
`pipeline/` (`sync-audio-warp.py`, `retime-video-warp.py` m.fl. och
`lipsync-overrides.json`) är också borta, på Jakobs beslut, eftersom de hörde
till bankens inspelade talklipp. En ny väg som automatiskt genererar talklipp
från dealerns vilobild, på svenska och engelska, utreds separat. Röstprofiler,
ElevenLabs- och Cartesia-källorna, GPU-workerns läppsynk och dess CI-jobb är inte
avvecklade. Filen `partner-api.html` beskriver tomma `streams`, `deals` och
`speech`, och att `/dealer/…` och `/dealers/…` svarar 410. www ger 404 och Render
direkt 421 för `partner-api.html`. Det är ett rapporterat läge, inte ett beslut
att exponera dokumentet. API-beteendet i övrigt är oförändrat. `AGENTS.md` kräver nu kroken och
provspelning av berörda registrerade dealers i stället för den borttagna proben.

Prov, lokalt med Node 24:
- Studio- och frontendbygget och full pre-commit är gröna.
- `build-runtime-media-catalog --check` och `build-lab-video-manifest --check`
  är gröna. Det finns 0 föräldralösa prov och 0 röda i systemkartan.
- Raderingsspärren visar 0 kvarvarande importer och 0 registerrader.
- Efter granskningen av PR #40: inventeringen avbryts igen när runtime-katalogen
  saknas; bara de tre pensionerade registren får saknas i katalogen. Den riktiga
  inventeringen ger 34 av 34 green-speak-talpar tillgängliga, lokalt och mot
  katalogen. Det generiska negativa hand-proxy-provet ligger nu i
  `test/performance-contact.mjs` med syntetiska data. `partner-api.html` är
  synkad med Markdown. Mutationsprov: den gamla ENOENT-fångsten och en
  försvagad proxyregel fäller var sitt nytt prov.

Kvar: handmattorna i `runtime/hands` har ingen audit, och B9-byggarna nämner den
borttagna banken som tidigare källa. Raderna `act` och `insurance` i
`partner-api.html` är felrenderade sedan tidigare (`\|` i kod delar cellen).

**PAOW: grundloopen väljs och kopplas loss uttryckligen, 12 oktober (`jakob/paow-media-controls`).**
Merge-samordnarens patch, levererad av orkestratorn. Studio väljer och kopplar
loss grundloopen uttryckligen. Röst, andra dealers och filbytes bevaras, och
readiness-beskrivningen för arkivering och återställning är normaliserad.
Behörighet, revisionskontroll och referensskydd är oförändrade
(`findMediaReferences`, `expectedRevision`). Prov: 42 API- och readinessprov,
50 UI-prov och full commit-hook. Separat datautfall på Jakobs uttryckliga
bekräftelse: 20 av 26 registrerade PAOW-klipp är permanent raderade genom appens
beroendekontroll. Sex skyddas fortfarande av fryst publiceringshistorik, och
ingen spärr kringgicks. Det är inget nytt kvitto på media- eller
talacceptans.

**Kompositorn ligger i `packages/presentation`, 12 oktober.** Paketet äger
`compositor/`, `docs/` och `preview/`. Publika adresser
(`/composition-runtime/*`, `/layer-packs/*`, Studio `/preview/*`) och
källfilernas hash är oförändrade. Riktade prov gröna i molnet på Node 22.
Studio-bygge, frontendbygge och hela sviten är orkestratorns, med Node 24.
Kvar: layer-lanen efter deploy.

**Admininloggning från partnerportalen, 12 oktober (`jakob/partner-admin-login-link`).**
`/partner/login` tar fortfarande bara emot operatörspersonal. Ett internt
adminkonto ger samma allmänna fel som ett fel lösenord, och formuläret skapar
ingen session åt det. Ny knapp **Logga in som intern administratör** leder till
N1-inloggningen (`/studio/login?returnTo=%2Fpartner` i produktion) och tillbaka
till `/partner` med samma behörighet som i Kontrollpanelen. Felmeddelandet
hänvisar dit. Prov: `lab/test/partner-login.test.mjs` (länk för båda
`authBase`, formuläret postar oförändrat, felmeddelandet avslöjar inte någon
roll) och full commit-hook. Kvar: inget.

**Repo-ordning våg 2, 12 oktober (V2, `jakob/repo-ordning`).** 3D-, rigg-,
ansikts- och hårspåret, kasinogolvet, Studios originalmediareserv, avslutad
staging, oanvända pipeline-skript, de fem granskningssidorna och
`ops/vercel-entry` är borta ur trädet. `/casino.html` svarar 308 till `/play`
med query kvar. `/v2` är kvar som 307. Katalogstyrda composited-talklipp
stannar eftersom `media/catalog/legacy.json` refererar dem. Astrids
kalibrering, godkännanden och osäkra stagingmappar står kvar. Fem manuella
byggverktyg är enda byggare av media som produkten läser:
`build-previews.sh`, `encode.sh`, `build-hands.sh`,
`build-contact-review.mjs` och `prepend-contact-entry.mjs`. Läppsynkkedjan
och `mouth-crops.json` står kvar. Spelarbygget ligger i
`apps/croupier-frontend/tools/player-ui-build.mjs`. Vercel-projektet
`github-work-vercel-entry` finns inte.
`ops/caddy/bettalotto-game-auth.Caddyfile` är borttagen. A18: live
bettalotto.se svarar 301 till croupier.scoutgg.dev och använder inte filen.
Kevins aktuella Caddy ligger på `kevin`.

Andra svepet tog bort skomodulen, skokontaktens ocklusion,
`bo/media-preview.mjs` och originalmotorn, plus proven som bara skyddade dem.
Hash- och bildruteproven för installerade ready-klipp och de levande talproven
står kvar. `vendor/three` står kvar: den gemensamma spelaren importerar
`three.module.js`.

Jakobs beslut 12 oktober:
- Ready-validatorn `web/public/ready-motion.mjs` står kvar, med sina prov. Den
  kräver att väntläget är en komplett rundresa: ready-loop, talretur samt in-
  och utgång från idle för varje tagning.
- `GLTFLoader.js` och `BufferGeometryUtils.js` i `web/public/vendor/three` är
  borttagna. De saknade importör sedan 3D-golvet togs bort.
- `port-source.mjs` och fem Studio-moduler som kan vara planerade funktioner
  står kvar, bland dem `family-video-upload.tsx`.

Sluträttning efter granskning: main `ff1d6e53` är integrerad med
bakgrundshändelsernas tester, capability 8, bordspanelens CSS och driftkvitton
bevarade. Normal händelsepreview och GameStream visar saknad-video-status
när registrerad video saknas eller fallerar; social/avsiktlig 2D-diagnos
består. Raderingsgrinden stoppar med filnamn och felkod vid källäsfel.
De fyra systemkartslänkarna går nu till befintliga docs. Kartan använder
aktuell V2-katalog och verklig, äldre PR-CI-evidens: 14 gula, inga röda eller
nya gröna och oförändrat historiskt runtimekvitto. Riktade prov: 108/108
Studio och 4/4 grindprov; två Studio-prov och läsfelsprovet var röda före
rättningen. `audit-dealer-sync --probe` passerar för fyra oförändrade set.
Ny full hook, PR-CI och leveranskontroll krävs; inga nya visuella
mediegodkännanden eller produktionsdataändringar ingår.

Tidigare prov på `997a11a4`: orkestratorns lokala körning med Node 24 var grön.
Den omfattar full pre-commit, Studio- och frontendbyggena,
`audit-dealer-sync --probe`, båda mediekatalogkontrollerna, `check-orphan-tests`
(0) och systemkartan (0 röda). Spärren för raderingar gav 0 kvarvarande
importer och 0 registerrader för 1151 borttagna filer. Inget Blob-objekt
raderades. `migrate-media-layout --verify` har samma registerrad för en lokal,
ospårad Astrid-zonfil som på `33be100b`.

Efter merge (`061294ab`) kontrollerat i produktion:
- Render `/__cloud/version` och Vercel `www` kör merge-commiten.
- `/`, `/play` och `/partner/login` svarar 200.
- `/casino.html` ger 308 till `/play` med query bevarad, och `/v2` ger 307.
- De borttagna granskningssidorna ger 404.
- `compositor.js` på `www` är bytelikt repot (sha256 `a668ed93…`).
- Partnerportalen (Nordic Bet: översikt, spelrum, integration) är korrekt i
  ljust och mörkt tema, på svenska och engelska och i 390 px bredd.
- Rummet `paow3` spelar PAOW frilagd över bord och bakgrund, och lagrens
  loopar startar om.

Kvar: provspelning av händelseklipp och tal för de fyra dealerna, när PAOW och
de övriga har sina klipp.

**Env-städning och OpenClaw-namnbyte, 12 oktober (`8a8f434e`, `19c44902`, `deea75a5`).** `fe8b6372` passerar samtliga tre GitHub-jobb och är verifierad live på Vercel
och spelservern; den publika friläggningsmodulen matchar samma commit bytevis.
Gateway driftsattes med samma bevarade konfiguration. Director avslöjade däremot
ett tidigare paketeringsfel: `astrid-observation.mjs` importerar gemensamma
`web/public/dealer-identity.mjs`, men Docker-kontexten innehöll bara labbmappen.
Render återgick till den friska gamla Director-versionen. Båda nyckelnamnen
behölls. Hälsokontroll och admin visar anslutning samt oförändrade fem roller,
fyra modeller och konfigurationshash.

Director-paketet bevarar nu repo-sökvägar och kopierar endast sina faktiska
runtimefiler samt den gemensamma identitetsfilen. En Dockerfile-specifik
allowlist utesluter övriga filer, hemligheter och media. Render behöver Docker
context `.` med oförändrad Dockerfile-sökväg och Root Directory; Gateway har
kvar sin tidigare kontext. Tre isolerade paketprov, full commit-hook och samtliga
GitHub-jobb passerar för `19c44902`. Faktiskt Director-bygge och start är verifierade.
Efter borttagningen av gamla env-namnet är båda tjänsterna åter live på samma
commit och admin/hälsokontroller passerar med oförändrad konfiguration.
Exakta driftkvitton finns i `ENVIRONMENT-VARIABLES.md`.

Gatewayens startkod stöder nu `OPENCLAW_API_KEY` med prioritet över det
äldre namnet, uttryckligt tomt värde stänger av fallback, och barnprocessen
får endast det rättade namnet och OpenClaws interna lösenordsvariabel.
Blueprint, Compose, aktiva exempel och guider använder samma namn för
Director och Gateway. Äldre namnet finns kvar endast som kompatibilitet och
i daterade driftkvitton. 105 riktade Gateway-/konfigurations-/isolationsprov
passerar med Node 24.21.0; namnbytet bevarar sparad Gateway-konfiguration.

Gemini-nyckeln utan produktkonsument, tomma gamla `RUNPOD_ENDPOINT_ID` och
plattformsägda `VERCEL` är borttagna från båda aktiva lokala env-filerna med
privat backup. Render hade 37/53/16/10 env-poster för QA/spel/Director/Gateway;
samtliga återstående namn har produktkällreferenser. Det rättade Gateway-
namnet har lagts till i Director och Gateway med samma befintliga credential
och oförändrade övriga värden. Efter verifierad koddeploy togs endast det gamla
namnet bort med privat backup och läsback; Director/Gateway har åter 16/10 poster.
Omstart utan det gamla namnet och ny hälsokontroll passerar. Ingen modell,
media eller DB ändrades av env-migreringen. PAOWs nya talprofil och visuella
spelacceptans är fortfarande separata återstående steg; webbläsaren blockerade
den första provspelningsadressen för Astrid (`ERR_BLOCKED_BY_CLIENT`), så den
visuella fyrdealerskontrollen återstår. Ingen provinsats gjordes.

**Hemsidans separata byggtest, 12 oktober (`4ea767cf`).** Hemsidans middleware-test laddar nu `next/server` från hemsidans egen
Next-installation. Relativa Studio-importer använder fortfarande resolvern vid
`lab/middleware.ts`. Samma verkliga middleware transpileras och alla befintliga
assertioner för session, transport, alias och avvisade anrop består.
Det isolerade provet har enbart hemsidans beroenden: före rättningen gav det
`MODULE_NOT_FOUND`; efter rättningen passerar samma test. Alla 23 prov i filen
och hela hemsidans testsvit passerar med Node 24.21.0 och fyra workers.
Inga miljövärden, testgrindar eller produktflöden ändrades. GitHub-CI och ett
nytt isolerat Vercel-förhandsbygge ska verifieras efter leverans.

**PAOW-omstart och obligatorisk friläggning, 12 oktober (`0c04d1a2`, `c48fc657`).** Jakob bad uttryckligen om återställbar städning och en metodisk ombyggnad efter
att bord/bakgrund inte gick att lägga bakom PAOW. Via den ordinarie N1-vyn
granskades serverns konsekvenslista och `paow` arkiverades: 25 medieposter,
två sammansättningar (`mobile-phone`, `johns-johanna`) och fyra rum
(Testrummet, Johannas blackjack, ny-jhanna, nordic rum) hos SG-test, Johns
och Nordic Bet. Historik, originalfiler och bolagskonton finns kvar.
Ingen permanent radering eller direkt SQL-skrivning gjordes.

Ny dealer `paow-v2`, visningsnamn PAOW, är sparad med tomma klippkopplingar
och utan aktiv talprofil. Verifierad projektrevision efter omstart:
`studio-5a750fc4-3132-4eaa-b26b-77e73ce13ca2`. Alla 25 gamla medieposter är
arkiverade, noll raderade. Därefter skapades ett sparat utkast `PAOW · Studio`
(`paow-studio-14b6c188-ef58-4ad9-9028-4f6fb58a6de9`) med enbart `paow-v2`,
separat `Bord · Svart och guld` och `Bakgrund · Casino`. En verifierad grön
grundloop har återanvänts med oförändrade originalbytes som ny mediepost
`13d044b3-0582-4f8f-a754-75bb099a0237` och valts som standard för `idle.ready`.
Övriga klipp, talprofil och publicering återstår. Återställ inte gamla PAOW automatiskt:
återställning återför även hennes tidigare klippval och sammansättningar.

Grundfelet i scenredigeringen: saknad compositing-metadata tolkades som
fullbild, vilket dolde bords- och bakgrundslager och deras kontroller.
PAOW hade 25 poster för 13 unika videofiler; elva saknade metadata. Kopior
av samma video hade dessutom olika platskopplingar. Talprofilen fanns kvar;
den tidigare öppna fliken spelade Johanna, som saknade talprofil.

Dealerklipp friläggs nu obligatoriskt i Studio och gemensam uppspelning,
även genererat tal. Grön bakgrund är standard för äldre saknad metadata.
Explicit opaque är fortsatt läsbart i historik, men nekas vid nya skrivningar
och publicering. En verkligt inbakad scen måste ersättas med grön källfilm;
chromakey tar inte bort godtyckliga miljöer. Fel i friläggningen visar fel,
aldrig rå grön video. Tillåtna separata lager kan inte längre spärras enbart
av en gammal fullbildsmarkering. Originalbytes och frysta paket skrivs inte om.

Ändringen gör inga katalogflyttar. PR #19 granskad på `33be100b`; A20/A21
ska flytta kompositor/runtime atomärt med oförändrade URL:er efter denna
beteenderättning (PR-head vid leveransförberedelse `a12a4bc2`). Fortsätt ombyggnaden med en grundloop, ett separat bord
och en bakgrund före händelseklipp, tal och publicering. Godkänn två faktiska
uppspelningar och exakt tal-/videopar; en grön testsvit är inte läppsynksacceptans.

Den nya grundloopen är nu sparad med separat scen och anpassade mobil-/datorlägen.
Två uppspelningar i följd har provats i Studio med PAOWs faktiska originalfilm;
gröna ytor försvinner och bord/bakgrund är separata. Detta är grundloopens
scenprov, inte acceptans av händelseklipp, tal eller ett publicerat spelrum.
Publik rumskatalog och scenpreview respekterar samma uttryckliga lagergrants
även med äldre full-frame/baked-flaggor; 43 tenant-/paketprov passerar.
Talets fullfil och stream använder båda scenens gemensamma kompositor.
Native P6-kvittensen granskar nu den synliga scenbilden efter lyckad rendering,
med samma råvideo som dold ljudklocka. Saknad, dold eller skymd canvas samt
renderingsfel nekar kvittens; 64 stream-/ägarskapsprov och 46 talspelarprov passerar.

Verifiering: riktade UI-/runtime-/API-prov och TypeScript passerar.
Studio-produktionsbygge med Node 24.21.0 och fyra workers passerar (92 byggspår).
11 verkliga Chrome-prov med syntetiskt material passerar: transparenta pixlar,
två spelningar, källbyte, sena callbacks, fel och återhämtning samt separata lager.
`audit-dealer-sync --probe` bekräftar oförändrade fyra historiska medieset;
det är inget nytt visuellt läppsynksgodkännande. Bildkvitton och maskinbevis
ligger privat under `lab/data/platform-private/greenscreen-browser-20261012`
och `paow-rebuild-20261012`. Full ordinarie commit-hook passerar för
kodcommit `0c04d1a2`; inga kontroller hoppades över utöver svitens deklarerade skips.
Vercel-team och projekt är båda `scoutgaming`. Gamla `croupier-lab-ui.vercel.app`
är ett alias till samma driftsättning som www; `croupier-frontend.vercel.app`
och apex omdirigerar till www med 308. Inga domäner ändrades.

**Materialskapande i dealerns arbetsyta, 12 oktober (`d18a58e8`).** Dealer
Forge är samlat i **Dealers & klipp → Skapa material** för vald dealer.
Den separata menyposten och det dubbla registreringsformuläret är borttagna;
registrering och arkivering ligger kvar under Hantera dealers. Gamla
`/control/dealer-forge` omdirigerar till den nya fliken med säkert bevarad
dealer-, sammansättnings-, bolags- och rumskontext, även efter inloggning.

`studio_native_unavailable` berodde på att den interna Next-anpassningen
inte återställde `/studio` för `/api/forge`. Namespace-listan är rättad utan
att utöka behörigheter eller query-policy. Grundbilder begärs utan den
avvisade `?v`-parametern; hash byter bildens React-nyckel och privat media
har fortsatt `no-store`.

Materialutkast bevaras vid flikbyte och tillfälligt API-fel. Dealerbyte,
historik och sidlämning skyddas; sena lässvar från tidigare dealer ignoreras.
Otillgänglig anslutning spärrar skrivning och erbjuder återanslutning med
utkastet kvar. Jobbpollning pausas när fliken är dold. Efter generering
används befintliga Uppdatera klipplistan för att läsa in nytt material.

56 riktade prov passerar, inklusive transportens scope/roll/återkallning/CSRF,
komponenternas effekter, utkast, återanslutning, dealerbyte och omdirigering.
Ytterligare körning av material-, arbetsyte- och scen-navigation passerar
60 prov efter att den äldre komponentfixturen och flikantalet uppdaterats.
Studio-produktionsbygget med Node 24.21.0 passerar, inklusive TypeScript och
byggspårskontroll. Ordinarie fulla commit-hook passerar; de nya komponentproven
ingår även där. Villkorade miljöprov behåller sina befintliga skips.
Ingen betald generering, medieändring eller verklig DB-skrivning har gjorts.
Användarens öppna Forge-flik med osparade fält har lämnats orörd.

**Blackjackstart och granskning av uppspelningslogik, 12 oktober (`dda785ec`).**
`prepareTable` anropade `loadLabClipConfiguration` efter att funktionen tagits
bort i `7f7f6fc0`. ReferenceError låste bordet före serverns `state`, så inga
marker kunde läggas. Det kvarvarande anropet och dess kommentar är borttagna.
Den gamla funktionen gjorde redan inget för den gemensamma spelaren.

Regressionen kör verkliga `prepareTable`, `placeBet` och deal-knappens kod för
inloggad spelare, gäst och Studio-provspel. Den tidigare teststubben för den
borttagna funktionen dolde felet och är borttagen. Fyra prov föll med exakt
skärmbildens ReferenceError före rättningen; 17 riktade prov passerar efteråt.
Ett nytt bindningsprov i ordinarie pre-commit granskar spelklientens, urvalets
och kompositorns JavaScript utan runtime-stubbar. Kompositorns katalog är
`packages/presentation/compositor/`. Urval och idle ligger i
`packages/presentation/runtime/`. Webbläsarens adress `/presentation-runtime/*` är oförändrad.

Läsande jämförelse: main `dbc925c3`, Kevin `8837bcc5`, omorganisations-PR #19
`f3892c47`. 119 JavaScript-filer granskades utan ytterligare odefinierade
kodnamn. Gemensam kortgivning, hålkort/vändning, tal, hashverifierad videobuffer
och förberedelse av nästa klipp finns kvar. Buffring och kortöverlägg har
redan selektivt anpassats från Kevin; hans separata motor, demoplånbok,
identitet och mediabank ska inte helmergas för att rätta starten.

Kvar i befintlig omorganisation:
- `transitionClipsForDealer` har endast en testkonsument. Facken Till skon/
  Från skon är konfiguration; automatisk uppspelning är ännu inte inkopplad.
  Detta är ofärdigt arbete, inte belagt borttagen logik.
- A30/T7: `buildAssetsManifest(web/public, dealer)` gav 0 streams/deals/speech
  för Astrid, Vera, Amira och Mei. Partnerproducenten läser gamla sökvägar och
  erbjuder scenadresser som avsiktligt ger 410. Kräver ett uttryckligt
  partnerkontrakt mot publicerade paket, inte återaktiverad originalspelare.
- Kevins återhämtning efter browserpaus och filmvarianter för vila/redo är
  möjliga fortsättningar med egna mediekrav. A20/A21 ska fortsatt vara
  flyttar utan sådana beteendeändringar.

`audit-dealer-sync --probe` passerade för alla fyra historiska medieset;
inga media eller godkännanden ändrades. Det är inget nytt visuellt
lipsynkgodkännande. Amira är avvecklad som aktiv identitet; offline-start får
inte kringgå kravet på registrerad dealer och publicerat/sparat provpaket.
Full pre-commit-regression med Node 24.21.0 och högst fyra lokala testworkers
passerade. Fixen levererades i `dda785ec`; alla tre GitHub CI-jobb är gröna.
Vercel-deploy `dpl_DWJPqPpjsz8wzkDAsgx8ckK6Vh3E` är READY och den publika
`www.scoutgaming.tech/app.mjs` matchar den rättade källan (normaliserade
radslut). Render `/__cloud/version` bekräftar också `dda785ec`.
Inget verkligt spelarbelopp har använts för ett liveprov.

**Merge-samordning och CI-cache, 12 oktober (`45ff5c25`).** Övertagen av
merge-cd76. Merge gäller bara PR-author `Jakeminator123`, samma repo, mål
`main`, exakt aktuell head och granskade gröna kontroller. Worktree e37e togs
bort efter renhets-, privatfil-, process- och ancestrykontroll; den mergade
lokala `codex/john-n2-admin-partners` togs bort (fjärrgrenen består). 8e3c har
fyra egna commits och privat videoeditormaterial. d5ed blev senare tom och
oregistrerad genom en extern ändring; inget kommando från merge-cd76 raderade
den, och backup av dess privata reproduktioner är ännu inte verifierad. CI
använder samma FFmpeg/jq-installation i alla tre jobb, cache per Ubuntu-image
och ingen nedladdning vid komplett cacheträff. Studios två byggen återanvänder
`.next/cache`. Åttaminutersgränsen, alla tester och migrationsgrinden består.
Första Ubuntu-körningen på `45ff5c25` visade att offlineinstallationen behövde
peka APT:s arkivcache på samma mapp som download-only; kopplingen och fixturen
är rättade i `dbc925c3`. Tidsvinst och en riktig varm cacheträff återstår att mäta.

**Dealer Forge i produktion, 12 oktober (#16, #17, #18, `91969107`).**
Dealer Forge, nu fliken Skapa material, genererar en dealers klippbank via Runway från ett
VILA-foto; se lab/docs/README.md. Migration 008 kördes cirka 11:08 som
`croupier_game`; ledgern är 001–008 och båda runtime-kontrollerna kräver exakt
001–008. Testat: 24 Dealer Forge-tester inklusive felinjektion, migrations- och
runtimetester samt läsfråga mot produktion. Kvar: skapandet av Runway-avatar
journalförs inte (ett nätfel kan ge en extra avatar, ingen dubbel
klippdebitering). Första riktiga genereringen granskas i Dealers & klipp innan
något publiceras.

**Node 24 på Studio, 12 oktober (`12a12fd6`).** `lab/package.json` anger Node
24.x, samma huvudversion som CI. Vercel ska inte välja en framtida huvudversion
själv. Prov: låsfilsparitet och full precommit med Node 24.21.0. Kvar: Vercels
nya buildlogg.

**Frysta paket utan skoevent, 12 oktober (`e160af12`).** `/play` laddade men
`/api/operators` gav 503 när projektionen krävde 17 event även för publicerade
16-eventpaket. `transition.shoe` följer paketets frysta linjer. Obligatoriska
event och mediavalidering krävs kvar. 78 riktade prov. Läskontroll av Nordic
Bets oförändrade paket återskapade felet och gav därefter ett giltigt rum
lokalt. Inga produktionsdata ändrades. Kvar: live efter deploy.

**Publik bolagslista och GitGuardian, 12 oktober (`5ebe3ff4` i den gamla
anteckningen).** Listan utesluter bara bolag som spelvalideringen avvisar som
ospelbara. Lagringsfel stoppar fortfarande svaret. Johns spelbolag och Nordic
Bet syntes; SG-test blockerade inte listan. 62 riktade prov. Samma dag
klassades de då öppna GitGuardian-fynden till 0 öppna och 17 ignorerade, utan
ändrade behörigheter. Historisk skanning förblev `too_large`.

**Lokal städning och historikrensning, 12 oktober.** Åtta frikopplade
prototypfiler och tre Python-bytecodefiler togs bort. `lab/.next/cache`
rensades. Johanna/Paow-materialet committades inte. Historikrensningen
publicerades efter Jakobs engångsgodkännande av force-push. `Jakobs-v1` pekar
på `b9355ab`. Probe matchade befintlig baslinje. Detta är inget nytt
läppsynkgodkännande.

**Studio, partner och dealerarkiv, 12 oktober (`8e8aced`, `7eb9f7a9`,
`5df1a454`).** Fyra arbetsområden. Sammansättning är dealer, bord och
bakgrund. Spelrum är bolagets instans. Dealerarkiv räknar konsekvens, stänger
AI-tal och återställer utkast med tal av. N2: översikt, spelrum, team,
integration, skyddade utkast. Chrome kontrollerade omdirigering, tom
provspelning och mobilbredd. Kvar: full molnrehearsal.

**Lokala dealers avvecklade som reserv, 12 oktober.** Spelstart använder den
gemensamma presentationsspelaren. Tom konfiguration ger fel, inte en
reservdealer. Lokala dealer-URL:er ger 410. Amira får inte nyregistreras som
aktiv. Frysta paket kräver egna mediereferenser. Probe oförändrad. Kvar:
visuell acceptans av publicerade dealers.

**Dealer Forge, 12 oktober (PR #16 `234614e3`, PR #18 `f410c229`).** Studio har
`/api/forge`; sidan är sedan `d18a58e8` fliken Skapa material i Dealers & klipp. Migration `008-dealer-forge.sql` är
valfri vid deploy och körs i tre steg, först mot produktions-Neon, enligt
`docs/CLOUD-MIGRATION.md`. Den här omskrivningen ändrar inte den koden.

**N2-team, utkast och svarsbibliotek, 11–12 oktober.** Teamändringar använder
aktuella behörigheter och revision. Sista aktiva administratören skyddas.
Ändringsjournalen finns för intern admin och för partner med `team.read` plus
`team.roles.assign`. Granskad publicering kan återställas till nytt utkast.
Svarsbiblioteket är privat per dealer. PAOW:s sparade basklipp antecknades som
`dealer_desktop`, 1920×1080, 5 sekunder, utan att ett produktionspaket
publicerades i det provet. Kvar: JN2-B visuellt.

**Egen röst och Astrids taltransport, 11 oktober.** Registrerad dealer kan
spara röstprofil och referensbildruta. Ett tekniskt Astrid-svar i befintlig
SG-test-spelare gav texten "Hello Jakob, welcome to the table.", 1080×1920
H.264, AAC 24 kHz mono, 3,4177 s, ljudmedel −18,4 dB. Munrörelse syntes i
granskade bildrutor vid 0,6, 1,4 och 2,2 sekunder. Det är inte formell visuell
läppsynksacceptans. PAOW-profil antecknades senare som aktiv; visuell
acceptans återstår. Probe matchade de fyra baslinjerna.

**Spelaryta och gemensam väg, 7–11 oktober.** `/play` visar bolag med spelbara
rum. `/play/blackjack` utan spelmål går till lobbyn. `?operator=` begränsar
lane och dealer till paketet och överlever spelarinloggningen. Profil och
historik finns. Rehearsal: `?dealer=<namn>&rehearsal=1` och
`?lane=layer-preview&rehearsal=1`.

Äldre planer och inventeringar som låg under `random/` finns kvar i Git, till
exempel `git show 00ea55c5:random/checklista-2026-10-08.md` och
`git show 00ea55c5:random/losa-tradar-2026-10-07.md`. A01 tar bort katalogen
ur trädet. Ingen ny plats är känd.

## 4. Äldre avsnitt

Äldre avsnitt: `git show 00ea55c5:docs/JOHN-HANDOFF.md`.
