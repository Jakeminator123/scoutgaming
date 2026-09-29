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
