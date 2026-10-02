# Artefaktkarta · labb, 2D, produktvideo och OpenClaw

V5, uppdaterad 22 september 2026. Användarguiden finns fortsatt i `guide.json` och Guide.
Den här kartan visar tekniska källor och ägare; den skapar inget andra
medieregister. [Sprinten](../../docs/LOCAL-PRESENTATION-RUNTIME.md)
är plan och handoff, inte runtimekonfiguration.

## Format och policy i labbet

- `lab/schemas/studio.schema.json`: sparat projekt, linjer, triggers, varianter.
- `lab/schemas/video.schema.json`: kategorisering; exakt situation för tal/kort.
- `lab/schemas/social.schema.json`: Astrids avgränsade sociala policy.
- `lab/schemas/idle-policy.schema.json`: tvådelad idlepolicy med 1–4
  grundloopar och högst fyra engångsvarianter.
- `lab/policies/studio-contract.json`: gemensamma ID:n, situationer, ordlista,
  tillåtna urval och gränser. Kontrakt och schema ska stämma överens.
- `lab/policies/project.seed.json`, `social.seed.json` och
  `idle-policy.seed.json`: startprojekt och avgränsade policyer.
- `lab/animations/`: 64 delade eventrörelser och separat social 2D-rörelse.
  Pose-spår är mockup, inte video eller läppsynk.

## Media och deras befintliga manifest

- `emil/dealklipp-v1/lab-video-manifest.json`: hashstabilt labbmanifest.
  Varje `deal/<familj>/` och `repliker/<familj>/` har ett standardklipp och en
  `variant/`-mapp. För idle är filer direkt i `idle/` grundloopar och filer i
  `idle/variant/` engångsvarianter. `pipeline/build-lab-video-manifest.mjs`
  bygger och kontrollerar samma struktur.
- `lab/lib/idle-policy.mjs`: validering, faktisk tidsandelsberäkning och
  seedad enminutsförhandsvisning för Eventstudion.

- `web/public/speech-media.json`: exakta native-talpakets mediereferenser.
- `web/public/speech-lines.mjs`: gemensamma inspelade grundtexter; en dealers
  `audio/en/bank.json` kan precisera dess text/ljud.
- `web/public/dealer/streams/index.json` för Vera och
  `web/public/dealers/{astrid,amira,mei}/streams/index.json`: indexerad H.264,
  frame-/fps-/delay-metadata och tillhörande ljud under dealerroten.
- `web/public/dealers/astrid/performance/manifest.json`: staged-takes,
  masker/kontakt/timing och reviewstatus. Fortsättningar är inte nya basförval.
- `lab/lib/original-media-server.mjs`: härleder den lokala förvalskatalogen
  från produktregistren. Resolvern i `original-media.mjs` matchar exakt event.
- `lab/lib/video-registry.mjs`: äldre generationsposter och egna uppladdningar.
  Historiska generationer, runtimeförval och aktiv produktbindning är olika saker.

Originalmanifest och filmer stannar i produkten. Kevin äger produktintegration
och Emil/ Kevin materialleveranser och review. Ingen kopierad JSON får börja
utge sig för att vara ett nytt auktoritativt produktmanifest.

## Lokalt sparat och privat

Livejämförelsens ansvar ligger i de befintliga ytorna:

- `web/native-table.mjs`: publikt kommandosvar + presentation och publicering
  efter commit, med återanvändbart retry-kvitto.
- `web/public/native-observation.mjs`: opt-in-signaler från originalklienten;
  ingen andra motor eller extra spelkommando.
- `lab/lib/native-observation.mjs`: kontrollerar avsändarfönster, origin,
  per-launch-kanal och meddelandeformat.
- `lab/lib/partner-trace.mjs` och `presentation-sequence.mjs`: begränsat
  protokoll, instruktioner, dubbletter och luckor.
- `lab/lib/observation-context.mjs`: publika fakta och saknad kontext.
- `open-claw/lab/schemas/observed-chat.schema.json`: kontextkontrakt v2 för
  begränsad tidigare native-chatt. Director kvitterar version och antal;
  labbet väljer standard om en äldre tjänst saknar kvittot.
- `lab/components/partner-reference.tsx`, `game-stream.tsx` och
  `activity-log.tsx`: Anslut, jämförelse, variantval, Diagnostik och logg.

`lab/data/` (eller `LAB_STUDIO_DATA_DIR`) innehåller lokalt projekt, social
policy, `videos/index.json`, uppladdade bytes och `videos/classifications.json`.
Kategorisering av original är en hashbunden metadataöverlagring. Filerna är
Git-ignorerade. Uppladdning sparar filmen direkt; **Spara projekt** sparar
variantkoppling, urvalstillåtelser och triggers. Källkodspush delar inte dessa
lokala filmer. Dokumentera granskad överlämningsplats med takepaketet.

Händelselogg/observationsprotokoll är flikminne och behöver export före reload.
Privata QA- och användarloggar stannar utanför Git och publika wiki/webb.

`tools/start-local-comparison.mjs` kör spelet och byggt labb med temporära
databaser/processinställningar. Inga användar-env ändras; externa providers
blockeras i provprocesserna. `test/local-comparison-browser.mjs` använder
denna fixture för verklig lokal rundtrafik och ett märkt syntetiskt chattsvar.

## OpenClaw och nästa integrationskontrakt

`open-claw/lab/schemas/event.schema.json`, `catalog.schema.json` och
`open-claw/lab/config/catalog.json` är befintliga Director-format/katalog.
För Gateway/runtime börjar man i `open-claw/lab/docs/README.md`.
`lab/lib/presentation-director.mjs` äger gemensamma labbeslut; samma tjänst
används av eventprov och sekvensspelare. Den äger inte ännu all produktspeech.

[OPENCLAW-SPEECH-OWNERSHIP.md](OPENCLAW-SPEECH-OWNERSHIP.md) är den gemensamma
implementationsbriefen. Den skiljer Jakobs samtals-/talbeslut från Kevins kö
och Emil/Kevins läppsynkleverans. Föreslagna talfält är inte ett nytt aktivt
API-schema förrän Kevin implementerat och verifierat adaptern.

[Take-mallen](templates/media-take.md) används för review/proveniens. Den är
mänskligt granskningsunderlag, inte validering som dagens upload-API redan gör.
