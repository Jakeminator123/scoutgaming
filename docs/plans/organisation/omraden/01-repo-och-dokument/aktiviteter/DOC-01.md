# DOC-01: Rätta dokumentdrift från aktuell kod

- Status: **PLANERAD**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 1. Nivå: A. Prioritet: P1.
- Beroenden: Inga andra aktiviteter; färsk bas och rätt mandat krävs vid tilldelning.
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

Färsk main har den nya handoffen; externa slutrapportens master-berättelse är fel. Node 22/preview/F11/aktivering och branchskydd beskrivs olika i äldre guider.

## Utförande

Jämför aktuella ingångar med manifest, kod och molnbevis. Rätta bara belagda fel i befintliga guider, inklusive ruleset-text och skillnaden inspelat/genererat/moving. Behåll daterade incidentmätningar som daterade bevis.

## Klart när

Alla ändrade länkar finns; Node hämtas från manifest; ingen text påstår att F11-kod saknas, preview saknar isolering eller master är produktgren. Dokumenthook/CI passerar.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: M07/M11/M12/M13/M14/M21/M22/M24; S14. Se [underlagsregistret](../../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../../ARBETSSATT.md).
