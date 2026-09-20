# OpenClaw-instruktioner, situationer och röstprov

Den här senare iterationen bygger vidare på [systemkartan](systemkarta/README.md).
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

Drift- och testresultat kompletteras efter omdeploy och verkligt anslutningsprov.
