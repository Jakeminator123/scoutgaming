# Canvas · V3-eventträdet

> Diagrammet skiljer verifierad Croupier-runtime från Jakobs förslag och Kevin + Emils videoflöde. Det är en mänsklig dokumentationsyta och ändrar inga branches eller agentregler.

## Helheten

```mermaid
flowchart TD
  K["Kevin äger Croupier-motorn<br/>RNG · state · saldo · payout"]
  C{"Table command<br/>start · act · insurance · collect"}
  V["Publicerad round view<br/>phase · hands · dealer · legalActions"]
  P{"presentation[]"}

  E1["deal"]
  E2["reveal"]
  E3["turn"]
  E4["settle"]
  E5["speak"]
  E6["idle"]

  J["Jakobs läsande adapter/eventträd<br/>separerat på jakeminator123/work"]
  T{"Publicerad trigger sann?"}
  B["Baspresentation"]
  W["Tillåten variant"]

  M["Kevin + Emil<br/>godkända takes och metadata<br/>på Kevins branch"]
  G{"Katalog · status · hash<br/>kalibrering · landning"}
  X["Spela godkänd take"]
  F["Fallback<br/>annan kandidat → bas → neutral → UI-only"]
  D{"Etappbeslut med Kevin"}

  K --> C --> V --> P
  P --> E1
  P --> E2
  P --> E3
  P --> E4
  P --> E5
  P --> E6

  E1 & E2 & E3 & E4 & E5 & E6 --> J
  J --> T
  T -- nej --> B
  T -- ja --> W
  M --> G
  B --> G
  W --> G
  G -- giltig --> X
  G -- saknas eller underkänd --> F
  X --> D
  F --> D

  classDef runtime fill:#dbeafe,stroke:#2563eb,color:#111827,stroke-width:2px;
  classDef proposal fill:#fef3c7,stroke:#d97706,color:#111827,stroke-width:2px;
  classDef media fill:#dcfce7,stroke:#16a34a,color:#111827,stroke-width:2px;
  classDef decision fill:#f3e8ff,stroke:#9333ea,color:#111827,stroke-width:2px;

  class K,C,V,P,E1,E2,E3,E4,E5,E6 runtime;
  class J,T,B,W proposal;
  class M,G,X,F media;
  class D decision;
```

## Ett avgränsat exempel: resultat med flera videor

Det här exemplet visar formen användaren efterfrågade: ett event kan leda till tre basvideor eller två varianter med två videor vardera. Antalen, namnen och triggernivåerna är **Jakobs förslag**, inte nuvarande runtime.

```mermaid
flowchart LR
  S["VERIFIERAT<br/>presentation: settle"]
  N["JAKOBS FÖRSLAG<br/>semantisk nod: round-result"]
  Q{"Vilka publicerade triggers<br/>är sanna?"}

  BASE["Bas · 3 godkända takes"]
  B1["result-base-a"]
  B2["result-base-b"]
  B3["result-base-c"]

  VA["Variant A · 2 takes"]
  A1["result-a-1"]
  A2["result-a-2"]

  VB["Variant B · 2 takes"]
  C1["result-b-1"]
  C2["result-b-2"]

  SAFE["Katalogkontroll + säker fallback"]

  S --> N --> Q
  Q -- ingen --> BASE
  Q -- trigger A --> VA
  Q -- trigger B --> VB
  BASE --> B1 & B2 & B3
  VA --> A1 & A2
  VB --> C1 & C2
  B1 & B2 & B3 & A1 & A2 & C1 & C2 --> SAFE
```

## Färgförklaring

- **Blå:** verifierat i Croupier på revisionen i `RUNTIME-EVIDENCE.md`.
- **Gul:** Jakobs separata förslag.
- **Grön:** Kevin + Emils video-/assetflöde och fallback.
- **Lila:** mänsklig etappgrind där Kevin fattar integrationsbeslut.
