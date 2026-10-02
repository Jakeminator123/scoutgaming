import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BACKOFFICE_GROUPS, BACKOFFICE_SECTIONS, backofficeGroup } from '../lib/backoffice-navigation.mjs';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('./backoffice-panel.tsx', import.meta.url), 'utf8');
const code = require('next/dist/build/swc').transformSync(source, {
  filename: 'backoffice-panel.tsx',
  jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
  module: { type: 'commonjs' },
}).code;

function render(section, origin = 'https://scout.example') {
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: name => name === 'react' ? { ...React, useState: () => [section, () => {}], useEffect: () => {} }
      : name.endsWith('.module.css') ? { __esModule: true, default: {} } : require(name),
  });
  return module.exports.BackofficePanel({ origin });
}

function visit(node, callback) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(child => visit(child, callback)); return; }
  callback(node); visit(node.props?.children, callback);
}

test('all fourteen functions are reachable through six local groups and their real existing routes', () => {
  for (const section of BACKOFFICE_SECTIONS) {
    const tree = render(section.id), links = [], frames = [];
    visit(tree, node => { if (node.type === 'a') links.push(node.props); if (node.type === 'iframe') frames.push(node.props); });
    const group = backofficeGroup(section.id);
    assert.equal(frames.length, 1);
    assert.equal(frames[0].src, `https://scout.example/bo/?workspace=lab#${section.id}`);
    for (const item of BACKOFFICE_GROUPS) assert.ok(links.some(link => link.href === `#${item.sections[0]}`));
    for (const id of group.sections) assert.ok(links.some(link => link.href === `#${id}`));
    assert.equal(links.filter(link => link['aria-current'] === 'location').length, 2);
    const html = renderToStaticMarkup(tree);
    assert.match(html, /Backoffice-områden/);
    assert.match(html, /API och lagring är ännu inte aktiverad/);
    assert.doesNotMatch(html, /BACKOFFICE\/LAB|credentials|password|token=/i);
  }
});

test('missing configured origin gives a visible error and no embedded backend', () => {
  const html = renderToStaticMarkup(render('players', null));
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /<iframe/);
});

test('local menu does not bypass existing authentication or introduce client-side mutations', () => {
  const page = readFileSync(new URL('../app/administration/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /await authorizeUiPage/);
  assert.doesNotMatch(source, /fetch\(|requestJson|password|restart|<input|<form/);
});
