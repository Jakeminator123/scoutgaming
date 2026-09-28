# Emils media i Croupier

Två separata samlingar ligger här. Behåll deras gräns vid fortsatt arbete.

| Mapp | Roll | Innehåll |
| --- | --- | --- |
| [`dealklipp-v1/`](dealklipp-v1/README.md) | Aktiv videobank för spel och labb | 43 MP4-filer och `lab-video-manifest.json`. Kod och tester använder dessa exakta sökvägar och hashvärden. |
| [`astrid-demo-v3-reference/`](astrid-demo-v3-reference/SOURCE.md) | Inaktiv, självständig referenskopia från Emils V3-demo | 217 MP4-filer, flerspråkiga `bank.json`, manifest, kortpositioner, startbild och demoexempel. Inte ansluten till Croupiers spelare. |

En SHA-256-jämförelse den 28 september 2026 hittade **inga identiska MP4-filer**
inom V3 eller mellan V3 och den aktiva banken. Endast V3:s `startbild.png` är
byteidentisk med `dealklipp-v1/astrid_startbild_spel_1080x1920.png` (1 628 428
byte). V3-manifestet pekar på sin egen startbild; kopian är kvar så att
referenspaketet kan granskas som en helhet.

Nya V3-klipp får inte ersätta aktiva takes enbart för att namn eller bild liknar
varandra. Ett införande behöver exakt text, ljud, videohash, frame index,
kalibrering, visuell acceptans och prov i den riktiga spelaren enligt `AGENTS.md`.
Den historiska V3-kopian finns också i `Jakobs-v1`.

## Storlek och komprimering

Den aktiva banken är cirka 126 MiB; V3-referensen cirka 63 MiB. Båda innehåller
redan H.264-komprimerade MP4-filer. Ett läsande stickprov med gzip nivå 9 gav
**0,01 % större** fil för ett aktivt deal-klipp och **0,06 % mindre** för ett
V3-klipp. Det ger ingen meningsfull förlustfri besparing i arbetskopian.
Omkodning ändrar filbytes och hashvärden och skulle kräva ny kalibrering och
visuell acceptans för aktiva takes; ingen MP4 har ändrats här.

`emil/dealklipp-v1` är en avsiktlig aktiv rot i manifest, schema, labbkod,
tester och den planerade containerkontexten. Att flytta hela trädet ger ingen
lagringsvinst. V3-kopian är däremot redan utesluten ur rotens Dockerkontext via
`.dockerignore`; den bevaras som komplett referensbank med sitt eget manifest.
