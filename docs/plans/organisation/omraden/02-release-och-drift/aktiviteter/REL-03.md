# REL-03: Besluta om begränsad releaseautomation

- Status: **VANTAR_BESLUT**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 3. Nivå: C. Prioritet: P2.
- Beroenden: [REL-01](REL-01.md), [GAM-01](../../04-spel-och-adaptrar/aktiviteter/GAM-01.md), [DAT-01](../../07-data-och-media/aktiviteter/DAT-01.md)
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

En same-SHA-gate kan hjälpa, men parallella moln gör inte en release atomär. Tomt-bord-regeln gäller före F11-acceptans.

## Utförande

Utforma efter kvittot en liten orkestrering som låser avsedd commit och respekterar schemaordning, tomt bord/drain, kompatibilitet och återgång. Bevara Vercels branchfilter. Läs exakt aktuell Render-API/tool-semantik före implementation; env-skrivning kan starta deploy.

## Klart när

Torrkörning visar vilka tjänster som måste deployas och varför. Fel CI/schema/aktivt bord/fel SHA stoppar. Ny deploy är inte klar förrän faktisk runtime och hälsa verifierats.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: M04; F-04; E-08; S14. Se [underlagsregistret](../../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../../ARBETSSATT.md).
