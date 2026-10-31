# GEM-01: Förstädning med bevis för varje kandidat

- Status: **PLANERAD**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 1. Nivå: A. Prioritet: P2.
- Beroenden: Inga andra aktiviteter; färsk bas och rätt mandat krävs vid tilldelning.
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

Aktuellt main-träd är cirka 85 MiB. Historikens GiB är ett annat problem; mediefiler är inte döda på grund av storlek eller gammalt namn.

## Utförande

Börja i git ls-tree -r -l origin/main, största först, och kontrollera öppna PR:ers ägarskap/filer. Följ import, strängbyggd URL, route, manifest, publicUrl, Docker/package-script och vid behov aktiv Neon/Blob-konsument. Radera endast verifierat förbrukat material tillsammans med allowlist/manifestrad och förbrukat test.

## Klart när

Varje borttagning har noll levande konsument eller verifierad ersättning, riktat beteendeprov och rena grannkontrakt. Ingen no-ignore-sökning, privat arkivläsning, historikomskrivning eller radering av prototyper/utkast.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: S14; AGENTS Hitta och radera skit; repo-limits. Se [underlagsregistret](../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../ARBETSSATT.md).
