# Emils media i Croupier

Den aktiva samlingen ligger här. Den fristående V3-demonstrationen är
byteverifierat arkiverad utanför repot.

| Mapp | Roll | Innehåll |
| --- | --- | --- |
| [`dealklipp-v1/`](dealklipp-v1/README.md) | Aktiv videobank för spel och labb | 43 MP4-filer och `lab-video-manifest.json`. Kod och tester använder dessa exakta sökvägar och hashvärden. |

V3:s 240 filer (cirka 63,1 MiB), inklusive 217 MP4, egna manifest och
demoexempel, finns i
`C:\Users\jakem\Desktop\croupier\BACKUP-LAB-to-HUB\repo-files\emil\astrid-demo-v3-reference\`.
Varje fil finns med SHA-256 i `backup-manifest.json` där. Samma träd kan
återställas från Git-commit `9e2048a6` eller taggen `Jakobs-v1`.

En SHA-256-jämförelse den 28 september 2026 hittade **inga identiska MP4-filer**
inom V3 eller mellan V3 och den aktiva banken. Endast V3:s `startbild.png` är
byteidentisk med `dealklipp-v1/astrid_startbild_spel_1080x1920.png` (1 628 428
byte). Den arkiverade V3-kopian behåller sin egen startbild och sitt manifest.

Nya V3-klipp får inte ersätta aktiva takes enbart för att namn eller bild liknar
varandra. Ett införande behöver exakt text, ljud, videohash, frame index,
kalibrering, visuell acceptans och prov i den riktiga spelaren enligt `AGENTS.md`.
Den historiska V3-kopian finns också i `Jakobs-v1`.

## Storlek och komprimering

Den aktiva banken är cirka 126 MiB; arkiverad V3 cirka 63 MiB. Båda innehåller
redan H.264-komprimerade MP4-filer. Ett läsande stickprov med gzip nivå 9 gav
**0,01 % större** fil för ett aktivt deal-klipp och **0,06 % mindre** för ett
V3-klipp. Det ger ingen meningsfull förlustfri besparing i arbetskopian.
Omkodning ändrar filbytes och hashvärden och skulle kräva ny kalibrering och
visuell acceptans för aktiva takes; ingen MP4 har ändrats här.

`emil/dealklipp-v1` är en avsiktlig aktiv rot i manifest, schema, labbkod,
tester och den planerade containerkontexten. Att flytta hela trädet ger ingen
lagringsvinst. V3-kopian var redan utesluten ur rotens Dockerkontext via
`.dockerignore`; den bevaras som komplett referensbank i städarkivet och Git.
