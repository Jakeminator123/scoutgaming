# Astrids röst och lipsync — 2026-09-29

Jakob rapporterade robotröst och utebliven läppsynk i Render-spelet.

## Rotorsak och historik

`web/public/astrid-voice-profile.mjs` är identisk i `Jakobs-v1`
(`600093e4`, sista bevarade GitLab-baslinjen) och `e0dc37fb`:
Victoria, Cartesia `sonic-3.5`, röst `dc30854e-e398-4579-9dc8-16f6cb2c19b9`.
Profilen infördes i `57a3f00f` den 28 september. Den historiska handoffen
verifierade lokalt aktiverad generering och ett 52,9 sekunders GPU-prov.
Ingen röstprofil har ändrats genom GitHub-flytten; ingen GitLab-kontakt behövdes.

`playChatDecision` använde däremot `playNeutralTts` när ett genererat
textbeslut saknade `speechPackage` och `speechStream`. Den funktionen
anropar webbläsarens `SpeechSynthesisUtterance` utan vald röst. Det är
en annan röst än Victoria och den vägen skapar ingen läppsynkvideo.
Fallbacken fanns även i GitLab-versionen.

Vid senaste runtimekontrollen var genererat tal avstängt på Render.
Whisper transkriberar spelarens röst; Terra formulerar svar. Ingendera
väljer ljudrösten eller aktiverar RunPod-video.

## Rättning

Astrids genererade svar utan matchande videopaket/ström visas nu som text,
med statusen **Astrids röstvideo saknas. Svaret visas som text.** Den vägen
anropar ingen browserröst. Giltiga paket/strömmar går fortfarande genom
samma verifierande spelare. Övriga tre dealers behåller sitt befintliga
beteende. Inspelade original, röstprofil, kalibrering och policyer ändras inte.

## Återstår

- Denna rättning aktiverar inte lipsync eller betalda jobb. Victoria-vägen
  kräver fungerande Cartesia/RunPod-konfiguration och båda opt-in-flaggorna
  `CROUPIER_GENERATED_SPEECH=1` och `CROUPIER_CLOUD_GENERATED_SPEECH=1`.
- Kostnadsstyrning och ett avgränsat prov i verkliga produktspelaren behövs
  före bred aktivering. Det tidigare godkända taket är 10 USD/dag; min 0/max 1
  worker utgör inte i sig en automatisk dygnsbudget.
- Det separata talprovet den 29 september tog 52,5 sekunder. Strömning,
  varm latens och full audiovisuell acceptans är fortfarande oprövade.
- Riktade regressioner kör verklig `playChatDecision` med isolerade
  mediafunktioner: Astrid saknar röstpaket, giltigt paket/ström och de andra
  tre dealergrenarna. De ersätter inte visuell rehearsal och ljudgranskning.

Se [GPU-kvittot](ASTRID-GPU-CLOUD-TEST.md) och
[gemensam driftkarta](CLOUD-CURRENT-STATE-2026-09-29.md).
