# Medieverktyg och bevarade byggrecept

`tools/media/` innehåller manuella medieverktyg och prov för den gemensamma
spelaren. Mappen är ingen produkt, spelmotor eller OpenClaw-tjänst. Den äldre
indexerade dealerbanken är avvecklad; att ett byggrecept finns kvar betyder
inte att dess indata finns kvar eller att det är rätt väg för nya klipp.

`/admin` är backofficeytan och `apps/studio/` är Studios källmapp.
Den lokala bankens omskanning är borttagen; nya klipp läggs in i klippbiblioteket.

| Verktyg | Uppgift och begränsning |
| --- | --- |
| `build-lab-video-manifest.mjs` | Bygger/verifierar presentationsbankens manifest med exakt filhash och stabilt ID. Används av Lab-proven för manifest och uppladdning; är inte en automatisk registrering av nya klipp. |
| `build-index.mjs` | Indexerar Annex-B H.264 via AUD-markörer. Bevarar tidigare metadata vid oförändrade bytes och vägrar ersätta en kalibrerad tagning med nya bytes. |
| `pack-contact-media.mjs` | Paketerar uppmätt kortkontakt i 24 fps: RGB i originalupplösning och mask i samma kamera. Kontrollerar bildruteantal; sätter inget visuellt godkännande. |
| `encode.sh` | Äldre export till 1440 × 1440, 24 fps, rå H.264. Beskär bilden kvadratiskt och tar bort ljud. Är inget allmänt exportrecept för dagens stående klipp eller lager. |
| `build-contact-review.mjs` | Äldre Astrid-recept för uppmätt kortkontakt. Skriver filer och manifest i sitt befintliga performance-mål; granska målet innan körning. |
| `person-mask.swift`, `track-dealer-hands.swift`, `inspect-contact-capture.swift`, `prepare-contact-mattes.swift` | Manuella macOS/Vision-mätningar och maskrecept för låst kamera. `person-mask` är den tillhörande binären. Resultat och fångstspecifika standardvärden är underlag för granskning. |
| `capture-dealer-face.py` | Manuell ansiktsmätning med OpenCV/MediaPipe. Kräver en lokal modell (`--model`); den inbyggda sökvägen är från en tidigare Mac-miljö. Återinför inte ett avvecklat rigg-/3D-spår. |
| `test-*.mjs` | Prov för bland annat talpar, idle, kortkontakt och komposition. Filnamn med en gammal teknik innebär inte att provet saknar en nuvarande spelarkonsument. |
| `mouth-crops.json`, `speak-normalize.txt`, `irs/` | Bevarade mätvärden/recept och ljudreferens. Ingen generell instruktion att generera eller godkänna nya takes. |

Det gamla kommandot `build-dealer-v2-release.mjs` är pensionerat. Det byggde
en separat statisk jämförelsespelare vars switcher-API och CSS redan saknas.
Sparade kommandon för denna export ska inte köras. Aktuell spelare,
mediematerial och den aktiva `dealerVersionPath`-adaptern behålls.

## Före användning

- Läs [den tekniska referensen](../../docs/LOCAL-PRESENTATION-RUNTIME.md),
  [överlämningen](../../docs/NEXT-AGENT.md) och
  [återställningsreglerna](../../docs/ENVIRONMENT-RESTORATION.md) för mediearbete.
  Spelformat och låsta lager beskrivs i [spelguiden](../../docs/games/README.md).
- Shellrecepten kräver FFmpeg/FFprobe; `encode.sh`
  använder dessutom macOS/BSD `stat`. Swift-recepten kräver Apples ramverk.
  Detta är inte Windows-installationsskript.
- Kontrollera varje recepts indata och mål. Kör ersättningstagningar i
  separat staging och bevara källmedia, kalibrering och publicerad historik.
  Kör inte gamla byggare för att försöka återregistrera den borttagna banken.
- Kör riktade prov för det beteende som ändras; full regression finns i CI
  och `.githooks/pre-commit --full`. Granska uppspelning vid konkret mediefel
  eller begärd visuell kontroll. Upprepade spelningar behövs när beteendet
  beror på upprepning. Filhash och provresultat godkänner inte läppsynk eller kortkontakt.

Kvarvarande audit av `runtime/hands` och äldre byggare följs i den befintliga
[molnplanen](../../docs/CLOUD-MIGRATION.md), punkt SL-10. Verktygens existens
betyder inte att den punkten är klar.
