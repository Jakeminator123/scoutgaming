# Historik: raderade dokument

En rad per dokument som raderats ur `main` efter att dess uppgift var klar. Innehållet finns bara i Git; läs det med `git show <sha>:<sökväg>` (sha är den sista main-commit där filen fanns). Det här är en lista, inget arkiv: inga kopior av innehållet, ingen historikmapp. Ett dokument som raderas senare får en rad här i samma PR.

Hänvisningar i `migrering/status.json` (fältet `evidence`) och i kodkommentarer till sökvägar nedan gäller fortfarande; de pekar på Git-versionen.

## Raderade 29 oktober 2026

Alla fanns i `main` på `a05917c3a05f23963006fc4e778f9c4ac8bbadcf` (läs: `git show a05917c3:<sökväg>`). Migreringen var klar (20/20, O03 VERIFIED via #527) och ingen kod eller CI läste filerna.

| Datum | Fil | Vad det var | PR |
| --- | --- | --- | --- |
| 2026-10-21 | `migrering/kevin-ks-migrering/K01/K01-matris.md` | K01: urvals- och beroendematris över Kevins modul vid `5aa7ed10` (svar på #312) | #339 |
| 2026-10-22 | `migrering/kevin-ks-migrering/K04/K04-mappning.md` | K04: mappning committade händelser → presentation → exakta medier (kodens "K04-mappning G3" avser avsnitt G3 här) | #339 |
| 2026-10-22 | `migrering/kevin-ks-migrering/K05/K05-mappning.md` | K05: mappning Kevins media → Neon-id → Blob → paket (kodens "K05-mappning 4b" avser avsnitt 4b här) | #339 |
| 2026-10-27 | `docs/2026-10-27-K04-BROWSER-ACCEPTANCE.json` | Första webbläsarkvittot för K04 (spelklient från händelser) på kandidaten `cc415cd8` | #450 |
| 2026-10-27 | `docs/2026-10-27-K05-PRODUCTION-ACCEPTANCE.json` | K05: bindning av PAOW:s media i produktionens Neon och Blob på `cc415cd8` | #450 |
| 2026-10-27 | `docs/2026-10-27-K06-STAGING-ACCEPTANCE.json` | Första stagingkvittot för K06 (Admin till spel efter omstart) | #445 |
| 2026-10-27 | `docs/2026-10-27-K07-STAGING-ACCEPTANCE.json` | Första stagingkvittot för K07 (spelbeteenden och samtidighet) på `cc415cd8` | #450 |
| 2026-10-28 | `docs/2026-10-28-K04-BROWSER-RERUN-ACCEPTANCE.json` | K04-omprov 1 på `13aa5a01` | #459 |
| 2026-10-28 | `docs/2026-10-28-K04-BROWSER-RERUN-2-ACCEPTANCE.json` | K04-omprov 2 på `43b7404e`; Jakobs godkännande av PAOW:s 35 giv-, hål- och revealklipp (`visualApproval`, 01:55Z) | #475 |
| 2026-10-28 | `docs/2026-10-28-K04-BROWSER-RERUN-3-ACCEPTANCE.json` | K04-omprov 3 på `1f66245b` (före O02-frysningen) | #482 |
| 2026-10-28 | `docs/2026-10-28-K04-BROWSER-RERUN-4-ACCEPTANCE.json` | K04-omprov 4 på `6a158180` (efter #481) | #501 |
| 2026-10-28 | `docs/2026-10-28-K04-BROWSER-RERUN-5-ACCEPTANCE.json` | K04-omprov 5 på `689c690e` | #510 |
| 2026-10-28 | `docs/2026-10-28-K04-F3-F5-REVIEW.md` | Oberoende granskning av K04 F3–F5 (#478) och uppföljningen (#481) | #514 |
| 2026-10-28 | `docs/2026-10-28-K04-K05-REVIEW.md` | Oberoende granskning av K05-kvittot (#457) och K04-omprovet (#459) | #460 |
| 2026-10-28 | `docs/2026-10-28-K06-K07-REVIEW.md` | Oberoende granskning av K06- och K07-omproven (#470), med fyndet om materialbytande publicering under aktiv hand | #471 |
| 2026-10-28 | `docs/2026-10-28-K07-REVIEW.md` | Oberoende granskning av K07-kvittot (med K06 och K04) mot kandidaten `cc415cd8` | #456 |
| 2026-10-28 | `docs/2026-10-28-O02-ACCEPTANCE.json` | O02: acceptanskvitto för den frysta kandidaten `f3780593` (frysning, kedja, negativa prov, restore-replay) | #523 |
| 2026-10-28 | `docs/2026-10-28-O02-REVIEW.md` | O02: oberoende granskning av kandidaten `f3780593` | #523 |
| 2026-10-28 | `docs/2026-10-28-O03-RELEASE-ACCEPTANCE.json` | O03: releasekvitto för `5f5bc88d` (Vercel `dpl_DGRnRtHpVUrMz9V6kv8iXvbJYcJV`, Render `dep-dbgvog0ae00c73dgivq0`/`dep-dbgvsc5g1s2s73cdoqkg`, migrering 011, backupgren `backup-before-o03-20261028`, restoreprov S0 = S1, flaggan `CROUPIER_SHARED_TABLE_ENABLED=1`) | #527 |
| 2026-10-28 | `docs/2026-10-28-O03-REVIEW.md` | O03: oberoende granskning av releasekvittot, GODKÄND MED ANMÄRKNING | #527 |

## Tidigare raderingar

- `docs/history/` (överlämningar, körlistor och kvitton från före 28 oktober) raderades i `8ad45fbf` och `a90dde8d` (28 oktober 2026). Läs med `git show 29ed6626bf:docs/history/<fil>`; `git log --diff-filter=D -- docs/history` listar filerna.
- Admin-kartan från 22 oktober raderades i `61cf0ee8` när [ADMIN-KARTA](plans/ADMIN-KARTA.md) ersatte den.
