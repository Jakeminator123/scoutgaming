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
| Social labbchatt | Isolerad Astrid-roll, sparad social policy och idle-reaktion; inte produktchatten |
| ElevenLabs-röstprov | Lokal MP3-cache; explicit talval i social labbchatt eller manuell röstpanel |
| IDE-agenternas inbox | Samarbete om projektet; separat från alla ovanstående runtime-samtal |

**Senaste verifierade drift:** [socialchatt-leveransen](../../arkiv/2026-09-20/2026-09-20-astrid-social-chatt.md)
har Director och Gateway på `6797b6a`, upstream fortsatt `2026.9.5`.
Rådgränsen är **8000 ms**. Interaktiv social chatt har separat 30-sekundersbudget,
talprov egen gräns. Sociala fasta/fria svar och verkligt ElevenLabs-tal har provats.
Äldre `0a1f9cb`/`7f056f7` är historiska verifieringssteg, inte nuvarande deploy.

Ett versionsmärkt [runtimepaket](../../../../open-claw/lab/deploy/runtime-bundle/README.md),
`2026-09-20.2`, installerar korta rollinstruktioner och källsammanfattningar
i agenternas arbetsytor via hanterade `AGENTS.md`-block. Manuella texter
bevaras. Paketet är medvetet begränsat: ingen extern crawl, vektordatabas
eller automatisk tillgång till hela Git-repot ingår.

Studions manuella röstpanel kan generera tre exempel, egen text eller ett
kopierat operatörssvar via ElevenLabs. Samma text/röst/modell/inställningar
återanvänder `lab/data/voice-cache/`. Ett knapptryck kan använda krediter;
talprovets cache är separat från äldre CLI-provens `voice-previews/`.
Det tidigare röstprovet hade problem i Codex-webview. Senaste sociala leveransen
har både Chrome-prov och synlig rörelse/ljudstart i Codex-webview.

Eventstudion har nu ett verkligt, isolerat **spelarchattprov** för Astrid i
vänteläge: sparad policy → OpenClaw `croupier-social` → validerad text/reaktion
→ valfritt exakt ElevenLabs-tal och syntetisk rörelse. [Användarguide](../../../../lab/SOCIAL-CHAT.md).
Produktchatten, moderering, bestående spelarminne, produktspelarens adapter
och ny lipsync-acceptans återstår. Ett framtida dealerprofilpaket (t.ex. SOUL.md)
ska beskriva personlighet; det är inte samma sak som testkontext eller spelarminne.
OpenClaw får använda avgränsade minnesuppgifter när den kopplingen byggts;
spelet behåller alltid kort, regler och utfall.

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

- [Senare nod-/Render-notering](../../arkiv/2026-09-20/2026-09-20-nodtrad-rorelser-anslutning.md)
- [Röstprov och urvalsmodell](../../arkiv/2026-09-20/2026-09-20-rostprov-och-urvalsmodell.md)
- [Senare runtimepaket och röstpanel](../../arkiv/2026-09-20/2026-09-20-openclaw-instruktioner-och-rostpanel.md)
- [Variablernas namn och placeringar](../../../../_ENVIROMENT-INFO.md)
- [Driftguiden](../../../../open-claw/lab/docs/DEPLOYMENT.md) och [dashboard-guiden](../../../../open-claw/lab/docs/DASHBOARD-SV.md)
- [Äldre OpenClaw/labb-guide](../../../../open-claw/lab/README.md), vars editor och katalog är separata

Äldre guider har kvar tidigare steg där modellprov anges som återstående.
Använd den senare daterade leveransrapporten för vad som därefter provades;
anta inte att alla andra öppna integrationsfrågor därmed är lösta.
