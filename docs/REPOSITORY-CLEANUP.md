# Repostädning inför GitHub-arbetet

Inventering och avgränsad städning den 28 september 2026. Aktuella ingångar
är [Lissabon](../lissabon/README.md), [guiden](../lab/docs/README.md),
[presentationsplanen](animation-events/README.md) och
[systemkartan](../random-stuff-jakob/jakob-docs/systemkarta/README.md).

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
