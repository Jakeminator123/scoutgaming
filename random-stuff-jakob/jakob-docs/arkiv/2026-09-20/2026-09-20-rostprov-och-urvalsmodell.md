> Arkiverad arbetsrapport/prompt från 20 september 2026. Uppgifter och instruktioner är daterat underlag; arkivering innebär inte att öppna frågor är lösta. Se [arkivindexet](../README.md), [systemkartan](../../systemkarta/README.md) och [findings](../../../../docs/findings/README.md) för fortsatt läsning.

# Röstprov och urvalsmodell

## Verifierat idag

- Rotens två ElevenLabs-variabler finns och har samma värde. Inga värden
  skrivs här, ändras eller flyttas till Render.
- ElevenLabs gav HTTP 200 för standardrösten **Sarah** och för ett svenskt
  TTS-prov: 84 471 byte, MP3 44,1 kHz mono, 5,201 sekunder. Hela TTS-anropet
  tog 2 506 ms i just detta prov. Ingen subjektiv röst-/uttalsbedömning gjord.
- `tools/elevenlabs-lab-preview.mjs --check` listar rösten; `--generate`
  gör ett nytt debiterbart prov med fast text. MP3 + metadata (exakt text,
  voice/model-ID, hash) ligger i lokala `lab/data/voice-previews/`.
- **Inte ännu inkopplat i scener eller chatt.** Att lägga en nyckel i `.env`
  installerar ingen sådan integration. Ingen ny röst läggs på befintlig film.
- 64 tysta 2D-rörelser finns sedan tidigare i `lab/animations/`; inte 64
  talande/lipsynkade filmer. 114 labbtester passerar, varav sex för provverktyget.

[Officiellt TTS-API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert),
[standardröster](https://elevenlabs.io/docs/api-reference/voices/search).

## Varför OpenClaw kunde hinna för sent

Tidigare `openclaw_timeout` kom från Directors 2 500 ms-gräns för
Gateway/modellanropet inklusive hela svaret. Lokal relay har normalt 4 000 ms;
operatörschatten har separata 30/32 sekunder. Senare råd/chatt fungerade.
Ingen separat mätning av nätverk, Gateway och modell finns från timeouten,
så orsaken är inte bevisat en kallstart eller en långsam modell.
ElevenLabs ingick inte i det anropet. Ingen tidsgräns ändrad nu.

## Jakobs idé — rimligt förslag, inte infört

`Presentationsbehov → standardfamilj eller triggad variantfamilj → ett take → uppspelning`.

- Tre likvärdiga, kompatibla takes kan ha vikter `1:1:1`, alltså exakt en
  tredjedel vardera. Det är presentationsslump, separat från spelets RNG.
- Triggers avgör **vilket alternativ som får väljas**. De är inte egna
  klipp eller automatiskt något som händer efter den första videon.
- En trigger kan peka på en familj med flera takes, eller en familj med ett.
  Det undviker en extra väg med annan validering/fallback.
- OpenClaw är en möjlig rådgivare i urvalet, inte en tredje sorts trigger.
  Alla event kan gå genom mellanlagret utan att varje event gör ett LLM-anrop.
- Ersättning av samma presentation och en **extra reaktion efteråt** är två
  olika saker. Det senare behöver separat kö/tidsbudget och finns inte nu.

Nu finns ett animations-ID och högst ett video-ID per variant. Regelläget
väljer högsta tillåtna prioritet; aktiv OpenClaw får föreslå ett tillåtet
variant-ID. Inga takepooler, procentsannolikheter eller extra reaktionsköer
har implementerats. Nodträd, projekt och scheman är oförändrade denna gång.

## Det Kevin-systemet fortfarande bestämmer

Motorns eventordning, kort/box/hand, dold information, RNG och resultat får
inte ändras av presentationen. Sju boxar är kortmål; vänster/mitten/höger
är bara grupperingar av dem. Tal måste kopplas till rätt `speak.line` och
matchande text/ljud/video. `Lycka till / speak.goodluck` är inte ett nytt
välkomstevent bara för att labbets redigerbara etikett säger Standardhälsning.

Verklig klipplängd läses ur media; labbets syntetiska millisekunder är inte
fri retiming av inspelningar. Idle kan få uttryckligen godkända loopar,
medan tal och spelhandlingar inte får loopas godtyckligt. En ny röst till
2D-figuren kan vara ett separat labbspår, utan påstående om riktig lipsync.
Produktens slutliga koppling och takepolicy behöver fortfarande Kevin-avstämning.
