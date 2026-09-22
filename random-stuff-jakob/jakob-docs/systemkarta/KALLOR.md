# Källor och verifieringsgräns

[Till systemkartan](README.md)

**Uppdaterad 22 september 2026 för V5, D0 + sju dagar.** Översynen gäller systemkartans
sex ämnen, deras README/källpekare och de två aktiva modellreferenserna.
Kod, aktiva tekniska guider och daterad handoff är underlaget. Personarkiv,
medieinnehåll har inte lästs i denna översyn. Jakobs uttryckligen bifogade
browseragent-underlag har använts för kraven; råkonversationen kopieras inte hit.

## Aktuell integration · 22 september

Återställningstaggen `backup/jakob-work-pre-kevin-20260922` pekar på
`6fe7c82d1522db9c9d4f611ad44006648ec355aa`, Jakobs work före integrationen.
Kevins MR !1 utgår från `b066a43ba18b7da8a405c99789374680c5ed07db`.
Slutlig merge-/leveransrevision och testkvitton anges i
[handoffen](../../../docs/JOHN-HANDOFF.md); en tagg återställer inte lokala
o-committade filer eller en driftsatt databas.

Kodunderlaget för livejämförelsen är
[native-observern](../../../web/public/native-observation.mjs),
[native-kommandosvaret](../../../web/native-table.mjs),
[labbets meddelandekontroll](../../../lab/lib/native-observation.mjs) och
[observerad kontext](../../../lab/lib/observation-context.mjs).
Kommando, publik status, klientens playback och chatt skiljs från Partner-SSE.
Endast explicit öppnad popup med rätt origin/kanal godtas. Labbets context
redovisar observerade fakta och saknade uppgifter. Observerad chatt före eventet
får följa med som märkt data: högst 8 meddelanden, 600 tecken per meddelande och
3 200 totalt, avgränsat av senaste luckan. Separata saldo-, spelar-ID- och
authfält projiceras bort. Director-kontraktet v2 kräver explicit kvitto;
äldre remote ger standardreserv tills tjänsten uppdaterats och verifierats.

Produktläsaren för BO-val finns nu i `web/public/app.mjs`. V2:s aktiva
green-/speech-/dealingväg skiljer sig från originalet och från filmanifestet.
Samma engine-index eller line-ID bevisar inte samma aktivt uppspelade take.
Dokumentationen hävdar ingen ny visuell filmgranskning eller verifierad
Bettalotto-deploy. Äldre inventeringsantal nedan behåller sina datum.

## Revisioner och proveniens

Den första kartan anknyter till `c0a5681`. Första eventregistret använde
spelkod vid `d910ddc` och studio vid `b26ff83`. Senare översyn vid
`bf4e82e` tillförde röstpanel/runtimepaket och loaderfynd. Det är historiska
källankare, inte en beskrivning av dagens remote- eller driftstatus.

Den senare kodkontrollen i [handoffens systempaketsnotis](../../../docs/JOHN-HANDOFF.md)
jämförde work/origin `a15b780` med origin/main `b147659`; de granskade
server-, shoe-, Partner- och appfilerna saknade diff. Notisen är commit
`62784f4`, startrevision för denna dokumentationsöversyn.
Situationsreferensens jämförelse med Kevin `626554d` bevaras som ett
separat äldre ankare. Ingen av dessa revisioner bevisar aktuell deploy.

Daterad handoff redovisar också socialt labbprov på `6797b6a`, upstream
OpenClaw `2026.9.5`, samt senare 192 labbtester och 98 Director/OpenClaw-
tester. Dessa kvitton återanvänds med datum; kartan hävdar ingen ny
driftkontroll, testkörning eller visuell acceptans.

## Aktiva läskällor

### System och signaler

- [Server: native table, session och BO](../../../web/server.mjs).
- [Shoe, commands och publik vy](../../../web/shoe-game.mjs).
- [Round och blackjackregler](../../../web/public/blackjack.mjs).
- [Partnertransport, wallet och SSE](../../../web/partner-api.mjs).
- [Presentation och filbaserat assets-manifest](../../../web/partner-presentation.mjs).
- [Klientens koreografi](../../../web/public/app.mjs).
- [Situationer och takes](../2026-09-20-situationer-variantfamiljer-och-takes.md)
  och [eventregister](../2026-09-20-eventregister-och-mental-modell.md).

Denna översyn följde särskilt Partner-table, `publish`, abonnenternas
scope, `handleEvents`, launch, walletanrop och `buildAssetsManifest`.
Native-route och labbgränsen stämdes av mot den daterade systempaketskontrollen.
Det är en riktad kodkontroll, ingen ny fullständig produkt- eller säkerhetsaudit.

### Labbets redigering, urval och media

- [Labbet](../../../lab/README.md), [kompatibilitet](../../../lab/COMPATIBILITY.md)
  och [videobanken](../../../lab/VIDEO-LIBRARY.md).
- [Startprojekt](../../../lab/policies/project.seed.json),
  [studio-kontrakt](../../../lab/policies/studio-contract.json) och
  [projektschema](../../../lab/schemas/studio.schema.json).
- [Studio-server](../../../lab/lib/studio-server.mjs),
  [studio-modell](../../../lab/lib/studio-model.mjs) och
  [projektlagring](../../../lab/lib/project-store.mjs).
- [Videoregister](../../../lab/lib/video-registry.mjs),
  [intake/urval](../../../lab/lib/video-intake.mjs) och
  [hashbunden kategorisering](../../../lab/lib/video-classifications.mjs).
- [Social labbchatt](../../../lab/SOCIAL-CHAT.md).
- [Daterad medieinventering](../../../docs/animation-events/v3-video-map/README.md),
  [performance-manifest](../../../web/public/dealers/astrid/performance/manifest.json),
  [proveniens](../../../web/public/dealers/astrid/performance/provenance.json),
  [talmedia](../../../web/public/speech-media.json) och
  [PerformancePlayer](../../../web/public/performance-player.mjs).

Antalen 4 dealers, 16 noder, 9 starttriggers, 64 linjer, 256 varianter och
64 eventrörelser hör till `studio.2026-09-20.2`. En separat social rörelse
ingår inte i de 64. De daterade 224 originalen och 90 stream-indexposterna
är metadata/inventering; inga nya originalhashar eller filmer analyserades här.

Den aktuella videobanksreferensens nedersta avsnitt om kategoriavgränsning
förtydligar äldre text: omkategorisering av befintliga original finns via
`classifications.json`, och `playback` är endast `once`. Kartan använder
det senare kontraktet.

### OpenClaw och drift

- [Lokalt dokumentationsindex](../../../open-claw/lab/docs/README.md)
  lästes först för denna del.
- [Director-motor](../../../open-claw/lab/src/engine.mjs),
  [socialt kontrakt](../../../open-claw/lab/docs/SOCIAL-CHAT.md) och
  [runtimepaketets avgränsning](../../../open-claw/lab/deploy/runtime-bundle/README.md).
- [Render-blueprint](../../../open-claw/lab/render.yaml),
  [Gateway-Dockerfile](../../../open-claw/lab/deploy/Dockerfile.gateway),
  [driftguide](../../../open-claw/lab/docs/DEPLOYMENT.md) och
  [dashboard-guide](../../../open-claw/lab/docs/DASHBOARD-SV.md).

Kartan hämtar inte externa OpenClaw-dokument på nytt för att beskriva redan
avgränsade lokala kontrakt. Ingen runtimekonfiguration ändras av kartan.

### Plan, fynd och leverans

- [Aktiv sprint och versionernas status](../../../docs/animation-events/README.md).
- [Findings och kvarstående beslut](../../../docs/findings/REGISTER.md).
- [Handoff med daterade verifieringar](../../../docs/JOHN-HANDOFF.md).
- [Delat arbetsflöde](../../../docs/shared/WORKFLOW.md).
- [Projektregler](../../../AGENTS.md) och [pre-commit](../../../.githooks/pre-commit).

Personarkivet behövs inte för att följa dessa aktiva samband. Historisk
proveniens anges med datum/commit och aktiva sakuppgifter med direkta källor.

## Viktigaste rättelserna

- Partner är ett gränssnitt in och ut. Native och Partner är separata
  klientvägar; native publicerar efter commit när verifierad Partner-session finns.
- SSE är scoped till nyckel + partner-playerId, har ingen replay och
  kräver signerad åtkomst. BO-inloggning är en annan behörighet.
- Assets-manifestet läser filer, inkluderar även vissa review-takes och
  verifierar varken aktuell BO-bindning eller faktisk uppspelning.
- Eventtest använder sparat exempel och manuella testvärden; livejämförelsen
  bygger begränsad kontext från verkligt mottagna publika events. Social
  Astrid-chatt är ett separat implementerat text-/policy-/modell-/talprov.
- Lokal slump mellan tillåtna varianter finns. Takepooler och viktat
  takeval är fortfarande förslag. Social cooldown är ingen generell produktkö.
- Ljud/video ger tids- och färdigsignaler; spelfakta kommer från motorn.
- Seamless wallet gör operatören till saldots källa i Partner-table-vägen;
  native-klientens beteende måste verifieras separat.

## Kvar att verifiera

Aktuell driftsatt serverrevision och dess aktiva BO-bindningar måste fortfarande
beläggas separat från den lokala koden. Verklig återhämtning efter SSE-avbrott, wallet per
klientväg, en gemensam adapter, en enda talägare, full videotäckning och
hashbunden visuell QA är inte färdiga genom denna dokumentationsändring.

F-001–F-007 står kvar på sina dokumenterade evidens-/triagenivåer. F-005:s
`split`/`splitFrom` behöver isolerad reproduktion. En omorganisation eller
en passerad labbtestsvit är inget bevis att dessa fynd är lösta.

Inga privata miljöfiler, nycklar, inloggningsnoter eller arkivinnehåll lästes.
Endast den uttryckligen bifogade konversationen lästes som kravunderlag.
Inga nya API-, modell-, röst-, databas- eller
deploymentanrop gjordes av denna deluppgift. Ingen media avkodades eller
indexerades till en modell. Kontroll av dokumentlänkar gäller filernas
existens, inte hämtning av deras medieinnehåll.
