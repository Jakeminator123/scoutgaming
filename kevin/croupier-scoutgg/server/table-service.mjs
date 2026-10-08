import { DatabaseSync } from "node:sqlite";
import { randomBytes, createHash } from "node:crypto";
import { guestToken, sameOrigin } from './request-safety.mjs';
import { command, newGame } from "../vendor/croupier/shoe-game.mjs";

// Isolated demo wallets. The original Croupier engine is the sole authority for
// shuffle, hidden cards, legality, debits and payouts. Never use a client balance.
export function createTableService(filename, { shared } = {}) {
  const db = new DatabaseSync(filename);
  db.exec(`CREATE TABLE IF NOT EXISTS demo_tables (
    session TEXT PRIMARY KEY, balance REAL NOT NULL, state TEXT NOT NULL
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS demo_refills (
    session TEXT NOT NULL, request_id TEXT NOT NULL, input TEXT NOT NULL,
    PRIMARY KEY(session, request_id)
  )`);
  const digest = token => createHash("sha256").update(token).digest("hex");
  function run(token, input) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const key = digest(token);
      const row = db.prepare("SELECT balance,state FROM demo_tables WHERE session=?").get(key);
      const balance = row?.balance ?? 1000;
      const game = row ? JSON.parse(row.state) : newGame();
      let result;
      if (input.op === 'refill') {
        // Fixed, non-cash demo credit. Retried requests never credit twice,
        // even after another refill or a server restart.
        if (typeof input.requestId !== 'string' || !input.requestId.length || input.requestId.length > 100) throw new Error('Request ID required');
        const previous = db.prepare('SELECT input FROM demo_refills WHERE session=? AND request_id=?').get(key, input.requestId);
        if (previous && previous.input !== JSON.stringify(input)) throw new Error('Request ID reused with different input');
        if (!previous) {
          if (input.version !== game.version) throw new Error('Table changed; reload to resume');
          db.prepare('INSERT INTO demo_refills VALUES (?,?,?)').run(key, input.requestId, JSON.stringify(input));
          game.version++;
        }
        result = { ...command(game, {op:'state'}, balance), delta:previous ? 0 : 1000 };
      } else result = command(game, input, balance);
      const { delta, view } = result;
      const nextBalance = Math.round((balance + delta) * 100) / 100;
      db.prepare(`INSERT INTO demo_tables VALUES (?,?,?) ON CONFLICT(session)
        DO UPDATE SET balance=excluded.balance,state=excluded.state`).run(key, nextBalance, JSON.stringify(game));
      db.exec("COMMIT");
      return { ...view, balance: nextBalance, currency: "USD", demo: true };
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  function handle(req, res, input) {
    if (req.headers.origin && !sameOrigin(req)) {
      res.writeHead(403, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Invalid origin" }));
      return;
    }
    let token = guestToken(req.headers) ?? randomBytes(32).toString("hex");
    if (!/(?:^|;\s*)astrid_guest=[a-f0-9]{64}(?:;|$)/.test(req.headers.cookie ?? "")) {
      const secure = req.socket.encrypted || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
      res.setHeader("Set-Cookie", [`astrid_guest=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure}`,`astrid_demo=; Path=/api/table; HttpOnly; SameSite=Strict; Max-Age=0${secure}`]);
    }
    try {
      if(shared&&!input.session)throw new Error('A shared table session is required');
      const snapshot = input.session && shared ? shared.run(token,input) : run(token,input);
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify(snapshot));
    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify({ error: error.message }));
    }
  }
  return { run, handle, close: () => db.close() };
}
