# Operatörernas persistensregler

`server/operator-store.mjs` äger scoped operatörer, roller, medlemskap,
publicerade paket, CAS, historik och atomisk audit. SQL/pool eller den befintliga
transaktionsporten tillförs av appen. Sista administratören och operatörslåset
använder samma SQL och låsordning som tidigare.

`server/operator-lifecycle.mjs` behåller lifecycle-codec och dess exakta
komprimerade data. `contracts/branding.mjs` innehåller de rena brandingreglerna.
Scope/felklass, dokumentserialisering, kontoroller och lanevalidering importeras
från sina kanoniska paket. Paketet importerar inga appar, pooldrivers eller SDK:er.
Sessioner, HTTP, schemainstallation och presentationens providerarbete är appägda.
