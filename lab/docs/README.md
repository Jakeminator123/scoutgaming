# Guide — en gemensam ingång

Jakobs arbetsdokumentation visas i [Guide i labbet](http://127.0.0.1:4188/guide).
Innehållet finns i [guide.json](guide.json); ordlistan hämtas direkt från
[studio-contract.json](../policies/studio-contract.json). Uppdatera dessa,
inte en parallell användarguide eller ett nytt kategorinamn i en enskild vy.

Utvecklarreferenser: [start och arkitektur](../README.md),
[videoformat och lagring](../VIDEO-LIBRARY.md), [videoschema](../schemas/video.schema.json).
[Dashboardens Scout-design, rörelse och lokala körning](DASHBOARD-DESIGN.md).
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
Originalbild och labbpresentation visas sida vid sida. Webbläsaren kräver
fortfarande att du väljer spelflik för bilddelningen; speldata fungerar även
utan bilden. Spela i originalfliken. Grundläget **Bara standard** gör inga
modellanrop; välj OpenClaw eller Skuggläge om du vill prova modellval.

## Idle i Eventstudion

Astrids Eventstudio och native-följning använder nu samma exakta mediefamilj:
`box0` → `deal_pos1`, …, `box6` → `deal_pos7`, samt exakt `speak.line` →
`repliker/<line>/`. Situationsväljaren ändrar bara manuella exempel; mottagna
events behåller kort, box, handindex och replik. Standardfil och varianter
kommer från manifestet, inte från projektets gamla 2D-demovarianter.

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
klart. Policyn sparas lokalt med projektet och publiceras inte till spelet.

Native-observern ger publika kommandosvar, bordsvy och instrumenterade
playback-/chattsignaler. Partner-SSE är kompletterande rundinstruktioner.
Transport ansluten betyder ännu inte speldata mottagna. Samma instruktion
slås ihop; konflikter och luckor stoppar följningen. Kontextsidan anger vilka
publika fakta OpenClaw får och vilka uppgifter som saknas.

Den kan även skicka högst åtta observerade chattmeddelanden före aktuellt
event (600 tecken vardera, 3 200 totalt) som märkt data för variantval.
Director måste kvittera kontextkontrakt v2; äldre tjänst ger synlig
standardreserv tills den uppdaterats. Detta gör inte OpenClaw till produktens
färdiga talägare. Ett isolerat lokalt prov startas med
`node tools/start-local-comparison.mjs` efter labbygge; se README:s provavsnitt.

**Diagnostik** samlar verifiering, videokarta, import/export och särskilda
videolägen. Sekvenssteg öppnar befintlig editor. Loggen håller högst 150
poster; hela observationsprotokollet håller högst 300 meddelanden/4 MiB i
flikens minne. Exportera före omladdning. Native-observation kräver den nya
spelarkoden på vald server; lokal merge är inte Bettalotto-deploy.
Vid full historik: exportera och välj **Ny observation** i Diagnostik.
Det ersätter protokollet och gamla labbkön men behåller spelet och anslutningen.
Konfiguration och gränser finns i [labbets README](../README.md#läsande-partner-ström).

**Socialt svar** är ett eget idle-prov med en enda talägare och högst 25
sekunder ljud. För långa ljud avvisas; avbrott/fel loggas. Modellens uttrycks-
förslag visas separat från neutralt idle. Produktens talväg och riktig
läppsynk är fortfarande separata integrationer. Se [socialt prov](../SOCIAL-CHAT.md).

[Signal- och begreppskartan](../../random-stuff-jakob/jakob-docs/systemkarta/02-events-triggers-urval/SIGNALER-OCH-TAKES.md)
förklarar RNG kontra spelfakta, Partner kontra native-status, de 16 genvägarna,
relevanta situationer och föreslagen gemensam bild-/taluppspelning. Kartan skiljer
nuvarande kod från nästa steg; den aktiverar inte nya funktioner.

Aktuell plan och publicerade läsytor finns i [V5 · sju arbetsdagar](../../docs/animation-events/v5-7-days-mvp/README.md). Guide beskriver dagens labb; sprintplanens förslag aktiverar inga funktioner.

[Artefaktkarta: scheman, manifest och lagring](ARTIFACTS.md) ·
[OpenClaw-talägarskap: implementationsbrief](OPENCLAW-SPEECH-OWNERSHIP.md) ·
[Takepaket för Kevin/Emil](templates/media-take.md).
