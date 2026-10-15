# Scoutgaming: aktuell källa, drift och leverans

## Aktiv genomförandeplan — enklare Admin, 15 oktober 2026

Jakob har gett återstartsmandat för befintlig Admin, en leveransström och
inga nya underagenter, arbetskopior eller testmiljöer. Arbetskopian är
admin-document-navigation, branch codex/stabilization-checkpoint.
Målet är synligt enklare arbete och färre aktiva delar, inte fler trackers.
Production från main är användarens acceptansmiljö; ordinarie lokala tester,
CI, PR-granskning och ägarkontroller gäller fortfarande.

| Ordning | Leverans | Klar när |
| --- | --- | --- |
| 1 — pågår | Sammanhållna materialkort | Förhandsvisning, format, användning, ljud och felstatus finns på samma kort som den befintliga säkra papperskorgen; spelurvalet gäller hela vyn. Slutligt head är granskat och grönt, rätt main-SHA körs och flödet är browserverifierat. |
| 2 | Spelbolag → Rum | Ett begripligt huvudflöde visar rummets spel och bakgrund/dealer/bord tillsammans. Biblioteket är sekundärt. Rumsval och delade malländringar hålls åtskilda och konsekvenser syns vid ändringen. |
| 3 | Klippkarta | Situation, klipp/tagning och körregel är skilda. Vald film, faktisk sparad policy, verklig triggeranslutning och utkast/publicering framgår. Befintlig policyeditor återanvänds. |
| 4 | Tal | Inspelat, ny generering och realtid är skilda. Faktisk fil, text, ljud och granskningsstatus visas utan att mallar eller röstprofiler räknas som färdiga filmer. Ny rörlig läppsynk förblir tydligt avstängd. |
| 5 | Env-förenkling | Befintlig miljödokumentation visar behåll/flytta/ta-bort per namn, konsument, loader/prioritet och build/runtime för lokal drift, Vercel, Render och Emil. Endast verifierad lokal redundans tas bort; produktionsvärden och Emil lämnas orörda. |
| 6 | QA-återgång och lokal konsolidering | QA:s unika kod/stash/kvitton är bevarade och osäker QA är stängd. Exakta molnresurskandidater kräver separat beslut; Preview återkopplas inte till produktion. Huvudcheckout/startprofil är verifierad, överförda egna kopior städas säkert och varje kvarvarande kopia har ett konkret syfte. |

Varje del avslutas före nästa: relevant kontroll → obligatoriska kontroller →
slutgranskning → normal PR/merge för verifierat Jakob-ägt arbete →
kontroll av produktions-SHA och ändrat browserflöde → avgränsad egen städning.
Produktionsskrivprov begränsas till kända test-/demoresurser med återställning.
Inga riktiga saldon eller aktiva kundpubliceringar används som testdata.

PR165 är uttryckligen parkerad och bevarad i n1-player-session:
head 34281e4c, tre okommittade rättnings-/dokumentfiler. Den går bara före
om ett valt Admin-flöde kräver N1-till-spelarkonto-övergången. Vid återupptagning
krävs verklig grön SQL-/omstarts-/HTTPS-CI och granskning av slutligt head.
Den röda PR-koden ingår inte i materialkortsleveransen.

QA:s 24 staged filer, integrationsstash, fem dependency-junctions och privata
återställningsunderlag bevaras. Ingen QA-utbyggnad, helbranch-import, ny
mediekatalog eller aktivering av providerjobb ingår. Ofullständigt underlag
för worker/image/avatarbank redovisas utan att stoppa oberoende Admin-arbete.

Bevarande före ändring: de tre tidigare dokumentutkasten finns som avgränsad
patch i huvudcheckoutens privata
arkiv/2026-10-15/admin-consolidation/preexisting-docs.patch.
Materialkorten är lokalt implementerade: 31 riktade regressioner passerar
utan skip; Lab-build passerar med 97 kontrollerade byggspår. Fullhook,
slutgranskning, PR/CI och produktionsacceptans återstår. Ingen merge eller
deployment har utförts i denna leverans. Förebilder och bygglogg ligger i
samma privata evidensmapp.

## Admin på huvuddomänen — migrationslogg 13 oktober 2026

**Så används loggen:** detta är aktuell status, en ändringsbar arbetslista och
daterade provkvitton. Den låser inte produktens menyer, layout eller arbetsflöden.
Jakobs aktuella instruktioner styr nästa steg; uppdatera checklistan när målet
ändras och behåll äldre kvitton som historik. En öppen ruta innebär att det
angivna resultatet ännu inte är verifierat, inte att annat UI-arbete är förbjudet.
Beskriv konkreta beroenden när något måste vänta, exempelvis osparat arbete,
behörighet, data eller ett inkompatibelt runtimekontrakt.

**Läs först:** C1–C9 nedan sammanfattar Admin-arbetet. T2/JN2 beskriver
partnerfunktioner och P6 plattformsacceptans; de har olika omfattning och
ersätter inte varandras prov. Daterade kvitton gäller angiven version och miljö,
inte automatiskt senaste main. Praktisk återställning finns i
[ENVIRONMENT-RESTORATION.md](ENVIRONMENT-RESTORATION.md); äldre backupkvitton
här är historik. Uppdatera aktuell checkpoint när nya resultat tillkommer.

**Dokumentets ursprung:** Git registrerar filens första version på Jakob Ebergs
konto den 28 september 2026 kl. 19.57 svensk tid, i commit `3de0173f`:
`Move V2 work to GitHub and document cloud readiness`. Det var ett tekniskt
driftsunderlag, inte en UI-specifikation. Git anger inte vilken människa eller
agent som formulerade texten. Admin-checklistan tillkom den 14 oktober i
`ab444a58`. Granskning på `87f30ce1` visar att checklistans rutor inte styr
Admin eller dess byggvillkor: `cloud-readiness.mjs` hänvisar till driftbevis,
och systemkartans kontroll validerar plan-ID:n i `planned.json`, inte denna
Markdownfilens statusrutor. Befintliga data-, behörighets- och runtimekontroller
gäller oberoende av loggens formuleringar.

Denna logg skiljer flytten av N1-arbetsytan till `/admin` från en framtida
avveckling av gamla hostnamn och från flytt av källkoden i `lab/`. Ingen
procentangivelse ersätter verifiering av varje flöde. Historisk startpunkt,
13 oktober: main `4d6b1ebc` (PR104), Vercel READY och Render live.

### Versionsbunden avstämning inför överlämning, 15 oktober

Förberedelsebasen är main `96750fa0`, där PR162–164 ingår. PR164:s granskade
head var `2a8295a4`; dess lokala kvitto finns i C4-avsnittet nedan. Slutlig
SSO-revision, sammansatt main, driftstatus och browseracceptans inväntas från
samordnaren. Inget av dessa resultat tillskrivs ännu denna avstämning.

Samordnaren bekräftar att `partner-write-acceptance` och `public-lobby` är
managed-arkiverade efter hashbackup och kontroll av egna dependency-junctions.
`pr91-integration` är fortfarande intakt; den aktuella dokumentationskopian
behålls. Det äldre C9-kvittots köade arkivering är historik för sin tidpunkt.

Det sammansatta Lab-byggets 18 CSS-varningar är inte visuell acceptans.
Fokusreglerna i `studio-theme.module.css:24` och
`studio-administration.module.css:21` anger olika outline-färger; ett
avgränsat visuellt tangentbordsprov återstår inom C3. Ingen CSS ändras här.

Samordnarens privata `avatar-bank-checkpoint.json` redovisar 287 poster i
Desktop-ZIP:en utan förväntade banknamn, ett komplett träd för Kevins head
`60e984b4` utan dessa banknamn och staging `ae9fedc5`. Namnkontrollen
identifierar ingen verifierad avatarbank och bevisar inte att allt tänkbart
underlag saknas. Den nya rörliga läppsynken förblir avstängd och oaccepterad;
release/bank och verkliga medieprov återstår. Aktuell env-städning och dess
avgränsade likhetskvitto finns i ENVIRONMENT-VARIABLES.md.

### C4: Admin-dokumentnavigation, 15 oktober

**Ny produktionsobservation 11:17:32.829 UTC:** samordnarens Chrome-prov mot
PR161 på main `a0eca7a8`, Vercel `dpl_5kSZWix64EYCYZDic8BmLPe354wC`,
gav fortsatt 500. Den befintliga loggen för `/control/replies` visar redan vid
middleware: `mode=cors`, `destination=document`, `crossSite=true`, utan
Origin eller Next-action. PR161:s lokala prov placerade transporthoppet efter
middleware och täckte därför inte den observerade ordningen.

Den nya lokala rättningen accepterar denna form bara för befintligt tillåtna
GET-dokument utan body, Origin eller Next-action. API, assets, okända sökvägar,
POST/HEAD och iframe behåller sina spärrar; sessions- och rollkontroller ändras
inte. Negativa gränsprov passerade före rättningen; två positiva regressioner
var röda och är nu gröna. Verklig lokal HTTP-fetch provas både före och efter
middleware genom Admin-routen med syntetisk adminsession; anonym åtkomst ger
fortsatt loginredirect. De tre berörda fokusfilerna ger 61 pass, 0 skip, 0 fel.
Efter integration av main `1c9e1c6a` byggdes hela Lab om, inklusive Lobbyns
ändrade byggindata: 97 byggspår passerar. Kodcommit `6c6db03b` passerar ordinarie
fullhook med Chrome: 3 906 pass, 9 villkorade skip, 0 fel/cancel i 77 grupper.
PR164 är nu mergad som `96750fa0`; slutlig drift- och browseracceptans
inväntas från samordnaren. C4 förblir öppen.

#### Historiskt lokalt kvitto för PR161

Samordnarens nya Chrome-prov på main `d6d56803`: direktöppning/reload av
`/admin` och `/admin/dealers` gav 500 trots giltig adminsession; katalog-API
och same-origin fetch av Admin gav 200. Lokalt återskapas samma 500 genom
verklig middleware, Node HTTP-fetch och Admin-route: fetch ändrar
`sec-fetch-mode` från navigate till cors före sidans behörighetskontroll.
Rättningen normaliserar kända Admin-dokument före transporten, liksom Control.
API, iframe, mutationer, Next-actions och främmande Origin behåller sina spärrar.
Två regressioner var röda före rättningen; slutligt fokusurval gav 59/59 utan skip.
Före main-integrationen gav fullhook med Chrome 3 883 pass, 9 skip och 0 fel.
Efter normal integration av `c024cca7` gav den 3 899 pass, 9 villkorade skip
och 0 fel/cancel i 77 grupper. Lab-bygget återanvänds; dess källor är oförändrade.
Första fullhook stoppade på en inaktuell middleware-förväntning; efter rättningen
passerade slutkörningen. Skip gäller fem databasprov och fyra Linux-specifika prov.
Lab-bygget passerar med 97 kontrollerade byggspår. Samordnarens separata IAB-prov
på samma main genomförde ny login med avsett QA-konto till Admin/dealers,
Avbryt → fokus Skapa dealer samt Admin → Swedish Games Partner/paket v4 →
Lobby med rätt bolag och rum `room-c0031e58-9985-b851-d9a9-4ee419b35ff0`.
Kontot var internal-admin; inga affärsdata skrevs och ingen spelrunda kördes.
Detta är inte N2/N3-rollbevis eller kvitto på den ännu odriftsatta rättningen.
Det lokala transportprovet mäter inte Vercels interna headerövergång.
Detta var det lokala kvittot före PR161:s driftsättning. Det nya produktionsfelet
och fortsättningen redovisas ovan; kvittot innebär inte slutacceptans.

### Isolerad N2-skrivning och granskad publicering, 15 oktober

Befintligt C5/C6-prov går via verklig Partner-arbetsyta: rumsspecifik tillåten
bordsfärg → Spara utkast → reload → Granska publicering → Publicera granskat
utkast. Utkastet lämnar publicerad version orörd; publicering höjer revisionen
exakt en gång. Bolagsstandard, fryst presentation, N1-ägarskap och grannbolag
förblir oförändrade. Anonym Lobby och validerad spelstart får det nya rumsvalet.
North-sessionens försök att spara giltigt South-utkast ger 403 och lämnar
South-utkast/paket orörda. Kodagentens riktade Chrome-körning: 2/2 utan skip.
Sessioner/minneslager är syntetiska. Detta är inte ny login, PostgreSQL-radlås,
produktionslagring, full rollmatris, medieacceptans eller spelrundor. Ingen
produktbugg hittades och inga produktionsdata ändrades.

### Admin checkpoints C1C9

**C4, publik Lobby-ingång, 15 oktober:** Startsidan använder nu `/lobby`,
med Min profil → befintlig profil → Spelhistorik och profilretur till Lobby.
Befintlig serverauth, äldre bokmärken och `/play/{game}` består; ingen fri
returadress införs. Dealer-dialogen återför fokus efter Escape/Stäng.
43 riktade prov utan skip, inklusive riktig isolerad Chrome med syntetiska
data, frontend-/Lobby-typkontroller samt Lab-build med 97 byggspår passerar.
Ordinarie fullhook med Chrome: 3 885 godkända, 9 villkorade skip, 0 fel/cancel
i 77 grupper. Levererad liveacceptans och C4:s fulla rollmatris är fortfarande
öppna; detta är inget nytt login-, spel- eller mediekvitto.

Efter normal integration av main `a0eca7a8` byggdes Lab om eftersom PR161
ändrade dess serverkod: 97 byggspår passerar. Integrationsfullhook med Chrome:
3 902 godkända, 9 villkorade skip, 0 fel/cancel i 77 grupper. De tidigare
fokus-/fullhookkvittona ovan gäller före integrationen; liveacceptans väntar.

**Spelarretur och alias, 15 oktober:** Spelarens återlänk går nu till `/lobby` med servervaliderat bolag och verkligt
rum. Studio-preview går direkt till `/admin/compositions` med sammansättning
och dealer; befintlig sessionsstängning och modifierade klick består. Fria
returadresser eller rumsparametrar används inte som auktoritet.
Åtta pensionerade alias går direkt till motsvarande Admin-sida när native
Admin är aktiverat; äldre konfigurationer behåller Control. Query, auth/API
samt sparade gamla adresser bevaras. Inga spelregler eller mediebytes ändras.
Tre regressioner var röda före rättningen. Slutligt fokusurval passerar
48 prov utan skip, inklusive Nexts verkliga redirectmatchning. Äldre
returförväntningar är uppdaterade och saknad dealer skrivs inte ut som undefined.
Oberoende granskning fann inga konkreta fel. Lab-build passerar med 97
kontrollerade byggspår. PR157 är mergad från `18e2f155` till main `1f65b48f`.
PR-CI `38709044707` och main-CI `38709782178` passerade. Vercel
`dpl_CCYJjTW6WuwUpPj1ccMaPcPRg2f4` är READY och Render
`dep-db89fcbm8hqs73buhsp0` live; faktisk health/version gav 200, ok och samma
SHA 09:09 UTC. Alla åtta alias gav direkt 307 till rätt Admin-sida med bevarad
query. Eget levererat Dragan-returprov behöll exakt sammansättning/dealer och
stängde provsessionen (`studio_preview_not_found`). LAST RETURN syntes.
Ingen ny spelrunda eller medieacceptans; vanlig spelares bolags-/rumskontext
verifieras av isolerade regressioner, inte verklig wallet. Lokal main synkades
med 225 filhashar bevarade. Fem egna junctions är borttagna; privat sessionsfil
är hashbevarad och arbetskopians apparkivering är köad, inte bekräftad.

Arbetsordning uppdaterad 15 oktober 2026 efter Jakobs fortsatta mandat:
en sammanhängande Admin/partner/lobby-produkt, konsumentstyrd legacy-städning,
begripliga källansvar och bättre utvecklingsprov. Verifierad produktversion är `1f65b48f`
efter levererade PR149–157 och PR91; den tidigare grundetappen var PR146–148. ADMIN:s integrationskopia behålls; ändringar görs i egna
arbetskopior. DRAGAN och ADMIN:s avslutade uppgifter är överlämnade.
C4–C7:s fulla acceptans återstår; checklistan ger inga nya spel-/datamandat.
Jakobs mergeuppdrag gäller granskade egna PR:er enligt ägarreglerna.
Automatiska Vercel- och Render-byggen följer main-leveransen.

**Historiskt leveranskvitto, 15 oktober 2026:** PR154 gav main `46444572`.
Main-CI `38662964323` success, Vercel `dpl_6nrpTJ2DKE1cJuEW5rn87H51wwiC`
READY och Render `dep-db82c560tbcc73e3ipk0` live; faktisk engine health/version
gav ok/samma SHA 01:05 UTC. Fullhook på slutlig UI-kod: 3 852 pass/9 skip,
0 fel i 77 grupper; Lab-build 97 kontrollerade byggspår. Egna
`partner-chain-acceptance` är därefter bekräftat app-arkiverad.

**Dragan och env, 15 oktober 06:52–07:14 UTC:** Scoutgamings RunPod-par är lika
lokalt och på Render och skiljer sig från Emils. En ensam ogiltig lokal env-rad
rättades med 50 giltiga värden bevarade och skyddad originalbackup. Detaljer och
GET-bevisgränser finns i [ENVIRONMENT-VARIABLES.md](ENVIRONMENT-VARIABLES.md).
Samordnarens N2-prov läste paket v4:s tre lager och spelade två gånger på desktop
och mobil. Admins befintliga Provspela gav därefter två sammanhängande rundor
i verklig player på produktionsvärden, med egen minnesdatabas/testsaldot:
desktop €5 förlust och mobil 390×844 €5 insats/€10 tillbaka. Slutligt testsaldo
10 000, ingen sidöverströmning eller insamlat JS-fel. Provsessionen stängdes
via återlänken och gav sedan `studio_preview_not_found`.
Detta är ett eget main-kvitto för sparad sammansättning, inte PR91, rummets hela
publicerings-/tillåtelsekontrakt eller genererat tal/läppsynk. Inga verkliga
spelarbalanser eller Emil-inställningar ändrades och inga providerjobb startades.
Alla 36 lokala v4-filmer matchar frysta paketets hash/storlek. Rörlig läppsynk
har fortfarande en konkret transport-/spelarkopplingslucka; se
[LOCAL-PRESENTATION-RUNTIME.md](LOCAL-PRESENTATION-RUNTIME.md).

**Mobilkontroller, 15 oktober:** Dragan-provet ovan reproducerade att den
globala assistentknappen skymde spelarens nedersta kontroller. Blackjack och
roulette (även Studio-preview/äldre speladresser) undantar nu den flytande
widgeten före API/DOM-init. Admin, Partner, Lobby och ingångssidan behåller
assistenten; roller, dealerchatt, spelregler och mediebytes är oförändrade.
Oberoende statisk granskning och 58 riktade prov utan skip är klara.
Lab-build: 97 byggspår. Kodcommit `82986fdd` passerade fullhook med riktiga
isolerade Chrome-prov: 3 854 pass/9 skip, 0 fel/cancel i 77 grupper.
Levererat mobilprov på main `654ab9e2` är klart: 390×844, ingen assistent-DOM,
ingen sidöverströmning och aktiverad DEAL NOW överst i klickträffen. En syntetisk
€5-insats användes för att aktivera knappen; ingen ny runda startades. Separata
provsessionen stängdes via återlänk och gav sedan `studio_preview_not_found`.
PR156:s main-CI `38700979846` success, Vercel `dpl_DsNKZRuJxftpsfpsvrCCvEmpoxhc`
READY och Render `dep-db88cebm8hqs73btc990` live är verifierade; faktisk
engine health/version gav ok/samma SHA. Lokal main synkades med 225 befintliga
filhashar bevarade. Egna arbetskopian `player-controls` är app-arkiverad.

**PR91, integration 15 oktober:** main `654ab9e2` har integrerats i grenen.
De sex ändrade klientskripten är byteidentiska med tidigare granskad `e4f3b562`
och Astrid-provets `542e98b2`. Lab-build passerar med 97 kontrollerade byggspår.
Ordinarie fullkontroll med riktiga Chrome-fixturer gav 3 871 pass, 9 villkorade
skip, 0 fel/cancel i 77 grupper; sena dokumentändringar fick 43/43 godkända prov.
Oberoende granskning fann inga blockerande kodfel. Efter Jakobs uttryckliga
godkännande lästes exakt sex hashverifierade PR91-skript in lokalt i en egen
Studio-preview-flik på produktionsvärden. HTML och backend förblev `654ab9e2`;
`LAST RETURN`-etiketten verifieras statiskt och ingår inte i browserkvittot.
Dragan körde två sammanhängande rundor med egen minnesdatabas/testsaldot:
desktop €5, hand 12/stand, tillbaka €0; därefter 390×844 mobil €5,
hand 9/hit till 19/stand, tillbaka €10. Saldo 10 000 → 9 995 → 10 000.
Bakgrund, dealer och bord samt serverkort/handvärden fungerade; ingen
mobil sidöverströmning eller insamlat konsolfel. De 18 mutationer som fanns
kvar i nätverksbufferten gav 200 och gick endast till den egna preview-sessionen;
bufferten var beskuren och är inget fullständigt nätverksspår.
Återlänken stängde sessionen; ny GET gav `studio_preview_not_found`.
Lokala överlagringar, cacheinställning och viewport återställdes, fliken stängdes.
Detta kompletterar Astrids oförändrade vinst/push/split-/återhämtningskvitto
för PR91:s begränsade klientändring. Inget genererat tal, nytt läppsynksgodkännande
eller full acceptans av publicerade rummets behörighetskontrakt tillskrivs provet.
Privata manifest och skärmbilder: `arkiv/2026-10-15/samordning/env-media-verification/`.
PR91 är mergad från head `0ab5f7f7` till main `a76b31f2` den 15 oktober
08:40 UTC. PR-CI `38706188331` och samtliga synliga kontroller passerade.
Main-CI `38707351874` passerade; Vercel READY och Render live verifierades
separat. Faktisk health/version gav 200, ok och samma SHA 08:59 UTC. Lokal main
synkades med 225 filhashar bevarade. Privata provfiler är hashbevarade;
PR91-arbetskopians apparkivering är köad och har inte bekräftats.

**Historiskt leveranskvitto för PR152:** PR152 är mergad från head
`0bea32e23626d64fb754b39ac7a55d44966ca816` till main `3da92370`.
Samordnaren verifierar alla obligatoriska PR-kontroller, inklusive isolerad
SQL/restart/HTTPS, och lyckad main-CI `38657563321`; dokumentationsjobbet
var scope-skipped. Lokal main är framflyttad, sex ursprungsfiler bytebevarade
och rotens Lab-build gav exit 0/97 byggspår. Vercel production
`dpl_JDtveT5CwKFDUTLPnov2HTUZ6yUG` är READY på `3da92370` med www/apexalias.
Render `dep-db81iilg1s2s73f4d3ng` är live på samma SHA. Tjänstens publika health/version svarade 200/ok och `3da92370` den 15 oktober 00:10 UTC. Säkerhetsläsningen på samma main visar verifierad källa, 0 öppna/18 ignorerade incidenter och aktiv övervakning; platsmetadata är partiell och historikskanningen `too_large`.
Det läsande produktionsprovet och kvarvarande acceptansgränser redovisas nedan.

**Historiskt leverans- och städkvitto för PR150–151:** PR150 är mergad
som `8e97ee83`. Rapporterad fullhook: 3 794 pass, 21 skip, 0 fel i 77 grupper.
Vercel-preview `dpl_Cbau5xs1yARFjnu2UasNuJkDLtdn` är READY; previewbygget
lyckades med speech-tjänstens Node 22-installation och frontendens deklarerade
Node 24-kontrakt. Varje serviceprocessversion lästes inte. Det är ett
avgränsat byggkvitto, inte ny produktionsacceptans.

På denna bas tar partnerstädningen bort 383 127 byte oanvänd klientdemo och
den tillhörande fabriksgeneratorn. Aktiv klient/laddare heter nu
`PartnerOperatorWorkspace` respektive `lab/components/workspace-surface-page.tsx`.
API:er, testfixturer, aktiv CSS och behörighetskontroller bevaras. Kodagentens
rapporterade riktade prov: 153 pass, 1 skip; sista meny-/aliasprovet 11/11.
Samordnarens Lab-bygge är klart med exit 0; byggspårkontrollen rapporterar
`checked: 97`, `removed: 74`. Kodcommit `3c93a3ab` passerade därefter ordinarie
fullhook: 3 792 pass, 21 villkorade skip, 0 fel/cancel i 77 grupper. Ett första
försök stoppades av tillfällig Windows-EPERM i agent-talks samtidighetsprov;
det exakta provet och hela fullhooken passerade sedan utan undantag.
Det isolerade Chrome-provet för partnerlogin/bolag/rum passerade separat
(1/1, ingen skip). PR151 är nu mergad som `3bad2fd4`; alla obligatoriska CI-kontroller är
gröna enligt samordnarens leveranskvitto. Dokumentationsjobbet var avsiktligt
SKIPPED för ändringens scope. Rotens sex lokalt ändrade filer
bevarades byteidentiska vid main-synk. Arkivundantagen i `.ignore` och
`.cursorignore` finns nu på main. Dokumentationsagenten körde inget Lab-bygge.
Samordnarens driftavläsning 14 oktober 23:29 UTC verifierar `3bad2fd4`:
Vercel `dpl_7ikpzdCj3f5dDWbEWiJmM2pni722` READY och Render
`dep-db80v2ek1f9s73e1cjug` live; engine-tjänstens health/version gav 200.
GitGuardian-kvittot 23:23 UTC gäller samma main: verifierad källa,
incidenttäckning `complete-for-source`, 0 öppna/18 ignorerade och aktiv
övervakning; platsmetadata är partiell och historikskanningen `too_large`.
Det är tillskrivna drift-/säkerhetskvitton, inte nya läsningar här.

Samordnarens läsande liveprov på `9b6f4d11` med befintlig personalsession
gick Admin → Swedish Games N2 paket v4/lager → Lobby och gav korrekt launch-URL.
Admin saknade sidöverflöde vid 390 px. Bolags-/rumskontext tappades mellan
portalerna och rättas separat; detta prov stänger därför inte C4, JN2 eller
full spelar-/medieacceptans. Detta är tillskrivet bevis, inte ett nytt prov
utfört av dokumentationsagenten.
Målet är en tydlig, sammanhållen N1-yta med läsbar typografi och fungerande
befintliga arbetsflöden. Ingen ny backoffice byggs och procenttal används inte.

| Checkpoint | Klart när | Ägare/ordning | Aktuellt kvitto och kvarvarande kontroll |
| --- | --- | --- | --- |
| C1 — nuläge och ansvar | Aktuella destinationer, sparade data, filägare och kända luckor är kartlagda här; äldre målbeskrivningar är märkta. | Huvudagenten, efter dokumentöverlämning. | Uppdaterad mot main `1f65b48f` efter PR149–157 och PR91; nya env-/Dragan-kvitton ovan. Jakob gav 15 oktober fortsatt mandat för sammanhängande Admin/partner/lobby, konsumentstyrd legacy-städning och bättre tester. DRAGAN och SAMORDNING har överlämnat partnerretur/C6 och egna Admin-avsnitt; deras spel-, media- och miljöarbete bevaras. Tidigare inventeringar och provkvitton nedan är historik. Huvudcheckouten används inte för editeringar. |
| C2 — begriplig navigation | Varje synlig ingång har ett tydligt syfte, en aktiv huvudmenyrad och rätt destination. Befintliga länkar och spelstarter bevaras. | Navigationsagent → huvudagent. | Lokalt: en bolagsingång i huvudmenyn, samstämmiga etiketter och portaler till `/admin`, `/partner`, `/lobby`. Startsidan öppnar befintliga dealer-, bolags-, publicerings- och provspelningsflöden. 25 riktade tester passerade första passet. Eget levererat prov på `dbfe94b5` verifierar startsida → Bolag & team → publicering → provspelning och tillbaka/framåt med Swedish Games. Full kontroll av varje destination återstår. |
| C3 — sammanhållen N1-design | Läsbar lokal typografi, tydlig kontrast, fungerande fokus och ingen oavsiktlig överlappning/klippning vid desktop, smal skärm och zoom. | Visuell agent → huvudagent. | Lokala resurser provade vid 1440/1024/640/390 px. Läsbarare Inter-text i meny, kontext och klippkort; en sidrubrik för Bolag & team. Reproducerad kortöverlappning rättad med uppmätt radhöjd; minikartan togs bort i PR130 efter verifierad skymning på desktop och mobil. Slutåtgärder i långa paneler kan rullas fria från Adminroboten. Eget liveprov på `dbfe94b5` verifierar Inter/Inter-SemiBold, en bolagsrubrik och inget sidöverflöde vid 390 px. Eget liveprov på `39343967` bekräftar att minikartan är borta och Zoom In, Zoom Out och Fit View fungerar med bevarad rumskontext. Samordnarens läsande liveprov på `3da92370` verifierar att tomt dealerformulärs Avbryt återför fokus till knappen Skapa dealer. Faktisk 200-procentszoom och full dialogmatris återstår. |
| C4 — navigation och kontext | Meny, direktlänk, reload, bakåt/framåt och loginretur behåller rätt dealer, bolag, faktiskt rum, speltyp och sammansättning. | Navigationsagent → huvudagent; separat funktionsacceptans. | Eget läsande liveprov, upprepat på levererad `c3397d1d`, behåller Swedish Games / Dragan-rummets fem kontextfält genom Publicering → Provspelning → Klippkarta och reload/Bakåt/Framåt. Sex isolerade loginprov använder nu riktig Admin och lagrade rum med egna ID:n. Lab-historikens reproducerade bortfall av mellanposter/Next-state samt tappad speltyp rättas: 25 historik-/Admin-prov och 42 övriga navigation-/auth-prov passerar. Partnerreturen är levererad i PR147 och 47 riktade prov inklusive Chromium passerar; se kvitto nedan. På `3da92370` verifierar samordnaren med befintlig staffsession Admin → Partner → Lobby, partnerns meny/reload/Bakåt/Framåt mellan rum och bolagsstandard samt lobbyns val/historik; negativa rum spärras. Ny internal-admin-login är verifierad av samordnaren i separat IAB-prov på `d6d56803` enligt notisen ovan. Övriga roller och hela destinationsmatrisen återstår; äldre oindexerade poster har fortsatt dokumenterad begränsning. PR161 lämnade dokumenttransportfelet kvar på `a0eca7a8`: middleware tar redan emot cors/document. Smal lokal fortsättning och återstående driftsacceptans beskrivs i C4-notisen ovan. |
| C5 — säkra redigeringsflöden | Spara/återläsa, revisionskonflikt, återställning och verkligt osparade ändringar fungerar. Rena formulär ger ingen falsk varning. | En skrivande testägare med isolerade data. | 18 riktade lokala prov passerar för den verkliga projektredigeraren: HTTP-sparning/återläsning, två redaktörers 409, konfliktlösning, historik och avbruten omladdning. Ett reproducerat texttapp under revisionshämtning är rättat och oberoende granskat. Browser-/komponentregression var röda före rättningen. Syntetisk autentisering och lagring; övriga formulär och produktionslagring återstår. Ett valt rum gör inte delad mallskrivning rumsspecifik; använd befintliga `roomOverrides`. |
| C6 — publicering och nivågränser | N1 publicerar rätt granskade revision till rätt N2 och verkligt N3-rum; fel bolag och fel roll nekas på servern. | Samordnat funktionsprov efter C4–C5. | Den isolerade kedjan renderar nu också verklig N2-arbetsyta: N1-form → behörighetskontrollerad PartnerOperatorWorkspace/branding → anonym lobby → validerad spelstart, med samma nya revision och rum. Chrome 2/2 utan skip; Översikt/Spelrum, reload/Bakåt/Framåt, bolagsstandard och partner/staff-länkar verifieras. Främmande bolagssida ger 403. Utökat skrivprov verifierar nu utkast/reload/granskad publicering, exakt +1 paketrevision, rumsspecifikt val till spelstart samt nekad korsbolagsskrivning. Syntetiska sessioner/minnesdata; ny login, full rollmatris, RSC och produktionsacceptans återstår. |
| C7 — faktisk spelacceptans | Två sammanhängande rundor i verklig player på desktop/mobil bevarar lager, tillåtna val, serverkort och saldo. | Spelägaren; samordnas med PR91 och Dragan-geometri. | Eget prov på main `46444572`: två rundor i produktionsvärdens isolerade Studio-preview, desktop förlust och 390×844 mobil vinst; tre lager, serverkort, syntetiskt saldo och sessionsstängning verifierade. PR91:s senare två rundor redovisas ovan. Publicerat rums fulla val och genererat tal/läppsynk återstår. DRAGANs PR123/125-kvitton och två isolerade produktionsrundor efter PR127 på `5ca686c5` är hans prov. Annas tidigare kvitto behålls också som den agentens prov. Vercel READY, Render live och funktion bokförs var för sig. |
| C8 — städning och dokumentation | Ersatta ingångar/texter och egna rester är städade, konsumenter inventerade och guide/handoff uppdaterade utan att radera aktiva beroenden. | Varje ändringsägare; huvudagent samlar. | Dubbla bolagsrubriker/menyingångar och minikartan förenklade efter verifiering. Befintlig tracker och eget handoffavsnitt följer varje rättning. Fjorton avslutade egna arbetskopior är arkiverade efter verifierad överföring/granskning, senast C4-login, C4-historik och C5-utkast. Överförda filer/patchar är hashkontrollerade; egna dependency-junctions, fixture-processer och browserflikar är städade. Partnerlogin/C6:s två nya kopior är hashkontrollerat överförda; deras junctions och fixture-processer är städade och arkivering ligger i appens kö. Integrationskopian, beroenden, Lab-bygge och privata provkvitton behålls enligt Jakob. |
| C9 — granskbar leverans | Egen `codex/*`-gren, avgränsad diff/PR, obligatoriska kontroller, exakta acceptansluckor och kvarvarande arbetskopior redovisas. | Huvudagenten; samordnad mergeordning efter DRAGAN. | Senast levererad PR157 på `1f65b48f`: obligatorisk PR-CI och main-CI gröna, Vercel READY och Render live på samma produktversion. Exakta provkvitton nedan. Historik PR147, kodcommit `d95ba3782e17411ad7f2cb7d418826acfe2150e5`: fullhook 3794 pass/9 skip, 0 fel/cancel i 77 grupper; 97 byggspår och Admin/lobby-typkontroll gröna. Samtliga nya browserprov kördes. 415 testfiler inventerade: 0 föräldralösa, 2 befintliga undantag. Oberoende kod-/test-/dokumentgranskning genomförd; C6:s korsbolagsprov förstärkt efter fynd. PR147 från `codex/admin-partner-return-c6` är granskad och mergad av SAMORDNING. Tidigare leverans-/driftkvitton nedan är historik. |

**Utökad N2-acceptans och menystädning, 15 oktober:** `codex/partner-chain-acceptance`
återanvänder C6-fixturen, riktiga session-/medlemskapskontroller, sidladdaren och
`PartnerOperatorWorkspace`. Branding måste ge 200, rätt fryst presentation och
verkligt formulärinnehåll; oväntade API-fel underkänner provet. Läsbesöken får
inte ändra paket eller administration. Bilder ersätts av importmetadata,
externa anrop blockeras och browser/server stängs efter provet. Lokal Chrome
2 pass/0 skip; detta är inte CI-browser-, RSC-, skriv- eller medieacceptans.
Testcommit `dc7923b3` passerade fullhook 3 852 pass/9 skip/0 fel i 77 grupper.

Samordnarens läsande liveprov på `37b9d6fd` laddade Kopplingar, Radering,
Verktyg, Drift, Ekonomi, Konton & åtkomst och Integrationer utan synliga fel.
Ändringslogg visade endast en hänvisning; den får nu en länk till Bolag & team.
Den dubblerade Spelare-ingången tas bort från desktop- och mobilmenyn eftersom
båda öppnar samma kontovy. `/admin/admin/players` fungerar fortsatt och får
samma aktiva menyval/brödsmula som Konton & åtkomst. 25 befintliga fokusprov
passerar; oberoende granskning fångade mobilens dubblett före slutkontrollen.
Detta breddar navigationskvittot men stänger inte hela C2/C4 eller dialogmatrisen.
Slutlig UI-kodcommit `99882451cd4e8e39ee9c64c06bd3815f4afb6cac`: Lab-build 97 kontrollerade byggspår och fullhook med riktig Chrome 3 852 pass/9 skip/0 fel i 77 grupper. Den tidigare avbrutna körningen räknas inte som godkänd.

**Levererad rumskontext/fokus med läsande produktionsprov, 15 oktober:**
PR152 levererar `codex/admin-room-context` på main `3da92370`. Admin väljer startkomposition
från verifierat publicerat rum. Främmande/inaktuellt/otillgängligt rum varnas
och spärrar portallänkar; inget annat rum länkas tyst. Redigeringskompositionen
kan bestå, och omvalidering bevarar utkastet: tre P2-regressioner röda före,
gröna efter. Aktuellt rum följer partnerns meny, loginretur, reload/historik
och staff-länken till Lobby. Bolagsstandard kräver exakt `scope=company`
utan `room`; roller och bolagsgränser ändras inte. Oberoende auth-/servergranskning
fann inga åtgärdskrävande fel. Lobby behåller operator/room i URL/historik;
C6:s isolerade Chrome-prov passerade 1/1 efter runtime-exportfixen.

Underagenterna rapporterar separata, överlappande provurval: 51/51 för
provider/ControlLanes och den verkliga WorkspaceTool-kedjans tidigare inaktuella
länkar. Bakåt till ogiltigt rum reproducerade utkastförlust med verklig
PartnerAppearance; rättningen gav 48/48 panel-/rumsprov och därefter 12/12
fokuserade accept/avbryt-prov. Giltiga rumsbyten behåller panel/utkast utan prompt.
Dealerformulärets Avbryt återför fokus till Skapa dealer (8/8 enhetsprov);
samordnarens tidigare liveprov lämnade fokus på BODY. På levererad `3da92370`
verifierade samordnaren nu fokus på knappen Skapa dealer efter Avbryt i tomt
formulär. Samordnarens slutliga Lab-build passerade med 97 kontrollerade
byggspår. Kodcommit `e92b82b94bb16865b801b90f32af6582fc6119ae` passerade
ordinarie fullhook med riktig Chrome: 3 852 pass, 9 skip, 0 fail/cancel i
77 grupper. Alla aktiverade browserprov kördes. Överhoppen är fem separata
PostgreSQL/Neon-prov utan konfigurerad testdatabas och fyra Linux-prov på Windows.
Loginfixturen fick sitt nya returberoende och historikfixturen samma explicita
Chrome-kanal som övriga prov. Arbetskopians saknade tsc/ws-beroenden återanvänds
via egna junctions efter verifierade package-/låsfiler; inga kontroller ändrades
för att dölja fel. Praktisk förkontroll finns i ENVIRONMENT-RESTORATION.
Samordnarens eget läsande produktionsprov på Vercel `3da92370` med befintlig
staffsession verifierar Swedish Games Dragan v4: Admin hämtar rätt sammansättning
både utan composition och med `obsolete-context`; Klippkartalänken får rätt
rum/sammansättning/dealer/speltyp. Admin → Partner → Lobby bevarar
`room-c0031e58-9985-b851-d9a9-4ee419b35ff0`. Partnerns Översikt → Spelrum,
reload och Bakåt/Framåt mellan rum och `scope=company` behåller valt läge och
rätt staff-lobbylänk. Lobby behåller bolag/rum vid reload/historik utan att
välja dealer automatiskt. Vald Dragan-dialog visar korrekt
`/play/blackjack?operator=swedish-games&table=room-c0031e58-9985-b851-d9a9-4ee419b35ff0&dealer=dragan`.
Spela klickades inte. Negativa prov: Admin `missing-room` varnar utan portallänkar;
Partner `room` tillsammans med `scope=company` är otillgängligt utan lobbylänk;
Lobby `missing-room` varnar utan spelstart. Inga produktionsskrivningar eller
spelrundor gjordes. Detta är samordnarens tillskrivna kvitto, inte nya prov här.
Ny produktionslogin, skrivacceptans, faktisk 200-procentszoom och full C4/C7
återstår. IAB:s tidigare zoomförsök ändrade inte zoomnivån. Dragan v4-prov
som kräver ännu ej godkänd export av privat spelarkod förblir avgränsat.

**C2/C4/C8/C9, sammanhängande ingångar 15 oktober:** på `codex/admin-continuity`
öppnar standardlogin och tom `/studio` Admin. Verkliga partnerportalens
staff-länkar öppnar `/admin` och `/lobby`; vanliga partners får inga nya
staff-ingångar. Översiktens publiceringslänk öppnar rätt editor med bevarat
bolag, faktiskt rum, sammansättning och dealer. Gamla uttryckliga returlänkar,
auth-gränser och `/play/{game}`-kontrakt är bevarade. Före/efter-proven
reproducerade de felaktiga målen. Gemensamt fokusprov: 157 pass, 9 befintligt
villkorade browserprov skip, 0 fel. Login-agentens utökade urval: 85 pass,
1 skip, 0 fel. Fokuskommandot ersätter inte fullhook eller CI. Levererad
browseracceptans och hela destinationsmatrisen återstår.

Kodcommit `567be8a270499750a3b13d685eba148469a2d0b3`: Lab-build med 97
kontrollerade spår och ordinarie fullhook med 3 794 pass, 21 villkorade skip,
0 fail/cancel i 77 grupper. Oberoende statisk granskning hittade inga
konkreta regressioner. Publiceringslänken behåller rum/dealer i URL:en;
detta är inte bevis för att editorn markerar just det rummet. Fullhookens
skip redovisas som acceptansluckor, inte som genomförda browserprov.

PR149 är mergad som `9b6f4d11` efter grön CI/GitGuardian/Vercel och färsk
ägar-/headkontroll. Huvudcheckouten är på samma main; sex lokalt ändrade
filer bevarades byteidentiska. Vercel production är READY på denna SHA.
Cookiefritt HTTP-prov 14 oktober 22:35–22:36 UTC visar `/studio` → `/admin`,
Admin → rätt N1-loginretur, Control → rätt Admin-mål, Partner → partnerlogin
och Lobby 200. Render rapporterade då ännu `a0df4e26`; de olika driftkvittona
ska inte blandas ihop med full browser-/spelaracceptans.

**C1/C8/C9, byggkontrakt och karta:** `codex/runtime-contracts` versionsstyr
de redan använda Node-pinnarna, rättar frontendens alpha-typkontrakt och
återaktiverar obligatorisk typkontroll utan dependencybyte. Tre typfel blev
noll och 39 riktade prov passerade. Emitterad canvas-JavaScript är
byteidentisk mot tidigare main. Systemkartan inventerar riktiga tjänster,
N1/N2/N3 och tidigare saknade SQL-källor; bevarade baslinjer visar kvarvarande
evidensdrift. Se [kartan](system-map/README.md) och
[runtime/återställning](ENVIRONMENT-RESTORATION.md#byggdelar-och-node-versioner).

**C7, SAMORDNING:s isolerade PR91-kvitto 14 oktober:** Astrid spelades genom
förlust, vinst, push och split i den verkliga spelaren med separat minnesdata
på tillfällig internetadress. Mobil 390×844, sammanhängande rundor och
återhämtning från avsiktlig paus provades; 15 spelkommandon gav 200 och
slutsaldot blev 10 010. Detta är funktion, inte ny mänsklig läppsynksacceptans.
Dragan v4 är förberett men inte spelprovat: automatisk säkerhetsgranskning
kräver separat godkännande för kopiering av privat spelarkod. Ingen sådan
uppladdning gjordes, sandlådan är stoppad och PR91 förblir draft.

**C8, lokal städning:** dubbla speech-/activation-envfiler och förbrukade
`ops/vercel-entry` ligger återställbart under kanoniska `arkiv/2026-10-14/`.
Byte och ACL verifierades. Aktiva dependency-installationer och `lab/.next`
behålls. Egna `env-cleanup-docs` och `lab-security-patches` är app-arkiverade;
ADMIN:s integrationskopia behålls enligt Jakob. Äldre kö-/arkivkvitton nedan
är respektive ägares historik, inte bevis för aktuellt verktygsfel.

**C4, partnerns loginretur i PR147:** en lyckad N2-inloggning tappade
vald arbetsyta och skickade alltid användaren till `/partner`. Ett rött
formulärprov reproducerade felet. Serverredirect, loginformulär och länken för
intern administratör för nu vidare samma validerade partneradress och verkliga
rums-ID. Publika och `/studio`-adresser normaliseras med befintlig routeparser;
externa/kodade adresser, loginloopar och extra parametrar faller tillbaka till
`/partner`. Befintlig N1-prioritet, cookiehantering och behörighetskontroller
ändras inte.

47 riktade login-, session- och routeprov passerar utan överhopp, inklusive
Chromium med riktigt formulär, sida, auth och minnesdatabaser. Båda prefix,
reload, separat rums-/sammansättnings-ID och nekad åtkomst till annat bolag
provas. Destinationens riktiga serverprops verifieras; full N2-komponent och
ny produktionslogin är fortfarande öppna.

Samlade leveranskontroller på kodcommit `d95ba378` passerar: **3794 pass,
9 uttryckliga skip, 0 fel/cancel i 77 grupper**. De nya login-/C6-browserproven
kördes; skippen gäller andra villkorade prov och räknas inte som acceptans.
Studio-bygge (97 spår), Admin/lobby-typkontroll och testinventering är gröna.
Säkerhetsläsning på main `fa1fdaae`: verifierad källa, aktiv övervakning,
0 öppna/18 ignorerade incidenter; platsmetadata är partiell, historikskanning
`too_large` och main-sviten köad. Detta är inte ett nytt drift-/produktionskvitto.

**Levererat C4/C5-kvitto, 14 oktober kl. 20.30 svensk tid:**
PR140:s frysta huvud `c9c36f0aa5cd12db07ac03895d8750ddd4fc520f` granskades
med gröna CI-/preview-/GitGuardian-kontroller och squashmergades till main
`c3397d1d0503927a6d0dafc240c21772634d99ee`. Vercels produktionsdeployment
`dpl_AZmTomDfe14ErSFnjKqp3zzA8at2` är READY på samma SHA och huvuddomänen.
Det är ett driftskvitto, skilt från följande eget funktionsprov.

På den versionen gick egen befintlig session från Översikt till Publicering,
Swedish Games version 4 och dess Dragan-rum, vidare till Provspelning och
Klippkarta. Reload, Bakåt till rätt provspelningsrum och Framåt till klippkartan
bevarade bolag, faktiskt rum, sammansättning, dealer och Blackjack. Rums-ID
`room-c0031e58-9985-b851-d9a9-4ee419b35ff0` skiljer sig från sammansättningen
`swedish-games-dragan-black-81c0867c-5de8-4b48-bcc5-1fe3ce578b39`.
Spara utkast var fortsatt inaktiv. Inga formulär sparades, spel anslöts eller
publiceringar gjordes. Egen testflik är stängd; användarens sessioner bevarades.
Ny produktionslogin, full RSC-/Lab-historik, övriga formulär och C6/C7 är kvar.
Render och verkliga spelomgångar har inte slutprovats av denna agent.

Säkerhetsläsningen på main `c3397d1d` visar verifierad källa och aktiv övervakning:
0 öppna och 18 ignorerade incidenter; platsmetadata är partiell och historisk
skanning `too_large`. Main-sviten är köad; PR140:s egna kontroller var gröna.
Integrationskopian och dess installerade beroenden behålls tills samordnarens
tillfälliga PR91-junctions frigörs. Inga egna produktservrar eller agentprov körs.

**Historisk start av C4-passet, 14 oktober:** färsk main är `ad0ae9ac` efter DRAGANs PR138.
DRAGAN har uttryckligen lämnat över enbart dessa Admin-avsnitt i tracker och
handoff. Han behåller tal, bordseditor, media och sitt publicerings-/spelprov.
Tre underagenter arbetar i egna arbetskopior: loginretur till faktisk
rumskomponent, oberoende Lab-historik och isolerad C5-utkast-/revisionsacceptans.
Huvudagenten samlar kvitton och läser levererad Admin i en egen browserflik.
Inga lokala produktservrar, produktionsskrivningar eller delade utloggningar
ingår i detta pass. Resultaten redovisas nedan när de är verifierade.

**C4, fortsatt login- och rumsprov:** loginfixturen använder nu riktig Admin-entry
med två syntetiska bolag och tre lagrade rum, inte en ersättande HTML-rubrik.
Efter utgången session och lyckad login verifieras de faktiska väljarna och
sammansättningspanelen vid Bakåt/Framåt/reload från båda Admin-adresserna.
Sex browserprov passerar; inga andra skrivningar än fixture-login tillåts.
Rummet och sammansättningen har olika ID:n och lagrade data förblir oförändrade.
Detta är lokal funktionsacceptans med isolerad lagring, inte ny produktionslogin.

Eget läsande produktionsprov på befintlig session visar Swedish Games version 4,
det faktiska Dragan-rummet och samma bolag, rum, sammansättning, dealer och speltyp
genom Publicering → Provspelning → Klippkarta samt reload/Bakåt/Framåt. Inga
spel, publiceringar eller andra dataskrivningar gjordes; egen testflik stängd.
Provet avslutades före DRAGANs senare separata miljöuppdrag.

**C5, reproducerad förlust av ny text:** revisionshämtningen i `ProjectConflict`
använde utkastet från klickögonblicket. Text som skrevs medan svaret dröjde kunde
därför försvinna. Rättningen läser senaste utkastet efter hämtningen och behåller
uttryckligt val vid verklig fältkonflikt. Browser- och komponentregression är röda
före rättningen och gröna efter. 18 riktade tester passerar, inklusive riktig
Chromium/HTTP, lagring/återläsning, två redaktörers 409, oförändrad historik vid
nekad skrivning, konfliktlösning och avbruten omladdning. Autentisering och
SQL-pool är syntetiska; andra Admin-formulär och produktionslagring är inte
slutaccepterade. Fixture-server/browser och egen dependency-junction är städade.
Integrerad efter DRAGANs PR139 på main `220519a1c4d70a808b35781ac965de9c7f133887`. Kodcommit `6ef4a2de456a8ecf5baf5bd87210cdc404f6bcf4` passerar full pre-commit: **3784 pass, 9 skip, 0 fel/cancel i 77 grupper**, Node 24.21.0/fyra workers. Lab-bygget med 97 spår och Admin/lobbyns typkontroll passerar. Alla nya isolerade browserprov kördes; skippen gäller andra uttryckligt villkorade prov och räknas inte som acceptans.

Första fullkontrollen avbröts av äldre testbrowserdubblar som saknade URL-/History API-delar. Tre befintliga harnessar uppdaterades utan att ta bort utkast-, behörighets- eller CAS-kontroller; 81 berörda tester och därefter fullkontrollen passerar. DRAGANs nya talfackstester bevaras. Ingen produktionsdata eller session ändrades för provningen.

**C4, oberoende Lab-historik:** dealerbyten i Lab och svarsbiblioteket skrev
egna historikposter utan Admins index. Ett avbrutet Bakåt-steg kunde skriva över
mellanposten och Nexts routerdata. Den befintliga historiklogiken delas nu av
Admin och dessa två redigerare. En inert tidig lyssnare i befintlig RootLayout
låter samma ägare avvisa steget före Next; ingen global history-monkeypatch införs.
Rättningen bevarar även speltyp i meny, sidans initialdata och loginretur.
25 slutliga historik-/Admin-prov passerar, även efter integration med DRAGANs frysta källkod. Ytterligare 42 navigation-/auth-prov passerade före sista proxy-/fallbackrättningen.
Browserprovet använder riktiga redigerarkomponenter och installerad Next-historypatch
med syntetisk action queue. Talutkastet representeras av en fixturesignal, medan svarsbibliotekets kategoriformulär är verkligt. Det ersätter inte full RSC- eller produktionsacceptans.
Äldre/oindexerade same-document-poster saknar riktning i History API: vid avslag
bevaras utkast och Framåt-stack, men den okända destinationsposten ersätts.
Den begränsningen är kvar och räknas inte som fullständig historikacceptans.

**C6, isolerat sammanhängande prov på aktuell gren:**
`test/admin-publication-chain.mjs` återanvänder befintliga minnespooler och
verklig publiceringskomponent, tjänster och lobbykomponenter. N1 skapar ett nytt
fryst paket med revision 1. Autentiserat N2-API, publik katalog och spelstartens
ordinarie selector/dekoration läser samma revision, bolag, dealer och verkliga
rum; rums-ID skiljer sig från sammansättningens ID. Båda proven passerar,
inklusive Chromium utan överhopp. Lobbyval görs med tangentbord; fixturen
är ett funktionsprov och verifierar inte den fullständiga produktlayouten.

N2-session på N1-skrivvägen nekas med 401, annat bolag eller N2-roll utan översiktsbehörighet
med 403 och fel bolag/sammansättnings-ID i spelstart med 404. Båda bolagen
har egna publicerade paket och lyckade egna starter före korsbolagsprovet.
Nekade försök
lämnar paket och rumsägarskap oförändrade. Konton, SQL-lager, leverantörsmetadata
och runtimekapabilitet är syntetiska; alla anrop stannar i isolerad fixtur.
N2:s fulla gränssnitt, spelarlogin, verklig motor/media och produktions-SQL
är inte accepterade av detta prov. Två verkliga spelomgångar är fortsatt C7.
Provet ansluts till ordinarie hook/CI; webbläsardelen kräver uttryckligt angiven
Playwright-modul, medan tjänstekedjan och komponentimporterna alltid körs.

**Nästa avgränsningar efter C4/C5:** texten för bordsbredd/x/y i
`studio-composition-panel.tsx` behöver tydligare ange att placeringen gäller
den gemensamma sammansättningsmallen; detta är inte en separat sparning per bord.
Separat spelargranskning pekar på alfa utan bordsgeometri i
`presentation-composition.mjs`, ljud/replik styrd av `anyWin` och skillnaden
mellan talformatets 120 s och filmspelarens 60 s. Dessa kodvägar har lästs på
`ad0ae9ac`, men felen är inte egna visuella spelkvitton eller rättade i C4/C5.
PR91:s kodintegration och Astrids funktionella spelarprov genomfördes senare av
SAMORDNING efter Jakobs uttryckliga godkännande; se aktuellt C7-kvitto ovan.
Ingen äldre chatt eller claim räknas som mandat.

**Eftergranskning av PR132, 14 oktober:** DRAGAN hade redan mergat PR132
när detta pass började. Merge `87f30ce1` har samma filträd som granskad head
`ee500d84`. Oberoende kodgranskning hittade inget konkret regressionsfel.
127 kompletterande lokala tester passerade för runtime19, frysta paket,
kortvy, dolt hålkort, splithänder, filmprojektion och responsiv geometri.
Två testfiler saknade beroenden i den rena granskningskopian och kördes därför
i integrationen på samma revision; inga kontroller hoppades över som godkända.
PR- och main-CI är gröna. Vercel `dpl_8YvErXbThWxwGYdDj6NNzXSSqeqa` är
READY med www-alias på `87f30ce1`; Render `dep-db7mlv60tbcc73c2cqpg` är
separat bekräftad live och den publika versionsmarkören visar samma SHA.
Detta är inte ett eget visuellt spel-/publiceringskvitto för PR132.

**Historiskt C4-kvitto före PR140 — isolerad lyckad inloggningsretur:** testets browserloader saknade
loginmodulens relativa beroenden och använde ett gammalt CSS-filnamn.
Det gav `designPreviewReturnTo is not a function` när det frivilliga
browserprovet aktiverades. Fixturen rättas; ett alltid körande importprov
fångar sådana bortfall även utan installerad testbrowser. Ingen produktkod
behövde ändras för detta fel.

Sex inloggningsprov passerar med Chromium och installerad produktions-React.
Det nya provet använder riktiga Admin-route, sessionkontroll, loginformulär
och auth-actions, men egna SQLite-lager i minnet och fångade syntetiska origins.
En utgången, isolerat signerad cookie leder från både `/admin/clips` och
`/studio/admin/clips` till login. Efter lyckad login bevaras bolag, rum,
sammansättning, dealer och speltyp i returadressen vid Bakåt/Framåt/reload.
Det kontrollerar också cookie-scope, `private, no-store`, `Vary: Cookie` och
oförändrad autentiseringsepok. Ingen extern datakälla eller mailtjänst används.
Fixture-HTML ersätter själva Klippkartan; detta är lokal auth-/URL-/historikacceptans,
inte bevis för verklig rumsdata eller hela levererade Admin. Oberoende Lab-historik
och de återstående C4–C7-proven står kvar. Lab-bygget och 97 byggspår passerade.
Commit `cb7f19f7` passerade ordinarie full pre-commit med **3 733 pass,
9 skip, 0 fel/cancel i 76 grupper**, Node 24.21.0 och fyra workers.
Samtliga sex inloggningsprov kördes även i browser; skippen gäller andra prov
och räknas inte som acceptans. GitGuardian lästes på main `87f30ce1`:
verifierad källa, aktiv övervakning, 0 öppna och 18 ignorerade incidenter;
platsmetadata är fortfarande partiell och historisk skanning `too_large`.
Egna fixture-contexts är stängda och den verifierade temporära testkatalogen
med kompileringscache är borttagen. Integration och privata provloggar behålls.

**Kodkartan för C1:** `entry.tsx` registrerar 31 Admin-destinationer:
åtta basytor (`/admin`, `/structure`, `/deletion`, `/dealers`, `/tools`,
`/clips`, `/rooms`, `/assets`, samtliga under `/admin`), tio drift-/systemytor
(`drift`, `ekonomi`, `admin/accounts`, `admin/operators`, `admin/players`,
`admin/payments`, `admin/api`, `admin/log`, `ai/models`, `ai/chat`) och de
13 verktygen i `lab/lib/admin-workspace-routes.mjs`. Verktygen är bolag/team,
publicering, sammansättningar, dealerinställningar, klipp, svar, talgranskning,
provspelning, regler, inaktivitetstal, guide, materialinställningar och dealeragent.
`/admin/rooms?view=registered` och `/admin/admin/operators` är registeröversikter
med egna kontroller; de är inte identiska med publicerings- respektive
bolagseditorn. Därför behålls de. Global ändringslogg saknar fortfarande
anslutet API. Ny `/lobby` saknar äldre `/play`-vyns bordval enligt DRAGANs
kvitto nedan; den nya portallänken innebär inte full spelarparitet.

**Control kan ännu inte katalograderas:** vanliga GET/HEAD-dokument
omdirigeras redan till Admin, men `/control/login` och lösenordsalias
används fortfarande. Partner och Control importerar nu den neutrala
`lab/components/workspace-surface-page.tsx`; Partner är därmed inte längre
beroende av en sidmodul under `lab/app/control/`. Den aktiva N2-klienten är
`PartnerOperatorWorkspace` i `lab/components/kevin-bo/partner-operator-workspace.jsx`.
Admin återanvänder fortfarande `control-*`-komponenter och aktiva `lab/lib`.
Autentiseringsalias, bokmärken och dessa konsumenter måste verifieras innan
ytterligare gamla sidimplementationer tas bort.

**Tidigare integration före PR129, 14 oktober:** `e9996383412d142cf6fa22ecf554854bc150b2c2`
inkluderar main `5ca686c5513982f9a760ad8dd07e67ed4d4e2e40`. Ordinarie full
pre-commit gav **3 712 pass, 11 skip, 0 fel/cancel i 76 grupper** med Node
24.21.0 och fyra testworkers. Lab-bygget, 97 kontrollerade byggspår och
Admin/lobbyns typkontroll passerade. Den läsande produktionskontrollen före
Admin-leveransen visade faktiskt Arial-BoldMT i rubriken. Grenens CSS binder
Admin till lokal Inter; faktisk levererad fontrendering bekräftades senare
i UI-kvittot nedan. Inget textskuggefel hittades i kodgranskningen.

GitGuardian-status på main `39343967` inför slutkvittot: verifierad källa, aktiv övervakning,
0 öppna och 18 ignorerade incidenter. Platsmetadata är partiell och historisk
skanning `too_large`; detta är inte full historisk säkerhetstäckning.

**Eget levererat UI-kvitto efter PR129:** Vercel
`dpl_6z7JFUghfhPAjfYe8JuGLByRY1dX` är READY på
`dbfe94b58043aa501258cfdaec29fcd004bfa5c7` med `www.scoutgaming.tech`
som verifierat alias. Browserns faktiska fonter är Inter och Inter-SemiBold
i meny, brödtext och rubrik med svenska tecken; ingen textskugga/filter på
de kontrollerade noderna. Startsidan och bolagseditorn kontrollerades på
1440 × 1000 respektive 390 × 844. Bolag & team har en synlig h1 och inget
horisontellt sidöverflöde. Swedish Games behålls vid reload och Bakåt/Framåt.
Publiceringens befintliga Dragan-rum går till rätt provspelningskontext och
Klippkarta; bolag, faktiskt rum, dealer, blackjack och sammansättning
bevaras efter startsida → Klippkarta → reload. Inga skrivande nätverksanrop
eller spelstarter gjordes. Detta stänger inte sparning, revisionskonflikt,
rollmatris, lyckad inloggningsretur eller egen spelacceptans.

**Reproducerade följdfel:** GET `presentation-room` med bolag `swedish-games`
och sammansättning `mobile-phone` gav 413 vid två läsningar. Runtimekontrollen
kodar även publiceringskandidaten; dess storleksfel låg utanför GET:s tidigare
felhantering. Uppföljningen returnerar befintliga rum/revisioner med
`ready:false` och `presentation_package_too_large`, eller en tidigare
blockeringsorsak. Klienten har redan en begriplig förklaring och väg tillbaka
till sammansättningen. Publiceringens gränser, behörighet och revisioner
ändras inte. Isolerad regression med verklig encoder och SQL-fixture gick
från `413 !== 200` till grönt; 61 fokuserade API-/kompressionsprov passerade.
En giltig avkodad 50 473-byte presentation klarar Brotli-roundtrip; felet
är inte en antagen 32 KiB-avkodningsgräns.

Vid 1440 × 1000 täckte minikartan dessutom 202 × 152 px av kortet
Spel / Tur & resultat. Efter separat filöverlämning från DRAGAN togs den
överlagrade minikartan och dess förbrukade CSS bort i PR130. Befintlig zoom
och Fit View behölls. Commit `e67e6faa` passerade full pre-commit med
**3 713 pass, 11 skip, 0 fel/cancel i 76 grupper**. Slutligt Lab-bygge,
97 byggspår och Admin/lobbyns typkontroll passerade. Oberoende läsande
granskning hittade inga blockerare. PR- och main-CI är gröna.

**Eget slutkvitto efter PR130, 14 oktober:** merge
`393439677cd78d86807099d973638c72eaa144af` körs på Vercel
`dpl_5eJNZ2f1acm5eUWqJP8ccrGK4HRw`, READY med verifierat www-alias.
Render-deploy `dep-db7m4p2jnfac73df4ja0` är separat bekräftad `live` på
samma SHA; även `/__cloud/version` returnerar den revisionen.
Det tidigare felande GET-anropet för `swedish-games`/`mobile-phone` svarar
nu 200 med `ready:false`. Den tidigare prioriterade orsaken
`presentation_room_environment_required` visas begripligt med länk till
miljövalet. Bolagets publicerade Dragan-rum är fortfarande synligt.
Val av den giltiga Dragan-sammansättningen svarar 200, `ready:true`,
exakt rätt rum och publicerad version 3. Projekt-, administrations- och
paketrevisioner är identiska mellan läsningarna. Inget rum skapades och
inget paket publicerades i provet.

Den levererade Klippkartan saknar minikarta; Zoom In, Zoom Out och Fit View
ändrar vyn som väntat och bevarar bolag, rum, dealer, spel och sammansättning.
Eget desktopprov och före/efterbilder finns privat. De 67 fångade
nätverkshändelserna innehåller inga skrivande anrop, inga HTTP-felsvar och
inga konsolfel. Tre `loadingFailed` utan feltext gäller enbart Vercels
`feedback.js`; nätverket betecknas därför inte generellt som felfritt.
Inga spelstarter gjordes. C4–C7:s återstående acceptansluckor ovan består.

Previewbygget för PR129 var READY men previewvärdens `/admin` nekades av
den befintliga Lab UI-värdkontrollen (403); inga origins eller skydd ändrades.
Render rapporterade fortfarande `5ca686c5` under det egna UI-provet och
är ett separat driftkvitto. Browserloggen innehöll också oklassificerade
scriptavbrott utan feltext; nätverket redovisas inte som helt felfritt.

**Tidigare lokal bevisgräns:** agenternas ändringar har integrerats i
`codex/admin-c1-c3`. Egen läsande browserkontroll laddar tre lokalt byggda
Admin-resurser i en egen flik på huvuddomänen; autentisering och befintliga
läs-API:er används oförändrade. Det är **lokal UI-verifiering**, inte en
deployment eller ny liveacceptans av sparning/publicering/spel. Inga
produktionsskrivningar eller spelprov gjordes. Inga produkt-/Lab-servrar
startades. Befintlig regression för talgranskning, bakgrundsval och äldre
dealer-/bolagslänkar återanvänds; funktionerna byggs inte om.

**Tidigare eget kontrollkvitto:** lokal kodcommit
`2dec9e20c15fd09a7ea7c979fbd15d8113250134`, bas `7946cd5b`, har **3 630 pass,
11 skip, 0 fel/cancel i 75 grupper** i ordinarie full pre-commit, Node
24.21.0 med fyra testworkers. Skippen omfattar bland annat verklig
PostgreSQL/Neon och browserinloggning och räknas inte som acceptans.
Lab-bygget passerar med 97 kontrollerade byggspår; Admin/lobbyns typkontroll
passerar också. Före fullkörningen passerade 17 layout-/bolagsprov och
21 historik-/ruttprov. Historikregressionen är registrerad i ordinarie hook.
Det tidigare passets `c0ff2332` (3 594 pass, 11 skip) och dokumentkontroll
(43 pass) är historiska kvitton, inte bevis för senare ändringar.

Två tidigare fullkörningar av kontextuppföljningen avbröts på Windows
`EPERM` i oförändrade temporärfilsfixturer för agent-talk respektive
product-chat. En provkatalog under `.codex` gav därefter tre korrekta
byggsäkerhetsavslag eftersom externa `.codex`-sökvägar är privata. De
44 berörda proven och sedan hela ordinarie kontrollen passerade med
kommando-lokala `TEMP`/`TMP` i en egen katalog under användarens vanliga
Temp. Testkod, säkerhetsregel, workergräns och CI-beteende ändrades inte.
De avbrutna körningarna räknas inte som godkända kontroller.

**C3, eget UI-prov:** ett öppet klippbibliotek gjorde tidigare kortet högre
än den fasta kortraden. Med läsbarare text blev provkortet cirka 381 CSS-px;
nästa rad flyttas nu ned med 26 CSS-px mellanrum och återgår när biblioteket
stängs. Egen dragning av kort behålls tills användaren återställer layouten.
Vid 390 px ryms sidan utan horisontellt sidöverflöde. Minikartan skymde ett
kort och döljs därför på smal skärm; zoom-/översiktsknapparna finns kvar.
Bolag & team har en synlig sidrubrik och en separat rubrik för valt bolag.
Startsidan har verifierade länkar till de redan implementerade verktygen.
Röstpanelen ryms vid 390 px utan sid-/panelöverflöde och stängs rent utan
redigering. Detta ersätter inte den öppna fullständiga dialogmatrisen.

Ett senare mobilprov visade att Adminrobotens launcher täckte cirka
41 × 22 CSS-px av den nedersta variationsknappen när klippinställningarna
var rullade till slutet. Panelens eget rullområde får därför 6 rem
slututrymme plus eventuell safe-area, med motsvarande scroll-padding.
Efter prov med det nya bygget har hela knappytan fri träffyta och 56 px
marginal på 390 × 844 respektive 46,5 px på 1440 × 1000. Sista väljaren
kan få tangentbordsfokus utan att skymmas. Öppnad chatt och minimering
förblir åtkomliga; både oskickad chatttext och ett verkligt lokalt
kategoriutkast bevaras när chatten minimeras och öppnas igen. Inga
skrivande nätverksanrop gjordes och den egna fliken stängdes utan sparning.
Lagernivåer, widgetkod och chatt-/redigeringsdata ändras inte av CSS-fixen.
Browserns zoomkommando ändrade inte bredd eller pixelförhållande; det
räknas därför inte som verifierad 200-procentszoom.

**C4/C5, egna bevisgränser:** regressionen provar indexerade historikposter
och avbruten navigation under en simulerad uppladdning i den verkliga
importkomponenten. Kompenserande historikretur bevarar Framåt-poster och
skyddar den accepterade kontexten. Äldre eller externa historikposter utan
index har en dokumenterad reservväg: utkast och Framåt-historik bevaras,
men den okända målposten ersätts. Lab-verktygens egna `popstate`-lyssnare
och `replaceState`-skrivningar saknar ännu gemensamt browserkvitto.
En verklig osparad kategori skapades enbart i den egna flikens lokala
utkast: Bakåt/Framåt inom Admin behöll den. Omladdningsvakten aktiverades,
men verktyget gav inte kontroll över dialogens båda val. Fliken stängdes
utan sparning. Ingen kategori, publicering eller annan testdata skrevs till
servern. Ett senare prov observerade `beforeunload` följt av stängning med
`result=false` innan ett uttryckligt dialogval kunde göras; utkast och
aktiverad Spara-knapp fanns kvar. Detta är fortfarande inte acceptans av
båda användarvalen. Ett separat prov visade Vera i Klippkarta på en kontextlös
adress efter återgång via Admin; reload bytte till Astrid. Synkning på
accepterad path/query rättar detta utan att fylla rena `/admin` med kontext.
Tre nya beteendeprov monterar den verkliga kartkomponenten med isolerat
katalogsvar, inklusive bolag, verklig rumsidentitet, spel, sammansättning,
utkast och nekad historikretur. Samlad riktad historik-/ruttsvit: 21 pass.
Eget browserprov efter fix behåller Vera genom meny, Bakåt/Framåt och reload.
Swedish Games / Dragan-rummets hela URL behålls vid meny och Bakåt/Framåt;
sista reload krävde ny inloggning och behöll exakt kontext i `returnTo`.
Lyckad inloggning och därefter återläst rum är därför fortfarande öppet.

GitGuardian lästes före commit på main `7946cd5b`: verifierad källa,
aktiv övervakning, 0 öppna och 18 ignorerade incidenter. Platsmetadata är
delvis ofullständig, historisk skanning `too_large` och SHA-sviten `queued`
utan synliga check-runs. Detta är inte full säkerhetstäckning.
Samtliga sex avslutade arbetskopior, inklusive kontextuppföljningen, är
arkiverade efter verifierad överföring. Egna browserflikar är stängda.
Integrationsworktree `admin-c1-integration` och privata provkvitton behålls.
Ingen produkt-/Lab-session har startats; obligatoriska tester använder
egna kortlivade fixturer.

**Samordning:** DRAGAN släppte dokumentanspråken efter PR118, 14 oktober
00:20 UTC och lämnade uttryckligen tillbaka det egna Admin-avsnittet efter
PR122. Hans import-/rensnings-/geometrikvitton och senare spelprov bevaras.
MERGE:s AI-dokumentation och adresslista samt PR91:s
gren/worktree bevaras. KEVI-POD-EMILs worker/avatars/lipsync, RunPod och
Emil-påminnelse berörs inte. Varje framtida skrivande checkpoint får eget
filanspråk, testdataägare och uttrycklig överlämning vid överlapp.

### Arbetsytan och verifiering

- [x] Dealers i `/admin`: skapa, arkivera, återställ och lämna i papperskorgen
  verifierat med det uttryckligen godkända produktionsprovet Adminprov 2026-10-13.
- [x] Första verkliga Dragan-importen 13 oktober: sex filer med ett gemensamt OK
  och en direkt via Adminroboten; då 21 registrerade klipp, 27 efter första Kevin-importen och 56 efter kompletteringen den 14 oktober.
  Den separata importen
  tar upp till 30 videor per omgång. Filer i banken är inte spelpublicering.
- [x] PR104:s rena talformulär och avslutade importchatt kan lämnas i produktion
  utan falsk varning. Verkliga utkast och pågående uppladdningar skyddas.
- [x] Befintliga bolag/team, rum/publicering, sammansättningar, dealerinställningar,
  medier, svar, provspelning, regler, småprat, dealeragent och guide öppnar inom
  Admin. PR102 återanvänder samma sparade data, API:er och granskade skrivningar.
- [x] Talgranskningens gamla `administration?tab=media-review`-länk öppnar
  rätt Admin-verktyg med dealer. Rättningen ingår i levererad PR110.
- [x] Materialbibliotekets bakgrundsval bevaras för både `tab=backgrounds`
  och `role=background` vid omladdning i PR110.
- [x] Äldre bokmärken bevaras: `lanes?tab=companies` öppnar bolag och
  `clips?dealerId=dragan` behåller dealer-valet i PR110.
- [ ] Slutverifiera rättningarna och full rutt-/funktionsinventering, inklusive
  autentisering, behörigheter, kontext och skydd för osparat arbete, på levererad SHA.

PR110 är mergad som `1595fb451cf19fbcbba1ece04e4bb8c7c74a9bc6`.
Vercel `dpl_aZKAibo81bFLGUfKuyHPSnkckPNm` är READY och Render
`dep-db7aknmi0phs738sv6e0` är live på samma SHA. Full regression före
leverans: 3 552 pass, 11 skip, 0 fel; samtliga CI-kontroller passerade.
Utloggad `/admin/deletion` går till rätt Studio-inloggning med returnTo.
Inloggat beroendeträd kontrollerades 14 oktober efter att webbläsartransporten
åter fungerade. På PR117:s levererade `0511206d` öppnades de 13 Adminverktygen;
Dragan följer med mellan de dealerbundna verktygen. Talgranskning läser rätt
administratörssession och Dragan-val. Utloggade Dealers-, Talgranskning- och
Radering-länkar går till login med rätt returnTo. Detta stänger inte den bredare
acceptansen av samtliga behörigheter, verkliga utkast och spelstarter ovan.

Global ändringslogg saknar ännu eget anslutet API; det fanns inte heller ett
motsvarande fungerande Control-flöde. Bolagets journal finns i Bolag & team.
Det är separat produktarbete och ska inte döljas bakom påstådd migrationsparitet.

### Underlag inför senare frikoppling

- Vercelprojektet `scoutgaming` (`prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD`) äger
  www/apex och de tidigare Studio/frontend-aliasen. På 4d6b1ebc består bygget
  av `web`, `studio` och `speech`: två Next-appar samt taltransport. En äldre
  Lab-adress är inte automatiskt ett separat aktivt projekt.
- Det dokumenterade reservprojektet `prj_I6KkhVlk4qMSPlAwSPZdnz4aVQ2s` gav
  404 i nuvarande scoutgaming-scope. Det bevisar inte radering; verifiera
  ägarskap/scope och faktisk återställningskälla före eventuell avveckling.
- `/studio` är fortfarande teknisk basePath på huvuddomänen för Admin,
  partner/lobby, autentisering, API:er och mediefiler. Behåll tjänsten/routningen.
- `lab/lib/studio-native-runtime.mjs` och `studio-native-request.mjs` kräver
  fortfarande två olika tillåtna HTTPS-origins. Ta inte bort
  `CROUPIER_LAB_UI_ORIGIN` innan Host-/originvalideringen ändrats och positiva
  samt negativa autentiseringsprov passerat. Inga origin-/miljöändringar ingår här.
- Admin importerar modeller och komponenter från `lab/`; Render importerar
  bland annat media-, Blob- och projektkod och bygger Lab i Docker.
  Mappen får tas bort först efter flytt av samtliga konsumenter, byggspår,
  SQL/migrationsspår och autentisering. Behåll `open-claw/lab/` och aktiva
  legacyflaggor tills deras egna konsumenter har ersatts.
- Neon/Blob-data, konton, publiceringshistorik och frysta paket är samma källa
  genom flytten. Behåll gamla länkar som kompatibilitet och verifiera verklig
  N1→publicering→N2→N3 samt spelstart innan någon beroende tjänst stängs.

### Kevins aktiva dealerfiler

Färsk kontroll av refs: `kevin` = `f15b2af16ea7113d451f5c5da14fda031901392a`,
`kevin-staging` = `315cfc554330f1d5541a7ed3bb84044877a6b992`. Materialet
sorteras efter faktiska kodreferenser för Dragan/Dragge och Paow, inte efter
alla filer i mapparna. Senaste Git-build är inte bevis för senaste körande
Kevin-deployment. Manifest, kopior och hashjämförelse hålls privat utanför Git.
Första inventeringen via ordinarie UI/API visade Dragan 21, paow 5 och
paow-v2 1. Första rensnings-/importkvittot den 14 oktober visade
Dragan 27 och ren PAOW (`paow-kevin`) 11. Den senare Dragan-kompletteringen
ger 56 filmer; se det aktuella Dragan-flödet nedan. De gamla
Paow-identiteterna är borttagna; deras tidigare granskningar är inte ärvda.

Per dealer refererar ordinarie spelkod 35 giv-/vändningsklipp, tre grundloopar
samt 70 repliker. Ytterligare tio är preview/fallback och elva bara förladdade.
77 Dragan- och 62 Paow-filmer väljs inte i den granskade spelvägen. Det privata
paketet `kevin-active-dragan-paow-f15b2af1.zip` innehåller 274 kodrefererade
filer med manifest och dealer/fack/sökväg/hash-CSV; SHA-256
`a69caf28bd1aa1db0a703d63e4a17aad37fd2da2222763c1bc83c208996a8866`.
Arkivet är 325 280 137 byte. Alla 274 källfiler kontrollerades mot Git-blob
och disk, och samtliga 279 ZIP-poster öppnades och hashverifierades.
Sju befintliga Dragan-poster matchade Kevins material och återanvändes.
Sex nya Dragan- och elva rena PAOW-filer är importerade via de befintliga
native-tjänsterna med konto-/schema-/grant-/CAS- och fullbyteskontroller.
Alla 17 är alternativ och ogranskade; inga händelseval, publiceringar eller
betalda jobb skapades. Privata slutkvitton bekräftar registrering och hash.
Detta är filproveniens och urval, inte godkänd pose/läppsynk eller publicering.
Staging-grenens villkorade dynamiska talväg ingår inte i Admin-migreringen.

### Uttrycklig rensning och bevarat material

Jakob har begärt permanent borttagning av gamla `paow`, `paow-v2`, Amira
och Johanna, deras exklusiva klipp och övergivna sammansättningar, samt de
fyra bolagen Johns spelbolag, Kevins Spelbolag, SG test och Nordic Bet med
gamla rum. Efter ett motstridigt besked från en annan chatt bekräftade han
åter att även gamla `paow-v2` ska ersättas med ren PAOW från Kevins material.
Detta är ett avgränsat rensningsmandat, inte en ändring av vanlig papperskorg.

Dragan, Astrid, nya PAOW, Anna och roulettens tillhörande material ska
bevaras, liksom alla bakgrundsfiler och de fem nya standardborden.
`Nordic Bet Roulette` är ett gammalt rum bundet till PAOW Studio, inte
Annas separata roulettekonfiguration. Rumsborttagning får inte radera filerna.
`mobile-phone` delas av flera dealers; gammalt dealerval tas bort utan att
hela mallen eller Astrids fungerande spel-/talväg försvinner.

- [x] Leverera den röda menyraden Radering med anslutet beroendeträd och
  tydlig skillnad mellan sparad mall, publicerade val och tillgänglig historik.
  PR110 är driftsatt; den inloggade visuella kontrollen på huvuddomänen
  14 oktober verifierar röd meny, registerläsning och Anna-/Dragan-kopplingar.
- [x] Läsande lokal registerbackup: 3 dokument, 60 mediaposter, 43 paket,
  157 dokumenthistorikposter och befintliga Forge-/bolagsberoenden exporterade
  i en read-only repeatable-read-transaktion. Filen hålls privat utanför Git.
  De 12 bolagsrollerna kompletterar exporten i en separat privat fil.
- [x] Fysisk lokal kopia av 232 inventerade objekt under fyra gamla
  dealerprefix och två gamla bord: 145 404 657 byte, alla SHA-256 verifierade.
  Ingen extra kopia skapades i Blob.
- [x] Lokala gamla preview-/porträtt-/Amirafiler har kopierats privat och
  hashkontrollerats före borttagning: 13 Paow-previewfiler (4 245 767 byte)
  samt ytterligare 84 filer (16 917 281 byte). Dragge, tre delade previewassets
  och Kevins originalurval bevaras. Kodändringen är driftsatt med PR117.
- [x] Slutför exakt objektägande och kvarvarande konsumenter före radering.
  Förinventeringen hade 28 gamla dealer-mediaposter, varav 20 redan var
  raderingstombstones; Forge hade dessutom två privata PAOW-ankarbilder.
- [x] Avsluta gamla Forge-jobbets möjliga commit-väg, gallra beroenden och
  radera överenskomna objekt permanent. Databas-COMMIT och 232 Blob-raderingar
  är bekräftade; skyddade resurser verifierades i samma databastransaktion.
- [x] Registrera ren PAOW utan gammal Forge-profil och importera 11 utvalda
  Kevin-filer, samt komplettera Dragan med sex filer. Slutkvittot och Admin
  visar 27 Dragan-/11 PAOW-klipp; sju befintliga Dragan-filer återanvändes.
- [x] Koppla Dragans 35 valda givnings-/vändklipp och publicera hans rum
  efter två sammanhängande rundor på både desktop och mobil. Swedish Games
  version 3 matchar det provade paketet exakt. Tal/läppsynk är fortfarande
  ogranskat och ingår inte i publiceringen; se aktuellt Dragan-flöde nedan.
- [x] Slutverifiera denna rensning/import i produktion, inklusive att skyddade material och dealers
  är kvar och att borttagna identiteter inte skapas som syntetiska lobbykort.
  Admin visar 27 Dragan-/11 rena PAOW-klipp, Astrid och Anna med sitt rum.
  Beroendeträdets kompletta registerläsning visar inga gamla målidentiteter,
  samtliga bevarade bakgrunder, fem Blackjack-bord och Annas roulettebord.
  `/lobby` visar Scoutgaming Demo med Annas publicerade Roulette-rum; de
  fyra gamla bolagen är borta. Ingen ny spelrunda kördes i detta slutprov.

PR117 är mergad som `0511206dec4cb8468fe92d5f03202718d3bf2585`.
Vercel `dpl_5aP2rJ1C9NbXWJXT4HWc1giMAsxS` READY och Render
`dep-db7c56ss728c73d0fgs0` live verifierades på samma SHA före rensningen.
Full lokal regression efter main-integration: 3 592 pass, 11 skip, 0 fel;
PR- och main-CI passerade. En första skrivskyddad SSH-kontroll nådde äldre
revision under instansbytet och stoppade utan skrivningar; ny anslutning
verifierade rätt revision och samtliga 304 originalrader.

Rensningsplan `93a8b26b37e24e9370164a4ea975d662c5c5485eef089caab9594679f0bec3b6`
gav 164 uppdateringar och 139 borttagningar, med 162 historikrader kvar och
979 kontroller av skyddade delträd. Skyddade tabellfingeravtryck var oförändrade.
Blobmanifest `956871f14885339f23d044d6678166264e6cd9ca122e50a3314b286fec881f4d`
verifierade noll kvarvarande referenser och 232 borttagna objekt, 145 404 657 byte.
Ingen ny Blob-backup eller papperskorg skapades. Konton, plånbok, spel och QA
ingick inte i rensningen. Importens egna temporära Render-filer är borttagna.

### Dragan-flödet — produktionskvitto 14 oktober

Swedish Games (`swedish-games`) äger det publicerade rummet Dragan · Blackjack
(`room-c0031e58-9985-b851-d9a9-4ee419b35ff0`). Den sparade sammansättningen
`swedish-games-dragan-black-81c0867c-5de8-4b48-bcc5-1fe3ce578b39`
använder Lounge varm och Blackjack Oak; endast Dragan är tillåten.
Elva lokala MP4-original matchar redan bevarade biblioteksfiler och ska inte
laddas upp igen. Två PNG är VILA-/REDO-referenser. Importgränsen 30 betyder
högsta antal videor per omgång, inte att 30 nya original inventerades.

PR124 införde explicit, hashbunden sekvenshantering för 35 Kevin-klipp,
med hålkort, vändning och VILA/REDO-varianter. Spelservern äger fortsatt
korten. PR125 (88b140e9) är live på Vercel/Render med runtime v18 och
packningsfixen som löste HTTP 413. Swedish Games version 3 innehåller
exakt samma paket som provspelades: 35 giv-/vändklipp och grundloopen,
46 983 byte kanonisk konfiguration, 7 112 byte branding. Gränsen på
8 000 byte har inte höjts. Full pre-commit: 3 684 godkända, 11 skips,
0 fel; Studio-bygge, oberoende granskning och GitHub CI passerade.

Oak-geometri och kort-/insatsplatser är sparade för båda formaten.
Bordsbredd är 0,68 desktop / 1,40 mobil, y=0,35; dealer-y är 0,06/0,03.
Glappet mellan mage och bord är rättat. Två sammanhängande rundor på
1440×900 och två på 390×844 genomfördes med separat testsaldo i den riktiga
spelaren. Alla sju platser, extrakort, vändning och dealerns extrakort ingick;
använda exakta klipp laddade utan HTTP-mediafel och återgick till grundloop.
Detta verifierar de provade sekvenserna, inte varje möjlig spelkombination.
Spelarens riktiga konto användes inte för provinsatser. Anna/roulette bevarades.

Biblioteket har 56 Dragan-filmer. Fyra svenska taloriginal är importerade
som pending/pending och är inte valda eller publicerade. Exakt text,
hörbar läppsynk och visuell acceptans återstår; automatisk transkribering
är endast ett förslag. Övriga Kevin-pose-/taloriginal aktiveras inte
automatiskt. Rörlig AI-läppsynk har separata avatar-/integrationsprov kvar.
Den privata HTML-stegloggen visar flödet, originalen och provkvittona.
`lab/` behålls som aktiv Studio-källkod; detta är ingen fullständig
frikoppling av den äldre sajten eller acceptans av alla dealers.

Kodgranskningen visar att Blackjack tillåter bordbyte mellan rundor men
spärrar det vid `round || busy`; Roulette saknar intern bordsväljare.
`/lobby` och `/play` använder samma publicerade operatörs-/rumsläsare, men
`/lobby` saknar ännu `/play`-vyns bordval. `/game` är Blackjack-alias och
URL-fältet `table` betyder rum, inte förgrundsbord. Detta är ett konkret
kvarvarande spelarflöde och ska inte beskrivas som full lobbyparitet.

Inför rensningen låg två gamla uppladdade bord endast i materialpapperskorgen:
`4b688411-d186-4229-8f8a-046cd1b0a2c5` och
`b52b9077-de4e-4691-a570-a41a90312f6a`. De har samma bildhash men olika
Blob-sökvägar. De refererades av 112 respektive 105 historiska projektrader,
inklusive delade Astrid-mallar, men inget av de 43 operatörspaketen.
Exakta referenser och objekt togs bort i den genomförda rensningen ovan;
historikraderna bevarades i stället för att raderas i sin helhet.
Johannas och en Astrid-fil har också samma hash men olika objektvägar;
hashlikhet är aldrig bevis för ägande eller tillstånd att radera båda.

`tools/studio-retirement-plan.mjs` är en ren offlineplan/transform med
exakta ID:n, komplett inventeringskrav och revisions-/hashkontroll.
Den gör inga databas- eller Blob-anrop. Faktisk verkställighet måste läsa om
aktuellt underlag och bevara skyddade resurser. Spelarkonton, saldo,
transaktioner och roulettens aktiva arbete ingår inte i rensningen.

Inför rensningen hittades ett Forge-race: en nedladdning som passerat den
tidigare dealer-kontrollen kunde återskapa profil/media efter radering.
Kodrättningen återläser exakt jobb/lease och aktuell dealer under samma
Studio-lås som varje skrivning; profil-/jobbskapande och medieägande
kontrollerar också registret. 60 isolerade Forge-/repositoryprov passerar.
Chattminnets profilskapande återläser samma dealerregister under lås.
Låsordningen följer befintlig native Admin: game först, därefter Studio;
ett samtidighetsprov omfattar de separata anslutningarna.
Produktionsgallringen genomfördes först efter levererad rättning och färskt CAS-underlag.
Ett nytt sparat projekt upptäcktes; endast current project och dess fyra
tillkomna historikrader återlästes för att bevara det parallella Anna-arbetet.
Senare adminändring har också återlästs separat. Backupens förlust av
mikrosekunder i tidsstämplar är reproducerad; exakt precision kompletterar
originalet utan att skriva om det. Färsk read-only serverkontroll matchar
samtliga 304 målposter. Planen bevarar samtliga 162 historikrader och gör
164 exakta dokumentuppdateringar samt 139 raderingar av gamla beroenden.
Fullhook på `2f7b891a` passerar: 3 585 pass, 11 skip, 0 fel (74 grupper).
En separat Blob-kontroll håller Studio-skrivlåset genom färsk referenskontroll,
exakt objektradering och återläsning. 15 isolerade prov omfattar återstart
efter två avbrott och förlust av låsanslutningen; ingen livekörning följer av dem.

## OpenClaw dashboard utan terminal — liveacceptans öppen

- [ ] Driftsätt Gateway, Director och Vercel med N1-engångslänken. Befintlig
  privat helper och Gatewaycredential används; inga nya hemligheter krävs.
- [ ] Verifiera direktöppning från /admin/ai/models i en ny profil och att
  utloggad, partner och spelare nekas utfärdande. Native OpenClaw-sessionen
  är separat och finns kvar efter utloggning från sajten.
- [ ] Verifiera Sol 6.1 genom Gateway efter den additiva katalogmigrationen,
  välj sedan endast önskad administrationsroll via N1/CAS. Alla befintliga
  primary/fallback-val och talroller är bevarade av migrationen.
- [ ] Mät rollernas faktiska trafik före eventuell pensionering. Fem
  registrerade roller och samma grundmodell bevisar inte inaktivitet;
  produktens talanrop kan dessutom välja modell per anrop.


## Adminroboten på alla sidor — kod klar, liveacceptans öppen

- [ ] Granska och driftsätt den separata chattknappen: publik Scoutguide utan
  interna data, N1 Adminroboten och N1 OpenClaw. Sol 6.1/high för administration,
  Luna 6 för publik hjälp. Klippimport och dealerspelchatt behåller egna flöden.
- [ ] Verifiera Vercels befintliga Studio-modellkonfiguration och båda modellerna
  i den driftsatta tjänsten. Lokala syntetiska modellanrop lyckades 13 oktober.
- [ ] Liveacceptans med separata konton: partner/spelare/utloggad nekas interna
  läsningar och skrivningar; aktuell N1 kan granska konsekvenser, skriva mål-ID
  och bekräfta. Kontobyte/rättighetsändring tömmer lokal historik och spärrar
  gamla godkännanden. Inga riktiga produktionsobjekt raderas som test.
- [ ] Bekräfta anslutna datakällors täckning samt önskat Gatewaymodellbyte.
  Levande Gateway 2026.9.5 hade fem roller på 5.6-terra vid statusläsning
  13 oktober; denna kodleverans ändrar inte livekonfigurationen.

Full lokal regression, produktionsbyggen och isolerat dialogprov passerar.
Renderkontots loggar/diskar, godtyckliga OpenClawverktyg, fri SQL och kontinuerlig
övervakning ingår inte. TalkingHead har ingen integration i denna leverans.
Detaljer och bekräftelsemodell finns i [handoff](JOHN-HANDOFF.md).

Statusförtydligad 12 oktober 2026. Detta är den enda migrationschecklistan. Daterade kvitton nedan avser respektive leverans; aktuell Studio-/paket-/portalöverlämning finns i [JOHN-HANDOFF.md](JOHN-HANDOFF.md). T2–T4 är fortfarande öppna där full acceptans saknas, även om flera delsteg nu är levererade.
Äldre checkpoints och avslutade delstegs detaljer finns i
[fryst historik på 4ed55a56](https://github.com/Jakeminator123/scoutgaming/blob/4ed55a5624a28cdd82d8a0c252ead7a24ef3165e/docs/CLOUD-MIGRATION.md).
Privata kvitton, FAIL-historik, journaler och backups bevaras på sina platser.
Aktuell terminologi och flödeskarta finns i [systembeskrivningen](LOCAL-PRESENTATION-RUNTIME.md).
Senare kodversion uppgraderar inte ett äldre acceptansprov automatiskt.

## PNG och ljud i Studios mediaregister

**Inte aktiverat, 13 oktober 2026.** Status-only systemmetadata verifierar
`media_records_check` i project `wandering-hill-60561912`, main
`br-flat-fog-b161a6r8`, databas `croupier_game`: bara `video/mp4` och
`video/webm` tillåts. Faktiska 001–008 i isolerad PostgreSQL 16.15 ger samma
23514 för PNG/WAV/MP3. Parser/v12, alfaprov eller en positiv minnespool
ersätter inte detta databasprov. Den omedelbara rättningen spärrar övriga
MIME med typed 415 före native grant/bytes och repositorytransaktion.

Plan för separat granskad leverans; ingen SQL eller ledgerändring ingår här:

1. Samordna ett nytt migrationsnummer **011 eller senare**. 009 är reserverad
   för B18 och 010 för B19. Ändra aldrig 001–008 eller deras checksummor.
   Lägg den nya migrationen i den ordinarie explicita migrationslistan och
   gör den obligatorisk. Ingen `deploymentOptional` för ett befintligt bord.
2. Utöka endast MIME-villkoret, med transaktion, migrationslås, exakt
   target/constraintkontroll och ordinarie checksum-/structure-ledger.
   **Nuvarande runner kan inte utföra detta ensam:** `migrations.mjs`
   jämför varje äldre `structure_checksum` med aktuell tabelldefinition.
   En ALTER skulle därför göra 001:s fingerprint avvikande. Förbered först
   en explicit versionerad strukturevolution för exakt denna CHECK:
   bevara alla äldre ledgerposter/checksummor och validera både tidigare
   historisk struktur och den nya tillåtna strukturen mot rätt version.
   Oförklarad drift, saknad ny ledgerpost eller fel tidigare fingerprint
   måste fortsatt nekas. Testa även att den äldre runtimeversionen nekar
   det nya schemat; använd inte ett generellt driftundantag.
   Behåll alla tidigare identitets-, objekt- och hashvillkor. DDL-utkast,
   **inte ett direkt körkommando med dagens runner**:

   ```sql
   ALTER TABLE croupier_studio.media_records
     DROP CONSTRAINT media_records_check;
   ALTER TABLE croupier_studio.media_records
     ADD CONSTRAINT media_records_check CHECK (
       jsonb_typeof(record) = 'object'
       AND record ?& ARRAY['id','sha256','contentType']
       AND record->>'id' = id::text
       AND record->>'sha256' ~ '^[a-f0-9]{64}$'
       AND record->>'contentType' IN (
         'video/mp4','video/webm','image/png','audio/mpeg','audio/wav'
       )
     );
   ```

3. Kör hela faktiska kedjan före/efter i ny isolerad PostgreSQL, även med
   giltiga äldre videorader. Verifiera bevarade id/hash/object-spärrar,
   ogiltig MIME, korrekt PNG/MP3/WAV, register/audit-atomicitet, rollback,
   återförsök, omstart och att kontrollprovet inte längre bara använder minne.
4. Förbered den separata aktiverings-PR:en. Behåll tidig formatspärr tills
   den erforderliga migrationen är verifierad; utökad whitelist ska bindas
   till den nya obligatoriska schemaversionen, inte till filnamn, AI eller
   enbart Render v12. Ofullständigt schema får inte utfärda Blob-grant.
5. Först med separat uttryckligt mandat får operatören applicera den
   granskade migrationen mot produktions-Neon, **före kodmerge**, enligt
   befintlig `check-migration-readiness.mjs`-procedur. CI-readiness måste
   sedan vara grön; ingen bypass eller försvagad CHECK används.
6. Efter deploy verifieras ett separat godkänt medieintag med faktisk
   PNG/ljudregistrering, avkodning, exakt privat återläsning, audit och retry.
   Ingen dealer/rumsregel publiceras automatiskt. Runtime v12 måste fortfarande
   stödja alfa/roulette. Tidiga mediefiler kräver sina separata visuella prov.

Rollback efter nya records innebär att intake spärras och en läsande
kompatibel runtime behålls. Återställ inte video-only-constrainten över
nya giltiga records och radera inte sådana records för att göra rollback grön.

## Avvecklade arbetsanteckningar, 12 oktober 2026

Spårade arbetsanteckningar och de åtta planfilerna tas bort ur trädet i denna leverans. Git-historiken på `00ea55c5` behåller dem. Lokala ignorerade env-kopior och bildmappar är oförändrade och ingår inte i produkten.

Öppet som fortfarande gäller, och som inte redan har en egen rad nedan:

- Probe är fortfarande Astrid-specifik (handoff 12 oktober). Checklistans C9, textprov verifierat i produktion, är inte stängd av senare handoff.

Övriga öppna rader från checklistan 8 oktober finns redan i denna tracker: spelare, transaktioner och rapporter (N2.4, JN2-E), marker (JN2-D), partnerns lösenordsåterställning (JN2-J), visuell partneracceptans (JN2-B) och samlad P6 med fyra dealers. Operatörsjournalen (N2.5) är levererad i JN2-C och öppnas inte igen. Systemkartans planerade ruta N2.4 pekar på `docs/system-map/planned.json`.

## Repo-ordning, slutläge 12 oktober 2026

Detta stänger inget JN2-steg och ingen medieacceptans. Det är trädläget efter planen (V1 #19, V2 #23, V3a #34, V4 #40 och avslutet #51 `a5441feb`, 13 oktober 00:35, med A21 och A99), inte ett nytt produktionskvitto. #53 (`36d6d13f`) är dokumentmergen därefter. Därefter kom #54 (`426fa114`). Före/efter-tabellen står i handoffen. Planmappen `ordning/` är borttagen; den finns i historiken på `faf0e822`.

- `github-work-vercel-entry` finns inte (A18:s env-granskning). Spelarbygget är `apps/croupier-frontend/tools/player-ui-build.mjs`. `ops/vercel-entry/` är borttagen.
- `ops/caddy/bettalotto-game-auth.Caddyfile` är borttagen. A18: bettalotto.se svarar 301 till `https://croupier.scoutgg.dev/` och använder inte filen. Aktuell Caddy: `kevin/croupier-scoutgg/drift/`.
- `/casino.html` är 308 till `/play`. Granskningssidorna är borta. `/v2` är kvar som 307. Originalmedia-API:t i Studio är borta. Registrerad video stannar på den gemensamma scenen.
- Källkoden `test-videoeditor/` ligger i `packages/presentation/{compositor,docs,preview}` och källkoden `presentation-runtime/` i `packages/presentation/runtime/`. Publik URL `/presentation-runtime/*` är oförändrad. Shimmen `presentation-runtime/live-idle.mjs` finns kvar avsiktligt för `web/public/local-presentation.mjs`, som laddas i både Node och webbläsare.
- Indexerade banken, läppsynkverktygen och bankauditarna är borta ur Git och Render-imagen. Av 632 filer togs 598 bort (cirka 278 MiB). 34 MP3 (17 Astrid, 17 Amira) i `runtime/indexed/audio/en` står kvar för de bevarade green-speak-talparen. `runtime/presentation`, GPU-workerns läppsynk, dess CI-jobb och röstkällor är inte avvecklade.

**Avgränsad överlämning 13 oktober: delat spelkommandokontrakt.**
`studioCommandSignature` ligger i `packages/shared/studio-game-command.mjs`;
spelmotorns `web/studio-game-commands.mjs` behöver därför inte längre importera
Studios HTTP-authoritymodul. Den gamla sökvägen återexporterar samma funktion.
HMAC-format, felbeteenden, behörighet, publicering och lagring är oförändrade;
övriga `lab/lib`- och OpenClawberoenden finns kvar. På bas `60defa5` passerade
Studio-bygget och 29 riktade kontrakts-/kommandotester. Full ordinarie hook:
3 339 godkända, 7 överhoppade, 1 fel i oförändrat `local-session.test.mjs`
(processens startidentitet saknas här); samma fel återkom på ren `435c496`.
Inga testgrindar ändrades. Systemkartans kontroll passerar med varningar om
historiskt/ändrat underlag; miljöregister, testregistrering och diffkontroll
passerar. GitHub CI återstår. Ingen merge eller produktionsdeploy ingår.
Notisen ligger här för att hålla `JOHN-HANDOFF.md` orörd under PR #91.

Öppet efter planen:

- [ ] Acceptans efter deploy av slut-SHA:n: Vercel READY och Render live; röktest av `/`, `/play`, `/play/blackjack?operator=…`, `/control/login`, `/partner/login` och `/casino.html`; N1 → publicering → N2 → N3 för bevarade `scoutgaming-demo`/Anna Roulette och nya `swedish-games`/Dragan Blackjack när dess geometri är godkänd och rummet skapat; tre lager på mobil och desktop med två uppspelningar i rad; negativa prov (fel bolag, saknad media); rehearsal för paketens registrerade dealers. De raderade bolagen ska inte återskapas för dessa prov. Historiska delkvitton 13 oktober, inte full acceptans: läsande kontroll 01:03 visade Render och Vercel på `a5441feb` och oförändrade runtime-hashar. Föregående agents prov av det senare raderade paow3-rummet 00:45 gäller endast den dåvarande versionen.
- [ ] B18 permanent radering av klipp (beslutad 12 oktober): raden och sökvägen bort med journal (migration 009). Varje sparad paketrevision, fryst presentation eller öppet rum som refererar klippet spärrar. Bekräftelse kräver inskrivet namn. Egen PR; migrationen körs mot produktions-Neon före koden.
- [ ] Bankens Blob-objekt saknar indexrad. De rensas först med B18:s journal.
- [ ] B19 talklipp från vilobilden (beslutad 12 oktober): MuseTalk 1.5 på RunPod med dealerns egen röst, pilot Astrid `goodluck` på svenska och engelska, migration 010 efter B18. Betalda anrop bekräftas med Jakob först. Förtydliga regeln i `AGENTS.md`: förbudet gäller inklistrade munnar i spelaren, inte MuseTalk-genererade. Språkval i spelaren saknas. Utkastet #41 föreslår `009-talkclip.sql`, men enligt besluten är 009 B18 och 010 B19 (senaste Studio-migrationen är `008`). Numret rättas när B19-PR:en öppnas. Den äldre plan-PR:n #41 stängdes vid PR-städningen 13 oktober; beslutskommentaren och grenen bevaras, och B19 är fortfarande öppet här.
- [ ] A22b och framåt, `packages/platform`: utredningen A22a är ärende #52 (`beslut`). Skivorna börjar först efter Jakobs beslut (B12). Proceduren står i `ordning/aktiviteter/A22-platform-karna.md` på `faf0e822`.
Efterarbetet 13 oktober (bas `426fa114`, branch `jakob/ordning-slutfix`) har gett SL-raderna nedan:

- [x] SL-01/SL-02: `tools/raderingsgrind.mjs` räknar den gamla sökvägen vid rename som borttagen, så länge ingen shim finns kvar. `--strict` ger exit 1 för trasiga importer eller aktiva registerrader; historiska omnämnanden är diagnostik. `--staged` läser indexets diff, kod och register; standardläget läser HEAD. Egna verkliga Git-prov: 10/10, inklusive de fyra tidigare läsfelsskyddsproven. Den byteidentiska gamla grinden på `426fa114` och `8c77d05a` faller på de nya regressionerna.
- [x] SL-03, kodskydd återkontrollerat 13 oktober på `cc63db71`: `preservePublishedRoomEnvironment` nekar ändrad bakgrund/policy och jämför hela den frysta viloposten för inbakad miljö. `presentation-room-api.test.mjs` provar oförändrad delad miljö, konflikt utan skrivning och bevarad film vid nya rum. Uppgiften på `426fa114` ovan är historisk; detta lokala regressionsbevis ersätter inte den öppna produktions-/rehearsalacceptansen.
- [x] SL-04: `astrid-select-baseline` arkiverar hela urvalets importkedja, inklusive `web/public/dealer-speech-profile.mjs`. Utan `--write`: 160 fall, 0 avvikelser mot HEAD och guldresultaten, inga nätverksanrop. Basens version ger exit 1 (`ERR_MODULE_NOT_FOUND`). Nytt test kräver att `ARCHIVE_PATHS` täcker importgrafen.
- [x] SL-05: aktiva krav på den borttagna `pipeline/audit-dealer-sync.mjs --probe` är ersatta med `.githooks/pre-commit` och provspelning av berörda registrerade dealers. Daterade kvitton står kvar som historik.
- [ ] SL-06: `node tools/migrate-media-layout.mjs --verify` faller på `dealers/astrid/runtime/presentation/repliker/bank.json`, som togs ur Git i `c474544c` (5 oktober, före planen) men står kvar i `media/layout.json` och `media/blob-index.json`. `astrid-zones-manual-snapshot-2026-09-29.json` är en giltig ospårad källa (hash och storlek stämmer). Raden tas bort med B18:s journal, inte separat.
- [ ] SL-07: `speech-media.json` pekar på `dealers/astrid/speech/{win,goodluck}.mp4`, som saknas. Spelaren läser inte filen; labbinventeringen märker posterna som ej uppspelade. Filens bytes är låsta mot layout och blob-index, så den ändras inte separat. B19:s `goodluck` är ett nytt klipp, inte dessa filer.
- [x] SL-08: alla tre källorna finns kvar och används. Render-/Studio-inventeringen omfattar nu `cloud-media-store` och `video-registry`; Studio omfattar även `legacy-clip-inventory`. Befintliga läsningar av `LAB_PUBLIC_URL` och `CROUPIER_DATA_DIR` är tillagda som villkorade Studio-namn. Inga miljövärden eller tjänsteinställningar ändrade.
- [ ] SL-09: läsande utredning 13 oktober på main `161957f1`: utan inloggning ger Render `/blackjack?lane=layer-preview&rehearsal=1` 307 till www `/game?rehearsal=1`; www `/play/blackjack?lane=layer-preview&rehearsal=1` ger 303 till `/player-login` med lane/rehearsal kvar. Inget 503 reproducerat före inloggning. Serverns möjliga 503-vägar är selector-/lagringsfel (`web/game-entry-operator.mjs:59–65`, `web/server.mjs:1253–1254`), avsiktligt tom startläge utan Neon (`:1265–1268`) och yttre transport-/lagringsfel (`:1291–1296`). Samma startfelsvägar finns på `00ea55c5`, `faf0e822`, `a5441feb` och `426fa114`; selectorvägen refererar inte `test-videoeditor` eller gamla runtime-filer. Inloggad rehearsalacceptans är fortsatt öppen; ingen reservväg eller driftändring tillagd.
- [ ] SL-10: `build-hands.sh` är enda byggaren för bevarade `runtime/hands` men kräver borttagna Vera-strömmar. `build-previews.sh` gör ingenting utan `streams/index.json`, och `prepend-contact-entry.mjs` skriver till borttagna `runtime/indexed/performance`. `build-contact-review.mjs` och `encode.sh` nämner inte banken. Ingen byggare raderas; `runtime/hands` saknar audit.
- [x] SL-11: generatorn delar inte tabellceller vid Markdown-escapad pipe. `act` och `insurance` har tre celler med hela kodvärdet. HTML är regenererad från oförändrad Markdown; nytt synkprov kontrollerar även Copy-for-LLM-texten. Ingen publik route tillagd.

## Flödesomstrukturering, 12 oktober 2026

N1:s nya huvudyta är `/admin`; `/control/compositions`, `/control/companies`, `/control/rooms` och kontextuell `/control/rehearsal` behåller fungerande övergångsverktyg. Sammansättning ersätter presentationslane i användarflödet, medan kompatibla lagrings-ID:n och intern uppspelningskonfiguration behålls. N2 samlar rummets inställningar på `/partner/{slug}/rooms` med bevarade utkast och navigationsskydd.

Förenklingen 13 oktober skiljer rummets befintliga `roomOverrides` från den
gemensamma sammansättningsmallen. Adminens rumsval öppnar exakt bolag och rum
i partnereditorn; mallredigering visar alla berörda rum innan redigering.
Moderna administrationsdokument behöver inte historiska tiers/pitboss/turneringar.
Historiska rum behåller sitt kontrakt och inga sparade fält tas bort automatiskt.
Både Studio och spelmotorn måste ha denna validering innan ett separat explicit
intag använder dokument utan legacyfälten. Ingen SQL-migration ingår.

Senaste mains produktmodell i `TERMINOLOGI.md` gäller; rapportens förslag om
flerspelsrum blir inget nytt krav här. Eventuell utökad miljöidentitet med
bakgrundsvarianter eller publicerad klipp-/mallversion per användning behöver
ett separat kontrakt. Singleton- och konfliktspärrarna behålls tills nya
skrivare, läsare och faktisk runtime har motsvarande isoleringsbevis.
Studio 009/010 förblir reserverade för B18/B19.

Bolags- och rumsarkiv bevarar historik och har revisionskontroll. Ingen SQL-migration eller produktionsdatastädning ingår. De nya mutationerna kräver spelmotorns capability v6 `resourceLifecycle: operator-room-archive-v1`; äldre runtime nekar dem före skrivning. Ägarlösa gamla rum och tidigare avstängda bolag utan arkivmarkör får ingen gissad ägare/automatisk återaktivering. Dealerarkivets samlade konsekvensplan och atomiska avpublicering kräver dessutom capability v7 `dealerArchiveCascade: dealer-compositions-rooms-v1`. Historiska paket behålls; återställning ger utkast utan att starta AI-tal eller spelrum. Full leverans-, UI- och runtimeverifiering redovisas i aktuell handoff; denna kodändring stänger inte JN2 eller medieacceptans.

## JN2-C: slutimplementation och acceptans, 12 oktober 2026

Team använder nu verkliga roller/rättigheter, skyddad avstängning/återaktivering och revisionskontroll. Beständig operatörsjournal ingår i samma SQL-transaktion som varje lyckad konfigurationsändring; nekade ändringar eller auditfel ger ingen affärsskrivning. Läsning är bolagsavgränsad, paginerad och åtkomstkontrollerad. Ingen historisk backfill eller app-radering; retention tills separat beslut.

11 isolerade PostgreSQL-prov (två databaser och verklig omstart) samt 18 browserprov PASS; återkallade roller, bolagsgränser, samtidighet och auth-COMMIT-kompensation är verifierade. Tidigare kvittos begränsning till minnes-/SQLite-fixturer är därmed ersatt för dessa teamflöden. QA är inlagd i befintlig CI-runner. Windows native; inga betalda provideranrop, budgettak 5 USD kvarstår. Produktionsleveransen går via kompatibilitetscommit `d72f392f`, därefter additiv migration006 och först därefter slutkod. Båda förberedelsevärdarna samt grön CI verifierades före migration006; Neon har nu verifierad kedja001–006 och tom journal vid installation, utan affärsskrivningar. Se aktuell handoff för full bevisgräns och legacygranskning. JN2-A/B:s övriga visuella/produktövergripande acceptans och D–K är fortsatt öppna.

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

| Nivå | Aktuell yta | Behörighet och kvarvarande acceptans |
| --- | --- | --- |
| 1 | `/admin` | Intern personal. De befintliga verktygen, inklusive `/admin/companies`, `/admin/publication` och `/admin/rehearsal`, återanvänder sparade data och native-API:er. `/control` är kompatibilitet, inte målyta. Se C1–C9 för destinationer och öppna funktionsprov. |
| 2 | `/partner`, `/partner/login`, `/partner/{operatorSlug}` | Verkliga registrerade operatörer och aktiva medlemskap. `partner_session` och serverkontroller begränsar bolag, roll och revision. N1 hanterar bolag/team i `/admin/companies`; bolagets rum och utkast finns i `/partner/{slug}/rooms`. Spelare, transaktioner och rapporter är fortfarande öppna enligt N2.4/T2. |
| 3 | `/lobby`, befintliga `/play/profil`, `/play/historik`, `/play/{game}` | Ny spelarentré. `/play`-lobbyn och `/game`-kompatibilitet behålls; `/play/blackjack` och `/play/roulette` är spelstarter med serverkontroller för konto, bolag, faktiskt rum och fryst paket. Profilens saldo förblir serverägt. Bordval och full spelacceptans är inte klara genom en ny lobbyadress. T4 är öppen. |

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
- [ ] **T2. Verkliga tre inloggningsklasser och organisationsmedlemskap.** Påbörjad, inte klar. Implementerat: operatörslagring från 005, `partner_session`, verkliga bolag/medlemskap, explicit N1-kontext, paketpublicering och beständig operatörsaudit från 006. Brandutkast och granskad publicering finns enligt JN2-D. Full produktionsacceptans av mottagaraktivering/N2-sparning samt spelardata, transaktioner och rapporter återstår. Behåll
  dagens kollisionssäkra credentialresolver, uttryckliga `partner`-klass och
  separata partner-session med färsk identitets-, roll-, auth-epoch- och
  medlemskapskontroll. Inga automatiska reader/staff-uppgraderingar. Nivå 1
  administrerar operatörer och personal; nivå 2 delegerar endast tillåtna roller
  inom sin organisation. Isolerade tester ska bevisa aktivering, login, spärr,
  återkallelse och nekade direkta anrop mellan två organisationer.
  Migration `005-operators.sql` (7 oktober) lägger till `operators`,
  `operator_roles`, `operator_memberships` och `operator_packages` i Studio-schemat.
  Ändra inte den checksumfrysta `product-schema.sql` eller tidigare migrationsledger.
  Historiskt, vid 005-leveransen 7 oktober, krävde native runtime kedjan 001–005;
  saknad 005 gav `unavailable`. Aktuella versionskrav följer
  `ops/neon-studio/migrations.mjs`; äldre exakta kedjor här är daterade kvitton.
  Obligatoriska migrationer appliceras före deploy; det uttryckliga undantaget
  för deploy-valfria versioner beskrivs nedan.
  Ordning vid ny Studio-migration:
  1. PR mot main.
  2. CI kör readiness mot produktionsledgern och blir röd om migrationen saknas.
  3. Operatör kör `node tools/check-migration-readiness.mjs --apply` med CROUPIER_MIGRATION_CONFIRM=apply-pending från en terminal med produktionsnyckeln.
  4. Merga PR, Vercel bygger.
  7 oktober 2026 pushades migration 005 till main innan den körts mot produktions-Neon; Vercel byggde inom tre minuter och varje /control-sida svarade att labbet inte kunde läsas.
  **Fastställd ordning för deploy-valfria migrationer (beslut 12 oktober 2026).**
  En migration som bara en ny, isolerad funktion behöver (först ut: `008-dealer-forge.sql`,
  `forge_dealers` + `forge_jobs`) märks `deploymentOptional` i `ops/neon-studio/migrations.mjs`
  och levereras i tre steg, i denna ordning och aldrig omvänt:
  1. **Kod först.** PR:en gör båda runtime-kontrollerna (Lab `studio-native-runtime.mjs`,
     Render `web/storage/studio-runtime.mjs`) toleranta för ledgern **med och utan** den nya
     versionen. Readiness listar versionen under `optionalPending`, inte `pending`, så CI är
     grön och mergen deployas. Funktionen svarar `forge_migration_pending` tills tabellerna finns.
  2. **Migration efter deploy.** När Vercel och Render kör den toleranta koden kör operatören
     `node tools/check-migration-readiness.mjs --apply` med
     `CROUPIER_MIGRATION_CONFIRM=apply-pending`; `--apply` tar även valfria versioner och
     `optionalPending` blir `[]`. Funktionen aktiveras utan ny deploy.
  3. **Lås i uppföljning.** En senare PR tar bort `deploymentOptional`, pinnar runtime till
     exakt 001–008 och återgår därmed till huvudregeln (migration före merge) för allt därefter.
  Att köra 008 mot produktion **före** steg 1 bryter den körande koden
  (`studio_migration_ambiguous_ledger`: ledgern har fler rader än koden känner). Precedens: 007
  levererades så (`508c8f33`, "Prepare optional Studio branding drafts migration").
  - [x] 008 genomförd 12 oktober 2026: steg 1 i #16, steg 2 körd ~11:08 som rollen `croupier_game`
    mot databasen `croupier_game` (`appliedNow: ["008"]`, ledger 001–008, `forge_dealers`/`forge_jobs`
    ägs av `croupier_game`), steg 3 i uppföljnings-PR:en: flaggan borttagen och Lab, Render och
    speech-importen kräver exakt 001–008. Mekanismen finns kvar för nästa isolerade funktion.
  Beständig operatörsaudit finns i `operator_audit_events` från migration 006
  och skrivs atomiskt av `web/storage/operator-store.mjs`. `operator-journal.mjs`
  är endast efterföljande diagnostik; dokument/media har separat audit.
  Delsteg 6 oktober: `web/partner-access-policy.mjs` har explicita
  operatörsrättigheter, scope-/organisationsbindning och begränsad rolltilldelning.
  Både aktuell och ny målroll måste vara uttryckligt delegerbara av nivå 1;
  egen rolländring och ändring av överordnad personal nekas. 22 riktade tester
  passerar inklusive befintlig credentialresolver/Studio-policy. Oberoende review
  är avklarad. `lab/lib/partner-data.mjs` anropar `allowsPartnerResource` för den
  scopade snapshoten. Partner-login, medlemslagring och `partner_session` finns.
  Historiskt var sista-admin-spärren från 7 oktober (`186c6bc4`) bara provad
  mot minnesfixtur. För teamflöden ersattes den gränsen av 12 oktober-kvittot
  ovan: 11 isolerade PostgreSQL-prov och 18 browserprov, inklusive spärr,
  återkallelse, bolagsgränser och samtidighet. Detta stänger inte hela T2
  eller ersätter återstående produktionsacceptans.
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
Tidigare privata arbetsanteckningar är inte del av produkt eller deployment. Git-historiken på `00ea55c5` behåller dem. Lokala ignorerade env-kopior och bildmappar står kvar utanför Git.

### Johns N2-skiss — implementationsplan, 11 oktober 2026

Denna nedbrytning hör till **T2/T3 i denna tracker**, inte till ett nytt projekt.
JN2-punkterna nedan visar respektive implementations- och acceptansgrind. Planen
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

**Historiskt underlag före PR #12.** Johns [beskrivning och skiss i inbox #9](https://github.com/Jakeminator123/scoutgaming/issues/9#issuecomment-6099185493)
pekar på Johns fristående HTML-skiss på revision `aaadfb49` (historiken behåller filen; den finns inte i det här trädet).
Skissen är fristående HTML/JS med exempeldata och simulerade anrop, inte en
färdig backend. Den historiska kodinventeringen före PR #12 nedan utgår från main
`9d151fa6be364f4af5999c8163a6055dd8fc5fc8`. Webbläsarobservationerna gjordes
11 oktober på www; deras exakta deployment-SHA är inte fastställd av denna kontroll.
Tabellens luckor beskriver det äldre läget; aktuell audit och utkasthantering
redovisas i JN2-C/D:s daterade genomförandekvitton, inte som fortsatt saknad kod.

| Del | Finns och ska återanvändas | Lucka som faktiskt återstår |
| --- | --- | --- |
| Bolag och åtkomst | Studio `005-operators.sql`: bolag, roller, medlemskap och revisionerade paket; partnerlogin/aktivering; N1 Bolag & team | Adminens N2-ingång väljer fixture utan `partner_session`. Gemensam bolagsingång och separata säkra admin-/partnerkontexter behövs. |
| N2-gränssnitt | Kevins importerade komponenter; riktiga paket-/teamvyer och appearance-loader | Johns navigation, utseende och arbetsflöden är inte genomgående integrerade. Startsidan refererar CSS-klasser som saknas. |
| Anpassning/publicering | `partner-branding-api.mjs` validerar tillåtna ändringar, rättigheter och förväntad revision; N1 äger fryst presentation/rum | Dagens sparning publicerar paketrevision. Johns separat sparade utkast, återställning och granskningsflöde saknas som sammanhängande kontrakt. |
| Speldata | Render/spel-Neon har spelare, transaktioner, partnerrundor och API-nycklar | N2-snapshot markerar players/transactions/reports som ej anslutna. Entydigt bolagsägarskap, läs-API och avstämning krävs före N2.4. |
| Revision/audit | Pakethistorik och befintlig loggning | `operator-journal.mjs` skriver serverlogg, inte en beständig operatörsjournal som går att läsa och exportera. |

**Historisk observation 11 oktober före PR #12.** Inloggad intern admin såg på
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
  **Backend, implementerad grund:** N1:s färska adminauktorisering och operatörslager
  återanvänds i `lab/components/workspace-surface-page.tsx`/`partner-data.mjs`,
  med explicit intern operatörskontext och gemensam snapshotbyggare. Behåll
  partnerpolicyn intakt och verifiera hela acceptansmatrisen nedan. Både initial sida,
  omladdning och varje N2-API måste kontrollera identitet, miljö/workspace, valt
  operatorId och rättighet på nytt. Adminskrivningar ska gå genom samma
  resursvalidering/CAS, med verklig admin som aktör; ingen falsk `partner_session`,
  medlemskap eller generell proxy till oskopade admin-API:er. Bestäm explicit
  läge när båda sessionerna finns. Utgången/återkallad session ger login/nekande,
  aldrig automatisk övergång till demo eller högre rättighet.
  **Databas:** återanvänd operators/roles/memberships/packages från 005; ingen
  kontomigrering eller bolagsseed behövs för katalogen. Slug är URL, operatorId
  är ägarskap. Beständig audit för skrivningar finns enligt JN2-C:s kvitto.
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
  Partneringången använder egen `partner-workspace.module.css` samt språk-/
  temapreferenser. Den gamla kopplingen till saknade N1-klasser är borttagen.
  Återstående arbete gäller genomgående visuell acceptans enligt punkterna
  nedan. Filter visas bara där datakontraktet stöder dem.
  **Backend:** återanvänd snapshot/capabilities från A; exponera unavailable,
  tomt och fel som skilda tillstånd. Inga nya business-API:er för enbart layout.
  **Databas:** inga nya tabeller för UI-skalet; använd befintlig profil för
  språkpreferens där den gäller, lagra inte affärsutkast som endast localStorage.
  **Beroenden:** A:s mode-/bolagskontrakt; kan utformas samtidigt med A.
  **Verifiering:** jämför startsida, översikt, bord, branding och team med Johns
  skiss i 360/820/1440 CSS-pixlar, ljust/mörkt, EN/SV. Kontrollera tangentbord,
  synlig fokus, dialogens fokus/återgång, etiketter, kontrast, tabellscroll och
  laddning/fel/tomläge. Exempeldata får inte se ut som verkliga pengar eller drift.


  **Historisk visuell observation 12 oktober:** appearance-formuläret på
  `/partner/johns-spelbolag/table-design` hade ljus text mot ljus bakgrund
  och paketpanelerna saknade tillräcklig inramning. Aktuell
  `john-foundation.css` binder nu Studio-token till partnerns tema, inklusive
  `--sg-text:var(--ink)`, och ger redigeringspanelen padding. Detta är kodbevis,
  inte ny full produktionsacceptans av kontrast, fokus eller samtliga vyer.
  Behåll N1:s frysta mediaurval och N2:s granskade publiceringsflöde; JN2-B:s
  visuella acceptans ersätts inte av C/D:s isolerade funktionstester.
#### Säker konfiguration och publicering

- [x] **JN2-C — rättigheter, beständig audit och bolagsgräns (första leveransen).**
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

  **Levererat i teamsteget:** riktiga tillåtna åtgärder, rollrättigheter och delegerbarhet; atomisk beständig journal med scope/aktör/revision/request-ID; två databasers aktiveringskompensation och isolerad Postgres/browseracceptans. Johns rollnamn mappas mot befintliga förmågor: Owner behöver administratörsrätten `team.roles.assign` och uttryckliga övriga teamgrants; Pit boss använder `tables.read/configure`; Finance använder `reports.read`; Branding använder `presentations.read/configure`; Read-only får bara relevanta läsrättigheter. Befintliga anpassade roller återanvänds. N2 får bara delegera markerade roller vars samtliga rättigheter ryms i aktörens egna. Nya RG-/integrationsskrivrättigheter får inte härledas från läsrättigheter. Första leveransen har bolagets befintliga brand; flerbrands-/marknadsmodell kräver separat implementation och lämnas öppen. Ingen journalexport utlovas.

- [ ] **JN2-D — brandutkast, preview, granskat publicera/återställ.**
  **Frontend:** integrera Johns logga, filt/rail/tryck, bakgrund, chips och
  knappstilar stegvis med `partner-appearance.tsx`. Visa tydligt utkast kontra
  publicerad revision, sparstatus, ändringslista, berörda rum och versionshistorik.
  Lägg brandstandard, separat rumsöverskrivning och ”använd standard igen”. Preview
  omfattar faktisk tillgänglig speltyp, spelfas och desktop/mobil; N1:s frysta
  placering/skala är inte redigerbar. Chips/knappar får inte markeras klara innan
  samma kontrakt renderas i N3 (inklusive kvarvarande L4-arbete).
  **Backend, implementerad grund:** befintligt branding-API skiljer spara-utkast,
  granska, publicera och återställ, med rättighets-/revisionskontroll och
  validering mot det publicerade paketet. Separata logotyper, chips, knappstilar
  och full spel-/dealerpreview återstår enligt den breda avgränsningen nedan.
  Återställ skapar utkast, inte tyst liveändring. 403/409 och ändrat grundpaket
  behåller användarens utkast men blockerar felaktig publicering. Frysta
  presentationer/rum och privata mediereferenser förblir N1-ägda.
  **Databas, implementerad grund:** `operator_branding_drafts` lagrar scoped
  utkast med baspaketrevision och egen revision; `operator_packages` behåller
  publicerad historik. Brandstandard och rumsundantag använder det befintliga
  paketkontraktet. Publicering, utkastmarkör och audit skrivs atomiskt i Studio;
  spelmotorns tillämpning kvitteras separat. Framtida logotyper ska använda
  behörighetsstyrd medielagring, inte stora data-URL:er eller osanerad SVG/HTML.
  **Beroenden:** A–C, befintligt package-/roomkontrakt och N3-renderer.
  **Verifiering:** två redigerare → konflikt utan förlorat utkast; ändrade
  rättigheter/paket efter öppnad dialog → nekande. Reload behåller utkast;
  publicering syns från nästa runda, pågående runda behåller sin look.
  Brandbyte påverkar rätt rum, rumsundantag består och reset fungerar.
  Prova felaktig logo/kontrast samt alla tillgängliga dealers utan att ändra media.

  **Genomfört i utkaststeget, 12 oktober 2026:** Separata beständiga utkast med bas- och utkastrevision, granskning med ändringslista och berörda rum, uttrycklig publicering och återställning till ett nytt utkast. Brandstandard och rumsundantag använder samma publicerade paket; återgång till standard är en granskad ändring. Paket, publiceringsmarkör och beständig journal skrivs atomiskt. UI behåller egna ändringar vid 403/409, gammalt grundpaket eller försenat svar efter bolagsbyte. Förhandsvisningen använder det publicerade paketets tillåtna lager och gemensam kompositor i desktop/mobil. Publicerad revision kontrolleras före nästa runda; insatsval bevaras vid nödvändig omladdning.

  **Verifieringsgräns:** 27 isolerade native Windows/PostgreSQL-kontroller och 24 browserkontroller PASS, inklusive konkurrens, återkallade roller, rollback, omstart, SV/EN och 360/1440 px. Browserfixturen använder syntetiska bilder med verklig kompositor; verkliga dealerfilmer och samtliga spelfaser är inte accepterade av detta prov. Inkoppling och produktionskvitto redovisas i aktuell handoff. Testkostnad 0 USD inom taket 5 USD; ingen WSL.

  **Breda JN2-D lämnas öppet:** logotyper, chips och knappstilar saknar ett gemensamt kontrakt genom N2 och N3. Full förhandsvisning av spelhändelser och dealerfilm kräver separat implementation/uppspelningsacceptans. Dessa reglage utlovas inte av den levererade utkastfunktionen.

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

## Äldre arbetschecklista: Control-etappen och kvarvarande funktionskrav

Denna etapp började på `3e613186` med `/control` som personalyta. Sedan
13 oktober är målytan `/admin`; de äldre adresserna och proven nedan är
historik/kompatibilitet. Aktuell ordning finns i [C1–C9](#admin-checkpoints-c1c9).
Öppna krav på login, utkast, prestanda, mail, säkerhet och faktisk acceptans
består och kryssas inte genom ett destinationsbyte. `/studio` förblir teknisk
basePath och `/partner` N2. Äldre PASS gäller bara den provade versionen.

- [ ] **A. Avsett administratörskonto kan logga in till N1.** Historiskt Control-prov: Jakob har bekräftat att han
  skapade `john.g` i Backoffice från det inloggade kontot `Jakob`. `john.g`
  fungerar som blackjackspelare. Synlig kontometadata bekräftar aktivt
  spelarkonto, ingen synlig Studio-användare med samma namn. Spelarkonton har
  enligt nuvarande kontrakt ingen Studioåtkomst; headerns Administratör gäller
  inloggade Jakob. Kontoformulären förtydligas. Ett separat administratörskonto
  behöver invitation/aktivering via e-post; produktionsmail är punkt F.
  Klart när det avsedda administratörskontot når `/admin` och äldre direktlänk, med rätt behörighet,
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
- [ ] **C. Samlad verktygsacceptans — fortsätter i Admin C4–C5.** Historik: OpenClaw samlades på
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
Detaljer och kvittoplatser: [den enda löpande handoffen](JOHN-HANDOFF.md#2-öppna-kontroller-och-kända-fel).
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

Behåll de fem huvudfilerna direkt i docs; uppdatera dem i stället för nya
rapporter/sprintarkiv. Enligt Jakobs önskemål 13 oktober samlas AI-/OpenClaw-
guider under [docs/AI](AI/README.md). [Labbguiden](../lab/docs/README.md)
behåller produktens användarsteg. [Systemkartans läsanvisning](system-map/README.md)
beskriver det befintliga verktyget och dess varningar.
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
   Admin får spel och personalytan på `/admin`, med `/control` som kompatibilitet; superadmin är adminalias; reader/staff är game-only.
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
   Molnets Cartesia-anrop får starta efter accepterat GPU-jobb, medan workern kopplar upp; PCM lämnar
   inte spelprocessen förrän spelarbiljetten är autentiserad. Workern använder
   den publika ingressen. Reconnect återspelar inte gammal kö/startar inte nytt betalt GPU-jobb.
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
| Publik webb | Vercelteam/projekt `scoutgaming` på www.scoutgaming.tech (apex 308 till www). Nya ytor `/admin` och `/lobby`; `/control`, `/partner` och `/play` behåller sina befintliga flöden. Service web från apps/croupier-frontend; service studio är labb-appen med basePath `/studio`, inte en egen produkt. Spelmotor: Render `croupier-v2`. |
| Konton/wallet/rundor | Neon croupier_game/croupier_auth; Render äger spelauktoritet |
| Zoner | separat croupier_zones/CROUPIER_ZONES_DATABASE_URL, ingen DBfallback |
| Studio/adminpolicy/historik/mediaregister | Neon croupier_studio med scope/CAS/history/audit; Render samma policy |
| Mediefiler/färdiga talpaket | gemensam privat Blob; exakt ägarmetadata/hash i Neon |
| LiveAI/GPU/stream | Render/Director/Gateway/RunPod, Neonjournal/lease/reservation |
| Isolerad nativeQA | separat DB/scope/hostname, befintlig disk/SDK/kvitton, AI/GPU OFF |
| Lokal utveckling | ett koordinerat par, sessionsvakt/lab/data; privata utkast/cache |

SQLite-koden är kvar för lokal/isolerad kompatibilitet och bevisar inte aktiv
SQLite-produktion. `web/server.mjs` väljer backend med `CROUPIER_DATABASE`;
`ops/cloud/config.mjs` och `container-entry.mjs` stöder diskfri PostgreSQL/Neon-
policy med privat Blob och avvisar pensionerade produktdiskkataloger.
Läsande metadata 13 oktober bekräftade Vercelprojektet i teamet `scoutgaming`
och Neonprojektet `croupier-production` i organisationen Vercel `scoutgaming`.
Renderinställningar avlästes inte på nytt; dess driftbeskrivning stöds här av
aktuell kod och de daterade kvittona nedan, inte av en ny deploykontroll.

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
OPENCLAW_API_KEY/OPENCLAW_STUDIO_ADMIN_DEVICE_KEY är adminservervägen,
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

`.ignore` döljer tung spårad media och hemligheter för vanlig sökning.
`.cursorignore` behåller hemligheter och privat data. Ofarlig tung projekttext
(`media/layout.json`, `media/blob-index.json`, `media/**/source/*.json`,
`media/**/staging/*.md`) ligger i `.cursorindexingignore`: den indexeras inte,
men kan läsas uttryckligen. Reglerna ändrar inte Git, bygge eller att filerna finns.
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
Media/spelarändring kräver testerna i `.githooks/pre-commit` och provspelning
av berörda registrerade dealers, `?dealer=<name>&rehearsal=1`, två uppspelningar
i rad i den faktiska spelaren. Ny visuell approval krävs för ändrad
audio/video/hash. Här ändras inga sådana bytes.
Efter push återläs SHA/CI/Vercel/Render/GG; testpass/hash är inte synk/mobil/backup.

Systemkartans exporter är frysta till sitt käll-SHA och observationstid.
Aktuell resultatkoppling beskrivs i E. Saknat eller skippat prov är inte grönt.
Den passiva CI-reportern och dess artifacts gör inga provider-/DB-mutationer.

## Historik

Den fullständiga tidslinjen och tidigare deployments ligger i den frysta
historiklänken överst. Privata loggar och backupfiler är inte borttagna.
Den aktiva checklistan ovan är statuskällan.
