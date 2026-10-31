# SEC-02: Dela cookiepolicy utan att blanda sessioner

- Status: **PLANERAD**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 2. Nivå: B. Prioritet: P2.
- Beroenden: [SEC-01](SEC-01.md)
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

Policy ligger i studio-access, sessiontransport i apparna. Lax/Strict och bo_jwt/partner/player är avsiktligt skilda kontrakt.

## Utförande

Extrahera gemensamma säkra defaults och parametrisering där duplicering ger risk. Behåll signering, audience, scope, revoke/epok och apparnas avsiktliga skillnader. Byt inte namn på levande cookies som del av helpern.

## Klart när

Negativa prov per Admin/Partner/Player, fel bolag/roll/audience och sessionsutgång. Samma begäran får inte få utökad behörighet efter konsolidering.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: M16; F-12. Se [underlagsregistret](../../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../../ARBETSSATT.md).
