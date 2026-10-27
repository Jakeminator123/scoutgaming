# Bolagens persistensregler

Bolag heter `operator` i koden.

`server/operator-store.mjs` äger bolag, roller, medlemskap, publicerade paket,
CAS, historik och atomisk audit. SQL-pool eller transaktionsport tillförs av appen.
Sista administratören och bolagslåset använder samma SQL och låsordning.
`server/public-rooms.mjs` bygger ett bolags spelbara rum ur det publicerade paketet,
och `server/operator-lifecycle.mjs` äger livscykelns codec och komprimerade data.

`contracts/branding.mjs` innehåller de rena brandingreglerna och
`contracts/demo-operators.mjs` de syntetiska demobolagen för prov. Scope, felklass,
dokumentserialisering, kontoroller och mallvalidering importeras från sina
kanoniska paket. Paketet importerar inga appar, pooldrivers eller SDK:er;
sessioner, HTTP, schemainstallation och providerarbete är appägda.
