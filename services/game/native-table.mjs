import { command as shoeCommand, newGame, gameView } from './shoe-game.mjs';
import { presentationEvents } from './partner-presentation.mjs';

// Keep the native table's wallet/shoe transaction in one place. Observation
// happens only after commit and cannot turn an accepted command into a retry.
export function createNativeTableCommand({ db, getPlayer, logTx, publish = () => {}, onPublishError = () => {} }) {
  db.exec('CREATE TABLE IF NOT EXISTS blackjack_tables (player_id TEXT PRIMARY KEY, state TEXT NOT NULL)');
  db.exec('CREATE TABLE IF NOT EXISTS native_presentations (player_id TEXT PRIMARY KEY, request_id TEXT NOT NULL, version INTEGER NOT NULL, payload TEXT NOT NULL)');
  return ({ id, ...req }, session = null) => {
    let out, observation;
    db.exec('BEGIN IMMEDIATE');
    try {
      const p = getPlayer(id); if (!p) throw new Error('Load your player first');
      const saved = db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get(id);
      const g = saved ? JSON.parse(saved.state) : newGame();
      const previousVersion = g.version;
      // A separate public snapshot cannot acquire new draws through references
      // when the accepted command mutates g. Never pass private state to SSE.
      const previousView = gameView(saved ? JSON.parse(saved.state) : newGame());
      const { delta, view } = shoeCommand(g, req, p.balance);
      const balance = Math.round((p.balance + delta) * 100) / 100;
      db.prepare('INSERT INTO blackjack_tables VALUES (?,?) ON CONFLICT(player_id) DO UPDATE SET state=excluded.state').run(id, JSON.stringify(g));
      db.prepare('UPDATE players SET balance=? WHERE id=?').run(balance, id);
      if (delta) logTx(id, req.op, delta, p.currency, 'server blackjack');
      let presentation = [];
      if (req.op !== 'state') {
        if (g.version > previousVersion) {
          presentation = presentationEvents(previousView, view, req.op, { action: req.action });
          db.prepare('INSERT INTO native_presentations VALUES (?,?,?,?) ON CONFLICT(player_id) DO UPDATE SET request_id=excluded.request_id,version=excluded.version,payload=excluded.payload')
            .run(id, req.requestId, view.version, JSON.stringify(presentation));
        } else {
          const receipt = db.prepare('SELECT payload FROM native_presentations WHERE player_id=? AND request_id=? AND version=?').get(id, req.requestId, view.version);
          if (receipt) presentation = JSON.parse(receipt.payload);
        }
      }
      // The same public presentation contract as SSE, returned with the original
      // response. The observer never reissues a command to obtain these signals.
      out = { ...view, balance, requestId: req.requestId ?? null, op: req.op, presentation };
      if (req.op !== 'state' && g.version > previousVersion) {
        observation = { session, playerId: id, previousView, view, command: req, balance };
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    if (observation) {
      try { publish(observation); }
      catch { try { onPublishError(); } catch { /* Diagnostics cannot fail an accepted command. */ } }
    }
    return out;
  };
}
