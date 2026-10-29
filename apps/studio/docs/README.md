# Admin: användarguide

Så här arbetar du i Scoutgaming Admin (`/admin`) i dag. Varje avsnitt nedan
motsvarar ett menyval och dess flikar. Orden förklaras i
[ordlistan](TERMINOLOGI.md); Admins **Hjälp** (`/admin/guide`) är den korta
versionen i produkten. Vissa äldre paneler säger fortfarande **rum** (spelbord)
eller **sammansättning** (miljö); guiden citerar knapparna som de står.

## Menyn

| Menyval | Adress | Flikar |
| --- | --- | --- |
| Översikt | `/admin` | Det som väntar på dig, med länk dit det åtgärdas |
| Dealers | `/admin/dealers`, en dealer `/admin/dealers/{dealer}` | Klippkarta · Röst och tal · Landningar · Används av · Inställningar |
| Miljöer och material | `/admin/scenes?tab=…` | Miljöer · Bakgrunder · Bordsgrafik · Papperskorg |
| Bolag och spelbord | `/admin/companies?tab=…` | Bolag · Alla spelbord · Papperskorg |
| ett bolag | `/admin/companies/{bolag}?flik=…` | Spelbord · Tilldelning · Team · Inställningar |
| ett spelbord | `/admin/rooms/{spelbord}?flik=…` | Utseende · Dealer · Spelinställningar · Tillgänglighet · Bolagets val · Historik |
| System | `/admin/system?flik=…` | Drift · AI-agenter · Scoutgamings personal · Spelarkonton · Integration · Beroenden · Intern lobby |
| Hjälp | `/admin/guide` | Menyn, vem som får ändra vad, orden och dealerflödet |

Portalraden överst leder till Admin, Partnerportalen och Lobbyn; intern
personal når alla tre med samma konto. **Ctrl K** söker dealers, bolag och
spelbord.

## Arbetsgången

Dealerns sida visar de sju första stegen överst och markerar de som är klara.

1. **Skapa dealer**: Dealers → **Ny dealer** → namn → **Skapa dealer**.
2. **Lägg till klipp**: dra in filmer i dealerns klippkarta.
3. **Klipp per fack**: välj standardklipp för giv, vila och tal och
   **Spara utkast**. Mätarna **Giv**, **Tal** och **Vila** visar vad som
   saknas.
4. **Mät landningar**: kommer senare; i dag finns landningar bara för de
   filmade dealerna.
5. **Röst och tal**: granska tagningarna och välj standard i varje talfack.
6. **Godkänn**: checklistan under **Inställningar** visar läget. Godkännandet
   sparas inte ännu.
7. **Tilldela**: kryssa i dealern i en miljö
   ([Miljöer](#miljöer-och-material)) och ge bolaget miljön under
   **Bolag › Tilldelning**.
8. **Spelbord**: **Nytt spelbord** hos bolaget. Det skapas pausat.
9. **Publicera** och öppna spelbordet under **Tillgänglighet**.

### Publicera i dag: en huvudknapp per spelbord

Att spara ändrar bara utkastet; spelaren ser ändringen först efter
publicering. Huvudvägen är spelbordets egen **Publicera** (steg D i
[ADMIN-FORENKLING](../../../docs/plans/ADMIN-FORENKLING.md), avsnitt 7), som
visar vad som ändras jämfört med live och tar med tal, klipp, vila och
placering för bolaget:

| Knapp | Var | Vad den publicerar |
| --- | --- | --- |
| **Publicera** → **Publicera nu** | Spelbord (öppet blackjackbord) | Bolagets sparade tal, klipp, vila och placering, fryst som ny version |
| **Publicera** | Bolag › Tilldelning | Ett ändrat urval av miljöer och det bolaget får ändra själv (insatsprofiler, språk), i den ordningen |
| **Publicera · N ändringar** → **Publicera nu** | Spelbord › Utseende | Spelbordets bakgrund, dealer och bordsgrafik |
| **Publicera spelinställningar** | Spelbord › Spelinställningar | Bordsspråk och insatsprofil |

Under **Avancerat** finns smala knappar för det huvudknappen inte når:

- **Publicera igen** (Bolag › Tilldelning) fryser om ett oförändrat urval,
  till exempel för roulette eller ett spelbord som inte är öppet.
- **Publicera sparad placering** (Miljöer) uppdaterar placeringen i alla
  bolagets spelbord som använder miljön.
- **Publicera PAOWs viloklipp** (Spelbord › Utseende) uppdaterar PAOWs
  vilosekvens, även när miljön är borttagen eller klippen underkänns.

Nytt tal används först efter **Publicera** i spelbordet.

## Översikt

Listar det som väntar: dealers där klipp saknas, pausade och opublicerade
spelbord och bolag utan publicerad tilldelning. Genvägar: **Ny dealer**,
**Nytt bolag**, **Nytt spelbord**, **Lägg till klipp**, **Tilldela innehåll**
och **Skapa demo** (`/admin/demo`).

## Dealers

Listan visar varje dealer med mätarna Giv, Tal och Vila, **Redo för spel**
eller **Klipp saknas**, och vilka bolag som använder den. **Ny dealer** ber
bara om ett namn; därefter leder **Lägg till klipp** vidare. Under listan
ligger **Papperskorg** (se [Ta bort och återställa](#ta-bort-och-återställa)).

Astrid är en märkt äldre referens; hennes egna verktyg gäller bara henne.

### Klippkarta

Fliken visar **Spel** (Blackjack eller Roulette), **Miljö** och
**Scenförhandsvisning**. **Spelbord och publicering** låter dig välja bolag
och spelbord för sammanhang; kartan visar ändå alltid projektutkastet, och ett
valt spelbord gör inte en ändring rumsspecifik.

Kartan kan zoomas, panoreras och ordnas; **Visa alla kort** och **Återställ
placering** ändrar inga kopplingar. **Förhandsvisa och redigera** öppnar
klippet med situation, varianter och **Körregel**; **Klippguide** förklarar
handlingen och poserna.

Kategorierna är spelhandlingar (plats 1–7, dealerns öppna och dolda kort,
vändning, **Övergångar**), **Vila** och **Talade repliker**. En position utan
klipp hoppas över i spelet; kortet visas ändå.

#### Lägg till klipp

**Lägg till klipp** (`?flik=klipp&panel=intake`) har två vägar: **Ladda upp
filer** och **Importera mapp**. **Skapa material** är avstängt tills vidare.

1. Dra in filer eller en mapp på kartan, eller släpp en fil på ett kort för ett
   bestämt fack. Varje fil visas med stillbild, föreslaget fack (**Kategori ›
   Situation**), roll (**Standard** när facket saknar standard, annars
   **Variant**) och hur säkert förslaget är.
2. **Osäker · välj fack**: välj fack i listan eller dra kortet till rätt
   kategori. Kartan visar vilka fack som tar emot filen.
3. **Godkänn och spara** laddar upp klippen som tagningar i sina fack och visar
   ett kvitto per fil.
4. Välj standard eller variant, eller **Öppna facket i kartan**, och **Spara
   utkast**.

MP4 och WebM stöds, högst 128 MiB per fil. Grön bakgrund är förval;
transparent bakgrund är spärrad för import. Talklipp väntar på granskning i
talfacket. Filer med fel försöks inte om automatiskt. Roulettefilmer laddas
upp via respektive kort.

**Importera mapp** (`?flik=klipp&tool=import`) tar upp till 30 filer: välj
**Bakgrund för hela omgången** och **Sortera klippen**, granska facken och
placera klippen.

#### Namnge filerna

Intaget läser filnamnet och mappens namn. **Så namnger du filerna** visar
mönster och exempel. Mönstret är
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

#### Vila och körregel

Under **Vila → Basloop och beteendeklipp** öppnar du **Förhandsvisa och
redigera → Körregel**. Varje beteendeklipp startar **Av**, **Ibland ·
intervall** (ungefär var N:e sekund med variation, minsta paus och tak per
minut), **Vid spelhändelse** eller via **OpenClaw**. Händelseregler körs när
miljöns **Automatik / OpenClaw** står på **Regler** och utkastet är sparat
och publicerat. De
väntar på kort, tal och basfilmens klippgräns; de skapar aldrig tal eller
ändrar spelresultat. Kontrollera att ett beteendeklipp är tyst och återgår
till vila. Ett klipp på **OpenClaw** får fältet **Vad klippet visar** (högst
80 tecken); OpenClaw väljer utifrån den texten vid tur eller resultat
när miljöns vila står på **OpenClaw**.

#### Sammanhängande vilosekvens

PAOW och Dragan har Kevins urval av viloklipp som en fryst källa. När
dealern har en basloop visar **Körregel** avsnittet **Sammanhängande
vilosekvens** med alla klipp i källan. Varje rad visar pose (vila eller
knäppta händer), fas (insatsfas eller spelarens beslut) och om originalet
**saknas i biblioteket**. Originalet `andas` måste vara basklipp innan
sekvensen kan kopplas.

1. Bocka ur klipp som inte ska spelas. Basklippet ingår alltid. Knäppta
   händer kräver minst ett klipp in i posen och ett tillbaka till vila.
2. **Koppla N viloklipp** kopplar urvalet till de redan uppladdade
   originalen. Knappen är spärrad så länge ett valt original saknas; ladda
   upp det i klippkartans intag (facket **Vila**) eller bocka ur det.
3. En kopplad sekvens ändras genom att bocka ur eller i. Ligger klipp
   utanför källans urval kvar i en äldre sekvens, tar **Uppdatera till
   urvalet** bort dem; knappen visas bara då.
   Ett kopplat klipp som börjar och slutar i vila har brytaren **OpenClaw
   får föreslå klippet** och då fältet **Vad klippet visar**. Klippet ingår
   fortfarande i sekvensen; OpenClaw kan dessutom föreslå det vid tur och
   resultat, och då spelas det en gång innan sekvensen fortsätter. Valen och
   beskrivningarna behålls när urvalet ändras. Spelmotorn behöver
   runtimekapabilitet v32 innan en sådan sekvens kan sparas.
4. Spara utkastet och välj **Publicera** i spelbordet. För PAOW är stegen
   **Koppla 21 viloklipp** → spara → **Publicera** (eller **Avancerat** ›
   **Publicera PAOWs viloklipp**) i spelbordet (produktionsutkastet har
   ingen sekvens än, så **Uppdatera till urvalet** visas inte). **Återgå till enbart basklippet** tar bort
   sekvensen; originalen behålls.

#### Övergångar och delat bord

**Övergångar** har **Till skon** (VILA → REDO, före första givningen) och
**Från skon** (REDO → VILA, efter sista). Välj en annan film i facket och
**Lägg till som variant** för att behålla standardklippet. **Koppla för delat
bord** i givklippets panel kopplar de filmer som behövs med dealerns valda
skoklipp; **Koppla hela givbanken** behåller sitt tidigare urval. Ingen knapp
godkänner film eller tal. Spara utkastet och publicera separat.

#### Provspela

**Scenförhandsvisning** öppnar **Provspela sparad scen**; samma prov finns
under dealerns förhandsvisning och på fliken Landningar. Välj en sparad
miljö och starta. Provet använder miljöns sparade förval, inte osparade
ändringar, det markerade klippet eller spelbordets publicerade val. Det har
eget testsaldo; chatt och genererat tal är avstängda. Provet gäller Blackjack
på dator.

### Röst och tal

Talkedjan byggs om, likadant för alla dealers; verktygen fungerar som i dag.

**Inspelat tal** har en rad per replik i spelets ordning och därefter övriga
repliker som har filer.

1. Öppna en replik, välj **Svenska** eller **English** och välj tagning.
   Högsta tagningsnumret står först.
2. Spela tagningen med ljud och välj **Godkänn tal**, **Underkänn** eller
   **Ta bort bedömning**.
3. **Sätt som standard i talfacket** lägger tagningen som standard i
   projektutkastet. Spara utkastet.
4. Välj **Publicera** i spelbordet; först då används de godkända
   tagningarna.

Status per tagning: **Godkänd av**, **Underkänd**, **Väntar på granskning**
eller **Saknar talkvitto** (kan inte godkännas). **Godkänn tal** kräver en
verifierad inspelning. Bedömningen binds till filens exakta hash, text, språk
och tagning och är ditt intyg om att du sett och hört filen, ingen mätning av
läppsynk. En underkänd tagning spelas inte.

**Genererat tal · AI-röst** och **Realtidstal** kräver en verifierad
röstprofil; dealers utan en sådan har **Förbered röstprofil för
realtidstal**. Att spara en röstprofil gör inget betalt prov och godkänner
ingen läppsynk.

**Referenstyp** under realtidstal: **Stillbild** (en ruta ur dealerns egen
video, stillbildsvägen) eller **Rörlig** (dealerns bank, `motion-video`).
En rörlig referens kan alltid sparas som förberedelse; bankbygget tar den
valda positionen som vilaruta och kräver steg om 125 ms (hel ruta i 24 fps).
**Begär AI-tal** går att slå på för en rörlig referens bara när miljöns
driftprofil för dealern har en bankhash (`CROUPIER_STUDIO_MOVING_DRIFT_PROFILES`
på Vercel); servern vägrar annars sparningen (`studio_speech_bank_missing`),
utom för en redan begärd profil med samma referens (rösten får bytas).
Referensen ska vara ett av bankens klipp. Referenstypen kan inte
bytas medan AI-tal är begärt. Paows körning:
[PAOW-BANK-KORNING](../../../docs/PAOW-BANK-KORNING.md).

Under talpanelen finns:

- **Tal vid inaktivitet**: inte anslutet per dealer ännu.
- **Taldrift**: talets GPU-läge. Välj Av, Sparläge eller Varm och en
  GPU-profil; servern avgör vilka val som går. **Använd läge** sparar
  önskemålet. **Stoppa drift** begär Av; först en färsk observation bekräftar
  stoppet. Vid ändrad revision: **Uppdatera status** och **Läs in sparat val**
  innan du gör om valet.
- **Svarsbibliotek**: dealerns sparade AI-svar med exakt text, ljud och video.
  Biblioteket startar ingen generering och publicerar inga klipp.
- **Dialogtest** (`?flik=tal&verktyg=dialog`): chatta med dealerns sparade
  AI-inställningar, inte med inspelade tagningar.

**Prova Dragans publicerade chatt och tal**: välj Sparläge under Taldrift när
servern tillåter tal och kontrollera att spelbordets miljö har **Automatik
/ OpenClaw** satt till **Aktiv** för Tal. Öppna lobbyn och välj bolag,
spelbord och Dragan. Börja med en kort textfråga med
mikrofonen av; kontrollera röst, ljud, munrörelser och återgång till vila
innan du provar mikrofonen. Avsluta med **Stoppa drift** och vänta på
bekräftat Av.

### Landningar

Visar hur dealerns givklipp är kopplade och miljöerna som tillåter
dealern, med **Provspela sparad scen**. **Mät landningar** och **Exportera
landningsmall** kommer senare. Bordsgrafiken ritas efter dealern, inte
tvärtom; lagrens storlek och läge ändras under Miljöer.

### Används av

Spelbord, bolag och miljöer som använder dealern, och **Alla kopplingar**
(samma läsning som System › Beroenden).

### Inställningar

- **Godkännande**: checklistan (giv, vila, tal, landningar, minst en
  miljö). Den visar läget; godkännandet sparas inte ännu.
- Dealerns klipp och arkiv: **Bibliotek** och **Arkiv**, kategorier, **Radera
  valda** och **Radera alla**. Hela dealern tas bort under Dealers (se
  [Ta bort och återställa](#ta-bort-och-återställa)).
- **Tekniska detaljer**: dealer-id, lagringsmapp och miljöer.

## Miljöer och material

En miljö placerar bakgrund, dealer och bordsgrafik för dator och mobil och
säger vilka dealers och vilket material den tillåter. Flera spelbord kan dela
samma miljö.

### Miljöer

Korten visar varje miljö med dealers och spelbord som använder den. Välj ett
kort för att redigera. **Ny miljö** skapar en ny miljö med namn och
dealer; det tekniska id:t skapas automatiskt. Kortet visar miljöbilden, annars
bakgrunden och bordsgrafiken på sin placering för dator.

- **Redigera gemensam miljö** låser upp miljön; editorn visar vilka spelbord
  som berörs.
- **Miljöbild – visas i lobbyn och Admin, aldrig i spelet**: välj en av
  miljöns bilder eller **Ingen miljöbild**. **Exportera miljöbild** ritar den
  sparade scenen för dator (1920 × 1080: bakgrund, bordsgrafik och dealern på
  sin placering) och sparar den som nytt material, "<Miljö> · miljöbild v2".
  Spara utkastet först. Den nya bilden väljs i utkastet. Miljöns äldre
  exporterade bilder som ingen miljö visar flyttas till materialarkivet (de
  räknas inte som bakgrund eller bordsgrafik); den bild miljön visar ligger kvar. Lobbyn visar miljöbilden, annars den publicerade bakgrunden, annars en
  designillustration. Insatsprofilen väljer ingen bild.
- **Dealers i den gemensamma miljön** och **Förvald dealer**: här tillåter du
  dealern i miljön, steg 7 i arbetsgången.
- **Förhandsvisa och placera** växlar mellan tillåtet material utan att ändra
  standardval eller spelbord.
- Välj **Mobil** eller **Desktop**. Kortpunkter, marker, kortstorlek,
  kortvisning och spridning sparas per bordsgrafik och format. Dealer,
  bakgrund och bordsstorlek delas inom formatet.
- **Flytta scenen tillsammans** flyttar dealer, bakgrund och bordsgrafik med
  bibehållet avstånd. **Storlek och placering** justerar ett lager i taget;
  bordsbredden är 10–400 procent av scenbredden.
- **Spelknappar och chatt** anger önskad placering; spelet flyttar kontroller
  som annars skulle täcka kort eller menyer.
- **Automatik / OpenClaw** väljer klippval per fas (Vänta, Deal, Visa, Tal,
  Bildgranskning): **Av**, **Regler**, **Slump**, **Skuggläge** eller
  **Aktiv**. Ett publicerat spelbord följer det här valet.

#### Kort och marker

- **Autoskala efter dealern** låter kortens landning, storlek och marker följa
  filmen. Utan den används de sparade kortpunkterna.
- **Korten följer** och **Markerna följer** väljer **Bordet**, **Dealern**
  eller **Ligg still i scenen**. Bytet bevarar placeringen.
- Dra en punkt i scenen eller välj **Flytta punkt**. **Återställ sparade
  kort/marker** gäller bara vald grupp i aktuellt format. Desktop har sju
  platser och en dealerplats; mobil visar tre platser åt gången.
- **Kortvisning** väljer **På bordet** eller **Upplyfta**.
- **Återanvänd kort och marker** kopierar båda formatens placering från en
  annan tillåten bordsgrafik.

#### Levande lager

Bakgrund och bordsgrafik kan ha en stillbild eller ljudlös MP4/WebM-loop som
grund och korta klipp ovanpå.

1. Välj grundbild eller videoloop och se till att lagret är aktivt.
2. Ladda upp det korta klippet och markera det som tillåtet för samma lager.
   Ett klipp för bordsgrafiken ska ha samma pixelmått som dess basbild.
3. Lägg till klippet under **Bakgrundsklipp** respektive bordsklipp. Förvalet
   **Automatiskt · tidsintervall** styrs av **Spela var (sekunder)** och
   **Variation ± (sekunder)**; alternativet är **Spelhändelse**. **Prova
   klipp** spelar det utan att spara.

Bordsklipp spelas bara över standardbordsgrafiken; kort och insatser följer
basbilden.

#### Spara och publicera placering

**Spara utkast** sparar miljön; **Kasta ändringar** hämtar senast
sparade. För att publicera bara placeringen: öppna **Spelbord och
publicering**, välj bolag och sedan **Publicera sparad placering**; rutan
visar berörda spelbord. **Läs in placering i mallen** hämtar ett bolags
publicerade placering som utgångspunkt.

### Bakgrunder och Bordsgrafik

Materialbiblioteket per lager. **Ladda upp** tar PNG, JPEG, WebP, MP4 eller
WebM, högst 128 MB. **Skapa med AI** tar fram förslag efter din beskrivning;
välj ett och **Använd**. Bakgrunden ritas alltid från dealerkameran med golvet
synligt; rumsbilder blir miljöbilder. Valt förslag visas i miljön för dator och mobil;
en gul varning ("Korten kan bli svårlästa: box 4") betyder orolig filt eller
svag kontrast där korten landar, men du väljer själv. Bordsgrafik ritas efter
en filmad dealers landningar och passar bara miljöer med samma placering. Uppladdning ändrar inga
scenval; **Visa var den används** visar vilka miljöer som använder filen.

#### Bord och bakgrund med AI

**Skapa med AI** i Bordsgrafik ritar bordet åt en vald dealer och scenmall.
Spelbordets **Utseende** har länken **Skapa bord och bakgrund med AI för
spelbordet**, som öppnar samma dialog för det spelbordet.

- **Stil**: **Mörk lyx** (svart filt, rosenträ, guldkant) och **Aggressiv
  neon** (svart filt, magenta och cyan ljuslinje) först, sedan **Klassiskt
  casino** (grön filt, mahogny, guldrand) och de tre tidigare **Mörk studio**,
  **Varm lounge** och **Ljus studio**. **Fri** följer bara beskrivningen och
  inspirationsbilden; bildens dominerande färg blir bordets färg, mörkad
  tills boxarnas vita streck har kontrasten 3:1 mot filten.
- **Bredd**: bocken **Anpassa bordets bredd efter dealerns räckvidd** (på som
  standard) ritar bordet så att boxarna fyller 75 % av bordet. Bordsbredd %
  följer med till scenmallen för både dator och mobil; för PAOW blir det
  37,7 % på dator (tidigare 31,6 %) och 119 % på mobil (tidigare 100 %).
  Boxarna ritas exakt ur dealerns filmade profil, så korten landar i dem.
- **Använd**: välj ett förslag och **Använd**. Med bocken **Använd i miljön
  *scenmall* och i spelbordet *spelbord*** (när dialogen öppnats från ett
  spelbord) tillåts materialet i scenmallen, blir standard, får sin
  bordsbredd och spelbordet publiceras, allt i en transaktion. Utan spelbord
  sparas scenmallen som utkast, och du publicerar själv. Utan bocken hamnar
  förslaget bara i biblioteket. Detta stoppar **Använd** (felet
  `studio_release_invalid` med skälet inom parentes); inget skrivs och
  materialet ligger kvar i biblioteket:
  - spelbordet har andra sparade men opublicerade ändringar, även ett
    utkast till spelinställningarna (`studio_release_other_changes`; utkastet
    står kvar), eller saknar publicerade spelinställningar
    (`studio_room_game_config_missing`);
  - spelbordet använder en annan scenmall (`ai_adopt_other_template`), eller
    scenmallen eller materialet finns inte (`ai_adopt_template_missing`,
    `ai_adopt_material_missing`);
  - bolaget eller spelbordet har ett eget val som döljer mallens standard
    (`ai_adopt_room_choice`); välj då materialet under Utseende;
  - en ny bredd skulle nå ett annat öppet spelbord hos bolaget på samma
    scenmall som visar ett annat bord, t.ex. Privé
    (`ai_adopt_other_room_table`): bredden gäller hela mallen;
  - bordsgrafiken passar inte scenmallens dealers eller placering
    (`ai_adopt_table_misfit`), eller ett äldre AI-bord i mallen skulle bli
    felpassat av den nya bredden (`ai_adopt_template_table_misfit`): ta bort
    det ur mallen eller rita om det;
  - samma material är redan live, så inget skiljer sig
    (`studio_release_unchanged`).
- **Tema**: **Skapa bord + bakgrund + miljöbild från samma tema** skapar bord
  och bakgrund parallellt med samma beskrivning, stil och inspirationsbild;
  välj ett av varje och **Använd** lägger in båda. Miljöbilden hoppas över
  och dialogen säger det: scenexporten och rollen illustration finns inte
  ännu.

### Papperskorg

Bakgrunder och bordsgrafik i papperskorgen kan återställas; permanent radering
är ett eget steg. Publicerade spelbord påverkas inte. En miljö har ingen
papperskorg; den tas bort när inget spelbord använder den.

## Bolag och spelbord

- **Bolag**: alla aktiva bolag med status, tilldelningens version och antal
  spelbord. **Nytt bolag** skapar bolaget och bjuder in dess första
  administratör; nästa steg är **Till bolagets tilldelning**.
- **Alla spelbord**: alla bolags spelbord, filtrerbara per bolag. **Nytt
  spelbord** frågar efter bolag, miljö, spel (Blackjack eller Roulette) och
  namn och visar den sparade scenen bredvid; avsluta med **Lägg till spel**.
  Spelbordet skapas pausat. Bakgrund och bordsgrafik väljer du efteråt under
  Utseende.
- **Papperskorg**: arkiverade bolag och spelbord.

### Ett bolag

Bolaget öppnas på **Spelbord**. Gamla flikadresser leder vidare:
`?flik=spelare` och `?flik=integration` till Spelbord, `?flik=journal` till
Inställningar. Spelare och ekonomi per bolag kommer tillbaka när spelarna
hör till ett bolag; tills dess finns de under System › Spelarkonton, och
API-nycklarna under System › Integration.

- **Spelbord**: bolagets spelbord, **Nytt spelbord**, startadress per
  spelbord och bolagets papperskorg.
- **Tilldelning**: en form med en knapp. Kryssa i de miljöer bolaget får
  använda; dealers, bakgrunder och bordsgrafik följer med via miljöerna.
  Markeringarna ersätter urvalet, så behåll alla miljöer bolaget fortsatt
  ska ha. Under **Tilldelat bolaget** väljer du vad bolaget får ändra själv i
  Partnerportalen: dealer, bordsgrafik och bakgrund (bara där miljön
  tillåter det; annars *Låst i miljön*), bordsspråk, insatsprofil och
  paus, och vilka insatsprofiler och språk bolaget väljer bland. Ett upplåst
  språk eller en upplåst insatsprofil kräver minst ett alternativ.
  **Publicera** skickar det som är ändrat: urvalet först och sedan det bolaget
  får ändra, på versionen från första kvittot. Varje steg ger paketet en ny
  version och en rad i journalen; Partnerportalen läser den direkt. Stoppas
  ett steg (till exempel för att någon annan har publicerat) försöker Admin
  inte igen; läs in bolaget och publicera på nytt.
- **Team**: medlemmar, roller och inbjudningar. Ett fält
  tar ny e-post eller ett befintligt partnerkontos användarnamn; en ny adress
  får en aktiveringslänk. **Vad får rollerna göra?** visar rollernas
  rättigheter. Administratören utses bara av Admin, och den sista
  administratören kan inte stängas av.
- **Inställningar**: namn, status, **Livscykel** (**Flytta bolag till
  papperskorgen**, **Återställ bolag**) och **Journal**: bolagets ändringar
  med tid, aktör, åtgärd och version; **Hämta äldre ändringar** visar nästa
  sida. Namnet ändras inte från Admin i dag.

Knapparna **Skapa demo** och **Öppna Partnerportalen** ligger i rubriken.

### Ett spelbord

Rubriken visar spel, dealer, miljö, publicerad version och om ett utkast
väntar. **Öppna i spelet** startar spelbordet.

- **Utseende**: **Publicerat nu** visar live-valen. Välj bakgrund, dealer och
  bordsgrafik inom miljön och **Spara utkast**. **Publicera · N
  ändringar** öppnar **Granska och publicera** med skillnaden mot live och
  berörda spelbord; **Publicera nu** publicerar. **Hämta senaste version**
  bevarar din redigering tills du väljer hur den ska läsas in. **Kasta
  bolagets utkast** tar bort bolagets utkast; publicerade spelbord ändras
  inte. I versionshistoriken återställer **Återställ till utkast** en äldre
  version som nytt utkast. Utseendet kräver att tilldelningen är publicerad.
- **Dealer**: dealers i spelbordets miljö, med länk till dealerns sida.
  Dealern väljs under Utseende.
- **Spelinställningar**: **Bordsspråk** och **Insatsprofil**. **Spara
  spelinställningar** och sedan **Publicera spelinställningar**. Gäller
  öppna, publicerade Blackjack-spelbord.
- **Tillgänglighet**: **Pausa spelbordet** gäller direkt; ett pausat
  spelbord syns inte i lobbyn och pågående rundor spelas klart. **Öppna
  spelbordet** öppnar det för spelare.
- **Bolagets val**: vad bolaget får ändra på spelbordet (dealer, bordsgrafik,
  bakgrund, utseende). Bordsspråk och insatsprofil är låsta. Valen gäller per
  miljö i dag.
- **Historik**: bolagets journal; raderna för spelbordet nämner dess namn.

## Partnerportalen

Partnerportalen (`/partner`, `/partner/{bolag}`) är bolagets yta. Bolagets
personal loggar in på `/partner/login` och ser bara sina aktiva medlemskap;
intern personal når portalen med sin vanliga inloggning. På sina spelbord
väljer bolaget bland det tilldelningen tillåter och publicerar med samma
granskning som under Utseende; ändringar kräver rätt roll och version.
Placeringen följer miljön. Bolagets egna API-nycklar visas maskerade.
Spelare, transaktioner och rapporter från spelmotorn är ännu inte kopplade
till portalen. Ett bolag utan medlemmar får ingen partnerinloggning.

## System

- **Drift**: spelmotor, kortlek och spelintegritet. Talets drift finns under
  Dealers › Röst och tal.
- **AI-agenter**: om OpenAI-nyckeln finns i driftmiljön (den visas aldrig) och
  ett modellval per agent; **Ångra alla** återställer osparade val.
- **Scoutgamings personal**: interna konton och roller. **Bjud in
  adminpersonal** skickar en engångslänk som gäller 72 timmar;
  återställningslänkar gäller två timmar. Ett skickat mejl bevisar inte att
  kontot är aktiverat. Inbjudan skapar ingen personal hos ett bolag; det görs
  under Bolag › Team.
- **Spelarkonton**: alla spelare oavsett bolag, för support. Skapa och hantera
  spelare; en aktiv eller blockerad spelare med eget lösenord kan få **Nytt
  lösenord** med en **Orsak**. Gamla sessioner återkallas, saldo och historik
  behålls; stängda konton har inget lösenordsbyte. Under spelarna visar
  **Ekonomisk översikt** kontorörelser från hämtade journalposter (inte GGR
  eller revshare) och betalningsjournalen; **Visa detaljer** visar spelar-id,
  händelsetyp och tid i UTC.
- **Integration**: API-nycklar och testsession. **Ny partnernyckel** kräver
  att du väljer bolaget som nyckeln gäller.
- **Beroenden**: bolag, dealers, bordsgrafik, bakgrunder och miljöer med
  användning. **Ändra mallens kopplingar** öppnar miljön; **Ändra bara
  rummets val** öppnar ett publicerat spelbords egna val.
- **Intern lobby**: `/admin/lobby` visar alla bolags spelbord, även pausade;
  `/lobby` är den publika.

## Roulette

I Admin: öppna dealerns Klippkarta och välj **Spel → Roulette**. Korten visar
vila, insatser, hjulstart, utfall och resultat. Bara befintliga videofack kan
laddas upp, via respektive kort. **Bakgrund och bord · bild/video** väljer
separata lager; bordsgrafik filtreras efter speltyp. Roulette använder Desktop
16:9 även på mobil och har ingen inbäddad provstart. Se
[roulettens klippkarta](../../../docs/games/roulette/KLIPPKARTA.md).

För spelaren: välj markervärde och klicka på satsningsbordet. Ångra, rensa
och upprepa ändrar osända satsningar; snurra skickar rundan. Roulette har enkel
nolla, samma inloggning och demosaldo som Blackjack och ingen gemensam
nedräkning mellan spelare.

## Ta bort och återställa

Varje borttagning öppnar en bekräftelseruta som visar konsekvenserna och kör
serverns kontroll. Du skriver aldrig in något id. **Avbryt** eller Esc ändrar
ingenting; nekar servern visas orsaken.

- **Klipp** (Dealers › Inställningar): **Radera** flyttar klippet till
  **Arkiv**; **Radera valda** och **Radera alla** gör samma sak i grupp. I
  arkivet finns **Återställ** och **Radera permanent**. Permanent radering
  kräver att klippet är arkiverat, att uppladdningstillåtelsen (15 minuter)
  löpt ut och att inget använder det; annars **Behåll i arkivet**.
- **Dealers**: **Arkivera** i dealerlistan flyttar dealern till
  **Papperskorg** under Dealers, stänger av AI-tal och
  avpublicerar berörda spelbord; källfiler bevaras. **Återställ** ger dealern
  tillbaka som utkast utan att öppna spelbord. **Radera permanent** kräver
  kryss i **Jag förstår att filerna raderas permanent**. Vid avbrott visas
  **Slutför radering**.
- **Bolag**: **Flytta bolag till papperskorgen** under bolagets
  Inställningar stänger portalen och flyttar alla bolagets spelbord till
  papperskorgen med historiken bevarad. **Återställ bolag** öppnar inga
  spelbord: återställ varje spelbord under Papperskorg (det kommer tillbaka
  pausat) och öppna det under Tillgänglighet när beroendena är giltiga.
- **Spelbord**: Admin har i dag ingen knapp för att flytta ett enskilt
  spelbord till papperskorgen; pausa det under Tillgänglighet.
- **Material**: bakgrunder och bordsgrafik flyttas till Miljöer ›
  Papperskorg och kopplas loss där de används; publicerade versioner behålls.
- **Miljöer**: borttagning ändrar utkastet; publicerade spelbord behåller
  sin version.

## Lobby och spelstart

I `/lobby` väljer spelaren bolag, spelbord och dealer och **Spela med …**.
Spelet startar på `/game?game=blackjack|roulette&operator=…&table=…`;
`/player-login` är inloggningen. Ett bolag utan publicerad tilldelning visar
inga öppna spelbord.

## Material och granskningsregler

- Text, ljud och bild i en tagning hör ihop. Ändrad text eller ändrade bytes
  ogiltigförklarar tidigare godkännande.
- Fri chatt visas aldrig med en gammal inspelad talfilm.
- Filnärvaro, hash, uppspelningskvitto eller ett godkänt klippval är inte
  godkänd läppsynk. Ljud och läppsynk bedöms av Jakob.
- Använd [tagningsmallen](templates/media-take.md) vid medieöverlämning.

## Äldre adresser och mer

Gamla bokmärken leder till rätt menyval och flik med bolag, spelbord, dealer
och fragment bevarade (`dealerId` blir `dealer`, `lane` blir `composition`):

| Äldre adress | Leder till |
| --- | --- |
| `/admin/clips`, `/admin/dealer-studio`, `/admin/events` | Dealers › Klippkarta (med vald dealer) |
| `/admin/media-review`, `/admin/replies`, `/admin/dealer-agent`, `/admin/drift?tab=speech` | Dealers › Röst och tal |
| `/admin/assets`, `/admin/compositions` | Miljöer och material |
| `/admin/rooms` | Bolag och spelbord › Alla spelbord, eller spelbordet |
| `/admin/drift` | System › Drift |
| `/admin/ai/models`, `/admin/openclaw?tab=models` | System › AI-agenter |
| `/admin/admin/accounts` | System › Scoutgamings personal |
| `/admin/players`, `/admin/ekonomi` | System › Spelarkonton |
| `/admin/admin/api` | System › Integration |
| `/admin/structure` | System › Beroenden |

`/control/*`, `/lab`, `/labb` och `/studio` leder till motsvarande sida i
Admin. `/bo`, `/v2`, `/demo` och `/casino.html` är borta. Se även
[utvecklarreferensen](../README.md), [lagrings- och
uppspelningskontrakt](../../../docs/LOCAL-PRESENTATION-RUNTIME.md) och
[läget](../../../docs/NEXT-AGENT.md).
