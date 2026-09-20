# V4 · källor och verifieringsgräns

**Kontrollerad 20 september 2026, lokal branch `jakeminator123/work`,
revision `62784f40f33bd5cfe30a0cfab88c0f59112e1242`.** Det är ett ankare för
källkod och dokumentation, inte ett påstående om dagens driftsatta server.

## Kod som bär V4:s påståenden

- **Server och motor:** [`server.mjs`](https://gitlab.com/scout-gg/croupier/-/blob/62784f40f33bd5cfe30a0cfab88c0f59112e1242/web/server.mjs),
  [`shoe-game.mjs`](https://gitlab.com/scout-gg/croupier/-/blob/62784f40f33bd5cfe30a0cfab88c0f59112e1242/web/shoe-game.mjs)
  och [`blackjack.mjs`](https://gitlab.com/scout-gg/croupier/-/blob/62784f40f33bd5cfe30a0cfab88c0f59112e1242/web/public/blackjack.mjs).
  `command`/`gameView` hanterar spelet och den publicerade vyn. Native
  `/api/table` returnerar status till den vanliga klienten.
- **Partner:** [`partner-api.mjs`](https://gitlab.com/scout-gg/croupier/-/blob/62784f40f33bd5cfe30a0cfab88c0f59112e1242/web/partner-api.mjs)
  och [`partner-presentation.mjs`](https://gitlab.com/scout-gg/croupier/-/blob/62784f40f33bd5cfe30a0cfab88c0f59112e1242/web/partner-presentation.mjs).
  `/api/v1/table` bygger `presentation[]`; `publish` skickar samma lista i
  SSE-objektets `round.events` när listan inte är tom. Prenumeranter separeras
  per API-nyckel och partnerns spelar-id. `state` har tom presentation och
  ett lagrat idempotenssvar publiceras inte igen. Ingen replay-buffer finns.
- **Tillgängliga assets:** `buildAssetsManifest` filtrerar bort `rejected`
  men publicerar inte full status, hash och review i `deals[]`. Det bevisar
  varken livegodkännande eller aktiva backoffice-bindningar.
- **Produktspelare och chatt:** [`app.mjs`](https://gitlab.com/scout-gg/croupier/-/blob/62784f40f33bd5cfe30a0cfab88c0f59112e1242/web/public/app.mjs),
  [`dealer-engine.mjs`](https://gitlab.com/scout-gg/croupier/-/blob/62784f40f33bd5cfe30a0cfab88c0f59112e1242/web/public/dealer-engine.mjs),
  [`performance-player.mjs`](https://gitlab.com/scout-gg/croupier/-/blob/62784f40f33bd5cfe30a0cfab88c0f59112e1242/web/public/performance-player.mjs).
  Native-status, ljud-/videotid och uppspelningshändelser har egna roller.
  Produktens `/chat` är skild från det sociala labbprovet.
- **Eventlabb:** [`simulateStudio`](https://gitlab.com/scout-gg/croupier/-/blob/62784f40f33bd5cfe30a0cfab88c0f59112e1242/lab/lib/studio-server.mjs)
  använder `exampleEvent` och `body.context`, och märker resultatet
  `simulated: true`. [Kompatibilitetsbeskrivningen](https://gitlab.com/scout-gg/croupier/-/blob/62784f40f33bd5cfe30a0cfab88c0f59112e1242/lab/COMPATIBILITY.md)
  förklarar sex typer, 16 grupper, exakta repliker och testernas gräns.
- **Socialt prov och tal:** [Astrids labbchatt](https://gitlab.com/scout-gg/croupier/-/blob/62784f40f33bd5cfe30a0cfab88c0f59112e1242/lab/SOCIAL-CHAT.md)
  är en separat Astrid/idle-väg med validerat svar, valfritt tal och 2D-gest.
  Beständigt spelarminne och gemensam produktkö är inte levererade där.

## Daterade prov är inte dagens driftstatus

[Handoffnotisen vid granskningsrevisionen](https://gitlab.com/scout-gg/croupier/-/blob/62784f40f33bd5cfe30a0cfab88c0f59112e1242/docs/JOHN-HANDOFF.md)
registrerar 192 passerade labbtester och 98 Director/OpenClaw-tester från den
föregående systemgranskningen. Dessa är **tidigare testresultat**, inte en ny
testkörning eller visuell acceptans i V4-leveransen.

Aktuell deploy-revision, behörig testsession, aktiv backoffice-konfiguration
och sammanhängande verklig uppspelning återstår att verifiera. En fungerande
OpenClaw-anslutning i ett daterat labbprov fyller inte dessa gap.

[Repots acceptansregler](https://gitlab.com/scout-gg/croupier/-/blob/62784f40f33bd5cfe30a0cfab88c0f59112e1242/AGENTS.md)
gäller vid media- och spelarändringar. Kvarvarande problem finns i
[findings](https://gitlab.com/scout-gg/croupier/-/blob/62784f40f33bd5cfe30a0cfab88c0f59112e1242/docs/findings/README.md)
och Jira CAC; V4 stänger inga fynd.

Källarbetet kräver text, kod och avgränsad metadata. Det innebär ingen
AI-indexering av video-/ljudinnehåll och behöver inga privata arkivtexter.
