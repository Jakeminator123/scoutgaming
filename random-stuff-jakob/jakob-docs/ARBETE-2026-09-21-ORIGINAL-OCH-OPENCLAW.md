# Originalklipp, observation och OpenClaw — 21 september 2026

Arbetsgren: `jakeminator123/work`. Detta dokument samlar leveransen i
`d382b46` och fortsättningen med gemensamma presentationsbeslut och exakta
talexempel. Texten nedan dokumenterar det då lokala kodarbetet. Den efterföljande V5-leveransen
samlar dokumentation, kontraktskomplettering och publicering; se
[V5](../../docs/animation-events/v5-7-days-mvp/README.md). Produktdeploy ingår inte.

## Så fungerar kedjan

Spelservern bestämmer kort, tur, giltiga handlingar och resultat. RNG och
betalningar ligger där. Presentationskedjan beskriver sedan vad klienten
ska visa: `speak`, `deal`, `reveal`, `turn`, `settle`, `idle`.
Klienten väljer och spelar inspelat material, ritar korten från speldata och
komponerar delvis maskade videor ovanpå bordet. Detta är inte en enda
färdiginspelad film av hela blackjackrundan.

I labbet kan samma publicerade instruktioner spelas med originalförval,
egna varianter eller 2D. OpenClaw får välja en tillåten presentationsvariant.
Det får inte ändra korten, spela åt användaren eller bestämma vinsten.

## 16 grupper är inte 16 videoklipp

- 16 eventgrupper × 4 dealers ger 64 standardlinjer.
- Seedprojektet har 256 variantposter. Dessa är inte 256 inspelade videor.
- Den lokala originalkatalogen har 84 tillgängliga poster, varav 22 för Astrid.
- Astrids 22 är 17 tal-klipp, ett idle och fyra staged-grundtagningar.
- Astrids 17 tal-klipp nås nu som tre egna talnoder och 14 val i
  **Övrig spelreplik → Tal-klipp att prova**. Här finns bland annat greeting,
  blackjack, bust, dealerbust, win, lose, push, placebets och peek.
- Generationsregistret med 224 historiska poster är en annan inventering.
  Det innehåller versioner/alternativ och ska inte adderas som unika filmer
  till originalkatalogen.

`turn` har ingen egen inspelad turfilm i den kontrollerade originalkartan.
`settle` publicerar resultatet; en separat `speak` anger resultatrepliken.
Att lägga samma resultattal på båda skulle orsaka dubbelt tal.
`reveal` är en kortvändning i klienten, utan en egen originalfilm.
Labbet visar detta vid respektive nod och länkar till tal-klippen.
2D-rörelserna kan fortfarande användas och ersättas med framtida egna tagningar.

## Vad API:t och det sparade underlaget faktiskt innehåller

`BETTALOTTO_API` är lästoken till generations-API:t. Det är en annan
anslutning än Partner-nyckeln som öppnar spelet och observerar rundor.
`GET https://bettalotto.se/api/v1/generations/mapping` svarade 200 den
21 september, kontrollerat omkring 01:39 UTC. Kartan listar:

- 89 motorvideofiler: Vera 39, Astrid 19, Amira 16, Mei 15.
- 78 tillhörande ljudfiler.
- Sex staged-filer för Astrid: fyra grundtagningar och två fortsättningar.

Samtliga 173 refererade video-/ljudfiler finns redan under `web/public`.
Ingen ny hämtning eller ersättning av mediefiler behövdes. Kontrollen avser
filnärvaro, inte att samtliga bytes jämförts med live. API:t gav `revision: null`.
Motorregistret innehåller också avvisat/alternativt material som avsiktligt
inte blir standard i labbet. Tillgänglighet är inte visuell acceptans.
Två äldre Vera-tal (`rules_decks`, `fair_rng`) och äldre actions har inte
automatiskt återinförts. Staged-fortsättningarna är inte självständiga
standardtagningar.

Den användartillförda `croupier-observation-2026-09-21T00-07-56-650Z.json`
har **två statusposter och noll rundposter**. Den kan inte återskapa den
spelade rundan. `astrid_motorklipp.txt` är materialinformation, inte
uppspelningskvitton. `table.txt` är ett partiellt kopierat tabellsvar, inte en
komplett ordnad presentationslogg. Dessa privata underlag lämnas utanför Git.

Nästa riktiga observation behöver innehålla `round` med `events[]` från rätt
Partner-nyckel/spelare. En sådan instruktion anger exempelvis exakt `line`
eller kort/destination; katalogen ger motsvarande material. Originalklientens
faktiska klippstart, klippslut och kortlandning saknas fortfarande i exporten.
Labbet fyller inte ut dessa luckor med påhittad historik.

## Det som byggts

**Original och uppspelning:** standard utan egen videokoppling använder
registrerat original med exakt dealer/replik/destination. Egen koppling går
före. Alternativ lånar aldrig standardens tal. Native MP4, indexed H.264 med
matchande ljud och packed staged-video använder produktens befintliga
spelarmoduler. Inga mediebytes eller kalibreringar har ändrats. Staged gäller
kanoniska destinationer 0/3/6 och dealer; full kontakt för alla platser/split
är ännu inte fastställd. Astrids visuella identitet har inte godkänts av Jakob.

**Observation:** Händelseloggen har en gemensam yta för vald originalfliks
bildström och labbets presentation. Tabbdelen använder ingen inspelning,
uppladdning eller fångat ljud. Import och Partner-instruktioner blir en ordnad
sekvens med länkar till eventeditorn. Korten och exakt replik bevaras.
HTTP/SSE-dubbletter förenas; konflikter/luckor stoppar följningen. Loggen
finns i flikens minne, så export behövs före omladdning.

**OpenClaw, första fungerande mellanledet:** båda labbytorna använder nu
`POST /api/presentation/decision`. `/api/simulate` är en kompatibilitetsadress
till samma tjänst. Besluten har eget ID och separat källreferens. Samma ID och
samma innehåll delar ett pågående eller sparat beslut; ändrat innehåll ger
409. Cachen är processlokal, högst 128 jobb i fem minuter, högst fyra samtidiga
beslut. Nya manuella prov får nya ID:n. Det är inte distribuerad deduplicering
eller en garanti om en enda faktisk uppspelning i flera webbläsarflikar.

Explicit bundna alternativ med saknad fil eller fel replik/destination tas
bort före modellvalet. Standardens markerade 2D-reserv finns kvar. Modellens
variant-ID måste fortfarande passera projektversion, begärans-ID och
tillåtna kandidater. Loggen visar om valet ägs av OpenClaw, regler, slump
eller standard. Ett beslut är inte ett uppspelningskvitto.

Ett verkligt anrop genom labbserverns konfigurerade OpenClaw-anslutning
svarade `responded/accepted` och valde `astrid.speak.other.standard` för ett
isolerat greeting-exempel. Automatiska tester använder annars stubbar.
Detta övertar inte ännu produktens alla chatt-/talproducenter. Den separata
[prompten för gemensamt talägarskap](PROMPT-OPENCLAW-SOM-TALAGARE.md)
beskriver nästa integration.

**Utanför labbet:** native `/api/table` publicerar nu godkända kommandon
efter commit till den verifierade Partner-launch-sessionens kanal. Retry,
state-read, nekade kommandon och rollback publiceras inte på nytt. BO har
en gemensam previewägare som stoppar föregående ljud/video, och kan ange
den läsande `events`-behörigheten. `CROUPIER_DATA_DIR` ger isolerad lokal QA.
Kevins historiska tvåströmsfel är inte reproducerat; en konkret lokal
previewkonflikt är reparerad. Detaljer finns i
[Astrids källkarta](systemkarta/03-dealers-video-takes/ASTRID-KALLKARTA-OCH-DUBBELSTROM-2026-09-21.md).

## Var går det att prova?

1. **Eventstudion:** välj Astrid, Övrig spelreplik, sedan ett exakt tal-klipp.
   Spela vald variant provar materialet. Testa event använder valt urvalsläge,
   däribland OpenClaw. Mottagna steg behåller sin replik och kan inte ändras
   till ett annat talexempel.
2. **Händelselogg:** importera en observation med riktiga rundposter eller
   anslut Partner och följ nya instruktioner. Välj Labbets presentation för
   sekvensuppspelning och OpenClaw som variantval när det ska användas.
3. **Backoffice:** prova mediapreview och den enskilda previewägaren.
   BO innehåller ännu inte labbets varianteditor eller mellanled för runtime.
   Allt kan alltså inte testas i BO.

Den vanliga lokala spelaren använder grenens produktförbättringar men inte
automatiskt labbets varianter. Live är den kod och de assets som faktiskt är
driftsatta. Att Git har en `main`-gren visar inte vilken revision live kör;
API-kartan redovisade inget commit-ID. Vid denna implementation var ändringarna ännu inte pushade. Efterföljande V5-
publicering ändrar inte vad som är driftsatt i spelprodukten.

## Verifiering och kvarvarande luckor

Den föregående leveransen körde 286 labbtester och en importerad isolerad
native-sekvens med 12 steg till avslut, utan konsolfel. Den innehöll också
repetition med alla fyra dealers. Aktuell verifiering dokumenteras i
den senaste posten i [JOHN-HANDOFF](../../docs/JOHN-HANDOFF.md).
Private QA-loggar ligger under ignorerade `lab/data/qa-director-20260921`.

Kvar: verkliga live-rundposter, originalets playback-telemetri, samlad
kortscen över hela handen, full plats-/splitkalibrering, visuell/talsynk-
acceptans och gemensamt OpenClaw-talägarskap i produktens runtime.
