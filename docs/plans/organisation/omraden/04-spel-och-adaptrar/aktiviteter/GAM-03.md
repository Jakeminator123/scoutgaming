# GAM-03: Fastställ processlokalt tillstånd och idempotensbehov

- Status: **PLANERAD**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 2. Nivå: B. Prioritet: P2.
- Beroenden: [DOC-03](../../01-repo-och-dokument/aktiviteter/DOC-03.md)
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

Studio decision-cache, rumschatt och bildkvot är processlokala. Motorn har redan Postgres-kvitton och speech-journal; de har olika garantier.

## Utförande

Dokumentera vilka data som måste överleva restart/scale-out och vilka som medvetet får vara flyktiga. Återanvänd befintlig journal där den passar. Ny ledger eller Redis kräver ett konkret saknat kontrakt, inte en allmän skalningsidé.

## Klart när

Riktade två-instans-/retryprov för det kontrakt som ändras; samma request med annat innehåll behåller 409 där det gäller. Kvotens lokala räknare presenteras inte som global kostnadsgräns.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: M15; F-14; E-07. Se [underlagsregistret](../../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../../ARBETSSATT.md).
