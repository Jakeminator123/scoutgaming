# DAT-01: Fastställ schemaledger och läsroller per miljö

- Status: **PLANERAD**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 1. Nivå: A. Prioritet: P1.
- Beroenden: [GEM-02](../../../gemensamt/aktiviteter/GEM-02.md)
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

Två miljöer och separata schemaledgrar finns. Preview-CI:s roll/kommentar behöver stämmas av; game-013 kan vara efterregistrering och inte saknade pengaposter.

## Utförande

Läs metadata för faktisk databas/branch/schema och båda ledgrar samt relevanta grants, utan person-/tokenvärden. Jämför tillåtna migreringar och readiness. Förbered minsta åtgärd för efterregistrering/läsroll om gap bekräftas; kör ingen DDL i inventeringen.

## Klart när

Konkreta versions-ID/checksummor/rollrättigheter och source/target anges. Separat previewsecret nekar prod-fallback. Eventuell migration följer granskning och Jakobs godkännande före kravhöjning.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: M09; F-16; S12/S14; aktuell NEXT-AGENT. Se [underlagsregistret](../../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../../ARBETSSATT.md).
