# Scoutgaming: ordlista

Vad orden betyder i produkten i dag. Det är en ordlista, inte en kravlista:
den låser varken flöden eller framtida förenkling av Admin. Läget och nästa
steg står i [överlämningen](../../../docs/NEXT-AGENT.md), arbetsstegen i
[användarguiden](README.md) och tekniska format i
[runtime-referensen](../../../docs/LOCAL-PRESENTATION-RUNTIME.md).

## Ytor

- **Admin** (`/admin`): personalens arbetsyta för dealers, klipp, bolag, rum och drift.
  `/studio` är bara den tekniska sökvägen till samma app, ingen egen produkt.
- **Partnerportalen** (`/partner`): bolagets egen yta för sina rum.
- **Lobby** (`/lobby`) och **spel** (`/blackjack`): spelarens väg.

## Det man skapar och publicerar

- **Dealer**: en person med sitt eget klippbibliotek.
- **Bolag** (operatör, `operator` i koden): spelbolaget, till exempel Johns Bet.
- **Rum**: bolagets ingång till ett spel, med eget ID.
- **Mall** (heter i dag "Sammansättning" eller "Spelmall" i Admin och `lane` i
  koden): samlar dealer, bord, bakgrund, placering och tillåtna val. Flera rum
  kan använda samma mall. Att ett rum är valt gör inte en ändring i mallen
  rumsspecifik.
- **Paket**: bolagets publicerade mallar, frysta med ett revisionsnummer.
  Spelet läser bara paketet, aldrig utkast.
- **Spelinställningar** (`room game config`): rummets språk, insatsnivå och
  tider. De publiceras per rum och binds till paketets revision.
- **Publiceringsordning**: godkänn tal, publicera paketet, publicera rummets
  spelinställningar.

## Scenen

Bakgrund, dealer och bord är tre lager; spelets kort och knappar ligger
överst. Ny bakgrund skapar varken ny dealer eller nytt rum. Ett lager som är
inbakat i en dealerfilm kan inte bytas separat. Presentationen påverkar aldrig
kort, regler eller saldo: dem äger spelmotorn.

## Klipp

- Klippkartan ordnar en dealers klipp som kategori, situation, standardklipp
  och varianter. Tekniska poseversioner är inte varianter.
- **Spelhandlingar**: utdelning till box 1–7, dealerns egna kort, dolt kort,
  kortvändning samt till och från skon.
- **Vila** (idle): en basloop och beteendeklipp, som blickar och nickningar,
  som återgår till vila.
- **Talade repliker**: allt där dealern talar. Situation, språk och exakt
  text, ljud och bild hör ihop. En replik kan ha flera tagningar; den valda
  tagningen är standard i talfacket.
- Tur och resultat avgör när ett klipp körs; de är inga egna kategorier.
- Automatik och OpenClaw får välja bland kompatibla beteenden och varianter,
  men ändrar aldrig spelhandlingen eller utdelningspositionen.

## Vem väljer vad

Admin bestämmer vilka mallar ett bolag får använda. Bolaget och spelaren kan
få välja inom det när rummet tillåter det, och varje val kan låsas till ett
förval. Det är en möjlighet, inget krav: ett bolag med ett rum och en mall
behöver inga val alls.
