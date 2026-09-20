> Arkiverad arbetsrapport/prompt från 20 september 2026. Uppgifter och instruktioner är daterat underlag; arkivering innebär inte att öppna frågor är lösta. Se [arkivindexet](../README.md), [systemkartan](../../systemkarta/README.md) och [findings](../../../../docs/findings/README.md) för fortsatt läsning.

# Videoladdning: reproducerat fynd och fråga till Kevin

20 september 2026. **Status: Kevins godkännande inväntas.** Jakob har
uttryckligen villkorat lokala player-/videoändringar med hans godkännande.
Denna leverans är undersökning, dokumentation och samordning; ingen fix.

[Samlat ping till Kevin](https://gitlab.com/scout-gg/croupier/-/work_items/1#note_3870554825)
är bekräftat publicerat via projektets ping-croupier. Det innehåller Jakobs
hälsning om gårdagens dubbla bild/video och ber om separat besked för:

- **A:** samordna samtidiga laddningar av samma verifierade medieinnehåll.
- **B:** mäta och därefter prioritera första bilden före bred staged-förladdning.

OPENCLAW-uppgiften har fått pinglänken, fyndet och godkännandegränsen.
Ingen annan agent har därmed fått ett nytt medieuppdrag.

## 1. Den konkreta buggen

Den lokala koden vid `7be5844` har samma berörda filer som publicerade
`998016a`. [PerformancePlayer.source](../../../../web/public/performance-player.mjs)
kontrollerar sin Map före hämtningen, men fyller den först efter fetch,
SHA-256 och skapad Blob-URL. Två samtidiga anrop kan därför båda passera.

I [smooth60-manifestet](../../../../web/public/dealers/astrid/performance/smooth60/manifest.json)
refererar centre och dealer till `deal-centre-edge-v2.mp4` respektive
`deal-dealer-edge-v2.mp4`. Båda är 598 735 byte och verifierades mot samma hash:

```text
b66b66a244a6fa892891801a79217d25bc0a78d6c759faf940ac4061e2d8b2be
```

En isolerad minnesreproduktion använde nuvarande `source()` och `dispose()`
ordagrant, simulerade fetch/URL/window och riktiga filbytes för SHA-256.

| Resultat | Två samtidiga anrop | Två sekventiella anrop |
| --- | ---: | ---: |
| Fetch-anrop | 2 | 1 |
| Hashberäkningar | 2 | 1 |
| Skapade Blob-URL:er | 2 | 1 |
| Poster kvar i assets-Map | 1 | 1 |
| Återkallade URL:er vid dispose | 1 | 1 |
| Skapade URL:er kvar oåterkallade | 1 | 0 |

Det sist färdiga anropet skriver över den första URL:en i samma cachepost.
Städningen kan därefter inte hitta den första adressen. Detta belägger ett
samtidighetsfel och ofullständig resurshantering. Det bevisar **inte** att
två filmer visas, att Kevins dubbelbild orsakas här, hur mycket RAM som
används eller att två fulla nätöverföringar sker i en viss webbläsarsession.
598 735 byte är filstorleken för den möjliga extra överföringen.

## 2. Var filerna hämtas

I den granskade produktkoden är flödet:

```text
Repo: web/public/dealers/... eller web/public/dealer/...
    → motsvarande fil på servern vid publicering
    → HTTP-adress under webbplatsens origin
    → webbläsarens fetch / videoelement
    → komprimerade bytes och lokal uppspelning
```

[web/server.mjs](../../../../web/server.mjs) har `web/public` som statisk rot.
Vid lokal körning hämtas filerna från den lokala servern. I de kontrollerade
liveanropen hämtades exempelvis `/dealers/astrid/performance/centre-native-review.mp4`
från `bettalotto.se`. Spelaren hämtar inte dessa filer direkt från GitLab.
Filerna i en faktiskt driftsatt revision behöver inte matcha lokal HEAD.

- [DealerEngine](../../../../web/public/dealer-engine.mjs) hämtar `streams/index.json`
  och efterfrågade hela H.264-filer till ArrayBuffers för WebCodecs.
- PerformancePlayer hämtar hela MP4-filen från `take.media.src`, verifierar
  hash och skapar en lokal `blob:`-adress till videodata för uppspelning.
- Native talvideo kan använda ett vanligt videoelement med direkt filadress;
  webbläsaren bestämmer då bland annat eventuella delhämtningar.
- BO:s generationsoriginal och labbets originalpreview är ett annat lager
  än dessa bearbetade, kalibrerade spelklipp. Se [videoinventeringen](2026-09-20-v3-videoregister-och-placering.md).

**Blob-URL här är webbläsarens objektreferens, inte Vercel Blob.** Den skapas
efter att bytes redan hämtats. [MDN om createObjectURL och återkallning](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static).

## 3. Cachefrågorna är olika

| Lager | Vad det återanvänder | Påverkan på det hittade felet |
| --- | --- | --- |
| Pågående laddningslöfte i spelaren, föreslaget | Samma pågående fetch/hash/Blob-resultat | Direkt åtgärd för det reproducerade samtidighetsfelet |
| Spelarens befintliga Map | Redan färdiga bytes/Blob-URL:er under sidans livstid | Hjälper efter färdig laddning, missar samtidiga första anrop |
| Webbläsarens HTTP-cache | HTTP-svar enligt adress, headers och giltighet | Kan spara överföring; löser inte ensam dubbel hash/Blob eller olika adressers identitet |
| CDN, eventuellt senare | HTTP-filer nära besökarna | Kan avlasta ursprungsservern; ingen fix av klientens cachelogik |
| Redis, eventuellt senare | Serverdata, uppslag eller delat tillstånd | Kan inte samordna de två lokala source-anropen utan en ändrad klientlogik |

Redis kan tekniskt innehålla binära data. För denna första förbättring behövs
ingen extra servertjänst: problemet finns i webbläsarens laddningskod.
En servercache gör inte filen mindre eller tar bort klientens dubbla
hashberäkning. [Redis om små data och separat lagring av stora datamängder](https://redis.io/docs/latest/develop/get-started/faq/).

Två kontrollerade publika filer, Astrids idle-H.264 och centre-native-review-MP4,
gav GET 200 med `no-cache`/ETag, Range 206 med `no-store`, och villkorat 304 med
`no-store`. Detta är en liten protokollkontroll, ingen browserbenchmark.
`no-cache` tillåter lagring men kräver återvalidering; `no-store` har annan
betydelse. Längre cachetid kräver en säker versionsmodell eftersom dagens
mediefiler kan ersättas under samma namn. [MDN om Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control).

## 4. Första bilden och QA-paketering

I `dealer=astrid&performance=staged&motion=smooth60` startar
[app.mjs](../../../../web/public/app.mjs) 18 förladdningsposter om 9 035 338 byte
innan `engine.init()`. Anropen inväntas inte; de kan konkurrera om nät och
CPU medan första idle laddas. Förladdning av alla dessa poster är en särskild
staged-väg, inte beteendet för samtliga dealers i det vanliga spelet.

Att ge första idle med rätt matte förtur och därefter köa bakgrundsmaterial
är ett avgränsat förslag. Första efterföljande handling behöver fortfarande
sin kompletta kedja av klipp, joins och ready. Att bara ta bort preload kan
flytta väntan till första kortet. Waterfall och faktisk första visade bild
ska mätas före och efter; ingen sekundvinst är ännu belagd.

QA-separering hjälper **bara strukturen** om alla filer ändå följer med
samma leverans. Om ett uttryckligt produktpaket utelämnar käll-/QA-filer
kan serveröverföring, packning och distributionsutrymme minska. Tidigare
analys identifierade 121,8 MB kandidater, cirka 30 % av public, före
beroendekontroll. Filer som spelaren aldrig hämtar kostar inte nedladdning
hos spelaren. Omorganisationen ger därför ingen automatisk start- eller FPS-vinst.

## 5. Konkret plan efter Kevins besked

För A föreslås en separat Map över pågående laddningslöften per SHA-256.
Konsumenter delar resultatet; misslyckanden ska tillåta nya försök. En
avbruten konsument får inte avbryta en annan giltig konsument, och dispose
måste stoppa eller kasta sena resultat så att inga Blob-URL:er lämnas kvar.

För B mäts kall och varm start, första målade idle, första replik och första
landade kort före ändring. Därefter prövas prioritet och begränsad samtidighet
utan att ändra vilket godkänt material situationen kräver.

Verifiera samtidiga/sekventiella anrop, fetch-/hashfel och retry, avbruten
konsument samt dispose under och efter laddning. Efter en playerändring
gäller `.githooks/pre-commit`, `node pipeline/audit-dealer-sync.mjs --probe`
och verklig rehearsal för alla fyra dealers med två påföljande spelningar.
Ingen sådan ändring eller produkt-QA har utförts i denna undersökning.

Vercel-publicering, Vercel Blob, Redis, CDN, omkodning, nya takes och
cacheheaderändringar ingår inte i det första förslaget. Inget beslut från
Kevin ska antas utifrån ett skickat ping eller ett allmänt samordningssvar.
