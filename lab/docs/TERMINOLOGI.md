# Scoutgaming: produktmodell och ord

Det här är den gemensamma källan för vad **bolag, spel, rum, bakgrund,
dealer, bord och sammansättning** betyder i nya gränssnitt och dokument.
Tekniska fält och nuvarande begränsningar beskrivs i
[runtime-referensen](../../docs/LOCAL-PRESENTATION-RUNTIME.md); användarsteg
finns i [guiden](README.md). Målmodellen nedan är inte ett påstående om att
alla äldre rum och paket redan har migrerats.

## Ägarskap och spelarens val

```text
Scoutgaming → bolag/operatör → spel → rum/bakgrund
                                    ├─ tillåtna dealers
                                    └─ tillåtna bord
Spelarens scen: vald bakgrund → vald dealer → valt bord → spelkontroller
```

- **Bolag** och **operatör** är samma organisation. Scoutgaming driver
  tjänsten; bolaget äger sitt publicerade spelutbud och sina rumsbindningar.
- Ett **spel** är exempelvis Blackjack eller Roulette hos ett bolag. Det
  erbjuder valbara rum/bakgrunder, dealers och bord som uttryckligen är
  kompatibla med spelet och tillåtna i bolagets publicering.
- Ett **rum** är spelarens bakgrundsval i ett spel, inte ytterligare ett
  bildlager. Ett sparat rum har eget ID och ägs av ett bolag. Det pekar på en
  versionerad bakgrundsfil; samma fil får användas i andra spel eller hos andra
  bolag utan att rummen eller behörigheterna blir samma sak. Bild och video
  av samma miljö kan höra till samma rumsval.
- En **dealer** är en registrerad person med egna klipp och uppsättningar.
  Dealern kan väljas till flera kompatibla rum. En ny kombination av dealer
  och bakgrund skapar aldrig en ny dealeridentitet.
- Ett **bord** är det separata visuella förgrundslagret med spelets geometri,
  inte ett rum. Bordet kan återanvändas där spelet och geometrin tillåter det.
- Spelaren får välja en tillåten dealer och ett tillåtet bord till rummets
  bakgrund. Varje öppet rum måste ha ett giltigt förval för båda så att scenen
  också fungerar utan ett aktivt spelarval. Valet skapar inget nytt
  biblioteksobjekt eller nytt permanent rum.
- En **sammansättning** sparar lagerplacering, kompatibilitet och tillåtna
  val för uppspelningen. Den är en teknisk konfiguration, inte ett andra rum,
  en dealer eller en bakgrund. Visa den bara när dess inställningar behövs.

**Normal scen:** bakgrund bakom en frilagd dealer; bord framför kroppen;
kort, marker och spelkontroller över scenen. Rörliga händer som ska ligga
framför bordet behöver en särskild godkänd mask eller kontaktpose.
**Äldre fullbildsundantag:** Astrid och eventuellt andra tidiga klipp kan ha
bakgrund och bord inbakade. Märk dem som fullbildsmaterial och ge dem inte
separata lagerval förrän frilagda original och placering har godkänts. En
etikett eller grönnyckling kan inte ta bort ett inbakat bord.

## Format och livscykel

Biblioteket tar emot PNG, JPEG, WebP, MP4 och WebM för bakgrunds- och
bordstillgångar (högst 128 MiB; registrerad bredd/höjd 1–16384 px). Det är
filvalidering, inte visuell acceptans. En stillbild och en video för samma
bakgrund ska provas med samma utsnitt; bakgrundsvideo ska loopas utan ljud.
Ett bord som ska visa dealern bakom sig behöver frilagd PNG eller en granskad
videomask. Dealerklipp är gröna original eller verifierad alfa (PNG eller
VP9-WebM med alfaspår); opak MP4 kan inte ge en frilagd silhuett. Se
[formatkrav och provning](../../docs/LOCAL-PRESENTATION-RUNTIME.md#format-tillåten-fil-är-inte-samma-sak-som-godkänd-scen).

Papperskorgen ska finnas för bolag, rum, dealers, klipp, bakgrunder och bord.
Visa påverkan och lossa aktiva kopplingar innan arkivering. Ett återställt
bolag öppnar inte sina rum; återställda filer är otilldelade val. Bevara
publiceringshistorik och källfiler. Permanent radering kräver en separat
beroendekontroll. Att dölja en post i listan är inte att ta bort dess aktiva
struktur. Befintliga tekniska ID:n och frysta paket behålls under övergången.

## Ytor och tekniska ord

`/admin` är intern administration, `/partner` bolagets portal och `/lobby`
spelarens lobby. `/control`, `/play` och `/game` fungerar under övergången;
nya menyer och instruktioner använder de nya namnen. `/studio` är endast
labbtjänstens tekniska basePath.

`lane`, `gameLaneId`, `presentationLaneId`, `table` i en äldre URL och
`mobile-phone` är befintliga lagrings- eller länknamn. De betyder inte
spelarplats, bordsgrafik eller ny produktresurs. Nya användartexter säger
**sammansättning**, **spelkonfiguration**, **rum/bakgrund** eller
**spelarplats**, beroende på vad kontrollen faktiskt ändrar. Ändra aldrig
ett lagrat ID bara för att byta visningsnamn.

Klippens användarord är **grundloop**, **händelsekategori**,
**klippuppsättning**, **villkor** och **urvalsregler**. Exakta event-ID:n,
klippfack, talset och provspelningskrav finns i
[guiden](README.md) och [runtime-referensen](../../docs/LOCAL-PRESENTATION-RUNTIME.md).
