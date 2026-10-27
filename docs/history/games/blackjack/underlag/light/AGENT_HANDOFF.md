# Handoff till lokal agent — Dealerverkstad Light

## Målet
En tydlig datakälla och små deterministiska operationer före AI. Användaren vill välja en personbild, få korrekt VILA/REDO och därefter beställa kontrollerade dealerklipp; samtidigt ska samma geometrikontrakt hjälpa produktion av bord och bakgrund.

## Läsordning
01_SPEC/SCENKONTRAKT.json → FORMATGUIDE.md → program/core.py → media.py → workflow.py → providers.py → gui.py → tests/test_core.py.

## Gör inte
- Ingen global 35%-förminskning eller −150 px-justering. Återförd låst VILA är redan korrigerad.
- Ingen legacy-crop y108..1188 och ingen återanvändning av desktopkoordinater som mobil.
- Ingen implicit crop av 1088×1920 eller 2:3-poser.
- Inget tyst modellbyte. seedance2-adaptern använder både first och last; byt inte till en startbildsmodell och kalla det samma beteende.
- Ingen hemlighet i JSON, logg, webbläsare, prompt eller git. Inga .env från gamla ZIP-filer.
- Ingen spelmotor/RNG/kort-/saldo-/API-/deployändring. Detta är presentation, inte spelregler.
- Ingen låtsad fysisk kamera, falskt exakta handmål eller auto-godkänd bordskontur.
- Inga fonts, model weights, venv eller privata arbetsfiler i en ny distributions-ZIP.

## Arkitektur
core.py: kontrakt, hash-identifierade inputkopior, låsta poser, versions-/beroendesamband och JSONL-logg. En appinstans per arbetsmapp, ingen flerprocessdatabas.
media.py: formatkontroll, EXIF/ICC, alpha/grönyckling, exakt padding/crop, uniform resampling, maskkomposition, FFmpeg och endpointkvitton.
providers.py: noll automatiska nätverksretries, begränsade REST-adaptrar, säkra datareferenser, sanerade fel. Ingen nyckel får lämna respektive API-endpoint som Authorization. Resultat hämtas utan API-nyckel.
workflow.py: två låsningar, kandidater, explicit betald beställning, persistent task-ID, skydd mot samma planhash två gånger.
gui.py: tkinter, filval och huvudtrådssäkra callbacks; nycklar i maskerade RAM-fält. Beroenden installeras av bootstrap.py.

## AI-granskning
Skickar max 1536 px långsida och lokala mått till Responses. Schemat har semantic_role, confidence, observed_patterns, geometry_risks, recommended_action m.m. Ingen verktygsanvändning eller exekvering av bildtext. Svaret kan klassificera personfoto kontra pose/bord/bakgrund men gör inte automatiskt nya regler.

Logg: arbetsyta/logs/events.jsonl. Granskningscache: arbetsyta/reviews/<hash>.json. Hash omfattar bild, roll, kontrakt, modell, promptversion. Upprepade identifieriska granskningar använder cache. Confidence är modellens subjektiva bedömning, inte empiriskt kalibrerad sannolikhet.

Modellkonfigurationen följer dokumentationen vid paketbygget. Användarens lokala API-nyckel och kontoåtkomst är inte verifierade. Ett leverantörsfel ska visas konkret och får inte utlösa betalda fallbackkedjor.

## VILA → REDO
VILA-generering använder geometri-/posemall först och identitetsbild som separat referens. Referensen normaliseras till 1152×2048 utan crop. Genererat original sparas. Svaret måste faktiskt vara exakt det formatet; annars stoppas automatisk inkoppling.

REDO använder låst VILA som första bild. Den lokala L-masken är 1080×1920: 0=bevara, 255=redigera. OpenAI-maskens alpha inverteras. Efter leverantörssvaret och uniform resampling återställs alla svarta maskpixlar exakt från låst VILA. Halvgrå mask ger blandning och är inte exakt låsning. Granska gränserna, gamla/nya armkonturen och innehållet inne i regionen. Inget med detta bevisar rätt handanatomi.

Byte av VILA ogiltigförklarar REDO. Historiska jobb sparas men märks staleForCurrentPoses. De avbryts inte hos leverantören. Omlåsning kan ske från importerad poserad PNG, användaren behöver inte generera en ny referens i onödan.

## Video
14 rörelseposter stöds, varav ready-hold är valfri. 17 talposter finns kvar som dokumenterad katalog men saknar Light-lipsync. Preview 720×1280 och High 1080×1920 är explicit tvåkeystone-profiler. 5 sekunders providergenerering är inte automatiskt likvärdig med v3:s äldre 26–28 bildrutor.

Läs verklig native metadata, spara original, kör vid behov lokal MP4-export och endpointkontroll. Sätt inte kvalitet=true från dimensioner/CFR. Landningsruta och övergångskvalitet måste granskas i varje nytt klipp. Endpointkvitton använder avkodad RGB och förklarar att codec/färg bidrar till differensmåttet.

Vid SUBMITTING utan task-ID eller UNKNOWN_SUBMISSION: kontrollera leverantören först. Återställ inte posten som om inget hänt; nytt POST kan dubbelfakturera. Read/status gör inte en ny beställning.

## Integrationskontrakt till GitHub
Repo: Jakeminator123/scoutgaming. Den lästa jämförelsesnapshoten är 7ccc2f6cba2a03241e2aabdd9fa36082edac5a9e. Läs aktuell main och dess instruktioner igen innan integration.

Behåll 1080×1920 som koordinatplan, mappa box 0..6 till medieplats 1..7 uttryckligen. Återanvänd höjdbaserad dealerFrameRect-/stage-princip, men verifiera published settings och tablePlacement separat. Provkatalogens scale1.04/1.40 och y−.04/+.18 får inte kopieras som en ny gemensam standard.

Lagerordning för riktiga rörelser behöver samma avkodade dealerframe bakom bord och händer framför. Static splitY är inte en allmän segmenteringslösning. Tabellen och kortlagret ska följa rätt transform. Gör en avgränsad integrations-PR efter godkänd visuell testyta, inte en global ersättning av mediefamiljer.

## CLI för agenter (lokal, inga betalda anrop)
```powershell
.venv\Scripts\python.exe app.py --workspace "C:\Dealerjobb\NyDealer" inspect "C:\Bilder\bild.png"
.venv\Scripts\python.exe app.py --workspace "C:\Dealerjobb\NyDealer" normalize "C:\Bilder\bord.png" --role table
.venv\Scripts\python.exe app.py --workspace "C:\Dealerjobb\NyDealer" catalog
.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Reproducerbara mallar: `python -m program.make_templates`. Mallgeneratorn skriver bara 02_MALLAR, ingen extern AI. Den läser lokala systemfonts men distribuerar inte typsnittsfiler. Ändra inte måttkontraktet utan schema-, tester-, mall- och VIEWER_DATA.js-uppdatering samt explicit versionshöjning/migrering av arbetsmappar.

## Öppna verifieringar före skarp användning
Native Windows-körning och first-install från PyPI, leverantörsmodellernas faktiska stöd på det lokala API-kontot, bildredigering med två referenser/mask, Runway first/last-resultat och riktiga mobilwebbläsare. Inga live-betalningar gjordes vid paketbygget. Exakta testresultat finns separat.

## Leveranstest, slutkvitto
41 enhetstester godkända. Linux/Tk start, bildladdning och inspektion godkända. Verklig FFmpeg-export 1920×1080 → 1280×720 godkänd med 24 CFR och BT.709. Båda MP4-testlooparna har 96 avkodade rutor, 4 sekunder, ingen ljudström och faststart. Webbläsartest: blockerat av miljöns administratörspolicy för både file:// och localhost; försök inte tolka det som genomförd runtime-QA. Windows och betalda API-flöden har inte körts. Inga privata nycklar har skapats eller lagts i paketet.
