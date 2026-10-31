# SEC-01: Säkra preview-sessionens cookie

- Status: **PLANERAD**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 1. Nivå: A. Prioritet: P1.
- Beroenden: Inga andra aktiviteter; färsk bas och rätt mandat krävs vid tilldelning.
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

services/game/server.mjs sätter preview_session utan Secure, medan andra sessionvägar har HTTPS-/produktionsvillkor.

## Utförande

Sätt Secure med samma avsedda miljö-/HTTPS-policy som relevant spelarsession; behåll HttpOnly, SameSite, livslängd och tokenlagring. Använd inte obetrodd forwarded-header som ny säkerhetsauktoritet.

## Klart när

Riktade prov verifierar HTTPS/produktion, lokal tillåten HTTP och befintlig sessionisolering. Bekräfta att previewlogin fortfarande går att använda över den publicerade TLS-vägen.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: M10; G3-25. Se [underlagsregistret](../../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../../ARBETSSATT.md).
