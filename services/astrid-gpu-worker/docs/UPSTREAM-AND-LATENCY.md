# Ursprung, luckor och latens — 2026-09-29

## Jämförelsens gräns

`SOURCE.md` anger Emils GitLab-repo `EmaCodeHero/astrid-gpu-worker` vid
`d3a2d0a6672079033a0de3666a8d14122c06e90c` som importkälla. Git-objektet
finns inte i denna monorepos historik. Ett läsförsök mot
`EmaCodeHero/astrid-gpu-worker` på GitHub gav "Could not resolve to a
Repository" för nuvarande konto. Ingen GitLab-hämtning gjordes. Därför är
detta en inventering av den dokumenterade importen och våra efterföljande
ändringar, **inte** en verifierad diff mot Emils nuvarande branch. För att
avgöra om Emil har senare rättningar behövs en av honom tillgänglig,
läsbar källsnapshot och en filvis diff mot den angivna källcommiten.

## Vad som finns i kopian

- Importcommiten `8cd9bd8d` lade in Dockerfile, MuseTalk-hämtningsscript,
  RunPod-handler, avatarförberedelse, läppsynkmotor, preprocessing,
  RunPod-inspektionsverktyg och två avatarers PNG/YUV-plan. Även Emils
  ursprungs-README och historiska GitLab-CI följde med.
- Samma commit lade till vår inkrementella PCM/fMP4-kedja:
  `workers/streaming.py`, `workers/stream_session.py`, referensgateway,
  syntetiska Python-/Node-tester, GitHub-kontroller och källnotering.
  Croupiers verkliga spelare och serverintegration ligger utanför denna mapp.
- Senare lokala commits `f4e2b8e1` och `e03b5d05` rättade
  socketstädning, imageförberedelse, NVENC-val, tidsmätning och
  encoderbekräftelse. Emils fulla fristående Git-historik importerades inte.
- Den nuvarande uppstartsvägen är fortfarande GPU-beroende: MuseTalk-vikter,
  CUDA, färgkorrigering och uppvärmning. Ingen verifierad GPU-image eller
  faktisk RunPod-ström finns i denna kopias lokala testkvitton.

## Latensarbete utan GPU

Strömningen väntar tills ett 12-rutorsblock **och** 12 framtida kontextrutor
finns innan första MuseTalk-anropet. Vid 24 fps är det en sekund på den
globala tidslinjen, inklusive 0,22 s förtystnad. Tidigare syntetiskt försök
att minska första fönstret gav inte tidigare MP4-fragment; ändringen
återställdes. Vi behåller därför kontexten tills GPU- och bildkvalitetsprov
kan jämföra samma replik.

`render()` startar nu FFmpeg så snart första giltiga PCM kommer, parallellt
med att detta kontextfönster fylls. Tomma, avvisade eller avbrutna jobb före
PCM startar ingen encoder. Det ändrar varken bildrutor, ljudprover eller
mask/kalibrering. Lokala tester bekräftar tidig start, städning vid avbrott,
fragment före EOF och synkade H264/AAC-spår. Effekten på första synliga
bildrutan i verklig drift är ännu omätt; rapportera ingen sparad tid som
faktum före A/B-mätning på samma GPU och nätverk.

Nästa optimering bör väljas med de befintliga mätpunkterna i
[GPU-planen](../../../docs/ASTRID-GPU-CLOUD-TEST.md): textväntan, första TTS-PCM, första
workerfragment, `audio_analysis`, `inference`, `composition`,
`overlay_encode_wall` och klientens första bildruta. Upprepade överlappande
Whisper-fönster och 16-rutors modellbatch för 12 nya rutor är möjliga
kostnader, men förändringar där kräver GPU-tid och visuell synkgranskning.
NVENC är en möjlig CPU-avlastning; `encoder_verified` måste visa att just
provet verkligen använde den. RunPod-kö/kallstart och debitering kräver
separata RunPod-kvitton.

### CPU-kvitto för första mediefragmentet

Den tidigare `first_fragment`-mätningen togs på FFmpegs första utbyte, som kan
vara MP4-initboxar utan spelbara samples. Workern skiljer nu
`first_output_byte` från `first_fragment`: den senare sätts först när en hel
top-level `moof` följd av `mdat` har sänts. Boxräknaren fungerar även när
headers och payload är delade mellan socketchunkar och buffrar inte videon.
Detta är ett kodnings-/transportkvitto, inte bevis för att browsern avkodat en
synkad bild och ljud; klientens första bildruta och hörbart ljud måste också
mätas. Existerande `first_fragment`-loggar före denna ändring är inte direkt
jämförbara med nya loggar.

Reproducerbart lokalt prov:

```sh
python services/astrid-gpu-worker/tests/bench_first_fragment.py --runs 5
python -m unittest discover -s services/astrid-gpu-worker/tests -v
```

På Windows med FFmpeg 9.0.1 och 64×64 syntetisk video, förinläst två sekunders
tystnad, libx264 och en bortkastad uppvärmningskörning gav fem körningar
median 35 ms till första hela fragment och 52 ms för hela kodningen. Skillnaden
mellan första utbyte och fragment var median 1 ms. Detta är en lokal
FFmpeg-baslinje utan MuseTalk, TTS, nätverk, browser eller GPU. Den kan upptäcka
regressioner i muxern, men kan inte användas som prognos för spelarens väntan.

## Eget privat GitHub-repo?

Ett privat repo som Jakob äger kan på sikt ge workern en egen gransknings-
och imagecykel, enklare rot-Dockerfile för RunPods Git-import och snävare
åtkomst till GPU-builden. Det är särskilt motiverat om flera arbetar med
workern eller om imagebyggen ska versionssättas oberoende av spelet.
Monorepo-kopian är tills vidare den godkända källan och har redan en manuell,
SHA-taggad GHCR-workflow. Ett nytt repo i sig minskar inte svarslatens.

Vid eventuell uppdelning: välj en namngiven commit i `github-work`, gör en
spårbar subtree-export av `services/astrid-gpu-worker`, behåll `SOURCE.md`
med Emils repo-URL och exakta käll-SHA, och tagga exporten med monorepots
commit-SHA. Kopiera inte Emils fulla Git-historik som om den vore vår; om den
behövs, importera den separat med hans medgivande och behåll originalförfattare
och committerdata. Ändra därefter buildkälla och integration med en egen
granskad PR. Inget repo har skapats och inget har pushats till Emil.
