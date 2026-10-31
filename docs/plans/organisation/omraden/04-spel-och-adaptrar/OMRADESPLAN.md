# Områdesplan: Spel och adaptrar

Färre anropsvägar runt en serverauktoritativ regelkärna. Regler, slump, sko, kort och beräkning av spelutfall ändras inte av städningen.

## Gräns och befintliga källor

`services/game` runt regelkärnan, `packages/presentation` och levande konsumenter i Admin/partner. Delat paket bokas med TAL/ADM innan skrivning.

- [services/game/README.md](../../../../../services/game/README.md)
- [docs/games/blackjack/README.md](../../../../games/blackjack/README.md)
- [docs/plans/KEVIN-PORT.md](../../../KEVIN-PORT.md)

## Nivåer

| Nivå | Inriktning |
| --- | --- |
| A | Fastställ kvarvarande konsumenter och F11:s faktiska acceptansgap. |
| B | F11-driftprov och selektiv adapter-/tillståndskonsolidering. |
| C | Större backenduppdelning endast efter bevisad vinst; talprocessen ägs av TAL-04. |

## Aktiviteter

Status, ägare, beroenden och bevis finns bara i respektive aktivitetsfil.

| Aktivitet | Fas / nivå | Resultat |
| --- | --- | --- |
| [GAM-01](aktiviteter/GAM-01.md) | 1 / B | F11: verifiera restart och återanslutning i drift |
| [GAM-02](aktiviteter/GAM-02.md) | 2 / B | Konsolidera levande speladaptrar stegvis |
| [GAM-03](aktiviteter/GAM-03.md) | 2 / B | Fastställ processlokalt tillstånd och idempotensbehov |

## Tilldelning

MERGEAGENTEN avgränsar nästa aktivitet mot färsk main och öppna PR:er. En agent äger en ändringsyta i taget; delade filer bokas innan skrivning. Läs [arbetssättet](../../ARBETSSATT.md) för brief, status och nya fynd. Slutförda delar i äldre sakplaner genomförs inte igen.
