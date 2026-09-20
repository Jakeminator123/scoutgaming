# Dealers, video och takes

[Till systemkartan](../README.md) · [Nästa: JSON och lagring](../04-studio-json-och-lagring/README.md)

Registret behöver visa **vilka situationer materialet täcker**. Det räcker
inte att räkna eventnamn eller hur många variantplatser editorn visar.
En take är en konkret inspelning med media, kalibrering och granskningsunderlag.

| Dealer | Befintlig mediarot | Lokala stream-indexposter |
| --- | --- | ---: |
| Astrid | [dealers/astrid](../../../../web/public/dealers/astrid/) | 20 |
| Vera | [dealer](../../../../web/public/dealer/) | 39 |
| Amira | [dealers/amira](../../../../web/public/dealers/amira/) | 16 |
| Mei | [dealers/mei](../../../../web/public/dealers/mei/) | 15 |

**Kod-/datakontrollerat:** totalt 90 indexposter. De är inte alla original
eller ett mått på kompletta, godkända situationer. Astrids grundmanifest
har fyra takes och två continuations, alla `review` vid denna läsning.

| Lager | Källan att öppna | Vad en post betyder |
| --- | --- | --- |
| Genererat original | [V3-snapshot](../../../../docs/animation-events/v3-video-map/snapshot.json) | 224 daterat inventerade original; intake-omdöme och hash |
| Befintliga spelklipp | Dealernas `streams/index.json` | Indexerad H.264-media och bildruteinformation |
| Kontakt-/performance-take | [Astrids manifest](../../../../web/public/dealers/astrid/performance/manifest.json) | Rörelse, mediehash, kontakt/landning och status |
| Ursprungsrelation | [Astrids proveniens](../../../../web/public/dealers/astrid/performance/provenance.json) | Vilka original/bearbetningar en take bygger på |
| Exakt talpaket | [speech-media.json](../../../../web/public/speech-media.json) och dealerljudbanker | Replik, ljud/video och synkreferenser |
| Uppspelning | [DealerEngine](../../../../web/public/dealer-engine.mjs), [PerformancePlayer](../../../../web/public/performance-player.mjs) | Produktens befintliga vägar för att visa materialet |

**Förslag:** en vy kan visa `Blackjack → Astrid → Kortutdelning → Box 3 →
andra kortet → standardfamilj → take A/B`. Samma take kan synas under flera
grenar om täckningen är uttryckligen granskad. Det kräver inte flera filkopior.
Hand, kortposition och sekvens kan också vara filter i stället för mappar.

Olika destinationer kan kräva olika filmade rörelser. Första/andra kortet
kan ibland dela take tillsammans med fungerande digital kortplacering och
kalibrering. Återanvändningen måste visas i verklig uppspelning. Sju boxar
är inte sju garanterat godkända rörelser, och vänster/mitten/höger är inte
ett bevis på täckning av alla boxar/splithänder.

Det förklarande räkneexemplet **7 mål × 2 kortpositioner × 3 uttryck ×
4 dealers = 168** gäller om varje kombination får en unik film. Det är
varken ett produktionskrav eller inventeringsresultat. Se den utförliga
[situationsmodellen](../../2026-09-20-situationer-variantfamiljer-och-takes.md).

Tre statusdimensioner behöver hållas isär: originalets intake (`want/no`),
takens visuella review och faktisk aktivering/bindning. En ny mediehash
ogiltigförklarar tidigare visuell acceptans. Tal hålls ihop som exakt text,
ljud, video, frame-index, kalibrering och acceptansanteckning.
Ett känt `videoGenerationId` i labbet ger endast originalpreview. En
standardbindning gör inte en inkompatibel eller ogranskad film godkänd.

Fortsätt med [videoinventeringen](../../../../docs/animation-events/v3-video-map/README.md)
och [dagens arbetsrapport](../../arkiv/2026-09-20/2026-09-20-v3-videoregister-och-placering.md).
De beskriver även kvarstående statuskonflikter, 13 saknade bank→speak-index-
matchningar och okända aktuella BO-bindningar. Detta arbete granskar inte
videorna visuellt och ger inget nytt takegodkännande.

## Laddning och öppna fynd

De granskade spelklippen serveras från produktens `web/public` via HTTP;
PerformancePlayer skapar sedan lokala Blob-URL:er efter hämtning och
hashkontroll. Det är inte Vercel Blob. Samtidiga laddningar med samma hash
har ett isolerat reproducerat race som ger två skapade URL:er men en
cachepost. Det belägger inte orsaken till visuell dubbelbild.

[Findings-registret](../../../../docs/findings/REGISTER.md) samlar F-001
(samtidighet/städning), F-002 (staged-förladdning), F-003 (HTTP-cache),
F-004 (QA-paketering), F-006 (exakt taltäckning) och F-007 (aktuella
videobindningar). F-001/F-002 inväntar Kevins uttryckliga besked enligt
[pinget](https://gitlab.com/scout-gg/croupier/-/work_items/1#note_3870554825).
Den [daterade undersökningen](../../arkiv/2026-09-20/2026-09-20-videoladdning-och-kevin-ping.md)
bevarar reproduktion och föreslagen kontrollplan. Inga player- eller
medieändringar följer av att fynden har fått registerposter.
