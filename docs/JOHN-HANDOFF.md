# Aktuell handoff — Scoutgaming

## Aktiv leveransström — Admin-förenkling, 15 oktober 2026

Den aktuella genomförandeplanen finns överst i
[CLOUD-MIGRATION.md](CLOUD-MIGRATION.md). Jakob har gett genomförandemandat
för små verifierade leveranser till befintlig Admin. En arbetskopia och en
leveransström; inga nya underagenter eller testmiljöer.

Första delen är levererad i PR166: sammanhållna materialkort med verkliga
förhandsvisningar, format, felstatus och samma skyddade papperskorg.
Main c6496965b787215dc98b20e7fbaf03d8348b5bbe verifierades på www.scoutgaming.tech
(Vercel dpl_8W2dy8CRiPcUuY7LqtwGFxVpajep, READY). Sluthead e521b855 är
granskat; PR- och main-CI är gröna inklusive SQL/omstart/HTTPS. Fullhook:
3 911 pass, 9 villkorade skip, 0 fel; Lab-build 97 byggspår.
Egen browserkontroll verifierar 5 blackjackbord, 1 roulettebord, 8 pausade
MP4-förhandsvisningar, 3 PNG-bilder, explicit uppspelning till slut och
länken till rätt rumsöversikt. Inga produktionsdata ändrades. Dubbel
hanteringslista är borttagen; inga filer/beroenden/media har raderats här.
Exakta kvitton och bildreferenser finns i CLOUD-MIGRATION.

Förutsättningen för nästa del är levererad i PR167: Partner-sidans verifierade
403-fel är borta. Granskat head cc81a8a3 har grön PR-CI inklusive SQL/omstart/
HTTPS och fullhook 3 914 pass / 9 skip / 0 fel. Main 2396f46f verifierades på
www.scoutgaming.tech (Vercel dpl_8s8ayY5PFgDBG4kqa1y8viNGHkac, READY).
Eget browserprov laddar exakt demorum, paketversion 1 och fryst förhandsvisning
med befintlig N1-session. Inga produktionsdata ändrades. Main-CI 38752198462
är grön, inklusive faktiskt SQL-/omstarts-/HTTPS-prov.

Del 2:s huvudflöde är levererat i PR168, granskat head 1fa9ab6d,
main 178df3751bd1b76ff541bf631a17282883230d6d. Vercel
`dpl_W7toJ1z7b2EzoktaSBvs56Xwi3vU` är READY på rätt SHA och www-domän.
PR-CI 38758468210 och main-CI 38759583300 är gröna inklusive verkligt
SQL-/omstarts-/HTTPS-prov. Lokalt: 55 fokuserade prov, Lab-build 97,
fullhook 3 924 pass / 9 villkorade skip / 0 fel i 77 grupper; doc-hook 43/43.

Browserprovet visar båda spelens verkliga lager och låsning, fungerande
bolagsbyte/direkt rumslänk samt rätt delad mall och konsekvensbesked.
Roulette: version 1, inget utkast. Blackjack: version 4, befintligt utkast 2
orört. Inga produktionsskrivningar/providerjobb. Färgverktyget gav inget
verkligt osparat tillstånd, så dirty-skyddets browserprov räknas inte som
accepterat; lokal verifiering använder riktig delad historik. Fullt kvitto
och före/efter-bilder finns i CLOUD-MIGRATION.

Del 3 är lokalt implementerad och inväntar leveranskontroller: tydlig
situation/tagning/sparad körregel, sann vald-filmstatus och exakt regelval
i befintlig policyeditor. Intervall, frekvens och villkor är verkliga sparade
värden; OpenClaw-etikett likställs inte med verifierad anslutning.
Publicerat paket är skilt från projektutkastet. Två mall-/rumsreturer går
nu till Admin och Rum / bakgrund är ersatt av Rum. 54 riktade prov och
20 navigerings-/mallprov och Lab-build 97 passerar. Kodhead 4b1adb5b har
fullhook 3 931 pass / 9 skip / 0 fel/cancel i 77 grupper, inklusive riktig
browser för loginretur och osparat/conflict/CAS. Sluthead/CI och
produktion/browseracceptans återstår.
Ingen ny writer, runtime, mediekatalog eller tracker.

PR165 är bevarad och uttryckligen parkerad eftersom materialflödet inte
kräver N1-till-spelarkonto-övergången. QA ska inte byggas ut; en kontrollerad
återgång bereds separat med unika staged filer/stash/kvitton bevarade.
Ny rörlig läppsynk förblir avstängd. Env-granskning ska mynna ut i en
konsumentstyrd behåll/flytta/ta-bort-lista, inte fler profiler eller synkning
av produktionshemligheter. De tidigare dokumentutkasten nedan är bevarade;
deras formuleringar om väntande samordnarkvitton är daterad historik.

## Förberedelse för slutöverlämning, 15 oktober 2026

Förberedelsebas: main `96750fa0`, med PR162–164. PR164:s head
`2a8295a4` har lokalt bygg-/fullhookkvitto nedan; samordnarens slutliga
SSO-, main-, drift- och browserresultat väntar. Ingen ny acceptans påstås.

KEVI:s env-städning bevarar effektiv konfiguration i åtta profiler efter att
tre redundanta LAB_PARTNER-namn tagits bort per root-/Lab-fil; 16 riktade
prov passerar enligt kodägarens kvitto. Aktuella antal är root 53, Lab 48 och
115 samlade namn. Tidigare 118-namnskvitto är daterad historik; detaljer finns
i ENVIRONMENT-VARIABLES.md. Emil-, cloud-storage- och molnkonfiguration består.

Samordnaren bekräftar managed-arkivering av `partner-write-acceptance` och
`public-lobby` efter hashbackup/junctionkontroll. `pr91-integration` och
denna dokumentationskopia behålls. Ny bankkontroll identifierar inte den
förväntade avatarbanken; den rörliga läppsynken är fortsatt avstängd och
inte accepterad. De 18 CSS-varningarna och konkret fokusregelkonflikt kräver
ett avgränsat visuellt tangentbordsprov. Versions-/bankreferenser och aktuella
bevisgränser finns i CLOUD-MIGRATION.md; äldre kvitton ligger kvar nedan.

## Publik Lobby-ingång och profil, 15 oktober 2026

Startsidan leder nu till `/lobby`; Lobby har en synlig Min profil-länk till
befintlig serverautentiserad profil och vidare till Spelhistorik. Profilens
retur går till Lobby utan nya returparametrar eller ändrad sessionsauth.
Dealer-dialogens Escape/Stäng återför fokus till rätt dealerknapp.
43 riktade prov passerar utan skip, inklusive riktig isolerad Chrome med
syntetisk katalog, tabbning, fokusretur efter stänganimation och oförändrad
spellänk. Frontendens och Lobbyns typkontroller samt Lab-build med 97 byggspår
passerar. Ordinarie fullhook med Chrome passerar: 3 885 godkända, 9 villkorade
skip, 0 fel/cancel i 77 grupper. Levererad liveacceptans väntar. Inget spel eller media
ändras och C4:s fulla destinations-/rollmatris bockas inte av. Ignoretexterna
är förtydligade för Cursor/Instant Grep; alla globregler och arkivförbud består.

Efter normal integration av main `a0eca7a8` byggdes Lab om eftersom PR161
ändrade dess serverkod: 97 byggspår passerar. Integrationsfullhook med Chrome:
3 902 godkända, 9 villkorade skip, 0 fel/cancel i 77 grupper. De tidigare
fokus-/fullhookkvittona ovan gäller före integrationen; liveacceptans väntar.

## C4: transport före middleware, 15 oktober 2026

Samordnarens Chrome-prov 11:17:32.829 UTC visar fortsatt dokument-500 på
PR161/main `a0eca7a8`, deployment `dpl_5kSZWix64EYCYZDic8BmLPe354wC`.
Den driftsatta loggen för `/control/replies` har redan vid middleware
`mode=cors`, `destination=document`, cross-site, utan Origin/Next-action.
PR161:s prov täckte transport efter middleware; detta bevisar luckan.

Den smala fortsättningen accepterar just denna form för redan kända GET-dokument
utan body/Origin/action. API, assets, okända vägar, POST/HEAD och iframe förblir
spärrade; befintlig session, roll och explicit Origin kontrolleras fortfarande.
Två positiva regressioner är reproducerade röda → gröna. HTTP-provet går genom
verklig middleware och Admin-route med fetch före respektive efter middleware,
syntetisk adminsession och anonym loginredirect. Negativa prov passerade också
före fixen. Tre fokusfiler: 61 pass, 0 skip, 0 fel med Node 24.21.0.
Main `1c9e1c6a` är integrerad med båda äldre handoff-avsnitten bevarade.
Sammansatt Lab-build, inklusive uppdaterad Lobby, passerar med 97 byggspår.
Kodcommit `6c6db03b` passerar ordinarie fullhook med Chrome: 3 906 pass,
9 villkorade skip, 0 fel/cancel i 77 grupper.
PR164 är mergad som `96750fa0`. Samordnarens slutliga drift- och
browseracceptans inväntas; C4 är fortsatt öppen.

## Historik — PR161: direktöppning av Admin, 15 oktober 2026

Samordnaren reproducerade Chromes dokumentnavigation-500 på `d6d56803` för
`/admin` och `/admin/dealers`, medan session, katalog och vanlig fetch fungerade.
Kända Admin-dokument normaliseras nu i middleware före transporten; samma
befintliga origin-, sessions- och rollkontroller används. API, iframe,
Next-actions och mutationer omfattas inte av dokumentundantaget.
Två regressioner var röda före rättningen; slutligt fokusurval gav 59/59 utan skip.
Före main-integrationen gav fullhook med Chrome 3 883 pass, 9 skip och 0 fel.
Efter normal integration av `c024cca7` gav den 3 899 pass, 9 villkorade skip
och 0 fel/cancel i 77 grupper. Lab-bygget återanvänds; dess källor är oförändrade.
Första fullhook stoppade på en inaktuell middleware-förväntning; efter rättningen
passerade slutkörningen. Skip gäller fem databasprov och fyra Linux-specifika prov.
Det verkliga lokala HTTP-fetch-provet visar navigate → cors och går genom
Admin-routen med syntetisk session och temporär HTML. Det bevisar inte Vercels
interna transport eller driftsatt rättning. Oberoende kodgranskning fann inga
blockerande fel. Lab-bygget passerar med 97 kontrollerade byggspår. Ett separat
IAB-prov av samordnaren verifierar ny internal-admin-login och N1 → Partner →
Lobby på samma main; det är inte N2/N3-rollbevis eller acceptans av rättningen.
Produktionsverifiering av rättningen återstår; C4 hålls öppen.

## Paow/Dragge: separat workertransport, 15 oktober 2026

PR160:s två P2 från SAMORDNING är reproducerade och rättade: normal
WebSocket-close 1000 dränerar redan mottagna svar i stället för att kasta
kön; första prepare-admissionen omfattas av avbrott och tidsgränser innan
någon callbackadress lämnas ut. Nekad/fastnad prepare rensar PCM och
finaliserar den fångade reservationen en gång med `owner=null`; sent svar
återstartar inget. Fyra regressioner var röda före rättningen; ett femte
startfelprov täcker ogiltig release/origin utan reservation-/PCM-läcka.
Kodcommit `34f5637e`: ny full pre-commit ger 3 898 pass, 9 villkorade skip,
0 fel/cancel i 77 grupper. Alla 36 plan-/PCM-/bildrute-/transportprov passerar,
inklusive 16 transportprov och Chrome-avkodningen. Lab-kod/beroenden är
oförändrade; dess byggkvitto med 97 spår återanvänds. Tidigare kodkvitto
nedan är historik. Inga env-/pod-/driftändringar ingår i rättningen.

Ny opt-in adapter parar autentiserad workers `lapp`-metadata med H.264-byte
för vår befintliga bildrutekonsument. Den använder vår PCM-/planidentitet,
engångstoken, upprepade ägar-/profilkontroller, accepterat jobb-ID och
explicit versionsgrind. Avbrott skickar `avbryt`; bounded köer/tider och
callback för vår budgetjournal avgränsar försöket. Ingen produktionsroute,
dealerchatt, env, mediefil, providerinställning eller GPU-körning aktiveras.

Kodcommit `f260b29e`: full pre-commit ger 3 893 pass, 9 villkorade skip,
0 fel/cancel i 77 grupper. Lab-build passerar med 97 kontrollerade byggspår.
Alla 31 riktade plan-/PCM-/bildrute-/transportprov passerar, inklusive
Chrome-provet med två syntetiska H.264-avkodningar. De två lokala
socketförsöken för Paow/Dragan använder syntetisk worker och avkodning;
de ersätter inte riktiga talprov. Integrationskontrakt och kvarvarande arbete finns i
LOCAL-PRESENTATION-RUNTIME.md, under isolerad workertransport.

Färsk läsning av RunPods metadata visar fem idle-workers, endpointversion
13, image `6c80fe50806979d902a6457f43ec74ca8ee5d421`. Emils överlämning anger
`fe1b55e971b1236fadd445ff6ce94970719b5d72`. Read-only podlista bekräftar
den nyare imagen för både `croupier-lipsync-pod1` och `croupier-lipsync-pod5`
med `desiredStatus=RUNNING`. Skillnaden förklaras av serverless kontra
dedikerade demopoddar; metadata är inte attestering av körande image/avatarbyte.
Vår nya versionsgrind gäller serverless-admission. Inga ändringar görs i hans
poddar. Äldre Kevin-bilaga används endast för protokoll-/ansvarsgränsen;
dess nycklar, mediaråd och gamla driftuppgifter importeras inte.
SAMORDNING har fått avgränsningen; Vercel/Blob/Neon och Admin-migrationen
behåller sin befintliga auktoritet. Nästa steg är verifierad release/bank,
gemensam upgrade-dispatcher, journal-/spelarsessionskoppling och faktisk
spelplan/ljudklocka, följt av två riktiga talprov med planbyte/avbrott.

GitGuardian vid leverans: inga öppna incidenter i den lästa repokällan,
18 ignorerade. Övervakning aktiv; historisk scan `too_large` och delar av
locations saknar läsbar metadata. Väntande GitHub-suite är inte fullständig
säkerhetsacceptans. Inga incidentstatusar eller rättigheter har ändrats.

## N2-utkast och publicering, 15 oktober 2026

Utökat befintligt C5/C6-prov: verkliga UI-skrivningar, reload, granskat utkast,
exakt +1 publiceringsrevision och rätt rumsvärde via anonym Lobby/spelstart.
Korsbolags-POST nekas med 403 och orörda data. Kodagentens riktiga Chrome-prov
passerar 2/2 utan skip. Sessioner/minneslager är syntetiska; ingen ny login,
produktionslagring, PostgreSQL-radlås, medie- eller spelacceptans tillskrivs detta.
Fullt avgränsat kvitto och återstående C4–C7 finns i CLOUD-MIGRATION.md.

## Spelarretur till Lobby och direkta Admin-alias, 15 oktober 2026

Spelarens återlänk går nu till `/lobby` med servervaliderat bolag och verkligt
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
kontrollerade byggspår. PR157 är mergad och verifierad på main `1f65b48f`: åtta direkta Admin-alias, rätt Dragan-retur och stängd provsession. PR-/main-CI, Vercel, Render och faktisk engine-version är verifierade; driftkvitto finns i CLOUD-MIGRATION.md. Egna junctions är borttagna, privat sessionsfil bevarad och apparkiveringen köad.

## PR91 integrerad mot aktuell main, 15 oktober 2026

main `654ab9e2` har integrerats i grenen.
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

## Fria mobilkontroller på spelborden, 15 oktober 2026

Produktionsprovet med Dragan visade att Adminrobotens flytande knapp skymde
delar av DEAL NOW och nedersta kontrollerna vid 390×844. Blackjack- och
roulettemallarna markerar nu att de inte ska installera den globala assistenten.
Samma mall täcker Studio-preview och äldre speladresser. Widgeten avslutar
före DOM/API/init; Admin, Partner, Lobby och spelets ingång behåller den.
Inga rollkontroller, spelregler, dealerchatt eller mediebytes ändras.

Oberoende statisk granskning fann inga konkreta regressionsfel. Kodagentens
58 riktade prov passerar utan skip: widgetbeteende, oförändrad N1-start på
omarkerade ytor, befintliga publika assistent-/entréprov och riktig spelmall
genom Studio-preview-handlern. Det är inte ny full roll- eller medieacceptans.
Samordnarens Lab-build passerade med 97 kontrollerade byggspår. Kodcommit
`82986fdd9c8156e818f2bd949b1613bcc353e769` passerade ordinarie fullhook:
3 854 pass, 9 villkorade skip, 0 fel/cancel i 77 grupper, med riktiga isolerade
Chrome-prov. Levererat mobilprov på main `654ab9e2` är klart: 390×844, ingen assistent-DOM,
ingen sidöverströmning och aktiverad DEAL NOW överst i klickträffen. En syntetisk
€5-insats användes för att aktivera knappen; ingen ny runda startades. Separata
provsessionen stängdes via återlänk och gav sedan `studio_preview_not_found`.
PR156:s main-CI `38700979846` success, Vercel `dpl_DsNKZRuJxftpsfpsvrCCvEmpoxhc`
READY och Render `dep-db88cebm8hqs73btc990` live är verifierade; faktisk
engine health/version gav ok/samma SHA. Lokal main synkades med 225 befintliga
filhashar bevarade. Egna arbetskopian `player-controls` är app-arkiverad.

## Förberedd konsument för rörlig läppsynk, 15 oktober 2026

Egen featurebranch bygger vidare på `654ab9e2`. WebCodecs-konsumenten för
Emils råa H.264 färg/mask är kopplad till den gemensamma kompositionens
dealerbild före framing/keying. Exakt plan-, dealer-, ljud-, avatar-,
källhash- och bildrutematchning krävs. Avbrott stänger dekodern, frigör rutor
och återställer den kvarhållna kroppen. Ingen ny överlagring över bord/kort.

Det är en explicit kopplingspunkt, inte aktiverad dealerchatt eller byte av
provider. Kodcommit `82e84e0984920112f9770798796f06cd5ab11cfa` passerade
Lab-build (97 byggspår) och ordinarie fullhook: 3 862 pass, 9 villkorade skip,
0 fel/cancel i 77 grupper, inklusive två Chrome-avkodningar med syntetiskt
material. Personernas tal/läppsynk har inte fått ny acceptans.
Detaljer och återstående transport-/spelararbete finns i
[LOCAL-PRESENTATION-RUNTIME.md](LOCAL-PRESENTATION-RUNTIME.md).
Worker-repot/avatarpaketen är ännu otillgängliga för Jakobs konto. Emils
senaste handoff anger två dedikerade demopoddar som inte får ändras eller
få nya anslutna workers. Ingen env eller extern inställning ändrades.

## Env och Dragan i produktionsvärdens isolerade provspel, 15 oktober 2026

Verifierad produktbas är `46444572` (PR154): main-CI `38662964323` success,
Vercel `dpl_6nrpTJ2DKE1cJuEW5rn87H51wwiC` READY och Render
`dep-db82c560tbcc73e3ipk0` live; engine health/version svarade ok/samma SHA
01:05 UTC. Äldre leveranskvitton nedan gäller sina angivna versioner.

Samordnaren körde Dragan via Admins befintliga Provspela på
`www.scoutgaming.tech`, med separat SQLite `:memory:` och syntetiskt saldo.
Två sammanhängande rundor slutfördes: desktop €5 → förlust €5; därefter
390×844 mobil €5 → återbetalt €10. Testsaldo gick 10 000 → 9 995 → 10 000.
Lounge · varm, Dragan och Blackjack · Oak visades; serverkort och avslut
fungerade, ingen sidöverströmning vid 390 px och inga insamlade JS-varningar/fel.
Återlänken stängde sessionen; omläsning gav `studio_preview_not_found`.
Ingen verklig spelarbalans, publicering eller providerjobb ändrades.
Detta gäller sparad sammansättning på main, inte PR91 eller publicerade
rummets fulla tillåtelselista. Separat read-only N2-prov laddade paket v4:s
tre lager och spelade två gånger på desktop och mobil. Tal/läppsynk är inte godkänt.

Env-kvittot finns i [ENVIRONMENT-VARIABLES.md](ENVIRONMENT-VARIABLES.md).
Endast en felaktig lokal env-rad togs bort med alla 50 giltiga värden bevarade;
privat originalbackup har samma effektiva åtkomstskydd. Scoutgamings RunPod-par
matchar lokalt/Render och skiljer sig från Emils; Vercel Preview pekar fortfarande mot
produktionsbackend och är ingen isolerad skrivmiljö. Ingen Emil-inställning ändrades.
Lokala filmer är verifierat tillgängliga. Senaste Kevin-protokollets konkreta
skillnader och den ännu oanslutna rörliga talvägen finns i
[LOCAL-PRESENTATION-RUNTIME.md](LOCAL-PRESENTATION-RUNTIME.md).
Privata skärmbilder och redigerade driftkvitton ligger under
`arkiv/2026-10-15/samordning/env-media-verification/`.

## Verklig N2-kedja och enklare kontomeny, 15 oktober 2026

Den befintliga C6-fixturen går nu via verklig PartnerOperatorWorkspace och
branding innan anonym Lobby. Samma revision/rum, meny/reload/historik,
bolagsstandard, partner/staff-skillnad och främmande bolag 403 verifieras.
Lokal Chrome: 2 pass/0 skip. Testcommit `dc7923b3`: fullhook 3 852 pass,
9 skip, 0 fel i 77 grupper. Syntetiska sessioner/minnesdata; ingen ny login,
N2-skrivning, full RSC-, produktions- eller spel-/medieacceptans tillskrivs provet.

Läsande produktionsnavigation på `37b9d6fd` fann dubbla ingångar till samma
kontovy och en loggsida utan klickbar journalväg. Desktop/mobil har nu en
kontomenyingång, spelaraliaset behåller routing/aktivt val/brödsmula och
loggsidan länkar till Bolag & team. 25 befintliga fokusprov passerar.
Oberoende granskning omfattar testfixturen och den slutliga mobilrättningen.
Slutlig UI-kodcommit `99882451cd4e8e39ee9c64c06bd3815f4afb6cac`: Lab-build 97 kontrollerade byggspår och fullhook med riktig Chrome 3 852 pass/9 skip/0 fel i 77 grupper. Den tidigare avbrutna körningen räknas inte som godkänd.

Senast slutkontrollerad produktionsbas är `37b9d6fd`: main-CI 38658966013
success, Vercel `dpl_7rfHiUWpznv8YQfqJUgKtm6B7v53` READY och Render
`dep-db81p9c9v7es73bepus0` live; faktisk engine health/version gav ok och samma
SHA den 15 oktober 00:24 UTC. Egna `admin-room-context` är bekräftat
app-arkiverad med fem egna dependency-länkar borttagna och målen bevarade.
Tidigare versionsbundna kvitton nedan är historik. PR91:s privata kodexport
väntar fortsatt på mänskligt godkännande; ingen sandbox körs.

## Rumskontext och fokus — levererad navigation verifierad, 15 oktober 2026

PR152 är mergad från head `0bea32e23626d64fb754b39ac7a55d44966ca816`;
huvudkopian synkades till `3da92370` med sex ursprungsfiler bytebevarade. Samordnaren
verifierar obligatorisk PR-CI inklusive isolerad SQL/restart/HTTPS och lyckad
main-CI `38657563321`; dokumentationsjobbet var scope-skipped. Rotens Lab-build
gav exit 0/97 byggspår. Vercel `dpl_JDtveT5CwKFDUTLPnov2HTUZ6yUG` är
production READY på samma main med www/apexalias. Render
`dep-db81iilg1s2s73f4d3ng` är live på samma SHA; engine health/version
svarade 200/ok och `3da92370` den 15 oktober 00:10 UTC. Egen
`admin-continuity` är nu bekräftat app-arkiverad efter trädekvivalens och
borttagning av tre egna dependency-junctions med målen bevarade. Tidigare kvitton nedan behåller sin egen version.

Lokala underagentkvitton för implementerad och granskad rumskontext
(provurvalen överlappar och summeras inte):

- Verifierat publicerat rum styr startkomposition; främmande/inaktuellt rum
  varnas och spärrar portallänkar utan att tyst länka annat rum. Befintlig
  redigeringskomposition kan bestå. Omvalidering bevarar utkast: tre regressioner
  röda före P2-fixen, gröna efter. Provider/ControlLanes och verkliga WorkspaceTool
  fick sina inaktuella länkar rättade; 51/51 riktade prov passerade.
- Aktuellt rum följer partnerns meny, loginretur, reload/historik och staff-lobbylänk.
  Explicit bolagsstandard är `scope=company` utan `room`, utan rolländring.
  Oberoende auth-/servergranskning fann inga åtgärdskrävande fel. Bakåt till
  ogiltigt rum reproducerade utkastförlust i verklig PartnerAppearance; rättningen
  gav 48/48 panel-/rumsprov och därefter 12/12 fokuserade accept/avbryt-prov.
  Giltiga rumsbyten behåller panel/utkast utan prompt.
- Lobby behåller operator/room i URL/historik; runtime-exporten
  `lobbyQuerySelection` är återställd. C6:s isolerade Chrome-prov passerade 1/1.
- Dealerformulärets Avbryt återför fokus till Skapa dealer; enhetsprov 8/8.
  Samordnaren har nu verifierat fokus på knappen Skapa dealer efter Avbryt
  i tomt formulär på levererad `3da92370`; tidigare BODY-fel är därmed återprovat.

Samordnarens slutliga Lab-build passerade med 97 kontrollerade byggspår;
kodcommit `e92b82b94bb16865b801b90f32af6582fc6119ae` passerade fullhook med
riktig Chrome: 3 852 pass, 9 skip, 0 fail/cancel i 77 grupper. Fem databasprov
saknade isolerad testdatabas; fyra Linux-prov är inte tillämpliga på Windows.
Alla aktiverade browserprov kördes. Loginens fixtureberoende och historikens
Chrome-val är rättade; saknade arbetskopieberoenden återanvänds först efter
låsfilsjämförelse. PR-/main-CI och merge är nu klara enligt kvittot ovan.

Samordnarens läsande produktionsprov på Vercel `3da92370` med befintlig
staffsession följer Swedish Games Dragan v4 från Admin till Partner och Lobby
med samma faktiska rum. Admin korrigerar saknad/inaktuell sammansättning och
Klippkartalänken får rätt kontext. Partnerns meny/reload/Bakåt/Framåt bevarar
rum respektive explicit bolagsstandard. Lobby behåller bolag/rum i historiken,
väljer ingen dealer automatiskt efter reload och ger rätt blackjacklänk när
Dragan väljs; Spela klickades inte. Ogiltigt Admin-/Lobbyrum samt blandat
partner-room/company-scope spärrar berörda portal-/spelstarter. Exakta länkar
och negativa prov finns i CLOUD-MIGRATION. Inga produktionsskrivningar eller
spelrundor gjordes; detta är tillskrivet provbevis, inte nya prov här.
Ny produktionslogin, skrivacceptans, faktisk 200-procentszoom
och godkännande för PR91:s export av privat spelarkod är kvarstående gränser; ingen hel C4/C7 bockas av.
Aktuell uppföljning finns i [CLOUD-MIGRATION](CLOUD-MIGRATION.md); ingen ny tracker.

## Aktiv partnerportal utan klientdemo, 15 oktober 2026

Den gemensamma N1/N2-sidladdaren finns nu i
`lab/components/workspace-surface-page.tsx`. Control och Partner använder
samma behörighetskontroller och returkontrakt utan import från en annan
sidas katalog. Den verkliga klienten heter `PartnerOperatorWorkspace`.
Den onåbara klientdemon, dess originalvyer/CSS (383 127 byte) och dess
generator/factory är borttagna efter konsumentkontroll. Aktiva partnervyer,
API-fixtures, material, provenance, sparade alias och publiceringshistorik
är bevarade. `.kevin-bo` är fortfarande en aktiv CSS-avgränsning.

Testerna kontrollerar den verkligt renderade partnermenyn, rollgränser,
utkastens livslängd och bolagsbundna publiceringskvitton. En historisk exakt
destinationslista används inte längre som krav på dagens meny. Riktat:
153 pass, 1 villkorat browserprov skip; sista menyjusteringen 11/11 pass.
Lab-bygget verifierar 97 spår. Oberoende granskning fann inga konkreta
regressioner. Det befintliga isolerade Chrome-provet för partnerlogin med
bolag/rum och ändamålsbunden cookie passerade också (1/1, ingen skip).
Kodcommit `3c93a3ab` passerade ordinarie fullhook: 3 792 pass, 21 villkorade
skip, 0 fel/cancel i 77 grupper. Första försöket stoppades av tillfällig
Windows-EPERM i agent-talks isolerade låsprov; det exakta provet och därefter
hela fullhooken passerade utan testundantag. PR151 är mergad som `3bad2fd4`
med alla obligatoriska CI-kontroller gröna enligt samordnarens leveranskvitto;
dokumentationsjobbet var avsiktligt SKIPPED för ändringens scope.
Arkivets befintliga lokala undantag i
`.ignore` och `.cursorignore` versionsstyrs så att samma skydd finns i nya
arbetskopior; Git ignorerade redan det privata arkivinnehållet.

Samordnarens läsande browserprov på levererad `9b6f4d11` använder befintlig
staffsession: Admin → Swedish Games partnerportal visar paketversion 4 och
Dragan-rummets tre lager. Lobbyn erbjuder rätt rum/dealer och bygger rätt
`/play/blackjack`-länk. Ingen publicering eller spelstart gjordes. Valt bolag
och rum tappas mellan portalerna; detta rättas separat och är inte godkänd
slutacceptans. Admin-översikten på 390 × 844 px gav dokumentbredd 390 px.
Faktisk 200-procentszoom, full dialogmatris och spelaracceptans återstår.

PR150 är mergad som `8e97ee83`: fullhook 3 794 pass/21 skip/0 fel eller
cancel i 77 grupper, grön CI och Vercel-preview READY. Previewbygget
verifierade den verkliga Node 22-installationen trots frontendens Node
24-kontrakt. Lokal main är uppdaterad; samtliga sex tidigare ändrade lokala
filer har verifierats byteidentiska efter synkroniseringen.

## Byggkontrakt och systemkarta, 15 oktober 2026

Lab/design/frontend använder Node 24; taltransporten använder Node 22.
Befintliga lokala Volta-pinnar versionsstyrs nu och frontend anger 24.x.
Frontendens tre undertryckta TypeScript-fel gällde alpha-film i ett för snävt
green-screen-kontrakt. Komponenten återanvänder nu det publika kontraktet;
typkontroll är obligatorisk i fullhook/CI och Next-bygget. 3 typfel blev 0,
39 riktade prov passerade. Oberoende granskning verifierade byteidentisk
emitterad JavaScript före/efter: ingen ändring av spelarens runtimebeteende.
Beroenden och pnpm-lock är oförändrade. Vercels talinstallation använder
Node 22 för frontendens beroenden; pnpm varnar med standardpolicy, men
previewbygget måste verifiera den verkliga installationen före merge.

Systemkartan beskriver tre Vercel-tjänster i samma produkt och de separata
Render-tjänsterna. SQL-inventeringen omfattar nu elva migrationskällor,
57 tabeller och 382 kolumner, inklusive tidigare saknade 006/008/011.
Detta inventerar källkontrakt, inte det installerade produktionsschemat.
Baslinjehashar och testdefinitioner är bevarade; ändrad-indata-varningar
redovisas i kartan i stället för att nollställas.

Daterat driftkvitto 14 oktober cirka 22:25 UTC: Vercel `scoutgaming` var
READY på `a0df4e26`, deployment `dpl_7FAC4NFoEdSQCA521AQcWe1XqJme`;
Render `croupier-v2` var live på samma SHA och gav health 200.
Efter PR149 är Vercel `dpl_D2U2rpZ3WMne1jkv2dUwjUXmLK6b` READY på
`9b6f4d11`. Cookiefri kontroll på www 22:35–22:36 UTC verifierar
`/studio` → `/admin`, Admin → N1-login med rätt retur, gamla Control-länkar
→ motsvarande Admin-vyer, Partner → partnerlogin och Lobby 200. Ett gammalt
Studio-bokmärke behåller dealer-parametern genom kompatibilitetslänken.
Render hade ännu `a0df4e26` vid den avläsningen. Detta är HTTP-/driftbevis,
inte ny inloggad browser- eller spelaracceptans.

## Sammanhängande Admin-ingångar, 15 oktober 2026

Utgångspunkt är main `a0df4e26` efter PR #146–148. N1-login utan giltigt
returmål och tom `/studio` går nu till `/admin`. Uttryckliga äldre länkar
och Studio-bokmärken med query behåller sin kompatibilitet. Partnerportalens
staff-länkar går till Admin och Spelarlobby; vanliga partner får inga nya
staff-länkar. Översiktens Spelrum & publicering öppnar `/admin/publication`
med rätt verkligt rum, bolag, sammansättning och dealer.

Före/efter-prov reproducerade felaktiga mål. Det gemensamma fokuskommandot
gav 157 pass, 9 befintligt villkorade browserprov skip, 0 fel. Login-agentens
separata utökade auth/SSR/N2-prov gav 85 pass, 1 browserprov skip, 0 fel.
Kodcommit `567be8a2` passerade Lab-build (97 spår) och ordinarie fullhook:
3 794 pass, 21 villkorade skip, 0 fel/cancel i 77 grupper. Oberoende statisk
granskning fann inga konkreta regressioner. Levererad browseracceptans
återstår och bokförs separat i C1–C9.
Den delade sidladdaren har därefter flyttats ur Control, se aktuellt kvitto
ovan. `lab/lib` och verkliga partnerportalen är aktiva tjänster och bevaras.

PR #91 är fortsatt draft: Astrids isolerade spelarprov är klart; Dragan v4
inväntar tillstånd för den privata runtimekoden. Inga sandboxuppladdningar
gjordes efter säkerhetsgranskningens avslag och sandlådan är stoppad.
Rörligt tal och mänsklig medieacceptans är egna kvarvarande gränser.

## Lokala providerprofiler och läsande molnkontroll, 15 oktober 2026

Lokala startarens ElevenLabs-gap är rättat: nyckel och exakt API-origin följer
endast befintlig generatedSpeech-opt-in. Två regressioner var röda före
rättningen; 37 fokuserade prov passerar med OFF-/EMIL-/databasisolering.
Rot/Lab/Emil/cloud-storage har märkts tydligt; alla gamla giltiga värden
bevaras, och Lab får root/Render-profilens saknade ElevenLabs-nyckel.
Sju inaktiva env-exporter är återställbart arkiverade med hash-/ACL-kontroll.
Ingen molnkonfiguration, providerinställning eller Emil-pod ändrades.

Vercel-team/projekt, Render och Neon är läsverifierade. Vercels projekt-
revision matchar Neon; session/projekt/video-GET och privat MP4-HEAD ger 200.
Actions på c024cca7 använder croupier_game och har inga väntande migrationer.
Preview pekar fortsatt på produktion och kräver separat samordnad isolering.
Kevin-paketets 274 lokala filhashar är verifierade; 58 finns exakt i Blob och
Neons bibliotek (Paow11/Dragge47). Ingen massimport eller mediaacceptans.
Detaljer, återställningsvägar och nyckelfri inventering: ENVIRONMENT-VARIABLES.md.

## Driftprofiler och providerkontroll, 14 oktober 2026 kväll

Samordnat med SAMORDNING efter PR #145. Root-profilens RunPod-nyckel är
återställd till samma verifierade par som Lab/Render. Emils lokala testfil
har fem `EMIL_*`-namn och rätt lokalt endpointval; hans fjärrresurser är orörda.
Fyra oanvända testkopior är borttagna från endast Vercel scoutgaming Production;
Cartesia behålls för Studio. Alla andra Vercel-poster, Render och DB/Blob-värden
är bevarade. Original ligger kanoniskt i `arkiv/2026-10-14/`, med skyddade ACL.

`tools/check-provider-profile.mjs` är ett uttryckligt filval med enbart GET:
inga ärvda processnycklar, blandade namn, omdirigeringar, GPU-jobb eller
hemliga loggvärden. Fyra riktade regressionstester, 12 tester inklusive
env-registret, Studio-build (97 kontrollerade spår) och full pre-commit
(3 781 pass, 19 skip, 0 fail) godkända. Alla åtta lokala loaderkombinationer
har identisk effektiv konfiguration före/efter. Båda providerprofilerna gav
200; även Emils Gemini fungerar. API-tillgänglighet är inte talacceptans.

Inloggning, session, projekt och mediebibliotek lästa på Vercel; projektrevisionen
matchade produktions-Neon och autentiserat privat MP4-HEAD gav 200/rätt längd.
Efter miljöbytet redeployades exakt `fa1fdaaeaf923c0744a82953d77334779a6001e7`:
`dpl_3C8Hpice4vvqnfJmzei9KR176i9Y` är READY i rätt team/projekt med
`www.scoutgaming.tech` som alias. Samma databas-, sessions- och medieprov
godkändes efter deploymenten; webb/Admin och båda Render-hälsoproven gav 200.
SAMORDNING fick kvittot och merge-/deploypausen kunde släppas.
Se [aktuella profiler, namnmatris och återställning](ENVIRONMENT-VARIABLES.md).
Rörlig workerintegration, två faktiska talprov och Anna-avatar återstår separat.

## Lokal env-konsolidering, 14 oktober 2026

Efter ADMIN:s och DRAGAN:s klartecken flyttades den dubblerade
`lab/.env.generated-speech.local` och den oanvända
`lab/.env.cloud-activation.local` till den Git-ignorerade
`arkiv/2026-10-14/lab/` i Jakobs huvudcheckout. Den första tillfälliga
placeringen under `lab/data/platform-private/` är avvecklad.
Exakta byte och Windows-ACL är bevarade. Före/efter-konfigurationen matchar
för vardera flytten i åtta kombinationer av speech-, kamera- och lagringsflaggor.
Privata kvitton ligger under
`arkiv/2026-10-14/lab/data/platform-private/samordning-cleanup/`, utan hemliga värden.

Rotens och Labs olika `.env.local`, separat cloud-storage-opt-in, aktiva
beroendeinstallationer, `lab/.next`, produktdata och molninställningar bevaras.
Den senare providerkontrollen ovan rättade RunPod-paret; profilerna förblir
separata efter sina faktiska läsare och ska inte slås samman slentrianmässigt;
se [aktuell läsordning och inventering](ENVIRONMENT-VARIABLES.md).
Denna leverans ändrar bara dokumentation och innebär ingen ny drifts- eller
inloggningsverifiering. Spelaracceptans och övriga migreringsgrindar kvarstår.

## Rörligt tal: PCM-kontrakt och anslutning, 14 oktober

PR #128 är mergad efter gröna kontroller som `80c84709`. Fortsatt förberedelse
i `web/moving-speech-pcm.mjs` binder exakt normaliserat uppspelningsljud till
planens hash, 24 kHz-format och bildtidslinje. Engångsöverföringen har
begränsade PCM-meddelanden och lokal ogiltigförklaring vid avbrott. De 13
fokuserade plan-/PCM-proven passerar. Full pre-commit på `4102005` passerar
med 3 737 godkända, 11 överhoppade och inga fel. Studio-bygget passerar med
97 kontrollerade byggspår. Kontrollen av 410 testfiler hittar inga
föräldralösa tester och behåller två befintliga undantag. Verifieringen
använder aktuella låsta CI-beroenden.

Vi har redan egen WebSocket-ingång och Render-ägd GPU-session. Den rörliga
workern behöver en verifierad adapter till vår autentiserade callback, inte
Emils dator eller Kevins WebSocket-server. `end` i Kevins kod avslutar
ljudinmatningen, inte GPU-jobbet; `avbryt` är villkorat på flerlane-stöd.
Behåll vår sessionsbudget och verifiera faktisk RunPod-stängning.

Läsprov från uttrycklig `.env.emil` gav 200 för rörlig RunPod-health,
Paows/Dragges ElevenLabs-röster och den nytillagda Cartesia-nyckelns voices-API.
Ingen miljöfil eller produktion ändrades av proven och inga betalda jobb
beställdes. Cartesia behövs inte för dessa två ElevenLabs-röster.

Modulen är förberedelse, utan liveimport, socket, decoder eller spelstart.
Worker-release, hashbundet avatarunderlag, säkert avbrott och två verkliga
talprov per dealer återstår. Anna behöver dessutom eget kompatibelt avatar-
och röstunderlag. Detaljer finns i LOCAL-PRESENTATION-RUNTIME.md; den befintliga
påminnelsen om Emil behålls. Andra agenters Admin-/Dragan-arbete är orört.

## Kevin: demokälla och återstående synkfel, 14 oktober

Kevin bekräftar demon på croupier.scoutgg.dev och commit 315cfc55 utan
opushade ändringar. GitHub visar samma head för kevin och kevin-staging;
demons dealers.js/lip-layer.js matchar exakt. Server/worker och visuell
synk är inte verifierade av den kontrollen. LOCAL-PRESENTATION-RUNTIME.md
har aktivt/äldre materialurval, normalisering mot −16 LUFS med toppgräns,
samt korrigeringen att dealer-card-tracks spårar kortytor, inte ansikten.

Kevin rapporterar upp till cirka 4 s sena munbilder vid chattsvar och
kallstarts-/samtidighetsproblem. Roulette-guiden kräver därför prov med
försenade svar och samma normaliserade PCM på båda sidor. Worker-release,
avatarbank/ansiktsunderlag och Annas förbehandling återstår från Emil.
Ingen runtime eller publicering ändrad och inget GPU-/talprov utfört.

## AI-dokumentation: slutöverlämning 14 oktober 2026

AI-översikten och elva kanoniska OpenClaw-guider finns under [docs/AI](AI/README.md).
Äldre guideadresser är korta hänvisningar. Guiderna har integrerats med main
`0511206d`, utan att ersätta senare drift- eller Admin-ändringar.
Användarguiden innehåller daterad adress-/slugglista och N1:s åtkomst till
alla tre ytor. D-ID:s publika chatt och N1:s interna Adminrobot är separata.

Teknisk D-ID-uppspelning med ljud aktiverat är verifierad; hörbar/läppsynks-
acceptans och positiva inloggade N2/N3-prov är fortfarande öppna. N1-prov
är inte ett substitut för dessa roller. PR #91:s spelarprov stoppades av Jakob:
två repliker, pausåterhämtning och första mjuka 7/17-handens förlust verifierades;
vinst, oavgjort, split och mobil återstår. PR:n är inte spelargodkänd.
Privata kvitton finns i rotens ignorerade arkiv. Fortsatta spelarprov ska använda
en internetadress enligt Jakob; ingen lokal produktserver startas för dem.

Admin C1–C3 ägs av chatten ADMINADMINADMIN. PR-samordningen har fått
överlämningen om #91. Huvudcheckoutens blandade ändringar bevaras; den här
dokumentationen levereras från en separat branch, utan merge eller deploy.

## Dragan: talunderlag och tydligare bordseditor, 14 oktober

Samordnat med ADMINADMINADMIN och KEVI-POD-EMIL; båda har lämnat berörda filer fria. PR133 är granskad och mergad som dd574b7e. Bildruteplanen och PCM-förberedelsen är fortfarande inaktiva i spelaren; de är inte en färdig läppsynksintegration.

Dragan har nu en sparad förberedelseprofil i produktion: egen ElevenLabs/Dragge-röst på svenska och exakt Kevin-grundloop 2f3955b0-b450-4cc2-a9f5-ac80f10abd2f, hash 2b8d6ea7829bde6212f6145038569747a389c5e20166b3ea08fc26efda81c9e3, som motion-video vid 0 ms. Revision studio-9a397cd8-ba05-4d5e-9e11-8e8b0ff273e7. AI-tal är inte aktiverat; sammansättningar och 56 biblioteksklipp är oförändrade. Ingen ny publicering eller GPU-generation gjordes.

Den befintliga bordseditorn har två synliga val, **Följ korten** och **Placera cirklar själv**, samt tydligare instruktioner för kort, cirklar, piltangenter och procentfält. Sparformatet och den accepterade v4-geometrin ändras inte.

Kevins staging är fryst på 5134d9274fdaa9d09dd3f3cf40f02ecd95716afe. Av de fyra tidigare förberedda svenska replikerna är goodluck_1, insurance_1 och double_1 identiska; win_1 har nya bytes och är inte ersatt i produktion. En privat ZIP med dessa fyra källfiler, exakta reposökvägar och hashjämförelse finns i uppdragets steglogg. Ingen av dem har ny talacceptans. Worker-/åtkomstfynd och återstående integration beskrivs i LOCAL-PRESENTATION-RUNTIME.md. Behåll lab-källan. Två verkliga talprov återstår; layoutens tidigare prov ersätter dem inte.

Källanalys efter Jakobs uttryckliga tillstånd: Gemini med hög upplösning transkriberar insurance_1 som ”Ess synligt. Vill nån ha försäkring?” och nya win_1 som ”Grattis till vinnarna.” Försäkringsklippet bedöms preliminärt följa talet; win_1 flaggas för sena munrörelser, ungefär 0,5 s efter talets slut. Detta är modellobservationer, inte uppmätt eller accepterad produktsynk. Den första analysens påstående om frusna bilder har förkastats: lokal ansiktsgranskning visar tydliga munrörelser. Båda klippen behåller granskningsstatus och publicerades inte. Råresultat och källhashar sparas endast privat i uppdragets steglogg.

Verifiering av bordseditorn: Studio-produktionsbygge och 32 fokuserade preview-prov passerar. Full pre-commit gav 3 743 godkända, 12 överhoppade och inga fel. Oberoende granskning fann inga blockerare. PR #138 är mergad som ad0ae9ac och Vercelproduktionen är READY. Den sista visuella kontrollen av menyförtydligandet kunde inte utföras efter att browsertransporten stängdes.

Talfacksrättningen ger registrerade dealers ett explicit standardklipp per replik. De 14 situationerna i speak.other delar inte längre ett enda standardval; sparade UUID:n ligger kvar i befintliga project.lines. De tre egna talraderna behåller sina standard-ID:n. Äldre alternativ bevaras, inga filer aktiveras automatiskt, och runtime v20 krävs för projekt med nya talfacksbindningar. Ingen SQL-migration. Riktade backendprov: 173 godkända; UI-prov: 20 godkända. Studio-produktionsbygget passerar med 97 kontrollerade spår. Oberoende review fann inga blockerare; dess notering om äldre standard visas nu i väljaren. Full pre-commit inklusive de tre nya testfilerna: 3 764 godkända, 12 villkorligt överhoppade, 0 fel. De nya testerna ligger i ordinarie hook/CI. Astrids godkända urvalsbaslinje är oförändrad. PR #139 är mergad som 220519a1. Vercel är READY och Render svarar med samma SHA och capability 20. Produktionskontrollen i /admin/dealer-studio visar goodluck_1 endast i Lycka till och ett separat tomt hälsningsfack. Inget val, medieinnehåll eller godkännande ändrades i detta läsprov. Faktisk ljud-/bildacceptans återstår.

Uppföljningen ansluter även den grafiska klippkartans läsning och bindning till samma exakta talfacksmodell. Alla 17 standarder kan sparas utan den äldre begränsningen för delad talgrupp. Äldre baslinjer och uttryckliga alternativ bevaras inom rätt fack; saknade eller felaktiga explicita val ersätts inte automatiskt. Filmväljaren får full bredd och större träffyta. 39 fokuserade klippkarts-/bindningsprov och fem befintliga UI-prov passerar. Oberoende läsgranskning fann inga blockerare. PR #142 är mergad som 418040fa och Vercelproduktionen är verifierad på denna revision. Läsprov i både klippkartan och dealereditorn visar goodluck_1 endast i Lycka till och ett separat tomt hälsningsfack; rum, spelbolag, sammansättning och dealer följer med. Väljaren är 44 px hög. Inga sparade klippval, godkännanden eller publicerade medier ändrades. Full hook: 3 777 godkända, 19 villkorligt överhoppade, 0 fel; Studio byggde 97 kontrollerade spår. CI blev grön efter en omkörning av ett oförändrat tidskänsligt OpenClaw-prov, utan att sänka kraven. Kodleveransen är klar. Faktisk ljud-/bildacceptans, två sammanhängande talprov och rörlig workerintegration med verifierad avataridentitet återstår.

Kevins 81 svenska talfilmer är inventerade. 59 hör till de 17 nuvarande talfacken; övriga 22 är extra hälsningar/repliker. Ett privat ZIP innehåller 18 oförändrade original (en per fack samt greet_guest), exakta reposökvägar och SHA-256. Lokal granskning av 24 bildrutor per film visar munrörelser i samtliga 18, även greeting_1 och blackjack_4. Detta bevisar inte ljud-/bildsynk. Ingen tagning har fått ny produktionsacceptans. Den privata stegloggen skiljer källgranskning från spelprov.

## Dragan: bordsprofil, kortvy och samtalspanel, 14 oktober

Admin visar bordsbredd och egna kort-/insatsplatser per bord och format i samma sammansättningspanel. Valfria betMode=under-cards binder markerytorna under kort och poäng; äldre profiler behåller manuella punkter. Kortvisningen kan växlas mellan Upplyfta och På bordet och sparas i spelarens webbläsare. Filmad kontakt följer källplanet fram till släpp; ett lägesbyte upphäver pågående kontaktbindning utan att ändra serverkort eller avslöja hålkort. Fyra split-händer har egna rader utan överlappande poängbrickor.

Swedish Games befintliga Dragan-rum är publicerat som version 4. Den accepterade Oak-profilen har sju spelarankare och ett dealerankare på desktop, samt tre synliga spelarplatser åt gången på mobil. Mobilbordets bredd är 1,75, desktopbordets 0,68; kortbredden är 3,8 respektive 5 procent av bordbilden. Insatsytorna följer korten i båda formaten. Läsning efter publicering bekräftar exakt accepterad profil, samma rum och samma 36 medie-ID:n och SHA-256-värden. Inga dealerfilmer importerades på nytt för layoutändringen. Lab är fortsatt aktiv källkod och behålls.

PR #132, #135 och #136 är levererade; Vercel och Render är verifierade på ce6a714d. Huvuddomänens appkod matchar lokal källhash. Givknappen placeras efter uppmätta insatsytor, rensa-insats och HUD; verkligt platsbrist ger varning, men en inaktiv knapp ger ingen falsk varning. Startläget och aktivering efter första insatsen är verifierade efter sista driftsättningen. Full ordinarie kontroll: 3 735 godkända, 12 överhoppade, inga fel. 32 fokuserade geometri-/knappkontroller och oberoende granskning passerade; PR- och main-CI är gröna.

Den slutliga profilen provades med två sammanhängande rundor per format i verklig Studio-preview: desktop 1280×720 med alla sju platser, mobil 390×700 med tre synliga platser. Båda kortvyerna och filmade extrakort användes. Inga konsolfel eller varningar observerades; alla insatser använde separat syntetiskt testsaldo, inte ett vanligt spelarkonto. Detta verifierar den provade layouten och sekvenserna, inte varje möjlig hand eller talets läppsynk. Privat steglogg, bilder och kvitton är uppdaterade.

Chatt, röstknappar och status samlas i en panel även på mobil. Öppnad logg/inmatning/minne har ett gemensamt flöde; stängd panel behåller röstkontroller och felstatus. Detta aktiverar inte Dragans saknade röstprofil eller läppsynk; hörbar och visuell talacceptans återstår. Runtime v19 krävs för den nya profilen, inklusive omskrivning av frysta paket vid livscykelåtgärder; ingen SQL-migration. Befintliga manuella profiler och kortläge behålls tills de ändras uttryckligen.
## Dragan: filmad givning och exakt inspelat tal, 14 oktober

Spelarens gemensamma väg har en hashbunden Kevin-profil med 35 givnings-/vändklipp och deras källspår. Sekvensen följer serverns beslut och väljer VILA/REDO-varianter; en ofullständig kedja ger 2D-reserv. Varje fil binds uttryckligen i rätt händelserad och följer med det frysta rumspaketet. Givningsrader tillåter 16 alternativ; andra rader behåller fem. Runtime v17 krävs före nya sådana projekt eller inspelad-tal-metadata; ingen SQL-migration.

Talets nya metadata binder exakt text, språk, tagning, video, ljud, bildruteindex och kalibrering. Inspelningskontroll och visuell acceptans är separata. Vanligt och fryst spel kräver godkännande; endast autentiserad, ägd Studio-preview tillåter en verifierad inspelning som väntar på bild-/ljudgranskning. Originalfilens eget ljud spelas en gång. Annat språk eller annan tagning används aldrig som reserv. Äldre material behåller sin uppspelningsväg.

PR #124 (baabb37d) levererade den exakta Kevin-profilen. PR #125 (88b140e9) är live på Vercel och Render med runtime v18 och begränsad Brotli för större frysta paket. Studio-bygget och full pre-commit passerade: 3 684 godkända, 11 överhoppade, inga fel; oberoende granskning och GitHub CI passerade. Biblioteket innehåller 56 Dragan-filmer. De 25 nya givningsvarianterna är byteverifierade (39 627 593 byte) och 35 exakta Kevin-klipp är kopplade i fem händelserader i projektet studio-6799944c-ab75-4cf1-be97-b4622c097003. Bindningen gjordes med CAS och både produkt- och repositorylås; övriga projektfält och dealers är oförändrade.

Två sammanhängande givningsrundor per format är genomförda i den verkliga spelaren med isolerat testsaldo: desktop 1440×900 (35→5 och 5→10), mobil 390×844 (15→5 och 5→0). Alla sju platser, extrakort, vändning och dealerns extrakort användes. Exakta val kom från Kevin-profilen och återgick till grundloop. Inga insatser gjordes på spelarens konto. Första nätverksbufferten kapades vid kontextbyte; separata tidigare fångade initialval och senare fullständiga segment finns i det privata kvittot. Detta är prov av de använda sekvenserna, inte visuell acceptans av varje möjlig spelkombination.

Swedish Games version 3 är publicerad med 35 exakta givnings-/vändklipp samt grundloopen. Paketets kanoniska innehåll och samtliga klipp-ID/hashar matchar exakt det provspelade paketet. Mage och bord möts med bordsbredd 0,68/1,40 och dealer-y 0,06/0,03 för desktop/mobil. Det tidigare HTTP 413-felet är löst: 46 983 byte konfiguration ryms som 6 947 Brotli-tecken och 7 112 byte total branding, inom oförändrad gräns på 8 000 byte. Saknad valfri talreplik ger inte längre missvisande kortstatus ”2D-reserv”. Privat publiceringskvitto observerat 2026-10-14T03:37:30.357Z; ingen talfilm finns i paketet.

Fyra svenska originalrepliker (goodluck_1, insurance_1, double_1, win_1; totalt 2 999 350 byte) är importerade som pending/pending, inte valda eller publicerade. Automatisk transkribering är bara ett textförslag; första orden i insurance_1 är osäkra. Ingen hörbar läppsynksacceptans har gjorts. Originalen finns för användarens granskning i den privata HTML-stegloggen. Rörlig AI-läppsynk har separata integrations-/avatarverifieringar kvar. lab/ behålls som aktiv källkod.

Native SSH kör som root medan spelappen kör UID/GID 1000. En import skapade den tillfälliga mediacachen med fel ägare; exakt cachekatalog och journal fick appens ägare och begränsade rättigheter, utan ändrade original eller databasposter. Privata importhjälpar sänker UID/GID innan media-/filsystemarbete. Efter rättningen laddade samtliga använda provklipp utan HTTP-mediafel.

## Dragan: utebliven första bildruta, 14 oktober

Live-spelaren visade ”Idle: Film ended without a presented frame” för exakt Kevin-grundloop 2f3955b0-b450-4cc2-a9f5-ac80f10abd2f. Felet visar att medielivscykeln eller första presenterade bildrutans bevis saknades; den ursprungliga händelseordningen är inte bevarad, så rotorsaken är inte fastställd. Samma fil gav 121 verkliga bildrutecallbacks per uppspelning i två isolerade lokala mediaprov. Provet använde ingen spelmotor eller användarplånbok.

Spelaren klassificerar nu endast started+ended utan presented som återförsökbart och lämnar avgränsade tillstånd i felkvittot. Egen grundloop får ett återförsök efter 500 ms med samma exakta klipp; en andra miss stoppar. Varning och stängd talgrind kvarstår tills aktuell ägares riktiga bildruta kommer. Givning, tal, dold flik och stängning avbryter väntande återförsök. Hash-, avkodnings-, kompositions- och paketfel återförsöks inte. Detta aktiverar inga talfilmer eller AI-röster.

Fokuserad regression: 61 test passerar, inklusive diagnostik, retrygräns, verklig frame som återhämtning och samtliga ägaravbrott. Full leveranskontroll och produktionsprov redovisas i leveranskvittot; ingen läppsynksacceptans härleds från dessa tester.

## Dragan: kortplatser som följer valt bord, 14 oktober

Swedish Games-utkastet med Dragan, Lounge varm och Blackjack Oak visade
kort och insatsknappar nedanför bordsskivan i isolerat provspel. Sammansättningar
har nu valfria placeringar per exakt bord och format, med visuella reglage
under Bord. Delade händer, återupptagna serverplatser och byte tillbaka till
äldre placering bevaras. Filmat handkontaktspår godkänns inte av denna geometri.

Validering, frysta paket, materiallivscykel och sparningens versionsgrind
följer fältet. Runtime v16 krävs före skrivning; ingen SQL-migration.
Studio-bygget passerar med 97 byggspår. Full ordinarie pre-commit på
`652f3f2e`: 3 610 pass, 11 skip, 0 fel i 75 grupper. PR122 är mergad som
`ce58ebb0`; Vercel READY och Render live verifierade på samma SHA.
Oak-placeringar är sparade per format. Efter återinloggning avslutades två
sammanhängande desktoprundor (1440 × 900) och två mobilrundor (390 × 844)
med slutlig kalibrering och separat testsaldo. Kort och insatser följer Oak.
Swedish Games har nu ett öppet rum, Dragan · Blackjack, publicerad version 1.
Valen i /lobby och faktisk spelstart verifierades utan insats på riktigt konto.
Annas roulette-rum finns kvar hos Scoutgaming Demo. Dragans import erbjuder
30 filer per omgång; de elva lokala MP4-originalen finns redan i klippbanken.

Filmad givning kräver fortfarande pose-/sekvenskoppling och klippkalibrering;
tal och läppsynk är inte accepterade genom dessa prov. Dragan saknar ännu
kopplat lobbyporträtt. /lobby saknar fortfarande den bordsväljare som finns i
kompatibilitetslobbyn. lab/ är aktiv källkod och ska behållas. Privat HTML-
steglogg, Kevin-ZIP med ursprungssökvägar och produktionskvitton är uppdaterade.

## Anna-tal: integrationsgräns och testplan, 14 oktober

[Roulettereferensen](games/roulette/TEKNIK.md#anna-tal-och-rörlig-läppsynk-14-oktober-2026)
skiljer verifierad tyst scen från återstående dealerchatt, röstprofil,
kompatibel referens, worker-avatar och faktisk taluppspelning. Roulette-agenten
bekräftade underlaget och har inga aktiva filanspråk; dess testserver är
stoppad. Annas röst/workerunderlag och talacceptans är inte verifierade.
Källkod är önskvärd för granskning/underhåll men inget absolut krav för API-
anrop till befintlig worker. Ingen ny Cartesia-inloggning krävs för Paow/Dragges
ElevenLabs-väg. #116 är fortfarande en inaktiv adapter.

21 isolerade befintliga referens-, röst- och bildrutekontraktstester passerade
utan fel/skip. Dokumentationskontrollen gav 43 godkända, 0 fel, 0 skip.
Dokumentationen anger också återstående liveprov och att Studio-preview
stänger av genererat tal. Ingen runtime, dealer, publicering,
nyckel eller GPU-körning ändrad; Admin- och Dragan-arbete lämnas orört.

## Admin C4/C6: partnerretur och isolerad publiceringskedja, 14 oktober

Aktuell gren `codex/admin-partner-return-c6` utgår från main `fa1fdaae` efter PR145 och
DRAGANs PR144. DRAGAN och SAMORDNING har överlämnat dessa kodfiler och enbart
våra Admin-avsnitt i dokumentationen. Lab och integrationskopian behålls.

Partnerlogin tappade vald arbetsyta/rum. Validerad retur följer nu med genom
serverredirect, partnerformulär och intern adminlänk; auth och behörigheter
är oförändrade. 47 riktade tester inklusive Chromium passerar utan överhopp.
C6 följer samma nya publicering från verkligt N1-formulär via autentiserat
N2-API och lobbykomponenter till ordinarie spelstartsvalidering: två gröna prov,
inklusive Chromium. Fel bolag/roll/rum nekas utan ändring av paket/ägarskap.
SQL, konton och runtime/mediaunderlag är isolerade fixtures. Full N2-vy,
spelarlogin, produktionslagring och verkliga spelomgångar återstår.

Aktuell status och exakta acceptansgränser finns i
[C1–C9](CLOUD-MIGRATION.md#admin-checkpoints-c1c9). Loggens läsanvisning skiljer
aktuell status från daterade kvitton och pekar ut den kanoniska
återställningsguiden. Äldre planer/kvitton och andra agenters områden bevaras.

Kodcommit `d95ba378` passerar full ordinarie kontroll: 3794 godkända,
9 uttryckliga överhopp, 0 fel/cancel i 77 grupper. Alla nya browserprov kördes.
Studio-byggets 97 spår och Admin/lobby-typkontroll är gröna. Oberoende granskning
förstärkte C6:s prov mellan två publicerade bolag. Egna junctions, browser-
och serverfixtures är städade; två tillfälliga arbetskopior väntar på begärd
arkivering. Integrationskopian, dess beroenden och bygge behålls enligt Jakob.

### Historiskt C4/C5-kvitto efter PR140

PR140 är granskad och mergad till `c3397d1d0503927a6d0dafc240c21772634d99ee`.
Vercels huvuddomän kör samma SHA, READY i `dpl_AZmTomDfe14ErSFnjKqp3zzA8at2`.
Eget läsande slutprov kl. 20.30 svensk tid behöll Swedish Games version 4,
Dragan-rummet, sammansättning, dealer och Blackjack genom Publicering →
Provspelning → Klippkarta samt reload/Bakåt/Framåt. Spara var inaktiv; ingen
produktionsskrivning, ny login eller spelanslutning gjordes. Ny produktionslogin,
full RSC-/Lab-historik, andra redigerare och C6/C7 återstår enligt trackern.
Tre senaste agentarbetskopior och egen testflik/fixture-cache är städade.
Integrationens beroenden behålls för samordnarens tillfälliga PR91-junctions;
inga egna produktservrar eller agentprov körs. Renderacceptans är separat.

Arbetsgång före leverans: C4/C5-passet på `codex/admin-c4-room-history` startade efter DRAGANs
PR138 (`ad0ae9ac`), med hans talfacksleverans före vår integration. Bara våra
Admin-avsnitt är överlämnade. Tre separata agentarbetskopior har provat riktig
Admin efter login, Lab-historik samt projektredigerarens sparning/konflikter.
Sex isolerade loginprov använder riktiga rumsväljare och sammansättningspanel.
Eget läsande liveprov behåller Swedish Games version 4 / Dragan-rummet genom
Publicering → Provspelning → Klippkarta och reload/Bakåt/Framåt; ingen ny
produktionslogin, publicering eller spelomgång gjordes.
Lab-historikens reproducerade mellanpost-/Next-state-fel och tappad speltyp
rättas med en delad historikägare: 25 slutliga prov passerar, även efter integration; 42 relaterade prov passerade före sista rättningen. Äldre oindexerade
poster och full RSC-acceptans redovisas fortfarande som luckor i trackern.
Revisionshämtning kunde också tappa text som skrivits under väntan. Den läser
nu senaste utkastet; 18 riktade C5-prov passerar med syntetisk auth/lagring,
riktig HTTP, 409, återläsning, konfliktval, historik och avbruten omladdning.
Integrerad efter DRAGANs PR139 på main `220519a1c4d70a808b35781ac965de9c7f133887`. Kodcommit `6ef4a2de456a8ecf5baf5bd87210cdc404f6bcf4` passerar full pre-commit: **3784 pass, 9 skip, 0 fel/cancel i 77 grupper**, Node 24.21.0/fyra workers. Lab-bygget med 97 spår och Admin/lobbyns typkontroll passerar. Alla nya isolerade browserprov kördes; skippen gäller andra uttryckligt villkorade prov och räknas inte som acceptans.
Äldre daterade kvitton nedan är historik och ersätter inte dessa bevisgränser.

Efter DRAGANs uttryckliga dokumentöverlämning av PR118 finns C1–C9 i
[befintliga migrationstrackern](CLOUD-MIGRATION.md#admin-checkpoints-c1c9).
Ursprunglig integrationsbas: `5ca686c5513982f9a760ad8dd07e67ed4d4e2e40`; egen gren
`codex/admin-c1-c3`. DRAGAN har på nytt överlämnat endast eget Admin-avsnitt.
PR124–127 och hans spelkvitton är bevarade som hans prov. Han rapporterar
två isolerade produktionsrundor efter PR127; detta är inte vårt eget spelprov.
Agenter arbetade i separata worktrees med navigation, N1-CSS och kortlayout.
Huvudcheckouten och PR91:s arbete har inte använts för editeringar.

Bolag & team har en huvudmenyingång via Verktyg. Klippkarta, Konton & åtkomst
och Integrationer har samstämmiga namn. Portalraden går till `/admin`,
`/partner` och `/lobby`; befintliga spelstarter och registeröversikter består.
Admin använder sin lokala Inter-font med läsbarare meny-/kontexttext och
intern rullning för lång desktopmeny. Smal System-popup är fortfarande synlig.
Startsidan visar de befintliga bolags-, publicerings- och provspelningsflödena.
Bolag & team har en sidrubrik. Klippkorten får läsbarare text och nästa rad
flyttas ned när ett bibliotek öppnas; användarens manuella kortplaceringar
bevaras. Minikartan togs bort i PR130 efter verifierad skymning på mobil och desktop.
Panelernas sista åtgärder kan rullas fria från Adminrobotens launcher efter
ett reproducerat mobilfel. Eget före/efter-prov vid 390/1440 px verifierar
hela knappytan och fokus; oskickad chatttext och lokalt kategoriutkast
bevaras när chatten minimeras och öppnas igen. Widgetkod och lagernivåer
är oförändrade, och inga skrivande nätverksanrop gjordes i provet.

Integrationscommit `e9996383`: full pre-commit **3 712 pass, 11 skip,
0 fel/cancel i 76 grupper**, Node 24.21.0/fyra workers. Lab-bygget med
97 byggspår och Admin/lobbyns typkontroll passerar. Skippen är inte acceptans.
Eget läsande browserprov använder lokala UI-resurser på huvuddomänen i egen
flik, vid 1440/1024/640/390 px. Kortexpansion, bolagsrubrik och startsidans
länkar har följts upp vid 1440/390 px. Detta är inte levererad UI-acceptans.
Inga egna produktionsskrivningar av data, spelprov eller lokala produktservrar
har utförts. Efter Jakobs nya leveransmandat mergades den granskade PR127
på fryst head `2930b3b6` med gröna kontroller; main blev `5ca686c5`.
Tidigare passets `c0ff2332` (3 594 pass/11 skip) och
43 dokumentprov behålls som historik i trackern. Tre tidigare avbrutna
försök och den slutliga, verifierade Temp-miljön redovisas där också;
inga test- eller säkerhetsregler lättades.

Avbruten indexerad Bakåt/Framåt bevarar nu Framåt-historiken i riktade
tester. Ett verkligt lokalt kategoriutkast överlevde intern Bakåt/Framåt
i egen browser; omladdningsvakten observerades men dess båda dialogval
är inte accepterade. Utkastet kastades genom att stänga den egna fliken.
Ett separat reproducerat fel är rättat: Vera visades efter Admin-retur på
bar `/admin/clips`, men reload valde Astrid. Synkning på accepterad path/query
behåller nu valet även efter reload; 21 historik-/ruttprov passerar.
Eget läsande prov behåller hela Swedish Games / Dragan-rummets kontext genom
meny och Bakåt/Framåt. Sista reload krävde inloggning med exakt `returnTo`;
lyckad inloggning och efterföljande rumsvisning är inte verifierade.
Oberoende Lab-historik, full login-/
kontextmatris, spara/återläsa, revisionskonflikt, publicering, rollgränser
och två spelomgångar återstår.

PR129 är mergad till `dbfe94b5` efter gröna kontroller och Vercel är READY
på huvuddomänen. Eget läsande liveprov verifierar Inter/Inter-SemiBold,
startsida och bolagsrubrik vid 1440/390 px. Bolagets reload/Bakåt/Framåt
och Dragan-rummets fulla kontext via provspelning, startsida och Klippkarta
behålls. Skrivande flöden och egen spelacceptans återstår. Samtliga nio avslutade
arbetskopior är arkiverade efter överföring eller avslutad läsande granskning.
Egna browserflikar är stängda. Integrationen
och privata provkvitton behålls; ingen egen produkt-/Lab-server är aktiv.
Faktisk 200-procentszoom och full dialogmatris återstår. Tidigare
agenters Anna-/import-/rensningskvitton är bevarade och inte återutförda här.

Hela `/control` kan inte raderas: Partner importerar dess delade renderare
och login-/lösenordsalias behövs. Vanliga dokumentlänkar omdirigeras redan.
Den befintliga trackern beskriver ordningen för säker frikoppling. Faktisk
produktion före Admin-leveransen använde Arial i rubriken; grenens lokala
Inter är nu verifierad i levererad rendering. Ingen extra skuggfix motiverades
av kodinventeringen.

PR130 rättar två egna livefynd efter nytt DRAGAN-ack. Ett för stort
publiceringsutkast gav 413 vid läsning trots att rum/revisioner kunde visas.
GET returnerar nu blockerad readiness med befintlig orsakstext; miljökravet
har fortsatt företräde. POST, behörighet och gränser består. Desktopens
minikarta täckte 202 × 152 px av ett kort och är borttagen; zoom/Fit View
behålls. 61 riktade prov passerar inklusive roll, bolag och revisionsskydd.
Commit `e67e6faa`: fullhook **3 713 pass, 11 skip, 0 fel/cancel i 76 grupper**,
Lab-bygge med 97 spår och typkontroll gröna; oberoende granskning utan blockerare.

PR130 mergades till `393439677cd78d86807099d973638c72eaa144af` efter grön CI;
main-CI är också grön. Vercel READY på www och Render live med verifierat
`/__cloud/version` bokförs separat i trackern. Eget läsande liveprov visar
200/ready:false med begripligt miljökrav för den tidigare felande kandidaten,
och 200/ready:true med rätt Dragan-rum/version 3 för den giltiga kandidaten.
Revisionerna är oförändrade. Den överlappande minikartan är borta och samtliga
tre zoom-/Fit View-knappar fungerar med bevarad kontext. Inga data skrevs och
inget spel startades. Tre laddningsavbrott gäller Vercels feedback-script;
inga HTTP-felsvar eller konsolfel fångades. Det är inte full C4–C7-acceptans.
DRAGAN har fått nya main och fortsätter geometri-/runtime19-arbetet separat.
Slutkvittot levereras från `codex/admin-live-receipt`; endast eget Admin-avsnitt
ändras, inga andra agenters historik eller produktfiler.

Nästa pass utgår från `87f30ce1` på `codex/admin-c4-acceptance`. DRAGAN hade
redan mergat PR132 och lämnade uttryckligen över våra Admin-avsnitt; hans
bordsprofil, visuella spelprov och publicering förblir hans arbete.
Eftergranskningen hittade inget konkret regressionsfel och 127 kompletterande
lokala tester passerade. PR/main-CI, Vercel och Render är gröna på samma SHA;
detta är inte ett eget spelprov. Exakta revisions-/driftkvitton finns i trackern.
Trackern förtydligar nu att arbetslista och UI-mål kan ändras enligt Jakobs
aktuella instruktioner. Historiska formuleringar låser inte utformningen.
Git registrerar dokumentets ursprung på Jakob Ebergs konto den 28 september
2026 kl. 19.57; vilken människa eller agent som skrev texten framgår inte.
Inloggningstestets browserloader rättas för verkliga modulberoenden och CSS-namn.
Sex isolerade inloggningsprov passerar med riktig auth/route, SQLite i minnet
och egen Chromium-context. Utgången session → lyckad login → Bakåt/Framåt/reload
bevarar fem kontextfält från båda Admin-aliasen. Provet ersätter Klippkartan
med fixture-HTML; verklig rumsvisning efter lyckad login i produktion och
oberoende Lab-historik återstår. Produktkod, delade sessionscookies, pågående
spel och publicerade data ändras inte. Lab-bygget och 97 byggspår passerade.
Commit `cb7f19f7`: full pre-commit **3 733 pass, 9 skip, 0 fel/cancel i
76 grupper**, inklusive samtliga sex browseraktiverade inloggningsprov.
De två nya agentarbetskopiorna är arkiverade efter verifierad överföring/
granskning; totalt elva. Egen testcache är städad och fixture-browsers stängda.
Enbart integrationen och privata provkvitton behålls för fortsatt Admin-arbete.

## Rörligt dealertal: förberedd adapter, 14 oktober

RunPod-åtkomsten och staging-imagen är identifierade. Befintlig GitHub-
inloggning ger fortfarande 403 för container-manifestet; källkod och
hashbunden avatarbank behöver verifieras. Se LOCAL-PRESENTATION-RUNTIME.md
för exakta observationer och nästa kopplingssteg.

En inaktiv bildruteadapter förbereder worker-kartor för Paow och
Dragan/dragge, binder tal/version/ljud/media och släpper bara exakta
frame-matchningar till dealerlagret före beskärning/keying. Den ändrar
inte liveplayer, OpenClaw, röster, providerinställningar eller spelmotor.
Riktade kontrakttester ingår i full pre-commit.
Full regression passerade: 3564 godkända, 11 överhoppade och 0 fel. Lab-produktionsbygget passerade med 97 kontrollerade byggspår. Livejobb och två visuella talprov per dealer återstår.

## Admin: återstående kompatibilitetsluckor, 13 oktober

Talgranskning finns i Admins verktyg och öppnar befintlig granskningskomponent
med vald dealer, samma session/grants och samma native-API. Materialbiblioteket
bevarar bakgrundsfliken efter omladdning. Äldre lanes/companies-bokmärken och
clips-länkar med dealerId får rätt destination och kontext. Missvisande
”äldre editor/vy”-etiketter är borttagna när komponenterna visas i Admin.

Sju regressioner gav rött före rättning; 33 riktade prov är gröna.
Produktionsbygget (97 byggspår) och Admin/lobby-typkontrollen passerar.
Full regression efter integration med roulette- och budgetleveranserna:
3 552 pass, 11 skip, 0 fel. Studio-bygget passerar med 97 kontrollerade byggspår.
PR110 är mergad som `1595fb451cf19fbcbba1ece04e4bb8c7c74a9bc6`:
Vercel READY och Render live på samma SHA, alla CI-kontroller gröna.
Inloggat beroendeträd kontrollerat på huvuddomänen 14 oktober: röda menyn,
komplett registerläsning och separata Anna-/Dragan-kopplingar visas.
Dealers visar efter rensning/import Dragan med 27 klipp och ren PAOW med 11;
importlänken behåller Dragan och erbjuder
30 filer per omgång. Utloggad route bevarar returnTo till `/admin/deletion`.
Den befintliga migrationsloggen i CLOUD-MIGRATION.md skiljer funktionerna
i Admin från framtida avveckling av hostnamn och källkod. lab/ behövs av
Admin, autentisering, API:er, SQL och Render; inga tjänster eller data tas bort.

Kevins aktuella Git-ref är inventerad separat: 274 kodrefererade filer för
Dragan och Paow i ett privat ZIP, med exakta fack, sökvägar och hashvärden.
Sju av Dragans 21 produktionsposter matchar; ingen av Paows sex matchar.
Ingen ny publicering eller visuell medieacceptans följer av denna inventering.

Röd Radering-meny och ett anslutet beroendeträd finns i den nya koden.
Det visar bolag/spel/rum, dealers/filer och bakgrund/dealer/bord utan att
duplicera delade resurskort. Läsfel och ofullständig historik visas öppet.
Permanent datarensning är ett separat uttryckligt användarmandat med
skyddade resurser och konkret inventering i CLOUD-MIGRATION.md. Ren
offlineplanering och lokal backup är förberedda. Alla 232 inventerade objekt
under de fyra gamla dealernas mappar och två gamla borden har hämtats till
lokal disk och hashverifierats (145 404 657 byte). Inga
nya molnbackuper skapades. Produktionsrensningen är nu genomförd och ren
PAOW är registrerad som `paow-kevin` utan gammal Forge-profil.

Fortsatt rensningskod avregistrerar Amira ur katalog/layout/Blob-index och
tar bort gamla Paow-previewval och bildkopplingar. 97 exakta lokala filer
har kopierats och hashverifierats privat före borttagning. Dragge, delade
bakgrunder/bord och Kevins original bevaras. Ett verifierat Forge-race
stängs med dealer-/jobb-/leasekontroll under samma Studio-lås som skrivningen;
60 fokuserade Forge-/repositoryprov passerar. Chattminnet kontrollerar också
registreringen i samma transaktion, med game → Studio som i native Admin.
Samtidig projektsparning och chatt ingår i regressionen. PR117 är mergad som
`0511206dec4cb8468fe92d5f03202718d3bf2585`, Vercel READY och Render live på
samma SHA. Fullhook efter main-integration: 3 592 pass, 11 skip, 0 fel;
PR- och main-CI gröna. Kodreview fann inga blockerare.

Databasrensningen jämförde 304 originalrader och genomförde 164 uppdateringar
samt 139 borttagningar i en transaktion. Skyddade resurser, inklusive Annas
nytillkomna arbete, hade oförändrade fingeravtryck. Därefter raderades exakt
232 Blob-objekt efter verifiering av noll kvarvarande referenser.
Kvitton, plan-/manifesthashar och bevisgränser finns i CLOUD-MIGRATION.md;
råbackuper och exakta privata kvitton hålls utanför Git.

Kevin-importen har fullbytes-/hash-/registreringskvitto för sex nya Dragan-
och elva nya PAOW-filer. Sju befintliga Dragan-filer återanvändes. Samtliga
nya klipp är ogranskade alternativ; noll val/publiceringar/betalda jobb.
Den kortlivade importhjälpen bygger en validerad native-konfiguration lokalt
i processen eftersom N1-flaggan bara är aktiv på Vercel. Originalmiljön,
behörigheter och permanenta Render-inställningar ändrades inte. Dess egna
temporära filer är borttagna. 32 privata importprov passerade.

Jakobs nästa uppdrag är ett dokumenterat WebView-flöde för ett spelbart
Dragan-Blackjack-rum hos Swedish Games, nu skapat i produktions-Admin.
Hans val Lounge varm (video) och Blackjack Oak finns i ett separat sparat
Dragan-utkast. Dragan finns redan; elva lokala original matchar befintlig
klippbank. Egen grundloop och serverstyrda reservkort fungerar i befintlig
spelväg, men den valda Oak-scenen behöver rättad spelgeometri före acceptans.
Full filmad Kevin-givning behöver dessutom kortkalibrering
och pose-/sekvensintegration. Rum, publicering och två spelprov på
desktop/mobil återstår. En isolerad desktoprunda avslutades och mobilvyn
kontrollerades, men acceptansen stoppade på verkligt geometriavstånd:
spelarkort och insatsplatser hamnar vid Oak-bordets fot. De följer äldre
dealerankare, inte det valda bordet. Egen grundloop är sparad; ingen
publicering gjord. Till/Från skon-resolvern används ännu inte av playern.
Blackjack kan byta tillåtet bord mellan rundor; Roulette saknar intern väljare.
Ny `/lobby` delar katalog med `/play` men saknar dess bordval. Dessa fakta
och användarens privata HTML-steglogg skiljer biblioteksimport från färdigt spel.

## Anna-demorum: publicerat och två liveprov klara, 14 oktober

Admin-editorn kan nu spara exakt startfilm, bordsdesign, tider och handregion;
idle-mask och SHA/CAS-granskning av pose/framing är tillgängliga. Bibliotek och
sammansättningar filtrerar roulettebord separat från blackjack. Hjul/kula
komponeras i bordslagret under Annas händer. Startgest v2 och återgång till
vila är visuellt granskade i faktisk lokal spelarkod. Exakta bytes och cues:
docs/games/roulette/UTFALLSFILMER.md#startgest-v2-och-live-registrering.

PR101 är mergad som `a6509318`; samma version är verifierad READY i Vercel
och live i Render. Motorn svarar 200 med rouletteIdle/rouletteStart i v15.
Anna-idle, startfilm och MP4-bakgrund finns nu i Blob/Neon, liksom bord
`7e31ab32-8074-4b63-b1bb-4e6bee772421` och en egen sparad Anna-sammansättning.
Startvideo `96deca4e-3716-4db8-9a51-997ffa906a3b` har sparad VILA → VILA,
framing 1/0/0, 10042 ms, impuls 3208 ms och släpp 5000 ms. Både idle och
start har sina granskade handregioner i sparat rouletteutkast. Sammansättningen
har Anna, roulettespecifikt bord och MP4-salongen; inga blackjackbord tillåtna.
Admin avrundar bordets bredd till 1,04 i båda formaten (lokalt prov 1,044565);
övriga lager är 1/0/0, bordets x/y 0/0 och tableFront=false.
PR114 rättar förkontrollen och är live som `1fd552d3`: rouletteval och
skapandets sista kontroll använder samma spel; exakta v14/v15-svar accepteras.
110 riktade tester, Lab-typkontroll, Studio-bygge och full pre-commit
(3498 pass, 0 fail, 11 skip) passerar. Alla PR-kontroller var gröna.

Det separata bolaget `scoutgaming-demo` (Scoutgaming Demo) har nu paketversion
1 och det öppna rummet `room-d685ca7b-f52b-eb41-7cad-7b6f4e3c11ea`,
**Anna · Roulette · Demo**. Skapat via Admins ordinarie atomiska publicering,
med serverkvitto och frysta Blob/Neon-referenser. SG-tests äldre paketversion
16 och dess två arkiverade rum är bevarade. Dess konvertering blockerades
av befintligt legacy-skydd; ingen sådan konvertering eller skyddsändring gjordes.
Inga andra bolags rum ändrades och inga nya teammedlemmar bjöds in.

Två sammanhängande spel öppnades via `/lobby` → Scoutgaming Demo → Anna,
utan omladdning, på det av Jakob uttryckligen godkända demokontot:
5 på rött gav 17 svart (−5); 5 på svart gav 15 svart (+5). Demosaldot
återgick till startvärdet. Båda serverkvittorna var nya, inte återspelade.
Annas startfilm, hjul/kula, resultat och återgång till idle granskades i
synlig produktionsspelare, med MP4-bakgrund och bordbredd 1,04. Bilder och
kvitton ligger privat som `anna-live-acceptance.json`, `anna-live-round-1.png`
och `anna-live-round-2.png` i roulette-stop. Inga konsolfel observerades.
[Öppna demorummet](https://www.scoutgaming.tech/play/roulette?operator=scoutgaming-demo&table=room-d685ca7b-f52b-eb41-7cad-7b6f4e3c11ea&dealer=anna-jonsson).
Detta är demoacceptans med låtsasmarker. Serverstyrd pending/reveal återstår;
resultatet finns fortfarande i nätverkssvaret före den visuella landningen.

Tidigare lokala regressioner och leveransunderlag:
Admin typecheck, 49 editorprov och Studio-produktionsbygge passerar.
Kodcommit `b8e5e20c` är pushad med main `f22cb718` integrerad:
Studio-produktionsbygge och full pre-commit 3486 pass, 0 fail, 11 skip.
Två lokala rundor efter handfixen: 26 svart → 28 svart, saldo 490 → 485 → 480.
Under dold appvy kan skärmbilder vara inaktuella; synlig IAB verifierade
slutkulan i rätt fack. Slutacceptans ska göras med spelvyn synlig.
Nytt spelarprov bekräftar att handmasken ligger framför sifferringen.
Slutgranskningen hittade en paus/återstart-kapplöpning: en köad statisk
hjuluppdatering kunde hindra videornas nästa animationsruta. Refresh återtar
nu renderloopen om uppspelning har återupptagits. Regressionen och 26 riktade
scen-/hjulprov passerar; rättningen ändrar inga mediebytes eller kalibreringar.
Canvas2D-reservvägen återläser nu även rörliga handmasker per bildrevision,
tid och dimensioner; 25 riktade kompositorprov passerar. Två nya lokala
spelningar med sluträttningarna gav 7 röd → 26 svart och saldo
500 → 505 → 500. Därefter fortsatte Jakob själv i det isolerade provrummet.
Kvitton/bilder sparades privat; detta är fortfarande inte lobbyacceptans.
Migrations-/budgetrelease PR108 är nu mergad som `4df384ab` och integreras
i roulettebranchen. Vercel rapporterar READY för denna main-version.
Admin fungerar via den befintliga appflikens vanliga länkar. Ingen
adminsessionsnyckel har exporterats. Render-budgetens tidigare releasefönster
är avslutat; PR101 driftsattes först efter gröna kontroller.
Säkerhetsstatus uppdaterad 14 oktober: samordnaren återläste incident 38176586
som IGNORED/test_credential efter hantering av den syntetiska testfixturen.
Denna chats efterföljande statusläsning visar 18 observerade, 0 öppna och
18 ignorerade incidenter. Incidenttäckningen är fortfarande partiell och
historisk skanning ofullständig; detta är inte ett generellt säkerhetsfrikännande.

## Anna-startfilm och varierad roulette, 13 oktober — PR101 fortsättning

Valfri exakt rouletteStart med egen framing/handregion/tider, engångsspelning
och återgång till idle. Videotid styr hjulstart och kulsläpp; varierad slutvinkel
och fart härleds från rundans ID. Fullare landskapsscen/helskärmsknapp; ingen
ändring av serverns utfall, wallet eller MP4-bytes. 33 riktade spel-/scenprov gröna.
Full pre-commit för `ed973933`: 3409 pass, 0 fail, 11 skip.
Efter integration med main `6a9be6d2` passerade full pre-commit för
`dc764fa16c62247f393a4b36986f43883b871fab`: **3456 pass, 0 fail, 11 skip**.
Denna kodhead är pushad och PR101 förblir draft. Senare main `4d6b1ebc`
har en enda ny mergekonflikt i denna handoff; kodkonflikter saknas i merge-tree.
Ingen ytterligare main-integration görs under parallellt driftsarbete.
Två sammanhängande UI-rundor med ny frilagd film: 8 svart → 3 röd, saldo
500 → 495 → 500 USD i isolerad SQLite. Kvitton och bilder sparade privat.

Betald tiosekundersfilm skapad efter uttryckligt uppladdnings-/kreditgodkännande.
**Gesten är ännu inte godkänd:** ett presenterande svep, inte tydlig hjulimpuls
och kulsläpp. Tekniska cue-tider är provisoriska. Ingen live mediaregistrering,
Blob-uppladdning, rums-publicering eller merge till main. Nästa mediesteg är att rätta
gesten och godkänna kontakt/övergångar; sedan registrera godkända bytes i Blob.
Exakta hash, uppgifter och avgränsningar: docs/games/roulette/UTFALLSFILMER.md.

Versionskrock med #102 rättad: v1–14 bevarar mains exakta kontrakt; v14 gäller
dealerCategoryTrash. **Både rouletteIdle och rouletteStart kräver v15** med
separata featuregrindar. Ingen SQL-migration. Äldre v14-referenser nedan är
historiska testanteckningar, inte aktuellt publiceringskrav.
Integrationsbas: main `6a9be6d2`. Studio produktionsbygge och Admin/lobby
TypeScript gröna efter konfliktlösning. Admins tidseditor för startfilmens
cue-profil återstår, liksom liveacceptans; befintliga idle-kort fungerar.

## Rouletthjul och kula, 13 oktober — fortsättning på PR101

Anna-bordets sifferring ersätts vid uppspelning av 37 exakta fack från
motorns europeiska `WHEEL`. Endast katalogdesign `roulette-anna-v1` använder
denna kalibrering. En separat kula snurrar motsols, faller in i kvittots
nummerfack och följer rotorns inbromsning under nio sekunder. Annas film,
inramning, handmatta och MP4-bakgrund har oförändrade bytes/inställningar.
Inga nya filmer eller betalda jobb. Detta animerar hjulet, inte ett nytt
handkast från Anna. Den fotografiska mässingsaxeln ligger framför rotorn.

Bekräftat kvitto inväntar scenladdning och visning; mediefel, reducerad
rörelse, bakgrundsflik och stängning får inte skapa ny debitering eller låsa
spelknappen. Omladdning visar redan bokfört resultat i slutläge. Resultatet
finns fortfarande i nätverk/saldo före landningen: verklig serverstyrd
pending/reveal återstår. Inga produktionskonton eller publiceringar ändrade.

Fokuserat: 14 tester gröna (alla 37 utfall, kontinuerlig bana, två rundor,
sen scenladdning, stängning, renderingsfel och kvittots visningsordning).
Full pre-commit för `07b33c4f`: 3392 pass, 0 fail, 11 skip.
Efter omladdning kördes två sammanhängande faktiska UI-rundor: 30 röd,
sedan 2 svart; saldo 495 → 490 → 495 USD i isolerad SQLite. Kula och
resultat stämde vid landning; inga browservarningar/fel observerade.
Privata bevis: `anna-wheel-final-round-1.png`, `anna-wheel-final-round-2.png`
och `anna-wheel-two-rounds-evidence.json` under samma roulette-stop-mapp.
Kalibrering och avgränsningar: docs/games/roulette/UTFALLSFILMER.md.

## Anna i roulettespelaren, 13 oktober — codex/roulette-anna-binding

Separat rouletteIdle-bas/varianter/handregion i Studio → frozen capture →
rum och preview → gemensam spelarrenderer. Admin kan koppla/spara samma
kontrakt. Kräver runtime v14 före nya bindningar; ingen SQL-migration.
Legacyroulette fortsätter utan dealer om roulettefil saknas. Blackjackmedia
kan inte väljas eller hämtas genom roulettepreview/legacydealer-endpoint.

Nytt frilagt bord från Jakobs godkända bild, spelbunden katalogidentitet och
egna klickytor. Annas befintliga alpha-WebM och MP4-bakgrund återanvänds med
ny inramning och bildsynkron handmatta. Glasögon-v2 togs ur slutprovet efter
synliga alfahål i händer/fluga; variantstödet finns för en korrigerad film.
Ingen ny betald film.
Två UI-rundor körda utan omladdning genom riktig capture/preview/spelarkod
med isolerad SQLite: 33 svart och 6 svart i slutprovet. Inga produktionsregister ändrade.
Detaljer, hash/prompt och bevis: docs/games/roulette/README.md samt UTFALLSFILMER.md.
Det tidigare basprovet omfattade inte kula/hjulstart eller korrekta hjulsiffror;
den efterföljande implementationen beskrivs ovan. Färgheuristiken för händer kräver ny
granskning vid ändrade bytes/inramning/kläder. Visuell målbild är fortsatt
Jakobs referens; den nya rörliga passningen inväntar hans bedömning.

Verifierat för kodcommit `a0c7d708`: Studio-produktionsbygge och Admin-typkontroll
gröna. Ordinarie fulla pre-commit: **3385 godkända, 0 fel, 11 skip**.
Riktade tester täcker dessutom variantväxling, avbruten laddning, fel bildmått
och handmatta ur samma bildruta. GitGuardian-läsningen visade 0 öppna/17
ignorerade incidenter, aktiv övervakning; historisk scan `too_large`, platsdata
delvis tillgängliga och main-check köad. Detta är ingen fullständig historisk
friskförklaring.

## Testfixturer och Kevins rörliga läppsynk, 13 oktober 2026

PR #108 tog bort det fasta testvärde som utlöste GitGuardian 38176586.
Denna uppföljning flyttar motsvarande syntetiska Neon-adresser i åtta
testfiler till en gemensam hjälpare som skapar lösenord vid körning. Befintlig
databasvalidering, felredaktion och migrationstest behålls. En läsande
regressionskontroll i full hook/CI rapporterar enbart fil/rad/felkod om en
komplett credential-URL återinförs i testkällorna. GitGuardian är kvar utan
undantag, och den historiska incidentens status ändras inte.

[Runtimeguiden](LOCAL-PRESENTATION-RUNTIME.md)
beskriver det versionsbundna urvalet för Dragan/Paow, VILA/REDO-varianter,
korrekt röst och Emils rörliga läppsynkprotokoll. Materialagenten ansvarar
fortsatt för sitt separat godkända import-/rensningsarbete. Det verifierade
källpaketet har 274 filer; det är ingen produktions- eller synkacceptans.
Ingen Kevin-branch, walletlogik eller media importeras av denna leverans.

Den rörliga workerns källrepo gav 404 med nuvarande åtkomst. Vår stillbilds-
worker och generiska speechProfile kan inte aktivera den andra tekniken bara
genom byte av endpoint. Workeråtkomst, exakta avatarfiler, variantadapter,
auktoriserad relay och två riktiga talprov per dealer återstår före aktivering.
Testkvitto: 175 berörda tester godkända på Node 24.21.0. Efter integration
med main `1595fb45` passerade Studio-produktionsbygget och full pre-commit:
3555 godkända, 0 fel, 11 överhoppade. Leverans: PR #113.
RunPod-spåret är identifierat: staging anger endpoint `mq7eiwanda72fg`;
läs template/image/digest och avatarbank när rätt kontoåtkomst finns.
En otillgänglig GitHub-länk bevisar inte att den driftsatta workern saknas.

## GPU-testbudget 20 USD, 13 oktober

Jakob höjde uttryckligen dygnstaket till 20 USD. Dagssumman avser konservativa
GPU-reservationer per UTC-dygn, inte RunPods faktura eller separat LLM-/TTS-trafik.
Avläsning 19:47 UTC: 14 sessioner à 0,50 USD = 7 USD; även avbrutna försök räknas.

Kodens dygnsgräns är nu 20 USD. Effektivt tak är fortfarande det lägsta av
Render-inställningen och sparad Neon-policy. Sessionsreserven 0,50 USD och
fullfilsreserven 1 USD behålls; per-jobbgränsen är fortsatt 10 USD. Ingen historik,
reservation, återbetalning eller befintlig QA-kampanj ändras av höjningen.

Obligatorisk Studio-migration 011 vidgar endast budgetpolicyns exakta CHECK.
009/010 är fortsatt reserverade för B18/B19. Äldre SQL-/strukturchecksummor
bevaras och verifieras genom exakt versionerad strukturevolution; okänd drift
eller saknad 011-ledger nekas. Migrationen körs före merge. Först efter deploy
av koden uppdateras produktionspolicyn och Render-variabeln till 20 USD.
150 riktade tester och ett verkligt Neon-migrationsprov med full rollback PASS.
Render-startens exakta ledgerkontroll inkluderar också 011; CI kör verklig isolerad SQL-/omstartsacceptans.
Två tekniskt färdiga Paow-spelningar ersätter inte visuell läppsynkacceptans.

## Publik Scoutguide med D-ID, 13 oktober

PR #109 ersatte #105 och mergades som `7f02da34` efter verifierad livebudget
20 USD i PR #108. Produktionsprovet gav ett korrekt Luna-textsvar men visade
ett separat SDK 3-fel: `AgentManager.agent.idle_video` ligger direkt på
agentprofilen, inte under `presenter`. Den felaktiga callbacken avbröt
anslutningens uppvärmning. Läsningen är nu rättad enligt det installerade
SDK:ns kontrakt; regressionen var först röd och passerar efter rättningen,
inklusive byte till tal med ljud på. Ny avataracceptans krävs efter publicering.

PR103 är mergad och live (`b2dda8ab`, Vercel READY och main-CI grön).
Riktigt publikt textsvar fungerar i cookiefri produktionsvy. Första avatarprovet
fångade en anslutningskapplöpning: ett snabbt modellsvar kunde anropa `speak`
innan `connect` var klar. Uppföljningen väntar på den pågående anslutningen
och provar både snabbt svar och panelstängning under start. Nytt avatarprov
görs efter att rättningen publicerats.
Sidprovet hittade även att lobbyns och roulette-sidans CSP blockerade D-ID.
Endast deras HTML-dokument får nu ansluta till `https://api.d-id.com` och
spela avatarens vilovideo från `https://agents-results.d-id.com` samt WebRTC
via blob. Skript, tillgångar och interna adminytor behåller sina begränsningar.
WebRTC-uppvärmningen startar ljudlöst för att fungera med autoplayreglerna;
ljud vid svar använder fortfarande den synliga knappen om webbläsaren kräver
ett klick. Webbläsarverktyget kopplades bort under sista provet efter bytet
av GPT-inloggning. Full hörbar avataracceptans och inloggade N2/N3-sidprov
är därför fortfarande öppna. PR #105 samlar dessa avgränsade rättningar.

Besökare, N2 och N3 får en separat Scoutguide genom den gemensamma chattknappen.
N1 behåller Adminrobotens tre lägen, filimport och granskade åtgärder.
`/studio/api/public-assistant` använder Luna 6 med låg resonemangsnivå och
endast fast publik sajtinformation. Den har inga databasläsare, verktyg eller
åtgärder; den befintliga N1-endpointens behörighetskrav är oförändrade.

Den befintliga D-ID-agenten `v2_agt_UuD7CYFA` används i SDK-läget
`DirectPlayback`: sajtens server skriver svaret, D-ID läser upp det med sin
befintliga svenska röst. SDK laddas först när chatten öppnas. Minimering,
sidbyte, dold flik och två minuters inaktivitet stänger avataranslutningen.
Text fungerar även när avatar eller ljud inte kan starta. Privat D-ID-nyckel
används inte av webbchatten; dess publika embednyckel är domänbegränsad.
Begränsningen av modelltrafik är per serverprocess, inte en global kvot.

Kontroll hittills: 41 riktade API-/N1-tester gröna, Studio-bygge grönt och
riktigt Luna-svar verifierat i lokal webbläsarfixtur. N1-växling visar enbart
Adminroboten. D-ID accepterar produktionsdomänen och nekar testadressen;
verifiering av riktig avatar och produktionssidornas laddning återstår vid
publicering. Ingen ny D-ID-agent eller testnyckel skapades.

## Teaminbox: Jakobs laptop och stationdata, 13 oktober

`jakob-bgvp01j` adresserar Jakobs laptop och `jakob-dator2` Jakobs stationdata
via separata GitHub-etiketter. Båda tillhör Jakob; personregistret och
grenägarskapet är oförändrade. `tools/inbox.mjs register --device <alias>
--email <ChatGPT-mejl>` sparar datorns konto, värdnamn och automatiskt avlästa
reposökväg endast i gitignorerade `inbox/local-device.json`.

`list --to me` använder registrerad dator, annars den tidigare grenägaren.
Avsändarnamnet visar datorn; konto och sökväg publiceras inte i GitHub.
En profil från fel dator/sökväg stoppas med instruktion att registrera igen.
Regressionsprov täcker separata etiketter, gemensam personägare, båda datorernas
routning, profilbyte, felaktiga/kopierade profiler och meddelandets visningsnamn.
Verifierat: 12/12 inboxtester passerar. Laptopens lokala registrering och
gitignorering är kontrollerade; båda datorernas GitHub-etiketter finns och
`list --to me` läser laptopens inbox. Inget testmeddelande har skickats.
Full ordinarie kontrollkedja: 3 415 godkända, 11 skips, 0 fel i 72 grupper.
De versionslåsta beroendena i `packages/design-preview` behövde installeras
efter main-synkningen; inga beroende- eller låsfiler ändrades. Jakob har
uttryckligen godkänt leverans via `codex/inbox-devices` och PR-merge efter gröna kontroller.
Den andra datorn behöver synka ändringen och registrera sitt eget konto enligt
`inbox/README.md`. Ingen automatisk väckning eller bakgrundspollning införs.

## Roulette: Anna, alfametadata och MP4-bakgrund, 13 oktober

Integrerad med main `60defa57` inför PR92-granskningen. Endast denna handoff
behövde konfliktlösning; roulette- och Paow-sektionerna är båda bevarade.
Alfafixen, fixturen och den dokumenterade visuella målbilden behåller samma
omfattning. Denna integration ändrar inga mediefiler eller publiceringsval
utöver innehållet som redan finns på main. Full regression körs vid commit.

**Visuell återkoppling:** Jakob underkände den lokala spelarplaceringens
bordshöjd/perspektiv och dolda händer. Därefter godkände han den bifogade
stillbildens komposition som målbild (SHA-256 `f1039dd9…84c78`, 1673×901).
Exakt bilaga är bevarad privat och dokumenterad i
`docs/games/roulette/UTFALLSFILMER.md`. Önskemålet om cirka 25 grader är inte
en uppmätt kameravinkel eller en ytterligare rotation som ska läggas på
målbilden. Hjulsiffror, mask/passning och rörliga lager behöver färdigställas;
två tekniskt fungerande UI-spel är inte godkända rehearsal-spelningar.
Denna uppdatering ändrar bara dokumentation; bildkopians hash/storlek har
verifierats och dokumentationskontroller körs vid commit.

Fortsättning från mergad `6ee5d3aa` i `codex/roulette-anna-runtime`.
Publicerad preview tappade `compositing: {mode:'alpha'}`; den följer nu med
från fryst post. V2/v3, exakt byteväg och fortsatt spärr för blackjack-idle
i roulette är regressionsprovade. Ingen registrering eller publicering ändras.

Den befintliga `tools/roulette-ui-fixture.mjs` kan läsa en förhandsverifierad
lokal alpha-WebM, MP4-bakgrund och valfri strikt kompositions-JSON. Den kör
riktiga `/play/roulette`, scenrenderaren och roulettekommandot med SQLite i
minnet på 127.0.0.2. Fasta fixture-descriptorer ersätter enbart publicerings-
svaret. Det bevisar inte att Anna redan är registrerad/publicerad i produktion.

Annas andningsfilm (`02700429…1a34`, 897 456 byte) och tidigare gardinfilm
(`b08fdc4d…1854`, 3 455 652 byte) har visats tillsammans bakom produktens
roulettebord. Två efterföljande UI-spel återgick till öppna satsningar utan
omladdning eller loggade JS-fel. Privata hashkvitton, provplacering och
skärmbild finns i denna chats `roulette-stop`-artefakter. Detta är inte
acceptans av skarvar, poser, lipsync eller produktionens rumsbindningar.

Full ordinarie pre-commit: **3 329 godkända, 11 skips, 0 fel**, Node 24.21.0;
17 riktade preview-prov passerar. Underagentens läsande granskning hittade
ingen försämrad spelavgränsning. GitGuardian: 0 öppna/17 ignorerade incidenter,
aktiv övervakning, main-suite queued; historikskanningen är too_large och
platsmetadata delvis ofullständig. Inga incidentstatusar ändras.

Jakob har valt bort det fristående schematiska kulprovet för produktion.
Uppdaterad plan i `docs/games/roulette/UTFALLSFILMER.md` jämför Three.js och
den granskade CSS-baserade Gravity.js. Nästa steg kräver explicit sparat
roulette-idle, fryst kontrakt och readinessgrind; behåll `dealer:null` tills
hela bindningen finns. Registrering, native-frame-passning, godkänd
hjulimpuls/kulsläpp, en korrekt 37-facksrotor och serverns pending/reveal
återstår. PNG-nativeintag är fortfarande spärrat; README:s äldre påstående
är korrigerat. Inga nya betalda filmer, nya bibliotek eller live-writes.

## Paows talgrund och materialkontroll, 13 oktober 2026

**Två hela talförlopp har nu avslutats tekniskt i följd**, utan omladdning,
i riktiga `/play/blackjack?dealer=paow-v2&rehearsal=1` efter att PR #99:s
main `982d541f` verifierats live på Vercel och Render. Båda sade exakt
"Hej Jakob, välkommen tillbaka till mitt bord." och gav spelarens
`state: ended`, `completed: true`, tom felstatus och återgång till idle.
Bakgrund → dealer → bord var synliga i båda proven. Inga spelknappar eller
insatser användes.

| Prov | Request-ID | Svar redo | Talstart | Hela förloppet klart |
| --- | --- | --- | --- | --- |
| 1 | `18c930e8-6e63-457a-b1e3-c97b0f25c304` | 11,57 s | 15,65 s | 18,66 s |
| 2 | `dd6a1bdf-df4b-474c-9a24-8d9ab334f75e` | 5,92 s | 10,09 s | 13,27 s |

Ett föregående försök blev redo efter 78,48 s men avbröts vid flikbyte;
det räknas inte som ett lyckat prov. Periodiska statuspaket kom fram under
kallstarten. Prov 2 fångades komplett: 78 WebSocket-paket, 4 315 708 byte,
73 bildrutor, H.264 + AAC, 3,084 s. SHA-256:
`bf4ed6637249b3317c77c28f99ccba19110dcd5384f9d1685509c24fc9e3fc0a`.
Worker: 2 225 ms totalt, `input_wait: 0`. Prov 1 har spelarens slutkvitto
och skärmbild; nätverksfångsten hade stoppats, så ingen komplett MP4 hävdas.
Privata kvitton och media finns i Paow-chattens `paow-982d541f-*`-artefakter.

**Visuell/hörbar slutacceptans återstår:** båda kvittona har fortfarande
`reviewStatus: pending`. Detta bevisar teknisk uppspelning och lagerordning,
inte godkänd läppsynk eller perceptuell röstlikhet. Granska det fångade
klippet före roulette/rörliga body-dealers; ändra ingen godkännandestatus
utifrån hash, statistik eller enstaka skärmbilder.

PR #93 är mergad som `60defa57` och verifierades i den faktiska Render-
processen efter deploy. Fyra efterföljande talprov stoppades däremot före
uppspelning med `generated_speech_session_start_timeout`. RunPods befintliga
driftvy visade kall modellstart på 136 sekunder och förberedelse av vald
dealerbild på 64,7 sekunder; en observerad jobbtid fram till redo var cirka
112 sekunder. Den tidigare startgränsen på 90 sekunder räckte inte.

Starten får nu använda det befintliga förberedelsefönstret på 180 sekunder
i både fil- och SQL-journalvägen. Uppspelningens 45-sekundersgräns,
GPU-sessionens livslängd, reservationer och kostnadstak behålls. Avveckling
av gammal dealer får fortfarande högst 90 sekunder efter befintlig dränering.
Ingen automatisk ombeställning eller extra betald worker införs. Riktade
tester täcker lyckad start efter 135 sekunder, timeout vid 180 sekunder,
omedelbart avbrott och oförändrad avveckling: 49 godkända. Lab-bygge och
full obligatorisk regression på `52a0aa46` passerade: 3 348 godkända,
11 miljöberoende skips, 0 fel. Kallstart kan fortfarande överskrida
förberedelsefönstret; liveutfallet på den levererade fixen står ovan.

PR #99:s transportgranskning hittade dessutom Vercels gräns på 120 sekunder
utan data från extern backend. Den befintliga NDJSON-strömmen upprepar nu
bara aktuell offentlig status var 15:e sekund under väntan. Ingen extra
svarstext, media eller providerbeställning skickas. Långsam mottagare får
inga köade heartbeat-rutor; färdigt svar, fel, avbrott och stängd anslutning
städar timern. Befintliga ägar-/rund-/minneskontroller är oförändrade.
66 riktade chatt- och transporttester passerar. En riktig lokal HTTP-proxy
med tidsgräns provar lång förberedelse, nekad gammal ägare och avbruten
klient; utan heartbeat kapas samma prov. Testtiderna är skalade och använder
inga betalda leverantörer. Full regression på `c20de5ed`: 3 358 godkända,
11 miljöberoende skips, 0 fel. Liveproven ovan använder den verkliga
Vercel/Render-vägen; skalade transporttester ersätter inte visuell acceptans.

Fortsätt med den befintliga aktiva `paow-v2` (PAOW), inte den arkiverade
`paow`. Den sparade talprofilen återlästes från servern med ElevenLabs
`WZVEBKUreb9jAKojf0QF`, `eleven_v3`, svenska och egen referensvideo
`13d044b3-0582-4f8f-a754-75bb099a0237` vid 0 ms. Kontots röstuppslag
bekräftade Paow. Profilen är aktiverad; detta är inte ett visuellt godkännande.

Samma kompakta materialkontroll finns nu i Control och Admin. Främmande,
trasig eller inkompatibel referens kan inte aktivera AI-tal. Alfa kan sparas
som förberedelse, men den nuvarande GPU-vägen bevarar inte alfa. Inbakad
bakgrund nekas för tal. Gröna referenser får gröna utfyllnadsytor, så att
bakgrund, dealer och bord kan behålla sina separata lager. Filhash, ägare,
verklig avkodning, profilrevision och workerbindning kontrolleras fortfarande.

Två ostörda liveprov på main 6ee5d3aa startade med Paows referens men
avbröts av spelarens 45-sekundersgräns. Det korta provets worker gav 79
bildrutor/3,33 sekunder media, 42,81 sekunder totalt, varav 40,64 sekunder
väntan på ljudindata och 1,40 sekunder inferens. Redan förhämtat ljud
dräneras nu i högst 64 KiB i stället för leverantörens små transportpaket;
varje block behåller kontrollen av aktuell session och profil. Ingen väntan
på full buffert, förlängd timeout eller extra TTS-betalning införs.

Verifiering: 45 material/UI/FFmpeg-tester samt 32 strömtjänsttester godkända;
Lab-bygget godkänt. Full obligatorisk regression efter buffertfixen: 3 335
godkända, 11 miljöberoende överhoppade, inga fel (exit 0).
Två hela talförlopp och lagerkontrollen är nu tekniskt verifierade enligt
kvittot ovan. Röstens och läppsynkens visuella/hörbara slutacceptans återstår
före roulette/rörliga body-dealers. Inget klipp är godkänt enbart från hash,
workerstatistik eller en bild av munnen.

Paow använder gemensam GPU-tjänst med exakt dealer-/bild-/profilbindning
och den gemensamma OpenClaw-talagenten. Ingen separat instans behövs för
identiteten. Historiska Astrid-funktioner som samtalsminne, kamera och vissa
routningsregler är ännu Astrid-specifika och ska inte beskrivas som färdiga
för alla dealers. Rörligt tal enligt Emil samt diskret inandning/tal-idle
kommer senare, efter den verifierade stillbildsgrunden.

## Gatewayns monterade diskkatalog, 13 oktober 2026

PR #88 (db70999a) verkställde ägarbytet beständigt, men Render-deployen
dep-db73kps9v7es73ac7ms0 misslyckades efter uid/gid-kvittot och återställde
föregående instans. Docker USER root lämnar HOME=/root efter setuid. Ett
läsande jämförande CLI-prov som uid 1000 gav config validate exit 0 med
HOME=/home/node, exit 1 med HOME=/root och åter exit 0 med HOME=/home/node.
Bootstrappen sätter därför nu HOME=/home/node, USER=node och LOGNAME=node
efter verifierad rättighetssänkning, innan starter/CLI laddas. Fel rapporterar
endast en fast fas och allowlistad felkod, aldrig fria felmeddelanden, stigar,
konfiguration eller CLI-utdata. Det skiljer import, konfigvalidering och bundle
utan att röja hemligheter. 41 riktade tester passerade. Ett verkligt isolerat
Linuxprov verifierade rätt miljö även i barnprocessen och att root inte kunde
återtas. Ny Gatewaydeploy och startupacceptans återstår för denna rättning.

Efter #88:s beständiga ägarbyte lyckades ett ordinarie CAS-modellbyte via
Director: HTTP 200/saved=true och uttrycklig GET återläste connected/applied
samt croupier-operator=lab-provider/gpt-6.1-sol. Övriga fyra rollernas Terra-
modeller och samtliga fallbacks bevarades. Bekräfta samma värden efter deploy.

Det misslyckade operator-modellbytet nådde config.patch men nekades med
EPERM/fchmod. Läsande SSH med Renders officiella Frankfurt-hostnyckel
bekräftade /data/openclaw som uid=0, gid=1000, mode=2775; själva
openclaw.json ägs redan av 1000:1000 med mode=600. Byggnadens chown sker
innan Render monterar disken och kan därför inte ge katalogen rätt ägare.

Imagen startar nu en rootägd bootstrap som öppnar exakt mountkatalogen utan
att följa symlänkar, ändrar bara dess ägare/grupp till 1000:1000 och därefter
släpper grupper/gid/uid innan den befintliga starten importeras. Bootstrapens
föräldrakatalog ägs också av root; node kan inte ersätta bootstrapfilen.
Gateway, helper och konfigläsning körs som node. Ingen rekursiv chown/chmod,
konfigflytt, sessionradering, credential- eller modelländring införs. Direkt
start av Gateway som root nekas även om Dockerkommandot skulle åsidosättas.
Live Render-konfiguration har inget sådant kommandoöverskrivande.

37 fokuserade bootstrap/startup/runtime/handoff-tester passerade. Ett isolerat
Ubuntu/Node 22.22-prov återskapade en rootägd 2775-katalog och verifierade
uid/gid/ägare 1000, efterföljande chmod 0700, bevarade konfigbytes och ny
skrivning. Barnprocessen kunde inte återta uid 0; testkatalogen städades.
Det första deployprovet verifierade ägarbytet men upptäckte HOME-felet ovan;
uid/gid-kvittot ensamt är inte bevis för en lyckad Gatewaystart.

## OpenClaw-länk och webbläsarklocka, 13 oktober 2026

Efter #83 driftsatts gav både Director-provet och sajtens N1-POST HTTP 200
med giltiga länkfält, men klienten visade anslutningsfel. Klientens övre
tiominutersgräns jämförde Gatewayns sluttid mot webbläsarens egen klocka;
även en liten klockskillnad kan därför avvisa en nyutfärdad länk.
API:t skickar nu serverberäknad återstående giltighetstid. Klienten drar
konservativt av hela anropets monotona förloppstid och kontrollerar samma
fasta URL, fragment och tokenformat. Gateway behåller faktisk sluttid och
engångsanvändning; N1, CSRF och serverns utgångskontroll är oförändrade.
Rättningen kräver endast Verceldeploy, ingen ny Gateway/Director-deploy.
Tester täcker förskjutna klientklockor samt saknad, för lång och förbrukad
återstående tid. Verklig knappnavigering ska återprovas efter driftsättning.

Samma liveacceptans visade tom tabellinventering i Adminroboten: queryn läste
public/studio trots att migrationerna skapar croupier_game, croupier_auth och
croupier_studio. Den fasta allowlisten följer nu dessa tre scheman. Endast
tabellnamn/schema skickas, aldrig tabellrader eller SQL från användaren;
500-tabellersgränsen och markeringen för ofullständig inventering behålls.
Samordnaren verifierade samtidigt verkliga Sol 6.1-svar för N1 och Luna 6
för publik hjälp samt 401 för anonymt administrationsanrop.
Verifiering av rättningen: 47 fokuserade UI/API/runtime-tester godkända.

## OpenClaw direkt från N1, 13 oktober 2026

PR #83 är mergad som e57f28ef. /admin/ai/models och /control/openclaw visar
registrerade agentroller och deras skilda uppgifter; det är inte trafikstatistik.
Direktöppning använder aktuell N1-session → Vercel → Director → befintlig privat
helper på Gatewayport 18790 → den låsta OpenClaw-CLI:ns dashboard --json.
Endast dess kortlivade engångsbootstrap skickas till webbläsaren; CLI:ns gamla
lösenordsfält kastas bort. Varken nya credentials eller fria kommandon införs.
Native Gateway behåller lösenord, device-identitet och egen beständig
webbläsarsession. Sajtens logout återkallar inte den native-sessionen.

Samordnaren driftsatte e57f28ef på Gateway (dep-db72uq3l550s73ajlu9g),
Director (dep-db7300rrjlhs739ovtl0) och Vercel. Båda Render-tjänsterna har
autoDeploy off i workspace tea-d19jsa63jp1c73ch0sc0. Director och N1-POST
utfärdar giltig engångsbootstrap med HTTP 200; klientens klockkontroll rättas
ovan. Knappnavigering utan lösenord/terminal återstår efter denna rättning.

Livekatalogen innehåller nu gpt-5.4-mini, gpt-5.6-terra, gpt-6-luna,
gpt-6-sol och gpt-6.1-sol. Alla fem rollernas återlästa grundval är Terra.
N1-försöket att välja Sol 6.1 enbart för croupier-operator gav 503
openclaw_admin_save_uncertain. Gatewayloggen 13:34:38 visar nekad fchmod
(EPERM), och uttrycklig GET återläser Terra med applied=true. Ingen blind
omsändning gjordes och UI-utkastet återställdes. Filbehörighetsfelet utreds
separat; verkligt native-modellanrop är ännu inte verifierat. Adminrobotens
verifierade Sol 6.1-direktadapter är separat. Faktisk rolltrafik exponeras
inte av dagens begränsade admin-API; talrollernas modellval är oförändrade.

Verifiering: full hook 3 298 tester, 3 287 godkända, 11 miljöberoende skips,
0 fel. Admin/Studio-produktionsbygget passerade. 47 fokuserade tester godkända för N1/CSRF/revokering, fasta mål,
bootstrapvalidering, hemlighetsprojektion, helpergränser och UI-navigering.
Den officiella CLI:n verifierades via källan för låsta v2026.9.5; faktisk
browsernavigering återstår enligt liveacceptansen ovan.


## Adminrobotens N1-verktyg, 13 oktober 2026

Alla tre chattlägen kräver nu färsk N1-behörighet. Widgeten är dold före
kontroll och för utloggade/N2/N3; kontobyte tömmer samtal och granskning.
Snabbhjälpen använder fortfarande Luna 6, administration/OpenClaw Sol 6.1 High.
Modelldetaljer ligger under Detaljer. Befintlig privat/no-store, CSRF,
revisionskontroll och separat bekräftelse med exakt resurs-ID bevaras.

Robotens nya läsverktyg söker och bläddrar bland sparade dealers, material,
sammansättningar, mediaregister, bolag och rum. Högst tre läsningar per svar;
varje sida är begränsad och visar fortsatt offset/ofullständig täckning.
Blobregister betyder metadata, inte analys av själva videon. Databasnycklar,
lagringssökvägar, signerade URL:er, spelaruppgifter och fri SQL exponeras inte.
Nya granskade skrivningar: dealer.create samt media.rename/archive/restore/delete,
via samma native-API:er som Studio. Permanent klippradering gäller endast
berättigade arkiverade uppladdningar; frysta/aktiva/publicerade filer skyddas.
En ny dealer får tomma klippfack och läggs inte automatiskt till något rum.
Befintlig bolags-/rums-/material-/dealerlivscykel och Gatewaymodellbyte kvarstår.

Svar kan länka till godkända /admin-vyer, inklusive import för exakt dealer-ID.
Filval och uppladdning görs i importassistenten; chattrutan laddar inte upp filer.
Den separata dealer/import-grenen lägger till Skapa dealer och frigör sparade
rader från tiogränsen. Den bör levereras tillsammans med dessa navigeringslänkar.

Verifiering: 35 fokustester för N1, återkallad session under dataläsning, läsbudget,
projektrevision, arkivberoenden och filidentitet genom permanent purge.
Studio byggd. Ett verkligt Sol 6.1-formatprov med syntetiska uppgifter gav
dealer.create och importnavigation, utan någon dataskrivning. Isolerat webbläsarprov med syntetiska svar: dold N3, N1:s tre lägen,
svarets importlänk, konsekvensdialog samt N1→utloggad→N1 med tömt samtal.
Ingen produktionsdealer skapades, ingen fil raderades. Produktion kräver
merge/deploy och separat acceptans; mergearbetet ägs av nästa mergechatt.
Kanoniska AI-flödet ska uppdateras i docs/AI/scoutgaming-agentflode.md när den
pågående dokumentgrenen inför dess nu separat ägda filer.

## Adminroboten och separata chattlägen, 13 oktober 2026

PR #82 mergad som b76510af; GitHub CI och Vercel-preview godkända.
Modellanslutningen rättades i #85 och Sol 6.1/Luna 6 har svarat live.
Knappen finns på publik sajt,
admin/Studio, partner och spelarsidor. Scoutguiden använder Luna 6 och statisk
publik kunskap. Inloggad N1 kan välja Adminroboten eller OpenClaw med Sol 6.1/high.
Klippassistenten behåller sitt separata importflöde; dealerspelchatten och den
äldre Gatewayrådgivaren är egna flöden.

Vercel kör webbchatten och kontrollerar aktuell N1-session. Adminroboten läser
avgränsade inventarier från Studio/Neon: dealers, material, sammansättningar,
bolag, rum, tabellnamn och aggregerad spelstatus. Listor anger begränsning och
saknad täckning. Inga kontouppgifter, nycklar eller mediebytes går till modellen.
Via befintlig Director på Render läses Gatewaystatus och modellkatalog.
OpenClaw-läget kan föreslå modellbyte för en befintlig roll till en katalogmodell.
Renderkontots loggar/diskfiler, nya Gatewayverktyg, fri SQL och
bakgrundsövervakning är inte anslutna. Ingen generell molnkontobehörighet tilldelas.

Vercel-production för #82 är nu READY och befintlig N1-inloggning visar de
interna chattlägena; oinloggat adminanrop ger 401. Adapterrättningen använder
sajtens befintliga OPENAI_API_KEY för officiella OpenAI-API:t när separat
modellnyckel saknas. Opt-in och explicit separat nyckel behåller företräde.
Riktade prov kontrollerar att nyckeln aldrig följer med till en egen API-bas.
Modellsvar ska verifieras efter adapterrättningens deployment.

Tillåtna förslag: arkivera/återställa dealer, material, bolag eller rum; öppna/
stänga rum; namnbyte på dealer/material/sammansättning; separat permanent
radering av redan arkiverad dealer; Gatewaymodellbyte. Varje skrivning kräver
serverförhandsvisning, inmatat mål och aktiv kryssruta i ”Är du säker…”-dialog.
Signerad femminutersbekräftelse binds till session, mål, exakta ändringar och
beroenden. Aktuell behörighet/revision kontrolleras igen; ursprungliga API:ers
transaktioner, revisionskontroller och medieskydd gäller. Ändrad filinventering
stoppar permanent radering även vid kontrollen inne i borttagningsflödet.
Historik hålls enbart i sidans minne och töms vid kontobyte eller lägesbyte.

Verifierat: full lokal precommit-regression, riktade behörighets-/livscykelprov,
admin/lobby-byggen och Studio Next-produktionsbygge. Isolerat webbläsarprov
bekräftar dialog, spärrad knapp, syntetiskt kvitto och rensning vid utloggning.
Riktiga syntetiska modellprov genom lokal leverantör gav svar från både
Sol 6.1 och Luna 6; det verifierar inte Vercels produktionskonfiguration.
Status-only läsning av levande Gateway gav OpenClaw 2026.9.5, ansluten, och
alla fem roller på lab-provider/gpt-5.6-terra; inget livebyte gjordes.

Jakobs städriktlinje använder nu rotens gitignorerade arkiv/ som kanonisk
reservplats; den ersatta assistentbubblans källfil ligger där med ursprunglig
sökväg. En tom markör versioneras, inget arkivinnehåll.

Kvar: PR-granskning/merge, deployment och liveprov av N1, alla sidytor,
Studio-konfiguration samt aktuella Gatewaymodeller. Ingen migration behövs.
TalkingHead avvaktar: kompatibel riggad GLB och tal-/läppsynkkoppling gör det
till en separat integration, inte ett enkelt inkopplat ansikte.


## Tillägg 13 oktober: Admins navigering och delade funktioner

`/admin` är huvudspåret för N1. Sidval, menyer, ekonomi och tjänstepaneler
använder nu riktiga Admin-adresser även internt. Den lilla adaptern för gamla
designlänkar finns kvar och hanterar också query/hash på rotadressen.
Bakåtnavigering behåller fragmentet när ett pågående utkast stoppar sidbytet.
Registrerade dealer-, rums-, sammansättnings- och importlänkar öppnar Admin med
befintliga bolags-, rums-, dealer-, spel- och sammansättningsidentiteter.

Bolagets teameditor, skapande/publicering av spelrum och riktig rehearsal
saknar fortfarande fullständiga Admin-ersättningar. Dessa länkar är tydligt
märkta som äldre editor/vy och bevarar kontext. De är kompatibilitet under
övergången, inte mål för ny UI-utveckling. PR #73:s spelval, rumsfiltrering
och tillgängliga rumspapperskorg är bevarade.

Gemensamma talmallar och kompatibilitetsregler ligger i
`web/public/studio-speech.mjs` med delade typer. Servern importerar därifrån
i stället för från Admins designpaket. Text, röst, mallrevision och
medievalidering är oförändrade; inga medier, godkännanden, databasrader,
publiceringar eller providerinställningar ändras. `lab/lib` innehåller
fortfarande aktiva delade tjänster och får inte raderas utifrån mappnamnet.

NativeAdministration har ett inbäddat läge för Admin. Där används hela
föräldrabredden utan den äldre sidans centrering, extra sidpadding eller ett
nästlat `main`-landmärke. Fristående Control behåller sitt befintliga skal.
Admin tillhandahåller dessutom avgränsade temavariabler och knapp-/rubrikstilar
för återanvända Studio-paneler. Mobilens rubrik och åtgärder ligger på separata
rader så den äldre tvåkolumnslayouten inte trycker ihop rubriktexten.

Verifierat efter integration med main `fd0e315`: Studio-produktionsbygge och
94 byggspår, Admin/Lobby-typkontroll och slutligt designbygge passerar.
14 kontroller av kompilerad navigering, 16 Chromium-flödesprov med isolerade
API:er på desktop/mobil samt två slutliga layoutprov passerar. Konto-/temavy,
kontext, utkast, veto och Back är kontrollerade; inga produktionsskrivningar.
Full regressionshook gav 3 238 godkända, 7 villkorade skips och ett miljöfel i
oförändrade `local-session.test.mjs`: aktuell process saknar OS-startidentitet
i denna körmiljö. CI på vanlig runner behöver verifiera det. Testspärren är
oförändrad. Loopbackproven kördes utan miljöproxy för 127.0.0.1/127.0.0.2.
Inkommande CI-planerares fyra tester och kontrollen av 377 testfiler passerar
(0 föräldralösa); diffkontrollen passerar. GitGuardian-suite på senast lästa
main är queued; incidentlista och övrig API-/historiktäckning är inte lästa.
Detta är en UI-/beroenderättning; den är inte en genomförd avveckling av
Control eller ny produktionsacceptans av Astrids tal och video.

Mergeagenten har integrerat main `40fc0d83`, inklusive #77:s mappguider
och #78:s rumsval/mallskydd. Kod och båda utökningarna av administrationens
regressionstest gick ihop utan manuell kodändring. 168 riktade tester
passerar på kombinationen; systemkartan och orphan-kontrollen är godkända.
Första integrerade GitHub-körningen hittade ett dolt testberoende:
Admin-fixturens JSX-runtime laddades från designpaketets ännu oinstallerade
beroenden. Testladdaren använder nu samma React-runtime som Lab-renderaren.
Felet reproducerades utan designpaketets node_modules; efter rättningen
passerar alla 1 856 Lab-prov (två plattformsskips) i det läget. Inget test
tas bort och inget extra produktionsbygge krävs. Full CI körs på rättningen
före merge.

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
är föräldralösa. PR #78 är mergad som `40fc0d83` efter grön full CI
(`38394400537`), GitGuardian och Vercel på `5963f4c`. Slutträdet matchar
exakt den granskade versionen.

## Återställbar lokal tröskelarkivering, 13 oktober 2026

Efter en lyckad lokal projektsparning arkiveras de äldsta återställningskopiorna
när `lab/data/history` passerar 100 filer eller 64 MiB. Efter en avslutad
observationsinspelning gäller 20 sessioner eller 128 MiB för
`lab/data/observations`. Minst de två nyaste objekten behålls även om deras
storlek överstiger gränsen; förhandsvisningen redovisar det. Ändra gränserna i
`tools/retention-policy.json`. Ofärdiga inspelningar utan `session.json` lämnas
kvar. Okända filer, länkar eller avvikande sessionsinnehåll tas inte med.

`node tools/retention-archive.mjs` förhandsvisar utan skrivning. `--apply`
flyttar till `arkiv/<datum>/retention-<id>/<ursprunglig-sökväg>`. Manifestet
skrivs före flytten och innehåller sökvägar, byteantal och SHA256, så även en
avbruten flytt kan återställas. `--restore arkiv/<datum>/retention-<id>`
kontrollerar återställningen; lägg till `--apply` för att kopiera tillbaka.
Befintliga mål skrivs aldrig över, kontrollsummor verifieras och arkivet
behålls. Låsningen tillåter endast en arkivering/återställning åt gången. Ett
kvarlämnat `arkiv/.retention.lock` ger ett tydligt busy-fel; kontrollera att
föregående körning avslutats innan endast den tomma låskatalogen tas bort.

Automatiken gäller bara denna checkouts kanoniska lokala `lab/data` och
misslyckad arkivering stoppar inte en lyckad projektsparning. Den berör inte
Vercel, Neon, Blob, Gatewayloggar, aktiva verksamhetsrader, publiceringshistorik,
video, konton eller spelarminne. Adminrobotens nuvarande webbhistorik sparas
bara i minnet och har ingen beständig logg att rotera. Ingen schemalagd tjänst
eller molnmutation införs. Arkivet är privat och Git-ignorerat, frigör inte
diskutrymme och behöver ingå i egen extern säkerhetskopiering.

Verifiering: Studio-produktionsbygget och fullhook passerar (3 348 tester, 3 337 pass, 11 skip, 0 fail). Riktade isolerade tester täcker gränser, aktiva inspelningar,
bytebevarande återställning, avbruten flytt, samtidighetslås, ändrade arkiv,
sökvägs-/länkskydd och failsoft. Ingen verklig sparad data har flyttats i QA.

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

## Delad Studio-autentisering, 13 oktober 2026

Inloggningskontroll, roll-/åtgärdspolicy och det lilla scope-/felkontraktet
ligger nu i `packages/studio-access`. Spelservern och Studio använder samma
implementation; äldre `lab/lib`- och lagringsimporter återexporterar samma
funktioner och felklasser. Auth-modulen laddar inte längre Studio, OpenClaw
eller lagringsimplementationer. Cookies, signaturer, aktuell identitet, epoch,
behörigheter, scope och säkra felkoder är oförändrade. Övriga media-,
publicerings- och OpenClaw-kopplingar finns kvar. SQL-QA-kvittots källista
omfattar även de flyttade implementationerna; Astrids jämförelsearkiv tar med
scope-modulen utan att ändra eller skriva om den godkända baslinjen.

`web/README.md` beskriver Vercel under Scout Gaming, Render-spelmotorn,
Neon för produktdata och Blob för media. Den gamla diskkommentaren vid
`/labb-lissabon` är rättad; redirectens beteende är oförändrat. SQLite-kod
betyder inte en parallell produktionsdatabas eller fallback vid PostgreSQL-fel.

86 riktade tester och Studios produktionsbygge inklusive typkontroll och
95 byggspår passerade. Oberoende kodgranskning fann inga blockerande fel.
Full lokal regression gav 3 334 passerade och 7 överhoppade tester innan den
stannade på det oförändrade `local-session.test.mjs`: körmiljön ger ingen
OS-födelseidentitet för processen. Samma miljöbegränsning fanns vid föregående
PR; kontrollen har inte försvagats. Astrids baslinje och arkivkontroll passerade.
Separat PR från `main`; inget mergat och ingen produktionskonfiguration eller
databas ändrad. GitHubs fulla PR-kontroller passerade för `7dcd61f`.
Merge-agenten har flyttat detta avsnitt till mappansvaret för att lösa en
ren dokumentkonflikt; autentiseringens kod och exports är oförändrade.
95 isolerade auth-, scope-, partner-, kommando- och lagringstester passerade
med Node 24.21.0 och fyra testworkers. Den nya versionens CI ska passera före merge.

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

## Selektiva blackjackförbättringar från Kevin, 13 oktober 2026

**Aktuell PR91-kodägare, 14 oktober: SAMORDNING.** Den befintliga branchen
`codex/kevin-blackjack-safe` har integrerats med main `9836ca6f` i egen
arbetskopia `pr91-integration`. Konflikterna är lösta med senare givkontroll,
kortvy, dynamisk dealeretikett och alla ordinarie tester bevarade. Ljud och
dealerreplik använder nu samma positiva nettovinst som rundnotisen; en vinnande
delhand ger inget rundfirande om totalen är negativ eller noll. Filmens hårda
tidsgräns följer inspelningskontraktets 120 sekunder med åtta sekunders
startmarginal; progressvakten och ägaravbrott behålls.

Verifierat med Node 24.21.0/fyra lokala workers: 107 fokuserade prov passerar,
inklusive verklig settlement-kods ljud/replik och simulerad 120-sekundersfilm.
Studio-bygge och 97 byggspår passerar. Första integrationens ordinarie pre-commit: 3 781 pass,
12 uttryckligt villkorade skips, 0 fel/cancel i 77 grupper. De första försöken
saknade två låsta beroendeinstallationer i arbetskopian; gateway-/frontend-
beroenden kopplades därefter från exakt matchande paket och lockfiler.
Inga obligatoriska kontroller har försvagats.

Jakob godkände återupptagna isolerade spelarprov den 14 oktober. SAMORDNING
har nu provat den verkliga spelaren från kodhead `542e98b2` på separat
Vercel Sandbox-host med Node 24.14.1, minnesdatabas, spärrad utgående trafik
och utan produktionsnycklar. Samma session genomförde förlust, vinst, push
och split med serverstyrda kort och separata testsaldon 9 995 → 10 000 →
10 000 → 10 010 EUR. Alla 15 spelkommandon gav HTTP 200. Desktop 1440×900
och mobil 390×844 användes; push och split slutfördes i mobilvyn.
Astrids befintliga hälsningsfilm spelades två gånger i följd med ljud aktiverat,
normal hastighet och full längd 4,958333 s. Ett framkallat pausavbrott återhämtade
sig från samma position utan seek, ändrad hastighet eller avstängt ljud.
Inga mediefel registrerades. Detta verifierar Astrids del av PR91,
inte ny mänsklig läppsynksbedömning eller acceptans av andra dealers/nya takes.
Dragan-provet kvarstår före merge. Jakob har godkänt Swedish Games publicerade
blackjackpaket v4 för isolerat prov: 36 filmer och två lagerfiler har kopierats
och hashverifierats lokalt. Automatisk säkerhetsgranskning kräver därutöver
uttryckligt godkännande för privat spelarkod i den tidsbegränsade Vercel-miljön.
Ingen spelarkod har överförts i detta försök; den tomma sandlådan är stoppad.
51 befintliga bankfilmer och 197 publika resurser kopierades med hashkontroll;
originalmedier, produktionsdata och betald generering ändrades inte.
Slutlig kodintegration hade ordinarie pre-commit 3 794 pass, 19 uttryckligt
villkorade skips och 0 fel i 77 grupper; bygg-/kodproven ovan är återanvända
för oförändrad kod. Egna fyra beroendejunctions är borttagna. Sandlådan är
stoppad och provfliken stängd. Privata JSON-kvitton/skärmbilder finns i
Codex visualiseringar för denna samordningschatt och serverkvittot i
huvudcheckoutens `lab/data/platform-private/main-sync-20261014/`.
Städning, 14 oktober: `ops/vercel-entry` är redan pensionerad i `b621c760`,
saknar aktiva processreferenser och hade bara lokala preview-/byggrester kvar.
Den katalogen och den tomma, ospårade `e.id` har flyttats återställbart till
`lab/data/platform-private/cleanup-20261014/` i huvudcheckouten; kvittot är
privat och Git-ignorerat. Aktiva Kevin-komponenter, originalfilmer, kollegors
grenar och #91 bevaras. Ingen produktionslagring har raderats.

**Historisk ursprungskontroll, 13 oktober:** utgick från main `6ee5d3aa` och
Kevins `f15b2af1`. Återhämtningen i
`local-film-player.mjs` anpassar Kevins `playback-recovery.js`: en synlig,
webbläsarpausad film återupptas i samma videoklocka. Förlorat `ended` hanteras
bara efter startad och faktiskt presenterad bild. Avbrutna ägare återupplivas
inte; lyssnare städas vid slut/fel/avbrott. Befintlig avbrytning när sidan
döljs består. Ingen köpost hoppas över, ljud mutas inte som reserv och
video-/kortkalibrering ändras inte.

Kevins vinstfeedback och handvärdesetiketter är anpassade till befintliga
serverkvitton: vinstnotiser använder positiv nettovinst efter insatser,
sidospel och försäkring. Återbetald insats är ingen vinst. Bruttoåterbetalning
visas fortfarande i avräkningen och under `LAST RETURN`. Båda kortrenderarna
visar mjuka värden som `7/17` men färdig `21` en gång. Saldo, spelregler och
utbetalningar är fortsatt serverägda. Ingen gemensam bordsmodell, ny
VILA/REDO-sekvens, dealerhårdkodning, talprovider eller medieimport ingår.

Vercel-inspektion på team/projekt `scoutgaming` visade READY-produktion på
`6ee5d3aa`, `CROUPIER_DATABASE=postgres`, Neon-policy och Blob samt backend
`croupier-v2.onrender.com`. Kvarvarande SQLite-kod innebär inte två aktiva
produktionsdatakällor. Vercel driver webb/Studio, Render spelauktoriteten,
Neon datalagringen. Denna leverans läser inte live-Render-konfiguration
eller databasinnehåll och ändrar inga miljövärden.

Verifierat: Studio-/designbygge, 82 riktade prov och 18 isolerade Chromiumfall
för 2–4 splithänder på desktop/mobil, utan överlapp efter etikettjustering.
Två uppspelningar genom verkliga `PerformancePlayer.playLocalClip` gav
79 presenterade bildrutor vardera, ingen seek/tappad ruta och bevarat
ljudläge/hastighet vid pausåterhämtning; andra filmen använde förberedelsen.
Inga konsolfel. Full ordinarie hook: 3 345 godkända, 7 skips, ett fel i
oförändrat `local-session.test.mjs` (OS-startidentitet saknas i denna
arbetsmiljö; reproducerat separat med oförändrad sessionsmodul). Lokala
rouletteprov passerade när 127.0.0.2 lades till testmiljöns NO_PROXY.
GitHubs fulla CI passerade för `0a55edd`. Merge-agenten har bara flyttat
detta avsnitt för att lösa en dokumentkonflikt; spelarkoden är oförändrad.
Ny CI och de registrerade spelarrepetitionerna återstår. Ingen grind har försvagats.

Komponentprovet använder exakt hashkontrollerad film men ersätter inte två
repetitioner i ett registrerat publicerat rum eller läppsynkacceptans.
PR lämnas som draft för den återstående spelarrepetitionen, utan merge
eller produktionsrelease. Inga nya visuella mediegodkännanden registreras.

## Tillägg 13 oktober: separat rouletteklippkarta

`/admin/clips` har egna flyttbara roulettekort, exakt spel-/dealerfiltrering
och VILA→idle-reserv i editorpreview. VILA-PNG är ett lokalt prov, inte native
lagring. MP4/WebM registreras i befintliga roulettefack; framtida fack
markeras utan falska bindningar. Blackjackens talpanel och `idle.ready`
används inte för roulette. Samma person och bakgrund får fortfarande delas.

Bord har oföränderlig speltyp genom uppladdning, utkast, paket och publika
media-GET. Runtimekapabilitet v13 krävs för spelmärkta bord; ingen SQL- eller
livemigrering ingår. Omärkta äldre bord behandlas som blackjack och exponeras
inte för roulette, medan historisk rumstillgång bevaras. Tre lager stöder
bild/video i editor. Roulettespelaren väljer dessutom publicerat bord som
bild eller videoloop, med publicerad geometri och utan prototypens mask.
Se [materialinventering och signalflöde](games/roulette/KLIPPKARTA.md).

Senare materialkontroll samma dag: levererade filmer och VILA-PNG är identifierade
med hash. PNG ligger under croupier/idle, inte bord/videos. Eyes-filen är tidigare
underkänd opak glasögon-v1; rätt v2 återfanns och kopierades separat, med faktisk
alfa i samtliga 241 rutor. Originalen är orörda. Ett privat schematiskt prov klarar
37 mål × tre varianter och exporterad WebM; jämförbart tvåsekunders ROI-prov är
182 381 byte mot helbildens 382 128. Det är ingen fotorealistisk bank eller
spelacceptans. [Utfallsplanen](games/roulette/UTFALLSFILMER.md) ersätter kravet på
37 stora filmer med gemensamt hjul + separat kula/korta avslut, och dokumenterar
att dagens API avslöjar resultat/saldo före filmen. Serverstyrd pending/reveal
samt korrekt hjul och kulsläppskalibrering återstår. Ingen betald generering
eller plånboksändring gjordes.

Fortsättningsplanen finns nu i samma utfallsdokument: verifierat intag först,
korrekt rotor, lokal OpenCV-baslinje och vid behov YOLO/SAM 2 för kalibrering
och masker. Analysen föreslås ske en gång per källhash; inga nya modeller har
installerats eller benchmarkats. Officiella källor och en specialistfråga är
sparade. Det privata kulprovets exakta renderarskript finns också i Git som
`docs/games/roulette/underlag/roulette-stop-test.html`, utan privata filmberoenden.
Ett separat lokalt intagspaket mappar VILA, andningsvila och rätt glasögon-v2
med låsta hashvärden; det portabla underlaget sparas i samma dokumentmapp.
33 isolerade kontroller passerar, inklusive två byteidentiska WebM-intag och
förväntad PNG-spärr före grant. Alla 241 rutor i båda WebM har avkodad alfa.
Paketet är inte live-registrerat och saknar avsiktligt verkliga dealer-/media-ID.

Återstår: fryst roulettebank för dealerhandlingar, 37 servervalda utfall,
engångsuppspelning/synkronisering, separat talset och visuell acceptans med
två spel i följd. Ingen privat originalfil har flyttats eller godkänts,
och ingen produktionsdata, publicering eller provider har ändrats.

Verifierat: fokustester för roulettekort, native metadata, spelavgränsade
bord, offentliga media-GET, lokal VILA och publicerade scenbord passerar.
Admin/Lobby-typkontroll och designbygge passerar. Isolerad browserfixture
visar separata blackjack-/roulettekort och lagerpanelen utan produktions-API.
Full regressionshook passerar: 3 275 godkända, 11 villkorade skips, inga fel. Studio-produktionsbygget och 94 byggspår passerar också. GitGuardian 13 oktober: 0 öppna och 17
ignorerade incidenter i läst källa; övervakning aktiv, main-suite queued,
historikskanning `too_large` och platsmetadata delvis otillgänglig.

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

## Tillägg 13 oktober: ägarkontroll före agentmerge

`AGENTS.md` kräver nu aktuell PR-författare, källrepo, branchägare och fryst
head före varje agentmerge. Jakobs generella mergeuppdrag gäller hans egna
PR:ar. Kevin-/John-/Emil-brancher, annan författare eller okänd ägare kräver
en tydlig separat fråga med PR och head, även när Jakobs konto öppnade PR:en.
Ett redan givet direkt godkännande gäller samma oförändrade PR/head.
Detta är en agentregel; GitHubs vanliga mergeknapp får ingen egen popup.
Vid inventeringen hade GitHub 47 brancher, varav 39 sidobranchers commits
fanns på main. Automatisk branchradering var avstängd. Ingen fjärrbranch
eller GitHub-behörighet har ändrats genom denna inventering.

### Läsande röst- och läppsynkjämförelse

Jämförelsen är fryst på main `54522581`, Kevin `f15b2af1` och
Kevin-staging `73897d4a`. Kevins Dragge/Paow-karta i
`kevin/croupier-scoutgg/server/dragge-voice.mjs` anger originalklonerna
`7f95xPL4S3ySZ4OS1pw8` respektive `WZVEBKUreb9jAKojf0QF`.
Dragge använder `eleven_multilingual_v2` med stability 0,5, similarity 0,85,
style 0,15 och speaker boost. Paow använder `eleven_v3` för svenska
(stability 0,5, similarity 0,85, speaker boost) och annars v2
(stability 0,38, similarity 0,8, style 0,3, speaker boost).
Koden normaliserar ljudet till -16 LUFS; transporten är PCM s16le mono 24 kHz.
Astrid på main använder Cartesia/Victoria, inte dessa ElevenLabs-kloner.
Staging-katalogen anger uttryckligen att Mårten saknar röst och inspelade
repliker; han är dold publikt och finns inte i den dynamiska röstkartan.

Kevins stagingväg spelar läppsynk över rörliga klipp: 24 fps, tagning/ruta
och läpprektangel, 0,22 s ljudförsprång i kartan och 0,5 s H.264-fragment.
Den separat hänvisade staging-workern kunde inte läsas med vår
GitHub-anslutning (404); dess implementation och image är inte verifierade.
Kevin har också en alternativ alltid varm pod utan vår 60-sekunders
inaktivitetssläckning. Det är separata drift- och spelarkontrakt.

Main använder den gemensamma kompositorn och videons ljudklocka, utan separat
tidsstyrt munlager. Dealerprofiler har egen provider/röst/modell/språk/tuning
och hashbunden videoreferens. Aktivering kräver en stillbildsreferens,
serverägda profil-/bildrevisioner och worker-attestering med protokoll 3;
en motion-video-kandidat i Studio är inte aktiverat stöd för stagingvägen.
Paows språkberoende modellbyte följer inte automatiskt med från Kevin.

24 isolerade profil-/runtime-/ElevenLabs-tester passerade. De använde mockad
leverantörsaccess, inte betald TTS eller visuell läppsynkacceptans.
`ENVIRONMENT-VARIABLES.md` anger, från kontrollen 12 oktober, Kevins Pro-
workspace som driftens originalröstkälla och avstängd dealerprofilaktivering.
Det är dokumentation, inte färsk live-verifiering: Render CLI läste tjänstens
metadata, men SSH stängdes innan flagg-/röstläsningen kördes och Render-MCP
svarade INVALID_ARGUMENT. Namnsökning i ElevenLabs-kopplingen gav andra
röster och bevisar inte åtkomst till originalklonerna. Nycklar, flaggor,
media, GPU-jobb och produktion ändrades inte.

Efter Jakobs uttryckliga godkännande 13 oktober raderades 38 mergade
featurebrancher via GitHub API efter ny head-/ancestrykontroll. Kevin,
Kevin-staging, John, Emil, parkerade och pågående brancher bevarades.

## Kompakt gemensamt röstval, 13 oktober 2026

Eget worktree från main b76510af, integrerat med 0e420ad4. Admins befintliga Röst & tal och Controls
Röst och läppsynk använder samma kontrollerade väljare. Ingen ny sidomeny.
Offentliga original-ID:n och Kevins tuning finns i
`web/public/dealer-voice-catalog.json`: Dragge 7f95xPL4S3ySZ4OS1pw8
(multilingual v2), Paow WZVEBKUreb9jAKojf0QF (v3 för sv, annars v2).
Astrid/Victoria hämtas från befintlig kanonisk Cartesia-profil.

Jakobs uttryckliga Paow/Dragge-parning förväljs nu när ID eller namn matchar
entydigt och sparad röst saknas. Andra eller motstridiga namn får inget förval.
Exakta värden fylls i utkastet; egna sparade röster
och referenser bevaras, ingen befintlig profil migreras. Modell, ID
och tuning ligger under Detaljer. Talbiblioteket är hopfällt. Oförändrad egen
referens kan behållas vid enbart röstbyte; nya bytes eller ny talaktivering
kräver referensgranskning. Serverns ägarskap, hashvalidering, CAS och
providerverifiering är oförändrade. Inga nycklar, flaggor eller media ändras.

Verifierat: 55 UI-/profil-/navigationsprov, 37 runtime-/providerprov, full
ordinarie precommit, Admin- och
Studio-byggen, typkontroll och isolerad Edge-fixtur med de verkliga
komponenterna på desktop/mobil. Fixturen förväljer Paow, växlar SV/EN och sparar
exakt profil utan provideranrop. Detta är inte betald TTS/GPU eller visuell
läppsynkacceptans. GitHub CI krävs före merge.

Runtimegränsen är viktig: generisk registrerad dealerström finns, men
roulettevyn saknar dealerchatt. Nuvarande chattautorisering kräver blackjack
och läser blackjackrundan. Roulettes publicerade scen är en tyst idle-spelare.
Full rouletteparitet behöver en serverägd roulettechattkontext, samma
bundna strömticket/avbrytning och integrering i scenens gemensamma kompositor.
Det får inte lösas genom att skicka blackjackkontext eller lägga ljud på en
fortsatt idle-loop. Rörlig body-läppsynk och protokoll-3-worker i drift
behöver fortfarande verifieras med exakt dealerreferens och två spelningar.

### Nästa steg enligt Jakob, 13 oktober

En egen granskad referensbild är reservläget för tal. Börja med en dealer:
verifiera röståtkomst, den driftsatta protokoll-3-workern och två fullständiga
talprov i den gemensamma spelaren. Därefter kopplas roulette till sin egen
serverägda rum-/paket-/rundkontext och samma avbrott/ljudklocka.
Rörlig body-läppsynk ska portas nära Emils exakta metod i en avgränsad adapter,
utan ändringar i spelregler eller ekonomilogik. Den hänvisade workerkällan
`EmaCodeHero/croupier-lipsync-worker` gav fortfarande 404 med befintlig
GitHub-åtkomst den 13 oktober; tillgång, exakt revision/image och protokoll
behövs före portningen. En separat installation per dealer krävs inte av
den generiska bildvägen; aktuell molnreläkonfiguration begränsar dock till
en worker/session åt gången, så fler samtidiga samtal är en separat uppgift.

Underlag att skapa per dealer: vald referensbild, diskret inandningsövergång
på högst cirka 0,5 s, rörligt talunderlag med små neutrala kroppsrörelser och
återgång till idle. Talunderlaget måste synkas mot den faktiska repliken;
en fristående kroppsslinga får inte ersätta den synkade talvideon. Alla
nya takes behöver exakta hash-/bildindex-/kalibreringskvitton och visuell
acceptans. Dessa steg är planerade, inte genomförda av röstväljar-PR:en.

## Anna som lobbydealer, 13 oktober 2026

Lobbyregistret har ett femte dekorativt porträtt, Anna, med Jakobs oförändrade
anna.png och anna.mp4. Samma porträttkomponent ger stillbild, tyst kortvideo,
reducerad-rörelse-stöd och låst förhandsvisning före bolags-/rumsval. Gridet
rymmer fem kort på bred skärm. Anna matchas endast mot exakt registrerat
dealer-ID anna; bilden registrerar ingen person, publicerar inget rum och
ger inga nya spelbehörigheter. Ingen namngissning eller automatisk upplåsning.

Identiteten kan finnas i både blackjack och roulette, men valt publicerat
rum bestämmer spel och startlänk. Lobbyvideon lagras separat under
packages/design-preview/lobby/public och förs inte in i spelens klippbanker,
scheman, speech-profiler eller publiceringar. PR #84 äger den separata
utbyggnaden av spelmärkta filmfack och materialspärrar; inga av dess källfiler
ändras här. PR #84 mergades under arbetet och ingår nu via main 6ee5d3aa; produktionsacceptans är separat.

Originalkontroll: PNG 2 019 747 byte, SHA256
3b5f263126c9dfbe151f322ddea764aa027f90000f76577616a6b11d74e3d904.
MP4 2 896 687 byte, SHA256
e97f6cb18bf24389e68fdf8c36c9ba1b2e5835f5712e9d34e430e56a9c192d1c;
H.264, 1440×1440, 24 fps, 4,04 sekunder, utan ljudspår.
Studio-/designbygget och 17 riktade lobbytester passerar. Isolerad
webbläsarfixtur verifierar fem låsta kort, upplåsning enbart för publicerad
Anna, rätt startlänk för båda spelen, två avslutade porträttuppspelningar och
mobil utan horisontell överströmning. Detta är lobbyacceptans, inte ett prov
av Annas framtida spelklipp eller produktionspublicering. Ingen livekatalog,
databas, spelregistrering eller modellkonfiguration ändras. PR:ns kontroller
anger slutlig full regressionsstatus; merge/deploy görs inte i denna uppgift.

## Samlad Admin, dealers och import, 13 oktober 2026

Admin återanvänder de befintliga editorerna för bolag/team, rum/publicering,
sammansättningar, dealerinställningar, klipp/svar, material, provspelning,
händelser, Probe, dealeragent och guide. Verktyg samlar dem i Admins meny.
En explicit dokumentmappning leder gamla Control-länkar till Admin och bevarar
kontext; API:er, inloggning och lösenordslänkar behåller sina kontrakt. Osparade
editorer lämnas via full dokumentnavigering så deras befintliga skydd fungerar.
Admins läsadapter finns under det befintliga skyddade `/studio/api/admin`.
Inget nytt datalager eller schemasteg införs. `lab/` förblir aktiv källa och
`/studio` API-monteringen; Control-filer behålls för övergång/återrullning men
ingen av de inventerade fungerande verktygsvyerna kräver Control i native drift.

Byggspårningsskyddet skiljer nu på privata filer i projektet och `.codex` i
worktreens överordnade sökväg. Det bevarar riktiga serverberoenden samtidigt
som miljöfiler, lokalt tillstånd och råa dealermedier fortfarande utesluts.

`/admin/dealers` är egen menyrad med skapa, ladda upp, ta bort och en hopfälld
papperskorg för återställning. Dragan kan väljas direkt även utan rum. N1:s
klippkarta kan också öppna registrerade dealers utanför vald rumsmall; den
visar skillnaden och ändrar inte tillåtna dealers förrän mallen uttryckligen
redigeras. Dolda röstformulär föreslår inte längre osparade värden innan de öppnas.

**Kopplingar** visar bolag → spel → rum och mallens bakgrunder, dealers och bord.
Gemensam mallredigering visar samtliga berörda rum. Rumsbundna val använder
den befintliga scoped-writern. Skapande använder N1-projektets CAS; borttagning
använder serverns konsekvenskontroll, revision och token. Klippkategorier följer
med i dealerTrash-snapshot och återställs med identiteten. Både kategorilänkar
och media ändras i samma befintliga SQL-transaktion. Ett injicerat mediafel efter
projektskrivningen verifierar ROLLBACK av projekt, media, historik och audit.
Ordinarie projekt-PUT får fortfarande inte kringgå livscykelkontrollerna.
Trash med sparade kategorier kräver spelserverns capability v14
(`dealerCategoryTrash: retained-categories-v1`). Äldre Render-runtime blockerar
skrivningen före mutation. Båda tjänsterna måste vara uppdaterade vid acceptans.

Importen bygger vidare på mergad PR #94: 30 osparade filer per omgång, 128 MiB
per fil, nästa omgång återanvänder platser och osäkra kvitton försöks inte om.
Filknappen är en vanlig knapp, bakgrund kan väljas för hela omgången och fel
namnger filen. **OK – placera klippen** ersätter separat granska-knapp, checkbox
och bekräftelseknapp. Dealer-valet behöver ingen ytterligare checkbox.

Adminrobotens N1-chatt laddar en separat importmodul från Admins tillgångar.
Filer kan dras in direkt; **Sortera och placera** ger uppdraget och sparar
exakta förslag genom befintlig privat Blob-uppladdning. Oklara förslag stannar
för rättning i chatten. Ny katalog och native grants kontrolleras före skrivning;
modellen får filbeskrivningar och kan inte själv utfärda uppladdningsrättigheter.
MP4/WebM stöds; zip, ljud och transparent assistentimport återstår. Ingen
publicering, spelacceptans eller läppsynksacceptans sker genom importen.

Lab-produktionsbygge, Admin-typkontroll och frontendens TypeScript har passerat.
Ordinarie pre-commit på implementationen: 3 414 godkända, 11 skips, 0 fel
över 72 testgrupper med Node 24.21.0 och fyra lokala arbetare.
Isolerade webbprov verifierade skapa, arkivera, återställa och mallkoppling utan
produktionsdata. Bolag & team öppnades i Admin och Dealers → Dragan → import
behöll rätt dealer. Det senaste filväljarprovet avbröts när webbläsarverktyget
slutade svara; det är inte ett godkänt uppladdningsprov. Testservern är avslutad.
30-filers chattimport har verifierats med injicerad uppladdning, inklusive oklara
fack och förlorade kvitton. Produktionsproven nedan ersätter den tidigare
luckan för verklig Blob-uppladdning; spelacceptans är fortfarande separat.
Systemkartan har ingen röd inventeringsavvikelse. Befintliga gula bevisluckor
är kvar. GitGuardian på main 982d541f: aktiv övervakning, 0 öppna och 17
ignorerade incidenter; check-suite queued, historik too_large och platsmetadata
delvis ofullständig. Ingen incidentstatus eller produktionskonfiguration ändras.

**Produktionsprov efter PR #102, 13 oktober:** main `bfbfaf4a` är verifierad
på både Vercel och Render med capability v14. De tolv återanvända verktygen
öppnas under `/admin` och behåller Dragan-kontext. Sammansättningsvyn visar
en befintlig varning om ett inaktivt Amira-val; ingen sådan mall ändrades.
`lab/` är fortsatt aktiv källkod och har inte tagits bort.

Jakob gav uttryckligt undantag för ett avgränsat produktionsprov med
`Adminprov 2026-10-13`. Skapa → papperskorg → återställ → papperskorg är
verifierat efter omladdning. Provdealern ligger kvar återställbar i
papperskorgen med noll klipp och inga rumskopplingar.

Dragan har nu **21 klipp**: de 14 befintliga samt sju nya alternativ från
Kevins `f15b2af1`. Sex sparades tillsammans med ett OK i dealerimporten;
`v2/pos2.mp4` sparades direkt genom Adminrobotens importuppdrag utan extra
godkännandesteg. Samtliga sju filhashar, dealerbindningar, privata Blobobjekt
och exakta fack verifierades i färskt register. Ett nytt klipp spelades till
slut i bibliotekets förhandsvisning utan mediafel. Ingen spelpublicering,
vald grundloop eller visuell loop-/läppsynksacceptans ändrades.

De elva MP4-filerna i Jakobs angivna skrivbordsmapp matchar redan sparade
produktionsfiler och dubblerades inte. Den privata ZIP-kopian från Kevin
innehåller 206 filmer, fem bilder, tre JSON-filer samt källmanifest med
gren, commit, exakta reposökvägar och SHA-256. Alla 214 källfiler verifierades
mot Git och det färdiga arkivet. ZIP och produktionskvitton ligger i denna
chats privata artefakter, utanför Git.

Proven hittade två navigeringsfel: föreslagen röst räknades som osparad
ändring även i ett orört formulär; avslutad import lämnade en spärr på grund
av samtalshistoriken när nästa Admin-verktyg krävde ny sidladdning. Den
avgränsade uppföljningen skiljer verkliga utkast från förslag och sparad
historik. Pågående uppladdning, osparade filer och ändrade talprofiler ska
fortfarande skyddas. Ny livekontroll krävs efter att uppföljningen släppts.

Uppföljningen är integrerad med main `6a9be6d2`. De 52 talformulärsproven
och 30 import-/routingproven passerar; nya felregressioner var först röda.
Slutbygget, 96 byggspår och Admin/Lobby-typkontrollen passerar. Läsgranskning
har inga kvarvarande fynd. Full ordinarie regression körs av commit-hooken.
Senaste säkerhetsläsningen på denna main har queued GitGuardian-suite och
incident-API HTTP 429; aktuell incidenttäckning är därför ofullständig.
Den tidigare fullständiga läsningen på `bfbfaf4a` gav 0 öppna/17 ignorerade,
aktiv övervakning, historik too_large och delvis ofullständig platsmetadata.

## Stabilt fontbygge, 13 oktober

Frontendens tre Google-typsnitt är nu lokala WOFF2-filer via `next/font/local`.
Inter, Cormorant Garamond och Geist Mono behåller CSS-variabler, normala stilar
och använda viktintervall. Kompletta källglypher, inklusive ÅÄÖåäö, finns kvar.
SIL-licenser och fryst Google Fonts-källa/hash dokumenteras i appens fontmapp.
Detta tar bort det reproducerade byggfelet i Googles URL-/filändelsehantering.

Både landing- och fulla Vercel-UI-produktionsbyggen passerar med ett tomt
mockat Google Fonts-svar (varje Google-import skulle då avvisas). Studio-
produktionsbygget passerar också. Produktionspublicering verifieras efter
ordinarie PR-leverans; inga gameplay-, media-, wallet- eller databaskopplingar
ändras av fontfixen.

## Alfakomposition i blackjack, 14 oktober 2026

Ett förberett alfaklipp visar nu aktiverad bakgrund och bord även utan egna
kort-/insatsplatser. Synligheten kräver fortfarande ett förberett klipp och
monterat, aktiverat material; alfa aktiverar inte greenscreen-nyckling.

Regressionsprovet återskapade felet före rättningen. De 21 kompositionsproven
passerar, inklusive mobil/desktop, med/utan bordsgeometri och avstängda lager.
Studio-bygget passerar; full pre-commit ingår i commitgrinden. Två
sammanhängande repetitioner per format passerar i den faktiska blackjackappen
med syntetiskt registrerad Nora QA, hashbundet alfa-WebM och separata QA-svar
på 127.0.0.2. Avkodade bildrutor och bildkontroll visar alla tre lagren utan
bordsgeometri. Den tillfälliga servern och webbläsaren städas av provet.
Detta verifierar kompositionen, inte tal/läppsynk eller produktionsmedier.
Leveransen omfattar spelarvillkoret, befintligt regressionsprov och denna
handoff; ADMINs och PR #91:s delar ligger kvar hos sina ägare.

## Lab: säkerhetspatchar i beroenden, 14 oktober

Lab uppdaterar Next 16.3.5 till 16.3.8 och sharp 0.35.4 till 0.35.5.
Låsningen uppdaterar även transitiva source-map-js 1.2.1 till 1.2.2 inom
PostCSS befintliga versionsintervall. Node 24.x och övriga paketfamiljer
behålls. Detta täcker rapporterade Next-advisories, sharp/librsvg och
source-map-js; ingen konsument av next/og eller ImageResponse hittades i
spårad Lab-/frontendkod, så faktisk exploatering är inte påvisad.

Verifiering sker med egna låsta installationer i en separat arbetskopia:
npm audit för Lab rapporterar noll sårbarheter, det verkliga Studio-bygget
passerar med 97 kontrollerade byggspår och leveransen använder den normala
fullständiga pre-commit-grinden. Frontendens Next 15.5.26 och designpaketets
PostCSS/Tailwind 3-beroenden ändras inte av denna patch; deras separata
auditfynd återstår. Ingen Node-major, produktionskonfiguration eller
migrering ändras.
