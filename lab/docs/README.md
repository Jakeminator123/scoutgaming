# Guide — en gemensam ingång

**Aktuell Astrid-demo:** gemensamma [Lab](../README.md) på `/`.
**Bakgrundszoner:** öppna `/zones` från Astrid Studio. Rita en pixelruta på
1080×1920-startbilden, skapa ett tvåsekunders blinkklipp eller lägg in en
MP4/WebM med exakt rutans storlek. Välj **Automatisk · högst 2/minut** i zonens
Uppspelning om klippet ska starta själv: första start inom 10 sekunder,
sedan minst 30 sekunder plus 0–10 sekunders slump mellan starter. Klippet
spelas klart före nästa start. Välj **Hela tiden** för oavbruten loop eller
**Av** för att dölja det. Byt underliggande Astrid-film för att granska zonen
mot olika tagningar; zonens timer är oberoende av dealerklippet. Rutan är
masken; ljusläget blandar bort
svarta pixlar, medan normalläget visar filmens egen alfakanal om den finns.
Koordinater och klipp sparas i den lokala webbläsarprofilen. Exportera JSON
och ladda ned zonklippen för att ge en annan agent en exakt specifikation.
Automatisk gäller i Labbets förhandsvisning och sparas i denna browserprofil;
zonerna styr ännu inte spelets spelare. Kontrollera kameraregistrering och
ocklusion för varje tilltänkt klipp innan användning.

Start: `node lab/start.mjs --offline --no-open` för tomt prov utan externa
tjänster. `Start-Lab.cmd` behåller den befintliga privata anslutna profilen.
Avancerade verktyg finns på `/tree`; `/lissabon` omdirigerar till `/`.

Jakobs arbetsdokumentation visas i [Guide i labbet](http://127.0.0.1:4188/guide).
Innehållet finns i [guide.json](guide.json); ordlistan hämtas direkt från
[studio-contract.json](../policies/studio-contract.json). Uppdatera dessa,
inte en parallell användarguide eller ett nytt kategorinamn i en enskild vy.

Utvecklarreferenser: [start och arkitektur](../README.md),
[videoformat och lagring](../VIDEO-LIBRARY.md), [videoschema](../schemas/video.schema.json).
[Dashboardens Scout-design, rörelse och lokala körning](DASHBOARD-DESIGN.md).
[Gemensam lokal presentationsruntime](../../docs/LOCAL-PRESENTATION-RUNTIME.md).
Eventgrupperna ska överensstämma med projektets seed och motorns källkontrakt.
Nodträdet grupperar dem efter **idle/bakgrund, engångshandling, exakt tal och
tur/resultat** med `lib/presentation-profile.mjs`; detta är en visningsmodell
över samma sex källtyper och 16 ID:n. Den skapar inte nya motorevents.
Ändrade tekniska ID:n, nya typer eller playback-funktioner kräver ett uttalat
beslut, kontrakt/schemaändring, tester och migrationsbeskrivning. Visningsnamn
kan fortfarande ändras i projektet utan att tekniska ID:n ändras.

Historiska analyser och permanenta källankare ligger kvar i jakob-docs.
De är fördjupning, inte ytterligare en startyta. Privata anteckningar lämnas orörda.

**Händelseloggen** på `/activity` skiljer källa, eventdata, kontext, beslut och
uppspelningskvitto. **Anslut** verifierar Partner-åtkomst, öppnar rätt
originalsession och startar läsande observation och automatisk labbföljning.
För Astrid öppnas nu `?dealer=astrid&presentation=local`: Web är ensam spelare
och Lab visar **En spelare · Web**. Spela och chatta i spelfliken. Valfri
bilddelning speglar just den fliken; speldata fungerar även utan bilden.
Grundläget **Standard** gör inga AI-klippval; välj OpenClaw eller Skuggläge
i spelets klippväljare om du vill prova modellval.
Chattsvar är ett separat val och påverkas inte av denna klippväljare.

Astrids valbara kamera/mikrofon finns i samma spelflik, Av som standard.
Starta det enda serverparet med `node lab/start.mjs --astrid-camera --no-open`
för att göra knappen tillgänglig; en redan körande server måste stoppas först.
Luna och Terra stöder bilder när uppdaterad Gateway/Director körs med
`CROUPIER_SPEECH_VISION=1`. Record aktiverar lokal lyssning efter ”Astrid”;
därefter skickas tal och kamerabilder automatiskt efter 1 150 ms tystnad.
Whisper översätter svenska eller engelska till engelsk text. Play styr ljudet.
Text/bilder är dolda; håll någon knapp i fem sekunder för att visa loggen.
Första aktiveringen kräver samtycke. Lokal taligenkänning måste finnas i Chrome.
Whispers riktiga API-prov passerar; fysisk inspelning, Terra i driften och
bildlagringskontroll återstår. Starta inte ett extra serverpar.
Se [implementation och verifieringsläge](../../docs/animation-events/ASTRID-CAMERA-IMPLEMENTATION.md)
och [OpenClaws källindex](../../open-claw/lab/docs/OPENCLAW-DOCS.md).

## Idle i Eventstudion

Astrids Eventstudio och native-följning använder nu samma exakta mediefamilj:
`box0` → `deal_pos1`, …, `box6` → `deal_pos7`, samt exakt `speak.line` →
`repliker/<line>/`. Situationsväljaren ändrar bara manuella exempel; mottagna
events behåller kort, box, handindex och replik. Standardfil och varianter
kommer från manifestet, inte från projektets gamla 2D-demovarianter.

Manifest v2 har 28 familjer: nio dealfamiljer, en kortvändningsfamilj, sjutton
replikfamiljer och en idlefamilj. Deal/replik använder
`deal/<familj>/<standard>.mp4` respektive
`repliker/<familj>/<standard>.mp4`; deras `variant/` kan vara tom och ger då
standard. Idle har två basloopar direkt i `idle/` och korta
engångsvariationer i `idle/variant/` (policyn stöder högst 30).
Deal-familjer kan ha högst fyra aktiva frekvensvarianter samtidigt; även ett
senare importerat klipp kan väljas. Replikfamiljer visar högst fyra alternativ. Filnärvaro, hash och playbackkvitto är fortfarande inte
ett mänskligt godkännande av läppsynk eller kortkontakt.

`mediaPolicy` är ett frivilligt tillägg till projektets schema v1. Äldre projekt
och egna ändringar skrivs inte över. För en manifeststyrd dealer ersätter en
tillfällig vy den aktuella linjens kandidater med exakt familjs standard och
högst fyra tillgängliga mappvarianter. Saknad policy innebär manuell variant.
Regler, slump och OpenClaw kräver uttrycklig tillåtelse. Okända eller saknade
varianter lånar aldrig en annan familjs media. Övriga dealers behåller sin
befintliga originalväg. Lägg nya MP4-filer i rätt `variant/`-mapp och välj
**Läs in nya filer**. Knappen skannar mapparna, uppdaterar manifestet och läser
om katalogen utan att flytta videofiler. En ny idlevariant läggs sedan till i
policyn som manuell; välj Automatisk eller OpenClaw uttryckligen och spara.
Ingen uppladdning till Render behövs för de lokala filmerna.

### Astrids Deal-frekvenser

I Lissabon → Deal och samma familj i avancerade labbet anger du procent för
varje variant. Andelen gäller varje kort till just den platsen; återstoden
använder standardfilen. 0 % behåller klippet för manuellt prov. Summan får
vara högst 100 %. Ett saknat klipps andel går till standard. Högst fyra
varianter kan vara aktiva; nollade inställningar frigör plats för nya klipp.

Frekvenserna sparas som ett valfritt `frequencyPercent` på mediepolicyns
variant. Första uttryckliga ändringen ersätter äldre urval för hela den
familjen; andra varianter utan procent blir manuella. Äldre projekt ändras
inte vid läsning. Regler, Slump och OpenClaw använder samma lokala
frekvensurval utan modellanrop. Standard spelar standard, och Skuggläge
provar urvalet men spelar standard. Språk- och sociala testvillkor visas
inte för Astrids Deal. Repliker och övriga dealers behåller sina val.

Importen från `croupier_kaffe` lägger boxvarianterna i `deal_pos1` och
`deal_pos2` samt `idle_andas`, `idle_handrorelse`, `idle_huvud_i_handerna`,
`idle_resa_sig_fargmatchad` och `idle_resa_sig_kling` i idlefamiljen.
Kaffe och den ofärgmatchade resa-sig-tagningen fanns redan med samma byteinnehåll.
De nya varianterna är bara tillgängliga för manuellt val tills de uttryckligen
läggs till och aktiveras i den sparade policyn. 480p-originalet är kvar i
källmappen som referens och ingår inte i manifestet.

Översikten och Videobanken visar samma fysiska familjer. Uppspelningskvittot för
en MP4 innehåller fil-ID, filnamn och familj. Ett beslut utan spelarens kvitto
räknas inte som uppspelat. OpenClaw-källorna finns även i Guide och Chatt &
OpenClaw. Parallell anslutningsuppgift: [agentprompt](PARALLEL-OPENCLAW-STARTUP.md).

Välj **Astrid → Vänteläge** för den förenklade idleeditorn. Den har tre delar:
grundloop, korta variationer och ett deterministiskt enminutsprov. Grundläget
består av `idle_still` och `idle_breath`. `idle_blink`, `idle_cheek`,
`idle_glance`, `idle_insulted`, `idle_smile`, `idle_yawn` och
`croupier_coffie` är engångsvarianter.
Beskriv **När passar klippet?** med högst 80 tecken. Texten följer kandidaten
till OpenClaw som konfigurationsdata, inte som en systeminstruktion.

Mappstrukturen är kontraktet för släktskapet:

- `emil/dealklipp-v1/idle/*.mp4` är loopande grundklipp.
- `emil/dealklipp-v1/idle/variant/*.mp4` är korta varianter.
- policyn `lab/policies/idle-policy.seed.json` bestämmer grundvikter och om en
  variant är manuell, automatisk, regelstyrd eller OpenClaw-valbar.

Det avancerade labbets startpolicy visar `idle_still` med 90 % grundvikt och schemalägger blinkning
ungefär var 25:e sekund med ±5 sekunders variation. Eftersom blinkklippet tar
tid blir `idle_still` i praktiken ungefär 79 %, vilket editorn visar. Ett
spel-, deal- eller talprov äger spelaren och blockerar idleprovet tills det är
klart. Policyn sparas lokalt med projektet. Den lokala Web-spelaren läser samma
projekt; ladda om spelfliken efter ändringar i idlepolicyn. Lissabons snapshot
erbjuder i stället de ursprungliga sex variationerna till OpenClaw; kaffeklippet
börjar som manuellt. Ingen fjärrdrift deployas
och OpenClaw behöver inte startas om när beskrivningar eller val ändras.

Grundvikt är alltså inte faktisk tidsandel. Automatisk idlevariant följer
intervall, jitter, cooldown och maxfrekvens. OpenClaw-valbar variant kräver en
färsk chattmöjlighet; manuell variant schemaläggs inte. Regelstyrd idle har
ännu ingen ansluten trigger och kan inte nyväljas i editorn.
Det deterministiska enminutsprovet spelar verkliga lokala filer och loggar
start/slut/återgång. Labbytan i Händelseloggen använder dessutom en levande
idle-controller med samma sparade policy: verkligt `ended` väljer nästa klipp,
och cooldown/maxfrekvens räknas från faktiska starter. Deal går först och färdigt
tal återställer en ny primärbas innan talgrinden öppnas. Varianter eller sekundär
bas ger aldrig standardpositionskvitto. I Astrids lokala presentationsläge
används controllern av Web; Lab startar ingen parallell följningsfilm.

I OpenClaw-/Skuggläge kan en färsk observerad användarchatt också ge ett råd
för uttryckligen OpenClaw-valbara `idle/variant/`-filer. Det är en lokal
renderer-möjlighet, inte ett påhittat native-event. Högst 30 sekunders giltighet
och en spelad AI-idlereaktion per minut; nyare chatt, ändrad runda, paus eller
lägesbyte kasserar gammalt råd. Skuggläge spelar aldrig rådet. Ingen modell
anropas för manuell/automatisk idle eller en familj utan tillåten AI-variant.

Native-observern ger publika kommandosvar, bordsvy och instrumenterade
playback-/chattsignaler. Partner-SSE är kompletterande rundinstruktioner.
Transport ansluten betyder ännu inte speldata mottagna. Samma instruktion
slås ihop; konflikter och luckor stoppar följningen. Kontextsidan anger vilka
publika fakta OpenClaw får och vilka uppgifter som saknas.

Den kan även skicka högst åtta observerade chattmeddelanden före aktuellt
event (600 tecken vardera, 3 200 totalt) som märkt data för variantval.
Director måste kvittera kontextkontrakt v2; äldre tjänst ger synlig
standardreserv tills den uppdaterats. Ett isolerat offlineprov startas med
`node tools/start-local-comparison.mjs` efter labbygge; se README:s provavsnitt.

**Diagnostik** samlar verifiering, videokarta, import/export och särskilda
videolägen. Sekvenssteg öppnar befintlig editor. Loggen håller högst 150
poster; hela observationsprotokollet håller högst 300 meddelanden/4 MiB i
flikens minne. Exportera före omladdning. Native-observation kräver den nya
spelarkoden på vald server; lokal merge är inte Bettalotto-deploy.
Vid full historik: exportera och välj **Ny observation** i Diagnostik.
Det ersätter protokollet och gamla labbkön men behåller spelet och anslutningen.
Konfiguration och gränser finns i [labbets README](../README.md#läsande-partner-ström).

Källklippen från Emil är 1080×1920 (9:16). Det beskriver filens pixelformat,
inte att Eventstudion eller spelet har en enda låst mobil layout. Respektive
klient har sin egen desktop-/mobilyta. Jämförelsen har nu Dator/Mobil-ramar
på båda sidor; labbet visar hela källfilen utan beskärning. Originalflikens
faktiska fönsterstorlek måste fortfarande ändras för ett riktigt mobilprov.
Produktens
`?rehearsal=1` öppnar den befintliga QA-panelen ovanpå den riktiga
produktspelaren; det är inte en ny Eventstudio-flik.

**Chatta vid det anslutna bordet** ligger under labbets jämförelsebild. En
avgränsad brygga skickar bara text till originalets autentiserade chatt; servern
hämtar publika kort och spelarminne. Fri text kan förberedas som Cartesia-ljud
och matchande RunPod-video medan spelet dealar. Talpaketet överförs tillbaka
utan sessionnycklar och spelas först efter en ny renderad primärbas i labbet.
Deal avbryter tal; gamla svar, fel hashar och fel revisioner får inte spelas.
Native-eventrepliker behåller sin separata exakta replik-/familjemappning.

Spelarminnet är serverbundet per autentiserad spelare/dealer, högst 12
meddelanden/8 000 tecken och 30 dagars inaktivitet. Originalchattens **Minne**
visar omfattning och kan glömma historiken. Det är konversationsminne, inte
verifierat uppspelningsminne. Tillfälliga testdatabaser raderas vid teststopp.

Anslutet prov med genererat tal kräver explicit `--generated-speech` i
[starthelpern](../../open-claw/lab/docs/LOCAL-CONNECTION-SV.md); standardstart
förbrukar inga Cartesia-/RunPod-jobb. OpenAI-modellen är oförändrad. Genererade
takepaket är hashbundna previews, **inte mänskligt godkänd läppsynk**.
Modellvalet `recordedLine` visas tills vidare bara som text i den länkade labbchatten
om en exakt labbtake saknas; native-eventets inspelade replik påverkas inte.

**Fristående chattprov** i Eventstudion har egen provkontext och högst 25
sekunder ljud. Det styr inte det anslutna bordet. Se [socialt prov](../SOCIAL-CHAT.md).

[Signal- och begreppskartan](../../docs/systemkarta/02-events-triggers-urval/SIGNALER-OCH-TAKES.md)
förklarar RNG kontra spelfakta, Partner kontra native-status, de 16 genvägarna,
relevanta situationer och föreslagen gemensam bild-/taluppspelning. Kartan skiljer
nuvarande kod från nästa steg; den aktiverar inte nya funktioner.

Aktuell plan och publicerade läsytor finns i [V5 · sju arbetsdagar](../../docs/animation-events/v5-7-days-mvp/README.md). Guide beskriver dagens labb; sprintplanens förslag aktiverar inga funktioner.

[Artefaktkarta: scheman, manifest och lagring](ARTIFACTS.md) ·
[OpenClaw-talägarskap: implementationsbrief](OPENCLAW-SPEECH-OWNERSHIP.md) ·
[Takepaket för Kevin/Emil](templates/media-take.md).
