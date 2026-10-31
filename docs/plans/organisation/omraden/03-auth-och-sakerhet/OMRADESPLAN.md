# Områdesplan: Auth och säkerhet

Behålla behörighet och bolagsisolering, rätta konkreta cookiefel och göra säkerhetsbevisens täckning tydlig.

## Gräns och befintliga källor

`packages/studio-access`, apparnas cookie/sessiontransport och säkerhetsverktyg. Ändra inte spelregler eller namn på levande sessionskontrakt som bieffekt.

- [packages/studio-access/README.md](../../../../../packages/studio-access/README.md)
- [docs/ENVIRONMENT-VARIABLES.md](../../../../ENVIRONMENT-VARIABLES.md)

## Nivåer

| Nivå | Inriktning |
| --- | --- |
| A | Secure på preview_session och färsk säkerhetsläsning. |
| B | Gemensamma säkerhetsstandarder med appens avsiktliga sessionsskillnader kvar. |
| C | Nytt auth-system endast vid separat belagt behov; ingen sådan migration beställs här. |

## Aktiviteter

Status, ägare, beroenden och bevis finns bara i respektive aktivitetsfil.

| Aktivitet | Fas / nivå | Resultat |
| --- | --- | --- |
| [SEC-01](aktiviteter/SEC-01.md) | 1 / A | Säkra preview-sessionens cookie |
| [SEC-02](aktiviteter/SEC-02.md) | 2 / B | Dela cookiepolicy utan att blanda sessioner |
| [SEC-03](aktiviteter/SEC-03.md) | 1 / A | Verifiera säkerhetstäckning och historikgap |

## Tilldelning

MERGEAGENTEN avgränsar nästa aktivitet mot färsk main och öppna PR:er. En agent äger en ändringsyta i taget; delade filer bokas innan skrivning. Läs [arbetssättet](../../ARBETSSATT.md) för brief, status och nya fynd. Slutförda delar i äldre sakplaner genomförs inte igen.
