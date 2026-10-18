# Gemensamma identitets- och behörighetsregler

`server/` äger den gemensamma credential-resolvern, de asynkrona CRAIG- och
behörighetsepokreglerna samt operatörernas behörighetspolicy. SQL-frågorna körs
mot det redan tillförda databasgränssnittet; paketet äger ingen pool, driver,
schemainstallation eller anslutning. Scope och felklass har samma kanoniska
ägare i `studio-scope.mjs`.

`display-name.mjs` innehåller den importfria namnregeln för både Partner-API
och Studio. Rollregeln finns i `account-role.mjs`. Servermodulerna läggs inte
till i presentationens publika modulista.

Apparna äger fortsatt sessioner, cookies, HTTP, signerare, readiness och
wallet. De äldre synkrona CRAIG-/epokimplementationerna i `services/game/` används av
isolerade SQLite-fixtures och behåller sin implementation.
