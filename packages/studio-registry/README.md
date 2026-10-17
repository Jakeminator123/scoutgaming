# Studio-registret

`server/repository.mjs` äger en gemensam implementation av scoped SQL,
transaktioner, CAS, historik och presentationssnapshots. Appkompositionen i
`web/storage/studio-repository.mjs` tillför obligatoriska namngivna kontrakts-,
policy-, katalog- och dealer-set-adaptrar.

Pool och SQL-driver, auth, readiness, start och provider-SDK:er ägs fortsatt
av apparna. Kärnan startar inga anslutningar och importerar inga appar.
Register-/Blob-läsarna är ännu inte flyttade till paketet.
