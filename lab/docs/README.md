# Guide — en gemensam ingång

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

## Idle i Eventstudion

Astrids Eventstudio och native-följning använder nu samma exakta mediefamilj:
`box0` → `deal_pos1`, …, `box6` → `deal_pos7`, samt exakt `speak.line` →
`repliker/<line>/`. Situationsväljaren ändrar bara manuella exempel; mottagna
events behåller kort, box, handindex och replik. Standardfil och varianter
kommer från manifestet, inte från projektets gamla 2D-demovarianter.

Manifest v2 har 26 familjer och 31 filer: åtta dealfamiljer, sjutton
replikfamiljer och en idlefamilj. Deal/replik använder
`deal/<familj>/<standard>.mp4` respektive
`repliker/<familj>/<standard>.mp4`; deras `variant/` kan vara tom och ger då
standard. Idle har två basloopar direkt i `idle/` och högst fyra
engångsvariationer i `idle/variant/`. Högst fyra filvarianter får vara
valbara per familj. Filnärvaro, hash och playbackkvitto är fortfarande inte
ett mänskligt godkännande av läppsynk eller kortkontakt.

`mediaPolicy` är ett frivilligt tillägg till projektets schema v1. Äldre projekt
och egna ändringar skrivs inte över. För en manifeststyrd dealer ersätter en
tillfällig vy den aktuella linjens kandidater med exakt familjs standard och
högst fyra tillgängliga mappvarianter. Saknad policy innebär manuell variant.
Regler, slump och OpenClaw kräver uttrycklig tillåtelse. Okända eller saknade
varianter lånar aldrig en annan familjs media. Övriga dealers behåller sin
befintliga originalväg. Uppdatera manifestet efter filändringar och använd
**Läs om videomapparna**; knappen skriver inte om eller flyttar mediefiler.

Översikten och Videobanken visar samma fysiska familjer. Uppspelningskvittot för
en MP4 innehåller fil-ID, filnamn och familj. Ett beslut utan spelarens kvitto
räknas inte som uppspelat. OpenClaw-källorna finns även i Guide och Chatt &
OpenClaw. Parallell anslutningsuppgift: [agentprompt](PARALLEL-OPENCLAW-STARTUP.md).

Välj **Astrid → Vänteläge** för den förenklade idleeditorn. Den har tre delar:
grundloop, korta variationer och ett deterministiskt enminutsprov. Grundläget
består av `idle_still` och `idle_breath`. `idle_blink`, `idle_cheek`,
`idle_glance` och `idle_insulted` är de högst fyra engångsvarianterna.

Mappstrukturen är kontraktet för släktskapet:

- `emil/dealklipp-v1/idle/*.mp4` är loopande grundklipp.
- `emil/dealklipp-v1/idle/variant/*.mp4` är korta varianter.
- policyn `lab/policies/idle-policy.seed.json` bestämmer grundvikter och om en
  variant är manuell, automatisk, regelstyrd eller OpenClaw-valbar.

Startpolicyn visar `idle_still` med 90 % grundvikt och schemalägger blinkning
ungefär var 25:e sekund med ±5 sekunders variation. Eftersom blinkklippet tar
tid blir `idle_still` i praktiken ungefär 79 %, vilket editorn visar. Ett
spel-, deal- eller talprov äger spelaren och blockerar idleprovet tills det är
klart. Policyn sparas lokalt med projektet. Den lokala Web-spelaren läser samma
projekt; ladda om spelfliken efter ändringar i idlepolicyn. Ingen fjärrdrift deployas.

Grundvikt är alltså inte faktisk tidsandel. Automatisk idlevariant följer
intervall, jitter, cooldown och maxfrekvens. Regelstyrd och OpenClaw-valbar
variant kräver en separat tillåten orsak; manuell variant schemaläggs inte.
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
hämtar publika kort och spelarminne. Fri text kan förberedas som ElevenLabs-ljud
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
förbrukar inga ElevenLabs-/RunPod-jobb. OpenAI-modellen är oförändrad. Genererade
takepaket är hashbundna previews, **inte mänskligt godkänd läppsynk**.
Modellvalet `recordedLine` visas tills vidare bara som text i den länkade labbchatten
om en exakt labbtake saknas; native-eventets inspelade replik påverkas inte.

**Fristående chattprov** i Eventstudion har egen provkontext och högst 25
sekunder ljud. Det styr inte det anslutna bordet. Se [socialt prov](../SOCIAL-CHAT.md).

[Signal- och begreppskartan](../../random-stuff-jakob/jakob-docs/systemkarta/02-events-triggers-urval/SIGNALER-OCH-TAKES.md)
förklarar RNG kontra spelfakta, Partner kontra native-status, de 16 genvägarna,
relevanta situationer och föreslagen gemensam bild-/taluppspelning. Kartan skiljer
nuvarande kod från nästa steg; den aktiverar inte nya funktioner.

Aktuell plan och publicerade läsytor finns i [V5 · sju arbetsdagar](../../docs/animation-events/v5-7-days-mvp/README.md). Guide beskriver dagens labb; sprintplanens förslag aktiverar inga funktioner.

[Artefaktkarta: scheman, manifest och lagring](ARTIFACTS.md) ·
[OpenClaw-talägarskap: implementationsbrief](OPENCLAW-SPEECH-OWNERSHIP.md) ·
[Takepaket för Kevin/Emil](templates/media-take.md).
