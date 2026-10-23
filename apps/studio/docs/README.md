# Scoutgaming: användarguide

## Klipp: tal och beteenden

I **Klippkarta** ligger alla klipp med tal under **Talade repliker**, med egna
situationer och tagningar. Tysta beteenden ligger under **Vila → Basloop och
beteendeklipp**; kort och skonrörelser behåller egna fack.
Öppna **Förhandsvisa och redigera → Körregel** i Vila. Vyn visar basloopen,
beteendeklippen och hur varje beteendeklipp startar: **Av**, **Ibland · intervall**
(ungefär var N:e sekund med variation, minsta paus och tak per minut),
**Vid spelhändelse** eller **OpenClaw**. Händelsevalen omfattar spelarens tur,
rundans resultat och villkor för blackjack, dealer över 21, vinst, lika eller
förlust. Händelseregler körs i spelarens klippvalsläge **Regler**, efter att
utkastet har sparats och publicerats för rummet. De väntar på kort och tal
och på basfilmens klippgräns; de skapar aldrig tal eller ändrar spelresultat.
Filnamnsförslag är bara förslag: kontrollera att ett beteendeklipp är tyst och
återgår till vila. Klipp med en inspelad mening behåller sitt exakta talfack.

Produktmodell, ord och ny UX-inriktning har en enda källa: [`TERMINOLOGI.md`](TERMINOLOGI.md).
Den här guiden beskriver befintliga arbetssteg. **Klippkarta → Scen & lager**
redigerar vald gemensam mall. Enhetliga låsningar per lager i alla tre nivåer
är fortsatt målbild.

**Öppna produkten:** `node apps/studio/start.mjs` öppnar den publicerade lobbyn.
Från Codex används `node apps/studio/start.mjs --no-open`, som bara skriver adressen.
Kommandot skapar inga lokala register eller servrar. Endast uttryckligt
`--offline` startar en tillfällig, isolerad testmiljö utan externa tjänster.

Produktens register, inklusive katalog och svarsbibliotekets metadata, finns i
Neon; filmer och ljud ligger i privat Blob. Lokala katalogfiler är underlag
för uttryckligt import-/authoringarbete. Sparade arbetsfiler bevaras men
används inte som produktens reservregister. Registerbytet i PR186 är mergat
och driftsatt enligt leveranskvittot 16 oktober; det intygar ingen ny visuell
läppsynk- eller spelacceptans. Aktuell leveransstatus finns i
[CLOUD-MIGRATION](../../../docs/CLOUD-MIGRATION.md), tekniken i
[presentationsruntime](../../../docs/LOCAL-PRESENTATION-RUNTIME.md).

**Dragan är ordinarie dealer. Astrid är märkt legacyreferens utan
trelagersversion.** Hennes befintliga tal, filmer och historik ligger kvar på
samma molnväg. Astrid-specifika avsnitt nedan beskriver dessa referensverktyg,
inte standardval eller krav på en parallell lokal produkt.

### Dragan: prova publicerad chatt och tal

Öppna **Drift** i Admin. Använd **Basprofil** och **Sparläge** när
serverfunktionen är ansluten och tillåter tal. Ett sparat önskemål eller
ett textsvar bevisar inte att rösten fungerar. Kall Sparläge kan visa
att modellen ännu inte är laddad. Varm drift och profiljämförelser ska
förbli spärrade tills deras oberoende stopp och budgetstöd är verifierade.

Öppna den publicerade lobbyn, välj bolag, spelrum och Dragan. Välj
**OpenClaw** som klippval och slå på taluppspelning. Börja med en kort
textfråga och lämna mikrofonen avstängd. Kontrollera rätt röst, hörbart
ljud, munrörelser och återgång till grundloopen innan mikrofonprovet.
Ett eget spelprov görs i samma spelvy; saldo och kort hanteras av servern.

Admin-provspel använder ett separat testsaldo och har chatt/genererat tal
avstängda. Den ordinarie spelvyn använder den inloggade spelarprofilens saldo;
rummets testnamn skapar ingen separat plånbok.

När textprovet fungerar och taldriften är redo: tryck mikrofonknappen,
välj **Record one message** och lämna det vanliga webbläsartillståndet.
Säg en kort fråga och var sedan tyst. Efter pausen skickas inspelningen
för transkription och texten vidare till dealern; inspelningen stängs av
automatiskt. Kameran kan vara av. Kontrollera transkriptionens språk,
dealerns språkpolicy och att rätt hörbar röst/video följer samma fråga.
En fråga som skickades före talaktiveringen blir inte ett nytt talprov.

Om svaret visar **Svar klart · väntar på ledigt bord**, vänta på att det
spelas klart innan nästa fråga. Behöver du avbryta det väntande svaret,
slå av taluppspelningen. Slå på den igen inför nästa avsiktliga prov;
mikrofonen förblir av tills du själv väljer att spela in.

**Stoppa drift** begär Av. Vänta på färsk faktisk Av och verifierat stopp;
att bara önskemålet ändras räcker inte. Röstprofilens aktivering är ett
separat sparande och förutsätter rätt verifierat underlag.
[Faktiskt provläge och kvarvarande begränsningar](../../../docs/JOHN-HANDOFF.md#post-lipsync5-produktionsprov)
anges i handoffen. Inspelade standardrepliker är en separat granskning
från fri chatt; ett filnamn eller röstval godkänner inte deras synk.

**Roulettescenens storlek:** öppna Spelbolag & rum, välj rummet och
**Gemensam mall och tillåtna alternativ** → **Öppna gemensam mall** →
**Redigera gemensam mall**. **Zooma in scenen** och
**Zooma ut scenen** skalar bakgrund, dealer och bord tillsammans runt bildens
mitt. Finjustera ett lager under **Storlek och placering**. Scenzoom och skapande av sammansättningar finns i **Scen & lager** i samma arbetsyta.
Roulette använder Desktop 16:9 även på mobil; dessa editorer visar därför det
format som roulette använder. Detta ändrar sparad geometri i den gemensamma
mallens utkast, inte tillfällig visningszoom eller rummets `roomOverrides`.
Granska vilka rum som delar mallen, spara utkastet och publicera via det
befintliga rumsflödet för att ändringen ska nå spelaren. Ett zoomsteg stoppas
helt om ett lager når sin placeringsgräns.

**Admin är den samlade interna arbetsytan på huvuddomänen.** Sidomenyn skiljer **Studio** (dealers, klipp och scener) från **Administration** (bolag, rum, konton, drift och ekonomi). **System** innehåller inställningar, kopplingar, integrationer, åtkomst och hjälp. Gamla dokumentadresser omdirigeras till funktionens hem; de skapar ingen parallell editor. `/studio` är teknisk montering och `apps/studio` källkod, inte ett extra produktregister.

**Drift → Driftläge** (`/admin/drift`) skiljer sparat önskemål från faktisk drift.
Välj Av, Sparläge eller Varm och en tillgänglig GPU-profil; servern avgör vilka
val som går att använda. Varmperioden kan vara 30 minuter, 2 timmar eller 24 timmar.
**Använd läge** sparar önskemålet. **Stoppa drift** begär Av; först en färsk
observation bekräftar att driften har stannat. Okänd status eller okänt pris
visas som sådant. Vid ändrad revision behålls dina fält: uppdatera status och
välj **Läs in sparat val** innan du gör om valet. En misslyckad skrivning
skickas inte om automatiskt. Det första kontrollplanet tillåter bara önskat Av;
Sparläge och Varm kräver ansluten och verifierad serverfunktion.

**System** grupperar arbetsverktyg, AI-assistenter samt åtkomst och historik.
**Bolagsjournal** ersätter den tidigare tomma Ändringslogg-sidan: välj ett aktivt
registrerat bolag och öppna **Team & journal**, sedan **Visa journal**.
Historiken gäller det valda bolagets team och publiceringar. En gemensam
ändringslogg för hela Admin är ännu inte implementerad.

**Betalningar** visar serverns senaste journalposter med händelsenamn,
postens valuta och tid i UTC. **Visa detaljer** visar fullständigt spelar-ID,
serverns händelsetyp och tidsstämpel. Detta är ett begränsat journalurval,
inte en fullständig ekonomisk periodrapport.

**OpenClaw** (`/admin/openclaw`) samlar allt som rör automatiken på en sida med
flikarna Driftläge (taldrift Av/Sparläge/Varm), Agentmodeller, Dealerns agent,
Tal vid inaktivitet och Adminroboten. Valen per klipp och per fas ligger kvar
hos innehållet i klippkartans Körregel och i Scen & lager.
**Agentmodeller** sparar ett modellval på respektive agents rad. **Ångra alla**
återställer osparade val. Byte från konton, integrationer eller modellval går
via sidnavigering, så befintliga varningar för osparade formulär används.
Engångsresultat för integrationer döljs när sidan lämnas.
**Spelbolag & rum** (`/admin/rooms`) är det enda rumsflödet. Välj bolag i
rubriken; dess spel visas som kort med aktuell status och tilldelade dealers.
Välj ett kort för att redigera. **Lägg till spel** öppnar val av sparad spelmall,
blackjack/roulette och namn. Ett bekräftat nytt spel öppnas direkt i redigeraren.
**Ta bort** på kortet stänger spelet och tar bort det ur bolagets utbud efter
bekräftelse. Gemensamma media och historik behålls. **Återställ borttaget spel**
visar bara borttagna spel; återställda spel är pausade tills **Öppna spel** används.

Redigeraren visar scenen och tre separata väljare: **Bakgrund**, **Dealer** och
**Bord**. Materialkort använder förhandsbilder från det publicerade paketet när
dessa finns. Ett bakgrundsbyte ändrar endast bakgrunden för det valda rummet;
dealer, bord, andra rum och bolagets standard behålls. Admin väljer bland mallens
tillåtna alternativ, medan partnerns befintliga behörigheter gäller i partnerportalen.
Inbakad bakgrund kan inte växlas separat och förklaras som låst. Nya rum kräver
fortfarande en sparad kompatibel spelmall med fast utgångsmiljö; denna UI-ändring
utökar inte det publicerade paketets materialurval eller skapar nya medier.

**Spelinställningar**, versionshistorik och **Utbud och publicering** öppnas vid
behov. Rubriken visar publicerad version, sparat utkast och vad spelaren möter nu.
Osparade val skyddas vid byte av bolag, spel eller arbetsyta, och pågående skrivning
låser andra åtgärder. Studio skapar och godkänner det delade materialet; Admin
sätter ihop bolagets spelutbud med befintliga rum och publiceringskontrakt.

Scenen och de tillåtna rumsvalen visas tillsammans. **Låst i publicerat paket**
betyder att valet ändras genom den gemensamma mallen, inte genom rumsvalen.
Ändra tillåtna alternativ → **Spara utkast** → **Granska publicering** i
rumseditorn → kontrollera skillnaden och berörda rum → **Publicera granskat
utkast**. Granskningsytan visas när ett sparat utkast finns. Sparning ändrar
bara utkastet; live ändras först efter publicering. Rumsval sparas bara för
valt rum. **Hämta senaste version** bevarar egen redigering tills du väljer
hur den senaste versionen ska läsas in.

Knappen **Publicering** vid rumsrubriken öppnar **Utbud och publicering** på
samma sida med rätt bolag och rum. **Gemensam mall och tillåtna
alternativ** ligger i en separat detaljsektion; mallredigeraren visar vilka
andra rum som kan påverkas. Gamla länkar med `view=registered` fungerar men
behövs inte längre.

Huvudmenyn har **Studio** och **Administration**. **Dealers** äger registret och skapar nya dealers; **Klippkarta** är arbetsytan för vald dealer och spel. Där finns flikarna **Klippkarta**, **Röst & tal**, **Svarsbibliotek**, **Skapa material** och **Inställningar**. **Scen & lager** öppnar den gemensamma sceneditorn. **Bord & bakgrunder** är materialbiblioteket. Betalningar finns under **Ekonomi**, journalen på valt bolag. Samma menynamn används i hjälp och mobilens sidväljare. Portalraden leder till Admin, Spelbolag och Spelarlobby; `/play/{game}` behåller sitt launchkontrakt.

Välj dealer och spel i klippkartan. Klippbanken fungerar även utan spelbolag
eller rum. Öppna **Rum och publicering** när du vill välja dessa uttryckligen. Ett
rumsval begränsar inte den gemensamma klippbankens skrivning till det rummet;
rummets egna alternativ hanteras fortsatt under **Spelbolag & rum**.

Kartan kan zoomas, panoreras och ordnas genom att dra kort. **Visa alla kort**
visar översikten och procentknappen återgår till 100 %. **Återställ placering**
ordnar korten utan att ändra klippkopplingar. **Förhandsvisa och redigera**
öppnar ett större klipp med dess situation, verkliga varianter, tilldelning och
körregel bredvid kartan. Kortens position beskriver ingen spelordning.
Förhandsvisning startar på ditt kommando och stannar när ytan döljs eller
klippet byts. Den ändrar inte projektet.

**Klippguide** i detaljpanelen förklarar handlingen, kända start-/slutposer och
skillnaden mellan nödvändiga poseversioner och frivilliga tagningar. Okända poser
är uttryckligen okända. Guiden är stöd för arbetet, inte medieacceptans.

**Provspelning** öppnar en panel på samma arbetsyta. Välj uttryckligen en sparad
Blackjack-sammansättning och starta provet. Provet använder dess sparade förval,
inte det markerade klippet, osparade ändringar eller rummets publicerade val.
Spara eller hantera lokala ändringar först. **Stäng provspel** avslutar sessionen;
den stängs också när du lämnar ytan eller byter kontext. Roulette har ännu inte
denna inbäddade provstart.

**Spara utkast** sparar projektets ändringar med en ny serverrevision; det
publicerar inget rum. Synliga resultatmeddelanden visar vad som hände. Vid
revisionskonflikt ligger lokala ändringar kvar för jämförelse. Materialets
papperskorg visar konsekvenser innan borttagning; att en fil inte är vald i
ett utkast bevisar inte att den är oanvänd.

Under **Dealers** väljer du **Skapa dealer**, anger namn och väljer
**Skapa och spara**. **Ladda upp klipp** öppnar importassistenten med rätt
dealer vald, även utan rum. Välj eller dra in upp till 30 filmer, välj bakgrund
för omgången och **Sortera klippen**. Granska facken och välj
**OK – placera klippen**. Fel visas med filnamn. En tidigare lokal import
behålls tills du uttryckligen väljer att byta dealer.

**Namnge filerna så sorteras de rätt.** Importassistenten läser filnamnet
mot en gemensam namnregel som täcker alla 36 fack; **Så namnger du filerna**
i importpanelen visar mönster och exempel för just den sparade kartan. Mönstret
är `<dealer>_<fack>[_<poskedja>][_<språk>_<nr>]`, med `_` eller `-` som
avdelare:

- Grundloop: `dragan_idle_andning.mp4`. Övergångar: `dragan_vila_till_redo.mp4`
  (Till skon) och `dragan_redo_till_vila.mp4` (Från skon).
- Utdelning: `pos1`–`pos7` är Spelarplats 1–7 (box0–box6), `posdealer` öppet
  dealerkort, `hole` dolt kort, `flip` vändning. Kevins suffix anger var
  händerna är när klippet börjar och slutar: utan suffix REDO → REDO (vid skon),
  `-i` börjar i VILA, `-v` slutar i VILA, `-iv` båda. Exempel: `dragan_pos3-iv.mp4`.
  Poskedjan sparas som start-/slutpose på klippet bara när namnet anger den
  eller du väljer den i raden; utan suffix föreslås fackets vanliga kedja i
  texten men inget skrivs. Den är en deklaration, inte ett bevis på att klippen
  kedjar, och kräver att spelservern annonserar kapabilitet 22.
- Repliker: `<replik>_<språk>_<nr>`, till exempel `dragan_goodluck_sv_1.mp4`.
  Språk och tagningsnummer följer med som notering; manus, ljud och granskning
  sätts separat under Tal-klipp & ljud.
- Reaktioner kräver prefix: `dragan_settle_win.mp4`, `dragan_turn.mp4`.

Ett namn som bara anger `blackjack` tolkas som repliken, inte reaktionen. Två
platser i samma namn lämnas osorterade. Namnet föreslår; du granskar innehåll,
bakgrund och fack innan filerna sparas.

I **Adminroboten** kan du dra in samma filmer direkt i chatten, välja dealer och
bakgrund och **Sortera och placera**. Det är själva importuppdraget; inga extra
godkännanderutor tillkommer. Oklara fack visas i chatten för rättning innan
uppladdningen börjar. Kevins frysta Dragan- och Paow-filer känns igen på exakt
filnamn och storlek och får fack, poskedja, språk och tagning automatiskt från
källan; filer utanför K05-urvalet eller utan fack i klippkartan visas med en
varning för manuellt val. Dealern måste finnas i registret först (**Skapa ny
dealer**), och importen kopplar den inte till något bolag, rum eller operatör.
MP4 och WebM stöds, högst 128 MiB per fil. Zip behövs inte
och stöds inte i denna version. Filerna sparas som alternativ i klippbanken;
provspelning och publicering görs separat. Transparenta klipp väntar fortfarande
på stöd i importassistenten. Befintliga alpha-klipp bevaras.

**Ta bort** visar berörda klipp, sammansättningar, rum och bolag före
**Flytta till papperskorgen**. Återställning finns under **Papperskorg** och
återöppnar inte rum. Klippkategorier följer med till papperskorgen och återställs
med dealern. Källfiler och publiceringshistorik bevaras. Användning av samma
media hos en annan dealer visas som ett hinder som behöver lösas först.

**System → Kopplingar & användning** är en sida med flikarna Spelbolag, Dealers,
Bord & bakgrunder och Sammansättningar. Där syns bolag → spel
→ rum samt dealers och deras registrerade filer och materialets användningar.
Delade objekt visas en gång med länkar från de platser där de används.
Vyn redovisar vilka register och historiska kopplingar som har kunnat läsas;
frånvaro av en synlig koppling är inte ett besked att en fil är oanvänd.

Fliken Spelbolag visar bolag → spel → rum med dealers, bakgrunder och bord.
**Ändra mallens kopplingar** öppnar den gemensamma mallen och visar vilka rum
som delar den. Välj **Redigera gemensam mall** för att ändra tillåtna dealers,
förvald dealer, bord och bakgrunder, och granska **Spara utkast**. Publicering
är ett separat steg. **Ändra bara rummets val** använder befintlig rumsbunden
redigering för publicerade rum. Bolaget äger rummet; biblioteksfilerna kan delas.

Roulette: öppna `/admin/clips`, välj dealer och Roulette. Välj bolag och rum
under Rum och publicering när du behöver rumskontext.
De flyttbara korten visar VILA, idle, insatser, hjulstart, utfall och resultat.
Endast befintliga videofack kan laddas upp; planerade fack är märkta och
VILA-PNG provas lokalt utan att sparas. Under **Bakgrund och bord · bild/video**
väljs separata bild-/videolager; bord filtreras efter speltyp.
Se [signaler, filmer och återstående spelkoppling](../../../docs/games/roulette/KLIPPKARTA.md).

Tre ytor delar samma repo och sajt [www.scoutgaming.tech](https://www.scoutgaming.tech/) (apex `scoutgaming.tech` är en 308 till www). Övergången pågår.

- **Intern personal**: [/admin](https://www.scoutgaming.tech/admin) är ny ingång. Befintliga `/control`-länkar fungerar under övergången och många leder nu till motsvarande adminverktyg; se adresslistan nedan. Studio bygger innehållet; Bolag hanterar operatörer, team, spel, rum och publicering.
- **Nivå 2, operatör**: [/partner](https://www.scoutgaming.tech/partner) och `/partner/{operatorSlug}`. Partnerportalen är den här ytan, inte kontrollpanelen. Bolag, roller och medlemskap skapas i **Bolag & team** på `/admin/companies` (äldre länk `/control/companies`); en ny e-postadress får en aktiveringslänk till `/partner/set-password`. Bolagets utseende (`branding`, bordsfärg) läses och skrivs inom sammansättningen av en medlem med `presentations.configure`.
- **Spelare**: [/lobby](https://www.scoutgaming.tech/lobby) är ny ingång. `/play` och äldre speladresser fungerar under övergången. Ett öppet spel erbjuder tillåtna bakgrunder/rum, dealers och bord; spelarens val bildar scenen. Provspelning av dealer görs i den faktiska spelklienten; se [runtime-referensen](../../../docs/LOCAL-PRESENTATION-RUNTIME.md).

`apps/studio/` är aktiv källkod och `/studio` dess tekniska basePath med API och
tillgångar. Runtimeflaggan `lissabon-stream-lane` används fortfarande för
chattkontext, kameragrind och lokala profiler. Gamla Lab/Lissabon-namn är
inte grund för att ta bort Astrids fungerande tal-/videoflöden.

Partnerportalen är nivå 2. Inloggad nivå 1 når `/admin`, `/partner` och spelarytan med samma konto och behåller sin adminroll. Öppna `/partner` direkt; om du behöver logga in leder **Logga in som intern administratör** på `/partner/login` till den interna inloggningen och tillbaka till `/partner`. Partnerformulärets användarnamn/lösenord skapar endast en N2-session och avvisar därför N1-konton. Operatörens personal loggar in där och ser bara sina aktiva medlemskap. Den vanliga portalen ersätter aldrig bolagsdata med demonstrationer. Spelare, transaktioner och rapporter från spelmotorn är ännu inte anslutna.

**Ingångar och äldre länkar**

Använd `/admin`, `/partner` och `/lobby` för nya bokmärken. Tabellen visar
äldre dokumentlänkars omdirigeringar, kontrollerade 14 oktober 2026; om inloggning saknas kommer den
interna inloggningssidan efter omdirigeringen och bevarar målet i `returnTo`.

| Befintlig adress | Nuvarande mål |
| --- | --- |
| `/control` | `/admin` |
| `/control/clips`, `/control/videos` | `/admin/clips`; äldre speech/settings väljer motsvarande panel, generate går till materialskapandet |
| `/control/companies` | `/admin/companies` |
| `/control/rooms`, `/control/lanes`, `/admin/publication` | `/admin/rooms`; `lanes?tab=companies` leder till `/admin/companies` |
| `/control/library`, `/control/compositions` | `/admin/assets` respektive `/admin/clips?panel=layers` |
| `/admin/openclaw` | drift → `/admin/drift?tab=speech`, modeller → `/admin/ai/models`, agent → `/admin/dealer-agent`, probe → `/admin/clips?panel=room` |
| `/control/guide` | `/admin/guide` |
| `/control/administration` | `/admin/drift`; `?tab=accounts` leder till `/admin/admin/accounts` |
| `/studio` | 308 till `/admin` utan query; äldre bokmärken med query går till rätt panel i `/admin/clips` (eller materialskapandet för view=generate). `/studio/guide` går direkt till `/admin/guide` med navigationskontexten bevarad |
| `/lab`, `/labb`, `/bo` | `/lab` och `/labb` går via `/control` till `/admin`; `/bo` går via `/control/administration` till `/admin/drift` |
| `/lissabon` | Ingen aktiv publik ingång: svarade 404 vid kontrollen |

De äldre adminlänkarna bevarar sidkontext; `dealerId` blir `dealer` på
klippsidorna och `lane` blir `composition`. Detta flyttar inte API:er eller
inloggningsrutter. `/studio/api/...` är fortfarande tekniska API-adresser.

Bolagets ingång är
`/partner/{operatorSlug}` och dess rum finns på `/partner/{operatorSlug}/rooms`.
Hämta aktuella bolag ur produktens register: N1 ser aktiva bolag,
N2 ser sina aktiva medlemskap och spelarlobbyn visar spelbara publicerade rum.
Vid registerleveransen 16 oktober var noll aktiva bolag, rum och
sammansättningar avsiktligt; äldre bolagsnamn är inga startdata att återskapa.
En bolagsslugg är inte ett dealer-ID, rum-ID, sammansättnings-ID eller agentnamn.

Spelstarten är `/game?game=blackjack|roulette&operator=…&table=…&dealer=…`; lobbyn
länkar dit. `/player-login` är spelarens inloggning. `/play/profil` och
`/play/historik` är spelarytan. Ett roulettrum skickas vidare (307) till
spelmotorns dokument `/play/roulette?operator=&table=`, som förblir roulettens
adress tills spelmotorns klient slutar skicka sidans query som rumskontext.
`/play`, `/play/blackjack`, `/blackjack` och `/roulette` är permanenta
omdirigeringar (308) till `/game`
under en release; `/game` utan vald spelkontext leder till `/lobby`. `/v2`,
`/bo`, `/casino.html`, `/demo` och `/labb-lissabon` är borttagna (404).
En riktig spellänk behåller godkänd
bolags-/rums-/paketkontext och kontrolleras av spelservern; `/lobby`
ersätter inte spelmotorn eller dessa startkontrakt.

**Vem gör vad?** Nivå 1 är vår administration: vi skapar dealerklipp, sekvenser och grundloopens regler, bygger biblioteket av bord och bakgrunder samt sätter ihop och tilldelar bolagens paket. Nivå 2 är spelbolagets åtkomst och API: bolaget granskar och gör de små designjusteringar som det tilldelade paketet tillåter. Det ger ingen rätt att redigera dealerns sekvenslogik. Nivå 3 är spelarens lobby och spel.

```text
Studio: välj dealer → Klippkarta / Röst & tal / Svarsbibliotek / Skapa material / Inställningar; Scen & lager öppnas i samma arbetsyta
Bord & bakgrunder: gemensamt filbibliotek utan att ändra en scen
Sammansättning: bord, bakgrund, placering och tillåtna val
              → Spara → Provspela
Spelbolag & rum: välj bolag → rum, eller skapa rum och publicera på samma sida
/lobby: välj bolag → spel → rum → tillåten bakgrund, dealer och bord → spela
```

**Byt basklipp** är synligt för egna dealers under Grundloop. Även ett uppladdat idle-klipp som används som variation kan väljas. Det ersätter det valda basklippet och behåller övriga basklipp, deras andelar och andra variationer. Den tidigare videon finns kvar bland uppladdade klipp. AI-talets referensbild ändras separat under Röst & tal. Spara inställningar och publicera paketet igen för att använda bytet i spelet.

**Svarsbibliotek** under vald dealer visar sparade AI-svar med exakt text, ljud och video. Filtrera på kategori, lyssna eller förhandsvisa och spara en eller flera kategorier. Materialet är privat. Om någon ändrar samma svar samtidigt behålls dina val tills du har läst den senaste versionen. Biblioteket startar ingen generering eller återanvändning och publicerar inga klipp. Talgranskning av inspelade klipp nås från Klipp → Tal-klipp & ljud för vald dealer.

Under **Klipp** finns kategorin **Övergångar**: **Till skon** (VILA → REDO, före första givningen) och **Från skon** (REDO → VILA, efter sista). Båda rekommenderas per dealer och har separata standardval. Välj en annan film i samma fack och **Lägg till som variant** för att behålla standardklippet. Fackets varianter visas under **Standard och varianter**; den andra riktningens filmer påverkas inte. Den befintliga gemensamma gränsen för antalet sparade varianter gäller fortfarande. Spara utkastet för att behålla valen. Publicera ändringen i rummet för att använda standardklippen. Filmsekvenser med känd poskedja spelar övergångarna där de behövs; en inbakad till-/frånrörelse upprepas inte. Sparade alternativ väljs inte automatiskt.

I dealerbiblioteket betyder **rött** att grundloopen saknas eller ännu inte är vald. **Gult** visar rekommenderade deal-fack och övergångar som saknar exakt video. Övriga fack är valfria. Välj kategori och sedan ett fack: listan visar sex klipp per sida. Flera filer i samma fack är möjliga varianter; **Klippval, varianter och villkor** visas direkt ovanför uppladdning och klipplista. **Standard och varianter** respektive **Användning och villkor** öppnar fackets detaljvy. Brödsmulor och dealerflikar behåller dealer, variant och exakt situation. Lokala flikbyten behåller pågående utkast och uppladdningar. Ej applicerade talfält behålls också; använd dem i utkastet eller välj Ångra ändringar i talformuläret innan du byter dealer eller sida. Uppladdning aktiverar inte en variant automatiskt. Status är inventering och projektval, inte bevis på godkänd uppspelning.

**När spelas klippen?** Spelmotorn anger händelsen; vald dealer och exakt situation anger klippfacket. Exempel: plats 2 väljer plats 2:s utdelning, medan en inspelad replik väljs på sitt exakta replik-ID. Äldre grupper som ”Deal vänster” samlar flera platser och behövs inte som ett extra redigeringssteg. **Spelhändelser & villkor** visar de exakta facken med ett samlat fackval. Interna händelse-ID:n och kortdestinationer behålls.

**Automatik eller OpenClaw?** Automatiska grundloopvariationer styrs av tid, slumpmarginal, minsta paus och maxantal utan AI-anrop. OpenClaws klippval får den publika spelhändelsen och de tillåtna varianternas beskrivningar/villkor; ogiltigt råd ger standardklippet. Skuggläge spelar standard och loggar rådet. Eventtestets chattsignal, språk, återkomst, vinster/förluster och framtoning är simulerade testvärden, inte automatiskt hämtade spelaruppgifter. Den separata OpenClaw-reaktionen i grundloopen använder observerad chatt, högst 8 meddelanden och 3 200 tecken. Den skapar ingen ny talreplik. Astrids utdelningsfrekvenser väljer lokalt på sparade procentandelar för exakt plats.

**AI-tal:** **Röst & tal** samlar inspelade svar, generering och realtidstal för vald dealer. Inställningen för tal vid inaktivitet visas för Astrid, där runtime-stödet finns. Sparad röstprofil eller klippval är inte ett bevis på fungerande eller visuellt godkänd läppsynk.

**Standardfilm per talfack:** för en nyregistrerad dealer, öppna **Klipp → Tal-klipp & ljud**, välj exempelvis **Välkomsthälsning** eller **Blackjack** och välj dess **Standardklipp**. Endast den dealerns tillgängliga filmer för exakt replik visas. Spara inställningarna; övriga talfack behåller sina val. **Inget standardklipp** lossar valet utan att radera filen. Finns en äldre exakt standard visas den uttryckligen som reserv när det egna valet lossas. Bibliotekets status visar vad som valts i utkastet, inte att filmen är publicerad eller har godkänd läppsynk. Filmen ska ha munrörelser som följer dess eget tal. Granska ljud och bild tillsammans före publicering till rummet. Upprepa uppspelningen när återstart eller städning är det som ska verifieras; det finns inget fast antal uppspelningar som publiceringskrav.

**Talgranskning:** Under **Klipp → Tal-klipp & ljud** finns granskning för vald dealer. Den gäller exakta inspelade ljud-/videopar och är skild från att generera nya AI-repliker. Saknas granskningsbara par visas det; andra dealers filer används inte som reserv. AI-småprat vid inaktivitet (Probe) nås från **Röst & tal** och är fortfarande begränsat till Astrid.

**Scenens storlek:** öppna **Klippkarta → Scen & lager → Redigera gemensam mall**. Där delar alla klipp samma sparade skalning och placering för dealer, bord och bakgrund inom vald sammansättning. Mobil och desktop har egna formatinställningar. Detta är ännu inte en ärvd dealerstandard för alla sammansättningar, och mobil/desktop får inte automatiskt gemensam beskärning. I verktyget **Sammansättningar** finns **Hantera sammansättning → Ta bort sammansättning**; det tar bort utkastets profil. Media och redan publicerade paket behålls.

**Kort och marker:** öppna **Klippkarta → Rum och publicering**, välj rum och öppna **Scen & lager → Redigera gemensam mall**. Välj mobil eller desktop. Dealer och bord flyttas separat; **Flytta scenen tillsammans** kopplar ihop deras reglage. Välj för kort respektive marker: **Bordet**, **Dealern** eller **Ligg still i scenen**. Bytet bevarar placeringen. **Markerna följer korten** behåller tidigare manuella markerval för återgång. Dra en punkt i scenen eller välj **Flytta punkt** och procentfälten; gruppens läge kan också flyttas. **Återställ sparade kort/marker** återställer bara vald grupp i detta format. Desktop har sju spelarplatser och en dealerplats; mobil visar tre spelarplatser åt gången. **Spara utkast** visar berörda rum; publicering görs separat. Den filmade handrörelsen ändras inte.

**Kortvisning** under **Studio → Scen & lager → Kort och marker** väljer **På bordet** eller **Upplyfta** för valt bord och format. Valet sparas med layouten och publiceras med spelet; spelaren har ingen separat kortvisningsbubbla. Utan eget val visas korten på bordet. Admins förhandsvisning använder samma kortstorlek och filmkalibrering som spelet. Kräver spelserverns kapabilitet 26. Den gamla spelkalibreringen (C eller `?cal=1`) är avvecklad; lokala kalibreringsvärden laddas inte längre. Äldre `/calibration`-skrivningar nekas utan att ändra filer.

**Autoskala efter dealern** (förkryssad för ny bordsplacering, av för befintliga tills du kryssar i och sparar): korten landar där filmen visar i rekvisitakortets storlek och markerna ligger under korten, skalade med dealern; flyttar eller förstorar du dealern följer de med. Kortstorlek, markerläge och markerstorlek kan justeras ovanpå; bord, dealer och bakgrund justeras var för sig. På mobil får automatiska markerplatser egna tryckytor utan att kortens filmade landning flyttas. Sparade manuella förskjutningar gäller fortfarande. Förhandsvisningen visar en varning om kort eller marker inte ryms och använder samma grundklippsinramning som spelet. Kräver uppdaterad spelserver.

**Klippstyrning på rätt plats:** Inaktiva fasval, probeval och variationsfält visas inte längre i Sammansättning. Tidigare sparade värden bevaras oförändrade för kompatibilitet. Aktiva klipp/grundloopscheman hanteras i Dealers & klipp och nytt småprat i AI-småprat vid inaktivitet. Spelflikens klippläge styr vanliga klippval; isolerad repetition begränsar tillåtna lägen.

Under **Hantera dealers** kan egna dealers läggas till och tas bort ur utkastet. Det gemensamma biblioteket **Bord & bakgrunder** har synliga flikar för respektive filtyp, uppladdning och information om vilka sammansättningar som använder filerna. Uppladdning där ändrar inga scenval. Samma hantering finns även under Bord/Bakgrund i Sammansättning. Oanvända lagerfiler kan tas bort ur projektbiblioteket och ångras medan sidan är öppen. Sparade paket och Blob-filer raderas inte. Koppla först loss filen från standardval och tillåtna alternativ i alla presentationer som anges. Spara projektet efter ändringen.

**Egen röst och läppsynk:** Öppna **Röst & tal → Realtidstal · röst och referens**. Välj röst, språk och en egen verifierad referensvideo, och lägg ändringen i projektutkastet. Sparande gör inget betalt talprov och innebär inte visuellt godkänd läppsynk. Driften måste stödja profilen innan realtidstal kan användas.

Grundloopen spelas mellan repliker. Under tal används en genererad video med synkroniserat ljud. En stillbild ger inte naturlig andning eller kroppsrörelse; **Video med naturlig rörelse** är därför bara förberedelse och kan ännu inte aktiveras. Filens Fullbild/grönskärm-inställning används även för talbilden tillsammans med bolagets befintliga scen. Rösten är ett separat val: ett namn som PAOW ger inte automatiskt åtkomst till personens ursprungliga röst. Granska ett verkligt chattsvar, läppsynken och återgången till grundloopen innan spelaranvändning. Standarddealernas befintliga talflöden behålls.

En enda egen grundloop räcker för att testa flödet. Händelseklipp kan läggas till senare; avsaknad av sådana klipp ersätter inte dealern med någon annan.

**Dealer, sammansättning och spelrum är olika saker:**

- **Dealer**: en person med egen grundloop och egna klipp kopplade till spelhändelser.
- **Bord**: det visuella bordslagret. Välj en bild för ett statiskt bord.
- **Bakgrund**: ett separat lager; en bakgrundsfilm loopas.
- **Bakgrundsklipp**: valfria ljudlösa MP4/WebM-klipp som startar vid en spelhändelse eller automatiskt. När klippet slutar, når sin maxlängd eller inte kan läsas visas grundbakgrunden igen. En grundfilm fortsätter loopa under klippet.
- **Sammansättning**: dealer, bord, bakgrund, tillåtna alternativ och placering per format.
- **Publicerad version**: bolagets tilldelade sammansättningar och val. Den fryses när du publicerar.
- **Spelrum**: bolagets spelbara bakgrundsval i ett spel, med eget ID och en publicerad sammansättning. Samma rum visas i partnerportalen och för spelaren. En delad bakgrundsfil slår inte ihop rumsidentiteter eller behörigheter.

En sammansättningsmall kan delas av flera bolag och rum. Ändringar i den är
gemensamma projektutkast och slår inte igenom i frysta publiceringar förrän
paketet publiceras igen. Rummets egna tillåtna utseendeval redigeras på
`/partner/{slug}/rooms?room=<rum-id>` med separat granskning och publicering.
Ett rum i den översta väljaren gör inte malländringar rumsspecifika.

I äldre kod betyder `lane` två olika saker: sammansättningen och spelmotorns interna uppspelningskonfiguration. Den senare skapas eller återanvänds automatiskt för spelrummet. Du hanterar därför **Sammansättningar** och **Spelrum** i det vanliga flödet.
Börja i **Dealers & klipp**: välj dealer och redigera grundloop och händelseklipp. Öppna sedan **Sammansättning**, där du väljer, skapar och namnger presentationen. Öppna Dealer, Bord eller Bakgrund i lagerpanelen. Filval och **Storlek och placering** ligger tillsammans för valt lager. Mobil och Desktop har egna inställningar; återställning gäller bara valt lager i aktuellt format. Scenen visas intill reglagen på större skärmar. På mobil ligger den i sidans vanliga flöde så att lagerknapparna är åtkomliga. Spara och fortsätt till **Spelrum & publicering**.
Klippbibliotek, Spelhändelser & villkor och AI-småprat vid inaktivitet nås från Dealers & klipp, med vald dealer kvar.
Dealers & klipp är dealerbiblioteket: fem dealers där betyder inte fem spelbara rum. Länken till Sammansättning öppnar först en befintlig presentation där vald dealer är startdealer, annars en där den är tillåten. En uttryckligen vald presentation behålls. Om dealern inte ingår visas det tydligt; inga dealer- eller paketrättigheter ändras av att följa länken.
Sammansättning är den enda editorn för presentationen. **Ny sammansättning** behöver bara ett namn; ett stabilt tekniskt ID skapas automatiskt och finns under Avancerat. Dealerklipp laddas upp och kopplas till händelser i Dealers & klipp; Bord och Bakgrund laddas upp vid respektive lager. Bordsfärger och bolagets tillåtna mindre ändringar har egna inställningar. Publicering visar bolagets paketval och spelrum samt en länk tillbaka till vald sammansättning.

**Levande lager: bakgrund och bord.** Både **Bakgrund** och **Bord** kan ha en stillbild eller en ljudlös MP4/WebM-loop som grund, och ovanpå den korta klipp som spelas med jämna mellanrum och sedan återgår till grunden.
1. Välj standardbild eller videoloop för lagret och se till att lagret är aktivt.
2. Ladda upp det korta klippet (t.ex. en blomma eller en skugga som passerar) och markera det som tillåtet för samma lager. Ett bordsklipp bör ha samma pixelmått som bordets basbild; annars hamnar klippet förskjutet mot korten och insatserna, som alltid följer basbordet. Ett bordsklipp blir inte ett bordsval för spelare eller rum.
3. Välj **Lägg till bakgrundsklipp** respektive **Lägg till bordsklipp**. Standard är **Automatiskt · tidsintervall**: ungefär var 195:e sekund med **Variation ± 74 sekunder**, högst 10 sekunder per klipp, minst 60 sekunder mellan starter och högst en start per minut. Raden under fälten sammanfattar regeln i klartext.
4. Ändra **Spela var (sekunder)** och **Variation ± (sekunder)** vid behov. Variationen är 0–120 sekunder och alltid mindre än intervallet; sätt 0 för exakt takt. Alternativet **Spelhändelse** startar klippet vid t.ex. blackjack eller vinst i stället för på tid.
5. **Prova klipp** spelar klippet i förhandsvisningen utan att spara och utan att starta dealerns tal. Spara sammansättningen och publicera separat när scenen är klar.
Gränserna gäller per regel; ett upptaget tillfälle köas inte. Spelhändelser kan avbryta automatiken. Bordsklipp spelas bara över standardbordet; väljer spelaren ett annat bord visas inga bordsklipp, och kort- och insatsplatser följer alltid basbordet. Ett lager med klippregler kan inte döljas förrän reglerna tas bort. Dealerns motsvarande beteendeklipp ställs inte in här utan i klippkartans **Körregel** under Vila (se ovan).

I **Bord → Storlek och placering** finns **Förminska**, **Förstora**, procentfält och reglage. Storleken behåller bordets proportioner och sparas separat för Mobil och Desktop. Knapparna ändrar med tio procentenheter; intervallet är 10–400 procent av scenbredden.
**Provspela** startar blackjack i samma flik från den sparade sammansättningen. Spara först och avsluta tillfälliga filprov; uppladdning, konflikt eller pågående sparning blockerar starten. Provet använder en tidsbegränsad adminsession med sparade dealers, bord och bakgrunder från biblioteket, utan bolagspublicering eller påverkan på riktiga spelarkonton. Startdealern måste ha en grundloop. Andra ofullständiga dealers visas med orsak och kan inte väljas. Standard, Regler och Slump kan provas; externa OpenClaw-anrop och genererat tal är avstängda i provet. Dealerklipp friläggs alltid från grön bakgrund. **Till Sammansättning** återgår till presentationen som startade provet.

Vald presentation följer länkarna mellan Sammansättning och Publicering. Spara och fortsätt i Sammansättning inväntar serverns kvitto; konflikt eller nyare ändringar lämnar dig i utkastet.
På Dealers & klipp kan du lägga till en egen dealer, exempelvis **Johanna**, och spara projektet.
Dealern får egna, tomma händelsekopplingar. Registrera filmen under den nya dealern
och välj den som basklipp i Grundloop. Samma film kan återanvändas under ett nytt
media-ID utan att ta över en annan dealers registrering. Varje film
friläggs från grön bakgrund; det finns inget val att behålla en inbakad miljö.
Under **Bildformat och bakgrund · ändra** justerar du tröskel, mjukhet och färgspill,
både i biblioteket och vid den egna grundloopen. En källa med en verkligt inbakad
scen måste ersättas med lämpligt originalmaterial; greenscreen tar bara bort grönt.
Mobilklipp får automatiskt gröna sidor i datorramen; mobilramen beskär breda klipp
från sidorna. Förstoring och placering sparas med klippet och används i båda vyerna.
Om dealern är för liten redan i källfilen: öka **Förstoring**, justera placeringen
och jämför Dator/Mobil. Förhandsvisningen visar resultatet på rutmönster
redan vid första filvalet. Originalfilen behålls. Spara filinställningarna och
publicera paketet igen när de ska nå spelet. Äldre klipp utan inställningar får
standardfriläggning. Klipp märkta med inbakad bakgrund behöver rättas innan ny
publicering. Om friläggningen inte kan starta visas ett fel i stället för råvideo.
Greenscreen är en filinställning och bevisar inte att klippet är visuellt godkänt.
Under **Hantera dealers** väljer du **Arkivera dealer**. Spara pågående utkast först. En samlad bekräftelse visar vilka klipp, sammansättningar, spelrum och bolag som påverkas. Servern stänger av AI-tal, arkiverar dealern med dess klipp och sammansättningar och avpublicerar berörda spelrum i samma åtgärd. Du behöver inte först gå runt mellan flikar och koppla loss innehållet. **Återställ dealer och klipp** återför materialet som utkast med AI-tal avstängt; publicering och öppning av rum görs separat. Tidigare arkiverade enskilda klipp förblir arkiverade. **Radera dealer permanent** kontrollerar och tar bort hela den arkiverade dealern och dess egna filer efter en separat bekräftelse. Tidigare publicerade filer och annat material som fortfarande används skyddas. Permanent radering kan ske tidigast 15 minuter efter arkiveringen, när tidigare uppladdningstillåtelser har löpt ut. Vid avbruten radering visas **Slutför radering**; redan raderade filer återskapas inte.

**Enskilda klipp:** Flytta oanvända uppladdningar till bibliotekets **Papperskorg**, eller återställ dem därifrån. Ett referensklipp för AI-tal måste först bytas eller kopplas loss och projektet sparas. **Radera permanent** är en separat åtgärd med beroendekontroll och egen bekräftelse. Servern skyddar aktuella användningar, publicerade paket, andra arbetsytors filer och originalbanken. Äldre projekthistorik kan finnas kvar, men kan inte återaktivera raderade filer. Nya uppladdningstillåtelser måste löpa ut innan permanent radering; väntetiden visas. Om lagringen inte svarar behålls en raderingsspärr och **Slutför radering** försöker igen.

Bord och bakgrunder kan tas ur presentationens tillåtna val; publicera om paketet när bolagets utbud ändras. Ett bolag kan arkiveras via Bolag & team. Det avaktiverar bolaget och kopplar loss dess spelrum med historiken bevarad. Återställning återöppnar inga rum. Stäng av för en medlem stänger endast medlemskapet.

I Sammansättning ändrar **Dealer** presentationens startdealer. **Tillåtna dealers i sammansättningen** visar uttryckligen vilka dealers som följer med; avmarkera äldre dealers som bolaget inte ska få välja. Startdealern ingår alltid. Byte av startdealer behåller övriga val tills du ändrar dem. Bord och Bakgrund visar på samma sätt sina tillåtna alternativ.
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

I **Spelbolag & rum** på `/admin/rooms` väljer du bolag och rum; gamla `/admin/publication` leder dit. **Bolag & team** på `/admin/companies` behåller samma bolagsval. De äldre `/control/rooms`- och `/control/companies`-adresserna omdirigerar till respektive Admin-sida; de har ingen egen editor. Detta gäller även utan native-routingsflaggan. Bolag, sammansättning (`lane` blir `composition`), dealer, rum, spel och fragment följer bokmärket. Under **Spelrum** visas befintliga aktiva rum som hör till både bolaget, presentationen och det publicerade paketet. Öppna rummets egen länk, eller gå via den allmänna Blackjack-länken och välj först bolag i lobbyn.
**Uppdatera publicerade sammansättningar** visar vilka presentationer som ska ingå. Markeringarna ersätter paketets presentationsurval; behåll alla presentationer som bolaget fortsatt ska ha. Publicera igen för att uppdatera befintliga rum utan att skapa nya.
**Öppna bolagets spellobby** leder till `/play?operator=<bolag>`. **Visa alla bolag** återgår till bolagsvalet. Administratörens inloggningsuppgifter fungerar även i den gemensamma spelarinloggningen, som skapar en separat spelarsession. För ett isolerat test med testsaldo används **Provspela** i Sammansättning. Lobbyn visar endast befintliga öppna rum i bolagets publicerade paket. Spelaren väljer rum, dealer och tillåtna bord- och bakgrundsalternativ innan **Spela med …**. Namnen kommer från det publicerade registret. Fullbildsdealers visar att bord och bakgrund ingår i dealerfilmen; de får inga separata lagerval. Ett tomt paket visar inga öppna rum. Ett läsfel visar ett felmeddelande, inga reservdealers.
Rummets identitet och vald dealer följer med genom spelarinloggningen. Val av bordets utseende och bakgrund sparas i den här webbläsaren per bolag och kontrolleras på nytt av spelet. Spelrum är ingången till paketet; **Bord** är bildlagret i scenen, inget separat spelrum eller extra innehållslager.

Bara när ett nytt rum behövs öppnar du **Skapa nytt spelrum**, väljer **Blackjack** eller **Roulette · enkel nolla** och anger rumsnamn. Formuläret öppnas automatiskt när vald presentation saknar rum. Rummet och paketet sparas tillsammans; någon separat publicering i förväg behövs inte. En kompatibel spellane återanvänds eller skapas automatiskt. För befintliga rum publicerar du uppdateringarna utan att skapa dubblettrum. I partnerportalen visas det publicerade rummet med utseendeval och **Provspela**; rum skapas av intern personal i Studio.

**Roulette:** öppna rummet från bolagets spellobby. Välj markervärde och klicka på satsningsbordet. Under **Fler insatser** finns bland annat delning, gata och hörn. **Ångra**, **Rensa** och **Upprepa** ändrar dina ännu inte skickade satsningar. **Snurra** skickar rundan till servern. Regler och utbetalningar finns i rummet. Varje spelare startar sina egna rundor; det finns ingen gemensam nedräkning mellan spelare.

Roulette har en enkel nolla och använder samma inloggning och demosaldo som blackjack. Det är demo utan riktiga pengar. Vid ett osäkert nätverkssvar låses satsningarna och du kan kontrollera samma runda igen. De senaste 20 rundorna visas i rummet; den gemensamma profilsidans historik är fortfarande blackjack. Dealerscenen visar den publicerade grundloopen, utan nya roulettespecifika repliker. Generatorns separata testyta `/roulette-test` påverkar inget saldo och är inte ett spelrum.

Om skapandet säger att sammansättningen saknar en spelbar grundloop, kontrollera att ett tillgängligt klipp faktiskt är kopplat till dealerns standardvariant och spara. Att en fil finns i biblioteket räcker inte. Samordna först om materialet samtidigt håller på att avvecklas.
**Bolag & team:** sök och välj bolag i listan. Skapa bolag föreslår ett adressnamn från bolagsnamnet; det kan justeras innan du sparar. Ett gemensamt fält tar antingen ny e-post eller ett befintligt partnerkontos användarnamn. Rollernas faktiska behörigheter kan läsas under **Vad får rollerna göra?**. Byte av bolag håller formulärutkasten åtskilda. Ändrad roll sparas uttryckligen, och skyddet för sista administratören ligger kvar på servern. **Interna konton & spelare** gäller andra kontotyper; **API & integrationer** gäller tekniska partnernycklar.

**Team i Nivå 2:** listan visar bolagets verkliga medlemmar och roller. Under **Roller** visas rollernas faktiska rättigheter och om rollen får delegeras. Inbjudan, rollbyte, avstängning och återaktivering visas bara när din aktuella behörighet tillåter åtgärden. Avstängning/återaktivering kräver bekräftelse. Om någon annan ändrat medlemskapet behöver du hämta aktuell version innan du försöker igen. Den sista aktiva administratören kan inte stängas av eller förlora sin administratörsroll.

**Ändringsjournal** öppnas i Team för intern admin och för partner med både teamläsning och rätt att tilldela roller. Där visas bolagets sparade ändringar med tid, aktör, åtgärd, resurs och revision; **Hämta äldre ändringar** visar nästa sida. Journalen börjar när funktionen aktiveras och återskapar inte äldre ändringar. Uppgifterna sparas i databasen, inte bara i webbläsaren. Förlorad åtkomst döljer tidigare hämtade uppgifter vid nästa kontroll. Samma flöden finns på svenska och engelska.

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
Alla dealerpaket behöver godkännas i spelets provspelning. Frilagda dealers förhandsvisas i den valda sammansättningen.


Intern personal producerar klipp, masker och urvalsregler. Partnern ska bara
välja tilldelat innehåll och tillåtna designval. Inloggad nivå 2 läser det frysta
operatörspaketets dealer, bord och bakgrund, inklusive bild- och videoformat.
Bord, Bakgrund och Presentationslanes visar paketets tillåtna inställningar;
Färger, marker och kort visar dess branding. Skrivning kräver
`presentations.configure`, rätt revision och val inom samma tilldelade sammansättning.
Dealerns gröna bakgrund tas alltid bort. Bord och bakgrund väljs som egna lager.
Äldre paket behöver återpubliceras under Publicering för att få lagerformatet.
Provbord länkar till den riktiga spelklienten med bolag och faktiskt tilldelat,
aktivt spelrum. Ett äldre paket utan sådant rum behöver kompletteras via Publicering.
Marker och kort saknar ännu publicerade designval. De gamla lokala designproven
visas bara i den märkta interna fixturen och försvinner vid omladdning.

Begrepp och målbild finns i
[den gemensamma produktmodellen](TERMINOLOGI.md#ägarskap-och-spelarens-val).
Gamla genvägar leder vidare; använd de nya menyadresserna för nya bokmärken.
Partner-session finns via `/partner/login` (partner-API:t svarade 503 i produktion 7–8 okt tills `e97f32df`; kontrollera efter varje deploy).
Chips är inte klara (L4), och ett menyval ger ingen behörighet.

**Teknisk fördelning:** Vercels Studio-tjänst serverar Admin, partnerportalen
och lobbyn. API:er och tillgångar finns under `/studio`.
Render-tjänsten `croupier-v2` äger
spelmotorn och live-transporten. Produktion och isolerad native-QA använder
Neon för revisionsstyrd policy och administrationsmetadata, i sina egna scopes.
För isolerade tester finns arbetsytan på det temporära par som endast
`node apps/studio/start.mjs --offline` startar, på den adress kommandot skriver ut.
**Öppna spelet** fungerar med vanlig spelarinloggning även om
Partner-observationen saknas. **Anslut & följ spelet** öppnar samma
presentationsväg och kopplar dessutom spelflikens händelser till personalytan.
Spela och chatta i spelfliken. Administration är inloggning och konton,
ingen separat spelström.

**Vad betyder projekt här?** Ett sparat projekt är inställningar
för spelets presentation: exempelvis vilka dealerklipp som används och när
de spelas. "Lab-projekt" är inget separat projekt; det syftar på samma
sparning. `apps/studio/` är applikationens källmapp. Personalens nya ingång är `/admin`, och `/studio` är tekniskt basePath. Inställningarna och äldre
versioner sparas i Neon i både produktion och den isolerade native-QA-miljön.
Själva mediefilerna finns i privat Vercel
Blob och konton/saldo finns i Neon. Ett Vercel-projekt betyder i stället
en teknisk webbpublicering och har inget med sparknappen i labbet att göra.

Översikt har snabbvalen **Dealers & klipp**, **Sammansättning** och **Publicering**. På mobil öppnar **Meny** de samlade verktygen; Escape stänger och återför fokus. Val av anslutet bolag följer länkarna till partnern och spelarytan. En otillgänglig bolagslista visas som ett driftfel; demonstrationsbolag märks separat.
Administration och AI & chatt nås i sidomenyn.
De gamla interna exempelvyerna för klipp, tal, media och konton leder till
de riktiga verktygen. Oanslutna exempelvyer visar en förklaring i adminingången,
inte en andra editor med skenbart fungerande kontroller. Spelbolagets
arbetsytor nås via **2 · Spelbolag** i sidhuvudet. Katalogen visar riktiga
registrerade bolag som kontot har åtkomst till, även om ett bolag ännu saknar
publicerat paket. Intern admin väljer bolag med samma konto; operatörspersonal
ser bara sina aktiva medlemskap. Demo North/South ingår inte i normal navigering.
Katalogen och bolagsvyn har språkval, ljust/mörkt läge samt **Byt konto** och
**Logga ut**. En misslyckad utloggning visar ett fel och lämnar dig på sidan.
Välj dealer och kategori i **Dealers & klipp**: **Idle / Grundloop**, **Deal**, **Tal-klipp & ljud**, **Reaktioner** eller **Övriga handlingar**. Välj sedan ett exakt fack. Där finns filerna, uppladdning och länken **Klippval, varianter & villkor**. Listan visar sex filer per sida; kategorierna upprepas inte i en andra inställningsmeny.

Grundloopen visar vila/andning. Variationer kan till exempel visa att dealern kliar sig i huvudet. Uppladdade filer behöver väljas och sparas innan de används som varianter. I grundloopseditorn finns användning, vikter, tider och prov; i deal-facken finns exakt destination och variantfrekvens. Sammansättning hanterar scenens lager och placering. Aktiva klippval och varianter ställs in i Dealers & klipp; tekniska lager- och filprov finns under Avancerat.

**Stäng av** ändrar policyn och behåller filen. **Ta bort** i biblioteket arkiverar oanvända uppladdningar med möjlighet att återställa. Originalspelarens media ändras inte av att navigera mellan dessa vyer.

Astrids legacyreferens har familje-, idle- och Probe-editorer; dessa är inte
generella inställningar för andra dealers. Klipplistor bygger på registrerade
filer, inte en gammal lokal originalbank. Fasta repliker är inspelat
exakt tal. **AI-småprat vid inaktivitet** ligger under Studio. Det separata textprovet
skapar inte ljud eller video. Spelmotorns väg kan be om ett talpaket bara om taltjänsten finns.
Ett syntetiskt textprov är inte en skapad eller spelad film.

Äldre Administration visar 11 sektioner under drift/spelintegritet, spelkonfiguration/bord,
konton, partner, betalningar/journal och talgranskning. Lägga till, ta bort och
kontoåtgärder öppnas vid behov; listor och aktuella värden visas först.
Turneringar och pitboss-inställningar har tagits bort från gränssnittet eftersom
de saknar verifierad koppling till den aktuella spelvägen. Policyn
`STUDIO_ADMIN_SECTIONS` listar fortfarande 15 poster, inklusive pit och turneringar.
Äldre sparade värden,
API-kontrakt och originalspelarens separata supervisor-logik finns kvar.
Modern administration kräver inte `tiers`, `pitboss` eller `tournaments`.
Om sådana sektioner finns valideras de fortfarande strikt; gamla rumsposter
behåller sitt historiska kontrakt. Inga defaults läggs till eller skrivs om
vid vanlig läsning eller sparning av moderna rum.
De tidigare rena informationspanelerna för klipp och AI-generering är borta;
klipparbete finns under Dealers & klipp. E-postmallar är förhandsvisningar.
Andra dealers visar bara de klippkategorier som stöds; Astrids talinitiativ
och familjeuppladdning är referensspecifika verktyg.

**Publicering:** spelmotorn bestämmer regler, kort och saldo. Den gemensamma
presentationskoden visar kort och spelar media. En sparad spelkonfiguration
väljer vilken presentation och mediesamling som används. Partnerns spelrum
väljer sin tilldelade presentation via paketet. I äldre Administration →
Bord & spelrum finns teknisk hantering av spelkonfigurationer; vanliga
Studioflödet kopplar dem automatiskt. Om den sista tas bort stoppas ny
Blackjack-start tills en spelkonfiguration läggs till.
Delad kod, media och sparade spel raderas inte av den åtgärden; medierensning
kräver en separat kontroll av återstående användning, inklusive QA.

Native administration på `/admin` använder de befintliga kontonas rollkontroller och
den gemensamma Neon-källan. En inloggning där ger inga nya administrativa
rättigheter.

Native administration öppnas på `/admin/drift`, `/admin/admin/accounts`,
`/admin/admin/api` och `/admin/media-review`; äldre administrationsbokmärken
leder till motsvarande Admin-sida med bevarad kontext. Det finns
även en separat QA-miljö med egen databas. Den använder samma sparade
revisionskälla som spelmotorn och bevarar osparade utkast vid en sparningskonflikt.
QA:s mejlkoppling och produktionskopplingen till Resend är verifierade,
inklusive invite/reset till Resends sandbox. Verkliga mottagares aktivering,
lösenordsåterställning och inkorg återstår att verifiera.
Befintliga konton
och saldo flyttas eller återställs inte för provet.

**Konton och lösenord:** använd samma användarnamn eller e-postadress och
lösenord i spelet och på `/admin` (äldre ingång `/control`). Du väljer ingen kontotyp i inloggningen.
**Intern adminpersonal, nivå 1** får använda `/admin` och dess befintliga `/control`-verktyg, nivå 2 (`/partner`)
och nivå 3 (`/lobby`, `/play`) med samma konto. Nivå 2 visar riktiga bolag även för admin,
utan extra partnerinloggning. En utgången adminsession går till adminlogin och
återvänder till samma bolagssida. Operatörspersonal loggar in separat och landar
på sin bolagskatalog. Inloggad operatör ser sitt bolags snapshot och det publicerade lane-paketet.
Tillåtna branding- och lagerval sparas på paketet. Spelare, transaktioner och
rapporter från spelmotorn är ännu inte anslutna till partnerportalen (N2.4).
**Spelare, nivå 3** får använda
spelet och nekas intern administration på `/admin` och `/control`. Ett äldre superadmin-konto fungerar som
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
[driftkartan](../../../docs/CLOUD-MIGRATION.md).
Tjänsteansvar och datakällor beskrivs i driftkartan; tekniska format och
uppspelning finns i [runtime-referensen](../../../docs/LOCAL-PRESENTATION-RUNTIME.md).
OpenClaw-sidan finns på `/admin/ai/models` och visar agenternas modellval.
Sparning går genom labbets behörighetskontroll till OpenClaw på Render.
Gatewayens separata dashboard finns kvar för avancerad konfiguration och pairing.
Vanliga sparade klippval kräver ingen Render-omstart;
idleändringar i den lokala uppspelningsvägen kräver omladdning mellan händer.
För en publicerad egen dealer krävs först ompublicering av paketet och sedan
omladdning. Enbart omladdning behåller den publicerade grundloopen.

Under klippens uppladdning väljer du exakt familj och originalklipp.
**Ladda upp och spara klipp** lagrar filmen i videobanken. Välj sedan hur
klippet får användas och tryck **Spara inställningar** för att behålla
urvalsreglerna. Ladda om spelklienten mellan händer efter ändrad
idlepolicy eller presentationsspelarens klippval.
Astrids lokala deal-/replikval gäller nästa beslut; idle kräver omladdning.
Äldre BO-val är bevarad historik och visas inte som importerbara val i Dealers & klipp.
Välj aktiva klipp direkt ur dealerns registrerade filer. Tidigare granskningsspärrar gäller fortfarande.
Checkouten har inget lokalt `lab/data`; Neon är registret och Blob
lagrar mediebyte.
Se [vägar och strömmar](../../../docs/LOCAL-PRESENTATION-RUNTIME.md)
för adresser, kompatibilitetsalias och de tekniska strömmarnas olika ansvar.

**Bord och bakgrund:** välj eller ladda upp bild/video i Sammansättning.
Greenscreen-dealern, bordet och bakgrunden kan spelas som separata lager.
Bakgrundszoner har tagits bort ur arbetsflödet; tidigare sparade zondata bevaras.

Start: `node apps/studio/start.mjs --no-open` skriver den publicerade produktens adress.
`--product` är ett alias för samma läge. Använd
`node apps/studio/start.mjs --offline --no-open` för ett isolerat prov utan externa
tjänster. Testdata ligger temporärt och rensas när paret avslutas; äldre
privata profiler och sparade lokala arbetsdata lämnas kvar.
Fixturstartaren visar avsedd checkout och dess Git-HEAD som källversion. Egna
arbetsfiler kan avvika; uppgiften intygar inte vilken källversion ett äldre bygge har.
En redan svarande server återanvänds inte automatiskt: stoppa dess startprocess
manuellt före en ny start från rätt checkout. Inga processer stängs av startaren.

Lägg endast till `--skip-build` tillsammans med `--offline` för att använda befintliga byggfiler utan att förbereda
förhandsvisningar, bygga eller installera beroenden. Nödvändiga filer för Lab,
förhandsvisning och Admin/Lobby kontrolleras innan profiler läses eller projekt
och servrar startas. Saknas någon fil stannar kommandot; bygg först rätt checkout
med `npm --prefix apps/studio run build` när ett bygge är avsett. Bortstädade byggfiler
är inte i sig ett källkodsfel. Kontrollen intygar filernas närvaro, inte att bygget
motsvarar aktuell Git-HEAD. De tidigare anslutna lokallägena `--check`,
`--cloud-storage` och `--astrid-camera` avvisas med hänvisning till den
publicerade produkten eller explicit offline-fixtur.

Avancerade verktyg nås genom **Händelser** (`/admin/events`; utan `?event=` visas
översikten över alla event, med `?event=` redigeraren). `/control/tree` och `/tree` omdirigerar
dit via den äldre `/control/events`-länken. `/lab`, `/labb` och `/bo` är äldre
kompatibilitetsadresser; `/lissabon` är ingen aktiv publik ingång.
Verktygslänkar behåller dealer, sammansättning, rum, händelse och variant.
Äldre `dealerId` och `lane` omvandlas till `dealer` och `composition` i
Admin-adressen. Gamla flik- och hashadresser leder vidare till rätt verktyg;
använd dess `/admin`-adress när du sparar ett nytt bokmärke.

Jakobs arbetsdokumentation visas i [Guide](https://www.scoutgaming.tech/admin/guide)
(i en offline-fixtur på `/guide` under den Studio-adress startaren skriver ut).
Innehållet finns i [guide.json](guide.json); tekniska klipp- och eventbegrepp hämtas från
[studio-contract.json](../../../packages/presentation/contracts/policies/studio-contract.json).
Produktbegrepp och målbild styrs enbart av [TERMINOLOGI.md](TERMINOLOGI.md).

Utvecklarreferenser: [start och arkitektur](../README.md),
[videoformat och lagring](../VIDEO-LIBRARY.md), [videoschema](../../../packages/presentation/contracts/schemas/video.schema.json).
[Schemaöversikt](../schemas/README.md).
[Gemensam lokal presentationsruntime](../../../docs/LOCAL-PRESENTATION-RUNTIME.md).
Händelsekategorierna ska överensstämma med projektets seed och motorns källkontrakt.
Händelsers översikt grupperar dem efter **idle/bakgrund, engångshandling, exakt tal och
tur/resultat** med `lib/presentation-profile.mjs`; detta är en visningsmodell
över samma sex källtyper och 16 ID:n. Den skapar inte nya motorevents.
Ändrade tekniska ID:n, nya typer eller playback-funktioner kräver ett uttalat
beslut, kontrakt/schemaändring, tester och migrationsbeskrivning. Visningsnamn
kan fortfarande ändras i projektet utan att tekniska ID:n ändras.

Tekniska fördjupningar finns i [runtime-referensen](../../../docs/LOCAL-PRESENTATION-RUNTIME.md).
Det pensionerade personarkivet ingår inte i dokumentationsflödet.

Den separata sidan **Provspelning & logg** är avvecklad. Prova en sparad scen i klippkartans **Scenförhandsvisning** och öppna publicerat spel från **Spelbolag & rum**. Ett klippval bevisar inte faktisk uppspelning eller godkänd läppsynk; diagnostiska kvitton följer runtimekontraktet.

Astrids valbara kamera/mikrofon finns i samma spelflik, Av som standard.
Aktuella kontroller och provgränser beskrivs i
[kamera- och talguiden](../../../docs/LOCAL-PRESENTATION-RUNTIME.md).
Driftens aktiverade funktioner och återstående liveprov följs i
[molnstatusen](../../../docs/CLOUD-MIGRATION.md).
Det tidigare lokala kamerastartläget `--astrid-camera` är avvecklat.
Offline-fixturen aktiverar inga externa kamera-/taltjänster. Följ driftens
befintliga kontroller och provgränser för sådana produktprov.

## Arkivera, återställa och provspela

På **Bolag & team** kan ett bolag arkiveras efter bekräftelse. Det försvinner från aktiva val, åtkomsten stoppas och spelrummen kopplas loss; historiken bevaras. **Visa arkiverade bolag** visar återställning. Återställning av bolaget öppnar eller återpublicerar inga rum. Återställ varje rum separat och öppna det därefter när beroendena är giltiga.

På **Spelbolag & rum** kan du pausa/öppna rum samt arkivera dem. Växla till arkivet för återställning; ett återställt rum är väntande tills du öppnar det. Saknade eller ändrade publiceringsberoenden visas före återställning. Åtgärderna läser tillbaka serverns aktuella version och kräver en kompatibel spelmotor.

På **Dealers & klipp** leder **Arkivera & återställ** till dealerns hantering. Använda eller skyddade dealers visar varför arkivering eller permanent borttagning hindras. Att ta bort en sammansättning ändrar Studio-utkastet; publicerade rum behåller sin frysta version tills de hanteras separat.



## Översikt och rätt arbetsyta

På nya `/admin` väljer du först område: **Dealers och klipp**, **Spelbolag och rum**, **Ekonomi**, **Drift** eller **System**. Startsidan öppnar ingen redigerare. Välj **Studio** eller **Öppna dealers och klipp** för klippkartan på `/admin/clips`; **Bord och bakgrunder** finns som eget val. **Visa spelrum** visar de registrerade rummen utan att öppna klippredigeraren. Äldre bokmärken till `/admin` med dealer eller rum i adressen öppnar fortfarande Studio. **Ekonomi** visar kontorörelser, diagram och en journal som kan fällas ut. Diagrammen bygger på hämtade journalposter, inte på beräknad GGR eller revshare. Logotypen och **Översikt** i sidomenyn tar dig tillbaka till `/admin`; ett osparat Studio-utkast finns kvar när du återvänder.

**Studio** innehåller även Talgranskning: manuell bedömning av ett exakt ljud- och videopar. Ändrade filer ogiltigförklarar den tidigare bedömningen. **Spelhändelser & villkor** styr när inspelade klipp används; **AI-småprat vid inaktivitet** är ett separat flöde. Händelsekopplingar och äldre 2D-klipp är fortfarande aktiva i uppspelning/validering och har inte tagits bort.

**Drift** samlar spelmotor, kortlek/spelintegritet, uppspelning och betalningsjournal. **Administration** samlar bolag/team, interna konton/spelare och API/integrationer. Flikarna inne på respektive sida visar bara det aktuella arbetsområdet. Standarddealer för classic/high/vip hör till den äldre bordsindelningen; bolagens publicerade spelrum styrs av sina presentationer.

## Skapa material från dealerns grundbilder

**Skapa material** finns som flik under **Dealers & klipp** (`/admin/dealer-studio?view=generate`). Välj dealer i den gemensamma arbetsytan. Fliken genererar klipp via Runway och lägger resultatet som granskningsklipp i rätt fack; ingenting publiceras automatiskt. Den gamla Dealer Forge-adressen omdirigerar hit och behåller dealer, sammansättning, bolag och rum.

1. Välj en befintlig dealer eller registrera en under **Hantera dealers** och spara innan du öppnar **Skapa material**.
2. **VILA**: ladda upp en stående bild med båda händerna i vila. Bilden förminskas i webbläsaren, normaliseras till 1080×1920 på kromagrönt och sparas som privat ankare. **REDO** (vänster hand vid skon) genereras från VILA med Gen-4 Image (8 krediter) eller laddas upp; första kandidaten antas automatiskt, fler kan väljas med *Använd som REDO*.
3. **Matrisen** visar varje fack per grupp – Idle, Övergångar (*Till skon* VILA→REDO, *Från skon* REDO→VILA), Givning (plats 1–7, öppet/dolt dealerkort, vändning), Repliker (17 standardrepliker), Reaktioner samt Bord & bakgrund – med status (krävs/rekommenderas/valfritt/klar), befintliga klipp som miniatyrer med rätt pose som poster, pågående jobb med procent och knapparna **Skapa**, **Ny variant** och **Variant från klipp**.
4. **Generering**: välj kvalitet (720p prov / 1080p master), längd, läge (keyframes VILA/REDO, referensklipp för varianter, avatar med läppsynk för repliker), uttryck och redigera prompten. Kostnaden visas i krediter före start och jämförs mot din gräns. Priser enligt Runways lista 2026-10-12: Gen-4 Turbo 5 kr/s, WAN 3 10/20 kr/s (720p/1080p), Gen-4 Image 5/8 kr, avatar 2 kr + 2 kr per 6 s.
5. **Jobb** pollas var femte sekund. Klart resultat hämtas av servern, hashas och registreras som `standard` (första klippet i facket) eller `alternative` (varianter) med grön nyckling i klassificeringen. Bord blir ett alfamaskat WebP-lager (magenta nycklas bort) och bakgrund ett 1920×1080-lager i **Bord & bakgrunder**. Ett avbrutet eller tvetydigt jobb visas med task-ID så att inget betalas två gånger. Varje beställning bär en nyckel: trycker du **Generera** igen efter ett nät- eller serverfel (samma inställningar) får du tillbaka samma jobb i stället för en ny debitering. Ändrar du något blir det en ny beställning. Visas **Okänt – kontrollera Runway** har Runway inte gett ett säkert svar: kontrollera portalen och koppla task-ID:t, eller avbryt om inget jobb finns där.

Utkastet finns kvar när du byter flik. Spara eller ångra det innan du byter dealer eller lämnar sidan. Vid anslutningsfel spärras ändringar; **Försök ansluta igen** hämtar aktuellt läge och behåller utkastet. Jobbpollning pausas när fliken är dold. Använd **Uppdatera klipplistan** under Klipp för att läsa in nya genereringsresultat.

Övergångsfacken kan fyllas i projekt med eventet `transition.shoe` (finns i standardmallen); standardklippen används efter publicering i filmsekvenser med känd poskedja. Ett äldre sparat projekt utan eventet visar facken som spärrade. Generering kräver ansluten Runway-tjänst och aktiverad lagring; saknas något visas det överst i fliken. Granskning, standardval och publicering sker som vanligt i **Klipp**, **Sammansättning** och **Spelrum & publicering**.

## Grundloop och händelseklipp

Astrids Händelser-sida och native-följning använder nu samma exakta mediefamilj:
`box0` → `deal_pos1`, …, `box6` → `deal_pos7`, samt exakt `speak.line` →
`repliker/<line>/`. Situationsväljaren ändrar bara manuella exempel; mottagna
events behåller kort, box, handindex och replik. Standardfil och varianter
kommer från manifestet, inte från projektets gamla 2D-demovarianter.

Manifest v2 grupperar deal, kortvändning, exakta repliker och idle.
Aktuella familjer och klipp läses från det importerade manifestet i Neon-katalogen.
Den [incheckade manifestkopian](../../../media/dealers/astrid/runtime/presentation/lab-video-manifest.json)
är underlag för uttrycklig authoring/import, inte produktens runtime-register.
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
varianter lånar aldrig en annan familjs media. Varje dealer använder sina egna
exakta registrerade klipp. Använd **Ladda upp klipp** i Admin: mediebytes lagras
i Blob och registreringen i Neon. Nya klipp väljs och aktiveras uttryckligen
i den sparade policyn. Lokal authoring kräver en separat, granskad import;
att ändra en fil eller skanna en lokal mapp uppdaterar inte produktens register,
mediebytes eller publicerade paket.

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

Neon-katalogen är registerkällan för Astrids manifeststyrda familjer; filmerna
hämtas från Blob med sina exakta identiteter. Sökvägen
`media/dealers/astrid/runtime/presentation` beskriver äldre källmaterial och
logiska medieidentiteter, inte en lokal runtimekälla. Arbetskopior och backuper
blir inte spelbara genom filändringar. Nya varianter är manuella tills de
uttryckligen läggs till och aktiveras i den sparade policyn.

Översikten och Klippbiblioteket visar samma fysiska familjer. Uppspelningskvittot för
en MP4 innehåller fil-ID, filnamn och familj. Ett beslut utan spelarens kvitto
räknas inte som uppspelat. OpenClaw-källorna finns även i Guide & hjälp och på fliken Chatt.
Aktuell anslutning: [lokal anslutning](../../../docs/AI/openclaw/LOCAL-CONNECTION-SV.md).

Välj **Dealers & klipp → Astrid → Grundloop** för grundloopens editor. Den har tre delar:
grundloop, korta variationer och ett deterministiskt enminutsprov. Grundläget
består av `idle_still` och `idle_breath`. `idle_blink`, `idle_cheek`,
`idle_glance`, `idle_insulted`, `idle_smile`, `idle_yawn` och
`croupier_coffie` är engångsvarianter.
Beskriv **När passar klippet?** med högst 80 tecken. Texten följer kandidaten
till OpenClaw som konfigurationsdata, inte som en systeminstruktion.

Neon-registret bevarar de exakta familjeidentiteterna. De äldre sökvägarna
beskriver klipprollerna:

- `media/dealers/astrid/runtime/presentation/idle/*.mp4` är loopande grundklipp.
- `media/dealers/astrid/runtime/presentation/idle/variant/*.mp4` är korta varianter.
- `lab/policies/idle-policy.seed.json` är kodens standardmall. Den är inte ett
  alternativt runtime-register; sparade vikter och tillåtna användningar hör
  till det serverägda projektets policy i Neon.

Det avancerade labbets startpolicy visar `idle_still` med 90 % grundvikt och schemalägger blinkning
ungefär var 25:e sekund med ±5 sekunders variation. Eftersom blinkklippet tar
tid blir `idle_still` i praktiken ungefär 79 %, vilket editorn visar. Ett
spel-, deal- eller talprov äger spelaren och blockerar idleprovet tills det är
klart. Policyn sparas i det serverägda projektet i Neon. Web-spelaren läser
samma projekt; ladda om spelfliken efter ändringar i idlepolicyn. Labs startprofil
erbjuder i stället de ursprungliga sex variationerna till OpenClaw; kaffeklippet
börjar som manuellt. Ingen fjärrdrift deployas
och OpenClaw behöver inte startas om när beskrivningar eller val ändras.

Grundvikt är alltså inte faktisk tidsandel. Automatisk idlevariant följer
intervall, jitter, cooldown och maxfrekvens. OpenClaw-valbar variant kräver en
färsk chattmöjlighet; manuell variant schemaläggs inte. I grunddealerns äldre idleeditor är Regler inte anslutna och kan inte nyväljas. Egna dealers stöder regelstyrda variationer med sparade villkor för utdelning/vändning och Klippval=Regler, enligt flödet ovan.
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

Diagnostiska transport- och uppspelningskvitton beskrivs i runtimeguiden. Den pensionerade sidans sessionslogg är inte längre en del av Admin-navigationen.

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
[starthelpern](../../../docs/AI/openclaw/LOCAL-CONNECTION-SV.md); standardstart
förbrukar inga Cartesia-/RunPod-jobb. OpenAI-modellen är oförändrad. Genererade
takepaket är hashbundna previews, **inte mänskligt godkänd läppsynk**.
Modellvalet `recordedLine` visas tills vidare bara som text i den länkade labbchatten
om en exakt labbtake saknas; native-eventets inspelade replik påverkas inte.

**Fristående chattprov** i Händelser har egen provkontext och högst 25
sekunder ljud. Det styr inte det anslutna bordet. Se [socialt prov](../../../docs/AI/openclaw/SOCIAL-CHAT.md).

[Signal- och begreppskartan](../../../docs/LOCAL-PRESENTATION-RUNTIME.md)
förklarar RNG kontra spelfakta, Partner kontra native-status, de 16 genvägarna,
relevanta situationer och föreslagen gemensam bild-/taluppspelning. Kartan skiljer
nuvarande kod från nästa steg; den aktiverar inte nya funktioner.

Aktuellt arbete och kvarvarande QA finns i [handoffen](../../../docs/JOHN-HANDOFF.md). Nya sprintdokument är pausade.

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

Verifiera ändrat beteende med riktade tester enligt [AGENTS.md](../../../AGENTS.md).
Använd `?dealer=<name>&rehearsal=1` vid konkret uppspelningsfel eller begärd
visuell granskning. Upprepade uppspelningar behövs när återstart eller städning
är det ändrade beteendet. Det finns inget fast antal spel som leveransgrind.
Visuell läppsynk kräver fortfarande faktisk bild-/ljudgranskning.
Privata chattar, hemligheter och signerade medielänkar ska inte ingå i takepaket
eller publika loggar. Aktuella runtimekontrakt finns i
[presentationsguiden](../../../docs/LOCAL-PRESENTATION-RUNTIME.md);
OpenClaws versionsbundna källor nås via [dess källindex](../../../docs/AI/openclaw/README.md).

## Välj dealerns röst

I Admins befintliga **Röst & tal**, och i Controls **Röst och läppsynk**,
finns samma kompakta röstväljare. Paow och Dragge förväljs automatiskt när
dealerns ID eller namn entydigt matchar och ingen röst redan är sparad.
Original-ID, modell och inställningar fylls i tillsammans. Du kan ändra
röst och röstspråk i samma meny. Paow
använder Eleven v3 för svenska och Multilingual v2 för andra språk; Dragge
använder Multilingual v2. **Astrid · Victoria** behåller Astrids befintliga
Cartesia-röst. Andra eller motstridiga namn får inget automatiskt röstval.
Egna profiler finns kvar och kan redigeras under **Detaljer**.

Lägg talprofilen i projektutkastet och spara projektet. En redan sparad,
oförändrad egen videoreferens kan behållas vid röstbyte. Ändrad referens eller
ny begäran om AI-tal kräver bildgranskning. Röstvalet startar ingen betald
generering och intygar inte åtkomst till leverantörens konto eller godkänd
läppsynk. Servern verifierar den exakta rösten och bilden före varje session.

Katalogen är `packages/presentation/contracts/dealer-voice-catalog.json`; den innehåller offentliga
röst-ID:n och modellinställningar, inga API-nycklar. Den sparade profilen
innehåller exakta värden, så en katalogändring skriver inte om gamla profiler.

Samma dealerprofil kan förberedas för blackjack och roulette/body-dealers.
Det fungerande strömmande chattsvaret använder fortfarande den gemensamma
ljud-/videospelaren. Roulettes spelvy saknar ännu dealerchatt och den
serverägda roulettekontext som behövs för den; ett sparat röstval aktiverar
inte det flödet. Naturligt rörligt kroppsunderlag är fortsatt förberedelse,
inte verifierad rörlig läppsynk. **Talbibliotek** är en separat, hopfälld del.
