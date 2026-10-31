# ADM-03: Verifiera partnerwalletens gräns och bolagssteg

- Status: **PLANERAD**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 2. Nivå: B. Prioritet: P1.
- Beroenden: [DAT-01](../../07-data-och-media/aktiviteter/DAT-01.md)
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

Valuta/reservationer är rättade genom #708/#711 och multi-spot genom #714. Intern demowallet är stödd; extern wallet är fortsatt blockerad. NYCKEL-BOLAG/STEG-F har egna beroenden/beslut.

## Utförande

Stäm av kvarvarande partnerlöften och genomförda nyckel-/spelare-bolagsteg mot kod/schema. Skapa inga nya penningadaptrar utan fastställt partnerkontrakt. Bryt vid behov ut en kvarstående uppgift som följer tolerant kod → godkänd migrering → krav.

## Klart när

Dokumenterad demowallet motsvarar API-beteendet; valuta, settlement och negativ bolagsisolering har relevanta bevis. Ingen real-money-acceptans hävdas från CI eller rättad valuta.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: M05; G4-43; S12/S13; NYCKEL-BOLAG/STEG-F. Se [underlagsregistret](../../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../../ARBETSSATT.md).
