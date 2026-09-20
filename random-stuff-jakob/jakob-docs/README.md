# Jakobs dokumentation

**Ny gemensam startyta: [Guide i labbet](http://127.0.0.1:4188/guide).**
Arbetsgång och gemensamma begrepp uppdateras i [lab/docs](../../../lab/docs/README.md).
Materialet nedan behålls som fördjupning, historik och stabila källankare.
Skapa inte en andra användarguide här. Privata anteckningar ingår inte i flytten.

Fördjupning finns i [systemkartan](systemkarta/README.md) för att förstå delarna och deras
samband. Daterade leveranser finns i [arkivet](arkiv/README.md). Öppna buggar,
förbättringar och granskningsbehov samlas i repots [findings](../../docs/findings/README.md).

```text
jakob-docs/
├── README.md                         Start och dokumentationsregler
├── systemkarta/                      Ämnesindelad systembeskrivning
├── 2026-09-20-eventregister-…md       Aktiv registerreferens, daterat källankare
├── 2026-09-20-situationer-…md         Aktiv begreppsmodell
└── arkiv/
    ├── README.md                     Index och gamla → nya sökvägar
    └── 2026-09-20/                   Arbetsrapporter, kvitton och historisk prompt

../../docs/findings/                  Gemensamt för hela repot
```

## Aktiva modeller

- [Situationer, variantfamiljer och takes](2026-09-20-situationer-variantfamiljer-och-takes.md):
  spel → dealer → presentationsbehov → konkret situation → variantfamilj → kompatibel take.
- [Eventregister och mental mappmodell](2026-09-20-eventregister-och-mental-modell.md):
  interna händelser, presentationstyper, labbnoder, triggers och JSON-förslag.

Dessa två dokument är aktiva referenser med daterad faktagrund. Deras stabila
sökvägar behålls; situationsmodellen refereras av OpenClaws versionsmärkta
kunskapspaket. Senare driftuppgifter finns i systemkartans
[OpenClaw-del](systemkarta/05-openclaw-rost-och-drift/README.md).

## Var nytt material hör hemma

| Material | Placering |
| --- | --- |
| Daglig arbetsgång och gemensamma begrepp | `lab/docs/guide.json` och `lab/policies/studio-contract.json`, visas i Guide |
| Teknisk fördjupning med källa och verifieringsdatum | Befintlig ämnesreferens; länka från Guide vid behov, skapa inte en konkurrerande startyta |
| Bugg, förbättring eller obesvarad kontroll | [Findings-registret](../../docs/findings/REGISTER.md), med stabilt ID och underlag |
| Vad en uppgift gjorde och testade vid en viss tidpunkt | `arkiv/ÅÅÅÅ-MM-DD/`, länkat från arkivindexet |
| Gemensamt leveranskvitto | [JOHN-HANDOFF](../../docs/JOHN-HANDOFF.md), kort notis med länkar |
| Beslut och samarbete | [GitLab-wikin](https://gitlab.com/scout-gg/croupier/-/wikis/home) och [inboxguiden](../../docs/shared/AGENT-INBOX.md) |
| Implementation och QA-status | Jira CAC; findings pekar dit när ett issue finns |

Arkivering betyder att en rapport är historiskt underlag, inte att dess
öppna problem är lösta. Lyft först bestående kunskap och öppna fynd, bevara
sedan rapporten med datum och källrevision. Uppdatera inkommande och utgående
länkar vid flytt. Gamla Git-permalänkar är fortfarande historiska källor.

Det tidigare rotindexets löpande anteckningar är bevarade i
[indexet före arkivering](arkiv/2026-09-20/index-fore-arkivering.md).
Privata loginnoter, hemligheter och konversationsexporter ingår inte i arkivet.
