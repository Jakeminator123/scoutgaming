# TAL-01: Generated speech vid delat bord med aktuellhetskontroll

- Status: **PLANERAD**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 2. Nivå: B. Prioritet: P1.
- Beroenden: Inga andra aktiviteter; färsk bas och rätt mandat krävs vid tilldelning.
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

shared-room-presentation tillåter båda taltyper men spelar bara moving; generated saknar assertCurrent. Chattdistributionen emitterar bara moving.

## Utförande

Ge generated-vägen samma aktuella request-/mute-/disconnect-/nytt-svar-kontroll och auktoriserad distribution. Följ hela server → ingress → klientkedjan. Kodprov kan använda syntetisk ström; ingen GPU, bank eller talaktivering ingår.

## Klart när

Mute, bortkoppling, nyare svar, stale request och fel rum/bolag stoppar ljud/video. Giltigt svar distribueras en gång; textfallback består när tal inte är tillgängligt. Verklig läppsynk kräver separat AV-acceptans.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: M08; E-01; S12/S14. Se [underlagsregistret](../../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../../ARBETSSATT.md).
