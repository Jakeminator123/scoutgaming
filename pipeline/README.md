# Medieverktyg och bevarade byggrecept

`pipeline/` innehåller manuella medieverktyg och prov för den gemensamma
spelaren. Mappen är ingen produkt, spelmotor eller OpenClaw-tjänst. Den äldre
indexerade dealerbanken är avvecklad; att ett byggrecept finns kvar betyder
inte att dess indata finns kvar eller att det är rätt väg för nya klipp.

`/admin` är den nya backofficeytan; `lab/` är fortfarande källmappen för
Studio. Den lokala bankens omskanning i
`lab/lib/video-registry.mjs` svarar 410 och hänvisar till klippbiblioteket.

| Verktyg | Uppgift och begränsning |
| --- | --- |
| `build-lab-video-manifest.mjs` | Bygger/verifierar presentationsbankens manifest med exakt filhash och stabilt ID. Används av Lab-proven för manifest och uppladdning; är inte en automatisk registrering av nya klipp. |
| `build-index.mjs` | Indexerar Annex-B H.264 via AUD-markörer. Bevarar tidigare metadata vid oförändrade bytes och vägrar ersätta en kalibrerad tagning med nya bytes. |
| `pack-contact-media.mjs` | Paketerar uppmätt kortkontakt i 24 fps: RGB i originalupplösning och mask i samma kamera. Kontrollerar bildruteantal; sätter inget visuellt godkännande. |
| `encode.sh` | Äldre export till 1440 × 1440, 24 fps, rå H.264. Beskär bilden kvadratiskt och tar bort ljud. Är inget allmänt exportrecept för dagens stående klipp eller lager. |
| `build-hands.sh` | Återskapar Veras handmattor från de borttagna indexerade Vera-strömmarna och en särskild bakgrundsplåt. Behållen eftersom `runtime/hands` finns kvar; kräver kontroll av källa, kamera och bildrutor före användning. |
| `build-previews.sh` | Gör omkodade 720 × 720-förhandsvisningar från äldre indexerade talpar och deras ljudfördröjning. Hoppar över banker utan `streams/index.json`; är inget synkacceptanskvitto. |
| `build-contact-review.mjs`, `prepend-contact-entry.mjs` | Äldre Astrid-recept för uppmätt kortkontakt. Skriver filer och manifest i sina befintliga performance-mål; `prepend-contact-entry.mjs` använder den borttagna `runtime/indexed/performance`-banken. Granska målet innan körning. |
| `person-mask.swift`, `track-dealer-hands.swift`, `inspect-contact-capture.swift`, `prepare-contact-mattes.swift` | Manuella macOS/Vision-mätningar och maskrecept för låst kamera. `person-mask` är den tillhörande binären. Resultat och fångstspecifika standardvärden är underlag för granskning. |
| `capture-dealer-face.py` | Manuell ansiktsmätning med OpenCV/MediaPipe. Kräver en lokal modell (`--model`); den inbyggda sökvägen är från en tidigare Mac-miljö. Återinför inte ett avvecklat rigg-/3D-spår. |
| `build-dealer-v2-release.mjs` | Äldre statisk jämförelseexport från en fångad spelarversion. `/v2` är numera en omdirigering, inte en separat aktiv spelare. Exporten är ingen produktionsdeploy. |
| `test-*.mjs` | Prov för bland annat talpar, idle, kortkontakt och komposition. Filnamn med en gammal teknik innebär inte att provet saknar en nuvarande spelarkonsument. |
| `mouth-crops.json`, `speak-normalize.txt`, `irs/` | Bevarade mätvärden/recept och ljudreferens. Ingen generell instruktion att generera eller godkänna nya takes. |

## Före användning

- Läs [den tekniska referensen](../docs/LOCAL-PRESENTATION-RUNTIME.md),
  [handoffen](../docs/JOHN-HANDOFF.md) och
  [återställningsreglerna](../docs/ENVIRONMENT-RESTORATION.md) för mediearbete.
  Spelformat och låsta lager beskrivs i [spelguiden](../docs/games/README.md).
- Shellrecepten kräver FFmpeg/FFprobe; `encode.sh` och `build-hands.sh`
  använder dessutom macOS/BSD `stat`. Swift-recepten kräver Apples ramverk.
  Detta är inte Windows-installationsskript.
- Kontrollera varje recepts indata och mål. Kör ersättningstagningar i
  separat staging och bevara källmedia, kalibrering och publicerad historik.
  Kör inte gamla byggare för att försöka återregistrera den borttagna banken.
- För media-/spelarändring gäller `.githooks/pre-commit` och granskning i
  den riktiga spelaren med två uppspelningar i följd. Filhash och provresultat
  ersätter inte visuell acceptans av läppsynk eller kortkontakt.

Kvarvarande audit av `runtime/hands` och äldre byggare följs i den befintliga
[molnplanen](../docs/CLOUD-MIGRATION.md), punkt SL-10. Verktygens existens
betyder inte att den punkten är klar.
