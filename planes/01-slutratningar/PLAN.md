# 01 — Tre avgränsade sluträttningar

## Syfte och mål

Åtgärda tre verifierade funktionsfel utan att göra om migrationen eller bygga
om systemet. Resultatet ska vara en granskbar leverans med tester för de
konkreta felen. Därefter följer [produktionsacceptansen](../07-produktionsacceptans/PLAN.md).

## A. GPU-avslut och processkedja — högst prioritet

**Verifierat på bee4e04a:**

- [start.mjs](../../ops/cloud/start.mjs) väntar på `closeGateway()` innan
  `children.stop()` signalerar spelprocessen.
- [process-group.mjs](../../ops/cloud/process-group.mjs) väntar på HTTP-serverns
  close-callback. Ett isolerat prov med en kvarvarande uppgraderad anslutning
  väntade fortfarande efter tvångsstängningens tidsgräns. Provet använde inga providers.
- Samma modul tvångsavslutar barn efter 10 sekunder.
- [speech-journal-runtime.mjs](../../web/speech-journal-runtime.mjs) medger
  upp till 15 sekunders naturlig avslutsobservation, därefter eventuell cancel
  och journalföring. 10 sekunder räcker alltså inte för denna avsedda kedja.

### Kontrollera

- Hela kedjan SIGTERM → stäng ny trafik → signalera barn → stoppa worker →
  läs terminalstatus/cancel → skriv journal → stäng lagring → process slut.
- Vilka uppgraderade klient- och workeranslutningar gatewayen faktiskt äger.
- Sammanlagd maximal tid, inklusive pågående provideranrop, cancellation,
  workerdränering, databas och Render-tjänstens verkliga shutdown-tidsgräns.
- [web/graceful-shutdown.mjs](../../web/graceful-shutdown.mjs) och
  [web/server.mjs](../../web/server.mjs) måste ingå; deras cleanup får inte
  börja först efter en gatewayväntan som cleanup själv behöver avsluta.

### Ändra och verifiera

- Starta barnens cleanup omedelbart när shutdown börjar. Stoppa samtidig ny
  trafik och hantera uppgraderade anslutningar uttryckligen.
- Gör shutdown idempotent. En andra signal får inte ge dubbla providerjobb,
  cancellation-anrop eller journalhändelser.
- Härled en sammanhängande tidsbudget. Att enbart byta `10000` till `15000`
  eller `30000` är inte ett tillräckligt bevis.
- Utöka befintliga process- och journaltester. Lägg ett meningsfullt
  integrationstest i Linuxmiljö med ansluten worker, aktiv WebSocket,
  långsamt naturligt avslut och separat cancellation-fall. Testa även
  timeout: bevarad reservation/återhämtningsbar journal, aldrig fabricerad terminalstatus.

**Klart när:** cleanup startar trots öppen anslutning, journalen hinner
skrivas före lagringsstängning/tvångsavslut och hela processkedjan avslutas
inom sin avsedda gräns. Providerkvittens och faktisk workerdränering redovisas.

## B. Zonernas referensbild och export

**Verifierat:** [routen](../../lab/app/api/zones/reference/route.ts) läser
`emil/dealklipp-v1/astrid_startbild_spel_1080x1920.png`. Den platsen saknas.
[Mediaregistret](../../media/layout.json) mappar samma bild till
`media/dealers/astrid/runtime/presentation/astrid_startbild_spel_1080x1920.png`;
den registrerade filen finns lokalt och är 1 628 428 byte.
Coachens antal sex HTTP 500 är rapporterat, inte nyavläst i denna planleverans.

### Ändra och verifiera

- Använd befintlig registrerad medieresolver/aktuell leveranskälla, se
  [media-layout](../../tools/media-layout.mjs) och
  [media-blob-index](../../lab/lib/media-blob-index.mjs). Återinför inte gamla katalogen.
- Kontrollera faktisk tillgänglighet i Vercelbygget: en fungerande lokal
  filväg bevisar inte att bilden följer med i deploymenten eller kan hämtas via rätt Blobväg.
- Behåll `assertLocalRequest`, övrig autentisering och privat caching.
- Prova både den visade bilden och `source.decode()`/canvasexport i
  [background-zones](../../lab/components/background-zones.tsx).
- Testa anonym/obehörig åtkomst, korrekt MIME samt exportens rätta bild och storlek.

**Klart när:** autentiserad Studio visar referensbilden och exporterar rätt
startbild på faktisk deployment. Enbart HTTP 200 eller ett lokalt filprov räcker inte.

## C. OpenClaw-knappens Forbidden

**Reproducerat mot den publika Director-adressen:** direkt GET till
`https://croupier-lab-director.onrender.com/openclaw/` gav HTML/200. Samma
GET med webbläsarmetadata för top-level-klick från Studio gav 403 och exakt
`OpenClaw dashboard: Forbidden`.

Orsaken finns i [dashboard-proxy](../../open-claw/lab/src/dashboard-proxy.mjs):
alla `sec-fetch-site` utom `same-origin` och `none` nekas. Studio ligger på
en annan origin än Director. Knappen är en vanlig extern navigering.

### Ändra och verifiera

- Tillåt den avsedda användarinitierade toppnavigeringen till själva
  dashboardingången med en snäv regel. Behåll strikt Origin/Host-kontroll,
  Gateway-inloggning, browser pairing och begränsade API-/WebSocketrutter.
- Lätta inte generellt på cross-site POST, fetch, iframes, WebSocket-origin
  eller forwarding av serverhemligheter.
- Utöka [dashboard-proxy.test](../../open-claw/lab/test/dashboard-proxy.test.mjs)
  med faktisk navigeringsmetadata och negativa fall. Verifiera sedan klicket
  från den riktiga [Studio-portalen](../../lab/components/openclaw-workspace.tsx).
- Läs OpenClaws [versionsbundna driftindex](../../open-claw/lab/docs/README.md).
  Director/Gateway är separata tjänster; en produktdeploy uppdaterar inte automatiskt båda.

**Klart när:** knappen når OpenClaws egna inloggnings-/anslutningsvy och en
redan godkänd administratör kan ansluta. Negativa åtkomstprov ska fortsatt nekas.
Att klistra adressen direkt i adressfältet kan användas som tillfällig väg;
det är inte en levererad rättning av knappen.

## Leveransgräns

**Källrättning 5 oktober:** A/B/C är implementerade. Zonprov50/50,
dashboard/proxy/workspace53/53, shutdown-Windows71PASS/3LinuxSKIP samt
Linuxprocesskedja4/4PASS. Oberoende granskningens shared-lease-P2 är stängd;
close-regression38/38 och Linux4/4 passerar efter fixen. Faktiskt Studio-
bygge/traces och fyrdealer-synkaudit PASS. Produktens Render-gräns90s är
applicerad/GET-verifierad med oförändrade51envvärden. Driftsatt bild/export,
native OpenClaw-klick/anslutning och slutversion följer nu enligt plan07.

- [ ] A, B och C rättade och riktat verifierade.
- [ ] Obligatoriska checks enligt aktuell repositorypolicy passerar.
- [ ] Oberoende granskare har kontrollerat just ändringarna och testernas relevans.
- [ ] Rätt tjänster är driftsatta; version och ändrade flöden är verifierade.

Inga nya priser, konto-/datamigreringar, arkitekturer eller UI-system ingår.
