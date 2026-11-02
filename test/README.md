# Produktens integrations- och beteendeprov

Proven grupperas efter funktion när det gör konsumentkedjan begripligare:

- `blackjack/`: regler, sko, sidospel, serverauktoritet, delade bord och pengar.
- `roulette/`: regler, publicerade rum, klient och PostgreSQL-avräkning.
- `rooms/`: anslutning, behörighet, kommandon, återanslutning och presentation för delade rum.
- `fixtures/`: hjälpmoduler som delas mellan grupper. Rummens egen browserlayoutfixtur finns i `rooms/fixtures/`.

Övriga rotprov och `system-map/` behåller sina befintliga körvägar.
Grupperna ändrar inte sviternas ansvar: [.githooks/pre-commit-full](../.githooks/pre-commit-full)
är det enda fullständiga svitregistret. Varje prov behåller sin svit och körs en gång.

Kör en vald fil med Node 24 enligt pinnad version i `apps/studio/package.json`:

```text
node --test --test-concurrency=2 test/blackjack/blackjack-core.mjs
node --test --test-concurrency=2 test/roulette/roulette.mjs
node --test --test-concurrency=2 test/rooms/shared-room-access.mjs
node tools/check-orphan-tests.mjs
```

Fullsviter väljs enligt [START-HERE](../START-HERE.md#köra-och-testa).
Motorprovens HTTP-/TLS-fall körs genom `tools/run-engine-qa.mjs` på isolerad PostgreSQL;
en direkt körning utan dess descriptor redovisar dem som överhoppade.
Chromes CI-steg upptäcker browserprov rekursivt; fixturmappar är hjälpmoduler.
Den vanliga hooken följer även nästlade prov och deras delade eller lokala fixturer,
utan att läsa länkar/junctions eller köra hjälpmoduler som egna prov.
Atlas visar körkedjan i **Leverans och verifiering**. Registrering och statiska
samband är inte i sig bevis för ett godkänt prov eller driftacceptans.
