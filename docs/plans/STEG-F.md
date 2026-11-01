# Steg F: spelare knyts till bolag

Aktivt restarbete, kodavstämt 1 november 2026 mot
`e3dbed2c17afe91deb81ff9b9e9d88264958d38f`. F1:s migrering och toleranta
läsningar finns. Game-014 är fortfarande `deploymentOptional`, och bland
annat Admins skapväg saknar bolagsfält. Full bolagsisolering för nativa
spelare är därför inte färdig. Ingen DDL eller ny driftacceptans ingår här.

## Mål och kodläge

En spelare ska höra till ett bolag; saldot och spelhistoriken hör till det
kontot. Två bolags konton för samma person får inte blandas. Partnernyckelns
bindning finns i [NYCKEL-BOLAG](NYCKEL-BOLAG.md).

| Väg | Källa och kvarvarande arbete |
| --- | --- |
| Admin skapar spelare | `apps/studio/lib/studio-admin-data.mjs` → `packages/storage/server/player-administration.mjs`; behöver validerat bolag. |
| Partner skapar spelare | `services/game/storage/async-partner-api.mjs`; nyckelns bolag är känt och ska styra spelaren. |
| Registrering, personal-/Craig-koppling och `/api/player` | `services/game/storage/async-player-auth.mjs` och `server.mjs`; bolagskontexten måste följa den faktiska skapvägen. |
| Session och behörighet | `async-player-auth.mjs` läser `playerOperatorId` tolerant. Kontroller i spelstart, delat bord, kommandon och roulette måste använda spelarens bindning. |
| Schema och listor | `ops/neon-game/014-player-operator.sql`, `tools/prepare-player-operator.mjs` och Admins spelarlista finns. Kolumnen är nullable; nya skapvägar kan fortfarande lämna NULL. |
| Inloggningsnamn | `player_accounts.email` är global primärnyckel. Bolagsunika namn kräver ett eget beslutat schema- och inloggningskontrakt. |

## Återstående leverans

1. Fastställ bolag för varje skap- och inloggningsväg, inklusive interna
   spelare och förhandsvisning. Kräv giltigt aktivt bolag i rätt scope;
   klientens fria `operatorId` får inte ge åtkomst till ett annat bolag.
2. Implementera F2: skriv bolaget vid skapande, filtrera partnerns spelarvy
   på sessionens bolag och kontrollera samma identitet vid sida, socket,
   kommando, roulette och partner-API. Behåll saldo och transaktioner.
3. Kontrollera aktuella NULL-rader och readiness. 014:s prepare-verktyg
   bygger ett backfillförslag från partnernyckel, senaste bolagsbundna bord
   och ett uttryckligt reservbolag. Senaste bord är en heuristik; en gammal
   inventering eller `scoutgaming-demo` som tidigare förslag avgör inte
   dagens hemvist. Nativa bord utan bolag ger inget sådant bevis.
4. Förbered återstående migrering först när kontraktet är beslutat och
   skapvägarna fungerar. `game-015` var ett planerat namn, inte en levererad
   migrering i den granskade basen. Följ tolerant kod → godkänd migrering →
   kravhöjning samt [återställningsguiden](../ENVIRONMENT-RESTORATION.md).
5. F3 gör erforderliga migrationer obligatoriska och tar bort toleranta
   grenar först efter readiness. Prova att A:s spelare nekas i B:s samtliga
   ingångar, även vid återanslutning och samtidiga kommandon.

## Beslut som återstår i produktuppdraget

- Vilket verifierat reservbolag gäller för spelare utan tillräcklig historik?
- Ska inloggningsnamn vara unika globalt eller per bolag? Den tidigare
  planens föreslagna `UNIQUE (operator_id, email)` är inte infört.
- Vilka vägar utan bolagskontext ska stängas respektive kräva ett bolag,
  och får Admin senare flytta en spelare eller ska bindningen vara orörlig?

014:s readiness ska visa fördelningen före skrivning; verktyget renderar
SQL offline och skapar inget eget produktregister. Bolagsradering enligt
[REN-START](REN-START.md) måste först reda ut berörda spelare. Radera planen
när skapvägar, kravhöjning och bolagsisolering är verifierade.
