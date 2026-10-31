# GEM-03: Beslutsspår för Git-historik och eventuell ny produktrepo

- Status: **VANTAR_BESLUT**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 3. Nivå: C. Prioritet: P3.
- Beroenden: Inga andra aktiviteter; färsk bas och rätt mandat krävs vid tilldelning.
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

Incidentunderlaget har fullspegel/backup och förslag omkring 65 MiB. Vanlig branchradering löser inte PR-refarnas lagring; andra utvecklares arbete är skyddat.

## Utförande

Återanvänd befintliga två incidentdokument, kontrollera backupens ålder och skydda nya commits/utkast/tester före eventuellt beslut. Jämför behållen historik med ny rot, GitHub-integrationer, CI, hemlighetsskanning, gamla SHA/PR och återgång. Rapportens GitLab-spår är historiskt alternativ, inte ny arbetsplattform.

## Klart när

Ett uttryckligt beslut anger exakt repo/refs, bevarande, backup/restore, cutover och verifiering av Vercel/Render/Neon/Blob. Ingen force-push, repo-ersättning, branch-/åtkomstradering eller flytt sker av denna plan.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: S11/S12/S14; docs/incidents/2026-10-31-*. Se [underlagsregistret](../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../ARBETSSATT.md).
