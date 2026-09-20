# OpenClaw, röst och drift

[Till systemkartan](../README.md) · [Nästa: arbetssätt och verifiering](../06-arbetssatt-och-verifiering/README.md)

OpenClaw är en möjlig rådgivare inom tillåtna presentationsalternativ.
Det producerar inte spelutfall och är inte en egen triggerkälla. Kod
prövar villkoren och validerar rådet; saknat eller ogiltigt råd ger standard.

```text
Lokal Next-studio i lab/
    ↓ lokal server, tillfällig katalog och tillåten kontext
Render Director i open-claw/lab/
    ↓ privat anslutning
OpenClaw Gateway → modellleverantör
    ↓ variant-ID
Kodvalidering → labbanimation eller separat originalpreview
```

| Del | Ansvar och gräns |
| --- | --- |
| Lokal studio | Redigerar lokalt projekt och testar presentationer |
| Director | Beslutskontrakt, rådskontroll, operatörschatt och dashboard-ingång |
| Privat Gateway | Kör OpenClaw och ansluter till konfigurerad modell |
| Native dashboard | Administrationsyta; separat från studio och spelarchatt |
| ElevenLabs-provverktyg | Fristående röstprov; ännu inte automatisk röst i studion |
| IDE-agenternas inbox | Samarbete om projektet; separat från alla ovanstående runtime-samtal |

**Tidigare verifierat 20 september:** Director `7f056f7` gav riktigt aktivt
variantval, shadow-råd med standarduppspelning och operatörschattsvar via
lokal studio. Ett första rådanrop nådde 2,5-sekundersgränsen och använde
fallback; senare prov lyckades. Detta är ett daterat anslutningsprov.
Kartan gör inga nya modell-, deployment- eller tillgänglighetskontroller.

Det senare fristående ElevenLabs-provet gav en svensk Sarah-MP3 och sparade
exakt text, röst-/modell-ID och hash lokalt. Det är bevis för det anropet,
inte för automatisk röst, godkänt uttal eller läppsynk i en dealerfilm.
Riktig spelarchatt, moderering, spelarminne och produktspelarens variantadapter
återstår enligt de aktuella handoffnotiserna.

Driftfilerna ligger kvar i `open-claw/lab/`, med
[render.yaml](../../../../open-claw/lab/render.yaml).
Blueprinten omfattar Director och privat Gateway; den nya Next-studion är
lokal. [Gateway-Dockerfilen](../../../../open-claw/lab/deploy/Dockerfile.gateway)
är låst till `2026.9.5` och digest i den lästa koden. Ingen uppgradering görs här.

Börja alltid en ny teknisk OpenClaw-fråga i
[det lokala dokumentationsindexet](../../../../open-claw/lab/docs/README.md).
Det pekar på officiella källor och den version projektet använder. Ingen
automatisk dokumentcrawl eller dokumentations-MCP ingår i detta flöde.

Fortsatt läsning:

- [Senare nod-/Render-notering](../../2026-09-20-nodtrad-rorelser-anslutning.md)
- [Röstprov och urvalsmodell](../../2026-09-20-rostprov-och-urvalsmodell.md)
- [Variablernas namn och placeringar](../../../../_ENVIROMENT-INFO.md)
- [Driftguiden](../../../../open-claw/lab/docs/DEPLOYMENT.md) och [dashboard-guiden](../../../../open-claw/lab/docs/DASHBOARD-SV.md)
- [Äldre OpenClaw/labb-guide](../../../../open-claw/lab/README.md), vars editor och katalog är separata

Äldre guider har kvar tidigare steg där modellprov anges som återstående.
Använd den senare daterade handoffen för vad som därefter faktiskt provades;
anta inte att alla andra öppna integrationsfrågor därmed är lösta.
