# Scoutgaming: ordlista

Vad orden betyder i produkten i dag. Det är en ordlista, inte en kravlista:
den låser varken flöden eller framtida förenkling av Admin. Ett ord per
begrepp i text; kodens namn står inom parentes en gång och ändras inte.
Läget står i [överlämningen](../../../docs/NEXT-AGENT.md), arbetsstegen i
[användarguiden](README.md) och tekniska format i
[runtime-referensen](../../../docs/LOCAL-PRESENTATION-RUNTIME.md).

## Ytor

- **Admin** (`/admin`): personalens arbetsyta för dealers, klipp, mallar,
  bolag, rum och drift. **Studio** är menydelen i Admin för material (dealers,
  klipp, scen, bord och bakgrunder), ingen egen produkt. `/studio` är bara
  appens tekniska sökväg (basePath) och `apps/studio` källkoden.
- **Partnerportalen** (`/partner`): bolagets egen yta för sina rum.
- **Lobby** (`/lobby`) och **spel** (`/game?game=…`): spelarens väg.
- **Spelmotorn** (`services/game`, Render `croupier-v3`): äger kort, sko,
  regler, saldo och utbetalningar.
- **Staging**: tillfällig provbänk med syntetiska konton fram till O03.

## Det man skapar och publicerar

- **Dealer**: en person med sitt eget klippbibliotek.
- **Bolag** (`operator`): spelbolaget, till exempel Johns Bet.
- **Rum** (`room`): bolagets ingång till ett spel, med eget ID.
- **Mall** (`lane`, `presentationLaneId`; i adresser `composition`): samlar
  dealer, bord, bakgrund, placering och tillåtna val. Admin visar den i dag
  som "Sammansättning", "Spelmall" eller "Gemensam mall". Flera rum kan
  använda samma mall; att ett rum är valt gör inte en malländring
  rumsspecifik.
- **Paket** (`operator package`): bolagets publicerade mallar, frysta med ett
  revisionsnummer. I Admin heter avsnittet "Spelmallar för bolaget". Spelet
  läser bara paketet, aldrig utkast.
- **Spelinställningar** (`room game config`, `roomGameConfigs`): rummets
  språk, insatsnivå och tider. De publiceras per rum och binds till paketets
  revision.
- **Publicering**: tal godkänns, paketet publiceras och sist rummets
  spelinställningar.

## Scenen

- **Bakgrund**, **dealer** och **bord** är scenens tre lager; spelets kort,
  marker och knappar ligger överst. Ny bakgrund skapar varken ny dealer eller
  nytt rum. Ett lager som är inbakat i en dealerfilm kan inte bytas separat.
- **Bord**: bara bordslagret i scenen, inget spelrum.
- **Delat bord** (`shared-table`, `CROUPIER_SHARED_TABLE_ENABLED`): flera
  spelare vid samma bord i spelmotorn.
- Presentationen påverkar aldrig kort, regler eller saldo.

## Klipp

- **Klipp**: en videofil i dealerns bibliotek. **Klippkartan** ordnar
  klippen som kategori, situation, standardklipp och varianter. Tekniska
  poseversioner är inte varianter.
- **Spelhandlingar**: utdelning till plats 1–7 (`box0`–`box6`), dealerns
  egna kort, dolt kort, kortvändning samt till och från skon.
- **Vila** (`idle`): en basloop och tysta beteendeklipp, som blickar och
  nickningar, som återgår till vila. "Grundloop" är samma sak.
- **Replik** (`speech line`, `speak.line`): en situation där dealern talar,
  med språk och exakt text. Text, ljud och bild hör ihop.
- **Tagning** (`take`, `takeId`): en inspelning av en replik. En replik kan
  ha flera tagningar.
- **Talfack** (`speechSlots`): replikens plats i klippkartan; den valda
  tagningen är standard i talfacket.
- Tur och resultat avgör när ett klipp körs; de är inga egna kategorier.
- Automatik och OpenClaw får välja bland kompatibla beteenden och varianter,
  men ändrar aldrig spelhandlingen eller utdelningspositionen.

## Vem väljer vad

Admin bestämmer vilka mallar ett bolag får använda. Bolaget och spelaren kan
få välja inom det när rummet tillåter det, och varje val kan låsas till ett
förval. Det är en möjlighet, inget krav: ett bolag med ett rum och en mall
behöver inga val alls.

## Ord som utgår

| Gammalt ord | Använd |
| --- | --- |
| sammansättning, spelmall, gemensam mall, lane, game lane, presentation (substantiv) | mall |
| spelrum, room (i svensk text) | rum |
| operatör, kund, spelbolag (utom som förklaring) | bolag |
| bolagspaket, partnerpaket, lane-paket | paket |
| rumskonfiguration, spelkonfiguration | spelinställningar |
| grundloop, idle (i svensk text) | vila |
| take | tagning |
| Studio som egen produkt, Lab, labbet, Control | Admin |
| Nivå 1 / 2 / 3, N1 / N2 | Admin / Partnerportalen / spelaren |
