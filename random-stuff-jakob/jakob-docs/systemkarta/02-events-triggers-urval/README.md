# Events, triggers och urval

[Till systemkartan](../README.md) · [Nästa: videornas täckning](../03-dealers-video-takes/README.md)

**Händelsen anger behovet. Situationen anger vad som måste stämma.
Varianten anger uttrycket. Taken är materialet som utför det.**

Partner har sex typer: `speak`, `deal`, `reveal`, `turn`, `settle`, `idle`.
Studions sexton noder är genvägar inom dessa typer: fyra talgrupper, fyra
delningsgrupper, en kortvändning, en turmarkering, fem resultatgrupper och
ett vänteläge. De är inte tio motor-events plus sex presentationstyper,
och deras antal anger inte hur många filmer som behövs.

## Dagens eventtest

```text
Sparat exampleEvent + manuella testvärden
    → första matchande nod
    → standard + alternativ tillåtna för valt urvalsläge och matchande triggers
    → vald variant
    → exakt bunden video när den passar, annars märkt 2D-reserv
```

Labbet prenumererar inte på ett livebord. Språk, återbesök, historikräknare,
`chat.signal` och framtoning i eventtestet är testvärden. Den separata
Astrid-chatten har riktig textinput och ett eget socialt kontrakt; dess
svar är inte automatiskt kopplade till eventtestets kontext.

Fem urvalslägen finns i studion:

- `off`: bara standard.
- `rules`: högst prioriterade tillåtna variant.
- `random`: lika sannolikhet bland standard och uttryckligen
  slumpaktiverade alternativ vars triggers matchar.
- `shadow`: modellråd registreras, standard behålls.
- `active`: ett giltigt modellråd för rätt anrop och katalog får användas.

`rules` och `random` körs lokalt; Directors grundkontrakt har
`off/shadow/active`. Presentationsslump påverkar inga kort eller pengar.
Nya alternativ börjar med automatiskt urval avstängt. Äldre projekt utan
`selection` behåller regler/modell på och slump av. Standard finns alltid.

Triggers är extra villkor. Alla valda triggers måste matcha; tom lista ger
inga extra villkor. Tillåtet urvalsläge krävs fortfarande. Ingen trigger
skapar ett spel-event, en film eller bevis på videons lämplighet.

## Gränsen till produktintegration

En produktadapter behöver först säkra exakt dealer, mål, hand/kortposition,
talrad och sekvens. Därefter kan uttryck väljas bland kompatibelt material.
Den kontrollen måste också gälla standarden. Labbet har vissa exakta
bindningskontroller, men inte full situations- och takeacceptans.

`speak.other` innehåller flera exakta repliker; samma talvideo passar inte
automatiskt alla. `settle` är separat från `speak`, och flera resultatvillkor
kan gälla samtidigt. Första matchande labbgrupp ersätter inte rundans fakta.

Takepooler, viktat takeval, generell kö/cooldown för produktreaktioner och
gemensam produktadapter återstår. Socialchattens lokala cooldown finns
redan men är ingen generell produktkö. F-005:s `split`/`splitFrom`-fynd
är fortsatt ett [öppet granskningsbehov](../../../../docs/findings/REGISTER.md).

Fördjupning: [situationer](../../2026-09-20-situationer-variantfamiljer-och-takes.md),
[fullt nod-/triggerregister](../../2026-09-20-eventregister-och-mental-modell.md),
[studio-server](../../../../lab/lib/studio-server.mjs),
[studio-modell](../../../../lab/lib/studio-model.mjs),
[Director](../../../../open-claw/lab/src/engine.mjs) och
[videobankens urvalsregler](../../../../lab/VIDEO-LIBRARY.md).
