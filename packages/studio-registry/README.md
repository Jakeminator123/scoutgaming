# Studio-registret

`server/repository.mjs` äger en gemensam implementation av scoped SQL,
transaktioner, CAS, historik och presentationssnapshots. Appkompositionen i
`web/storage/studio-repository.mjs` tillför obligatoriska namngivna kontrakts-,
policy-, katalog- och dealer-set-adaptrar.

Pool och SQL-driver, auth, readiness, start och provider-SDK:er ägs fortsatt
av apparna. Kärnan startar inga anslutningar och importerar inga appar.
Registerkärnan, aktuella och fångade katalogläsare samt media-, manifest- och
layoutkontrakt finns också i `server/`. Läsarfactoryerna får explicita roots,
URL-formatterare och läsarportar. Fångade snapshots kompletteras aldrig med
aktuella Neon-rader eller lokal registerfallback.

`server/blob-reader.mjs` äger den gemensamma tekniska Blob-implementationen
och dess cache. `lab/lib/cloud-media-store.mjs` och `web/blob-media.mjs`
injicerar appägda lazy SDK-provideradaptrar. Lokala uppladdnings- och
klassificeringsskrivare, deras lås och auktoriserade purgeflöden stannar appägda.
