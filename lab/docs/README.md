# Scoutgaming: användarguide

Tre nivåer delar samma repo och sajt [www.scoutgaming.tech](https://www.scoutgaming.tech/) (apex `scoutgaming.tech` är en 308 till www). De är inte färdiga.

- **Nivå 1, intern personal**: [/control](https://www.scoutgaming.tech/control). Verktyg samlas under `/control/clips`, `/control/administration`, `/control/tree`, `/control/videos`, `/control/openclaw`, `/control/activity`, `/control/guide`, `/control/zones`, `/control/events`, `/control/probe` och `/control/operator-chat`.
- **Nivå 2, operatör**: [/partner](https://www.scoutgaming.tech/partner) och `/partner/{operatorSlug}`. Kevins importerade backoffice är bara denna förhandsvisning, inte kontrollpanelen. Riktig operatörsinloggning och tenantdata är inte klara. Kundval är ännu inte aktiverat; välj en tydligt märkt demonstration för att prova begränsade lane- och designval.
- **Nivå 3, spelare**: [/play](https://www.scoutgaming.tech/play), enkel ingång till [Blackjack](https://www.scoutgaming.tech/play/blackjack). Lobby, egen profil och historik återstår.

**En lane är en presentationsprofil**, inte en spelmotor eller en enskild film.
Intern personal producerar klipp, masker och urvalsregler. Partnern ska bara
välja tilldelat innehåll och tillåtna designval. Nivå 2 visar ännu lokala prov:
marker, kort, bord och bakgrund kan ändras i förhandsvisningen men skickas
inte till spelet. Lane-notisen och meddelandet vid ändring visar denna gräns.
Utkasten försvinner vid omladdning eller operatörsbyte.

Begrepp och en kort flödeskarta finns i
[den gemensamma systembeskrivningen](../../docs/LOCAL-PRESENTATION-RUNTIME.md#tre-nivåer-och-gemensamma-begrepp).
Gamla genvägar leder vidare; använd de nya menyadresserna för nya bokmärken.
Riktig partner-session och kundavgränsad sparning är kvarstående arbete, inte
något man får genom att välja en operatör i menyn.

**Personalens yta är `/control`.** `/studio` är Next.js-basePath för labb-servicen, inte en fjärde produkt och inte namnet i gränssnittet. I molnet öppnar du
[`/control`](https://www.scoutgaming.tech/control). Render-tjänsten `croupier-v2` äger
spelmotorn och live-transporten. Produktion och isolerad native-QA använder
Neon för revisionsstyrd policy och administrationsmetadata, i sina egna scopes.
Lokalt finns samma arbetsyta på det koordinerade Lab-parets `/`.
**Öppna spelet** fungerar med vanlig spelarinloggning även om
Partner-observationen saknas. **Anslut & följ spelet** öppnar samma
presentationsväg och kopplar dessutom spelflikens händelser till personalytan.
Spela och chatta i spelfliken. Administration är inloggning och konton,
ingen separat spelström.

**Vad betyder projekt här?** Ett sparat projekt är inställningar
för spelets presentation: exempelvis vilka dealerklipp som används och när
de spelas. "Lab-projekt" är inget separat projekt; det syftar på samma
sparning. Lab är arbetsmiljön. Personalens ingång är `/control`, inte `/studio`. Inställningarna och äldre
versioner sparas i Neon i både produktion och den isolerade native-QA-miljön.
Själva mediefilerna finns i privat Vercel
Blob och konton/saldo finns i Neon. Ett Vercel-projekt betyder i stället
en teknisk webbpublicering och har inget med sparknappen i labbet att göra.

Från Kontrollpanelen når du **Dealer & klipp**, **Administration** och **OpenClaw**.
De gamla interna exempelvyerna för klipp, tal, media och konton leder till
de riktiga verktygen. Oanslutna exempelvyer visar en förklaring i adminingången,
inte en andra editor med skenbart fungerande kontroller. Spelbolagets
arbetsytor ligger under **Spelbolag & spelare → Nivå 2**. Demo North och
Demo South är exempel, inte anslutna kunder. Framtida kundval ska hämtas från
verifierade, aktiva kundanslutningar; en API-nyckel eller ett inskrivet namn
är inte tillräckligt. Intern admin ska kunna välja mellan anslutna spelbolag,
medan spelbolagets egen personal bara får tillgång till sin organisation.
Välj dealer på klippsidan och arbeta i **Idle**, **Kort & deal**,
**Fasta repliker**, **Bakgrund** eller **Probe**. Uppladdning hör till
klipparbetet, inte till ett parallellt mediebibliotek. Granska i spel och
tekniska detaljer är sekundära verktyg; avancerade regler och diagnostik
ligger under Verktyg.

Klippöversikten visar kompakta situationskort med **Spela standard** och
**Inställningar**. Sök efter namn, replik eller plats; öppna **Filer** för
enskilda filmer och mappinformation. Idle visar en rad per variant med
användningen bredvid filnamnet. Öppna raden för beskrivning och tider;
fördelning, enminutsprov och hjälp ligger i egna utfällbara avsnitt.
Kategorierna och Administration delar samma lugna färger och knappar.
Detta ändrar inte originalspelarens Mobile Phone Lane eller klippvalen.
**Stäng av** betyder att ändra policyn; råfilen finns kvar.

Astrid har de aktuella familje-, idle- och Probe-editorerna. Vera, Amira
och Mei visar sina egna exakta medieregister och originalspelarens klippval;
de ärver inte Astrids idle/Probe-inställningar. Fasta repliker är inspelat
exakt tal, medan Probe kan skapa ett nytt tal-/videopaket när spelaren är
inaktiv. Ett syntetiskt Probe-textprov är inte en skapad eller spelad film.
Bakgrundsytans molnsparning är inte bevis på spelintegration.

Administration har 11 aktiva sektioner under drift/spelintegritet, spel/lanes/bord,
konton, partner, betalningar/journal och talgranskning. Lägga till, ta bort och
kontoåtgärder öppnas vid behov; listor och aktuella värden visas först.
Turneringar och pitboss-inställningar har tagits bort från gränssnittet eftersom
de saknar verifierad koppling till den aktuella spelvägen. Äldre sparade värden,
API-kontrakt och originalspelarens separata supervisor-logik finns kvar.
De tidigare rena informationspanelerna för klipp och AI-generering är borta;
klipparbete finns under Dealer & klipp. E-postmallar är förhandsvisningar.
Andra dealers visar bara de klippkategorier som stöds; Astrids Probe, bakgrund
och familjeuppladdning visas inte som verktyg för Vera, Amira eller Mei.

**Lanes:** spelmotorn bestämmer regler, kort och saldo. Den gemensamma
presentationskoden visar kort och spelar media. En lane väljer vilken
presentation och mediesamling som används. Mobile Phone Lane är enda
standardvalet; äldre Kevin-länkar väljer inte längre Kevin. I Administration →
Spel, lanes & bord kan en admin lägga till porträttlanes, välja aktiv lane
och ta bort lanes. De nya porträttlanerna delar Astrids bank och inställningar.
Om sista lanen tas bort stoppas ny Blackjack-start tills en lane läggs till.
Delad kod, media och sparade spel raderas inte av lane-knappen; medierensning
kräver en separat kontroll av återstående användning, inklusive QA.

Native administration på `/control` använder de befintliga kontonas rollkontroller och
den gemensamma Neon-källan. En inloggning där ger inga nya administrativa
rättigheter.

Native administration är aktiverad på `/control/administration` och har
även en separat QA-miljö med egen databas. Den använder samma sparade
revisionskälla som spelmotorn och bevarar osparade utkast vid en sparningskonflikt.
QA:s mejlkoppling och produktionskopplingen till Resend är verifierade,
inklusive invite/reset till Resends sandbox. Verkliga mottagares aktivering,
lösenordsåterställning och inkorg återstår att verifiera.
Befintliga konton
och saldo flyttas eller återställs inte för provet.

**Konton och lösenord:** använd samma användarnamn eller e-postadress och
lösenord i spelet och på `/control`. Du väljer ingen kontotyp i inloggningen.
**Intern adminpersonal, nivå 1** får använda hela `/control`, nivå 2 (`/partner`)
och nivå 3 (`/play`). Nivå 2 visar än så länge demonstrationer;
riktiga kundval följer anslutna spelbolag när kundanslutningen införs.
**Spelare, nivå 3** får använda
spelet och nekas `/control`. Ett äldre superadmin-konto fungerar som
admin; befintliga konton och saldo bevaras.

I den nya native-administrationen går du till **Administration → Konton**.
Skapa och hantera spelare där. För en aktiv eller blockerad spelare med
eget spelarlösenord anger du nytt lösenord två gånger och en anledning.
Gamla spelsessioner återkallas vid bytet; saldo och spelhistorik behålls.
Stängda konton har inget lösenordsbyte. Administratörers invitationer,
aktivering och återställningslänkar hanteras i samma Administration.
Ett administratörskonto som också spelar använder sitt administratörslösenord.

För att bjuda in intern personal: öppna **Administration → Konton →
Användare och roller → Bjud in adminpersonal – nivå 1**. Ange e-postadressen
och skicka inbjudan. Mejlet från **ScoutGamingGroup <no-reply@scoutgaming.tech>**
anger behörighet till hela nivå 1, nivå 2 och nivå 3 samt nivå 2:s aktuella
begränsning. Mottagaren väljer själv lösenord
via en engångslänk som gäller i 72 timmar. Därefter används samma e-postadress
och lösenord i administrationen och spelet. Återställningslänkar gäller i två
timmar. Ett skickat mejl är inte bevis på att mottagaren har aktiverat kontot.
Inbjudan gäller intern personal. Den skapar ingen kundorganisation eller
spelbolagsanställd; sådana konton ska vara organisationsavgränsade på nivå 2.

Aktuell driftversion, QA-bevis och återstående begränsningar finns i
[driftkartan](../../docs/CLOUD-MIGRATION.md).
Den nya [systemkartan](../../docs/system-map/index.html) visar tjänster, sidor,
databas/lagring, spel-/talflöden, nyckelnamn och befintliga tester. Den är en
fristående HTML-fil; kodinventering och tidigare driftbevis anges separat.
OpenClaw-sidan finns på `/control/openclaw` och visar agenternas modellval.
Sparning går genom labbets behörighetskontroll till OpenClaw på Render.
Gatewayens separata dashboard finns kvar för avancerad konfiguration och pairing.
Vanliga sparade klippval kräver ingen Render-omstart;
idleändringar kräver omladdning av spelfliken mellan händer.

Under klippens uppladdning väljer du exakt familj och originalklipp.
**Ladda upp och spara klipp** lagrar filmen i videobanken. Välj sedan hur
klippet får användas och tryck **Spara inställningar** för att behålla
urvalsreglerna. Ladda om originalspelaren mellan händer efter ändrad
idlepolicy eller originalmotorns klippval.
Astrids lokala deal-/replikval gäller nästa beslut; idle kräver omladdning.
Äldre BO-val är inaktiva och kan bara importeras uttryckligen vid säker match.
Lissabon-katalogen är avvecklad; äldre lokala data i `lab/data` bevaras som
historik och är inte produktionspolicy.
Se [vägar och strömmar](../../docs/LOCAL-PRESENTATION-RUNTIME.md)
för adresser, kompatibilitetsalias och de tekniska strömmarnas olika ansvar.

**Bakgrundszoner:** öppna **Bakgrund** på Astrids klippsida och dess zoneditor
(`/control/zones` i molnet, `/zones` lokalt). Rita en pixelruta på
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
klipp i privat Blob när ytan visar att molnlagringen är konfigurerad.
**Läs från molnet** öppnar molnvyn och behåller webbläsarkopian. Exportera JSON
och ladda ned klippen om du behöver en separat specifikation eller backup.
Automatisk gäller i Labbets förhandsvisning;
zonerna styr ännu inte spelets spelare. Kontrollera kameraregistrering och
ocklusion för varje tilltänkt klipp innan användning.

Start: `node lab/start.mjs --offline --no-open` för tomt prov utan externa
tjänster. `Start-Lab.cmd` behåller den befintliga privata anslutna profilen.
Avancerade verktyg nås genom **Avancerat labb** (`/control/tree` i molnet,
`/tree` lokalt). Lissabon, `/lab`, `/labb` och `/bo` är avvecklade alias.
Personalens ingång är `/control`.

Jakobs arbetsdokumentation visas i [Guide](https://www.scoutgaming.tech/control/guide)
(lokalt `http://127.0.0.1:4201/guide` på det koordinerade paret).
Innehållet finns i [guide.json](guide.json); ordlistan hämtas direkt från
[studio-contract.json](../policies/studio-contract.json). Uppdatera dessa,
inte en parallell användarguide eller ett nytt kategorinamn i en enskild vy.

Utvecklarreferenser: [start och arkitektur](../README.md),
[videoformat och lagring](../VIDEO-LIBRARY.md), [videoschema](../schemas/video.schema.json).
[Schemaöversikt](../schemas/README.md).
[Gemensam lokal presentationsruntime](../../docs/LOCAL-PRESENTATION-RUNTIME.md).
Händelsekategorierna ska överensstämma med projektets seed och motorns källkontrakt.
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
Detta läser lokala filer. I molnet används **Ladda upp klipp** och
**Läs in nya filer** läser serverbiblioteket; en lokal filändring publicerar
inte filmens nya byteinnehåll till molnet.

### Astrids Deal-frekvenser

I Administration/Lab → Kort och samma familj i avancerade labbet anger du procent för
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

Välj **Astrid → Idle** för den förenklade idleeditorn. Den har tre delar:
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

## Material och granskningsregler

Projekt-, video-, social- och idlescheman beskriver sparade inställningar och
kategorisering; produktens kanoniska mediemanifest binder de faktiska klippen.
Pose-spår är 2D-prov. Varken ett schema, en kategorisering eller en
filregistrering godkänner dealeridentitet, läppsynk eller kortkontakt.
Uppladdning och sparade urvalsregler är separata steg enligt flödet ovan;
lokala filmer publiceras inte av en källkodspush.

Använd [take-mallen](templates/media-take.md) vid medieöverlämning. Inspelat
tal ska ha exakt replik/text, ljud- och videohash, frame-index, fps, audio delay,
kalibrering, proveniens samt granskare och resultat för den aktuella revisionen.
Ändrad text, ljud- eller videohash ogiltigförklarar tidigare visuell acceptans.
Fri text får visas med neutral bild eller sitt eget matchande genererade paket,
aldrig med en gammal inspelad talfilm. Modellens klippval måste valideras mot exakt
registrerad dealer, familj/replik och revision; de får inte användas som fria
filvägar, event-ID:n eller speldata. Spelmotorn äger kort, saldo och resultat.
Native-eventrepliker behåller sin exakta mappning enligt chattavsnittet ovan.

Vid ändringar i gränssnitt eller spelare gäller följande regressionskrav:
behåll den gemensamma spelaren för alla fyra dealers och serialisera taljobben.
Ny preview ska pausa och återställa föregående preview; navigation, unmount
och pagehide ska släppa media. Återkomst från BFCache ska ge en användbar aktuell
vy utan dold fortsatt uppspelning. Huvudbild och matte är ett synkat kompositpar.
Avbrott, sena svar och dubbel leverans får inte starta ett jobb två gånger
eller lämna ljud, video, decoder, Blob-URL, timer eller caption aktiva.
Anslutning, urval och laddning ersätter inte spelarens faktiska start-/bild-/slutkvitton.
Behåll tangentbordsflöden, synligt fokus och `prefers-reduced-motion`.
Dessa krav är inte ett nytt driftprov eller en visuell acceptans.

Medie-/spelarändringar kräver dealer-audit `--probe`, de obligatoriska
regressionerna och granskning av alla fyra dealers i faktisk rehearsal,
inklusive två uppspelningar i följd, enligt [AGENTS.md](../../AGENTS.md).
Privata chattar, hemligheter och signerade medielänkar ska inte ingå i takepaket
eller publika loggar. Aktuella runtimekontrakt finns i
[presentationsguiden](../../docs/LOCAL-PRESENTATION-RUNTIME.md);
OpenClaws versionsbundna källor nås via [dess källindex](../../open-claw/lab/docs/README.md).
