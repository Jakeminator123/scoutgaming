# TAL-02: Isolera talfel från spelstart utan öppen fallback

- Status: **PLANERAD**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 2. Nivå: B. Prioritet: P1.
- Beroenden: [GEM-02](../../../gemensamt/aktiviteter/GEM-02.md)
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

Moving aktiverat utan bank kan kasta före motorns listen. Fail-closed talkontrakt får inte ersättas av godtycklig dealer eller bank.

## Utförande

Pröva en explicit modell där spel kan vara tillgängligt medan felkonfigurerat tal nekas med tydlig status. Bevara bank-/hash-/profilkontroller och mät providerdeadline/retry. Beskriv skillnaden felaktig obligatorisk spelkonfig och valfritt tal.

## Klart när

Bank saknas/fel dealer/fel origin/provider-timeout ger inget ogodkänt tal och kan inte påverka kort/saldo. Spelstart/health visar avsedd degradering. Ingen global reservröst/-bank införs.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: M02; E-02; S14; TALKEDJA T8. Se [underlagsregistret](../../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../../ARBETSSATT.md).
