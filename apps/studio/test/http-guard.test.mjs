import test from 'node:test';
import assert from 'node:assert/strict';
import { assertLocalRequest, assertLocalPageRequest, readLocalJson, jsonResponse, errorResponse } from '../lib/http-guard.mjs';
import { readFile, readdir } from 'node:fs/promises';
import { StudioError } from '../lib/project-store.mjs';
import { StudioValidationError } from '../../../packages/presentation/contracts/studio-model.mjs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';

const MAX_BYTES = 1024 * 1024;
const LOCAL = 'http://127.0.0.1:4188';
function jsonRequest(body = '{"ok":true}', headers = {}) {
  return new Request(`${LOCAL}/api/project`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers },
    ...(body !== undefined ? { body, duplex: 'half' } : {}),
  });
}
const status = expected => error => error instanceof StudioError && error.statusCode === expected;

test('localhost, IPv4 loopback and IPv6 loopback are allowed with matching origins', () => {
  for (const host of ['localhost:4188', '127.0.0.1:4188', '[::1]:4188']) {
    const request = new Request(`http://${host}/api/project`, { headers: { Host: host, Origin: `http://${host}`, 'Sec-Fetch-Site': 'same-origin' } });
    assert.doesNotThrow(() => assertLocalRequest(request));
  }
});

test('URL hostname is checked even when Host and Origin are absent', () => {
  assert.doesNotThrow(() => assertLocalRequest(new Request(`${LOCAL}/api/health`)));
  assert.throws(() => assertLocalRequest(new Request('https://foreign.example/api/project')), status(403));
});

test('foreign or malformed Host headers and look-alike localhost names are blocked', () => {
  for (const host of ['foreign.example:4188', 'localhost.foreign.example:4188', '127.0.0.1.foreign.example:4188', '0.0.0.0:4188', '[2001:db8::1]:4188', '[']) {
    assert.throws(() => assertLocalRequest(new Request(`${LOCAL}/api/project`, { headers: { Host: host } })), status(403), host);
  }
});

test('foreign origins, other local ports, opaque origins and non-HTTP schemes are blocked', () => {
  for (const origin of ['https://foreign.example', 'http://127.0.0.1:4199', 'http://localhost:4188', 'null', 'not-a-url', 'file://127.0.0.1:4188', 'ftp://127.0.0.1:4188']) {
    assert.throws(() => assertLocalRequest(new Request(`${LOCAL}/api/project`, { headers: { Origin: origin } })), status(403), origin);
  }
});

test('cross-site fetches are blocked even when Host and Origin otherwise match', () => {
  const request = new Request(`${LOCAL}/api/project`, { headers: { Host: '127.0.0.1:4188', Origin: LOCAL, 'Sec-Fetch-Site': 'cross-site' } });
  assert.throws(() => assertLocalRequest(request), status(403));
  assert.doesNotThrow(() => assertLocalRequest(new Request(`${LOCAL}/api/project`, { headers: { 'Sec-Fetch-Site': 'none' } })));
});

function pageRequest(headers = {}, method = 'GET', url = `${LOCAL}/openclaw`) {
  return new Request(url, { method, headers: { Host: '127.0.0.1:4188', 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document', ...headers } });
}

test('top-level GET navigation can open the lab from an extension or external link', () => {
  for (const origin of [undefined, 'https://external.example', 'chrome-extension://fixture-extension']) {
    const request = pageRequest(origin ? { Origin: origin } : {});
    assert.doesNotThrow(() => assertLocalPageRequest(request));
    assert.throws(() => assertLocalRequest(request), status(403), 'The same exception must not apply to API requests.');
  }
});

test('page navigation still requires a loopback URL and Host, not a spoofed header', () => {
  assert.throws(() => assertLocalPageRequest(pageRequest({}, 'GET', 'https://external.example/openclaw')), status(403));
  assert.throws(() => assertLocalPageRequest(pageRequest({ Host: 'external.example' })), status(403));
  assert.throws(() => assertLocalRequest(pageRequest({}, 'GET', 'https://external.example/api/project')), status(403));
  for (const host of ['localhost:4188', '[::1]:4188']) assert.doesNotThrow(() => assertLocalPageRequest(pageRequest({ Host: host }, 'GET', `http://${host}/openclaw`)));
});

test('iframe, non-navigation, missing metadata and mutation cannot use the page exception', () => {
  for (const destination of ['iframe', 'frame', 'embed', 'object', 'empty', '']) assert.throws(() => assertLocalPageRequest(pageRequest({ 'Sec-Fetch-Dest': destination })), status(403));
  for (const mode of ['cors', 'no-cors', 'same-origin', '']) assert.throws(() => assertLocalPageRequest(pageRequest({ 'Sec-Fetch-Mode': mode })), status(403));
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) assert.throws(() => assertLocalPageRequest(pageRequest({}, method)), status(403));
  assert.throws(() => assertLocalPageRequest(pageRequest({ 'Next-Action': 'not-a-real-action' })), status(403));
  assert.throws(() => assertLocalPageRequest(pageRequest({ 'Sec-Fetch-Dest': 'iframe', 'Sec-Fetch-Site': 'same-origin', Origin: LOCAL })), status(403));
});

test('ordinary same-origin page and RSC fetches still work without relaxing foreign fetches', () => {
  assert.doesNotThrow(() => assertLocalPageRequest(new Request(`${LOCAL}/openclaw`)));
  const sameOrigin = { 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Site': 'same-origin', Origin: LOCAL, RSC: '1' };
  assert.doesNotThrow(() => assertLocalPageRequest(pageRequest(sameOrigin)));
  assert.throws(() => assertLocalPageRequest(pageRequest({ ...sameOrigin, Origin: 'https://external.example' })), status(403));
});

test('loadControlStudio delegates to the guarded UI helper; API routes cannot use the navigation exception', async () => {
  const page = await readFile(new URL('../app/control-studio-data.tsx', import.meta.url), 'utf8');
  assert.match(page, /studioUiInitialData/);
  for (const file of ['clips', 'compositions', 'events', 'rehearsal', 'probe', 'openclaw']) {
    const source = await readFile(new URL(`../app/control/${file}/page.tsx`, import.meta.url), 'utf8');
    assert.match(source, /loadControlStudio/, file);
  }
  const tree = await readFile(new URL('../app/control/tree/page.tsx', import.meta.url), 'utf8');
  assert.match(tree, /permanentRedirect/);
  assert.match(tree, /authorizeUiPage/);
  assert.doesNotMatch(tree, /loadControlStudio/);
  const require = createRequire(new URL('../lib/ui-server.ts', import.meta.url));
  const helperSource = await readFile(new URL('../lib/ui-server.ts', import.meta.url), 'utf8');
  const compiled = stripTypeScriptTypes(helperSource).replace(/from (['"])([^'"]+)\1/g, (_match, _quote, specifier) =>
    `from '${specifier.startsWith('.') ? new URL(specifier, new URL('../lib/ui-server.ts', import.meta.url)).href : pathToFileURL(require.resolve(specifier)).href}'`);
  const helper = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
  const previous = process.env.CROUPIER_LAB_REMOTE_UI;
  process.env.CROUPIER_LAB_REMOTE_UI = '';
  try {
    await assert.doesNotReject(helper.authorizeUiPage(pageRequest({Origin: 'chrome-extension://fixture-extension'})));
    await assert.rejects(helper.authorizeUiPage(pageRequest({'Sec-Fetch-Dest': 'iframe'})), status(403));
    await assert.rejects(helper.studioUiInitialData(pageRequest({}, 'GET', 'https://external.example/openclaw')), status(403));
    await assert.rejects(helper.studioUiInitialData(pageRequest({'Next-Action': 'forged-action'})), status(403));
  } finally {if (previous === undefined) delete process.env.CROUPIER_LAB_REMOTE_UI; else process.env.CROUPIER_LAB_REMOTE_UI = previous;}
  const routes = await readdir(new URL('../app/api/', import.meta.url), { recursive: true, withFileTypes: true });
  for (const file of routes.filter(file => file.isFile() && file.name === 'route.ts')) {
    const source = await readFile(`${file.parentPath}/${file.name}`, 'utf8');
    assert.doesNotMatch(source, /assertLocalPageRequest|studioUiInitialData|authorizeUiPage|\/ui-server/, file.parentPath);
  }
});

test('JSON parser applies local-origin guard before reading the body', async () => {
  await assert.rejects(readLocalJson(jsonRequest('{"ok":true}', { Origin: 'https://foreign.example' })), status(403));
});

test('exact JSON media type supports parameters and case-insensitive spelling', async () => {
  for (const contentType of ['application/json', 'application/json; charset=utf-8', 'Application/JSON; charset=UTF-8']) {
    assert.deepEqual(await readLocalJson(jsonRequest('{"ok":true}', { 'Content-Type': contentType })), { ok: true });
  }
});

test('absent/non-JSON types and JSON-like media type prefixes are rejected', async () => {
  const absent = new Request(`${LOCAL}/api/project`, { method: 'PUT', body: new Uint8Array([123, 125]) });
  await assert.rejects(readLocalJson(absent), status(415));
  for (const contentType of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data', 'application/jsonp', 'application/json-malicious']) {
    await assert.rejects(readLocalJson(jsonRequest('{"ok":true}', { 'Content-Type': contentType })), status(415), contentType);
  }
});

test('declared Content-Length above one MiB is rejected before parsing', async () => {
  await assert.rejects(readLocalJson(jsonRequest('{}', { 'Content-Length': String(MAX_BYTES + 1) })), status(413));
});

test('body of exactly one MiB is accepted', async () => {
  const value = 'x'.repeat(MAX_BYTES - 2);
  assert.equal(await readLocalJson(jsonRequest(JSON.stringify(value))), value);
});

test('actual streamed size is enforced without trusting missing or false Content-Length', async () => {
  for (const headers of [{}, { 'Content-Length': '1' }]) {
    let cancelled = false;
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(MAX_BYTES)); controller.enqueue(new Uint8Array([32])); },
      cancel() { cancelled = true; },
    });
    await assert.rejects(readLocalJson(jsonRequest(stream, headers)), status(413));
    assert.equal(cancelled, true, 'Oversized request body must be cancelled.');
  }
});

test('UTF-8 JSON split across stream chunks is reconstructed correctly', async () => {
  const bytes = new TextEncoder().encode('{"label":"Återvändande spelare"}');
  const stream = new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } });
  assert.deepEqual(await readLocalJson(jsonRequest(stream)), { label: 'Återvändande spelare' });
});

test('missing body and malformed JSON return bounded public input errors', async () => {
  const missing = new Request(`${LOCAL}/api/project`, { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(readLocalJson(missing), error => status(400)(error) && error.message === 'JSON saknas.');
  for (const body of ['', '{ invalid JSON', '{"label":', 'undefined']) {
    await assert.rejects(readLocalJson(jsonRequest(body)), error => status(400)(error) && error.message === 'Ogiltig JSON.');
  }
});

test('JSON responses disable caching and MIME sniffing', async () => {
  const response = jsonResponse({ ok: true }, 201);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-type'), /^application\/json/);
  assert.deepEqual(await response.json(), { ok: true });
});

test('generic exceptions never expose server paths, stacks or upstream details', async () => {
  for (const error of [new Error('C:/private/.env TOKEN=sentinel-test'), null, 'unexpected upstream failure', { message: 'sensitive detail', statusCode: 200, errors: ['do not return'] }, { message: 'C:/private/upstream', statusCode: 503 }, Object.assign(new Error('sentinel-test private'), { statusCode: 400 })]) {
    const response = errorResponse(error);
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.deepEqual(body, { error: 'Ett lokalt serverfel uppstod.' });
    assert.doesNotMatch(JSON.stringify(body), /sentinel|private|sensitive|upstream|stack/);
  }
});

test('expected input errors retain useful status and validation detail is capped', async () => {
  const conflict = errorResponse(new StudioError('Läs in den nya versionen.', 409));
  assert.equal(conflict.status, 409);
  assert.deepEqual(await conflict.json(), { error: 'Läs in den nya versionen.' });
  const validation = new StudioValidationError(Array.from({ length: 30 }, (_, i) => `Fält ${i} är ogiltigt`));
  const response = errorResponse(validation);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).errors.length, 12);
});
