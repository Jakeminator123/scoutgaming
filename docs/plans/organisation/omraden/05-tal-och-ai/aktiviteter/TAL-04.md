# TAL-04: Besluta om tal utanför spelprocessen

- Status: **VANTAR_BESLUT**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 3. Nivå: C. Prioritet: P2.
- Beroenden: [TAL-01](TAL-01.md), [TAL-02](TAL-02.md), [REL-02](../../02-release-och-drift/aktiviteter/REL-02.md)
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

Taladaptrar delar fortfarande motorprocess. T8 i befintlig plan beskriver möjlig isolering; inget generellt förbud gäller services/game.

## Utförande

Jämför minsta felisolering med separat tjänst: API-/strömkontrakt, autentisering, deadlines, kötryck, kostnad, drift och återgång. Välj mätbar nytta före ny tjänst. Spelservern äger fortfarande alla spelutfall.

## Klart när

Nedstängd/långsam talprovider stoppar inte spel eller låser pengatransaktioner; rätt scope och avbrott fungerar. Om tjänst skapas krävs särskilt drift-/kostnadsmandat och end-to-end-kvitto.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: E-02; S14; TALKEDJA T8. Se [underlagsregistret](../../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../../ARBETSSATT.md).
