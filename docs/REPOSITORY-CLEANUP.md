# Repostädning inför GitHub-arbetet

## V3 arkiverad och 3D-källor uteslutna ur Docker, 29 september 2026

Den fristående `emil/astrid-demo-v3-reference/` togs bort ur arbetskopian:
240 spårade filer, 66 160 426 byte (63,1 MiB), varav 217 MP4. Hela mappträdet,
dess manifest och demoexempel finns byteverifierade på
`C:\Users\jakem\Desktop\croupier\BACKUP-LAB-to-HUB\repo-files\emil\astrid-demo-v3-reference\`.
`backup-manifest.json` där innehåller filvisa SHA-256-värden och `INDEX.md`
listar denna samt tidigare städning. Gruppen finns också i commit `9e2048a6`
och taggen `Jakobs-v1`; återställ riktat med
`git restore --source=9e2048a6 --staged --worktree -- emil/astrid-demo-v3-reference`.
Sökning i kod, tester, byggskript och aktiva dokument fann ingen konsument;
endast daterad handoff och `emil/README.md` nämnde den. Den var redan utanför
Dockerkontexten. Ingen MP4 kodades om eller komprimerades.

Samma externa backup innehåller dessutom fyra sammanhängande avvisade
3D-studier: `content/staging/2026-09-11/astrid-replacement/` och
`content/staging/2026-09-12/{astrid-closeup,astrid-rest-study,upright-controller}/`.
Det är 240 spårade filer och 987 631 568 byte (cirka 941,9 MiB), inklusive
åtta symboliska länkar vars mål står i `backup-manifest.json`. September-12-skript refererar
till september-11-originalen; inga produkt-, Lab-, test- eller molnreferenser
hittades. **Dessa fyra grupper är inte raderade.** Automatisk granskning
avvisade radering eftersom unika original och återbyggnadsunderlag kräver
ett separat uttryckligt beslut även med backup. Ingen kringväg användes.

Rotens `.dockerignore` utesluter nu även `assets/astrid-3d/` (cirka 563 MiB)
och `assets/blackjack-3d/` (cirka 220 MiB). Deras kända läsare är offline-
byggskript i `pipeline/`; spelets webbkod laddar de publicerade kopiorna i
`web/public/`. Källorna finns kvar lokalt och i Git. Det minskar den planerade
rot-Dockerkontexten med cirka 783 MiB, men en faktisk image har inte byggts
eller mätts här. Aktiva dealerfilmer, manifest, databaser, projekt och det
pensionerade privata personarkivet är orörda.

## Historiska 3D- och videogranskningspaket, 29 september 2026

Två avgränsade, spårade granskningspaket togs bort ur arbetskopian:

| Grupp | Filer | Byte | Varför |
| --- | ---: | ---: | --- |
| `assets/blackjack-3d/review/` | 72 | 95 683 800 | Daterade QA-kvitton, tysta browserfilmer och skärmbilder; inga kod-, test- eller byggberoenden. |
| `web/public/review/astrid-a9fa1da6/` | 21 | 33 820 939 | Fristående äldre visningssida och exportkopior; inga runtime-, test-, release- eller byggreferenser. |

Totalt **93 filer, 129 504 739 byte (cirka 123,5 MiB)**. Alla fanns i
föregående commit `f31b219e4d0f751a81caa2db75c9d824be8e8926` och kan
återställas som specifika mappar därifrån. Inga ignorerade eller ospårade
filer låg i de två målen. Aktiva dokumentationslänkar till 3D-kvittona går
nu till den bevarade Git-versionen. Äldre handoffreferenser är daterad
proveniens. Raderingen minskar arbetskopian och kommande rot-Dockerkontext,
men krymper inte befintlig Git-historik.

`web/public/dealers/` är faktiskt publicerad mediebank och behölls.
`web/public/review/astrid-seam-repair/` behölls eftersom den versionsatta
V2-releaseförteckningen refererar dess enskilda filer. Redigerbara Blender-
källor och exporter under `assets/astrid-3d/` och
`assets/blackjack-3d/editable-project/` behölls, liksom originalfiler,
leverantörskvitton och återbyggnadsunderlag i `content/staging/`.
Deras storlek gör dem inte till återskapningsbar cache. Ingen aktiv media,
avatar, modellvikt, kalibrering eller manifest ändrades.
Den avvisade ersättningsstudien
`content/staging/2026-09-11/astrid-replacement/` är ensam cirka 559 MiB men
innehåller unika leverantörsoriginal, kvitton och återbyggnadsunderlag.
Automatisk godkännandekontroll avvisade radering av denna grupp; den är
orörd och kräver ett separat uttryckligt beslut om originalfilerna.

Verifiering: 41 relativa länkar i de fem berörda Markdownfilerna har inga
brutna mål. `audit-dealer-sync --probe` matchade alla fyra dealerbaslinjer.
Tre skinnkontaktprov och `blackjack-asset-state` passerade; `git diff --check`
passerade. Detta är teknisk regression, inte ny visuell acceptans.


## Systemkarta och lagringsstorlek, 28 september 2026

Den aktiva systemkartans 16 spårade Markdownfiler (cirka 151 KiB) flyttades
från `random-stuff-jakob/jakob-docs/systemkarta/` till
[`docs/systemkarta/`](systemkarta/README.md), med samma sex ämnesgrenar.
Aktiva interna och inkommande länkar uppdaterades. Den gamla 956-byte
`jakob-docs/README.md`-vägvisaren togs bort; den finns i `Jakobs-v1`.
Den kan återställas riktat från `Jakobs-v1`. Kartutgåvan finns även i Git före
flytten (`7fba41d`). Historiska handoffnotiser behåller sina dåvarande
filnamn. Privata/ignorerade filer i `random-stuff-jakob/` flyttades inte,
och den lokala mappen kan därför fortfarande finnas kvar. Personarkivet
undersöktes inte.

Storlek på spårade filer i arbetskopian, avrundad MiB: `content/staging/`
2 075, `assets/astrid-3d/` 563, `web/public/` 531,
`assets/blackjack-3d/` 220, `emil/dealklipp-v1/` 126 och
`emil/astrid-demo-v3-reference/` 63. `content/bake/` är ytterligare 50 MiB.
Staging innehåller källor, prov och återbyggnadsunderlag; produktmedia och
manifester i `web/public` och Emils aktiva bank har direkta beroenden.
Rotens `.dockerignore` utesluter redan staging, bake och V3-referensen från
den planerade containerkontexten. Att flytta Emils aktiva träd skulle kräva
ändringar i manifest, schema, labb, tester och molnkontext utan att minska
antalet byte. Dess undermappar `deal/`, `idle/` och `repliker/` är kvar.

MP4-stickprov med gzip nivå 9 gav −0,01 % respektive +0,06 % minskning
(aktivt deal-klipp respektive V3-dealklipp). Förlustfri packning sparar alltså
praktiskt taget inget i dessa exempel. Omkodning skulle ändra hashvärden och
kräva ny visuell acceptans; ingen video eller bild ändrades. De 260 Emil-MP4
saknade exakta dubletter enligt föregående SHA-256-kontroll.

Verifiering: 390 relativa länkar i 33 berörda Markdownfiler kontrollerades
utan brutna mål; `git diff --check` passerade. Ingen server, GPU eller betald
tjänst startades.

## Referensmappar och Emil-media, 28 september 2026

En andra avgränsad omgång tog bort 7 spårade filer, 2 056 589 byte:
alla sex `reference/sunny-*` (2 055 354 byte) och den daterade
`random-stuff-jakob/croupier-observation-2026-09-21T00-07-56-650Z.json`
(1 235 byte). `reference/` innehöll inga videor. Enda kodhänvisningen var
en schemakommentar i `pipeline/build-index.mjs`; schemat står nu direkt där.
Inga tester, byggskript eller aktiva dokument läste filerna. Alla sju
kontrollerades i taggen `Jakobs-v1` före radering. Läs en tidigare fil med
`git show Jakobs-v1:<sökväg>` eller återställ just den filen från taggen.

[Emils vägvisare](../emil/README.md) beskriver två skilda samlingar:
`dealklipp-v1` är aktiv med 43 MP4 och manifestberoenden i kod och tester;
`astrid-demo-v3-reference` är ett inaktivt men sammanhängande referenspaket
med 217 MP4, flerspråkiga talbanker, eget manifest och demoexempel.
SHA-256-jämförelse av de 260 MP4-filerna hittade **inga identiska videor**.
Endast V3:s startbild är byteidentisk med den aktiva bankens startbild
(1 628 428 byte); V3-manifestet refererar den lokala kopian. Ingen av de två
mediesamlingarna ändrades. En delradering av V3:s filmer skulle bryta dess
manifest och försvåra framtida jämförelse av exakta tal/takes.

`docs/systemkarta/` är fortsatt aktiv dokumentation.
De nio små textutdragen i `jakob-log-files/` är Git-ignorerade och har
historiska dokumentationshänvisningar; de lästes eller raderades inte.
Det pensionerade privata arkivet inventerades inte. De större MP4-grupperna
`content/staging/` och `web/public/` har medie-/testberoenden och ingick inte
i denna raderingsomgång.

Verifiering: V3-manifestets 218 lokala mediereferenser finns kvar; fyra
ändrade Markdown-filer har inga brutna relativa länkar. Aktivt labbmanifest
verifierade 43 objekt i 26 familjer, dess sju riktade tester passerade,
`git diff --check` passerade och hela `.githooks/pre-commit` avslutades med
status 0. Detta är fil-/regressionskontroll, inte ny visuell mediaacceptans.

## Avgränsad omgång efter `e03b5d0`, 28 september 2026

28 spårade filer, sammanlagt 151 085 byte (cirka 147,5 KiB), togs bort:

- 22 V3/V4-plan- och beslutsfiler under `docs/animation-events/` (111 995
  byte). V5 är aktiv källa; den gamla publiceringskoden läser uttryckligen V5.
  Aktiva länkar till specifika V3-fakta pekar nu på `Jakobs-v1`.
- `random-stuff-jakob/astrid_motorklipp.txt`, en daterad JSON-inventering
  utan kod-, test- eller byggreferenser. Systemkartans historiska hänvisning
  pekar nu på [bevarad Git-version](https://github.com/Jakeminator123/github-work/blob/Jakobs-v1/random-stuff-jakob/astrid_motorklipp.txt).
- Engångsprompten `ASTRID-2D-AVATAR-PACK-PROMPT.md`, gamla
  `docs/shared/AGENT-HANDOFF.md` och `GITLAB-ISSUE-TILL-KEVIN.md` samt två
  Cursor-regler som bara gällde den pensionerade `jakeminator123/work`.

Filnamnsreferenser i kod, tester, byggskript och aktiva dokument kontrollerades
före radering. Alla 28 filer verifierades i taggen `Jakobs-v1` och kan läsas
med `git show Jakobs-v1:<sökväg>` eller återställas därifrån vid ett riktat
behov. Äldre handoffavsnitt får stå kvar som daterad proveniens.
Startvägen i systemkartan och presentationsplanen pekar nu till GitHub/V5.

Importerade `services/astrid-gpu-worker/.gitlab-ci.yml` och dess gamla
deployexempel är inaktiva i Croupiers GitHub-flöde. De behålls som källhistorik
medan den befintliga RunPod-endpointen enligt tidigare driftskontroll fortfarande
hämtar från `registry.gitlab.com`; ingen ny livekontroll eller extern ändring
gjordes här. Worker-/gatewaykod, avatarer, mediemanifest, kalibreringar,
modellvikter, privata data, `.env`, ignorerade filer och aktiva byggmappar
bevarades. Det pensionerade privata arkivet undersöktes inte.

Verifiering i denna omgång: 13 ändrade Markdown-filer kontrollerades för
relativa länkar (inga brutna), `git diff --check` passerade och hela
`.githooks/pre-commit` avslutades med status 0. Medieauditens 43 objekt i
26 familjer matchade baslinjen; detta är ingen ny visuell läppsynkacceptans.
Inga produktservrar eller betalda tjänster startades.

## Uppföljning: uttryckligen godkänd radering 28 september

Jakob godkände att hela `.croupier-inbox/` raderades, även privata utkast,
QA-underlag och checkpoints. 153 filer, 14 380 284 byte, togs bort permanent.
Mappen var Git-ignorerad: dessa filer återställs INTE med `Jakobs-v1`.
Ingen kopia av innehållet har lagts i Git eller flyttats till ett nytt arkiv.
Chef-registret var inaktivt före radering; pausad inboxkontroll behöver inte
mappen och ska inte återskapa den automatiskt.

Ytterligare borttaget lokalt, återskapningsbart eller pensionerat material:

- `lab/.next-probe/`: 280 genererade filer, 160 079 054 byte.
- `lab/tsconfig.probe.json`: genererad testkonfiguration, 762 byte.
- `lab/tsconfig.tsbuildinfo`: TypeScript-cache, 226 199 byte.
- `.cursor/ping-croupier-seen.json`: pensionerad läsmarkering, 91 byte.

Totalt cirka 166,6 MiB ignorerade lokalfiler. Node-processkontrollen visade
ingen aktiv Next-server eller Next-build före radering. `lab/.next` och
`lab/node_modules` lämnas kvar för de pågående agenternas bygg- och
regressionskontroller. Spardata, miljöfiler, credentials och aktiv media
är orörda. Det privata personarkivet har inte inventerats.

39 spårade filer har också tagits bort: den gamla GitLab-MR-mallen,
`docs/PROJECT-PROMPT.md`, de 12 filerna i
`docs/animation-events/archive/v2-long-term-goal-best-rng/` och de 25 filerna
i `open-claw/archive/`. De saknade kod-/test-/byggberoenden och finns kvar
i `Jakobs-v1`. Aktiva dokumentationslänkar pekar nu på checkpointens GitHub-
kopior; historiska handoffposter är oförändrade. Inga aktiva spel-, kamera-
eller probe-instruktioner har tagits bort.

Avsnitten nedan beskriver den tidigare, försiktigare inventeringen; denna
uttryckliga radering ersätter deras beslut att bevara inbox och gamla arkiv.

Inventering och avgränsad städning den 28 september 2026. Aktuella ingångar
är [Lissabon](../lissabon/README.md), [guiden](../lab/docs/README.md),
[presentationsplanen](animation-events/README.md) och
[systemkartan](systemkarta/README.md).

## Borttagna engångsuppdrag och återställning

Fyra äldre agentprompter har tagits bort från arbetsversionen. De innehöll
daterade uppdrag, brancher och publiceringsinstruktioner. Alla finns kvar i
checkpoint-taggen `Jakobs-v1`, commit
`600093e4522efc57bd82979cff65492a528ffeb7`.

| Tidigare sökväg | Storlek i lokal arbetskopia | Bevarad version |
| --- | ---: | --- |
| `lab/docs/PARALLEL-DOCS-WIKI.md` | 8 043 byte | [GitHub-checkpoint](https://github.com/Jakeminator123/github-work/blob/Jakobs-v1/lab/docs/PARALLEL-DOCS-WIKI.md) |
| `lab/docs/PARALLEL-EVENTSTUDIO-UI.md` | 3 964 byte | [GitHub-checkpoint](https://github.com/Jakeminator123/github-work/blob/Jakobs-v1/lab/docs/PARALLEL-EVENTSTUDIO-UI.md) |
| `lab/docs/PARALLEL-OPENCLAW-SPEECH.md` | 2 195 byte | [GitHub-checkpoint](https://github.com/Jakeminator123/github-work/blob/Jakobs-v1/lab/docs/PARALLEL-OPENCLAW-SPEECH.md) |
| `docs/PROJECT-HANDOVER-PROMPT.md` | 8 587 byte | [GitHub-checkpoint](https://github.com/Jakeminator123/github-work/blob/Jakobs-v1/docs/PROJECT-HANDOVER-PROMPT.md) |

Totalt: 22 789 byte. Historiska hänvisningar i `JOHN-HANDOFF.md` till dessa
filer avser de bevarade versionerna ovan och går att återställa från taggen.
Äldre handoff-text har inte skrivits om som del av städningen. Exempel för
att läsa en tidigare fil utan att ändra arbetskopian:

```sh
git show Jakobs-v1:lab/docs/PARALLEL-DOCS-WIKI.md
```

## Inventering och bevarat material

Storlekarna nedan kommer från filmetadata för spårade filer före städningen.
De mäter arbetskopians filinnehåll, inte Git-historik eller ett färdigt
deploymentpaket. MiB betyder 1 048 576 byte.

| Område | Uppmätt storlek | Beslut |
| --- | ---: | --- |
| `content/staging/` | 2 075 MiB | Bevaras: original, pipelineunderlag och testberoenden. |
| `assets/` | 837 MiB | Bevaras: modeller, källmaterial och testberoenden. |
| `web/` | 531 MiB | Bevaras: produktkod och media. |
| `emil/` | 189 MiB | Bevaras: Lissabons aktiva mediefamiljer och referenser. |
| `docs/animation-events/v3-9-days-mvp/` och `v4-8-days-mvp/` | 109 KiB | Bevaras tills kvarvarande aktiva hänvisningar har uppdaterats. |
| `docs/animation-events/archive/` | 205 KiB | Bevaras som daterat underlag. |
| `open-claw/archive/` | 243 KiB | Bevaras som beslutshistorik. |

Hela den inventerade spårade arbetskopian var cirka 3 836 MiB. Radering av
små dokument minskar främst mängden inaktuella instruktioner. Molnpaketering
behöver en egen avgränsning för stora arbets- och granskningsfiler.

Konkreta beroenden som hindrar bred radering:

- `test/dealer-reach.mjs` läser
  `content/staging/2026-09-13/per-seat-video/targets.json`; testet ingår i
  pre-commit-kontrollerna.
- Ansiktspipeline använder original och metadata i
  `content/staging/2026-09-10/astrid-head-v2/`.
- Tester och pipeline använder `assets/blackjack-3d/profile.json` och
  källmodeller under `assets/astrid-3d/`.
- Delar av `web/public/review/` refereras av mediemanifest. Namnet
  "review" visar därför inte att en fil saknar runtimeberoenden.

## Lokal inbox

`.croupier-inbox/` är Git-ignorerad. Endast riktad filmetadata granskades;
privata meddelanden, råa API-svar och hemligheter publicerades inte.

Identiteter och läscursors i `agents/`, cache i `shared/`, checkpoints,
meddelandeutkast, handoff-patchar och privata QA-/medieinventeringar bevaras.
De har återställnings- och samordningsvärde. De kontrollerade
nedladdningsmapparna under `windows-tests/` innehöll små hash-, signatur-
och verifieringsfiler. Inget i inboxen raderades.

Det pensionerade privata personarkivet har inte lästs, indexerats eller
återställts. Privata miljöfiler och sparade spel-/labbdata lämnas kvar.

## Brancher och worktrees

Vid inventeringen var `codex/cyberpunk-lab-dashboard`, `codex/emil`,
`codex/inbox-routing-cache`, `codex/ny-gren-lipsynk-emil` och
`codex/ska-hämta-lipsync` redan införlivade i checkpoint-committen.
De två sistnämnda pekade båda på `e680dac`. De fyra lokala brancherna
`codex/cyberpunk-lab-dashboard`, `codex/emil`, `codex/ny-gren-lipsynk-emil`
och `codex/ska-hämta-lipsync` togs därefter bort med `git branch -d` efter
kontroll att ingen worktree använder dem. Deras commits finns kvar i
arbetsbranchens historik och v1-checkpointen; inga fjärrbrancher raderades.

Den extra arbetskopian `inbox-publish` på `codex/inbox-routing-cache`
var ren och stod på `e056dc1`. Detta bevisar inte att ingen chatt eller
process använder den. Processkontrollen kunde inte genomföras på grund
av OS-behörighet. Den worktreen och dess branch lämnas kvar tills ägande
och aktivitet är klarlagda. Den är inte bifogad den här chatten för arkivering.

## Verifiering

Checkpointens commit-ID och förekomsten av de fyra filerna i taggen
kontrollerades. Sökning efter filnamnen hittade historiska hänvisningar
i handoffen; inga körande kodberoenden identifierades för de borttagna
prompterna. Endast dokumentationsfiler ändrades. Gameplay-, medie- och
driftkontroller ingår därför inte i denna städning.
