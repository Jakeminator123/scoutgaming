# Masterplan: avslutad

Migreringen "Kevins spelbeteenden in i mains produkt" är klar: alla 20 aktiviteter (J01–J10, K01–K07, O01–O03) är VERIFIED, O03 via #527 den 28 oktober 2026. Status står bara i [STATUS.md](STATUS.md), genererad från [status.json](status.json), som är enda statuskällan.

- **Nästa arbete** står i [NEXT-AGENT](../docs/NEXT-AGENT.md#efter-o03), inte här.
- **Raderingsreglerna** står i [AGENTS](../AGENTS.md#data-media-och-avveckling).
- **Hela planen** (aktivitetstabellen, beroendeordningen, kriterierna för O01–O03 och listan "Efter O03" som den såg ut vid avslutet) läses ur Git: `git show 6f2d8236:migrering/MASTERPLAN.md`. Radhänvisningarna i `tools/o02-receipt.mjs` (`MASTERPLAN.md:70` och så vidare) och avsnitten O02 och O03 i [O02-PLAN](../docs/plans/O02-PLAN.md) avser den versionen.
- **Aktivitetskriterierna** (J i `jakob-main-migrering/AKTIVITETER.md`, K i `kevin-ks-migrering/AKTIVITETER.md`) och underlagen `K01/O01-svar.md`, `K05/MAPPNINGSSYSTEM.md` och `K06-K07/K06-K07-forberedelse.md` är raderade; var de läses står i [HISTORIK](../docs/HISTORIK.md).

Kvar i `migrering/`, eftersom något levande läser eller pekar på dem:

| Fil | Läses av |
| --- | --- |
| `status.json`, `status.mjs`, `STATUS.md` | CI (`.github/workflows/croupier.yml`), pre-commit (`node migrering/status.mjs --check`), `tools/o02-receipt.mjs` |
| `kevin-ks-migrering/K04/K04-medie-fack.tsv` | Sökvägen och hashen är proveniens i `CATALOGUE_SOURCE` (`services/game/games/blackjack/presentation/media-catalogue.mjs:15`) och ingår i varje materialrevision; spelet läser den härledda `k04-media.tsv` (utan Astrids rader) bredvid modulen |
| `kevin-ks-migrering/K05/K05-matris.tsv` | `tools/k05-import-plan.mjs` (`DEFAULT_MATRIX`); hashen står i `apps/studio/lib/dealer-import-kevin-source-paow.json` |
