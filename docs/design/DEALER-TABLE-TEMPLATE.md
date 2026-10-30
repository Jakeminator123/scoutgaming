# Återanvändbar dealerbordsmall

`olive-blackjack-v1` och `navy-blackjack-v1` är separata fotografiska bordstillgångar för showroom och fortsatt kalibrering. De registrerar inget i Neon, ändrar inget fryst spelpaket och väljer ingen dealer. Rummet kan bytas utan att bordet genereras om, och ett annat bord får egen bild, proportion och egna ankare.

## Leverans och inmätta bilddata

Filerna finns i `apps/studio/components/dealer-table-assets/`.

| Fil | Format | Pixelmått | Byte |
| --- | --- | --- | --- |
| `olive-blackjack-v1.png` | PNG med riktig alpha, genererat original | 2048 × 768 | 2237524 |
| `olive-blackjack-v1.webp` | WebP kvalitet 88, alpha-kvalitet 100 | 2048 × 768 | 229550 |
| `olive-blackjack-v1.json` | Portabel deskriptor, `schemaVersion: 1` | Samma bildplan | — |

JSON innehåller varje fils SHA-256, MIME, byteantal, bildmått, variant, namn, färgavsikt, placering och ankare. Filnamn är relativa till deskriptorn. JSON är designunderlag; den är inget alternativt produktregister eller accepterat publiceringskvitto.

- `alphaBounds`: x=19, y=33, bredd=2011, höjd=642 vid alpha ≥ 1.
- `visibleBounds`: x=24, y=126, bredd=2001, höjd=545 vid alpha ≥ 128.
- Gränserna använder inkluderande vänster/överkant och exkluderande höger/underkant. De beskriver en bounding box, inte en kollisionsmask.
- Svaga alfapixlar finns ovanför den synliga konturen. Alfakanalen från imagegen bevaras exakt; dess högsta värde är 254. Ingen grönnyckling, beskärning eller efterritad mask används. RGB bakom helt transparenta pixlar saknar visuell betydelse.
- WebP-filen använder förlustkomprimerad färg och exakt samma alfakanal som PNG-originalet; `quality: 88`, `alphaQuality: 100`, `effort: 6`. Den är cirka 90 procent mindre än PNG-originalet.

## Koordinater och lagerordning

```text
bakgrund → dealer → bord → kort och UI
```

Desktopplanet är 1920 × 1080; mobilplanet är 1080 × 1920. Dealerplanet är fortsatt produktens 1080 × 1920. Tabellen påverkar inte dealerplanets skala.

`tablePlacement.width` är andelen scenbredd, `x` förskjutningen från centrerad placering som andel scenbredd och `y` bildens överkant som andel scenhöjd. Hela bildens transparenta utfyllnad räknas med:

```text
W = placement.width × scenbredd
H = W × bildhöjd / bildbredd
X = (scenbredd − W) / 2 + placement.x × scenbredd
Y = placement.y × scenhöjd
ankare på scenen = (X + ankare.x × W, Y + ankare.y × H)
```

Pivot är övre mittpunkten `(0.5, 0)` i hela bilden; vänster/överkant är `(0, 0)`. Ingen rotation eller verklig perspektivkamera ingår i koordinatkontraktet. Renderern använder befintliga `packages/presentation/compositor/geometry.js:tableRect`.

| Profil | width | x | y | Synligt innehåll |
| --- | --- | --- | --- | --- |
| Desktop | 0.8597301349325337 | −0.00020989505247377417 | 0.47596701649175405 | x 8–92 %, y 57–97.7 % |
| Mobil | 1.18 | 0 | 0.61 | Centralt utsnitt; y cirka 65.1–82.8 % |

Mobilprofilen beskär avsiktligt ytterkanterna i scenens viewport och behåller tre centrala platser. Bilden får samma proportion, ingen separat sträckning. Slutligt montage kan överstyra `placement`. Bakgrund, dealer, bord och ankare ska ha samma yttre kameratransform.

`anchors.dealer`, `seats[].card` och `seats[].bet` ligger i bildens hela normaliserade 0–1-rektangel. `cardWidth` är andelen av bordbildens bredd och följer produktens tillåtna intervall. Desktop har sju platser, mobil tre. Alla punkter ligger inom bordets alfa-innehåll. De är **okalibrerade designförslag**: verkliga dealerhänder, landning, kortstorlek, insatser och överlapp måste kalibreras per design och dealer innan publicering. Punktcentra ensamma bevisar inte att hela kort eller händer ryms.

## Återanvändbar renderer

```tsx
import { DealerTableArtwork, DealerTableTemplate, oliveBlackjackTemplate,
  getDealerTableGeometry } from './dealer-table-template';

// I showroomets befintliga SVG, efter dealerlagret:
<DealerTableArtwork layout="desktop" showAnchors={false} />

// Alternativt i en position:relative-container med samma scenproportion:
<DealerTableTemplate layout="mobile" />

// Helt annat bord: deskriptor och bild byts tillsammans.
<DealerTableArtwork template={{ definition: anotherDefinition, assetUrl: anotherUrl }} />

const geometry = getDealerTableGeometry(oliveBlackjackTemplate.definition, 'desktop');
```

`DealerTableArtwork` returnerar en `<g>` i scenkoordinater. `DealerTableTemplate` är ett absolut SVG-lager med `contain`-passning. Båda är dekorativa, utan egna klickytor eller Adminflöden. `showAnchors` visar guld för dealer, vita kors för kort och gröna cirklar för insats; guiden måste benämna dem okalibrerade. `getDealerTableGeometry` ger scenmått, bildrektangel, alfa-/synlig rektangel och projicerade ankare för rummets egna överlägg.

## Bildperspektiv och fortsatt publicering

Bilden avser en låg, symmetrisk spelarvy med mörk olivfilt, mjukt slitet brunt läder, diskret mässing och valnöt. Det finns ingen bakgrund, människa, logotyp, marker eller utdelade kort i det synliga bordet. Dealerplatsen är mitt bakom bordets bakre kant. Ljuset är varmt från vänster och svalare från höger.

Promptens cirka 18 graders nedåtblick är en **uppskattad designavsikt**, inte uppmätt kameravinkel. Ingen bordbredd i meter, lins, kamerahöjd eller fysisk standard är fastställd. Bildperspektiv och höjd måste bedömas tillsammans med den valda verkliga dealern; de kan inte räknas fram från alfa-gränserna.

Framtida publicering använder befintliga `layerAssets`: registrera en bild som `role: table`, `game: blackjack`, med nytt UUID, exakt hash, byteantal, MIME och pixelmått enligt `layer-asset-contract.mjs`. Koppla UUID till kompositionens bordsval och per-design `blackjackTables`, spara med rätt revision och publicera via befintligt flöde. Deskriptorns namn är ingen produktidentitet. Bytebyte eller omkalibrering skapar nytt underlag; frysta paket skrivs inte om.

## Generering och verifiering

Bildverktyg: inbyggd `image_gen`, `transparent_background: true`. Inget externt modell-API, ingen molnpublicering. Den första bildens material/perspektiv behölls i en riktad friläggningsiteration. Slutlig redigeringsprompt:

> Edit this table image ONLY to make a production-ready clean alpha cutout. Preserve exact table design, empty olive green felt, worn dark leather rail, thin brass trim, walnut apron, wide front view and original photographic detail and lighting. Remove ALL surrounding dark background, warm/cool fog, glow, feathered haze, shadow and gradients outside the table silhouette. Outside the tabletop and apron must be alpha=0 fully transparent right up to a clean antialiased object edge. Inside the table must be fully opaque (alpha=255), with fine material textures unchanged. Keep complete left and right ends visible with 24px clear transparent padding. No added elements, no words, no logos, no cards, no chips, no people, no legs, no background. Maintain very wide 2048x768 canvas/aspect if possible. Do not draw a checkerboard into the pixels.

Prompten är önskemål; tabellen ovan beskriver de uppmätta pixlarna. Riktade prov finns i `apps/studio/components/dealer-table-template.test.mjs`: produktens koordinatformel på båda scenplan, synlig utbredning, utbytbar bildproportion, ogiltiga ankare/placeringar samt faktisk avkodning, SHA, alfagränser och identisk PNG/WebP-alpha. Kalibrering med verklig dealer och produktacceptans återstår.

## Marinblå variant: `navy-blackjack-v1`

Varianten använder samma renderer genom `template: { definition, assetUrl }`: läs `dealer-table-assets/navy-blackjack-v1.json`, validera med `validateDealerTableDefinition` och använd URL från `navy-blackjack-v1.webp`. Ingen gemensam komponent eller produktidentitet ändras. Materialavsikten är marinblå filt, mörkt läder, champagnefärgad metall och mörk ek. Oliv-PNG:n var geometrireferens för inbyggd `image_gen`; en andra riktad iteration frilade bordet. Ingen extern API-generering eller molnpublicering ingår.

| Fil | Mått | Byte | Användning |
| --- | --- | --- | --- |
| `navy-blackjack-v1.png` | 2046 × 768 | 1932854 | Genererat original, bevarad alpha och SHA-256 i JSON |
| `navy-blackjack-v1.webp` | 2046 × 768 | 211214 | Runtime, kvalitet 88 / alpha 100 / effort 6; cirka 89 % mindre |

- Faktisk `alphaBounds`: x=0, y=17, bredd=2029, höjd=751 vid alpha ≥ 1. Faktisk `visibleBounds`: x=24, y=109, bredd=2000, höjd=565 vid alpha ≥ 128. Svaga alfaspår finns utanför den synliga konturen; bounding box är ingen mask. 631319 av 1571328 pixlar är helt transparenta, 912367 har alpha ≥ 250, högsta alpha är 255. WebP bevarar exakt samma alpha som PNG; ingen efterritad mask eller beskärning används.
- Verktygets slutbild är två pixlar smalare än olivreferensen. Deskriptorn anger de verkliga måtten; renderern behåller proportionen. Synlig kontur och material bedömdes i bilden, inga fysiska mått eller kameravinklar har mätts.
- Placering och föreslagna ankare följer olivprofilen ovan: desktop `width=0.8597301349325337`, `x=-0.00020989505247377417`, `y=0.47596701649175405`; mobil `width=1.18`, `x=0`, `y=0.61`. Synligt desktopinnehåll ligger cirka x 8.00–92.04 %, y 55.74–97.95 %. Mobilen beskär sidorna och visar y 64.54–82.87 %.
- Bildplanet använder pivot `(0.5, 0)`, dealerankare `(0.5, 0.3)`, sju desktopplatser och tre mobilplatser. Kortbredden är 0.04 respektive 0.06 av bordbildens bredd. Alla föreslagna ankarcentra ligger på alpha ≥ 250. **Kalibrering är ett förslag**; händer, hela kortytor, insatsytor och riktig dealer måste fortfarande bedömas tillsammans.
- `dealer-table-navy.test.mjs` verifierar filernas faktiska format, byteantal, SHA-256, dimensioner, alfagränser, identisk PNG/WebP-alpha, ankarcentra och projicering på båda scenplan. Prov ersätter inte dealer-/produktacceptans.

Slutlig friläggningsprompt, inbyggd `image_gen` med `transparent_background: true`:

> Use case: background-extraction. Edit this exact navy table image ONLY to make a production-ready clean alpha cutout. Preserve exact table silhouette, navy-blue empty felt, charcoal leather rail, champagne metal trim, smoked-oak apron, perspective, dimensions and pixel placement on the 2048x768 canvas. Remove ALL surrounding dark background, warm/cool fog, glow, feathered haze, shadow, speckles and gradients outside the table silhouette. Outside the tabletop and apron must be alpha=0 fully transparent right up to a clean antialiased object edge. The top 100px and the bottom 90px of the canvas must be entirely transparent. Inside the table must be opaque with fine material textures unchanged. Keep complete left and right ends visible with clear transparent padding. No added elements, no words, no logos, no cards, no chips, no people, no legs, no room. Do not zoom, shift, crop, scale or change the table. Preserve the entire 2048x768 canvas. Do not draw a checkerboard into pixels.

Prompten beskriver avsikten; mätningarna ovan redovisar resultatet och dess avvikelser.
