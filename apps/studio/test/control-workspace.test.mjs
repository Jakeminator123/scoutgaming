import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyControlBookmarkHref } from '../lib/control-workspace.mjs';

test('redirected Control fragments open the corresponding Admin tool once', () => {
  for (const [fragment, target] of [
    ['clips', '/admin/clips#deal'], ['voice', '/admin/clips?panel=room#clips'],
    ['speech', '/admin/clips?panel=room#clips'], ['backgrounds', '/admin/scenes'],
    ['transactions', '/admin/ekonomi'], ['integration', '/admin/admin/api'],
    ['game-tables', '/admin/rooms'], ['overview', '/admin'],
  ]) {
    for (const prefix of ['', '/studio']) assert.equal(legacyControlBookmarkHref(prefix + '/admin#' + fragment), target);
    assert.equal(legacyControlBookmarkHref(target), null, 'the destination cannot hand off again');
  }
});

test('bookmark handoff keeps exact dealer, composition, operator and room selectors', () => {
  const href = legacyControlBookmarkHref('/admin?dealer=astrid&dealer=vera&lane=layout-one&operator=north&room=vip&game=blackjack#clips');
  const target = new URL(href, 'https://fixture.invalid');
  assert.equal(target.pathname, "/admin/clips");
  assert.deepEqual(target.searchParams.getAll('dealer'), ['astrid', 'vera'], 'ambiguous identities remain ambiguous');
  assert.equal(target.searchParams.get('composition'), 'layout-one');
  assert.equal(target.searchParams.has('lane'), false);
  for (const [key, value] of [['operator', 'north'], ['room', 'vip'], ['game', 'blackjack']]) assert.equal(target.searchParams.get(key), value);
});

test('bookmark handoff ignores other pages, unknown fragments and malformed URLs', () => {
  for (const href of [null, undefined, {}, '/admin', '/admin#unknown', '/admin#pit', '/admin#%63lips',
    '/admin/clips#clips', '/admin/dealer-studio#clips', '/partner#clips', '/admin/login#clips',
    '/control#clips', '//outside.invalid/admin#clips', 'https://outside.invalid/admin#clips', '/admin\\#clips', '/admin\n#clips']) {
    assert.equal(legacyControlBookmarkHref(href), null, String(href));
  }
});

test('the real Admin entry hands off known bookmarks before creating a React root', () => {
  const require = createRequire(import.meta.url), file = '../client/admin/entry.tsx';
  const { transformSync } = require('next/dist/build/swc');
  const { code } = transformSync(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    filename: file, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
  });
  for (const [href, expected] of [['/admin?dealer=astrid&room=vip#clips', '/admin/clips?dealer=astrid&room=vip#deal'],
    ['/admin/clips?dealer=astrid#clips', null], ['/admin#unknown', null]]) {
    const calls = [], location = new URL(href, 'https://fixture.invalid'), root = {};
    location.replace = value => calls.push(['replace', value]);
    const module = { exports: {} };
    vm.runInNewContext(code, { module, exports: module.exports, location,
      document: { getElementById: id => { assert.equal(id, 'root'); return root; } },
      require: name => name === 'react-dom/client' ? { createRoot: node => {
        assert.equal(node, root); calls.push(['createRoot']); return { render: () => calls.push(['render']) };
      } } : name === '../../lib/control-workspace.mjs' ? { legacyControlBookmarkHref }
        : name === './lib/admin-navigation' ? { adminNavigationGroups: [], adminSystemGroups: [], adminPageLabels: {} }
        : name === 'react/jsx-runtime' ? require(name) : {},
    });
    assert.deepEqual(calls, expected ? [['replace', expected]] : [['createRoot'], ['render']]);
  }
});
