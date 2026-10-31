# Områdesplan: Toolchain och CI

Reproducerbar installation, rätt runtime-/typpaket och relevanta tester utan onödig regressionskostnad.

## Gräns och befintliga källor

`apps/*/package.json`, lockfiler, CI-/hookverktyg. En skrivare per lockfil/workflow; ändra inte produktbeteende i versionsstädning.

- [docs/plans/VERKTYGSKEDJA.md](../../../VERKTYGSKEDJA.md)
- [.github/workflows/croupier.yml](../../../../../.github/workflows/croupier.yml)
- [tools/precommit-checks.mjs](../../../../../tools/precommit-checks.mjs)

## Nivåer

| Nivå | Inriktning |
| --- | --- |
| A | Rätta konkreta manifest-/typmismatchar i separata steg. |
| B | Medveten policy för Node/Next/React/TS och pakethanterare. |
| C | Gemensamt workspace/bygge bara efter jämförelse med dagens kostnad och risk. |

## Aktiviteter

Status, ägare, beroenden och bevis finns bara i respektive aktivitetsfil.

| Aktivitet | Fas / nivå | Resultat |
| --- | --- | --- |
| [CI-01](aktiviteter/CI-01.md) | 1 / A | Rätta runtime- och typmismatchar avgränsat |
| [CI-02](aktiviteter/CI-02.md) | 2 / B | Välj och inför en versions-/testpolicy stegvis |
| [CI-03](aktiviteter/CI-03.md) | 3 / C | Besluta om workspace och större byggförenkling |
| [CI-04](aktiviteter/CI-04.md) | 1 / A | Verifiera skydd mot stora mellanliggande Git-objekt |

## Tilldelning

MERGEAGENTEN avgränsar nästa aktivitet mot färsk main och öppna PR:er. En agent äger en ändringsyta i taget; delade filer bokas innan skrivning. Läs [arbetssättet](../../ARBETSSATT.md) för brief, status och nya fynd. Slutförda delar i äldre sakplaner genomförs inte igen.
