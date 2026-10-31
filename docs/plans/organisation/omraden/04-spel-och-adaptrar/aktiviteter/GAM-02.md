# GAM-02: Konsolidera levande speladaptrar stegvis

- Status: **PLANERAD**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 2. Nivå: B. Prioritet: P2.
- Beroenden: [ADM-01](../../06-admin-och-produkt/aktiviteter/ADM-01.md), [DAT-01](../../07-data-och-media/aktiviteter/DAT-01.md)
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

Native POST /api/table, Provspel, partner- och sparade rundor har levande konsumenter trots gemensam regelkärna.

## Utförande

Lista route → klient → tjänst → lagring → tester för varje adapter. Välj en konsument åt gången att ersätta; bevara återspelning och behörighet. Radera sedan exakt ersatt adapter med prov/dokument, inte hela services/game eller gamla namn.

## Klart när

Gammal konsument har verifierad ersättning; spel-/pengatransaktioner, requestId, återspelning och scope behåller beteendet. Ingen kvarvarande dynamisk import, route eller sparad konfiguration behöver det som raderas.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: M17/M20; F-09; E-09; S12/S14. Se [underlagsregistret](../../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../../ARBETSSATT.md).
