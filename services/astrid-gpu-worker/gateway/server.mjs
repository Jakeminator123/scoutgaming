import { createServer } from 'node:http';
import { attachSpeechRelay } from './relay.mjs';
import { ticketAuthenticator } from './auth.mjs';

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, ...relay.status() }));
  } else { res.writeHead(404); res.end(); }
});
const relay = attachSpeechRelay(server, {
  workerSecret: process.env.WORKER_SECRET,
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean),
  authenticateClient: ticketAuthenticator(process.env.TICKET_SECRET),
});
server.listen(Number(process.env.PORT || 8080), '0.0.0.0');
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { relay.close(); server.close(() => process.exit(0)); });
