import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { build } from '../../apps/web/tools/player-ui-build.mjs';
import { ENGINE_QA_SKIP, createEngineDatabase, freePort, installBaseStudioRuntime, startEngine } from '../fixtures/engine-qa.mjs';

const entryModule = new URL('../../services/game/public/blackjack-entry.mjs', import.meta.url);
const playerPassword = 'Synthetic-Player-Test-Password';

// Execute the entry module with browser boundaries, including its real form
// handler. HTTP callers provide the served source and the real auth transport.
async function loginNavigation({ source, origin, search = '', authenticated = false, request }) {
  const originals = new Map(['document', 'location', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const form = { hidden: true };
  const nodes = { form, '#status': {}, '#submit': {}, '#password': { value: playerPassword },
    '#username': { value: 'fixture-player' }, '#login-help': {}, '#legacy-admin': {} };
  const navigations = [], current = new URL('/player-login' + search, origin);
  try {
    globalThis.document = { documentElement: { dataset: {} }, querySelector: selector => nodes[selector] };
    globalThis.location = { href: current.href, origin, search: current.search,
      assign: value => navigations.push(new URL(value, current).href), replace: value => navigations.push(new URL(value, current).href) };
    globalThis.fetch = request ?? (async url => Response.json(url === '/api/auth/session'
      ? { authenticated, playerAccounts: true } : { ok: true }));
    // A data module needs absolute imports. Resolve them against the product
    // module without changing its navigation or login implementation.
    const executable = source.replace(/\bfrom\s*(['"])(\.[^'"]+)\1/g,
      (_, quote, specifier) => 'from ' + JSON.stringify(new URL(specifier, entryModule).href));
    await import('data:text/javascript;base64,' + Buffer.from(executable + '\n// ' + randomUUID()).toString('base64'));
    if (!authenticated) {
      assert.equal(form.hidden, false, 'the anonymous player can log in');
      assert.equal(nodes['#submit'].disabled, false);
      assert.deepEqual(navigations, [], 'an anonymous player is not redirected before login');
      await form.onsubmit({ preventDefault() {} });
    }
    return navigations;
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

test('actual player login navigates to the lobby or an allowed roulette return, never an unsafe destination', async () => {
  const source = await readFile(entryModule, 'utf8'), origin = 'https://login.example.invalid';
  const room = '/game?game=roulette&operator=north&table=room-one';
  const legacyRoom = '/play/roulette?operator=north&table=room-one';
  const cases = [['', '/lobby'], [room, room], [legacyRoom, legacyRoom],
    ['https://evil.invalid/steal', '/lobby'], ['//evil.invalid/steal', '/lobby'],
    ['/\\evil.invalid/steal', '/lobby'], ['javascript:alert(1)', '/lobby'],
    ['/game?game=blackjack', '/lobby'], ['/admin', '/lobby'],
    [room + '&game=roulette', '/lobby'], [room + '&next=https://evil.invalid', '/lobby'],
    [room + '#fragment', '/lobby'], ['/other/../game?game=roulette', '/lobby']];
  for (const [returnTo, destination] of cases) for (const authenticated of [false, true]) {
    const search = '?' + new URLSearchParams({ returnTo, next: 'https://evil.invalid/steal', returnUrl: '//evil.invalid/steal' });
    const navigations = await loginNavigation({ source, origin, search, authenticated });
    assert.deepEqual(navigations, [new URL(destination, origin).href], JSON.stringify({ returnTo, authenticated }));
  }
  const rejected = await loginNavigation({ source, origin, request: async url => url === '/api/auth/session'
    ? Response.json({ authenticated: false, playerAccounts: true }) : Response.json({ error: 'unauthorized' }, { status: 401 }) });
  assert.deepEqual(rejected, [], 'rejected credentials never navigate');
});

test('real entry serves login and preserves account/table identity across a server restart with an empty fixture database', { skip: ENGINE_QA_SKIP }, async t => {
  const directory=await mkdtemp(join(tmpdir(),'blackjack-entry-'));
  const database=await createEngineDatabase(t);
  const studio=await installBaseStudioRuntime(t,database);
  const port=await freePort();
  const origin=`http://127.0.0.1:${port}`;
  let engine;
  const stop=async()=>{await engine?.stop();engine=null;};
  const start=async()=>{
    engine=await startEngine(t,{database,port,preload:[...studio.preload,new URL('../fixtures/generated-speech-stream-fetch.mjs',import.meta.url).href],
      env:{...studio.env,NODE_ENV:'production',CROUPIER_CLOUD_RUNTIME:'1',CROUPIER_PLAYER_ACCOUNTS:'1',
        CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER:'fixtureadmin',CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD:'Synthetic-Operator-Test-Password',
        DEMO_GUEST_ACCESS:'',CROUPIER_GENERATED_SPEECH:'',CROUPIER_GENERATED_SPEECH_STREAMING:'',CROUPIER_ASTRID_CAMERA:'',
        CROUPIER_STREAM_LANE:'lissabon-stream-lane',PUBLIC_URL:'https://game.example.invalid'}});
  };
  let cookie='';
  const networkFetch = globalThis.fetch;
  const request = async (path, options = {}) => {
    const headers = new Headers(options.headers);
    headers.set('origin', origin); headers.set('cookie', cookie);
    const response = await networkFetch(new URL(path, origin), { ...options, headers });
    if (response.headers.has('set-cookie')) cookie=response.headers.get('set-cookie').split(';')[0];
    return response;
  };
  const post=async(path,body)=>{
    return request(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  };
  try {
    await build({origin:'https://game.example.invalid',output:pathToFileURL(join(directory,'site')+'/')});
    const landing=await readFile(join(directory,'site','index.html'),'utf8');
    assert.match(landing,/href="https:\/\/game.example.invalid\/blackjack"/);
    assert.doesNotMatch(landing,/localhost|127\.0\.0\.1|\{\{BLACKJACK_URL\}\}/);
    await start();
    // The canonical entry is fixed: an anonymous /blackjack goes to the player login, which serves the entry.
    const anonymous=await fetch(origin+'/blackjack',{redirect:'manual'});assert.equal(anonymous.status,303);assert.match(anonymous.headers.get('location'),/^\/player-login/);
    const entry=await fetch(origin+'/player-login');assert.equal(entry.status,200);assert.match(await entry.text(),/blackjack-entry.mjs/);
    const script=await fetch(origin+'/blackjack-entry.mjs');assert.equal(script.status,200);const loginScript=await script.text();
    const configuration=await(await fetch(origin+'/api/auth/session')).json();assert.equal(configuration.playerAccounts,true);assert.equal(configuration.guest,false);
    assert.equal((await post('/api/player',{})).status,401);
    const registered=await post('/api/auth/player/register',{username:'fixture-player',password:playerPassword,id:'forged-player'});
    assert.equal(registered.status,200);assert.match(registered.headers.get('set-cookie'),/; Secure/);
    assert.equal((await post('/api/auth/logout',{})).status,200);
    assert.deepEqual(await loginNavigation({source:loginScript,origin,request}),[origin+'/lobby']);
    assert.equal((await(await request('/api/auth/session')).json()).authenticated,true);
    const unsafeSearch='?'+new URLSearchParams({returnTo:'https://evil.invalid/steal',next:'//evil.invalid/steal'});
    assert.deepEqual(await loginNavigation({source:loginScript,origin,search:unsafeSearch,authenticated:true,request}),[origin+'/lobby']);
    const player=await(await post('/api/player',{id:'forged-player'})).json();
    assert.ok(player.id);assert.notEqual(player.id,'forged-player');assert.equal(player.name,'fixture-player');
    const table=await(await post('/api/table',{op:'state'})).json();assert.equal(table.error,undefined);
    assert.equal((await fetch(origin+'/api/bo/me',{headers:{cookie}})).status,404);
    assert.equal((await fetch(origin+'/api/bo/users',{headers:{cookie}})).status,404);
    await stop();await start();
    const restored=await(await post('/api/player',{})).json();assert.equal(restored.id,player.id);assert.equal(restored.balance,player.balance);
    const restoredTable=await(await post('/api/table',{op:'state'})).json();assert.deepEqual(restoredTable,table);
    assert.equal((await post('/api/auth/logout',{})).status,200);
    assert.equal((await post('/api/player',{})).status,401);
  } finally {await stop();await rm(directory,{recursive:true,force:true});}
});
