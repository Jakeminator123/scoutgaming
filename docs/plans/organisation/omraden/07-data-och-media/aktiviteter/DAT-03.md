# DAT-03: Referensbaserad gallring med liten revisionskedja

- Status: **PLANERAD**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 2. Nivå: B. Prioritet: P2.
- Beroenden: [DAT-02](DAT-02.md), [REL-02](../../02-release-och-drift/aktiviteter/REL-02.md)
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

Historiska paket kan fortfarande behövas av låsta rum/pågående händer. Neonstorleken är liten; tabellstorlek eller tom tabell visar inte att den kan raderas.

## Utförande

Identifiera ej refererade revisioner/bytes och avtalad återställningsfrist separat från spel-/betalningshistorik. Återanvänd befintlig retention för chatt/probe. Följ REN-START för Astrid: radering går före arkiv enligt Jakobs beslut; skydda andra godkända original.

## Klart när

Läsande torrkörning visar exakta objekt, referenser, bytes och återställning. Aktiva/låsta konsumenter och samtidiga händer skyddas. Faktisk radering kräver befintligt uttryckligt mandat och verifierad backup.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: S12/S14; M20; REN-START; docs/storage/BLOB-NEON.md. Se [underlagsregistret](../../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../../ARBETSSATT.md).
