# Formatguide · lokalt authoringkontrakt 1.0

Detta är en rekommenderad produktionsprofil för nya medier, inte ett påstående att alla befintliga mediafamiljer eller den publicerade produkten redan använder den. Kända koordinater, ny design och okända värden hålls isär i JSON.

## 1. Tre olika saker
**Koordinatplanet** är 1080×1920, emil-mobile-v3. Det beskriver var dealer, handkontakt och kortmål ligger.
**Arbetsmastern** är den sparade bilden som allt annat härleds från. VILA/REDO: 1080×1920. Bredt bord och bakgrund: 3414×1920.
**Visnings-/transportformatet** är vad en viss skärm eller API använder, exempelvis 1920×1080, 720×1280 eller 1152×2048. Det byter inte koordinatplan.

## 2. Bord — rekommenderad förstahandsprofil
| Egenskap | Rekommendation |
|---|---|
| Bred arbetsmaster | 3414×1920, PNG RGBA, 8 bit per kanal |
| Färg | sRGB; konvertera profil, inte bara etikett |
| Transparens | Verklig alpha. Straight/unassociated alpha i filen; transparent runt bordet |
| Mobilbild | Exakt crop: x=1167, y=0, bredd=1080, höjd=1920 |
| Webb | Lossless WebP med alpha; PNG som robust reserv |
| Canvas | Behåll hela canvasen, ingen automatisk trimning av tomma pixlar |
| Innehåll | Bara bordet; ingen dealer, bakgrund, kort, marker eller dynamisk UI |
| Grönyckling | Nej: keya dealerlagret, inte ett grönt bord |
| Rekommenderad rörelse | Börja med stillbild. Rörligt transparent bord ingår inte i Light |

Bordsformen i paketet är ett illustrativt utkast kring kortmålen. Den är inte en fysisk kameralösning. Det går inte att dra slutsatsen att ett nytt bord passar händerna bara för att dess PNG har rätt storlek. Jämför mot låst VILA och REDO. Separera vid behov framkant och handmatte, men håll allt registrerat på samma plan.

## 3. Stilla bakgrund — rekommenderad förstahandsprofil
Master: 3414×1920, PNG RGB, 8-bit sRGB/SDR. Webb: WebP omkring kvalitet 86, JPEG omkring 90 som reserv. Det är startvärden för visuell granskning, inte garanterad filstorlek eller kvalitet. Bilden ska vara opak och täcka hela ramen. Inga inbakade dealer-/bord-/kortlager.

Mobiluttaget är samma crop som bordet. Det ska inte skapas av en separat generering som ändrar perspektiv. Från enbart 1080×1920 finns inga äkta sidopixlar att hämta. Man måste först utmåla/rendera sidorna, eller använda mobilbilden bara där den räcker.

Det går bra att visa bakgrunden från samma breda master i båda vyerna. Dekorativ bakgrund kan få en egen cover-policy, men då måste det vara ett separat, medvetet beslut — inte en gömd zoom på dealer/kort.

## 4. Loopande bakgrundsvideo
| Egenskap | Rekommenderad leverans |
|---|---|
| Container / codec | MP4 / H.264 (AVC) |
| Pixeldata | yuv420p, 8 bit, kvadratiska pixlar SAR 1:1, progressive |
| Färg | SDR, BT.709 primärer/transfer/matris, limited/tv range |
| Bildfrekvens | Exakt 24 fps, CFR (konstant), inte bara genomsnitt 24 |
| Desktop | 1920×1080; lätt variant 1280×720 |
| Mobil | 1080×1920; lätt variant 720×1280 |
| Längd | 4–10 sekunder som authoringförslag; kortare/längre är inte automatiskt fel |
| Ljud | Ingen ljudström, inte bara volym noll |
| MP4-laddning | faststart: moov före mdat; HTTP Range vid webbpublicering |
| Komprimering | CRF 22 som start, ungefär 20–24 efter jämförelse |
| GOP | 48 vid 24 fps som bakgrundsprofil; inte en regel för alla kodare |
| Bitrate | 1080p cirka 3–6 Mbit/s eller 720p cirka 1,5–3 Mbit/s kan vara budgetar, aldrig garanterat behov |
| Reserv | Matchande poster/stillbild; stäng av rörelse vid prefers-reduced-motion |

Låt rörelsen ske i ett begränsat område och håll kameran låst. Ingen global ljusflimmer-/zoom-/skaleffekt. Avslutet måste ansluta både i pose och rörelsehastighet. En enda lika slutbild bevisar inte en bra loop. Pingpong kan se fel ut och ska inte användas som universallösning för dealerhänder.

Den matematiska källan till provfilmerna är periodisk med 96 rutor per varv. Filen innehåller rutor 0..95; ruta 96 är nästa varvs ruta 0 och dubbleras inte. MP4 är förlustkomprimerat. Avkodade rutor är inte identiska med PNG-referensen bara för att koordinaterna är rätt. Testlooparna innehåller enkla ljusfält, inte AI-genererad casinoinredning.

En bred 16:9-video kan spelas höjdbaserat och centrerat beskuren i mobil. Light-exportören ändrar inte videons bildförhållande implicit. En separat mobilfil kräver en uttrycklig registrerad crop från originalet eller en separat korrekt förberedd källa, inte sträckning. Detta undviker att höga mobilklipp felaktigt kapas till 1080 höjd.

## 5. Dealerposer och klipp
VILA.png och REDO.png: 1080×1920, samma kameraregistrering. Spara original med sRGB och grön bakgrund, eller en granskad RGBA-friläggning. Två bilder per dealer/posepar, inte nya personer för varje skärm.

Dealer-video: MP4 H.264, 24 CFR, 1080×1920 eller 720×1280; yuv420p/BT.709/no audio/faststart enligt ovan. Grönt keyas vid uppspelning. CRF 18 (cirka 16–20 att prova) och GOP 24 är paketets startprofil. Standard H.264 i MP4 är inte ett alphaformat. Valfri WebM-alpha måste verifieras på aktuella målwebbläsare. ProRes 4444/PNG-sekvens är redigeringsmaster, inte standard webbtransport.

Grön RGB 0,255,0 är en bra jämn bakgrund för nya poser. Shader-/maskinställningarna och deras innebörd står i JSON. En greenscreenreferens kan ändå ha ett svart kortskoobjekt kvar efter keying; det kräver objekt-/mattehantering, inte hårdare gröntröskel.

Referensklippens historiska bildruteantal och cirka 1,1 s utdelning är inte ett tillstånd att godtyckligt snabba upp ett nytt 5 s klipp. Bevara genererad originaltiming tills rörelse och kontakt har granskats. Registrera verklig land_frame för varje godkänt klipp; gissa inte från filnamn eller att längden råkar stämma.

## 6. Omräkning utan storleksdrift
```text
s = viewport_height / 1920
screen_x = viewport_width / 2 + (canonical_x - 540) * s
screen_y = canonical_y * s
```
Vid 1920×1080 blir s=0,5625 och canonical x=0 hamnar på x=656,25. Den som visas i en mobilvy med samma faktiska visningshöjd har samma kroppsstorlek. Olika stora telefon- och datorskärmar kan naturligtvis ha olika höjd.

Bred master 3414×1920 har exakt 1167 pixlar extra per sida och behåller mobilens pixlar. Förhållandet är inte exakt 16:9; vid höjdanpassning till 1920×1080 blir bredden 1920,375 px, vilket ger 0,1875 px överhäng per sida. Det är explicit subpixelrendering, inte en tyst innehållsbeskärning.

Det äldre verktyget tog mobilens y=108..1187 och flyttade x med +420 till ett 1920×1080-plan. Den konverteringen är dokumenterad i JSON som LEGACY, men används inte för nya medier. Återförda äldre VILA-filer är inte originalfoton och deras tidigare kalibrering ska inte upprepas.

## 7. Vad gör vi med andra inputformat?
| Input | Hantering |
|---|---|
| Valfritt vanligt personfoto | Identitetsreferens, aldrig automatiskt färdig pose |
| 1080×1920 pose | Bevara; granska innehåll och inramning |
| 720×1280 pose | Uniform uppskalning till referensplanet vid behov; märk som uppskalad |
| 1152×2048 OpenAI-arbetsbild | Uniform faktor 15/16 → 1080×1920; ingen crop |
| 1088×1920 | STOPP. De åtta extra pixlarnas ursprung är okänt |
| 1024×1536 | STOPP för pose: 2:3, inte 9:16 |
| 1920×1080 dealer | STOPP utan registrering: bred film eller gammal crop? |
| 3414×1920 alpha-bord | Bevara master; härled mobilcrop |
| 1080×1920 alpha-bord | Transparent padding till wide; avklippta bordssidor återskapas inte |
| 1920×1080 tom bakgrund | Enhetlig höjdskalning till authoringplanet med uttrycklig subpixelmarginal |
| 1080×1920 bakgrund | Mobilbild; sidoinnehåll krävs för verklig wide-master |
| HDR, BT.2020, PQ, HLG | STOPP: färgkonvertering/tonmappning behövs separat |
| Okända färg-/SAR-metadata | Kräver explicit bekräftelse; skriv inte bara BT.709-taggar |
| Opaque bord/JPEG | STOPP: kräver riktig friläggning/alpha, inte svart eller grön bakgrund |
| .blend/PSD/EXR | Exportera med kalibrerad kamera till angiven PNG-/videoprofil; importeraren läser inte dessa projektformat |

## 8. Källor och säkerhet i påståenden
Aktivt scenunderlag jämfördes med GitHub-snapshot 7ccc2f6cba2a03241e2aabdd9fa36082edac5a9e. Paows koordinatprov där hade fortfarande olika mobil-/desktopzoom och approval=false. Det är inte bevis för inställningarna i ett publicerat spelrum.

Kända kortmål från det uppladdade verktyget har återförts till mobilplanet. Kortskons tidigare klickpunkt anges med provenance men är INTE universellt godkänd. Kamerans fysiska data, riktiga bordskontur och exakta handmasker är okända/utkast i JSON. Därmed förväxlas inte exakta siffervärden med uppmätt verklighet.

Officiell dokumentation, kontrollerad 2026-10-12:
- OpenAI bilder/vision: https://developers.openai.com/api/docs/guides/images-vision
- OpenAI bildgenerering och maskbegränsningar: https://developers.openai.com/api/docs/guides/image-generation
- OpenAI strukturerade granskningssvar: https://developers.openai.com/api/docs/guides/structured-outputs
- Runway input/ratio: https://docs.dev.runwayml.com/assets/inputs/
- Runway REST: https://docs.dev.runwayml.com/api/
- FFmpeg MP4/faststart: https://ffmpeg.org/ffmpeg-formats.html
- MDN codecguide: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs

Masken i AI-anropet är vägledning, inte en pixelgaranti. Paketet garanterar i stället oförändrade PNG-pixlar där den LOKALA masken är exakt svart genom egen komposition efter genereringen. Det gör inte anatomin eller övergången vid maskkanten automatiskt korrekt.

## Testfiler och färgkonvertering
De medföljande MP4-testlooparna har verifierad BT.709-transfer, primärer, matris och tv/limited range. Mallbyggaren konverterar sRGB-pixelvärden till BT.709 via zscale innan kodning och sätter VUI-metadata uttryckligen. Att köra om just mallbyggaren kräver FFmpeg med zscale. Det vanliga verktygets SDR-videoexport utgår i stället från granskad BT.709-källa och behöver inte zscale.
