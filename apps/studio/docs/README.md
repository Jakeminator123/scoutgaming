# Admin: användarguide

Så här arbetar du i Admin (`/admin`) i dag. Orden förklaras i
[ordlistan](TERMINOLOGI.md). En **mall** heter i Admin i dag
**Sammansättning** (ibland **Spelmall** eller **Gemensam mall**); bolagets
**paket** är avsnittet **Spelmallar för bolaget**. Admins **Hjälp** listar vad
varje sida gör och länkar hit och till ordlistan.

## Menyn

| Område | Sida | Adress | Vad du gör där |
| --- | --- | --- | --- |
| Studio | Sceneditor | `/admin/scenes` | Placerar dealer, bakgrund, bord, kort, marker och spelkontroller i mallen |
| Studio | Klippkarta | `/admin/clips` | Ordnar en dealers klipp per spelsituation |
| Studio | Dealers | `/admin/dealers` | Skapar dealers och hanterar deras bibliotek |
| Studio | Bord & bakgrunder | `/admin/assets` | Materialbiblioteket för scenens lager |
| Administration | Spelbolag & rum | `/admin/rooms` | Bolagets rum, material, paket och publicering |
| Administration | Bolag & team | `/admin/companies` | Bolag, medlemmar, roller och journal |
| Administration | Spelarkonton | `/admin/players` | Spelarnas konton, saldo och status |
| Administration | Drift | `/admin/drift` | Flikarna Spelstatus och Taldrift |
| Administration | Ekonomi | `/admin/ekonomi` | Flikarna Översikt och Betalningar |
| System | Systeminställningar | `/admin/ai/models` | Agenternas modellval |
| System | Kopplingar & användning | `/admin/structure` | Vad som använder vad: bolag, dealers, bord, bakgrunder och mallar |
| System | Integrationer | `/admin/admin/api` | Partnernycklar och API |
| System | Konton & åtkomst | `/admin/admin/accounts` | Intern personal och roller |
| System | Hjälp | `/admin/guide` | Vad varje sida gör, med länkar till den här guiden och ordlistan |

Portalraden överst leder till Admin, Partnerportalen (**Spelbolag**) och
**Spelarlobby**; intern personal når alla tre med samma konto.

## Arbetsgången

1. **Dealers → Skapa dealer** och lägg till klipp (se [Dealers](#dealers)).
2. **Klippkarta**: välj dealer och spel, lägg klippen i rätt fack och välj
   standardklipp. **Spara utkast**.
3. **Röst & tal → Inspelat tal**: granska tagningarna och välj standard i
   varje talfack.
4. **Sceneditor**: välj mallen, placera lagren och korten. **Spara utkast**.
5. **Spelbolag & rum**: ge bolaget mallen under **Spelmallar för bolaget**,
   välj rummets material och publicera paketet.
6. Öppna rummets **Spelinställningar** och välj **Publicera
   spelinställningar**.
7. Öppna rummet från lobbyn och spela en hand.

Att spara ändrar bara utkastet; spelaren ser ändringen först efter publicering.

## Dealers

- **Skapa dealer**: ange namn och **Skapa och spara**. **Lägg till klipp**
  öppnar klippkartans intag med dealern vald.
- **Lägg till dealer eller filmer** (`/admin/dealers?tool=import`) är en
  alternativ väg: dra in upp till 30 filmer, välj bakgrund för omgången och
  **Sortera klippen**. Granska facken och placera klippen.
- Varje dealerfilm friläggs från grön bakgrund. Under **Bildformat och
  bakgrund · ändra** justerar du tröskel, mjukhet och färgspill samt
  **Förstoring** och placering. En film med verkligt inbakad scen måste
  ersättas; greenscreen tar bara bort grönt.
- En enda egen vila (i Admin: **Grundloop**) räcker för att prova flödet.
  **Byt basklipp** ersätter basklippet och behåller övriga beteendeklipp.
- **Ta bort** flyttar dealern med allt material till papperskorgen efter en
  bekräftelse som visar berörda klipp, rum, bolag och mallar (se
  [Ta bort och återställa](#ta-bort-och-återställa)).

Astrid är en märkt äldre referens; hennes egna verktyg (utdelningsfrekvenser,
tal vid inaktivitet) gäller bara henne.

## Klippkarta

Välj **Dealer** och **Spel** i kontextraden. Klippbanken fungerar utan bolag
och rum; öppna **Rum och publicering** när du vill välja dem. Ett valt rum gör
inte en ändring i klippbanken rumsspecifik. Flikarna är **Klippkarta**,
**Röst & tal**, **Svarsbibliotek**, **Skapa material** och **Inställningar**.

Kartan kan zoomas, panoreras och ordnas; **Återställ placering** ändrar inga
kopplingar. **Förhandsvisa och redigera** öppnar klippet med situation,
varianter och **Körregel**; **Klippguide** förklarar handlingen och poserna.

Kategorierna är spelhandlingar (plats 1–7, dealerns öppna och dolda kort,
vändning, **Övergångar**), **Vila** och **Talade repliker**. En position utan
klipp hoppas över i spelet; kortet visas ändå.

### Lägg till klipp

Välj dealer och Blackjack. Dra in filer eller en mapp på kartan, släpp dem på
ett kort för ett bestämt fack, eller välj **Lägg till klipp**
(`/admin/clips?panel=intake`).

1. Varje fil visas med stillbild, föreslaget fack (**Kategori › Situation**),
   roll (**Standard** när facket saknar standard, annars **Variant**) och hur
   säkert förslaget är.
2. **Osäker · välj fack**: välj ett snabbval, byt fack i listan eller dra kortet
   till rätt kategori. Kartan visar vilka fack som tar emot filen.
3. **Godkänn och spara** laddar upp klippen som tagningar i sina fack och visar
   ett kvitto per fil.
4. Välj sedan standard eller variant, eller **Öppna facket i kartan**, och
   **Spara utkast**.

MP4 och WebM stöds, högst 128 MiB per fil. Grön bakgrund är förval;
transparent bakgrund är spärrad för import. Talklipp väntar på granskning i
talfacket. Filer med fel försöks inte om automatiskt. Roulettefilmer laddas
upp via respektive kort.

### Namnge filerna

Intaget läser filnamnet och mappens namn. **Så namnger du filerna** i panelen
visar mönster och exempel. Mönstret är
`<dealer>_<fack>[_<poskedja>][_<språk>_<nr>]`, med `_` eller `-` som avdelare:

- Vila: `dragan_idle_andning.mp4`. Övergångar: `dragan_vila_till_redo.mp4`
  (**Till skon**) och `dragan_redo_till_vila.mp4` (**Från skon**).
- Utdelning: `pos1`–`pos7` är plats 1–7, `posdealer` dealerns öppna kort,
  `hole` dolt kort, `flip` vändning. Suffixet anger var händerna börjar och
  slutar: utan suffix REDO → REDO, `-i` börjar i VILA, `-v` slutar i VILA,
  `-iv` båda. Dolt kort slutar alltid i VILA och vändningen går VILA → VILA.
  Exempel: `dragan_pos3-iv.mp4`. Kevins äldre `-u` och `-iu` får samma
  poskedja som `-v` och `-iv` men är andra filmer, som den filmade utdelningen
  aldrig använder (för `hole` och `flip` är de kopior av filen utan suffix
  respektive `-i`). Ladda inte upp dem.
- Repliker: `<replik>_<språk>_<nr>`, till exempel `dragan_goodluck_sv_1.mp4`.
- Reaktioner kräver prefix: `dragan_settle_win.mp4`, `dragan_turn.mp4`.

Namnet föreslår; du granskar innehåll och fack innan du sparar.

### Vila och körregel

Under **Vila → Basloop och beteendeklipp** öppnar du **Förhandsvisa och
redigera → Körregel**. Varje beteendeklipp startar **Av**, **Ibland ·
intervall** (ungefär var N:e sekund med variation, minsta paus och tak per
minut), **Vid spelhändelse** eller via **OpenClaw**. Händelseregler körs i
spelarens klippläge **Regler** efter att utkastet sparats och publicerats. De
väntar på kort, tal och basfilmens klippgräns; de skapar aldrig tal eller
ändrar spelresultat. Kontrollera att ett beteendeklipp är tyst och återgår
till vila.

### Övergångar och delat bord

**Övergångar** har **Till skon** (VILA → REDO, före första givningen) och
**Från skon** (REDO → VILA, efter sista). Välj en annan film i facket och
**Lägg till som variant** för att behålla standardklippet. **Koppla för delat
bord** i givklippets panel kopplar de filmer som behövs med dealerns valda
skoklipp; **Koppla hela givbanken** behåller sitt tidigare urval. Ingen knapp
godkänner film eller tal. Spara utkastet och publicera separat.

### Provspela

**Scenförhandsvisning** öppnar **Provspela sparad scen**. Välj en sparad mall
(i Admin: **Sparad sammansättning**) och starta. Provet använder mallens
sparade förval, inte osparade ändringar, det markerade klippet eller rummets
publicerade val. Provet har eget testsaldo; externa OpenClaw-anrop och
genererat tal är avstängda. Roulette har ännu ingen inbäddad provstart.

## Röst & tal

### Talgranskning

Talgranskning görs i **Röst & tal → Inspelat tal** för vald dealer; den
äldre sidan `/admin/media-review` finns inte längre och leder hit. Listan har
en rad per replik i spelets ordning och därefter övriga repliker som har filer.

1. Öppna en replik, välj **Svenska** eller **English** och välj tagning.
   Högsta tagningsnumret står först.
2. Spela tagningen med ljud och välj **Godkänn tal**, **Underkänn** eller
   **Ta bort bedömning**.
3. **Sätt som standard i talfacket** lägger tagningen som standard i
   projektutkastet. Spara utkastet.
4. Publicera paketet och därefter rummets spelinställningar; först då används
   de godkända tagningarna.

Status per tagning: **Godkänd av**, **Underkänd**, **Väntar på granskning**
eller **Saknar talkvitto** (kan inte godkännas). **Godkänn tal** kräver mätt
speltid. Bedömningen binds till filens exakta hash, text, språk och tagning
och är ditt intyg om att du sett och hört filen, ingen mätning av läppsynk.
En underkänd tagning spelas inte.

### Röst och AI-tal

Under **Inspelat tal** följer **Genererat tal · AI-röst**. Generering och
realtidstal kräver en verifierad röstprofil; dealers utan en sådan har
**Förbered röstprofil för realtidstal**. Att spara en röstprofil gör inget
betalt prov och godkänner ingen läppsynk. **Testa dialog** öppnar Dialogtest
(`/admin/dealer-agent`).

### Dragan: prova publicerad chatt och tal

Öppna **Drift → Taldrift** och välj Sparläge när servern tillåter tal. Öppna
lobbyn, välj bolag, rum och Dragan, välj **OpenClaw** som klippval och slå på
taluppspelning. Börja med en kort textfråga med mikrofonen av; kontrollera
röst, ljud, munrörelser och återgång till vila innan du provar mikrofonen.
Avsluta med **Stoppa drift** och vänta på bekräftat Av. Admins provspel har
chatt och genererat tal avstängda.

## Svarsbibliotek och Skapa material

- **Svarsbibliotek** (`/admin/replies`) visar sparade AI-svar med exakt text,
  ljud och video. Filtrera, lyssna och spara kategorier. Biblioteket startar
  ingen generering och publicerar inga klipp.
- **Skapa material** (`/admin/dealer-studio?view=generate`) genererar klipp via
  Runway och lägger resultatet som granskningsklipp i rätt fack; inget
  publiceras automatiskt. Ladda upp **VILA** (stående bild med händerna i vila);
  **REDO** genereras eller laddas upp. Matrisen visar varje fack med status
  och knapparna **Skapa**, **Ny variant** och **Variant från klipp**. Kostnaden
  visas i krediter före start. Visas **Okänt – kontrollera Runway**: kontrollera
  portalen innan du beställer igen. **Generera** igen med samma inställningar
  efter ett fel ger samma jobb, inte en ny debitering.
- Klippval och villkor ändrar du i **Studio → Klippkarta** under
  **Körregler**. Den gamla adressen `/admin/events` leder dit.

## Sceneditor: mallen

Öppna **Studio → Sceneditor** och välj mallen. **Redigera gemensam mall**
låser upp den; en ändring kan beröra flera rum, och editorn visar vilka.

- **Förhandsvisa och placera** växlar mellan tillåtna material utan att ändra
  standardval eller rum.
- Välj **Mobil** eller **Desktop**. Kortpunkter, marker, kortstorlek,
  kortvisning och spridning sparas per bord och format. Dealer, bakgrund och
  bordsstorlek delas inom formatet.
- **Flytta scenen tillsammans** flyttar dealer, bakgrund och bord med
  bibehållet avstånd. **Zooma in scenen** och **Zooma ut scenen** skalar alla
  tre runt mitten; ett zoomsteg stoppas om ett lager når sin gräns.
- **Storlek och placering** justerar ett lager i taget, 10–400 procent av
  scenbredden.
- **Spelknappar och chatt** anger önskad placering; spelet flyttar kontroller
  som annars skulle täcka kort eller menyer.
- **Ny sammansättning** skapar en ny mall med bara ett namn; det tekniska ID:t
  skapas automatiskt.

### Kort och marker

- **Autoskala efter dealern** låter kortens landning, storlek och marker följa
  filmen. Utan den används de sparade kortpunkterna.
- **Korten följer** och **Markerna följer** väljer **Bordet**, **Dealern**
  eller **Ligg still i scenen**. Bytet bevarar placeringen.
- Dra en punkt i scenen eller välj **Flytta punkt**. **Återställ sparade
  kort/marker** gäller bara vald grupp i aktuellt format. Desktop har sju
  platser och en dealerplats; mobil visar tre platser åt gången.
- **Kortvisning** väljer **På bordet** eller **Upplyfta** för valt bord och
  format.
- **Återanvänd kort och marker** kopierar båda formatens placering från ett
  annat tillåtet bord.

### Levande lager

**Bakgrund** och **Bord** kan ha en stillbild eller ljudlös MP4/WebM-loop som
grund och korta klipp ovanpå.

1. Välj grundbild eller videoloop och se till att lagret är aktivt.
2. Ladda upp det korta klippet och markera det som tillåtet för samma lager.
   Ett bordsklipp ska ha samma pixelmått som bordets basbild.
3. Lägg till klippet under **Bakgrundsklipp** respektive bordsklipp. Förvalet
   **Automatiskt · tidsintervall** styrs av **Spela var (sekunder)** och
   **Variation ± (sekunder)**; alternativet är **Spelhändelse**. **Prova
   klipp** spelar det utan att spara.

Bordsklipp spelas bara över standardbordet; kort och insatser följer basbordet.

### Spara och publicera placering

**Spara utkast** sparar mallen; **Kasta ändringar** hämtar senast sparade.
**Publicera sparad placering** för valt bolag visar berörda rum. **Läs in
placering i mallen** hämtar publicerad geometri till en äldre mall.

## Bord & bakgrunder

Biblioteket har flikar per filtyp och visar vilka mallar som använder filerna.
Uppladdning ändrar inga scenval. Koppla loss en fil i alla mallar innan den
tas bort; publicerade paket påverkas inte.

## Spelbolag & rum

Välj bolag i rubriken. Bolagets rum visas som kort med status och dealers.

- **Lägg till spel** öppnar val av sparad mall (i Admin: **Spelmall**),
  Blackjack eller Roulette och namn. Rummet och paketet sparas tillsammans; en
  kompatibel motorkonfiguration skapas automatiskt.
- Välj ett kort för att redigera rummet: scenen och tre väljare, **Bakgrund**,
  **Dealer** och **Bord**. Ett byte gäller bara det rummet. **Låst i
  publicerat paket** betyder att valet ändras i mallen, inte här. En inbakad
  bakgrund kan inte växlas separat.
- **Gemensam mall och tillåtna alternativ** öppnar mallen; berörda rum visas
  innan du sparar.
- **Spelmallar för bolaget** är bolagets paket: kryssa i vilka mallar bolaget
  får använda. Markeringarna ersätter paketets urval, så behåll alla mallar
  bolaget fortsatt ska ha.
- **Spelinställningar** (språk, insatser, tider) publiceras med **Publicera
  spelinställningar**. **Färg och standardval** och historiken öppnas vid behov.

Publicera så här: ändra → **Spara utkast** → **Granska publicering** →
kontrollera skillnaden och berörda rum → **Publicera granskat utkast**.
**Hämta senaste version** bevarar din redigering tills du väljer hur den
senaste versionen ska läsas in. **Kasta bolagets materialutkast** tar bort
bolagets aktiva materialutkast; publicerade rum ändras inte. Historiska
publiceringar kan återställas som nya utkast.

**Pausa spel** och **Öppna spel** styr om rummet tar emot spelare. **Ta bort**
tar rummet ur utbudet; ett rum återställt med **Återställ borttaget spel** är
pausat tills du öppnar det.

## Bolag & team och Partnerportalen

**Bolag & team** (`/admin/companies`): sök och välj bolag. **Skapa bolag**
föreslår ett adressnamn som kan justeras. Ett fält tar ny e-post eller ett
befintligt partnerkontos användarnamn; en ny adress får en aktiveringslänk.
**Vad får rollerna göra?** visar rollernas rättigheter. Den sista aktiva
administratören kan inte stängas av eller förlora sin roll. **Visa journal**
visar bolagets sparade ändringar med tid, aktör, åtgärd och revision; **Hämta
äldre ändringar** visar nästa sida.

**Partnerportalen** (`/partner`, `/partner/{bolagsslugg}`) är bolagets yta.
Bolagets personal loggar in på `/partner/login` och ser bara sina aktiva
medlemskap; intern personal når portalen med sin vanliga inloggning. I rummen
väljer bolaget bland de publicerade alternativ paketet tillåter; ändringar
kräver rätt roll och revision och granskas och publiceras separat. Geometrin
följer mallen. Spelare, transaktioner och rapporter från spelmotorn är ännu inte
kopplade till portalen. Ett bolag utan medlemmar får ingen partnerinloggning.

## Konton

- Samma inloggning gäller i spelet och i Admin; spelare nekas Admin.
- **Spelarkonton**: skapa och hantera spelare. En aktiv eller blockerad spelare
  med eget lösenord kan få nytt lösenord (två gånger och en anledning); gamla
  sessioner återkallas, saldo och historik behålls. Stängda konton har inget
  lösenordsbyte.
- **Konton & åtkomst**: bjud in intern personal med e-post. Mejlet kommer från
  `no-reply@scoutgaming.tech`; engångslänken gäller 72 timmar och
  återställningslänkar två timmar. Ett skickat mejl bevisar inte att kontot är
  aktiverat. Inbjudan skapar ingen personal hos ett bolag; det görs i **Bolag &
  team**.

## Drift, Ekonomi och System

- **Drift → Spelstatus** visar spelmotor, kortlek och spelintegritet.
- **Drift → Taldrift** skiljer sparat önskemål från faktisk drift. Välj Av,
  Sparläge eller Varm och en GPU-profil; servern avgör vilka val som går.
  **Använd läge** sparar önskemålet. **Stoppa drift** begär Av; först en färsk
  observation bekräftar stoppet. Vid ändrad revision: uppdatera status och
  **Läs in sparat val** innan du gör om valet.
- **Ekonomi → Översikt** visar kontorörelser och diagram från hämtade
  journalposter, inte GGR eller revshare. **Ekonomi → Betalningar** visar
  serverns senaste journalposter; **Visa detaljer** visar spelar-ID,
  händelsetyp och tid i UTC.
- **Systeminställningar** sparar ett modellval per agent; **Ångra alla**
  återställer osparade val.
- **Kopplingar & användning** visar bolag, dealers, bord, bakgrunder och mallar
  med användning. **Ändra mallens kopplingar** öppnar mallen; **Ändra bara
  rummets val** redigerar ett publicerat rum.

## Roulette

I Admin: öppna `/admin/clips`, välj dealer och Roulette. Korten visar vila,
insatser, hjulstart, utfall och resultat. Bara befintliga videofack kan laddas
upp. **Bakgrund och bord · bild/video** väljer separata lager; bord filtreras
efter speltyp. Roulette använder Desktop 16:9 även på mobil. Se
[roulettens klippkarta](../../../docs/games/roulette/KLIPPKARTA.md).

För spelaren: välj markervärde och klicka på satsningsbordet. Ångra, rensa
och upprepa ändrar osända satsningar; snurra skickar rundan. Roulette har enkel
nolla, samma inloggning och demosaldo som blackjack och ingen gemensam
nedräkning mellan spelare.

## Ta bort och återställa

Varje borttagning öppnar en bekräftelseruta som visar konsekvenserna och kör
serverns kontroll. Du skriver aldrig in något ID. **Avbryt** eller Esc ändrar
ingenting; nekar servern visas orsaken.

- **Klipp** (klippkartans **Inställningar**): **Radera** flyttar klippet
  till **Arkiv**; **Radera valda** och **Radera alla** gör samma sak i grupp. I
  arkivet finns **Återställ** och **Radera permanent**. Permanent radering
  kräver att klippet är arkiverat, att uppladdningstillåtelsen (15 minuter)
  löpt ut och att inget använder det; annars **Behåll i arkivet**.
- **Dealers**: **Ta bort** flyttar dealern till **Papperskorg**, stänger av
  AI-tal och avpublicerar berörda rum; källfiler bevaras. **Återställ** ger
  dealern tillbaka som utkast utan att öppna rum. **Radera permanent** kräver
  kryss i **Jag förstår att filerna raderas permanent**. Vid avbrott visas
  **Slutför radering**.
- **Bolag och rum**: **Flytta till papperskorgen**, **Återställ**, **Pausa** och
  **Öppna** bekräftas i samma ruta. Ett borttaget bolag kopplar loss sina rum
  med historiken bevarad. Att återställa bolaget öppnar inga rum: återställ
  varje rum (det blir väntande) och öppna det när beroendena är giltiga.
- **Mallar**: borttagning ändrar utkastet; publicerade rum behåller sin version.

## Lobby och spelstart

I `/lobby` väljer spelaren bolag, rum, dealer, bord och bakgrund och **Spela
med …**. Spelet startar på `/game?game=blackjack|roulette&operator=…&table=…`;
`/player-login` är inloggningen. Ett tomt paket visar inga öppna rum.

## Material och granskningsregler

- Text, ljud och bild i en tagning hör ihop. Ändrad text eller ändrade bytes
  ogiltigförklarar tidigare godkännande.
- Fri chatt visas aldrig med en gammal inspelad talfilm.
- Filnärvaro, hash, uppspelningskvitto eller ett godkänt klippval är inte
  godkänd läppsynk. Ljud och läppsynk bedöms av Jakob.
- Använd [tagningsmallen](templates/media-take.md) vid medieöverlämning.

## Äldre adresser och mer

`/control/*`, `/lab`, `/labb` och `/studio` leder till motsvarande `/admin`-sida
med kontexten bevarad (`dealerId` blir `dealer`, `lane` blir `composition`);
`/admin/media-review` leder till **Röst & tal**;
`/bo`, `/v2`, `/demo` och `/casino.html` är borta. Se även
[utvecklarreferensen](../README.md), [lagrings- och uppspelningskontrakt](../../../docs/LOCAL-PRESENTATION-RUNTIME.md)
och [läget](../../../docs/NEXT-AGENT.md).
