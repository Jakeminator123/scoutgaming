# Områdesplan: Admin och produkt

Göra den befintliga Admin-/partner-/spelarvägen tydlig, spelbar och konsekvent. Tidigare UX-fixar används som bas; materiallivscykeln genomförs under DAT-02.

## Gräns och befintliga källor

`apps/studio` med konsumenter i `apps/web` och navigation. Scope/revision/roomOverrides är bindande; skapa ingen ny parallell Admin.

- [docs/plans/ADMIN-FORENKLING.md](../../../ADMIN-FORENKLING.md)
- [docs/plans/DESIGNSYSTEM.md](../../../DESIGNSYSTEM.md)
- [docs/plans/PARTNERPORTAL-KONVERTERING.md](../../../PARTNERPORTAL-KONVERTERING.md)
- [docs/plans/STEG-F.md](../../../STEG-F.md)
- [docs/plans/NYCKEL-BOLAG.md](../../../NYCKEL-BOLAG.md)

## Nivåer

| Nivå | Inriktning |
| --- | --- |
| A | Skilj driftfel, dokumentdrift och kvarvarande produktval. |
| B | Publiceringskontrakt, roomConfig och avgränsade partner-/UX-steg. |
| C | Större sid-/appombyggnad endast om CI-03/produktbeslut visar nytta. |

## Aktiviteter

Status, ägare, beroenden och bevis finns bara i respektive aktivitetsfil.

| Aktivitet | Fas / nivå | Resultat |
| --- | --- | --- |
| [ADM-01](aktiviteter/ADM-01.md) | 2 / B | Samla kvarvarande publiceringskontrakt efter L3 |
| [ADM-02](aktiviteter/ADM-02.md) | 2 / B | Välj nästa avgränsade UX-/partnersteg |
| [ADM-03](aktiviteter/ADM-03.md) | 2 / B | Verifiera partnerwalletens gräns och bolagssteg |

## Tilldelning

MERGEAGENTEN avgränsar nästa aktivitet mot färsk main och öppna PR:er. En agent äger en ändringsyta i taget; delade filer bokas innan skrivning. Läs [arbetssättet](../../ARBETSSATT.md) för brief, status och nya fynd. Slutförda delar i äldre sakplaner genomförs inte igen.
