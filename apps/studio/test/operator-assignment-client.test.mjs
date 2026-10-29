// Bolag › Tilldelat i Admin: fältet renderar tilldelningen och skickar hela
// tilldelningen till paketets publiceringsväg (operator-package,
// publish-assignment) med CAS på revisionen. Serverns regler provas i
// admin-assignment.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { allowLocked, assignmentDirty, assignmentDraft, assignmentProblem, assignmentPublishError, publishAssignment, publishCompanyAssignment, toggleAllow, toggleListItem } from '../lib/operator-assignment-client.mjs';
import { PACKAGE_RECEIPT_MISMATCH } from '../lib/operator-package-client.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
function loadTs(fileUrl) {
  const source = readFileSync(fileUrl, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(fileUrl), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  const localRequire = createRequire(fileUrl);
  vm.runInNewContext(output.code, { module, exports: module.exports, structuredClone, URL, URLSearchParams, fetch: globalThis.fetch,
    window: new Proxy({}, { get: (_target, key) => globalThis.window?.[key] }),
    require: name => {
      // En enda React-kopia: komponenten i client/ renderas av provets react-dom.
      if (name === 'react' || name.startsWith('react/')) return require(name);
      if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('./') || name.startsWith('../')) {
        for (const suffix of ['', '.tsx', '.ts', '.mjs', '.js']) {
          const path = fileURLToPath(new URL(name + suffix, fileUrl));
          if (!existsSync(path)) continue;
          if (/\.(mjs|js|json)$/.test(path)) return localRequire(path);
          return loadTs(pathToFileURL(path));
        }
      }
      return localRequire(name);
    } }, { filename: fileURLToPath(fileUrl) });
  return module.exports;
}

const view = { allow: { dealer: true, tableAsset: false, background: false, language: false, limit: true, pause: false },
  adjustable: { dealer: true, tableAsset: false, background: true }, limitPresets: ['casual'], languages: ['sv', 'en'],
  options: { limitPresets: ['casual', 'prive', 'high'], languages: ['en', 'sv'] } };

test('the field renders every allow choice, the lists and a locked layer', () => {
  const { AssignmentField } = loadTs(new URL('../client/admin/components/studio/assignment-field.tsx', import.meta.url));
  const html = renderToStaticMarkup(React.createElement(AssignmentField, { revision: 4, view, draft: assignmentDraft(view), onDraft() {}, disabled: false }));
  // Rutorna läses per namn, oberoende av attributens ordning.
  const box = name => { const tag = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0]; assert.ok(tag, name); return { checked: tag.includes('checked=""'), disabled: tag.includes('disabled=""') }; };
  for (const key of ['dealer', 'tableAsset', 'background', 'language', 'limit', 'pause']) box('allow-' + key);
  // Bordsgrafiken är låst i miljön: rutan är inaktiv och säger varför.
  assert.deepEqual(box('allow-tableAsset'), { checked: false, disabled: true });
  assert.match(html, /Låst i miljön/);
  assert.deepEqual(box('allow-background'), { checked: false, disabled: false });
  assert.deepEqual(box('allow-dealer'), { checked: true, disabled: false });
  assert.equal(box('limitPresets-casual').checked, true);
  assert.equal(box('limitPresets-high').checked, false);
  assert.equal(box('languages-sv').checked, true);
  // Fältet publicerar inte själv: tilldelningens form har en enda knapp (registered-studio.tsx).
  assert.doesNotMatch(html, /<button/);
  const changed = renderToStaticMarkup(React.createElement(AssignmentField, { revision: 4, view, draft: toggleAllow(assignmentDraft(view), 'pause', true), onDraft() {}, disabled: false }));
  assert.match(changed, /ändrat, inte publicerat/);
  assert.match(changed, /<button[^>]*>Ångra<\/button>/);
  const none = renderToStaticMarkup(React.createElement(AssignmentField, { revision: null, view: null, draft: assignmentDraft(null), onDraft() {}, disabled: false }));
  assert.match(none, /ingen publicerad miljö/);
});

test('the draft narrows, stays inside the scene template and keeps a fixed list order', () => {
  let draft = assignmentDraft(view);
  assert.equal(assignmentDirty(view, draft), false);
  assert.equal(allowLocked(view, 'tableAsset'), true);
  assert.equal(allowLocked(view, 'background'), false);
  assert.equal(allowLocked(view, 'pause'), false);
  draft = toggleAllow(draft, 'pause', true);
  draft = toggleListItem(draft, 'limitPresets', 'high', true, view.options.limitPresets);
  draft = toggleListItem(draft, 'limitPresets', 'prive', true, view.options.limitPresets);
  assert.deepEqual(draft.limitPresets, ['casual', 'prive', 'high']);
  assert.equal(assignmentDirty(view, draft), true);
  assert.equal(assignmentProblem(view, draft), '');
  assert.match(assignmentProblem(view, toggleAllow(draft, 'tableAsset', true)), /miljön/);
  assert.match(assignmentProblem(view, { ...draft, limitPresets: [] }), /insatsprofil/);
  assert.match(assignmentProblem(null, draft), /ingen publicerad miljö/);
});

test('saving posts the whole assignment to the package path and checks the receipt', async () => {
  const calls = [];
  const draft = toggleAllow(assignmentDraft(view), 'pause', true);
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return Response.json({ ok: true, operatorId: 'north', packageRevision: 5, assignment: { ...view, allow: draft.allow } });
  };
  const saved = await publishAssignment({ endpoint: '/studio/api/admin/operator-package', operatorId: 'north', revision: 4, draft, fetchImpl });
  assert.equal(saved.ok, true);
  assert.equal(saved.revision, 5);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/studio/api/admin/operator-package');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.deepEqual(calls[0].body, { action: 'publish-assignment', operatorId: 'north', expectedPackageRevision: 4,
    assignment: { allow: draft.allow, limitPresets: ['casual'], languages: ['sv', 'en'] } });
  // Fel revision i kvittot, en konflikt och ett nätfel bekräftas aldrig som sparade.
  const wrong = await publishAssignment({ endpoint: '/x', operatorId: 'north', revision: 4, draft,
    fetchImpl: async () => Response.json({ ok: true, operatorId: 'north', packageRevision: 9, assignment: view }) });
  assert.deepEqual([wrong.ok, wrong.needsRefresh], [false, true]);
  const conflict = await publishAssignment({ endpoint: '/x', operatorId: 'north', revision: 4, draft,
    fetchImpl: async () => Response.json({ error: 'Conflict' }, { status: 409 }) });
  assert.deepEqual([conflict.ok, conflict.needsRefresh], [false, true]);
  assert.match(conflict.error, /Inget publicerades/);
  const offline = await publishAssignment({ endpoint: '/x', operatorId: 'north', revision: 4, draft, fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(offline.ok, false);
});

// Bolag › Tilldelning: en knapp. Urvalet går först och tilldelningen sedan på revisionen ur första kvittot (CAS);
// bara det som är ändrat skickas, och ett stopp (t.ex. 409) avbryter utan nytt försök.
test('one Publicera sends the selection, then the assignment on the first receipt\'s revision, and stops at a conflict', async () => {
  const draft = toggleAllow(assignmentDraft(view), 'pause', true);
  const run = async (replies, { lanes = ['one', 'two'], withDraft = true } = {}) => {
    const calls = [];
    const fetchImpl = async (_url, init) => { calls.push(JSON.parse(init.body)); return replies.shift() ?? Response.json({ error: 'unexpected' }, { status: 500 }); };
    const result = await publishCompanyAssignment({ endpoint: '/x', operatorId: 'north', revision: 4, lanes, draft: withDraft ? draft : null, fetchImpl });
    return { calls, result };
  };
  const lanesReceipt = revision => Response.json({ ok: true, operatorId: 'north', packageRevision: revision, lanes: ['one', 'two'] });
  const assignmentReceipt = revision => Response.json({ ok: true, operatorId: 'north', packageRevision: revision, assignment: view });
  const both = await run([lanesReceipt(5), assignmentReceipt(6)]);
  assert.deepEqual(both.calls.map(body => [body.action ?? 'lanes', body.expectedPackageRevision]), [['lanes', 4], ['publish-assignment', 5]]);
  assert.deepEqual(both.calls[0], { operatorId: 'north', lanes: ['one', 'two'], expectedPackageRevision: 4 });
  assert.deepEqual([both.result.ok, both.result.revision, both.result.done], [true, 6, ['lanes', 'assignment']]);
  assert.match(both.result.message, /\b6\b/);
  const onlyLanes = await run([lanesReceipt(5)], { withDraft: false });
  assert.deepEqual([onlyLanes.calls.length, onlyLanes.result.revision, onlyLanes.result.done], [1, 5, ['lanes']]);
  const onlyAssignment = await run([assignmentReceipt(5)], { lanes: null });
  assert.deepEqual(onlyAssignment.calls.map(body => [body.action, body.expectedPackageRevision]), [['publish-assignment', 4]]);
  assert.deepEqual([onlyAssignment.result.ok, onlyAssignment.result.done], [true, ['assignment']]);
  // 409 på första anropet: inget andra anrop och inget nytt försök.
  const first = await run([Response.json({ error: 'Conflict' }, { status: 409 })]);
  assert.equal(first.calls.length, 1);
  assert.deepEqual([first.result.ok, first.result.needsRefresh, first.result.revision, first.result.done], [false, true, 4, []]);
  // 409 på andra anropet: urvalet är publicerat, tilldelningen stoppas med ett meddelande som säger båda.
  const second = await run([lanesReceipt(5), Response.json({ error: 'Conflict' }, { status: 409 })]);
  assert.equal(second.calls.length, 2);
  assert.deepEqual([second.result.ok, second.result.needsRefresh, second.result.revision, second.result.done], [false, true, 5, ['lanes']]);
  assert.ok(second.result.error.includes(assignmentPublishError(409)) && /version 5/.test(second.result.error));
  // Ett kvitto för fel bolag på första anropet stoppar före tilldelningen.
  const foreign = await run([Response.json({ ok: true, operatorId: 'south', packageRevision: 5, lanes: ['one', 'two'] })]);
  assert.deepEqual([foreign.calls.length, foreign.result.error], [1, PACKAGE_RECEIPT_MISMATCH]);
});
