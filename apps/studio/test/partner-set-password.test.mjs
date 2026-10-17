import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { handlePartnerAuth } from '../lib/partner-session.mjs';
import { createStudioLoginRateLimit } from '../lib/studio-native-auth-actions.mjs';
import * as loginClient from '../lib/studio-login-client.mjs';

const publicOrigin = 'https://public.example.invalid';
const labOrigin = 'https://studio.example.invalid';
const scope = { environment: 'fixture', workspaceId: 'croupier' };
const now = 1_700_000_000_000;
const password = 'partner-password';
const gameDb = { prepare: () => ({ all: async () => [], get: async () => undefined, run: async () => ({ changes: 0 }) }) };

function fixture() {
  const users = [
    { id: '42', username: 'new.person@partner.invalid', email: 'new.person@partner.invalid', role: 'partner', salt: null, hash: null },
    { id: '7', username: 'internal-admin', email: 'admin@studio.invalid', role: 'admin', salt: 'ab', hash: 'cd'.repeat(64) },
  ];
  const tokens = [];
  const epochs = new Map();
  const sessions = [];
  const meta = new Map();
  const memberships = [
    { userId: '42', operatorId: 'north', roleId: 'partner-viewer', status: 'invited', revision: 1 },
    { userId: '42', operatorId: 'south', roleId: 'partner-editor', status: 'invited', revision: 3 },
    { userId: '42', operatorId: 'east', roleId: 'partner-viewer', status: 'suspended', revision: 1 },
    { userId: '9', operatorId: 'north', roleId: 'partner-viewer', status: 'invited', revision: 1 },
  ];
  const boDb = {
    async transaction(work) {
      const snap = {
        users: structuredClone(users), tokens: structuredClone(tokens), epochs: [...epochs.entries()],
        sessions: structuredClone(sessions), meta: [...meta.entries()],
      };
      try { return await work(); }
      catch (error) {
        users.splice(0, users.length, ...snap.users);
        tokens.splice(0, tokens.length, ...snap.tokens);
        epochs.clear();
        for (const [key, value] of snap.epochs) epochs.set(key, value);
        sessions.splice(0, sessions.length, ...snap.sessions);
        meta.clear();
        for (const [key, value] of snap.meta) meta.set(key, value);
        throw error;
      }
    },
    prepare(sql) {
      const all = async (...args) => {
        if (sql.startsWith('DELETE FROM tokens') && sql.includes('RETURNING')) {
          const found = tokens.filter(row => (row.token === args[0] || row.token === args[1]) && row.exp >= args[2] && (row.kind === 'invite' || row.kind === 'reset'));
          for (const row of found) tokens.splice(tokens.indexOf(row), 1);
          return found.map(row => ({ username: row.username, kind: row.kind }));
        }
        if (sql.startsWith('UPDATE users SET salt')) {
          const user = users.find(item => item.username === args[2]);
          if (!user) return [];
          user.salt = args[0];
          user.hash = args[1];
          return [{ id: user.id }];
        }
        if (sql.includes('FROM users') && sql.includes('lower(username)')) {
          const key = String(args[0] || '').toLowerCase();
          return users.filter(item => item.username.toLowerCase() === key || String(item.email || '').toLowerCase() === key).map(item => ({ ...item }));
        }
        if (sql.includes('FROM users') && sql.includes('username=?')) {
          return users.filter(item => item.username === args[0]).map(item => ({ ...item }));
        }
        if (sql.includes('FROM lab_sessions')) {
          return sessions.filter(item => item.token_digest === args[0] && item.expires > args[1]).map(item => ({ ...item }));
        }
        if (sql.includes('bo_auth_epochs')) {
          const epoch = epochs.get(String(args[0]));
          return epoch === undefined ? [] : [{ epoch }];
        }
        if (sql.includes('FROM meta')) return meta.has(args[0]) ? [{ v: meta.get(args[0]) }] : [];
        if (sql.includes('FROM player_accounts')) return [];
        return [];
      };
      return {
        all,
        async get(...args) { return (await all(...args))[0]; },
        async run(...args) {
          if (sql.startsWith('INSERT INTO bo_auth_epochs')) epochs.set(String(args[0]), (epochs.get(String(args[0])) || 0) + 1);
          else if (sql.startsWith('DELETE FROM tokens')) {
            for (let index = tokens.length - 1; index >= 0; index -= 1) {
              if (tokens[index].username === args[0]) tokens.splice(index, 1);
            }
          } else if (sql.startsWith('INSERT INTO lab_sessions')) {
            sessions.push({ token_digest: args[0], craig_user_id: args[1], role: args[2], source_stamp: args[3], auth_epoch: args[4], expires: args[5] });
          } else if (sql.startsWith('INSERT INTO meta')) meta.set(args[0], args[1]);
          return { changes: 1 };
        },
      };
    },
  };
  const store = {
    async listOperators() {
      return [{ id: 'north' }, { id: 'south' }, { id: 'east' }];
    },
    async listMemberships(operatorId) {
      return memberships.filter(item => item.operatorId === operatorId).map(item => ({ ...item }));
    },
    async upsertMembership(input) {
      const row = memberships.find(item => item.operatorId === input.operatorId && item.userId === input.userId);
      if (!row || row.revision !== input.expectedRevision) {
        throw Object.assign(new Error('studio_conflict'), { statusCode: 409 });
      }
      row.status = input.status;
      row.roleId = input.roleId;
      row.revision += 1;
      return { ...row };
    },
  };
  const limits = [];
  const config = {
    boDb, gameDb, scope, store, now: () => now,
    allowedOrigins: [publicOrigin, labOrigin],
    publicHosts: ['public.example.invalid', 'studio.example.invalid'],
    apiBase: '/studio/api/admin',
    authBase: '/studio/api/auth',
    rateLimit: async input => { limits.push(input); return true; },
    clientAddress: async () => '203.0.113.10',
  };
  function addToken(username, kind = 'invite', { raw = false } = {}) {
    const token = randomBytes(32).toString('base64url');
    tokens.push({
      token: raw ? token : `studio-sha256:${createHash('sha256').update(token).digest('hex')}`,
      username, kind, exp: Math.floor(now / 1000) + 72 * 3600,
    });
    return token;
  }
  return { users, tokens, epochs, memberships, config, limits, addToken };
}

function setRequest(token, passwordValue, { origin = publicOrigin, body } = {}) {
  const headers = {
    host: 'public.example.invalid', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json',
  };
  if (origin) headers.origin = origin;
  return new Request(`${publicOrigin}/studio/api/partner/set-password`, {
    method: 'POST', headers, body: JSON.stringify(body ?? { token, password: passwordValue }),
  });
}
function loginRequest(user, pass) {
  return new Request(`${publicOrigin}/studio/api/partner/login`, {
    method: 'POST',
    headers: {
      host: 'public.example.invalid', origin: publicOrigin, 'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ user, pass }),
  });
}
const member = (state, operatorId, userId = '42') => state.memberships.find(item => item.operatorId === operatorId && item.userId === userId);

describe('partner set-password', { concurrency: 1 }, () => {
  test('a partner invite without a hash sets scrypt credentials, bumps the epoch and activates invited memberships', async () => {
    const state = fixture();
    const token = state.addToken('new.person@partner.invalid');
    const before = await handlePartnerAuth(loginRequest('new.person@partner.invalid', password), state.config);
    assert.equal(before.status, 401);
    const response = await handlePartnerAuth(setRequest(token, password), state.config);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(response.headers.get('set-cookie'), null);
    const user = state.users[0];
    assert.equal(user.salt.length, 32);
    assert.equal(user.hash, scryptSync(password, user.salt, 64).toString('hex'));
    assert.equal(state.epochs.get('42'), 1);
    assert.equal(state.tokens.length, 0);
    assert.equal(member(state, 'north').status, 'active');
    assert.equal(member(state, 'north').revision, 2);
    assert.equal(member(state, 'south').status, 'active');
    assert.equal(member(state, 'south').revision, 4);
    assert.equal(member(state, 'east').status, 'suspended');
    assert.equal(member(state, 'north', '9').status, 'invited');
    const setLimits = state.limits.filter(item => item.action === 'set-password');
    assert.equal(setLimits[0].user, token);
    assert.equal(JSON.stringify(state.limits).includes(password), false);
    const again = await handlePartnerAuth(setRequest(token, password), state.config);
    assert.equal(again.status, 400);
    assert.deepEqual(await again.json(), { error: 'Invalid request' });
    assert.equal(again.headers.get('set-cookie'), null);
    const loggedIn = await handlePartnerAuth(loginRequest('new.person@partner.invalid', password), state.config);
    assert.equal(loggedIn.status, 200);
    assert.match(loggedIn.headers.get('set-cookie'), /partner_session=[a-f0-9]{64}/);
  });

  test('a raw legacy token and a reset token for a partner who already has a hash are accepted once', async () => {
    const state = fixture();
    const raw = state.addToken('new.person@partner.invalid', 'invite', { raw: true });
    assert.equal((await handlePartnerAuth(setRequest(raw, password), state.config)).status, 200);
    assert.equal(state.users[0].hash, scryptSync(password, state.users[0].salt, 64).toString('hex'));
    const reset = fixture();
    reset.users[0].salt = 'aa'.repeat(16);
    reset.users[0].hash = 'bb'.repeat(64);
    const token = reset.addToken('new.person@partner.invalid', 'reset');
    const next = 'reset-password-value';
    assert.equal((await handlePartnerAuth(setRequest(token, next), reset.config)).status, 200);
    assert.equal(reset.users[0].hash, scryptSync(next, reset.users[0].salt, 64).toString('hex'));
    assert.notEqual(reset.users[0].hash, 'bb'.repeat(64));
    assert.equal(reset.epochs.get('42'), 1);
    assert.equal(member(reset, 'north').status, 'active');
    const inviteOverHash = fixture();
    inviteOverHash.users[0].salt = 'aa'.repeat(16);
    inviteOverHash.users[0].hash = 'cc'.repeat(64);
    const blocked = inviteOverHash.addToken('new.person@partner.invalid', 'invite');
    const refused = await handlePartnerAuth(setRequest(blocked, password), inviteOverHash.config);
    assert.equal(refused.status, 403);
    assert.equal(inviteOverHash.users[0].hash, 'cc'.repeat(64));
    assert.equal(inviteOverHash.tokens.length, 1);
    assert.equal(member(inviteOverHash, 'north').status, 'invited');
  });

  test('an admin token is refused on the partner surface without consuming it or revealing the account', async () => {
    const state = fixture();
    const token = state.addToken('internal-admin');
    const response = await handlePartnerAuth(setRequest(token, password), state.config);
    const body = await response.json();
    assert.equal(response.status, 403);
    assert.deepEqual(body, { error: 'Access denied' });
    assert.equal(JSON.stringify(body).includes(token), false);
    assert.equal(JSON.stringify(body).includes('internal-admin'), false);
    assert.equal(state.users[1].hash, 'cd'.repeat(64));
    assert.equal(state.tokens.length, 1);
    assert.equal(state.epochs.has('7'), false);
  });

  test('a weak password is 422 and a missing Origin is 403, both before the token is consumed', async () => {
    const state = fixture();
    const token = state.addToken('new.person@partner.invalid');
    for (const weak of ['short', 'a'.repeat(129), `abcdefg\u0000`]) {
      const response = await handlePartnerAuth(setRequest(token, weak), state.config);
      assert.equal(response.status, 422, weak);
      assert.deepEqual(await response.json(), { error: 'Invalid data' });
    }
    assert.equal(state.limits.length, 0);
    assert.equal(state.tokens.length, 1);
    assert.equal(state.users[0].hash, null);
    const studioBody = await handlePartnerAuth(setRequest(token, password, { body: { token, pass: password } }), state.config);
    assert.equal(studioBody.status, 400);
    const missingOrigin = await handlePartnerAuth(setRequest(token, password, { origin: null }), state.config);
    assert.equal(missingOrigin.status, 403);
    assert.deepEqual(await missingOrigin.json(), { error: 'Access denied' });
    assert.equal(state.tokens.length, 1);
    assert.equal(state.limits.length, 0);
  });

  test('set-password shares the studio limiter and stops on the eleventh attempt', async () => {
    const state = fixture();
    state.config.rateLimit = createStudioLoginRateLimit({ boDb: state.config.boDb, now: () => now });
    const token = 'd'.repeat(43);
    for (let index = 0; index < 10; index += 1) {
      const response = await handlePartnerAuth(setRequest(token, password), state.config);
      assert.equal(response.status, 400, String(index));
    }
    const blocked = await handlePartnerAuth(setRequest(token, password), state.config);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('retry-after'), '900');
    const body = await blocked.json();
    assert.deepEqual(body, { error: 'Too many attempts' });
    assert.equal(JSON.stringify(body).includes(password), false);
  });
});

test('partner set-password page renders the shared form against the partner auth base', async () => {
  const require = createRequire(import.meta.url);
  const { transformSync } = require('next/dist/build/swc');
  const compile = (source, filename) => transformSync(source, {
    filename,
    jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  }).code;
  const loginModule = { exports: {} };
  vm.runInNewContext(compile(readFileSync(new URL('../components/studio-login.tsx', import.meta.url), 'utf8'), 'studio-login.tsx'), {
    module: loginModule, exports: loginModule.exports, URL,
    require: name => name.endsWith('.module.css') ? { __esModule: true, default: {} }
      : name === '../lib/studio-login-client.mjs' ? loginClient : require(name),
  });
  const pageCode = compile(readFileSync(new URL('../app/partner/set-password/page.tsx', import.meta.url), 'utf8'), 'page.tsx');
  const renderPage = async apiBase => {
    const pageModule = { exports: {} };
    const config = { apiBase, authBase: '/studio/api/auth', allowedOrigins: ['https://game.fixture.invalid', 'https://studio.fixture.invalid'] };
    vm.runInNewContext(pageCode, {
      module: pageModule, exports: pageModule.exports, URL,
      require: name => {
        if (name === '@/components/studio-login') return loginModule.exports;
        if (name === '@/lib/studio-native-runtime.mjs') return {
          nativeStudioAdminEnabled: () => true,
          nativeStudioAdminConfiguration: () => config,
        };
        if (name === '@/lib/studio-login-client.mjs') return loginClient;
        if (name === 'next/navigation') return { notFound() { throw new Error('not-found'); } };
        return require(name);
      },
    });
    const tree = await pageModule.exports.default({ searchParams: Promise.resolve({ t: 'b'.repeat(43) }) });
    return renderToStaticMarkup(tree);
  };
  const mounted = await renderPage('/studio/api/admin');
  assert.match(mounted, /action="\/studio\/api\/partner\/set-password"/);
  assert.match(mounted, /Välj lösenord/);
  assert.match(mounted, /Nytt lösenord \(8–128 tecken\)/);
  const standalone = await renderPage('/api/admin');
  assert.match(standalone, /action="\/api\/partner\/set-password"/);
});
