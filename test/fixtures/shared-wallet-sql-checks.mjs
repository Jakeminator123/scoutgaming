// Real PostgreSQL wallet checks. Only the owned loopback QA cluster may run these.
import assert from 'node:assert/strict';
import { createPostgresTableWallet } from '../../services/game/games/blackjack/table/postgres-wallet.mjs';
import { ledgerKey, LockSetExceeded, WalletDenied } from '../../services/game/games/blackjack/table/ports.mjs';

export async function runSharedWalletSqlChecks({ pool, createPool }) {
  const target = (await pool.query('SELECT current_user AS role,inet_server_addr()::text AS address')).rows[0];
  assert.equal(target.role, 'studio_qa'); assert.ok(['127.0.0.1', '127.0.0.1/32'].includes(target.address));
  const other = createPool(), checks = [];
  const check = async (name, run) => { await run(); checks.push(name); console.log(`ok - ${name}`); };
  // Wallet-unit transactions only: game R/A orchestration is covered by the
  // coordinator harness. P is the actual main player row, shared by old writers.
  async function withWallet(players, rooms, run, source = pool) {
    const client = await source.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout='5000ms'; SET LOCAL lock_timeout='3000ms'");
      for (const p of [...new Set(players)].sort()) await client.query('SELECT id FROM croupier_game.players WHERE id=$1 FOR UPDATE', [p]);
      const wallet = createPostgresTableWallet({ client,
        assertPlayer(p) { if (!players.includes(p)) throw new LockSetExceeded({ players: [p] }); },
        assertRoom(room) { if (!rooms.includes(room)) throw new LockSetExceeded({ rooms: [room] }); },
      });
      const value = await run(wallet, client); await client.query('COMMIT'); return value;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  const readWallet = createPostgresTableWallet({ client: pool, assertPlayer() {}, assertRoom() {} });
  const seed = p => pool.query("INSERT INTO croupier_game.players(id,name,currency,balance,created_at) VALUES($1,'isolated wallet fixture','USD',100,'2026-10-22T00:00:00Z')", [p]);
  const key = (p, identity, effect, room = 'wallet-room-a') => ledgerKey({ namespace: 'command', roomId: room, actorId: p, identity, playerId: p, effect });
  const reserve = (wallet, p, id, value, room = 'wallet-room-a', kind = 'stake') => wallet.reserve(p, { reservationId: id, roomId: room, kind, amount: value });
  const saved = async p => ({ player: (await pool.query('SELECT balance,currency,status,wallet_gen FROM croupier_game.players WHERE id=$1', [p])).rows[0],
    reservations: (await pool.query('SELECT * FROM croupier_game.shared_wallet_reservations WHERE player_id=$1 ORDER BY reservation_id', [p])).rows,
    ledger: (await pool.query('SELECT id,type,amount,source_key,source_fingerprint FROM croupier_game.transactions WHERE player_id=$1 ORDER BY id', [p])).rows,
    hands: (await pool.query('SELECT * FROM croupier_game.shared_wallet_hands WHERE player_id=$1 ORDER BY room_id', [p])).rows });
  const sqlGuard = error => error.code === '23514';
  let winner;

  await check('wallet: two clients in different rooms cannot reserve the same global balance', async () => {
    const p = 'wallet-concurrent'; await seed(p);
    const attempts = await Promise.allSettled(['wallet-room-a', 'wallet-room-b'].map((room, i) =>
      withWallet([p], [room], wallet => reserve(wallet, p, `wallet-race-${i}`, 60, room), i ? other : pool)));
    assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1);
    const refused = attempts.find(r => r.status === 'rejected'); assert.ok(refused.reason instanceof WalletDenied);
    winner = attempts[0].status === 'fulfilled' ? 0 : 1;
    assert.equal(await readWallet.available(p), 40);
    assert.equal((await saved(p)).reservations.length, 1);
  });
  await check('wallet: a legacy balance writer cannot spend held funds and rolls back its ledger', async () => {
    const p = 'wallet-concurrent', before = await saved(p);
    await assert.rejects(withWallet([p], [], async (_wallet, client) => {
      await client.query("INSERT INTO croupier_game.transactions(player_id,type,amount,currency,at) VALUES($1,'fixture-legacy',-50,'USD','fixture')", [p]);
      await client.query('UPDATE croupier_game.players SET balance=balance-50 WHERE id=$1', [p]);
    }, other), sqlGuard);
    assert.deepEqual(await saved(p), before);
    await assert.rejects(other.query("UPDATE croupier_game.players SET currency='EUR' WHERE id=$1", [p]), sqlGuard);
    await assert.rejects(other.query("UPDATE croupier_game.players SET status='closed' WHERE id=$1", [p]), sqlGuard);
  });
  await check('wallet: existing credit and reservation release advance generations, a no-op does not', async () => {
    const p = 'wallet-concurrent', initial = await readWallet.gen(p), room = winner ? 'wallet-room-b' : 'wallet-room-a';
    await other.query('UPDATE croupier_game.players SET balance=balance+20 WHERE id=$1', [p]);
    const credited = await readWallet.gen(p); assert.ok(BigInt(credited) > BigInt(initial)); assert.equal(await readWallet.available(p), 60);
    await withWallet([p], [room], wallet => reserve(wallet, p, `wallet-race-${winner}`, 60, room));
    assert.equal(await readWallet.gen(p), credited);
    await withWallet([p], [room], wallet => wallet.release(p, { reservationId: `wallet-race-${winner}` }));
    assert.ok(BigInt(await readWallet.gen(p)) > BigInt(credited));
    assert.equal(await readWallet.reservation(`wallet-race-${winner}`), null); assert.equal(await readWallet.available(p), 120);
  });
  await check('wallet: absolute reserve changes and zero clear use global available money', async () => {
    const p = 'wallet-absolute'; await seed(p);
    await withWallet([p], ['wallet-room-a'], async wallet => {
      await reserve(wallet, p, 'wallet-absolute-res', 30); const before = await wallet.reservation('wallet-absolute-res');
      await reserve(wallet, p, 'wallet-absolute-res', 80); const after = await wallet.reservation('wallet-absolute-res');
      assert.ok(BigInt(after.gen) > BigInt(before.gen)); assert.equal(await wallet.available(p), 20);
      await assert.rejects(reserve(wallet, p, 'wallet-other-res', 30), WalletDenied);
      await assert.rejects(reserve(wallet, p, 'wallet-absolute-res', 80, 'wallet-room-a', 'insurance'), { code: 'RESERVATION_OWNER' });
      await reserve(wallet, p, 'wallet-absolute-res', 0); assert.equal(await wallet.available(p), 100);
    });
  });
  await check('wallet: consume replay returns one original ledger ID and does not spend twice', async () => {
    const p = 'wallet-consume'; await seed(p);
    let consumed;
    await withWallet([p], ['wallet-room-a'], async wallet => {
      await reserve(wallet, p, 'wallet-consume-res', 40);
      consumed = await wallet.consume(p, { reservationId: 'wallet-consume-res', key: key(p, 'start', 'consume:stake') });
      await wallet.syncHands('wallet-room-a', [p]);
    });
    assert.equal(consumed.amount, 40); const before = await saved(p);
    assert.equal(before.reservations.length, 0); assert.equal(Number(before.player.balance), 60); assert.equal(before.ledger.length, 1);
    assert.equal(Number(before.ledger[0].amount), -40);
    const replay = await withWallet([p], ['wallet-room-a'], wallet => wallet.consume(p, { reservationId: 'wallet-consume-res', key: key(p, 'start', 'consume:stake') }), other);
    assert.deepEqual(replay, consumed); assert.deepEqual(await saved(p), before);
    await assert.rejects(withWallet([p], ['wallet-room-a'], wallet => wallet.consume(p, { reservationId: 'wallet-different-res', key: key(p, 'start', 'consume:stake') })), { code: 'LEDGER_KEY_REUSED' });
  });
  await check('wallet: consumed open hand still blocks currency/closure; missing P changes no marker', async () => {
    const p = 'wallet-consume', before = await saved(p);
    await assert.rejects(other.query("UPDATE croupier_game.players SET currency='EUR' WHERE id=$1", [p]), sqlGuard);
    await assert.rejects(other.query("UPDATE croupier_game.players SET status='closed' WHERE id=$1", [p]), sqlGuard);
    await assert.rejects(withWallet([], ['wallet-room-a'], wallet => wallet.syncHands('wallet-room-a', [])), LockSetExceeded);
    assert.deepEqual(await saved(p), before);
    await withWallet([p], ['wallet-room-a'], wallet => wallet.syncHands('wallet-room-a', []));
    await other.query("UPDATE croupier_game.players SET currency='EUR',status='closed' WHERE id=$1", [p]);
    assert.equal((await saved(p)).player.status, 'closed');
  });
  await check('wallet: debit uses unreserved money, credit replay is immutable across payloads', async () => {
    const p = 'wallet-effects'; await seed(p);
    await withWallet([p], ['wallet-room-a'], async wallet => {
      await reserve(wallet, p, 'wallet-effects-res', 80);
      await assert.rejects(wallet.debit(p, { amount: 21, kind: 'double', key: key(p, 'bad-double', 'debit:double') }), WalletDenied);
      await wallet.debit(p, { amount: 20, kind: 'double', key: key(p, 'double', 'debit:double') });
      assert.equal(await wallet.available(p), 0);
      const request = { amount: 15, kind: 'refill', key: key(p, 'refill', 'refill') };
      const credited = await wallet.credit(p, request); assert.deepEqual(await wallet.credit(p, request), credited);
      await assert.rejects(wallet.credit(p, { ...request, amount: 16 }), { code: 'LEDGER_KEY_REUSED' });
      assert.equal(await wallet.available(p), 15);
    });
    assert.equal((await saved(p)).ledger.length, 2);
  });
  await check('wallet: full rollback restores balance, reservations, generations, ledger and hands', async () => {
    const p = 'wallet-rollback'; await seed(p);
    await withWallet([p], ['wallet-room-a'], wallet => reserve(wallet, p, 'wallet-rollback-res', 25));
    const before = await saved(p);
    await assert.rejects(withWallet([p], ['wallet-room-a'], async wallet => {
      await wallet.consume(p, { reservationId: 'wallet-rollback-res', key: key(p, 'rollback', 'consume:stake') });
      await wallet.syncHands('wallet-room-a', [p]);
      throw new Error('fixture infrastructure failure');
    }), /fixture infrastructure failure/);
    assert.deepEqual(await saved(p), before);
  });
  await check('wallet: savepoint rollback restores consume and hand writes but permits a blocked receipt', async () => {
    const p = 'wallet-savepoint'; await seed(p);
    await withWallet([p], ['wallet-savepoint-room'], wallet => reserve(wallet, p, 'wallet-savepoint-res', 25, 'wallet-savepoint-room'));
    const before = await saved(p);
    await withWallet([p], ['wallet-savepoint-room'], async (wallet, client) => {
      await client.query('SAVEPOINT wallet_unit');
      await wallet.consume(p, { reservationId: 'wallet-savepoint-res', key: key(p, 'blocked', 'consume:stake', 'wallet-savepoint-room') });
      await wallet.syncHands('wallet-savepoint-room', [p]);
      await client.query('ROLLBACK TO SAVEPOINT wallet_unit');
      assert.equal((await wallet.reservation('wallet-savepoint-res')).amount, 25);
      await client.query("INSERT INTO croupier_game.shared_table_ticks(tick_id,room_id,body) VALUES('wallet-blocked','wallet-savepoint-room',$1)", [JSON.stringify({ outcome: 'blocked', walletGen: await wallet.gen(p) })]);
    });
    assert.deepEqual(await saved(p), before);
    assert.equal(JSON.parse((await pool.query("SELECT body FROM croupier_game.shared_table_ticks WHERE tick_id='wallet-blocked'")).rows[0].body).outcome, 'blocked');
  });
  await check('wallet: a blocked account honours accepted stake/insurance with a hand marker but refuses new funds', async () => {
    const p = 'wallet-blocked'; await seed(p);
    await withWallet([p], ['wallet-blocked-room'], async wallet => {
      await reserve(wallet, p, 'wallet-blocked-stake', 20, 'wallet-blocked-room');
      await reserve(wallet, p, 'wallet-insurance-res', 10, 'wallet-blocked-room', 'insurance');
    });
    await other.query("UPDATE croupier_game.players SET status='blocked' WHERE id=$1", [p]);
    await withWallet([p], ['wallet-blocked-room'], async wallet => {
      await wallet.consume(p, { reservationId: 'wallet-blocked-stake', key: key(p, 'start', 'consume:stake', 'wallet-blocked-room') });
      await wallet.syncHands('wallet-blocked-room', [p]);
      const consumed = await wallet.consume(p, { reservationId: 'wallet-insurance-res', key: key(p, 'insurance', 'consume:insurance', 'wallet-blocked-room') });
      assert.equal(consumed.amount, 10);
      await wallet.credit(p, { amount: 5, kind: 'payout', key: key(p, 'settlement', 'payout', 'wallet-blocked-room') });
      await assert.rejects(reserve(wallet, p, 'wallet-new-stake', 5, 'wallet-blocked-room'), WalletDenied);
      await assert.rejects(wallet.credit(p, { amount: 5, kind: 'refill', key: key(p, 'refill', 'refill', 'wallet-blocked-room') }), WalletDenied);
      await assert.rejects(wallet.debit(p, { amount: 5, kind: 'double', key: key(p, 'double', 'debit:double', 'wallet-blocked-room') }), WalletDenied);
    });
    assert.equal(Number((await saved(p)).player.balance), 75);
    assert.equal((await saved(p)).hands.length, 1);
  });
  return { checks };
}
