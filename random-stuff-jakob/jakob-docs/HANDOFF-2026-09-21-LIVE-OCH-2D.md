# Fortsättning: originalspel → observationsprotokoll → 2D-mockup

**Kontrollerat 21 september 2026.** Arbetsrepo: `C:/Users/jakem/Projects/croupier`,
branch `jakeminator123/work`. Labbet kör på `http://127.0.0.1:4188`.
Den här filen är en teknisk överlämning, utan hemligheter eller samtalsexport.

## Senare kontroll: live-klienten använder native table

Verifierat genom en normal Partner-launch-session: den faktiskt levererade
`app.mjs` skickar till `/api/table`, inte `/api/v1/table`. Både labbets anslutning
och en separat direkt Partner-SSE autentiserades, men inga rundposter sparades.
Labbinspelningen slutade med `terminated` efter cirka fem minuter. Direktprovet
avbröts manuellt efter problem med avslut; det har inget slutligt heartbeat-antal.

Sex läsningar av samma spelares native `op: state` gav identiskt vänteläge,
ingen aktiv runda. Agenten spelade ingen ny runda: browserstyrningen stoppades
eftersom verktyget inte kunde verifiera aktuell URL. Inga env-värden ändrades.
Privat underlag och exakt begränsning finns i
`lab/data/observations/2026-09-21T00-10-30-027Z/README.md`.

Nästa tekniska steg är att verifiera/komplettera native-table → Partner-events
på servern, med autentiserad kanal, korrelation och skydd mot dubbelpublicering.
Deployad serverrevision är fortfarande okänd och användarens exakta rundanrop
fångades inte. Klippstart/slut och kortlandning kräver dessutom klienttelemetri.
En omladdning eller nyckeländring löser inte automatiskt dessa kopplingar.

## Tidigare prov: tre demorundor och nästa mål

Efter kompletteringen nedan bekräftade Jakob att spelkontot enbart innehöll
demopengar. Tre små rundor avslutades, även en från explicit Partner-launch.
**Noll SSE-rundmeddelanden kom.** Alla sju loggade utdelningsstarter använde
direktleverans från skon; launch-vägen rapporterade `No staged capture`.
Goodluck hade slut utan loggad start; dealerbust/push/placebets hade parade
talstart/slut. Detta är diagnostik, inte godkänd videouppspelning eller läppsynk.

49 konsolposter, 15 normaliserade DOM-kontrollpunkter, mapping, scopes och
SSE/session ligger privat i `lab/data/observations/2026-09-20T23-50-27-036Z/`.
Mappens README beskriver bevis, begränsningar och första kodjämförelsen.
HTTP-kroppar, server-requestId/version och samtliga mellanliggande kort/frame-
tider fångades inte. Både browser- och filobservatören är avslutade.

**Senaste målbild:** bygg in originalspelet streamat/inbäddat direkt på
Studions befintliga Händelselogg-yta, med live-logg över faktiska anrop,
data, beslut och uppspelning intill/nedanför. Mappa sedan detta till labbets
noder och flöden. En ny flik är bara dagens provväg. Jakob bad att avsluta
sista rundan nu och ta inbyggnaden därefter; ingen sådan integration ändrades
i detta observationsprov. Tidigare nollsaldo och oprövade rundor nedan är
historisk status före detta prov, inte nuvarande blockerare.

## Senaste kompletteringen: launch, videokarta och protokoll

**Jakobs förtydligande:** 2D är en mockup av presentation som senare ska vara
videofiler. Utgå från hela befintliga blackjackklienten och dess videoflöde.
Observera verkliga sekvenser och återskapa dem på labbets befintliga Partner-yta.
En egen uppsättning påhittade gester är inte nästa steg.

- Avslutningscommitten `e680dac` har hämtats hem. Den innehöll handoff,
  dokumentation och kodetiketter. Arbetsgren är `jakeminator123/work`, med
  `origin/jakeminator123/work` som jämförelsebas. Kevin-grenen hämtades till
  remote-ref `b066a43` för läsning, utan merge.
- Kevins [senaste relevanta besked](https://gitlab.com/scout-gg/croupier/-/work_items/1#note_3873260823)
  beskriver `launch + events`, samma spelar-ID för spel och observation,
  nya `/api/v1/generations/mapping` och en deployad fix i PerformancePlayer.source().
- Live-ping via labbet bekräftade **launch + events**, inte play/wallet.
  Det korrigerar äldre scope-uppgifter längre ned och i tidigare handoffs.
- `/activity` har nu **Verifiera Partner-åtkomst**, **Öppna referensspelet**,
  **Hämta videokarta** och **Exportera observationsprotokoll**. Det är samma
  yta som den befintliga läsande SSE-anslutningen. Inget anrop till leverantören
  sker bara för att sidan öppnas.
- Partner-launch öppnades live för den konfigurerade spelaren. Originalklienten
  visade Astrids videobord och `0,00 €`, med `dealer=astrid&performance=staged&motion=smooth60`.
  Inga insatser, saldoändringar eller rundor gjordes. Launch kan skapa/ladda
  partnerprofil och session; provet var därför inte enbart läsande.
- SSE accepterades samtidigt och kopplades sedan från. **Inga rundmeddelanden
  mottogs. Launch → faktisk rundpublicering är ännu oprövat.** Kevin säger
  att flödet ska fungera; hämtad kod visar publicering i Partner-table men
  ingen motsvarande native `/api/table`-koppling. Utred med en avsedd demorunda
  före påståenden om fungerande helhetsintegration.
- Mapping gav fyra dealers. Astrid hade 19 engine-poster, 6 staged-takes,
  0 green-takes och manifeststatus draft. `revision` var null: deploymentens
  exakta commit är inte verifierad. BO-val, never-again och verdicts följer
  kartan; de är inte uppspelningskvitton.
- Observationen sparar hela mottagna rundmeddelanden före loggens 40-raders
  kortning. Den stoppar synligt vid 300 meddelanden eller 4 MiB. Exporten
  innehåller scopes, videokarta, tidsstämplar och anslutningsluckor, utan
  launch-URL/nycklar. JSON kan också kopieras i ytan. Exportera före vybyte
  eller omladdning; ingen automatisk historik eller replay finns.
- Originalspelarens faktiska klippstart/slut/kortlandning och fulla
  tabellsnapshots ingår **inte** ännu. Ingen 2D-renderer eller produktmedia
  ändrades. SSE-instruktioner får inte märkas som redan spelade klipp.

Nya kodankare: `lab/lib/partner-reference.mjs` (serveradapter),
`lab/components/partner-reference.tsx` (panel), `lab/lib/partner-trace.mjs`
(observation/export). Endast mapping-adaptern läser generationsvariabeln
`BETTALOTTO_API` från root `.env`, lab `.env.local` och processmiljön i den
prioritetsordningen. Befintliga miljöfiler och Partner-inläsning är bevarade.

Nästa agent följer [den konkreta uppdragsprompten](PROMPT-2D-MOCKUP-FRAN-SPELFLODE.md).
Först behövs en avsedd demoplånbok med saldo och belagd rundtrafik; använd inte
wallet-/databasändringar på det riktiga kontot för att kringgå nollsaldot.
Jira CAC kunde inte uppdateras: ingen Jira-anslutning eller kopplat ärende-ID
fanns tillgängligt. Teknisk observation och dokumentation är lokalt sparade.

Verifiering för kompletteringen: **248/248 labbtester, TypeScript och
produktionsbygget passerade**, inklusive 29 riktade API/observer/protokolltester.
Browser verifierade scopes, videokarta, launch till originalbordet och SSE
anslutning/frånkoppling. Den kopierbara JSON-exporten verifierades med fyra
dealers, launch/events, tre anslutningsposter, noll rundor och inga credentials
eller launch-URL. Automationen bekräftade inte webbläsarens nedladdningshändelse;
samma JSON finns i panelen för kopiering. Det tidigare cachetestet passerade
denna gång utan cacheändring; den äldre intermittenta avvikelsen är inte löst.
Ingen take har visuellt godkänts av detta prov.

## Börja här

Jakob vill först spela i den befintliga klienten och observera vilka videor
som används när, för att sedan återskapa presentationsflödet i ett spelbart
2D-labb. Bygg vidare på samma motor och
eventkontrakt. Kort, sko, tillåtna spelhandlingar, utfall och saldo ska fortsatt
bestämmas av spelservern. OpenClaw väljer endast presentationens tillåtna variant.

Läs först repo- och labb-`AGENTS.md`, [gemensam handoff](../../docs/JOHN-HANDOFF.md)
och [miljöåterställningen](../../docs/ENVIRONMENT-RESTORATION.md). Äldre notiser
är historik; kontrollera aktuell kod. Läs relevant Jira CAC-ärende om ett sådant
är kopplat till nästa uppgift. Ingen Jira-anslutning/ärende-ID fanns i denna körning.

## Verifierat nu

- **Partner-SSE fungerar med nuvarande lokala inställningar.**
  `/api/inputs` gav `configured: true`, inga saknade/ogiltiga fält.
  Klick på **Anslut läsande** i Händelseloggen gav **Partner-ström ansluten**
  mot `https://bettalotto.se/api/v1/events`.
  Det verifierar att servern accepterade anslutningen. Den äldre lokala
  serverkoden kräver `play`; uppdaterad Kevin-kod och live stöder även `events`.
  Inga rund-events kom under det korta provet, inga spelkommandon skickades.
  Testanslutningen kopplades därefter från uttryckligen. Den kör inte i bakgrunden.
- **224 av 224 videoposter är tillgängliga lokalt**, enligt `/api/videos`.
  Här betyder tillgänglig läsbar fil med förväntad storlek, inte kvalitetsgodkänd
  eller visuellt kontrollerad video. Ingen film avkodades/granskades i denna körning.
- Alla 16 eventnoder visar nu mindre kodtext i både Eventstudions vänsterlista
  och Nodträdet, exempelvis **Bordet väntar (idle · idle.ready)**.
  Värdena kommer från projektdatan, utan en extra hårdkodad namnlista.
- `idle` är källans presentationstyp (`type`). `idle.ready` är labbets nod-ID
  som används för mappning, variantuppsättning och redigering. Det är inte ett
  ytterligare event som spelservern skickar. De fyra visuella kategorierna
  grupperar 16 labbnoder över sex källtyper.
- Testknapparna är simulerade kontextpaket. **Återkommande spelare** ändrar
  endast återkomstflaggan jämfört med Neutral. Sparade variantvillkor är bevarade;
  den äldre varianten ”Välkommen tillbaka · tyska” kan därför fortfarande finnas.

## Nästa steg: befintligt spel som referens

Använd först [Bettalottos befintliga spelklient](https://bettalotto.se/) i
avsedd demomiljö. Vanlig inloggning eller en Partner-launch kan ge åtkomst
till den klienten. **Launch öppnar hela originalklienten med dess videorendering.**
Labbets nya launch-knapp är verifierad enligt kompletteringen ovan.

Spela några avgränsade demorundor och notera faktisk sekvens: spelhandling,
motorns kort/resultat, använt klipp eller stream-ID, replik, målposition,
landningstid och återgång till idle. Börja med en vanlig start/hit/stand/
collect-sekvens; kartlägg därefter specialfallen. Följ klientens egna data
och faktiska uppspelning, inte bara vilket klipp ett manifest föreslår.
Spara ett kort observationsprotokoll utan cookies, tokens eller andra
spelares uppgifter. Ett avsett klipp och ett faktiskt spelat klipp är olika bevis.

Det här är underlag för att återskapa **presentationen** i 2D. Spelregler och
utfall ska inte gissas från videobilden: använd serverns tabelltillstånd och
befintliga kontrakt. Om samma prov också ska synas i Partner-SSE måste det
drivas genom Partner-table, eller kräva en uttrycklig ändring av publiceringen.
Vanligt spel via launch/inloggning är inte tillräckligt enligt lokal kod.

## Därefter: vad saknas för att spela i 2D-labbet?

Nuvarande Händelselogg observerar SSE men kör inget variantval och driver inte
scenen. `Stage` är en preview av ett eventexempel med demonstrationskort, inte
en spelklient med en komplett serverstyrd hand. Anslutningsknappen ger därför
inte automatiskt en spelbar 2D-runda.

Föreslagen nästa leverans:

1. **Avgränsa testmiljön.** Samma Partner-nyckel och exakt samma `playerId`
   måste användas för spelanrop och SSE. Kevins föreslagna ID var `jakob-lab-1`;
   kontrollera den faktiska lokala inställningen utan att exponera credentials.
   Bekräfta att detta är avsedd demospelare och intern demoplånbok före
   bordskommandon; SSE-provet verifierade inte wallet-läge eller saldo.
   Ett isolerat lokalt server-/databasprov kan användas under implementationen.
2. **Lägg till en avgränsad serveradapter för Partner-table.** Signera på
   serversidan. Återanvänd origin-/felhantering där den passar, men behåll
   observerns läsande kontrakt. `POST /api/v1/table` använder `play`; skicka
   `requestId` för ändringar och explicit `version` för kontroll av inaktuellt
   tillstånd. Bevara request-ID vid transportretry. `op: state` använder samma
   POST-väg och kan skapa lokal partnerprofil/tabell i produktkoden; behandla
   det inte som ett helt sidoeffektsfritt statusprov.
3. **Visa riktiga kort och kontroller.** Börja gärna med en spelare på box 3,
   vanlig huvudinsats och 2D. Visa motorlevererade kort, gömt dealerkort, aktiv
   hand, fas och saldo. Använd motorns `legalActions`; hantera hit/stand,
   försäkring, double, split och avslut utan att fastna i en laglig fas.
   Labbets befintliga vänster/mitten/höger-preview räcker inte som fullständig
   kortlayout, särskilt inte för split eller fler kort på samma plats.
4. **Koppla verklig presentation till en ordnad kö.** Använd table-svarets
   `presentation[]`, med faktiskt kort, `box`, `handIndex`, `shoeDraw` och
   exakt replik-ID. Mappa till labbnoden och välj kompatibel variant. Behåll
   OpenClaw som normalt urval och standard som fallback. Ändra aldrig kort,
   destination, utfall eller exakt spelreplik som följd av modellvalet.
5. **Undvik dubbel uppspelning.** Table-svar och SSE kan beskriva samma
   kommando. Välj en primär uppspelningsväg och korrelera med request-ID,
   version och eventindex. SSE har ingen replay; efter avbrott behövs nytt
   tabelltillstånd, inte påhittad återspelning av okända mellanliggande steg.
   Loggens 150 poster och maximalt 40 separata presentationsrader per mottagen
   runda är visningsgränser, inte en kö för spelmotorn.
6. **Verifiera hela kedjan.** Två på varandra följande demorundor, riktiga
   kort/destinationer, legal-action-lås, dubbla svar, återanslutning och
   omladdning. Logga mottagen data → modell/standard och orsak → faktiskt
   start/slut/fel från spelaren. Testa brancher som split/double/försäkring
   med isolerade deterministiska tester. Kör repoets obligatoriska
   media-/spelargranskning när själva spelaren ändras.

Enligt den lokala koden publiceras Partner-SSE efter Partner-`/api/v1/table`.
Vanliga spelklientens `/api/table` publicerar inte automatiskt till denna ström.
En launch-URL öppnar den vanliga spelklienten; den är därför ingen verifierad
genväg till SSE-drivet labbspel. Deployad serverrevision verifierades inte i
denna körning: kontrollera kontraktet igen om livebeteendet skiljer sig.

## Video: välj kandidater nu, verifiera sekvensen senare

Partner-nyckeln behövs inte för att granska de 224 befintliga lokala filmerna.
Videobanken kan redan förhandsvisa dem, kategorisera dem för dealer/event och
koppla ett exakt video-ID till en variant. Generations-API:t behövs när vi vill
hämta nyare metadata/material som saknas i den lokala inventeringen.

Börja med ett litet urval för Astrid: lugn idle, delning till de konkreta
spelarpositioner som första testet använder, dealer/up/reveal och återgång
till idle. Använd namn, prompts, intake-omdömen och BO-bindningar för att hitta
kandidater; inspektera därefter själva filmen. Kontrollera rörelseriktning,
bildutsnitt, transparent/full scen, hand-/kortkontakt, landningstid och start/
slutposition. Godtagbar ensam preview är inte bevis för en bra övergång mellan
två klipp eller korrekt timing mot ett verkligt kort.

Spelrepliker kräver exakt text, inspelat ljud, video, frame-index, kalibrering
och acceptans tillsammans. Välj aldrig talvideo bara efter ungefärlig längd.
Fri chatttext med ElevenLabs ger inte automatisk läppsynk i ett gammalt klipp.
Markera kandidater som preliminära; godkänn först efter granskning i avsedd spelare.
Bind inte om produktens befintliga dealerfiler som del av en labbklassificering.

Partner-`POST /api/v1/assets` kräver `lobby` enligt koden. Den behörigheten
verifierades inte av SSE-provet. Manifestet är inte samma sak som aktuella
backoffice-bindningar eller bevis för vad som faktiskt spelas i drift.

## Bevara användarens val och kända begränsningar

- Chatten ligger kompakt direkt under bordet. Fri text är normalt svarsläge;
  text och tal ska överensstämma. ElevenLabs-ljud är förvalt på, med möjlighet
  att stänga av. Inget betalt modell-/TTS-anrop ska ske enbart när sidan öppnas.
- Socialt tal får bara starta i idle, högst sex sekunder och med en ägare åt
  gången. Vanliga blinkningar får inte avbryta det. Dagens renderer visar
  neutral idle under tal: kö/bindning för exempelvis ”Ledsen”-video vid nästa
  idle och riktig läppsynk återstår. Det är inte redan implementerat.
- Dagens 2D-rörelser är labbprov för noder/varianter, inte bevisad täckning
  av alla boxar, händer, animationer och produktsekvenser.
- Bevara rotens `.env`, ignorerad `lab/.env.local` och `lab/data`. Se
  [miljöförklaringen](_env.explanation.md) för respektive inläsningsväg.
  Inga env-värden eller loaders ändrades i denna leverans.
- Läs inte Jakobs privata arkiv eller råa loggfiler för vanlig kodorientering.
  Denna genomgång använde kod, aktiv dokumentation och registermetadata;
  inga videobinära filer indexerades eller hämtades från nätet.
- Tidigare bred testkörning hade en känd, ofixad avvikelse i
  `lab/test/video-registry.test.mjs:131`: samma storlek men ändrat innehåll
  efter cache gav 200 i stället för förväntat 409. Den testades inte om här.
  Utred före tillit till filmcache vid utbyte av original; ändra inte baseline
  för att dölja avvikelsen. Övrig äldre mediaacceptans ska läsas i gemensam handoff.

## Kodankare och leveranskontroll

- [Partner-signering och läsande proxy](../../lab/lib/partner-observer.mjs)
- [Händelselogg och anslutningsknapp](../../lab/components/activity-log.tsx)
- [Partner-table, scopes och SSE-publicering](../../web/partner-api.mjs)
- [Presentationsbyggare och assetmanifest](../../web/partner-presentation.mjs)
- [Serverns blackjackmodell](../../web/shoe-game.mjs)
- [Labbets nodkontrakt](../../lab/policies/studio-contract.json)
- [Nuvarande förhandsvisningsspelare](../../lab/components/stage.tsx)
- [Videoregister](../../lab/lib/video-registry.mjs) och
  [kompatibilitetskontroller](../../lab/lib/video-intake.mjs)

Denna leverans ändrar kodetiketter och dokumentation. 20 befintliga
komponenttester och TypeScript passerade. Browser-QA visade etiketter på
båda ytorna; den läsande Partner-anslutningen accepterades och kopplades från.
Inga spelrundor, mediaändringar, projektsparningar eller produktdeploys gjordes.
Arbetet pushas på `jakeminator123/work`; använd branchens senaste commit som
utgångspunkt och kontrollera lokala osparade ändringar innan fortsatt arbete.
