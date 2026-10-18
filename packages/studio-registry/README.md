# Studio-registret

`server/repository.mjs` äger en gemensam implementation av scoped SQL,
transaktioner, CAS, historik och presentationssnapshots.
`server/document-contract.mjs` binder samma projekt-, social- och lanevalidatorer;
`server/document-repository.mjs` binder samma obligatoriska namngivna kontrakts-,
policy-, katalog- och dealer-set-adaptrar till kärnan. Apparna tillför pool och scope.

Pool och SQL-driver, auth, readiness, start och provider-SDK:er ägs fortsatt
av apparna. Kärnan startar inga anslutningar och importerar inga appar.
Registerkärnan, aktuella och fångade katalogläsare samt media-, manifest- och
layoutkontrakt finns också i `server/`. Läsarfactoryerna får explicita roots,
URL-formatterare och läsarportar. Fångade snapshots kompletteras aldrig med
aktuella Neon-rader eller lokal registerfallback.

`server/blob-reader.mjs` äger den gemensamma tekniska Blob-implementationen
och dess cache. `apps/studio/lib/cloud-media-store.mjs` och `services/game/blob-media.mjs`
injicerar appägda lazy SDK-provideradaptrar. Lokala uppladdnings- och
klassificeringsskrivare, deras lås och auktoriserade purgeflöden stannar appägda.

`server/media-runtime.mjs` äger medieorkestreringen med explicita portar för
register, metadata, layout, Blob och legacykontroller. Studio komponerar den i
`apps/studio/lib/studio-media-runtime.mjs`; spelservern i
`services/game/storage/studio-media-runtime.mjs`. Aktuella scoped läsningar hålls skilda
från fångade snapshots. Samma hash-/storlekskontroller, origin, HEAD och Range
gäller. Apparna behåller sina respektive Blob-provideradaptrar.

`server/local-project-reader.mjs` och `server/local-video-readers.mjs` läser
explicit valda lokala authoring-/fixturefiler. De skapar inga mappar och
ändrar inga register. Studio behåller projektets writer, lås, historik samt
uppladdnings-/klassificeringsskrivare. Produktionens Neonkrav och felbeteende
ändras inte; läsarna skapar ingen lokal reservväg vid molnfel.
