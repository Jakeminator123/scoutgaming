# GEM-02: Miljöinventering utan att läsa eller ändra hemligheter

- Status: **PLANERAD**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 1. Nivå: A. Prioritet: P1.
- Beroenden: Inga andra aktiviteter; färsk bas och rätt mandat krävs vid tilldelning.
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

Två produktmiljöer finns med separata Neon/Blob/engine-identiteter. Tidigare nyckelseparering och borttagningar får inte göras om från äldre rapporter.

## Utförande

Jämför env-namn, krav, källkodskonsument och leverantörernas metadata per tjänst mot befintligt environment-variables.json. Skilj panelOnly/blocked/legacy från döda alias. Rapportera luckor och förbered ändringar i samma leverans som båda befintliga env-guiderna; inga värden eller env-skrivningar i inventeringen.

## Klart när

check-environment-variables passerar; varje förslag visar vilken konsument som ersatts och eventuell deployeffekt/återställning. Preview/prod/origin/provideridentitet kan inte tyst blandas.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: M02/M03/M07/M09; F-17/F-20; S14. Se [underlagsregistret](../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../ARBETSSATT.md).
