# S00 · vad vi har byggt och vart vi går

V5 samlar arbetet på Jakobs arbetsgren. Vi bygger vidare på det fungerande
labbet och produktens befintliga spelare. Sju dagar efter startgrinden D0 är en arbetsram med
kontrollpunkter, inte ett löfte om produktionslansering.

## Kedjan i en minut

Servern drar kort och avgör regler, tur, saldo och resultat. Därefter beskriver
presentationen vad klienten ska visa: exempelvis dela ett kort till plats 3,
spela repliken `blackjack` eller gå till vänteläge. Spelaren komponerar film,
ljud, kort och bord. Hela handen är inte en enda färdiginspelad video.

Labbet kan nu spela samma mottagna instruktioner med registrerade original,
egna varianter eller 2D. OpenClaw får välja bland tillåtna presentationer.
Det är en separat uppspelning av samma instruktioner, inte en kopia av den
ursprungliga klientens faktiska bild- och ljudtidslinje.

## Byggt lokalt idag

- **Originalförval:** standard utan egen videokoppling hittar material för exakt
  dealer, replik eller stödd destination. Egen koppling går före. Alternativ
  lånar aldrig standardens film eller inspelade tal.
- **Tal-klippen är nåbara:** Astrid har 17 tal-klipp: tre egna talnoder och
  14 val under Övrig spelreplik. Tur/resultat är spelmarkeringar; resultattalet
  hör till ett separat `speak`, så samma fras ska inte läggas på båda.
- **Händelselogg och sekvenser:** Anslut samlar session, läsande observation
  och automatisk följning. Originalbild och labbpresentation visas sida vid
  sida; manuell flikdelning är ett separat webbläsartillstånd. Native-svar och
  klientsignaler kompletterar SSE. Diagnostik samlar import/export och verktyg.
  Varje sekvenssteg öppnar befintlig editor.
- **Gemensamt presentationsbeslut:** Eventstudion och sekvensspelaren använder
  `/api/presentation/decision`; `/api/simulate` är en kompatibilitetsadress.
  Beslutet visar faktisk beslutsägare och återanvändning. Felbundna alternativ
  tas bort före urvalet.
- **Utanför labbet:** native-kommandon kan publiceras till rätt Partner-kanal
  efter transaktionscommit. Backoffice har en gemensam previewägare som städar
  föregående ljud/video. Isolerad datamapp finns för lokal produkt-QA.
- **V5-komplettering:** uppladdning/kategorisering tillåter nu även de sju
  tidigare saknade grundreplikerna, bland annat greeting, peek och bust.
  Exakt replik krävs fortfarande; inga tekniska event-ID:n byts.

## Mer än 16 filmer

Antalen nedan är inventering från 21 september före Kevins integration.
Kevins nya green-/review-material gör dem inte till en aktuell totalsumma.
Jämför alltid den valda original-/V2-vägen och exakta filreferenser.

16 är antalet eventgrupper. Fyra dealers ger 64 standardlinjer. Seedprojektet
har 256 variantposter och 64 delade 2D-rörelser, plus en social rörelse.
Detta är olika slags poster, inte en räkning av färdiga filmer.

Originalförvalskatalogen hade **84 tillgängliga poster**, varav **22 Astrid**:
17 tal, ett idle och fyra staged-grundtagningar. API-kartan listade separat
89 motorvideofiler, 78 ljudfiler och sex Astrid-staged-filer; alla 173 sökvägar
fanns lokalt. Generationsarkivets 224 historiska poster är ytterligare en
inventering med överlapp. Summera dem inte som unika eller godkända filmer.

## Beställt nästa steg

**Jakobs OpenClaw-chatt ska äga samtal och vad dealern säger.** Kevin ansvarar
för produktadaptern, validering och en gemensam talkö; Emil och Kevin ansvarar
för kompatibelt läppsynkat material. Modellen väljer exakt inspelad replik,
ny text eller tystnad inom tillåtet sammanhang. Modellen äger aldrig spelet.

Det lokala variantvalet och det sociala Astrid-provet finns. Produktens gamla
talproducenter är ännu inte ersatta av en gemensam OpenClaw-väg. Vi ska mäta
detta som en egen leverans, inte beskriva det som redan klart.

## Minsta rimliga sprintleverans

En spårbar kedja med ett inspelat talpaket, ett alternativ med trigger och
ett chattprov genom gemensam kö i isolerad runtime. Den ska visa exakta
källfakta, beslut, material och verkliga start/slut/avbrott. Alla fyra dealers
behåller den gemensamma spelarvägen. Läppsynk bedöms per take med öga och öra.

Full plats-/splitkontakt, all fri läppsynkad dialog och komplett livehistorik
ryms inte automatiskt i denna minsta leverans. Saknat underlag ska förbli en
synlig lucka. [Plan och ansvar](s06-plan.md) anger hur vi prioriterar.
