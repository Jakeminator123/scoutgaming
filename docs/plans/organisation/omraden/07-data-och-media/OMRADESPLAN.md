# Områdesplan: Data och media

Ett Neon-register, Blob för mediebytes och tydliga referens-/livscykelregler. Små databaser är inte ett skäl att radera historik.

## Gräns och befintliga källor

`packages/storage`, `packages/studio-registry`, `ops/neon-*`, dealer-/materiallivscykel. Ingen DDL eller produktionsradering i inventeringen.

- [docs/storage/BLOB-NEON.md](../../../../storage/BLOB-NEON.md)
- [docs/LOCAL-PRESENTATION-RUNTIME.md](../../../../LOCAL-PRESENTATION-RUNTIME.md)
- [docs/plans/REN-START.md](../../../REN-START.md)
- [docs/ENVIRONMENT-RESTORATION.md](../../../../ENVIRONMENT-RESTORATION.md)

## Nivåer

| Nivå | Inriktning |
| --- | --- |
| A | Läsande schema-/roll-/readinessunderlag. |
| B | Atomiskt materialbyte och referensbaserad retention. |
| C | Större datamodellbyte endast med separat beslut och tolerant övergång; Git-frågan hör till GEM-03. |

## Aktiviteter

Status, ägare, beroenden och bevis finns bara i respektive aktivitetsfil.

| Aktivitet | Fas / nivå | Resultat |
| --- | --- | --- |
| [DAT-01](aktiviteter/DAT-01.md) | 1 / A | Fastställ schemaledger och läsroller per miljö |
| [DAT-02](aktiviteter/DAT-02.md) | 2 / B | Materialbyte med atomisk påverkan per rum och bolag |
| [DAT-03](aktiviteter/DAT-03.md) | 2 / B | Referensbaserad gallring med liten revisionskedja |

## Tilldelning

MERGEAGENTEN avgränsar nästa aktivitet mot färsk main och öppna PR:er. En agent äger en ändringsyta i taget; delade filer bokas innan skrivning. Läs [arbetssättet](../../ARBETSSATT.md) för brief, status och nya fynd. Slutförda delar i äldre sakplaner genomförs inte igen.
