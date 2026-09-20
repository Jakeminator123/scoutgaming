> Arkiverad arbetsrapport/prompt från 20 september 2026. Uppgifter och instruktioner är daterat underlag; arkivering innebär inte att öppna frågor är lösta. Se [arkivindexet](../README.md), [systemkartan](../../systemkarta/README.md) och [findings](../../../../docs/findings/README.md) för fortsatt läsning.

# Arbetsrapport: V3, videoregister och placering

Dokumenterad 20 september 2026. Avser uppgiften **Kartlägg V3:s videohändelser**
i Croupier, på `jakeminator123/work`. Siffror och statusar nedan är daterade
observationer från granskningen, inte en automatisk uppdatering från produktion.

## Uppdrag och resultat

Jakob ville hitta de redan nedladdade videorna, granska Bettalottos register,
förstå V3:s events och triggers och få en karta för framtida videoplacering.
Uppdraget utökades med granskning av lagring/hämtning på main, överlämning
till OPENCLAW-uppgiften och publicering på vår work-branch.

Resultatet är en verifierad inventering, en interaktiv karta med lokala
videopreviewer och ett förslag till logiska kopplingar. Inga videor flyttades,
laddades ner på nytt eller godkändes visuellt genom detta arbete. Ingen
spel-, player-, kalibrerings-, databas- eller OpenClaw-runtimekod ändrades.

Den fullständiga tekniska rapporten med källreferenser finns i
[V3-videokartans README](../../../../docs/animation-events/v3-video-map/README.md).
Den här arbetsrapporten beskriver vad vi gjorde och hur arbetet kan fortsätta.

Rapportens avsnitt [Samlad översikt över register, manifest och föreslagna scheman](../../../../docs/animation-events/v3-video-map/README.md#samlad-översikt-över-register-manifest-och-föreslagna-scheman)
samlar generationsregistret, lokala `catalog.json`, `streams/index.json`,
performance-manifest/proveniens, labbkatalogen, BO:s `clipAssignments` och
förslagen `event.yaml`/`take.yaml`. Befintliga register, okända live-val och
ännu inte implementerade förslag markeras var för sig.

## Vad vi gjorde

1. Läste V3-underlaget, Partner-presentationen, labbets katalog och matchning,
   befintliga manifest och relevant Kevin-kod. Skilde befintlig implementation
   från förslaget till framtida eventträd.
2. Läste Generations-API:t med den lokala variabeln `BETTALOTTO_API` ur `.env`.
   Nyckeln skrevs inte in i rapporter eller publicerade filer.
3. Använde Jakobs sparade snippets och diagram som sökunderlag och hittade
   hela det befintliga lokala råarkivet.
4. Kontrollerade alla 224 original mot API:ts filstorlekar och fulla SHA-256.
   Jämförde även generationerna med spårade filer och textreferenser i repot.
5. Skapade nodkarta, sökbart register, placeringsanteckningar för de 17
   `want`-posterna och en lista över luckor och statuskonflikter.
6. Granskade lagringsvolymer på en hämtad GitLab-main och hur spelarna hämtar
   media. Kontrollerade live-API:ts och mediesvarens hämtning/cachebeteende.
7. Skickade den begärda överlämningen till den lokala uppgiften **OPENCLAW**.
8. Gjorde kartan portabel, kontrollerade den och pushade dokumentation,
   snapshot och verktyg till `jakeminator123/work`.

## Var videorna finns och vad platserna betyder

| Plats eller gränssnitt | Roll |
| --- | --- |
| Bettalottos `web/public/bo/gen/<generation-id>.mp4` och `bo/generations.json` | Serverns original och register. BO:s Generations-sida och generations-API:t läser samma material. |
| `C:/Users/jakem/CroupierAssets/bettalotto-generations` | Befintlig lokal kopia: 224 UUID-namngivna MP4-filer och `catalog.json`. |
| `C:/Users/jakem/Projects/croupier/web/public/dealers/astrid/performance` | Bearbetade Astrid-takes, manifest, proveniens och kringmaterial. |
| Dealernas `streams`-mappar i `web/public` | Indexerade H.264-klipp för den vanliga uppspelningen. Vera har fortfarande den äldre sökvägen `web/public/dealer`. |
| `content` och `assets/blackjack-3d/review` i repot | Råmaterial, staging och reviewmaterial som hör till bearbetningen. |

Det är alltså tre roller: serveroriginal, lokal originalkopia och bearbetat
spelmaterial. BO och generations-API:t är två åtkomstvägar till originalen.
`BETTALOTTO_API` är en åtkomstnyckel, inte ett extra videolager.

API-registret anger bland annat generation-id, hash, storlek och intake-omdöme.
Det anger inte automatiskt dealer, event, variant, godkänd take eller aktuell
användning. `/api/bo/config` innehåller i stället klippval, bland annat
`cfg.clipAssignments`. Aktuella BO-val kunde inte läsas: HTTP 401 och ingen
inloggad BO-session. Vilka klipp som faktiskt väljs i dagens drift är därför
fortfarande en öppen fråga.

## Verifierad inventering

- API-snapshot: **224 original**, **1 022 561 047 byte** totalt, hämtad
  2026-09-19 22:51:07 UTC, alltså 20 september lokal tid.
- Alla 224 lokala MP4-filer matchade både storlek och full SHA-256.
- Omdömen: **17 want, 52 no, 155 utan omdöme**. `want` betyder kandidat för
  fortsatt arbete, inte visuellt godkänd eller aktiv i spelet.
- 59 generationer matchade 60 spårade MP4-filer exakt. 67 generation-id:n
  förekom i spårad text/metadata. Mängderna överlappar och bevisar inte drift.
- Publicerade stream-index hade 89 poster; lokal/main-version hade 90 genom
  Astrids extra `action-return`. 13 ljudbanksrader saknade motsvarande exakt
  speak-indexnyckel, bland annat Mei/push.
- Astrids grundmanifest innehöll fyra takes och två continuations, alla
  med status `review`. Dessa fick inget nytt visuellt godkännande här.

En konflikt markerades särskilt: generation
`d8214fb8-fef1-4810-a29e-70230d1baa20` hade `want` i API:t men var tidigare
avvisad i handoffen för ändrad kamera/miljö. Det finns också `no`-märkta
original som ingår som historiska källor till bearbetade takes. Statusarna
behöver granskas tillsammans med beroendena innan någon fil eller koppling ändras.

## Beslut om nodträd och placering

Jakob valde Kevins befintliga performance-placering som utgångspunkt.
Förslaget använder därför referenser till befintliga filer:

```text
Blackjack
  → dealer: Astrid / Vera / Amira / Mei
    → semantisk eventnod
      → valfritt subevent: exakt talrad eller destination
        → variant: trigger, prioritet och fallback
          → take-id
            → video med ljud, frame-index, kalibrering och acceptans
```

De sex verkliga presentationstyperna är `speak`, `deal`, `reveal`, `settle`,
`turn` och `idle`. Labbets 16 semantiska noder delar upp dessa; de är inte
16 nya typer i spelmotorn. Befintligt labb har två varianter per nod och
32 enkla animationer, inte fyra färdiga videobibliotek. Det vanliga spelet
konsumerar inte redan labbets `presentation[]`-flöde.

Med tre variantplatser inklusive baslinjen blir planeringen
**4 × 16 × 3 = 192 platser**. Det dokumenterade exemplet med exakta talrader
och kortdestinationer ger 27 event/subevent-familjer per dealer, alltså
**324 platser**. Tre extra varianter utöver baslinjen skulle i grundträdet
ge 256. Antalet takes är separat: flera inspelningar kan tillhöra samma variant.

Föreslagen spårning är `generationId/sourceHash → take/mediaHash →
event/subevent/variant`. En framtida `event.yaml` kan beskriva matchning och
varianter; `take.yaml` kan bära proveniens, mediaadress, cues och acceptans.
Detta är ett dokumenterat förslag, inte införd katalogkod.

Tre statusar ska hållas isär:

- `intakeVerdict`: API:ts `want`, `no` eller utan omdöme.
- `reviewStatus`: visuell granskning knuten till exakt video-/audiohash.
- `activeBinding`: verifierad aktuell dealer-, BO- eller runtimekoppling.

Triggers får använda redan publicerad spelkontext. Servern fortsätter äga
kort, shoe, wallet och utbetalningar. `reveal` visar ett befintligt hålkort;
det är ingen extra utdelning. Pickup/release/land/rest är cues inne i takes.
`settle` bör bära tyst gest/UI medan efterföljande `speak` äger exakt replik.
Tal måste behålla rätt text, ljud, video, frame-index och kalibrering som ett paket.

## Lagring, hämtning och kapacitet

Granskad **GitLab-main** var `b14765971ca9f697a7fa14ffc0ea13570453b789`
från 18 september. Detta gäller Croupier-produkten, inte GitHub-repot
`animation-events-v1` med V3-presentationen, och bevisar inte driftsatt revision.

| Mätt mängd | Storlek |
| --- | ---: |
| Alla spårade filer på granskad main | 3,069 GB |
| `web/public` | 412,4 MB |
| Astrids performance-mapp med kringmaterial | 106,7 MB |
| 90 indexerade H.264-klipp för fyra dealers | cirka 67,8 MB |
| Fyra performance-takes och två continuations | 31,1 MB |
| Separata lokala originalarkivet | 1,023 GB |

Mängderna överlappar. De omfattar inte Git-historik eller serverns lediga disk.

`DealerEngine` hämtar index och hela efterfrågade H.264-filer till en Map
med ArrayBuffer; bytes återanvänds i minnet. Ingen uttrycklig cachebudget
eller utkastning hittades. `PerformancePlayer` förladdar hela MP4-filer i
aktiverat staged-läge, verifierar SHA-256 och spelar via blob-adresser.
API:ts original stöder byteintervall; små delhämtningar gav HTTP 206.
Mer om cacheheaders och kodreferenser finns i den tekniska rapporten.

Vår bedömning var **6/10 totalt**: spårbarhet 8, mappstruktur 5,
hämtning/återanvändning 7 och skalbarhet 4. Det är ett arkitekturomdöme,
inte en belastningsmätning. Genomsnittlig originalstorlek gav cirka
0,876 GB för 192 filer och 1,479 GB för 324, före fler takes och bearbetningar.
Serverns samtidighetsgräns, bandbredd och lediga disk är inte uppmätta.

Rekommendationen är att behålla separat råarkiv och befintliga runtimevägar,
sedan införa begränsad förladdning, minnesbudget och versionsbundna
cachebara mediefiler. Separat medielagring/CDN är ett senare steg.

## Levererade filer och hur kartan startas

Allt som behövs för den portabla kartan finns i
[`docs/animation-events/v3-video-map`](../../../../docs/animation-events/v3-video-map/README.md):

| Fil | Innehåll |
| --- | --- |
| [README.md](../../../../docs/animation-events/v3-video-map/README.md) | Full teknisk rapport, källor, begränsningar och uppföljning. |
| [map.html](../../../../docs/animation-events/v3-video-map/map.html) | Interaktiv nodkarta, register och placeringsförslag. |
| [snapshot.json](../../../../docs/animation-events/v3-video-map/snapshot.json) | Härledda data för 224 poster, noder, dealers, takes och fynd. |
| [map-template.html](../../../../docs/animation-events/v3-video-map/map-template.html) och [build.mjs](../../../../docs/animation-events/v3-video-map/build.mjs) | Mall och deterministisk ombyggnad av HTML från snapshot. |
| [serve.mjs](../../../../docs/animation-events/v3-video-map/serve.mjs) | Lokal läsande previewserver med kontroll av id, storlek, SHA-256 och byteintervall. |

Kör från `C:\Users\jakem\Projects\croupier` med Node 22 eller senare:

```powershell
node docs/animation-events/v3-video-map/serve.mjs --archive "C:\Users\jakem\CroupierAssets\bettalotto-generations"
```

Öppna [den lokala kartan](http://127.0.0.1:4196/). Om porten används,
lägg till `--port 4197` och öppna motsvarande port. Servern hämtar inget
från Bettalotto och behöver ingen API-nyckel. Utan arkiv fungerar kartan,
men ingen videopreview. Saknad fil ger 404; avvikande storlek/hash ger 409.

Vid avslutningskontrollen den 20 september 2026 stängdes vår videokartserver
på Jakobs begäran. Efteråt verifierades att varken 4196 eller 4197 lyssnade
och att ingen av våra videokartservrar körde. Startkommandot ovan är kvar
för nästa användning; kontrollen beskriver tillståndet vid avslutningen.

Efter avsiktliga ändringar i mall eller snapshot:

```powershell
node docs/animation-events/v3-video-map/build.mjs
```

Det bygger om HTML men **hämtar inget nytt API-register**. Snapshoten måste
uppdateras separat vid en ny inventering. `map.html` kan också öppnas direkt
som fil för att läsa kartan utan videopreview.

Privata ursprungsartefakter finns kvar på Jakobs dator:

- HTML och härledd JSON under
  `C:/Users/jakem/.codex/visualizations/2026/09/19/01a0bbdb-661e-74a2-beac-de30003775fb/`.
- Canvasen `croupier-v3-videokarta.canvas.tsx` under
  `C:/Users/jakem/.cursor/projects/c-Users-jakem-Projects-croupier/canvases/`.
- Råa snapshots, hashningsunderlag och ursprungliga hjälpskript under
  repots ignorerade `.croupier-inbox/v3-video-audit/`.

Git-versionen behöver inte dessa privata hjälpfiler. Inga API-nycklar,
fullständiga råprompts, originalvideor eller konversationsexporter ingår.

## Verifiering och publicering

Genomförda kontroller omfattade alla 224 filhashar/storlekar, antal och
korsreferenser, länkar, HTML-syntax, strikt TypeScript för canvasen och
frånvaro av API-nyckeln i leveransfilerna. Portabla bygget var deterministiskt
och inbäddad data matchade snapshoten. Previewservern klarade 15 HTTP-kontroller,
inklusive byteintervall och avvisning av avsiktligt felaktiga testkopior.

Webbläsarkontroller täckte dealer/subevent-val, sökning, saknad Mei/push,
lokal videouppspelning och den portabla versionens 1920×1080-preview utan
media- eller konsolfel. Detta verifierar kartan. Det ersätter inte granskning
av dealer-rörelser och läppsynk i den riktiga spelaren.

Publicerat till GitLab på **`jakeminator123/work`**, utan push till main:

- `1140d0c`: inventeringsrapport och handoff.
- `3f8524f`: portabel karta, snapshot, server och lagringsuppföljning.
- `d675bb5`: sammanfogning av publicerat arbete med lokal work-historik.

[Publicerad leverans vid d675bb5](https://gitlab.com/scout-gg/croupier/-/tree/d675bb5370367e47bf3e63f9fbdd7c2eb092b617/docs/animation-events/v3-video-map).
Denna arbetsrapport tillkommer efter den leveransen; dess revision kan följas
med Git-historiken för filen. Ingen PR, deployment eller wiki-/GitHub-publicering
gjordes av den här uppgiften.

## Överlämning och vad nästa agent behöver göra

OPENCLAW-uppgiften fick den efterfrågade överlämningen om original/kopior/
bearbetade takes, eventmodell, hashspårning och separata statusar. Dess eget
labb-, integrations- och driftarbete är separat och ska inte tillskrivas
denna inventering. Den gemensamma [handoffen](../../../../docs/JOHN-HANDOFF.md)
innehåller också daterade leveransnotiser.

Före faktisk koppling till spelaren återstår:

1. Läs aktuella BO-klippval med rätt åtkomst och fastställ driftsatt app-revision.
2. Granska kandidater visuellt: dealeridentitet, exakt replik, destination,
   miljö och kontinuitet. Lös `want`/avvisad-konflikten och källberoendena.
3. Bekräfta med Kevin om tre varianter avser tre meningsfulla beteenden eller
   flera takes i samma pool. Fastställ triggers, prioritet, fallback och katalogform.
4. Knyt exakta källor och bearbetade takes till noderna med hashbunden acceptans.
   Bevara text/ljud/video/frame-index/kalibrering tillsammans.
5. Vid implementation: följ då gällande AGENTS.md, dealer-audits och repetition
   i faktisk spelare för alla fyra dealers, inklusive två spelningar i följd.
6. Mät verklig minnes- och trafikbelastning innan serverkapacitet utlovas.

Ingen Jira CAC-fix implementerades eller markerades klar inom detta arbete.
Kartans placeringsförslag är underlag för nästa beslut, inte redan aktiva bindings.
