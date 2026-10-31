# REL-01: Läsande releasekvitto med resurs och kodomfång

- Status: **PLANERAD**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 1. Nivå: A. Prioritet: P1.
- Beroenden: Inga andra aktiviteter; färsk bas och rätt mandat krävs vid tilldelning.
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

Vercel och Render har separata deployer. Helt olika SHA behöver inte betyda olika runtimekod; aktuell diff till motorn är endast handofftext.

## Utförande

Återanvänd health/version och leverantörsmetadata för ett litet kvitto per miljö: mål-main, faktisk SHA/deploy-ID per tjänst, CI-head/bas, schema och ändrat kodomfång. Skilj dokumentdiff, runtimeavvikelse och blockerad läsning. Ingen deploy i detta steg.

## Klart när

Prova lika revision, dokument-only diff, relevant backenddiff och saknat/nekad metadata. Kvitto anger observationstid och kan inte deklarera atomär release från en ensam READY-signal.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: M04/M12/M22; F-04/E-08; S14. Se [underlagsregistret](../../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../../ARBETSSATT.md).
