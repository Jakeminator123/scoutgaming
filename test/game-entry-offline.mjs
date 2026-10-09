import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { startLocalComparison } from '../tools/start-local-comparison.mjs';
import { gameLaneFromDocument } from '../web/public/game-lanes.mjs';

async function freePort(host) {
  const server = createServer();
  await new Promise(resolve => server.listen(0, host, resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
function gameDataset(html) {
  const element = /<html\b[^>]*>/.exec(html)?.[0];
  assert.ok(element, 'actual response contains a document element');
  return Object.fromEntries([...element.matchAll(/data-game-([a-z-]+)="([^"<>]*)"/g)].map(([,key,value]) => [
    'game' + key.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join(''), value,
  ]));
}

test('offline server returns each original dealer in the actual game document, retaining login and query boundaries', async () => {
  const fixture = await startLocalComparison({ startLab: false, gamePort: await freePort('localhost'), labPort: await freePort('127.0.0.1') });
  try {
    for (const dealer of ['astrid', 'vera', 'amira', 'mei']) {
      for (const path of ['/', '/game', '/v2/']) {
        const response = await fetch(fixture.gameUrl + path + '?dealer=' + dealer + '&rehearsal=1');
        assert.equal(response.status, 200);
        const dataset = gameDataset(await response.text());
        assert.equal(dataset.gamePath, undefined, 'offline must not claim the Neon /blackjack route');
        assert.deepEqual(gameLaneFromDocument(dataset), { lane: 'legacy', dealer, presentation: 'original' });
      }
    }
    const local = await fetch(fixture.gameUrl + '/?dealer=astrid&presentation=local&rehearsal=1');
    assert.deepEqual(gameLaneFromDocument(gameDataset(await local.text())), { lane: 'mobile-phone', dealer: 'astrid', presentation: 'local' });
    for (const query of ['', 'dealer=foreign', 'dealer=vera&dealer=mei', 'dealer=%22%3E%3Cscript%3E', 'dealer=nora', 'dealer=paow', 'dealer=dragge', 'lane=legacy&dealer=nora', 'lane=mobile-phone&dealer=mei']) {
      const response = await fetch(fixture.gameUrl + '/?' + query);
      const dataset = gameDataset(await response.text());
      assert.deepEqual(gameLaneFromDocument(dataset), { lane: 'mobile-phone', dealer: 'astrid', presentation: 'local' }, query);
    }
    for (const dealer of ['paow', 'dragge']) {
      const response = await fetch(fixture.gameUrl + '/?lane=layer-preview&dealer=' + dealer);
      assert.deepEqual(gameLaneFromDocument(gameDataset(await response.text())), { lane: 'layer-preview', dealer, presentation: 'layered' });
    }
    const entry = await fetch(fixture.gameUrl + '/blackjack?dealer=mei&rehearsal=1');
    assert.deepEqual(gameDataset(await entry.text()), {}, 'the separate offline login entry is not converted into a game');
    assert.equal((await fetch(fixture.gameUrl + '/api/auth/session')).status, 200);
  } finally {
    await fixture.stop();
  }
  assert.equal(existsSync(fixture.runDir), false, 'the isolated data is removed after the real server test');
});
