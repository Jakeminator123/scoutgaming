# Guide — en gemensam ingång

**En arbetsyta: Croupier Studio.** I molnet öppnar du
[`/studio`](https://www.scoutgaming.tech/studio) på Vercel. Render äger
spelmotorn, API och sparade projekt. Lokalt finns samma arbetsyta på det koordinerade Lab-parets `/`.
**Öppna spelet** i molnstudion fungerar med vanlig spelarinloggning även om
Partner-observationen saknas. **Anslut & följ spelet** öppnar samma
presentationsväg och kopplar dessutom spelflikens händelser till Studio.
Spela och chatta i spelfliken. BO är administration och inloggning,
ingen separat spelström.

**Vad betyder projekt här?** Studios projekt är dina sparade inställningar
för spelets presentation: exempelvis vilka dealerklipp som används och när
de spelas. "Lab-projekt" är inget separat projekt; det syftar på samma
sparning. Lab är arbetsmiljön, Studio är editorn. Inställningarna och äldre
versioner sparas på Render-disken. Själva mediefilerna finns i privat Vercel
Blob och konton/saldo finns i Neon. Ett Vercel-projekt betyder i stället
en teknisk webbpublicering och har inget med Studios sparknapp att göra.

Menyn har tre huvuddelar: **Dealer & klipp**, **Backoffice** och **OpenClaw**.
Välj dealer på klippsidan och arbeta i **Idle**, **Kort & deal**,
**Fasta repliker**, **Bakgrund** eller **Probe**. Uppladdning hör till
klipparbetet, inte till ett parallellt mediebibliotek. Granska i spel och
tekniska detaljer är sekundära verktyg; avancerade regler och diagnostik
ligger under Verktyg.

Astrid har de aktuella familje-, idle- och Probe-editorerna. Vera, Amira
och Mei visar sina egna exakta medieregister och originalspelarens klippval;
de ärver inte Astrids idle/Probe-inställningar. Fasta repliker är inspelat
exakt tal, medan Probe kan skapa ett nytt tal-/videopaket när spelaren är
inaktiv. Ett syntetiskt Probe-textprov är inte en skapad eller spelad film.
Bakgrundsytans molnsparning är inte bevis på spelintegration.

Backoffice grupperar alla 14 befintliga funktioner under drift/spelintegritet,
bord/personal, konton, partner, betalningar/journal och mediegranskning.
Den befintliga Backoffice-backenden och dess rollkontroller används tills
den native ersättningen och API-/lagringsflytten är verifierade. En Studio-
inloggning ger inga nya administrativa rättigheter.

Den nya administrationen provas i en separat molnmiljö med egen databas.
Den använder samma sparade revisionskälla som spelmotorn och bevarar osparade
utkast vid en sparningskonflikt. Den är ännu inte aktiverad på den vanliga
Studio-adressen. Invitationer och lösenordsåterställning väntar på en verifierad
mejlkoppling; befintliga konton och saldo flyttas eller återställs inte för provet.

OpenClaw öppnar den befintliga autentiserade dashboarden på Render.
Agentinställningar, pairing och modell-/GPU-konfiguration förändras inte av
den nya menyn. Vanliga sparade klippval kräver ingen Render-omstart;
idleändringar kräver omladdning av spelfliken mellan händer.

Under klippens uppladdning väljer du exakt familj och originalklipp.
Spara med projektets vanliga knapp och ladda om originalspelaren mellan händer.
Astrids lokala deal-/replikval gäller nästa beslut; idle kräver omladdning.
Äldre BO-val är inaktiva och kan bara importeras uttryckligen vid säker match.
Lissabon-katalogen är avvecklad; sparade lokala data finns i `lab/data`.
Se [vägar och strömmar](../../docs/LOCAL-PRESENTATION-RUNTIME.md)
för adresser, kompatibilitetsalias och de tekniska strömmarnas olika ansvar.

**Bakgrundszoner:** öppna **Bakgrund** på Astrids klippsida och dess zoneditor
(`/studio/zones` i molnet, `/zones` lokalt). Rita en pixelruta på
1080×1920-startbilden, skapa ett tvåsekunders blinkklipp eller lägg in en
MP4/WebM med exakt rutans storlek. Välj **Automatisk · högst 2/minut** i zonens
Uppspelning om klippet ska starta själv: första start inom 10 sekunder,
sedan minst 30 sekunder plus 0–10 sekunders slump mellan starter. Klippet
spelas klart före nästa start. Välj **Hela tiden** för oavbruten loop eller
**Av** för att dölja det. Finjustera X, Y, bredd och höjd i zonens panel och
välj **Spara pixelruta**. Om storleken ändras behålls det gamla klippet för
nedladdning, men visas inte förrän du skapar eller lägger in ett klipp med de
nya måtten. Blinkklippet är en enkel ljuseffekt för prov, inte en mask som
automatiskt känner igen lampans pixlar. Välj en snäv ruta runt själva lampan
så att glöden inte spiller över väggen. Byt underliggande Astrid-film för att granska zonen
mot olika tagningar; zonens timer är oberoende av dealerklippet. Alla
provfilmer visas i samma 1080×1920-ruta, så en 612×1088-film skalas
proportionellt och zonen behåller samma relativa läge. Kamerans faktiska
registrering behöver ändå kontrolleras i varje tagning. Rutan är masken;
ljusläget blandar bort
svarta pixlar, medan normalläget visar filmens egen alfakanal om den finns.
**Webbläsarkopia** sparar koordinater och klipp i din lokala webbläsarprofil.
**Spara till molnet** sparar koordinater i zonernas separata Neon-databas och
klipp i privat Blob när Studio visar att molnlagringen är konfigurerad.
**Läs från molnet** öppnar molnvyn och behåller webbläsarkopian. Exportera JSON
och ladda ned klippen om du behöver en separat specifikation eller backup.
Automatisk gäller i Labbets förhandsvisning;
zonerna styr ännu inte spelets spelare. Kontrollera kameraregistrering och
ocklusion för varje tilltänkt klipp innan användning.

Start: `node lab/start.mjs --offline --no-open` för tomt prov utan externa
tjänster. `Start-Lab.cmd` behåller den befintliga privata anslutna profilen.
Avancerade verktyg nås genom **Avancerat labb** (`/studio/tree` i molnet,
`/tree` lokalt). Det äldre `/lissabon` inne i Lab omdirigerar till startsidan.

Jakobs arbetsdokumentation visas i [Guide i labbet](https://www.scoutgaming.tech/studio/guide)
(lokalt `http://127.0.0.1:4201/guide` på det koordinerade paret).
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

Tekniska fördjupningar finns i den [aktiva systemkartan](../../docs/LOCAL-PRESENTATION-RUNTIME.md).
Det pensionerade personarkivet ingår inte i dokumentationsflödet.

**Händelseloggen** på `/activity` skiljer källa, eventdata, kontext, beslut och
uppspelningskvitto. **Anslut** verifierar Partner-åtkomst, öppnar rätt
originalsession och startar läsande observation.
Observation startar ingen separat Lab-spelare. Native-kedjan visar mottaget
event, klippval och verkliga start-/bild-/slutkvitton med sparad revision.
Partner-SSE visas som separat diagnostik. För övriga dealers kräver separat
Lab-preview ett uttryckligt val; dess kvitton är tydligt skilda från spelets.
För Astrid öppnas nu `?dealer=astrid&presentation=local`: Web är ensam spelare
och Lab visar **En spelare · Web**. Spela och chatta i spelfliken. Valfri
bilddelning speglar just den fliken; speldata fungerar även utan bilden.
Grundläget **Standard** gör inga AI-klippval; välj OpenClaw eller Skuggläge
i spelets klippväljare om du vill prova modellval.
Chattsvar är ett separat val och påverkas inte av denna klippväljare.

Astrids valbara kamera/mikrofon finns i samma spelflik, Av som standard.
Aktuella kontroller och provgränser beskrivs i
[kamera- och talguiden](../../docs/LOCAL-PRESENTATION-RUNTIME.md).
Driftens aktiverade funktioner och återstående liveprov följs i
[molnstatusen](../../docs/CLOUD-MIGRATION.md).
För lokalt kameratest används den koordinerade startarens `--astrid-camera`;
stoppa ett befintligt par före byte och använd alltid `--no-open` från Codex.

## Idle i Eventstudion

Astrids Eventstudio och native-följning använder nu samma exakta mediefamilj:
`box0` → `deal_pos1`, …, `box6` → `deal_pos7`, samt exakt `speak.line` →
`repliker/<line>/`. Situationsväljaren ändrar bara manuella exempel; mottagna
events behåller kort, box, handindex och replik. Standardfil och varianter
kommer från manifestet, inte från projektets gamla 2D-demovarianter.

Manifest v2 grupperar deal, kortvändning, exakta repliker och idle.
Aktuellt filantal och innehåll finns i [det kanoniska manifestet](../../media/dealers/astrid/runtime/presentation/lab-video-manifest.json).
Deal/replik använder
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
Detta läser lokala filer. I molnstudion används **Ladda upp & bibliotek** och
**Läs in nya filer** läser serverbiblioteket; en lokal filändring publicerar
inte filmens nya byteinnehåll till molnet.

### Astrids Deal-frekvenser

I Backoffice/Lab → Kort och samma familj i avancerade labbet anger du procent för
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

De registrerade klippen i `media/dealers/astrid/runtime/presentation` är källan för Astrids
manifeststyrda familjer. Arbetskopior och backuper på skrivbordet är inte
automatiskt spelbara eller molnpublicerade. Nya varianter är manuella tills
de uttryckligen läggs till och aktiveras i den sparade policyn.

Översikten och Videobanken visar samma fysiska familjer. Uppspelningskvittot för
en MP4 innehåller fil-ID, filnamn och familj. Ett beslut utan spelarens kvitto
räknas inte som uppspelat. OpenClaw-källorna finns även i Guide och Chatt &
OpenClaw. Aktuell anslutning: [driftkvitto](../../open-claw/lab/docs/CLOUD-ACTIVATION-2026-09-29.md).

Välj **Astrid → Vänteläge** för den förenklade idleeditorn. Den har tre delar:
grundloop, korta variationer och ett deterministiskt enminutsprov. Grundläget
består av `idle_still` och `idle_breath`. `idle_blink`, `idle_cheek`,
`idle_glance`, `idle_insulted`, `idle_smile`, `idle_yawn` och
`croupier_coffie` är engångsvarianter.
Beskriv **När passar klippet?** med högst 80 tecken. Texten följer kandidaten
till OpenClaw som konfigurationsdata, inte som en systeminstruktion.

Mappstrukturen är kontraktet för släktskapet:

- `media/dealers/astrid/runtime/presentation/idle/*.mp4` är loopande grundklipp.
- `media/dealers/astrid/runtime/presentation/idle/variant/*.mp4` är korta varianter.
- policyn `lab/policies/idle-policy.seed.json` bestämmer grundvikter och om en
  variant är manuell, automatisk, regelstyrd eller OpenClaw-valbar.

Det avancerade labbets startpolicy visar `idle_still` med 90 % grundvikt och schemalägger blinkning
ungefär var 25:e sekund med ±5 sekunders variation. Eftersom blinkklippet tar
tid blir `idle_still` i praktiken ungefär 79 %, vilket editorn visar. Ett
spel-, deal- eller talprov äger spelaren och blockerar idleprovet tills det är
klart. Policyn sparas i det aktiva serverägda Lab-projektet. Web-spelaren läser
samma projekt; ladda om spelfliken efter ändringar i idlepolicyn. Labs startprofil
erbjuder i stället de ursprungliga sex variationerna till OpenClaw; kaffeklippet
börjar som manuellt. Ingen fjärrdrift deployas
och OpenClaw behöver inte startas om när beskrivningar eller val ändras.

Grundvikt är alltså inte faktisk tidsandel. Automatisk idlevariant följer
intervall, jitter, cooldown och maxfrekvens. OpenClaw-valbar variant kräver en
färsk chattmöjlighet; manuell variant schemaläggs inte. Regelstyrd idle har
ännu ingen ansluten trigger och kan inte nyväljas i editorn.
Det deterministiska enminutsprovet spelar exakta registrerade klipp och loggar
start/slut/återgång. En uttryckligen öppnad separat Lab-preview använder en
idle-controller med samma sparade policy: verkligt `ended` väljer nästa klipp,
och cooldown/maxfrekvens räknas från faktiska starter. Deal går först och färdigt
tal återställer en ny primärbas innan talgrinden öppnas. Varianter eller sekundär
bas ger aldrig standardpositionskvitto. I Astrids lokala presentationsläge
används controllern av Web. Observation startar ingen parallell film för någon dealer.

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
poster; observationsprotokollet håller högst 300 meddelanden/4 MiB i
flikens minne. Avancerat Lab stoppar vid gränsen, fokuserad Studio rullar
fönstret med gap-/bortfallsmarkör och är då ingen full historik.
Exportera före omladdning. Native-observation kräver den nya
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
utan sessionnycklar och spelas först efter en ny renderad primärbas i spelfliken.
Lab följer spelarens uppspelningskvitton.
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

[Signal- och begreppskartan](../../docs/LOCAL-PRESENTATION-RUNTIME.md)
förklarar RNG kontra spelfakta, Partner kontra native-status, de 16 genvägarna,
relevanta situationer och föreslagen gemensam bild-/taluppspelning. Kartan skiljer
nuvarande kod från nästa steg; den aktiverar inte nya funktioner.

Aktuellt arbete och kvarvarande QA finns i [handoffen](../../docs/JOHN-HANDOFF.md). Nya sprintdokument är pausade.

[Artefaktkarta: scheman, manifest och lagring](ARTIFACTS.md) ·
[OpenClaw-talägarskap: implementationsbrief](OPENCLAW-SPEECH-OWNERSHIP.md) ·
[Takepaket för Kevin/Emil](templates/media-take.md).
