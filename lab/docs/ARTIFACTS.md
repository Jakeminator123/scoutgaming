# Artefaktkarta · labb, 2D, produktvideo och OpenClaw

V5, 21 september 2026. Användarguiden finns fortsatt i `guide.json` och Guide.
Den här kartan visar tekniska källor och ägare; den skapar inget andra
medieregister. [Sprinten](../../docs/animation-events/v5-8-days-mvp/README.md)
är plan och handoff, inte runtimekonfiguration.

## Format och policy i labbet

- `lab/schemas/studio.schema.json`: sparat projekt, linjer, triggers, varianter.
- `lab/schemas/video.schema.json`: kategorisering; exakt situation för tal/kort.
- `lab/schemas/social.schema.json`: Astrids avgränsade sociala policy.
- `lab/policies/studio-contract.json`: gemensamma ID:n, situationer, ordlista,
  tillåtna urval och gränser. Kontrakt och schema ska stämma överens.
- `lab/policies/project.seed.json`, `social.seed.json`: startprojekt/policy.
- `lab/animations/`: 64 delade eventrörelser och separat social 2D-rörelse.
  Pose-spår är mockup, inte video eller läppsynk.

## Media och deras befintliga manifest

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

`lab/data/` (eller `LAB_STUDIO_DATA_DIR`) innehåller lokalt projekt, social
policy, `videos/index.json`, uppladdade bytes och `videos/classifications.json`.
Kategorisering av original är en hashbunden metadataöverlagring. Filerna är
Git-ignorerade. Uppladdning sparar filmen direkt; **Spara projekt** sparar
variantkoppling, urvalstillåtelser och triggers. Källkodspush delar inte dessa
lokala filmer. Dokumentera granskad överlämningsplats med takepaketet.

Händelselogg/observationsprotokoll är flikminne och behöver export före reload.
Privata QA- och användarloggar stannar utanför Git och publika wiki/webb.

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
