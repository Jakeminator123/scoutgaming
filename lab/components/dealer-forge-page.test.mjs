import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fixture, PNG } from '../test/helpers/dealer-forge-fixture.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

function loadTs(fileUrl) {
  const source = readFileSync(fileUrl, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(fileUrl), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  const localRequire = createRequire(fileUrl);
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams, Boolean, Number, String, Math, Date, JSON, Object, Array, Map, Set, Promise, Error, encodeURIComponent,
    window: undefined,
    require: name => {
      if (name.endsWith('.module.css') || name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('./') || name.startsWith('../')) {
        for (const suffix of ['', '.tsx', '.ts', '.mjs', '.js']) {
          const candidate = new URL(name + suffix, fileUrl);
          const path = fileURLToPath(candidate);
          if (!existsSync(path)) continue;
          if (path.endsWith('.mjs') || path.endsWith('.js') || path.endsWith('.json')) return localRequire(path);
          return loadTs(pathToFileURL(path));
        }
      }
      return localRequire(name);
    },
  }, { filename: fileURLToPath(fileUrl) });
  return module.exports;
}

const { DealerForgePage } = loadTs(new URL('./dealer-forge-page.tsx', import.meta.url));
const actor = { actor: 'tester' };

async function realisticState() {
  const { service, tasks } = fixture();
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  await service.uploadAnchor('paow', { pose: 'redo', contentType: 'image/png', dataBase64: Buffer.concat([PNG, Buffer.from('redo')]).toString('base64') }, actor);
  const deal = await service.createJob('paow', { slotId: 'deal.player.centre/box3', quality: '720' }, actor);
  tasks.set(deal.taskId, { id: deal.taskId, status: 'SUCCEEDED', output: ['https://out/clip.mp4'], credits: 20 });
  await service.pollJob('paow', deal.jobId, actor);
  const running = await service.createJob('paow', { slotId: 'deal.player.left/box0', quality: '720' }, actor);
  await service.pollJob('paow', running.jobId, actor);
  const index = { ...(await service.status()), dealers: await service.listDealers() };
  return { index, state: await service.state('paow') };
}

test('Dealer Forge page renders the full matrix server-side: groups, every slot, status pills, posters, running jobs and the log', async () => {
  const { index, state } = await realisticState();
  const html = renderToStaticMarkup(React.createElement(DealerForgePage, { initialDealerId: 'paow', initialIndex: index, initialState: state }));
  assert.match(html, /Dealer Forge/);
  for (const group of ['Idle', 'Övergångar', 'Givning', 'Repliker', 'Reaktioner', 'Bord &amp; bakgrund']) assert.match(html, new RegExp(group), group);
  for (const slot of state.slots.filter(row => row.group !== 'pose')) assert.ok(html.includes(slot.id), `slot row ${slot.id}`);
  assert.equal((html.match(/class="pill ready"/g) ?? []).length, state.slots.filter(row => row.status.level === 'ready').length + 0);
  assert.match(html, /Ge kort · plats 4/); assert.match(html, /1 klipp/);
  assert.match(html, /Till skon · VILA → REDO/); assert.match(html, /Facket saknas i projektet/);
  assert.match(html, /Genereras · ~20 kr|Genereras/); // running job in box0
  assert.match(html, /<video src="\/api\/videos\//); assert.match(html, /poster="\/api\/forge\/paow\/anchor\/redo\?v=/);
  assert.match(html, /<img src="\/api\/forge\/paow\/anchor\/vila\?v=/);
  assert.match(html, /Jobblogg/); assert.match(html, /wan3/);
  assert.match(html, /”Welcome to Privé Blackjack/); // speech slot shows its line
  assert.doesNotMatch(html, /RUNWAY_API_KEY saknas/); assert.doesNotMatch(html, /migration 008/);
  assert.match(html, /Öppna i Dealers &amp; klipp/);
});

test('without native data the page still renders the shell, the dealer form and the warnings', async () => {
  const html = renderToStaticMarkup(React.createElement(DealerForgePage, { initialDealerId: 'paow', initialIndex: { dealers: [{ id: 'paow', label: 'Paow' }], migrationReady: false, runwayConfigured: false }, initialState: null }));
  assert.match(html, /Registrera dealer/); assert.match(html, /migration 008/); assert.match(html, /RUNWAY_API_KEY saknas/); assert.match(html, /Läser dealern/);
});
