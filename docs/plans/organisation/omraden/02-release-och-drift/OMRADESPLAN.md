# Områdesplan: Release och drift

Knyta kod, faktisk driftsättning och återställning till rätt miljö. Backendens tomt-bord-regel gäller tills GAM-01 har verifierat F11.

## Gräns och befintliga källor

`ops/cloud/`, återställningsguiden, releaseverktyg. Workflow och env-register delas inte med andra skrivare; bokas av MERGEAGENTEN.

- [START-HERE.md](../../../../../START-HERE.md)
- [docs/ENVIRONMENT-RESTORATION.md](../../../../ENVIRONMENT-RESTORATION.md)
- [ops/cloud/RENDER-V3.md](../../../../../ops/cloud/RENDER-V3.md)

## Nivåer

| Nivå | Inriktning |
| --- | --- |
| A | Läsande versions-/hälsokvitto och backupgap. |
| B | Återställning och same-release-bedömning genom hela kedjan. |
| C | Begränsad releaseautomation efter acceptans av driftvillkoren. |

## Aktiviteter

Status, ägare, beroenden och bevis finns bara i respektive aktivitetsfil.

| Aktivitet | Fas / nivå | Resultat |
| --- | --- | --- |
| [REL-01](aktiviteter/REL-01.md) | 1 / A | Läsande releasekvitto med resurs och kodomfång |
| [REL-02](aktiviteter/REL-02.md) | 1 / B | Återställningsbevis för Neon och Render-state |
| [REL-03](aktiviteter/REL-03.md) | 3 / C | Besluta om begränsad releaseautomation |
| [REL-04](aktiviteter/REL-04.md) | 1 / A | Avsiktlig previewrevision inför acceptansprov |

## Tilldelning

MERGEAGENTEN avgränsar nästa aktivitet mot färsk main och öppna PR:er. En agent äger en ändringsyta i taget; delade filer bokas innan skrivning. Läs [arbetssättet](../../ARBETSSATT.md) för brief, status och nya fynd. Slutförda delar i äldre sakplaner genomförs inte igen.
