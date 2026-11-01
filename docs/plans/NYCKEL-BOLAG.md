# Nyckel → bolag

Kvarvarande kravhöjning efter införd bolagsbindning. Kodavstämd 1 november
2026 mot `e3dbed2c17afe91deb81ff9b9e9d88264958d38f`; ingen färsk databas-
eller driftacceptans ingår. Den tidigare A/B/C-planen finns i samma Git-
version. Genomförda A/B-steg ska inte byggas på nytt.

## Kontrakt och infört stöd

En partnernyckel tillhör ett aktivt bolag i motorns Studio-scope. En signerad
launch, session och rumsbehörighet måste avse samma bolag. Nyckelns bolag är
oföränderligt; rotation/återkallelse ska ogiltigförklara berörda sessioner.
Partnerspelare knyts till nyckeln; nativa spelares bolag hanteras separat i
[STEG-F](STEG-F.md).

| Del | Kodläget |
| --- | --- |
| Schema | `ops/neon-game/012-api-key-operator.sql` finns med kolumn, index och spärr mot bolagsbyte. Manifestet `ops/neon-game/migrations.mjs` anger fortfarande `deploymentOptional`. |
| Skapa och lista nycklar | `apps/studio/lib/studio-admin-accounts.mjs` kräver `operatorId`, validerar bolaget och nekar skapande när kolumnen saknas. Admin och demobyggaren skickar bolag; partnerportalen visar maskerade nycklar för eget bolag via `partner-api-keys.mjs`. |
| Launch | `services/game/storage/async-partner-api.mjs` binder claims och URL till nyckelns bolag. `async-player-auth.mjs` läser och validerar bindningen i transaktion. |
| Delat bord | `shared-room-access.mjs`, `shared-command-auth.mjs` och launch-/sidkontrollerna i `server.mjs` kontrollerar bolag och aktuell nyckel. |
| Kompatibilitet | Toleranta `to_jsonb`-läsningar, obundna nyckelvägar och `allowLegacyPartnerSessions` finns kvar. Detta är kvarvarande kod, inte bevis för att den behövs i drift. |

Det finns ingen FK mellan auth- och Studio-schemat: kodens scope- och
aktivitetskontroller behövs även efter kravhöjningen.

## Återstår

1. Verifiera aktuell game-ledger och readiness i berörda miljöer. En gammal
   uppgift om noll API-nycklar är inte ett aktuellt databevis. Prepare-
   verktyget `tools/prepare-api-key-operator.mjs` renderar SQL offline;
   migrationsfilens preflight nekar en icke tom tabell. Radera inte aktiva
   nycklar för att passera den kontrollen. DDL följer aktuellt mandat,
   backup och [återställningsguiden](../ENVIRONMENT-RESTORATION.md).
2. När readiness tillåter: gör 012 obligatorisk, neka obundna nycklar och
   launch-token och ta bort de verifierat förbrukade toleranta grenarna.
   Följ konsumenterna till `keys.list/create` och
   `allowLegacyPartnerSessions` före radering; Studio är den aktuella
   skapvägen. Behåll befintliga felkoder och sessionernas återkallelse.
3. Verifiera bolagsisolering även på nativ spel-/API-ingång. Den tidigare
   granskningen av #538 noterade nativevägar och olika svar för främmande
   respektive okänt rum. Reproducera mot aktuell kod och rätta kvarvarande
   fall; den gamla rapporten är inte ett nytt testresultat.
4. Avsluta med ett isolerat acceptansprov: bunden partner i rätt bolags rum,
   spelad hand och atomiska plånboksrader; fel bolag, okänt rum, förfalskad
   claim, rotation och återkallelse ska nekas utan sessionsläcka.

Relevanta prov finns i `test/api-key-operator-migration.mjs`,
`test/studio-admin-accounts.mjs`, `test/partner-launch-route.mjs`,
`test/shared-room-access.mjs` och `test/shared-command-auth.mjs`.
Kontrollera både launch, sida, socket och kommandon; en grön listvy bevisar
inte bolagsisolering. Vid samtidiga kommandon/rotation ska låsordningen och
återvalideringen bestå.

[REN-START](REN-START.md) måste följa nycklar och sessioner innan ett bolag
raderas. Planen tas bort när kravhöjning och relevant driftacceptans är
verifierade; varaktiga kontrakt hör hemma i sakguiderna.
