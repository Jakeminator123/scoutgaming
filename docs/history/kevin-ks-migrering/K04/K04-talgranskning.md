# K04 prov a – talgranskningspaket dragge/sv (underlag, inga godkännanden)

Datum 22 oktober 2026. Beställt i #312 6336875454 (andra scope). Det här är det **minsta verkliga** paketet av svenska dragge-repliker som tal-/kortövergångsprovet behöver. Allt är befintligt material ur Kevins frysta produkt `5aa7ed10` (kevin-merge-admin). Inget är genererat, och **inga godkännanden är satta eller påhittade**.

Maskinläsbart manifest för Admin-granskningen: [`K04-talgranskning-manifest.json`](K04-talgranskning-manifest.json). Ingen media ligger i git; bytes refereras via sha256.

## Urval

| takeId | Används av | Fack | K05-status |
|---|---|---|---|
| goodluck_1 | `test/postgres-k04-flow.mjs:278` @ PR336 4b0ccc1e, start före givningen | `speak.goodluck/goodluck` | befintlig-identitet |
| insurance_1 | `:278`, efter hålkortet | `speak.insurance/insurance` | befintlig-identitet |
| double_1 | `K04-mappning.md:39`, engine.act double (inte i flödestestets bindningslista) | `speak.double/double` | befintlig-identitet |
| win_1 | `:278`, settle | `speak.other/win` | ny-post-planerad |
| dealerbust_1 | `:279`, settle | `speak.other/dealerbust` | ny-post-planerad |
| placebets_1 | `:279`, collect → ny insatsrunda | `speak.other/placebets` | ny-post-planerad |

`twentyone_1` är uppskjuten (G13) och binds inte (`test/postgres-k04-flow.mjs:283-284` @ PR336 4b0ccc1e), så den ingår inte.

## Per replik

Gemensamt för alla sex: dealer `dragge` (registrerad `dragan`), språk `sv`, mp4 h264 1080x1920, 24 fps, AAC 24 kHz mono **inbäddat i samma fil**. Första ljudpaketet har pts −1024/24000 s (−42,7 ms, AAC-priming) och video pts 0. Det är en observation av containern, inte en deklarerad `audioDelayMs`. Exakt text är ur `repliker/sv/texter.json` @ 5aa7ed10 (gitblob `d7453d87`, sha256 `2a9d85eb…f2a1b`), identisk med staging.

| takeId | Exakt text | bytes | video sha256 | gitblob @5aa7ed10 | frames | Neon media-ID |
|---|---|---|---|---|---|---|
| goodluck_1 | Inga fler insatser. Här kommer korten. | 767 346 | `b6f6990618c7e17eb5d578634bfc22cbaf4210e6f794c5e88c287f52afba7d15` | `2a31bdac` | 73 | `0f285c18-69da-43e4-8b28-f9fc8cce2d5f` |
| insurance_1 | Ess synligt. Vill någon ha försäkring? | 782 896 | `90ff155e206f467bb0fd67b2e759ac8f49d202bb7fb71f707607cb9a92dbf940` | `4ee88c31` | 79 | `dfe18f3c-71ce-41d1-958c-e706d27beebd` |
| double_1 | Dubbling. Ett kort och bara ett kort. | 754 637 | `93377430605560599319c086122140e234d0f33262186a93f8f3480bb3021db5` | `cc492658` | 69 | `abee12f4-d98b-433d-aed4-8d4a3dd7673c` |
| win_1 | Grattis till vinnarna! | 287 921 | `d5d71ff633cd103cef2dee8a23679b78bd6accfc31d2be0c015b3a56a3927ae9` | `5b52a90b` | 53 | saknas |
| dealerbust_1 | Dealern blir tjock! Alla som är kvar i handen får betalt. | 1 041 840 | `11869f8923869450aef132227386d995286010f5d24e8cb1b26f622a61ce750d` | `874562de` | 99 | saknas |
| placebets_1 | Insatserna är öppna. Lägg dina marker när du är redo. | 972 060 | `bff4a560a870258dcda3cc83d6803da4208df1a7db987db02d4edfc15da58123` | `0922e1b5` | 97 | saknas |

Bytes och sha256 är omräknade ur staging-releasen `gh-de0d26ba5a30` och stämmer med K05-matrisen för alla sex.

**Granska:** klippsidan [klipp.html?q=dragge/repliker/sv](https://staging.37-27-199-225.sslip.io/klipp.html?q=dragge/repliker/sv) (filtret matchar mappen, inte enskilda klipp; öppna mappen och leta upp takeId). Direktlänkar:
[goodluck_1](https://staging.37-27-199-225.sslip.io/media/dealers/dragge/repliker/sv/goodluck_1.mp4) ·
[insurance_1](https://staging.37-27-199-225.sslip.io/media/dealers/dragge/repliker/sv/insurance_1.mp4) ·
[double_1](https://staging.37-27-199-225.sslip.io/media/dealers/dragge/repliker/sv/double_1.mp4) ·
[win_1](https://staging.37-27-199-225.sslip.io/media/dealers/dragge/repliker/sv/win_1.mp4) ·
[dealerbust_1](https://staging.37-27-199-225.sslip.io/media/dealers/dragge/repliker/sv/dealerbust_1.mp4) ·
[placebets_1](https://staging.37-27-199-225.sslip.io/media/dealers/dragge/repliker/sv/placebets_1.mp4)

## recordedSpeech-tuplen: vad som finns och vad som saknas

Kontraktet (`packages/presentation/contracts/recorded-speech.mjs`) kräver dealerId, lineId, takeId, language, exactText, videoSha256, audioSha256, indexSha256, fps, frameCount, audioDelayMs, entryPose, exitPose och calibrationRevision. Dessutom krävs två bevis med `by`/`at`/`identity` bundna till exakt samma tuple: `recording` och `review`.

| Fält | goodluck_1, insurance_1, double_1 | win_1, dealerbust_1, placebets_1 |
|---|---|---|
| dealer/lineId/takeId/språk/exakt text | finns (ovan) | finns (ovan) |
| videoSha256, fps 24, frameCount | finns (ovan) | finns (ovan) |
| audioSha256, indexSha256, audioDelayMs, entry/exitPose | finns i Neon-postens `classification.recordedSpeech`; **inte lästa här** (prod, read-only via Admin) | **saknas.** Main har ingen producent för Kevins muxade mp4 (`dealer-import-plan.mjs:173` `recorded-audio-index-calibration-required`). Förväntad pose VILA → VILA enligt Kevins talgrind (`K04-mappning.md:154`), ej attesterad |
| calibrationRevision | `kevin-original-mux-unreviewed-v1` (`K05-mappning.md:57`) | saknas |
| Registrering | Neon-post i `review/uploads`; kräver promotion till runtime + blobIndex med återhashning (K05-mappning steg 2, verktyg saknas i main) | ingen post. Kräver Blob-grant, uppladdning, sha256-återläsning och `media_records` för `dragan` (steg 3), därefter promotion |
| recording | `pending` | saknas |
| review | `pending` | saknas |

**win_1:** Neon `efd551ec-a27c-4cb1-aff3-3848109df8fa` har äldre bytes (f15b2af1/315cfc55) med annan hash. Den får inte återanvändas för denna tuple.

## Vad som måste göras av människor (ingen agent får fylla i det)

1. **Inspelningsintyg** (`recording: verified-recording`, by/at/identity) per take: någon intygar att inspelningen är exakt denna tuple.
2. **Ljud- och bildgodkännande** (`review: approved`, by/at/identity) per take: Kevin eller utsedd granskare lyssnar och tittar, helst två uppspelningar i följd. ASR och filhashar ersätter inte detta.
3. **Registrering och promotion** enligt K05-mappning steg 2-4. Det är ett auktoriserat skrivsteg och kräver eget ja.

Minsta väg till ett körbart prov a är de tre befintliga (goodluck_1, insurance_1, double_1): de behöver bara steg 1-3 utan ny tuple. Flödet spelar också win_1, dealerbust_1 och placebets_1. Utan godkännande av dem blir de `skipped`-kvitton (`local-presentation.mjs:250-259`), och provet täcker då bara goodluck och insurance under kortövergången.

## Tillägg 22 okt: Dragans välkomst (#312 6339673965 p3)

Sex tagningar, lineId `greeting`, fack `speak.other/greeting`, dealer `dragge` (registrerad `dragan`). **Standard är greeting_1**, och greeting_2 och greeting_3 är varianter. Samma format som ovan: mp4 h264 1080x1920, 24 fps, AAC 24 kHz mono inbäddat, första ljudpaketet −42,7 ms (observation, inte `audioDelayMs`). Bytes är omräknade ur 5aa7ed10 och identiska med staging.

| Språk | takeId | Exakt text | bytes | video sha256 | gitblob | frames |
|---|---|---|---|---|---|---|
| sv | greeting_1 | God kväll och välkommen till bordet. Jag heter Dragan, sätt dig där du vill. | 350 390 | `a305ade972019978ac51b5df9b8e5866efc096ad1d86265527e19b394414cc74` | `53232efa` | 119 |
| sv | greeting_2 | Välkommen in. Dra fram en stol, korten är nyblandade och bordet är ditt. | 1 193 799 | `6d8325370ce59c722e13dd4e61999f11cbcaf8eb2d9e4461db7b0ad6b692aa8d` | `83bd6c19` | 119 |
| sv | greeting_3 | Ett nytt ansikte vid bordet. Välkommen, jag heter Dragan och delar ut åt dig i kväll. | 361 302 | `498a2dc12e70d7911791cca9c595c63dee5e51d058f45cf542f53e0f5ffee3d8` | `4be5ba43` | 131 |
| en | greeting_1 | Good evening, and welcome to the table. I'm Dragan, take any seat you like. | 335 112 | `676855d2cd0a65074afd6b2f1a234fc38fc88997d0b5f086cb08a6f6eeb85e3c` | `2ee4aaf2` | 99 |
| en | greeting_2 | Welcome in. Pull up a chair, the cards are fresh and the table is yours. | 1 093 778 | `353989fcf73c785c1002f07a6149d817bb5ae84e33f90462fd3f456ab493ff7d` | `541ea468` | 102 |
| en | greeting_3 | A new face at the table. Welcome, I'm Dragan, and I'll be dealing for you tonight. | 348 522 | `906cb3717abe23d526796bef5e87cec4314d3287be795f584b21632c28c853c1` | `ce037bbd` | 113 |

Texterna kommer ur `repliker/{sv,en}/texter.json` @ 5aa7ed10: sv gitblob `d7453d87` (sha256 `2a9d85eb…`), en gitblob `aa0628ae` (sha256 `8609306f…`).

Granska: [sv-mappen](https://staging.37-27-199-225.sslip.io/klipp.html?q=dragge/repliker/sv) · [en-mappen](https://staging.37-27-199-225.sslip.io/klipp.html?q=dragge/repliker/en) · direkt:
[sv 1](https://staging.37-27-199-225.sslip.io/media/dealers/dragge/repliker/sv/greeting_1.mp4) ·
[sv 2](https://staging.37-27-199-225.sslip.io/media/dealers/dragge/repliker/sv/greeting_2.mp4) ·
[sv 3](https://staging.37-27-199-225.sslip.io/media/dealers/dragge/repliker/sv/greeting_3.mp4) ·
[en 1](https://staging.37-27-199-225.sslip.io/media/dealers/dragge/repliker/en/greeting_1.mp4) ·
[en 2](https://staging.37-27-199-225.sslip.io/media/dealers/dragge/repliker/en/greeting_2.mp4) ·
[en 3](https://staging.37-27-199-225.sslip.io/media/dealers/dragge/repliker/en/greeting_3.mp4)

**Saknas för alla sex:**
- Registerpost: ingen Neon-post och inget media-ID.
- `audioSha256` och `indexSha256` saknas i källan, eftersom Kevins mp4 har ljudet inbäddat och det inte finns någon separat ljudfil eller indexfil. Main har ingen producent för dem (`dealer-import-plan.mjs:173`). Producenten måste definieras i K05-registreringen och en ägare utses. Kevin attesterar.
- `audioDelayMs`, entry/exitPose och `calibrationRevision` saknas. Förväntad pose är VILA → VILA (`K04-mappning.md:154`), men den är inte attesterad.
- `recording` och `review` saknas helt, alltså inte ens pending.
- **K05:** alla sex finns i K05-matrisen f00a8c2d…ce319 som ny-post-planerad, ej accepterad (saknar registerpost). greeting_2 och greeting_3 (sv och en) lades till 22 okt och finns inte i K04 `k04-media.tsv` @ 4e094fbb (k04_lika=nej).

**win_1, dealerbust_1, placebets_1:** de finns redan ovan med allt som källan har. Det som fattas där fattas också i källan (audio-/indexhash, poser, kalibrering, recording och review). Det finns inget nytt att lägga till.
