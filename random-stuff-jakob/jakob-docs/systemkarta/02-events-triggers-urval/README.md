# Events, triggers och urval

[Till systemkartan](../README.md) · [Nästa: videornas täckning](../03-dealers-video-takes/README.md)

**Kodkontrollerat:** Partner-adaptern har sex presentationstyper:
`speak`, `deal`, `reveal`, `turn`, `settle`, `idle`. Studions 16 noder
klassificerar dem. **10 interna typer + 6 presentationstyper är inte hur
de 16 labbnoderna bildas.**

| Presentationstyp | Labbets undergrupper |
| --- | --- |
| `speak` | `goodluck`, `insurance`, `double`, `other` |
| `deal` | `player.left`, `player.centre`, `player.right`, `dealer` |
| `reveal` | `dealer` |
| `turn` | `player` |
| `settle` | `blackjack`, `dealerBust`, `win`, `push`, `other` |
| `idle` | `ready` |

En nod är en grov ingång. Konkret destination, hand/kortposition och exakt
talrad avgör vad som behöver presenteras. En video till fel kortmål blir
inte användbar för att den har en passande social trigger.

Den senare labbleveransen `0a1f9cb` visar konkreta situationsfält före
variantval i nodträdet. Det är ett UI-förtydligande inom befintligt kontrakt;
inga takepooler eller fullständiga produktfilter infördes. Se
[den daterade leveransen](../../arkiv/2026-09-20/2026-09-20-openclaw-instruktioner-och-rostpanel.md).

**Förslag för produktens framtida register:**

```text
Publik händelse + konkret situation
    ↓
Kompatibelt, granskat material för rätt dealer/mål/exakt tal/sekvens
    ↓
Standardfamilj + alternativa uttrycksfamiljer
    ↓ triggers prövar om ett alternativ är tillåtet
Regel eller giltigt modellråd väljer familj
    ↓
En kompatibel take väljs → uppspelning eller uttryckligen definierad säker fallback
```

Triggers är villkor, inte nya motorhändelser eller egna filmer. Ett alternativ
kan dela trigger med andra alternativ. Flera triggerreferenser betyder AND.
En standardfamilj kan i förslaget ha flera takes utan sociala specialvillkor.

En obligatorisk standardpost är en konfigurationsfallback, aldrig dispens
från rätt dealer, mål, exakt tal eller sekvens. En familj utan kompatibla
takes får inte väljas som film. Saknas giltig film behövs en uttryckligt
definierad säker presentation; en ungefärligt passande film räcker inte.

**Labb i dag:** en variant har ett `assetId` och högst ett
`videoGenerationId`. Noden väljs genom första match i katalogordning.
`rules` väljer högst prioriterade tillåtna variant; `active` kan acceptera
ett giltigt OpenClaw-råd. `off` spelar standard och `shadow` behåller standard
även när råd finns. Giltig trigger eller modellråd bevisar inte videotäckning.
Dagens labb garanterar inte det framtida kontraktet för täckning och takes.

De nio starttriggers som finns är `returning-player`, `preferred-german`,
`recent-losses`, `chat-praise`, `chat-boundary`, `recent-wins`, `warm-mood`,
`calm-mood`, `playful-mood`. Chatt, historik och framtoning är simulerad
kontext. De fem ytterligare triggerexemplen i eventregistret är förslag.

`settle` och `speak` är separata presentationer. Resultatgruppen får inte
byta ut exakt `speak.line`. Särskilt `speak.other` omfattar flera repliker
och kan inte säkert bindas till en gemensam inspelad talvideo.

Läs [situationer och urvalsordning](../../2026-09-20-situationer-variantfamiljer-och-takes.md),
[hela nod-/triggerregistret](../../2026-09-20-eventregister-och-mental-modell.md),
[studio-modellen](../../../../lab/lib/studio-model.mjs),
[Director-motorn](../../../../open-claw/lab/src/engine.mjs) och
[kompatibilitetsgränsen](../../../../lab/COMPATIBILITY.md).
Takepooler, viktat takeval, cooldown och kö för extra reaktioner återstår.
Fältmismatchen `split`/`splitFrom` har en egen post, F-005, i
[findings-registret](../../../../docs/findings/REGISTER.md). Den är ett
granskningsbehov, inte en fix levererad genom dokumentationen.
