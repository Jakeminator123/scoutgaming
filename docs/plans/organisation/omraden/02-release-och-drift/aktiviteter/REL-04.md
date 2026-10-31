# REL-04: Kontrollerad synk av preview inför nästa acceptansprov

- Status: **PLANERAD**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 1. Nivå: A. Prioritet: P2.
- Beroenden: [REL-01](REL-01.md), [GEM-02](../../../gemensamt/aktiviteter/GEM-02.md).
- Bas: main `e20fe6f143e447f805c63b75b328f39f48521ca3`; preview `6a3f976e4428627b135664ba7d13ae24593567c4`. Läs om båda före start.
- Tillåtna refs/filer / PR: fastställs före genomförande; ingen miljöpush i inventeringen.

## Underlag och mål

Vercel- och Render-preview kör samma äldre revision. Målet är en avsiktlig, verifierad provmiljö inför F11 eller annan ändrad funktion; att preview är äldre är inte ensamt ett produktfel.

## Utförande

Granska main–preview-diff, miljö/schema och ägarskap. Följ START-HERE: fast-forward när möjligt, annars PR från main med bas preview och samma mergeverktyg. Preview mergas aldrig tillbaka till main eller featurebranch. Bevara branchskyddet och befintliga stoppbeslut; tjänststart ingår bara i ett avgränsat prov.

## Klart när

Avsedd preview-ref, exakt CI, Vercel- och Render-SHA, databas/Blob och health/version är verifierade. Ingen produktionstoken, främmande branchhistoria eller oväntad data följer med. Testresurser har namngiven ägare.

Bevis: inga genomförandebevis ännu. Källspår: M22, aktuell driftagents molnläsning i [NULAGE](../../../NULAGE.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../../ARBETSSATT.md).
