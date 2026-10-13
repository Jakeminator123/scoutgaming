FORMATLÅSNING 1.0 · CROUPIER STUDIO
Beslut för detta paket, 7 oktober 2026. Inte ett påstående om att dagens scoutgaming redan använder detta kontrakt.

1. GODKÄND INGÅNG
Använd Emils produktion/ eller motsvarande färdiga dealerpaket:
• MP4, H.264, 1080×1920, 9:16, konstant 24 fps, kvadratiska pixlar, utan rotationsflagga och utan ljud.
• Behåll grön bakgrund. Friläggning görs i uppspelaren. En alfavideo är inte obligatorisk.
• VILA.png och REDO.png ska ha samma 1080×1920-canvas.
• klippinfo.json ska följa med: kortpositioner, kortstorlek, klipp, bildruteantal och stillalägesruta.
• Samma kamera, perspektiv, bildutsnitt och grundposer. Ingen separat dragning av dealern som får korten att glida isär.

Råoriginal i original_h3/ (bland annat 1088×1920) är INTE denna ingång. De behöver producentens byggsteg och bevaras utan att beskäras eller retimas av Studio. Dessa byggskript fanns inte i leveransen.

2. WEBBVARIANTER
Standard mobil: 720×1280, H.264/yuv420p, CRF 20.
Valbar hög kvalitet: 1080×1920, H.264/yuv420p, CRF 18.
Valbart lätt prov: 540×960, H.264/yuv420p, CRF 23.
Alla: samma 24 fps och bildruteantal, ljudlöst, första nyckelbild och MP4 faststart. Skalningen använder Lanczos. SDR/BT.709 och limited-range taggas på utdata.

CRF är en fast startinställning, INTE en kvalitetsgaranti eller fast bitrate. Komprimeringen får ändra pixlar och filstorlek men inte klippens geometri eller timing. Förlust i källan kan inte återställas. Saknade färgtaggar innebär ett antagande som behöver kontrolleras visuellt; att lägga till taggar bevisar inte ursprungsfärgrymden.

3. MOBIL OCH DESKTOP
Mobil scen: 1080×1920 (9:16).
Desktop scen: 1920×1080 (16:9).

DEALERFILEN BLIR INTE EN LIGGANDE FIL. Samma stående 1080×1920-spelplan centreras i desktopvyn och skalas enhetligt tillsammans med kort, bord och masker. Bakgrunden kan fylla resterande yta. UI kan placeras på sidorna. Hela spelplanets skala/offset kan justeras och sparas separat per layout.

En riktig bred desktop-kameravinkel med andra utdelningspositioner kräver en ny kalibrerad uppsättning klipp och metadata. Den kan inte skapas genom att sträcka eller generellt beskära mobilvideon. Automatiskt importerade dealermedier i denna v1 är därför fortfarande 9:16.

4. BILDLAGER OCH MASKER
Bakgrund: PNG/JPEG/WebP in; WebP-utdata (quality 90). MP4/H.264 kan importeras som bakgrundsvideo; spelas mutat och loopas. Video-bakgrunder kopieras i denna version, batchkomprimeras inte.
Bord, främre bordskant, rekvisita: helst RGBA PNG/WebP med verklig transparens. Konverteras till lossless WebP. Originalproportionerna bevaras. Placeringen ligger i scenmanifestet.
Masker: gråskala, exakt 1080×1920, vit visar och svart döljer. PNG/WebP in, lossless WebP ut. Ingen automatisk AI-maskgenerering.

En helscensbild med inbakat bord är fortfarande användbar som bakgrund men ger inte ett oberoende utbytbart bord. De separata GLB-modellerna följer med som referens, inte som en färdigkalibrerad live-3D-renderare i v1.

5. LAGERORDNING
Enkel: bakgrund → bord → kort → dealer → främre bordskant → överlägg.
Split: bakgrund → dealerkropp → bord → kort → dealerhänder → främre bordskant → överlägg.

Kropp/händer återanvänder SAMMA avkodade videobild. En mask delar bilden i komplementära pass. Utan en riktig handmask används en justerbar, horisontell PROVMASK. Den känner inte igen händer och är inte automatiskt korrekt för alla rörelser.

6. KORT OCH ÖVERGÅNGAR
Bevara 79×106 px och positionerna i den bifogade klippinfo.json för just denna leverans. Nya paket kan ha egna metadata, men måste kalibreras separat.
Källans rutmarkering kopieras oförändrad. Dokumentationen anger inte entydigt 0-/1-baserat index i själva JSON-filen. Bekräfta det i menyn före godkänd export.

Spelaren visar valör först vid klippslut. Detta konservativa val undviker att rita ett nytt kort över fingrar innan en riktig ocklusionsmask är granskad. Kö, grundposer, förladdning och uppspelningskvitton finns; helt osynliga skarvar kan inte garanteras utan verkliga enhetstester. Första/sista dekodade H.264-bilden är inte automatiskt pixelidentisk med PNG efter förlustkomprimering.

7. GODKÄNNANDE
Tekniska fel blockerar konvertering/export. Ett provpaket kan exporteras utan visuell acceptans.
Granskat paket kräver matchande metadata, komplett grundbibliotek för sju platser, bekräftad rutkonvention och fyra manuella godkännanden: geometri/kontakt, kanter/övergångar, riktiga telefoner och desktop.
Paow saknar hålkort. Funktionen är då avstängd, inte ersatt med ett vitt kort eller ett annat dealerklipp.

Källor för teknikval:
FFmpeg: https://www.ffmpeg.org/ffmpeg.html
MP4 faststart: https://www.ffmpeg.org/ffmpeg-formats.html
Bildrutecallback: https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback
FFmpeg-distribution för Python: https://github.com/imageio/imageio-ffmpeg
