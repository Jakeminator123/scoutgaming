import { command as shoeCommand, newGame, gameView } from './shoe-game.mjs';
import { presentationEvents } from './partner-presentation.mjs';

// PostgreSQL path selected explicitly by the server's storage configuration.
// A single checked-out PostgreSQL client keeps the wallet, shoe, receipt and
// ledger in one transaction. Locking the player row serializes commands for
// that player, including the first command before a table row exists.
export function createPostgresNativeTableCommand({ pool, publish = () => {}, onPublishError = () => {} }) {
  if (typeof pool?.connect !== 'function') throw new TypeError('A PostgreSQL pool is required');
  return async ({ id, ...req }, session = null) => {
    const client = await pool.connect();
    let out, observation, committed = false;
    try {
      await client.query("BEGIN; SET LOCAL statement_timeout = '15000ms'; SET LOCAL lock_timeout = '5000ms'");
      const player = (await client.query(
        'SELECT id, name, currency, balance, status FROM players WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!player) throw new Error('Load your player first');
      if (player.status && player.status !== 'active') throw new Error('Player account is unavailable');
      const balanceBefore = Number(player.balance);
      if (!Number.isFinite(balanceBefore)) throw new Error('Invalid saved balance');
      const saved = (await client.query(
        'SELECT state FROM blackjack_tables WHERE player_id=$1', [id])).rows[0];
      const g = saved ? JSON.parse(saved.state) : newGame();
      const previousVersion = g.version;
      const previousView = gameView(saved ? JSON.parse(saved.state) : newGame());
      const { delta, view } = shoeCommand(g, req, balanceBefore);
      const balance = Math.round((balanceBefore + delta) * 100) / 100;
      await client.query(
        'INSERT INTO blackjack_tables (player_id,state) VALUES ($1,$2) ON CONFLICT (player_id) DO UPDATE SET state=EXCLUDED.state',
        [id, JSON.stringify(g)]);
      await client.query('UPDATE players SET balance=$1 WHERE id=$2', [balance, id]);
      if (delta) await client.query(
        'INSERT INTO transactions (player_id,type,amount,currency,meta,at) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, req.op, delta, player.currency, 'server blackjack', new Date().toISOString()]);
      let presentation = [];
      if (req.op !== 'state') {
        if (g.version > previousVersion) {
          presentation = presentationEvents(previousView, view, req.op, { action: req.action });
          await client.query(
            'INSERT INTO native_presentations (player_id,request_id,version,payload) VALUES ($1,$2,$3,$4) ON CONFLICT (player_id) DO UPDATE SET request_id=EXCLUDED.request_id,version=EXCLUDED.version,payload=EXCLUDED.payload',
            [id, req.requestId, view.version, JSON.stringify(presentation)]);
        } else {
          const receipt = (await client.query(
            'SELECT payload FROM native_presentations WHERE player_id=$1 AND request_id=$2 AND version=$3',
            [id, req.requestId, view.version])).rows[0];
          if (receipt) presentation = JSON.parse(receipt.payload);
        }
      }
      out = { ...view, balance, requestId: req.requestId ?? null, op: req.op, presentation };
      if (req.op !== 'state' && g.version > previousVersion) {
        observation = { session, playerId: id, previousView, view, command: req, balance };
      }
      await client.query('COMMIT');
      committed = true;
    } catch (error) {
      if (!committed) {
        try { await client.query('ROLLBACK'); } catch { /* Preserve the command error. */ }
      }
      throw error;
    } finally {
      client.release();
    }
    if (observation) {
      try { await publish(observation); }
      catch { try { onPublishError(); } catch { /* Diagnostics cannot fail a committed command. */ } }
    }
    return out;
  };
}
