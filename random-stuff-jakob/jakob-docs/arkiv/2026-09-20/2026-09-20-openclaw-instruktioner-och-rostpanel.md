> Arkiverad arbetsrapport/prompt från 20 september 2026. Uppgifter och instruktioner är daterat underlag; arkivering innebär inte att öppna frågor är lösta. Se [arkivindexet](../README.md), [systemkartan](../../systemkarta/README.md) och [findings](../../../../docs/findings/README.md) för fortsatt läsning.

# OpenClaw-instruktioner, situationer och röstprov

Den här senare iterationen bygger vidare på [systemkartan](../../systemkarta/README.md).
Inga RNG-regler, produktvideor eller sparade labbprojekt ändras.

- **Nodträdet:** konkret situation visas före variantval. Kortplats, hand och
  exakt talrad är inte samma sak som uttryck. Triggers väljer före uppspelning;
  OpenClaw är en rådgivare, inte en tredje triggerkategori eller nästa videoklipp.
- **Instruktioner:** ett versionsmärkt paket läggs i OpenClaws agentarbetsytor.
  En kort roll-/källsammanfattning laddas med agentens `AGENTS.md`.
  Manuella instruktioner bevaras; konflikter rapporteras, inte tyst överskrivs.
- **Dokumentationsindex:** kontrollerade officiella länkar och sökord, inte en
  automatisk internetcrawl eller vektordatabas. Externa sidor läses vid behov.
  Agenter utan läsverktyg har den korta sammanfattningen, inte automatisk
  åtkomst till hela Git-repot eller din dator.
- **Testgräns:** 8 sekunder för presentationsråd. Operatörschatt och talprov har
  egna 30-sekundersgränser. Timeout ger standard; det är ingen garanti om
  spelklar svarstid. `lab-provider` är vårt lokala namn på modellleverantören.
- **Röstprov:** OpenClaw-sidan i lokala studion har Välkommen/Godkväll/Tjena,
  egen text och möjlighet att kopiera senaste operatörssvaret. Knappen skickar
  texten till ElevenLabs; samma text/röst/modell återanvänder lokal MP3-cache.
  Ingen ny API-nyckel på Render behövs för detta lokala prov.

## Tal och video framåt

Ja: standardfraser som förgenererade, återanvändbara ljudvarianter och separat
live-genererat tal för chatt är en rimlig riktning. Koppla ett talbehov till
exakt text och rätt spelsituation, sedan till en kompatibel ljud-/videotake.
Ett live-svar kan provas separat med 2D-figuren; lägg inte nytt ljud ovanpå en
gammal inspelad mening eller loopa dess munrörelser.

**Inte levererat här:** riktig spelarchatt, automatiskt spelarminne, automatiskt
live-tal, lipsync, procentslumpade takepooler eller komplett kompatibilitetsfilter
för produktvideor. De tre fraserna är labbexempel, inte nya motor-events eller
ersättningar för den exakta `speak.goodluck`-raden.

## Verifierat efter omdeploy

GitLab-arbetsbranchen: `jakeminator123/work`. Både Director och OpenClaw blev
live på `0a1f9cb`; den låsta upstream-versionen är fortfarande **2026.9.5**.
Vi har uppdaterat vår integration och instruktioner, inte bytt OpenClaw-release.

- Blueprint-synk ändrade väntetiden till **8000 ms**, verifierat i Directors API.
- Alla tre roller fick paket `2026-09-20.1`, hash
  `d4008a2d889f447ecf79a907de1511d46ce97ff40cd6acd9c61f5e77ade0459f`.
  Ingen konflikt eller budgetvarning i startloggen; `contextInjection: always`.
- En ny chatt via hela kedjan svarade med rätt paketversion, officiella källor
  och gränser (cirka 4,8 s). Aktivt råd godkändes på cirka 2,0 s; shadow gav råd
  men behöll standard på cirka 1,9 s. Ett prov under själva omstarten fick 503;
  det räknas inte som ett lyckat modellsvar.
- Alla tre korta standardfraser finns nu som verkligt genererade lokala MP3-prov.
  Välkommen-provet spelade färdigt i Chrome (2,229 s, inget ljudfel).
  Cacheåterbruk verifierades i panelen. Codex inbyggda webbvy kraschade vid play;
  använd vanlig Chrome för ljudprovet tills den separata webbvysfrågan är löst.
- Tester: labb **138/138**, OpenClaw/Director **79/79**, typecheck och produktionsbygge.
  Oberoende kodgranskning fann och fick rättat en återstartskant före deploy.

En liten följdrättning låter labbsidan öppnas direkt från en extern länk i
Chrome utan fel eller manuell omladdning (verifierat efter nytt bygge);
API-kontrollerna behåller samma avgränsning.
Inga nycklar roterades, inga originalvideor eller sparade projekt ändrades.
Generering som redan skickats till ElevenLabs kan fortfarande debiteras om
man lämnar sidan; cacheåterbruk gör däremot inget nytt leverantörsanrop.
