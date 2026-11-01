# Ren start: radering i Neon och Blob

Aktiv avvecklingsplan, kodavstämd 1 november 2026 mot
`e3dbed2c17afe91deb81ff9b9e9d88264958d38f`. Ingen ny molninventering eller
dataåtgärd ingår i dokumentgranskningen. Den ersätter inventeringen den
28 oktober, vars antal, gamla kodvägar och SQL inte är en aktuell körlista.
Originalet finns med `git show e3dbed2c17afe91deb81ff9b9e9d88264958d38f:docs/plans/REN-START.md`.

## Beslut och avgränsning

- Behåll Johns Bet (`johns-bet`), rummet
  `room-76640ca1-b619-7948-596e-3d102202b7d0`, Paow, rummets använda paket,
  konfigurationer och media samt de konton Jakob använder. Den äldre
  inventeringens paketrevision 1–11 och 53 klipp är daterade bevis, inte en
  gräns som utesluter senare giltiga revisioner.
- Behåll talkedjan och Dragans dealer, talbank och bindningar som referens
  för generaliseringen. Rum och bolag utöver Johns Bet kan tas bort inom
  uppdraget först när deras verkliga tal- och mediereferenser är utredda.
- Astrid, även hennes märkta legacy-referens, ska tas bort helt enligt
  Jakobs beslut 28 oktober. Namn som `retained` eller `legacy` är inget
  nytt bevarandekrav. Avveckla konsumenterna innan underlaget tas bort.
- Övriga bolag, papperskorgsposter och oanvända media är kandidater som
  måste avgränsas med en aktuell lista. Den gamla inventeringen är inget
  mandat att radera allt utom Johns Bet.
- Spelare, saldon, transaktioner och användbara taldata omfattas inte av
  vanlig mediestädning. Genererade Paow-svar och Dragans talreferens ska
  inte försvinna som bieffekt. Ändra inga talflaggor för att städa.

Mandatet följer Jakobs aktuella uppdrag och [AGENTS](../../AGENTS.md).
Kodstädning kräver inte ett nytt ja för varje fil. Destruktiva produktdata-
och provideråtgärder följer sin uttryckliga avgränsning och återställningsplan.

## Aktuella källor och beroenden

| Resurs | Kontroll före avveckling |
| --- | --- |
| Bolag, rum och paket | `packages/operators/server/operator-store.mjs`: nuvarande rum och publicerade `operator_packages.rooms`. Följ även sparade paketrevisioner som aktiva rum eller låsta konfigurationer faktiskt använder. Administrationsdokumentets äldre rumskopia är inte den aktuella sanningskällan. |
| Dealer och media | Projektets dealerposter, `media_records`, registrerade filmprofiler, lager och alla använda materialidentiteter. Ett tomt rum bevisar inte att dealerns bank är oanvänd. |
| Delat spelbord | `shared_table_configs`, dess heads och deras exakta materialrevisioner. Behåll serverns spel-, sessions- och pengakontrakt. |
| Tal och GPU | Talprofiler, `moving_speech_bindings`, driftprofiler, bankkarta, journal, budget, reservationer och callbackbindningar. En textreferens är inte ensam en aktiv konsument; följ det körbara anropet. |
| Partneråtkomst | API-nycklar, partnerspelare, sessioner och bolagsbindningar enligt [NYCKEL-BOLAG](NYCKEL-BOLAG.md) och [STEG-F](STEG-F.md). Bolagsradering får inte lämna fungerande nycklar eller felbundna spelare. |
| Runtimekatalog | Den registerlagrade katalogen och dess Blob-index, via `ops/neon-studio/runtime-media-import.mjs`. Granska exakt kandidatlista och källrevision; gamla K04-testkataloger är inte dagens allmänna publiceringsgrind. |
| Blob | Exakta URL:er/hashar från kvarvarande produktreferenser och den avgränsade raderingslistan. Prefix eller filnamn räcker inte. |

Lagringskontraktet finns i [BLOB-NEON](../storage/BLOB-NEON.md);
medie- och publiceringskontraktet i
[runtimeguiden](../LOCAL-PRESENTATION-RUNTIME.md).
Ordinarie livscykel frikopplar aktiva beroenden atomiskt men raderar inte
källmedia, historik eller plånboksjournal som bieffekt.

## Genomförande och återgång

1. Inventera rätt miljö och scope omedelbart före körning. Frys en exakt
   lista över kandidater, deras konsumenter och det som ska bevaras.
   Kontrollera även pågående jobb och andra agenters ägarskap.
2. Förbered verifierbar återställning enligt
   [ENVIRONMENT-RESTORATION](../ENVIRONMENT-RESTORATION.md): Neon-underlag,
   aktuella revisioner och Blob-identiteter/hashar. Säkerhetskopior med
   privata data stannar utanför Git.
3. Leverera nödvändiga kodändringar och kompatibla läsvägar. Använd
   ordinarie livscykel där den täcker uppdraget; gör särskilda databasingrepp
   bara för den uttryckligt avgränsade återstående dataraderingen.
4. Ta bort eller koppla om referenser i rätt transaktion/revision. En spärr
   för en aktiv referens ska lösas vid konsumenten, inte kringgås genom att
   radera bevis eller kalibrering.
5. Förbered och granska en ny runtimekatalog med importverktygets
   revisions- och planhashkontroller om katalogen behöver ändras. Publicera
   bara berörda paket/rum vars verkliga produktkontrakt ändrats.
6. Verifiera Johns Bet, Paows använda media, Dragans talreferens, behörighet
   och negativa åtkomstfall samt att inga kandidater längre begärs av en
   klient eller ett aktivt jobb.
7. Radera därefter exakt verifierade Blob-objekt. Kontrollera listan igen
   mot den frysta revisionen; avvikelse kräver ny plan, inte bred prefixradering.

Återgång återställer de dokumenterade data- och medierevisionerna. Den får
inte automatiskt öppna rum eller slå på tal. Spara bara det driftkvitto som
behövs för att bedöma denna release. När uppdraget är genomfört flyttas
kvarvarande sakinformation till guiderna och planen raderas via HISTORIK.
