import { command as shoeCommand, newGame, gameView } from './shoe-game.mjs';
import { presentationEvents } from './partner-presentation.mjs';

// SQL-free table for the Admin rehearsal (Provspel): the wallet, shoe, receipt and
// ledger steps of postgres-native-table.mjs, held in memory per preview session.
// test/preview-table.mjs runs one script through both and requires equal results.
// A command works on a private copy that replaces the committed state only when it
// returns, so a refused command changes nothing. It is synchronous: one JavaScript
// turn is the lock, so no request can interleave and no mutex is needed.
// Shoe and receipt stay JSON text, as in the database rows, so the saved round is
// restored by exactly the same parse as the product tables.
// The rehearsal never publishes observations: partner events stay product-only.
// `tables` seeds a saved game per player (a fixed shoe in tests), like a blackjack_tables row.
export function createPreviewTable({ players = [], tables = {} } = {}) {
  let state = { players: new Map(), tables: new Map(), transactions: [], presentations: new Map() };
  for (const row of players) {
    if (typeof row?.id !== 'string' || !Number.isFinite(row.balance) || state.players.has(row.id)) throw new TypeError('Invalid preview player');
    state.players.set(row.id, structuredClone(row));
  }
  for (const [id, game] of Object.entries(tables)) {
    if (!state.players.has(id)) throw new TypeError('Invalid preview table');
    state.tables.set(id, JSON.stringify(game));
  }
  const committed = () => { if (!state) throw new Error('Preview table closed'); return state; };
  function command({ id, ...req }) {
    const tx = structuredClone(committed());
    const player = tx.players.get(id);
    if (!player) throw new Error('Load your player first');
    if (player.status && player.status !== 'active') throw new Error('Player account is unavailable');
    const balanceBefore = Number(player.balance);
    if (!Number.isFinite(balanceBefore)) throw new Error('Invalid saved balance');
    const saved = tx.tables.get(id);
    const g = saved ? JSON.parse(saved) : newGame();
    const previousVersion = g.version;
    // A separate public snapshot cannot acquire the draws this command makes.
    const previousView = gameView(saved ? JSON.parse(saved) : newGame());
    const { delta, view } = shoeCommand(g, req, balanceBefore);
    const balance = Math.round((balanceBefore + delta) * 100) / 100;
    tx.tables.set(id, JSON.stringify(g));
    player.balance = balance;
    if (delta) tx.transactions.push({ playerId: id, type: req.op, amount: delta, currency: player.currency, note: 'server blackjack' });
    let presentation = [];
    if (req.op !== 'state') {
      if (g.version > previousVersion) {
        presentation = presentationEvents(previousView, view, req.op, { action: req.action });
        tx.presentations.set(id, { requestId: req.requestId, version: view.version, payload: JSON.stringify(presentation) });
      } else {
        // An idempotent replay returns the receipt of the request it repeats.
        const receipt = tx.presentations.get(id);
        if (receipt?.requestId === req.requestId && receipt.version === view.version) presentation = JSON.parse(receipt.payload);
      }
    }
    const out = { ...view, balance, requestId: req.requestId ?? null, op: req.op, presentation };
    state = tx;
    return out;
  }
  return Object.freeze({
    command,
    // Committed copies only; callers can never edit the session state in place.
    player: id => structuredClone(committed().players.get(id)),
    // The `SELECT version, payload FROM native_presentations` row shape.
    receipt: id => { const row = committed().presentations.get(id); return row && { version: row.version, payload: row.payload }; },
    transactions: () => structuredClone(committed().transactions),
    // Frees the session's memory; any later use fails like a closed database.
    close() { state = null; },
  });
}
