import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject } from '../lib/studio-model.mjs';
import { fixtureLaneOperators } from '../lib/operator-package-api.mjs';
import { STANDARD_OPERATOR_ROLES } from '../lib/operator-admin-api.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

function loadTs(fileUrl) {
  const source = readFileSync(fileUrl, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(fileUrl), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  const localRequire = createRequire(fileUrl);
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams,
    window: new Proxy({}, { get: (_target, key) => globalThis.window?.[key] }),
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

const { ControlLanesPage } = loadTs(new URL('../components/control-lanes-page.tsx', import.meta.url));
const { ControlOperatorDirectory, operatorDirectoryFailure } = loadTs(new URL('../components/control-operator-directory.tsx', import.meta.url));
const standardRoles = STANDARD_OPERATOR_ROLES.map(role => ({ id: role.id, label: role.label, permissions: [...role.permissions] }));
const roles = STANDARD_OPERATOR_ROLES.map(role => ({ id: role.id, label: role.label, permissions: [...role.permissions], delegable: role.delegable }));
const directory = {
  standardRoles,
  operators: [
    {
      id: 'nordic-bet', slug: 'nordic-bet', name: 'Nordic Bet', status: 'active', roles, missingRoles: [],
      members: [
        { userId: '42', username: 'north-admin', roleId: 'partner-admin', status: 'active', revision: 2 },
        { userId: '43', username: null, roleId: 'partner-viewer', status: 'suspended', revision: 5 },
      ],
    },
    { id: 'amber-house', slug: 'amber-house', name: 'Amber House', status: 'active', roles: roles.slice(0, 1), missingRoles: ['partner-editor', 'partner-viewer'], members: [] },
  ],
};
function page(extra) {
  return renderToStaticMarkup(React.createElement(ControlLanesPage, {
    initialProject: createSeedProject(),
    initialVideos: { videos: [] },
    initialStatus: { configured: true },
    operators: fixtureLaneOperators(),
    storeAvailable: true,
    ...extra,
  }));
}
const buttons = html => [...html.matchAll(/<button class="([^"]+)"[^>]*>([^<]+)<\/button>/g)].map(match => [match[2], match[1]]);

test('the Bolag card lists companies, members and roles with secondary buttons only', () => {
  const html = page({ directory });
  assert.equal(html.match(/sg-btn-primary/g)?.length, 1);
  assert.match(html, /<h2 id="operator-directory">Bolag<\/h2>/);
  assert.match(html, /E-post/);
  assert.match(html, /Ett befintligt partnerkonto kopplas utan mejl/);
  assert.match(html, /Skapa saknade standardroller/);
  for (const label of ['Nordic Bet', 'nordic-bet', 'north-admin', 'konto 43', 'revision 2', 'revision 5', 'aktiv', 'avstängd', 'Amber House', 'Inga medlemmar ännu.']) {
    assert.match(html, new RegExp(label), label);
  }
  assert.match(html, /Standardroller saknas: partner-editor, partner-viewer\./);
  const shown = buttons(html).filter(([label]) => ['Skapa bolag', 'Lägg till medlem', 'Spara roll', 'Stäng av', 'Återaktivera', 'Skapa saknade standardroller'].includes(label));
  assert.deepEqual(shown.map(([label]) => label), ['Skapa bolag', 'Spara roll', 'Stäng av', 'Spara roll', 'Återaktivera', 'Lägg till medlem', 'Skapa saknade standardroller', 'Lägg till medlem']);
  for (const [label, className] of shown) assert.match(className, /^sg-btn sg-btn-(secondary|ghost)$/, label);
  // The first member of an empty company defaults to the administrator role.
  assert.match(html, /aria-label="Lägg till medlem i Amber House"[\s\S]*?<option value="partner-admin" selected="">/);
  assert.match(html, /aria-label="Lägg till medlem i Nordic Bet"[\s\S]*?<option value="partner-viewer" selected="">/);
  assert.equal(html.includes('@'), false);
});

test('without a store the card says so, and without the prop the page renders as before', () => {
  const offline = page({ directory: null, storeAvailable: false });
  assert.match(offline, /Bolag, roller och medlemskap kräver en skrivbar Neon-pool/);
  assert.equal(offline.includes('Skapa bolag'), false);
  assert.equal(offline.match(/sg-btn-primary/g)?.length, 1);
  assert.equal(page({}).includes('operator-directory'), false);
  const alone = renderToStaticMarkup(React.createElement(ControlOperatorDirectory, { directory: { standardRoles, operators: [] } }));
  assert.match(alone, /Inga bolag ännu\./);
});

test('failures name the cause the admin API status allows, without guessing between 409 causes', () => {
  assert.match(operatorDirectoryFailure('create', 409), /redan ett bolag/);
  assert.match(operatorDirectoryFailure('create', 422), /reserverade ord/);
  assert.match(operatorDirectoryFailure('member', 409), /redan medlem, någon annan ändrade medlemskapet, eller .* sista administratören/);
  assert.match(operatorDirectoryFailure('member', 422), /partnerkonto/);
  assert.match(operatorDirectoryFailure('member', 429), /För många inbjudningar/);
  const surface = readFileSync(new URL('../app/control/surface-page.tsx', import.meta.url), 'utf8');
  assert.match(surface, /listLaneOperators/);
  assert.match(surface, /nativeStudioAdminEnabled/);
  assert.match(operatorDirectoryFailure('role', 409), /sista administratören/);
  assert.match(operatorDirectoryFailure('member', 403), /Åtkomst nekad/);
  assert.match(operatorDirectoryFailure('create', 503), /Neon-pool/);
  const pageSource = readFileSync(new URL('../app/control/lanes/page.tsx', import.meta.url), 'utf8');
  assert.match(pageSource, /directory=\{directory\}/);
  assert.match(pageSource, /listOperatorDirectory/);
});
