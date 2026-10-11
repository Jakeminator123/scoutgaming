# Scoutgaming: användarguide

Ordlista för teamet: [`TERMINOLOGI.md`](TERMINOLOGI.md).

Tre nivåer delar samma repo och sajt [www.scoutgaming.tech](https://www.scoutgaming.tech/) (apex `scoutgaming.tech` är en 308 till www). De är inte färdiga.

- **Nivå 1, intern personal**: [/control](https://www.scoutgaming.tech/control). Studio samlar **Dealers & klipp**, **Sammansättning** och **Publicering**. Sidomenyn har dessutom Drift, AI & chatt och Administration. Relaterade alternativ öppnas inom arbetsytan; se [menykartan](TERMINOLOGI.md#meny-och-adresser).
- **Nivå 2, operatör**: [/partner](https://www.scoutgaming.tech/partner) och `/partner/{operatorSlug}`. Partnerportalen är den här ytan, inte kontrollpanelen. Bolag, roller och medlemskap skapas under Administration → Bolag & team på `/control/lanes?tab=companies`; en ny e-postadress får en aktiveringslänk till `/partner/set-password`. Bolagets utseende (`branding`, bordsfärg) läses och skrivs inom lanen av en medlem med `presentations.configure`.
- **Nivå 3, spelare**: [/play](https://www.scoutgaming.tech/play), [profil](https://www.scoutgaming.tech/play/profil), [historik](https://www.scoutgaming.tech/play/historik) och [Blackjack](https://www.scoutgaming.tech/play/blackjack). Lobby, profil och historik finns. Profilen kan redigeras (namn och språk) när `006-player-profile.sql` körts mot spel-Neon. Lobbyn låter dig välja bland bolag som har spelbara publicerade rum. `?operator=` öppnar bolagets rum direkt. Vercels `/play/blackjack` utan valt spelmål går till lobbyn; enbart `?operator=` går till bolagets lobby. Rummets startlänk begränsar dealer och miljö till paketet. Renders direkta `/blackjack?operator=` behåller sin spelväg. Acceptans av dealermedia sker i rehearsal: `?dealer=<namn>&rehearsal=1` (en länk per dealer) och `?lane=layer-preview&rehearsal=1` för lagerlanen; se [terminologin](TERMINOLOGI.md#acceptans-och-prov).

Partnerportalen är nivå 2. Operatörens personal loggar in på `/partner/login`. Intern personal ser fortfarande den märkta demonförhandsvisningen. Spelare och transaktioner är inte anslutna.

**Vem gör vad?** Nivå 1 är vår administration: vi skapar dealerklipp, sekvenser och grundloopens regler, bygger biblioteket av bord och bakgrunder samt sätter ihop och tilldelar bolagens paket. Nivå 2 är spelbolagets åtkomst och API: bolaget granskar och gör de små designjusteringar som det tilldelade paketet tillåter. Det ger ingen rätt att redigera dealerns sekvenslogik. Nivå 3 är spelarens lobby och spel.

**Dealer, presentation och spelrum är olika saker:**

- **Dealer**: en person med egen grundloop och egna klipp kopplade till spelhändelser.
- **Bord**: det visuella bordslagret. Välj en bild för ett statiskt bord.
- **Bakgrund**: ett separat lager; en bakgrundsfilm loopas.
- **Presentation**: sparade standardval, tillåtna dealers/bord/bakgrunder och placering per format.
- **Partnerpaket**: en publicerad version av bolagets tilldelade presentationer och val.
- **Spelrum**: den spelbara länken som kopplar bolaget till en publicerad presentation.

Tekniskt heter en presentation presentationslane. En spellane är spelmotorns interna väg; du behöver inte skapa den manuellt. Även Administrationens **Lägg till teknisk spelkonfiguration** skapar ID automatiskt och låter dig välja dealer ur en lista. Exakta gamla ID:n används bara vid uttrycklig återställning under Avancerat.
Börja i **Dealers & klipp**: välj dealer och redigera grundloop och händelseklipp. Öppna sedan **Sammansättning**, där du väljer, skapar och namnger presentationen. Öppna Dealer, Bord eller Bakgrund i lagerpanelen. Filval och **Storlek och placering** ligger tillsammans för valt lager. Mobil och Desktop har egna inställningar; återställning gäller bara valt lager i aktuellt format. Scenen visas intill reglagen på större skärmar. På mobil ligger den i sidans vanliga flöde så att lagerknapparna är åtkomliga. Spara och fortsätt till **Publicering**.
Klippbibliotek, Händelser och Tal vid inaktivitet nås från Dealers & klipp, med vald dealer kvar.
Dealers & klipp är dealerbiblioteket: fem dealers där betyder inte fem spelbara rum. Länken till Sammansättning öppnar först en befintlig presentation där vald dealer är startdealer, annars en där den är tillåten. En uttryckligen vald presentation behålls. Om dealern inte ingår visas det tydligt; inga dealer- eller paketrättigheter ändras av att följa länken.
Sammansättning är den enda editorn för presentationen. **Ny sammansättning** behöver bara ett namn; ett stabilt tekniskt ID skapas automatiskt och finns under Avancerat. Dealerklipp laddas upp och kopplas till händelser i Dealers & klipp; Bord och Bakgrund laddas upp vid respektive lager. Under Avancerat i Sammansättning finns bevarade uppspelningspolicyer, bordsfärger och vilka mindre ändringar bolaget får göra. Publicering visar bolagets paketval och spelrum samt en länk tillbaka till vald sammansättning.
**Provspela** startar blackjack i samma flik från den sparade sammansättningen. Spara först och avsluta tillfälliga filprov; uppladdning, konflikt eller pågående sparning blockerar starten. Provet använder en tidsbegränsad adminsession med sparade dealers, bord och bakgrunder från biblioteket, utan bolagspublicering eller påverkan på riktiga spelarkonton. Startdealern måste ha en grundloop. Andra ofullständiga dealers visas med orsak och kan inte väljas. Standard, Regler och Slump kan provas; externa OpenClaw-anrop och genererat tal är avstängda i provet. Fullbildsklipp behåller sin inbakade miljö. **Till Sammansättning** återgår till presentationen som startade provet.

Vald presentation följer länkarna mellan Sammansättning och Publicering. Spara och fortsätt i Sammansättning inväntar serverns kvitto; konflikt eller nyare ändringar lämnar dig i utkastet.
På Dealers & klipp kan du lägga till en egen dealer, exempelvis **Johanna**, och spara projektet.
Dealern får egna, tomma händelsekopplingar. Registrera filmen under den nya dealern
och välj den som basklipp i Grundloop. Samma film kan återanvändas under ett nytt
media-ID utan att ta över en annan dealers registrering. Varje film
har ett eget val **Fullbild / grönskärm** med tröskel, mjukhet och färgspill.
Greenscreen är en filinställning och bevisar inte att klippet är visuellt godkänt.
En egen dealer kan tas bort med **Ta bort dealer ur utkastet** när ingen presentation i utkastet använder den. Då tas identiteten, händelsekopplingarna och dess grundloopschema bort ur utkastet. Spara efteråt. Grunddealers skyddas, och filmer samt publicerade paket finns kvar. Om spelet fortfarande hänvisar till dealern kan servern neka sparningen; borttagningen avpublicerar inte ett aktivt spelrum.

I Sammansättning ändrar **Dealer** presentationens startdealer. **Tillåtna dealers i presentationen** visar uttryckligen vilka dealers som följer med; avmarkera äldre dealers som bolaget inte ska få välja. Startdealern ingår alltid. Byte av startdealer behåller övriga val tills du ändrar dem. Bord och Bakgrund visar på samma sätt sina tillåtna alternativ.
**Förhandsvisa klipp** byter endast provfilm. **Dealerklipp, grundloop och händelser** öppnar Dealers & klipp för det sparade basklippet och andra händelser.
**Grundloop** är det svenska namnet på `idle`, inte en separat inställning. Utan eget schema loopar dealerns valda basklipp. För en egen dealer öppnar **Anpassa grundloop** samma editor för basklipp och variationer som Astrid använder, med en separat policy för just den dealern.
Välj **Automatik** för intervall, slumpmarginal, minsta paus och högst antal per minut. **OpenClaw** väljer bland uttryckligt tillåtna variationer med deras beskrivningar när anslutningen och presentationens inställningar tillåter det. **Bara manuellt** startar inga automatiska variationer. För en egen dealers idlevariation kan du välja **Regler**. Under **Händelser → Grundloop** skapar du en variant med samma klipp, tillåter Regler och kopplar ett villkor för själva utdelningen eller vändningen; chattvillkor används inte här. Välj också **Regler** i spelets **Klippval**. Endast matchande sparade villkor kan utlösa variationen, utan separat tidsintervall. Grunddealers använder fortsatt sina befintliga val.
Klipplängden hämtas från den exakta filmen. Spara inställningarna och publicera partnerpaketet igen; spelet använder samma grundloopsstyrning men blandar aldrig olika dealers scheman eller filmer.
Utdelning skiljer Spelarplats 1–7 från dealerns öppna och dolda kort.
En position utan klipp hoppas över i spelet utan ersättningsfilm och stoppar inte
publicering. Kortet visas fortfarande av spelmotorn. Vänster/mitten/höger är
tekniska grupper för platser 1–2, 3–5 och 6–7; välj den exakta spelarplatsen. Hand- och
kortnummer hör till den exakta händelsen; saknad platskoppling visas som saknad.
Lagerbiblioteket tar bild/video när den sparade studion är ansluten. Videoeditorn
visar mobil/desktop, position, storlek, lager av/på och två uppspelningar.
Tre lokala filer kan provas direkt; detta prov sparar eller laddar inte upp filerna.
Placeringarna sparas i presentationen och fryses i bolagspaketet.

I **Publicering** väljer du bolag och **Presentation för spelrum**. Under **Spelrum** visas befintliga aktiva rum som hör till både bolaget, presentationen och det publicerade paketet. Öppna rummets egen länk, eller gå via den allmänna Blackjack-länken och välj först bolag i lobbyn.
**Publicera partnerpaket** visar vilka presentationer som ska ingå. Markeringarna ersätter paketets presentationsurval; behåll alla presentationer som bolaget fortsatt ska ha. Publicera igen för att uppdatera befintliga rum utan att skapa nya.
**Öppna bolagets spellobby** leder till `/play?operator=<bolag>`. **Visa alla bolag** återgår till bolagsvalet. Administratörens inloggningsuppgifter fungerar även i den gemensamma spelarinloggningen, som skapar en separat spelarsession. För ett isolerat test med testsaldo används **Provspela** i Sammansättning. Lobbyn visar endast befintliga öppna rum i bolagets publicerade paket. Spelaren väljer rum, dealer och tillåtna bord- och bakgrundsalternativ innan **Spela med …**. Namnen kommer från det publicerade registret. Fullbildsdealers visar att bord och bakgrund ingår i dealerfilmen; de får inga separata lagerval. Ett tomt paket visar inga öppna rum. Ett läsfel visar ett felmeddelande, inga reservdealers.
Rummets identitet och vald dealer följer med genom spelarinloggningen. Val av bordets utseende och bakgrund sparas i den här webbläsaren per bolag och kontrolleras på nytt av spelet. Spelrum är ingången till paketet; **Bord** är bildlagret i scenen, inget separat spelrum eller extra innehållslager.

Bara när ett nytt rum behövs öppnar du **Skapa nytt spelrum** och anger rumsnamn. Rummet och paketet sparas tillsammans; en kompatibel spellane återanvänds eller skapas automatiskt.
Nivå 2 kräver partnerinloggning och aktivt medlemskap; där kan personalen välja publicerade, kompatibla alternativ som bolaget får ändra. Geometrin följer den publicerade N1-sammansättningen. Ett bolag utan medlemmar får ingen N2-inloggning automatiskt.

Spelaren nycklar endast ett valt klipp som uttryckligen är märkt Greenscreen.
Fullbildsklipp behåller sina egna bord och bakgrunder. En egen dealers grundloop
kräver ett eget sparat basklipp och spelas ljudlöst. Publiceringen fryser exakt
media-ID, filhash och grönskärmsinställningar. En senare utkaständring ändrar inte
det publicerade klippet. Paketformat v3 fryser även egna dealers uttryckligt sparade
händelsekopplingar, klippval och media. Filmer som enbart finns i biblioteket följer inte med.
Dealern börjar i grundloop, spelar ett publicerat klipp vid en matchande spelhändelse
och återgår sedan till grundloop. Saknad koppling lånar aldrig en annan dealers film;
spelets kort fortsätter visas. Ett uttryckligen sparat schema för en egen dealer
fryses också med paketet och styr dess basklipp, automatik och tillåtna OpenClaw-variationer.
Grundloopen ensam är fortfarande standard när inget schema har sparats.
Äldre v2-paket behåller enbart den egna dealerns grundloop tills de återpubliceras.
Live AI-chatt är fortsatt avgränsad till originaldealers. Paket v3 kräver motsvarande
versionsförhandlade stöd på Render; ett avvisat sparande lämnar utkastet kvar.
Render måste uppdateras separat om automatisk deploy är avstängd.
Alla dealerpaket behöver godkännas i spelets repetition. Paow/Dragge-provet finns kvar.


Intern personal producerar klipp, masker och urvalsregler. Partnern ska bara
välja tilldelat innehåll och tillåtna designval. Inloggad nivå 2 läser det frysta
operatörspaketets dealer, bord och bakgrund, inklusive bild- och videoformat.
Bord, Bakgrund och Presentationslanes visar paketets tillåtna inställningar;
Färger, marker och kort visar dess branding. Skrivning kräver
`presentations.configure`, rätt revision och val inom samma tilldelade lane.
Fullbildsklipp behålls; deras inbakade bord och bakgrund kan inte bytas separat.
Äldre paket behöver återpubliceras under Publicering för att få lagerformatet.
Provbord länkar till den riktiga spelklienten med bolag och faktiskt tilldelat,
aktivt spelrum. Ett äldre paket utan sådant rum behöver kompletteras via Publicering.
Marker och kort saknar ännu publicerade designval. De gamla lokala designproven
visas bara i den märkta interna fixturen och försvinner vid omladdning.

Begrepp och en kort flödeskarta finns i
[den gemensamma systembeskrivningen](../../docs/LOCAL-PRESENTATION-RUNTIME.md#tre-nivåer-och-gemensamma-begrepp).
Gamla genvägar leder vidare; använd de nya menyadresserna för nya bokmärken.
Partner-session finns via `/partner/login` (partner-API:t svarade 503 i produktion 7–8 okt tills `e97f32df`; kontrollera efter varje deploy).
Chips är inte klara (L4), och ett menyval ger ingen behörighet.

**Personalens yta är `/control`.** `/studio` är Next.js-basePath för labb-servicen.
Dess rot omdirigerar permanent till `/control/clips` och bevarar query-parametrar;
tidigare återexporterade roten samma klippkomponent och visade därför samma innehåll.
API och tillgångar under basePath behålls. I molnet öppnar du
[`/control`](https://www.scoutgaming.tech/control). Render-tjänsten `croupier-v2` äger
spelmotorn och live-transporten. Produktion och isolerad native-QA använder
Neon för revisionsstyrd policy och administrationsmetadata, i sina egna scopes.
Lokalt finns samma arbetsyta på Lab-paret som `node lab/start.mjs` startar, på `/`.
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

Översikt har snabbvalen **Dealers & klipp**, **Sammansättning** och **Publicering**. På mobil öppnar **Meny** de samlade verktygen; Escape stänger och återför fokus. Val av anslutet bolag följer länkarna till partnern och spelarytan. En otillgänglig bolagslista visas som ett driftfel; demonstrationsbolag märks separat.
Administration och AI & chatt nås i sidomenyn.
De gamla interna exempelvyerna för klipp, tal, media och konton leder till
de riktiga verktygen. Oanslutna exempelvyer visar en förklaring i adminingången,
inte en andra editor med skenbart fungerande kontroller. Spelbolagets
arbetsytor nås via **2 · Spelbolag** i sidhuvudet. Demo North och
Demo South är exempel, inte anslutna kunder. Framtida kundval ska hämtas från
verifierade, aktiva kundanslutningar; en API-nyckel eller ett inskrivet namn
är inte tillräckligt. Intern admin ska kunna välja mellan anslutna spelbolag,
medan spelbolagets egen personal bara får tillgång till sin organisation.
Välj dealer på Dealers & klipp och arbeta i **Grundloop**, **Utdelning** eller
**Repliker**. Grundloop upprepar idle-klipp: basklippet visar vila/andning,
variationerna kan till exempel visa att dealern kliar sig i huvudet.
Vikter, urvalsregler, tester och diagnostik öppnas vid behov under Avancerat.
Uppladdning hör till
klipparbetet, inte till ett parallellt mediebibliotek. Granska i spel och
tekniska detaljer är sekundära verktyg; avancerade regler och diagnostik
ligger under Avancerat i respektive vy.

Klippöversikten visar kompakta situationskort med **Spela standard** och
**Inställningar**. Sök efter namn, replik eller plats; öppna **Filer** för
enskilda filmer och mappinformation. Grundloop visar en rad per variation med
användningen bredvid filnamnet. Öppna raden för beskrivning och tider;
fördelning, enminutsprov och hjälp ligger i egna utfällbara avsnitt.
Kategorierna och Administration delar samma lugna färger och knappar.
Detta ändrar inte originalspelarens Mobile Phone Lane eller klippvalen.
**Stäng av** betyder att ändra policyn; råfilen finns kvar.

Astrid har de aktuella familje-, idle- och Probe-editorerna. Vera, Amira
och Mei visar sina egna exakta medieregister och originalspelarens klippval;
de ärver inte Astrids idle/Probe-inställningar. Fasta repliker är inspelat
exakt tal. **Tal vid inaktivitet** ligger under Studio. Det separata textprovet
skapar inte ljud eller video. Spelmotorns väg kan be om ett talpaket bara om taltjänsten finns.
Ett syntetiskt textprov är inte en skapad eller spelad film.

Administration visar 11 sektioner under drift/spelintegritet, spel/lanes/bord,
konton, partner, betalningar/journal och talgranskning. Lägga till, ta bort och
kontoåtgärder öppnas vid behov; listor och aktuella värden visas först.
Turneringar och pitboss-inställningar har tagits bort från gränssnittet eftersom
de saknar verifierad koppling till den aktuella spelvägen. Policyn
`STUDIO_ADMIN_SECTIONS` listar fortfarande 15 poster, inklusive pit och turneringar.
Äldre sparade värden,
API-kontrakt och originalspelarens separata supervisor-logik finns kvar.
De tidigare rena informationspanelerna för klipp och AI-generering är borta;
klipparbete finns under Dealers & klipp. E-postmallar är förhandsvisningar.
Andra dealers visar bara de klippkategorier som stöds; Astrids talinitiativ
och familjeuppladdning visas inte som verktyg för Vera, Amira eller Mei.

**Publicering:** spelmotorn bestämmer regler, kort och saldo. Den gemensamma
presentationskoden visar kort och spelar media. En lane väljer vilken
presentation och mediesamling som används. Partnerns spelrum väljer sin tilldelade
presentation via paketet. I Administration → Bord & spelrum finns den tekniska
hanteringen av spellanes; vanliga Studioflödet kopplar dem automatiskt.
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
och nivå 3 (`/play`). Utan `partner_session` visas demonstrationer.
Inloggad operatör ser sitt bolags snapshot och det publicerade lane-paketet.
Tillåtna branding- och lagerval sparas på paketet. Spelare, transaktioner och
rapporter från spelmotorn är ännu inte anslutna till partnerportalen (N2.4).
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
idleändringar i den lokala uppspelningsvägen kräver omladdning mellan händer.
För en publicerad egen dealer krävs först ompublicering av paketet och sedan
omladdning. Enbart omladdning behåller den publicerade grundloopen.

Under klippens uppladdning väljer du exakt familj och originalklipp.
**Ladda upp och spara klipp** lagrar filmen i videobanken. Välj sedan hur
klippet får användas och tryck **Spara inställningar** för att behålla
urvalsreglerna. Ladda om originalspelaren mellan händer efter ändrad
idlepolicy eller originalmotorns klippval.
Astrids lokala deal-/replikval gäller nästa beslut; idle kräver omladdning.
Äldre BO-val är bevarad historik och visas inte som importerbara val i Dealers & klipp.
Välj aktiva klipp direkt ur dealerns registrerade filer. Tidigare granskningsspärrar gäller fortfarande.
Äldre lokala data i `lab/data` bevaras som
historik och är inte produktionspolicy.
Se [vägar och strömmar](../../docs/LOCAL-PRESENTATION-RUNTIME.md)
för adresser, kompatibilitetsalias och de tekniska strömmarnas olika ansvar.

**Bord och bakgrund:** välj eller ladda upp bild/video i Sammansättning.
Greenscreen-dealern, bordet och bakgrunden kan spelas som separata lager.
Bakgrundszoner har tagits bort ur arbetsflödet; tidigare sparade zondata bevaras.

Start: `node lab/start.mjs --offline --no-open` för tomt prov utan externa
tjänster. `node lab/start.mjs --no-open` behåller den befintliga privata anslutna profilen.
Avancerade verktyg nås genom **Händelser** (`/control/events`; utan `?event=` visas
översikten över alla event, med `?event=` redigeraren). `/control/tree` och `/tree` omdirigerar
dit. `/lissabon`, `/lab`, `/labb` och `/bo` är avvecklade alias.
Personalens ingång är `/control`. Adressen `?dealer=` och `?event=` följer med på Studio-sidorna. `?variant=` följer med på Händelser och Klippbibliotek. `?tab=` är `event`, `triggers` eller `variants` på Händelser, `chat` på OpenClaw och `tables`, `operations`, `finance` eller `accounts` på Administration. Gamla `#probe`, `#background` och `#stream` på Dealers & klipp leder till Tal vid inaktivitet, Sammansättning och Uppspelning. Varianter för Vera, Amira och Mei sparas men används inte av spelet ännu (L19).

Jakobs arbetsdokumentation visas i [Guide](https://www.scoutgaming.tech/control/guide)
(lokalt `http://127.0.0.1:4201/guide` på paret från `node lab/start.mjs`).
Innehållet finns i [guide.json](guide.json); ordlistan hämtas direkt från
[studio-contract.json](../policies/studio-contract.json). Uppdatera dessa,
inte en parallell användarguide eller ett nytt kategorinamn i en enskild vy.

Utvecklarreferenser: [start och arkitektur](../README.md),
[videoformat och lagring](../VIDEO-LIBRARY.md), [videoschema](../schemas/video.schema.json).
[Schemaöversikt](../schemas/README.md).
[Gemensam lokal presentationsruntime](../../docs/LOCAL-PRESENTATION-RUNTIME.md).
Händelsekategorierna ska överensstämma med projektets seed och motorns källkontrakt.
Händelsers översikt grupperar dem efter **idle/bakgrund, engångshandling, exakt tal och
tur/resultat** med `lib/presentation-profile.mjs`; detta är en visningsmodell
över samma sex källtyper och 16 ID:n. Den skapar inte nya motorevents.
Ändrade tekniska ID:n, nya typer eller playback-funktioner kräver ett uttalat
beslut, kontrakt/schemaändring, tester och migrationsbeskrivning. Visningsnamn
kan fortfarande ändras i projektet utan att tekniska ID:n ändras.

Tekniska fördjupningar finns i den [aktiva systemkartan](../../docs/LOCAL-PRESENTATION-RUNTIME.md).
Det pensionerade personarkivet ingår inte i dokumentationsflödet.

**Uppspelning** på `/control/activity` skiljer källa, eventdata, kontext, beslut och
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
För lokalt kameratest används `node lab/start.mjs --astrid-camera`;
stoppa ett befintligt par före byte och använd alltid `--no-open` från Codex.

## Grundloop och händelseklipp

Astrids Händelser-sida och native-följning använder nu samma exakta mediefamilj:
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

I **Dealers & klipp → Astrid → Utdelning**, eller samma familj på Händelser, anger du procent för
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

Översikten och Klippbiblioteket visar samma fysiska familjer. Uppspelningskvittot för
en MP4 innehåller fil-ID, filnamn och familj. Ett beslut utan spelarens kvitto
räknas inte som uppspelat. OpenClaw-källorna finns även i Guide & hjälp och på fliken Chatt.
Aktuell anslutning: [driftkvitto](../../open-claw/lab/docs/CLOUD-ACTIVATION-2026-09-29.md).

Välj **Dealers & klipp → Astrid → Grundloop** för grundloopens editor. Den har tre delar:
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
videolägen. Sekvenssteg öppnar befintlig editor. Uppspelningens logg håller högst 150
poster i `sessionStorage`, följer med vid sidbyte och töms när fliken stängs.
Observationsprotokollet håller högst 300 meddelanden/4 MiB i
flikens minne och stannar vid gränsen.
Exportera före omladdning. Native-observation kräver den nya
spelarkoden på vald server; lokal merge är inte Bettalotto-deploy.
Vid full historik: exportera och välj **Ny observation** i Diagnostik.
Det ersätter protokollet och gamla labbkön men behåller spelet och anslutningen.
Konfiguration och gränser finns i [labbets README](../README.md#läsande-partner-ström).

Källklippen från Emil är 1080×1920 (9:16). Det beskriver filens pixelformat,
inte att Händelser eller spelet har en enda låst mobil layout. Respektive
klient har sin egen desktop-/mobilyta. Jämförelsen har nu Dator/Mobil-ramar
på båda sidor; labbet visar hela källfilen utan beskärning. Originalflikens
faktiska fönsterstorlek måste fortfarande ändras för ett riktigt mobilprov.
Produktens
`?rehearsal=1` öppnar den befintliga QA-panelen ovanpå den riktiga
produktspelaren; det är inte en flik i Händelser.

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

**Fristående chattprov** i Händelser har egen provkontext och högst 25
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
