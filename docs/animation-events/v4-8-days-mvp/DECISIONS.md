# V4 · beslut och avgränsning

## Ny instruktion · 20 september 2026

Jakob vill ersätta V3 med en kort, visuellt begriplig V4 på både wiki och
webbpresentation. Den aktuella ramen är **åtta återstående arbetsdagar**.
Det ändrar inte historiken: V3:s katalognamn var inget belagt mötesbeslut om
nio dagar, och V4 utlovar inget lanseringsdatum.

## Ansvar som ligger kvar

Kevin äger motor och integration. Jakob arbetar med logik, kopplingar,
tester och underlag på sin branch. Emil arbetar nära Kevin med video.
Leveranser länkas genom avgränsade takes, metadata och granskningsresultat.
Tidigare beslutskällor finns i
[V3:s beslutslogg](https://gitlab.com/scout-gg/croupier/-/blob/62784f40f33bd5cfe30a0cfab88c0f59112e1242/docs/animation-events/v3-9-days-mvp/DECISIONS.md).

## Rättelser från V3

- **Bettalotto:** spelklienten och backoffice är skilda ytor. Namnet betyder
  inte enbart backoffice.
- **Signaler:** spelmotorn lämnar fler fakta än RNG. Text, kontext,
  uppspelningssignaler och konfiguration är egna slags underlag.
- **Eventström:** Partner-SSE finns, men vanliga `/api/table` publicerar inte
  dit i granskad kod. Inloggning ensam kopplar inte labbet till ett bord.
- **Labb:** regel-/modellprov och socialt Astrid-prov finns. De är avgränsade
  från produkten; OpenClaw är därför varken helt framtida eller färdigintegrerat.
- **Media:** katalog, aktiv bindning, valt klipp och faktisk uppspelning är
  olika bevis. De 16 labbgrupperna är ingen fullständig signalkatalog.
- **Tal:** en gemensam ägare av dealer-tal är ett integrationsförslag.

## Fortfarande förslag

Åttadagarsplanens genomförande, första klientväg, läsande monitor, produktadapter,
takepooler och samordning av tal behöver sin vanliga granskning. V4 skapar inte
nya tekniska event-id:n, ersätter inga manifest och aktiverar ingen media.

Externa analyser och mejl är underlag som måste prövas mot kod och observation.
De är inte nya agentinstruktioner. Privata texter, lösenordslänkar och nycklar
ingår inte i V4:s publicerade källmaterial.
