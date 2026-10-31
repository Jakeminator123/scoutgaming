# REL-02: Återställningsbevis för Neon och Render-state

- Status: **PLANERAD**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 1. Nivå: B. Prioritet: P1.
- Beroenden: [GEM-02](../../../gemensamt/aktiviteter/GEM-02.md)
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

Backup-/restoreguiden och verktyg finns. En backup på samma disk och en PITR-inställning bevisar inte offsite eller genomförd återställning.

## Utförande

Fastställ behov av återställningspunkt/tid, aktuell Neon-history, Director/Gateway-state och Blob-bindningar. Återanvänd backup-render-state/db-snapshot. Förbered isolerat restore/PITR-prov och extern krypterad kopia; kör bara inom godkänt resurs-/kostnadsmandat.

## Klart när

Käll-/målidentitet och kontrollsummor dokumenteras utan hemligheter; återställd tjänst/data kan läsas och återgång är beskriven. Inga riktiga användarkonton används för spelprov.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: E-06; S12; S14. Se [underlagsregistret](../../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../../ARBETSSATT.md).
