import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToString } from 'react-dom/server';
import * as login from '../lib/studio-login-client.mjs';
import { createStudioNativeAuthActions } from '../lib/studio-native-auth-actions.mjs';

const require = createRequire(import.meta.url), { transformSync } = require('next/dist/build/swc');
const compile = (source, filename) => transformSync(source, { filename,
  jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
  module: { type: 'commonjs' } }).code;
const compiled = compile(readFileSync(new URL('../components/studio-login.tsx', import.meta.url), 'utf8'), 'studio-login.tsx');
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, require: name => name.endsWith('.module.css')
  ? { __esModule: true, default: {} } : name === '../lib/studio-login-client.mjs' ? login : require(name), fetch }, { filename: 'studio-login.tsx' });
const propsFor = (authBase, mode = 'login') => ({ authBase, mode, resetAvailable: true,
  returnTo: '/studio/administration', token: mode === 'set-password' ? 't'.repeat(48) : null });
const ssr = props => renderToString(React.createElement(module.exports.StudioLogin, props));

test('installed React SSR renders every auth form as exact POST with all controls disabled before hydration', () => {
  for (const authBase of ['/api/auth', '/studio/api/auth']) for (const mode of ['login', 'set-password']) {
    const html = ssr(propsFor(authBase, mode)), forms = [...html.matchAll(/<form\b[^>]*>/g)];
    assert.equal(forms.length, mode === 'login' ? 2 : 1);
    for (const form of forms) { assert.match(form[0], /method="post"/); assert.match(form[0], new RegExp(`action="${authBase}/(?:login|reset-request|set-password)"`)); }
    for (const control of html.matchAll(/<(?:input|button)\b[^>]*>/g)) assert.match(control[0], /disabled=""/);
    assert.match(html, /aria-busy="true"/); assert.match(html, /role="status"/); assert.match(html, /<noscript>/);
    assert.doesNotMatch(html, /name="token"|tttttttt|formmethod="get"/);
  }
});

test('unhydrated browser POST fallback is rejected as non-JSON before auth, rate-limit or mail work', async () => {
  const actions = createStudioNativeAuthActions({ boDb: { prepare: () => assert.fail('no SQL work'), transaction: () => assert.fail('no transaction work') }, scope: { environment: 'fixture', workspaceId: 'croupier' },
    publicOrigin: 'https://login.fixture.invalid', allowedOrigins: ['https://login.fixture.invalid'],
    authorize: () => assert.fail('no auth work'), rateLimit: () => assert.fail('no rate-limit work'),
    clientAddress: () => assert.fail('no client work'), mail: { send: () => assert.fail('no mail work') } });
  for (const action of ['login', 'reset-request', 'set-password']) {
    const response = await actions.handle(new Request(`https://login.fixture.invalid/studio/api/auth/${action}`, {
      method: 'POST', headers: { Origin: 'https://login.fixture.invalid', 'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/x-www-form-urlencoded' }, body: 'user=synthetic&pass=fixture-only' }));
    assert.equal(response.status, 415); assert.doesNotMatch(await response.text(), /fixture-only|synthetic/);
  }
});

// Optional actual browser lifecycle fixture. It uses installed production React
// modules and intercepted synthetic origins; no devserver or external request.
// CI without browser dependencies still executes the actual SSR/API tests above.
const browserModule = process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
test('actual browser cold Enter/submit stays inert and hydrated forms use JSON POST only', { skip: !browserModule }, async () => {
  const { chromium } = await import(pathToFileURL(browserModule).href);
  const readCjs = (packageName, name) => readFileSync(join(dirname(require.resolve(`${packageName}/package.json`)), 'cjs', name), 'utf8');
  const modules = {
    react: readCjs('react', 'react.production.js'),
    'react/jsx-runtime': readCjs('react', 'react-jsx-runtime.production.js'),
    'react-dom': readCjs('react-dom', 'react-dom.production.js'),
    'react-dom/client': readCjs('react-dom', 'react-dom-client.production.js'),
    scheduler: readCjs('scheduler', 'scheduler.production.js'),
    '../lib/studio-login-client.mjs': compile(readFileSync(new URL('../lib/studio-login-client.mjs', import.meta.url), 'utf8'), 'studio-login-client.mjs'),
    './studio-administration.module.css': 'module.exports={__esModule:true,default:{}};',
    component: compiled,
  };
  const bootstrap = props => `(() => { const sources=${JSON.stringify(modules)},cache={},process={env:{NODE_ENV:'production'}};
    function require(name){if(cache[name])return cache[name].exports;const m=cache[name]={exports:{}};
      new Function('module','exports','require','process',sources[name])(m,m.exports,require,process);return m.exports;}
    window.fixtureHydrate=()=>require('react-dom/client').hydrateRoot(document.getElementById('root'),
      require('react').createElement(require('component').StudioLogin,${JSON.stringify(props)})); })();`;
  const browser = await chromium.launch({ headless: true, ...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL ? { channel: process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL } : {}) });
  try {
    for (const authBase of ['/api/auth', '/studio/api/auth']) for (const mode of ['login', 'set-password']) {
      const props = propsFor(authBase, mode), requests = [], context = await browser.newContext();
      try {
        const page = await context.newPage(); const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://login.fixture.invalid/**', async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.pathname === '/login') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<div id="root">${ssr(props)}</div>` });
          requests.push({ path: url.pathname, search: url.search, method: request.method(), contentType: request.headers()['content-type'], body: request.postData() });
          return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"fixture-denied"}' });
        });
        await page.goto('https://login.fixture.invalid/login');
        assert.equal(await page.locator('form:not(details form) input:enabled').count(), 0);
        assert.equal(await page.locator('form:not(details form) button:enabled').count(), 0);
        assert.deepEqual(await page.locator('form').evaluateAll(forms => forms.map(form => [...new FormData(form).keys()])), mode === 'login' ? [[], []] : [[]]);
        await page.keyboard.press('Enter'); await page.waitForTimeout(30); assert.equal(requests.length, 0);
        // Even a forced native submit uses the exact internal POST fallback.
        // Disabled controls contribute no password/user/token to FormData.
        const coldPost = page.waitForResponse(response => response.url().includes(authBase));
        await page.locator('form').first().evaluate(form => form.requestSubmit()); await coldPost;
        await page.waitForURL(url => url.pathname === `${authBase}/${mode}`, { waitUntil: 'load' });
        assert.equal(requests.length, 1); assert.equal(requests[0].method, 'POST'); assert.equal(requests[0].search, '');
        assert.equal(requests[0].body ?? '', '');
        await page.goto('https://login.fixture.invalid/login'); requests.length = 0;
        await page.addScriptTag({ content: bootstrap(props) }); await page.evaluate(() => window.fixtureHydrate());
        await page.waitForFunction(() => document.querySelector('button[type="submit"]')?.disabled === false);
        const form = page.locator('form').first();
        if (mode === 'login') await form.locator('[name="user"]').fill('synthetic');
        await form.locator('[name="pass"]').fill('fixture-password-only');
        if (mode === 'set-password') await form.locator('[name="confirm"]').fill('fixture-password-only');
        await form.locator('[name="pass"]').press('Enter');
        await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes('Inloggningen') || document.querySelector('[role="status"]')?.textContent?.includes('Åtgärden'));
        assert.equal(requests.length, 1); assert.equal(requests[0].method, 'POST'); assert.equal(requests[0].search, '');
        assert.equal(requests[0].path, `${authBase}/${mode}`); assert.equal(requests[0].contentType, 'application/json');
        assert.equal(JSON.parse(requests[0].body).pass, 'fixture-password-only');
        assert.equal(await form.locator('[name="pass"]').inputValue(), '');
        if (mode === 'login') {
          await page.locator('summary').click(); const reset = page.locator('details form');
          await reset.locator('input').fill('synthetic'); const resetResponse=page.waitForResponse(response => response.url().endsWith('/reset-request'));
          await reset.locator('input').press('Enter'); await resetResponse;
          await page.waitForFunction(() => document.querySelector('details button')?.disabled === false);
          assert.equal(requests.length, 2); assert.equal(requests[1].path, `${authBase}/reset-request`);
          assert.equal(requests[1].method, 'POST'); assert.equal(requests[1].search, '');
        }
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});
