# Områdesplan: Tal och AI

En korrekt, avbrytbar dealer-generisk talkedja med kontrollerade providergränser. Jakob-2/moving/GPU hålls pausat enligt aktuell handoff.

## Gräns och befintliga källor

`packages/presentation`, `packages/director`, `services/game/*speech*`, `services/openclaw/lab`, `apps/speech`. Boka delade spel-/publiceringsfiler; byt inte den pinnade Gateway-imagen tyst.

- [docs/plans/TALKEDJA.md](../../../TALKEDJA.md)
- [docs/AI/openclaw/README.md](../../../../AI/openclaw/README.md)
- [docs/LOCAL-PRESENTATION-RUNTIME.md](../../../../LOCAL-PRESENTATION-RUNTIME.md)
- [docs/TALKEDJA-RUNPOD.md](../../../../TALKEDJA-RUNPOD.md)

## Nivåer

| Nivå | Inriktning |
| --- | --- |
| A | Kontrollera provideridentiteter, JSON-kontrakt och Slack-restpunkt. |
| B | Generated speech, avbrott och tillgänglighet utan felkoppling till spelet. |
| C | Egen failure-domain/process efter kontrakts- och driftbeslut. |

## Aktiviteter

Status, ägare, beroenden och bevis finns bara i respektive aktivitetsfil.

| Aktivitet | Fas / nivå | Resultat |
| --- | --- | --- |
| [TAL-01](aktiviteter/TAL-01.md) | 2 / B | Generated speech vid delat bord med aktuellhetskontroll |
| [TAL-02](aktiviteter/TAL-02.md) | 2 / B | Isolera talfel från spelstart utan öppen fallback |
| [TAL-03](aktiviteter/TAL-03.md) | 2 / A | Verifiera röst-, bank- och miljöidentiteter |
| [TAL-04](aktiviteter/TAL-04.md) | 3 / C | Besluta om tal utanför spelprocessen |
| [TAL-05](aktiviteter/TAL-05.md) | 2 / A | Avgränsa Slack-restpunkt och verifiera minsta åtkomst |

## Tilldelning

MERGEAGENTEN avgränsar nästa aktivitet mot färsk main och öppna PR:er. En agent äger en ändringsyta i taget; delade filer bokas innan skrivning. Läs [arbetssättet](../../ARBETSSATT.md) för brief, status och nya fynd. Slutförda delar i äldre sakplaner genomförs inte igen.
