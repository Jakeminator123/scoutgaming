import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the table and the studio load the maintenance flag and the banner', () => {
  for (const page of ['../public/index.html', '../public/studio/index.html']) {
    const html = readFileSync(new URL(page, import.meta.url), 'utf8');
    assert.ok(html.includes('/notice.js') && html.indexOf('/notice.js') < html.indexOf('/maintenance-notice.js'), page);
  }
  assert.match(readFileSync(new URL('../server/server.mjs', import.meta.url), 'utf8'), /p === "\/notice\.js"/);
});

test('the banner shows the text and stays away without one', () => {
  const src = readFileSync(new URL('../public/maintenance-notice.js', import.meta.url), 'utf8');
  const run = text => {
    const added = [], cls = [];
    const make = () => ({ style: {}, setAttribute() {}, getBoundingClientRect: () => ({ height: 36 }) });
    const root = { appendChild: e => added.push(e), classList: { add: c => cls.push(c) }, style: { setProperty: (k, v) => cls.push(k + '=' + v) } };
    const doc = { documentElement: root, createElement: make, head: { appendChild() {} }, querySelector: () => ({}), body: { classList: { add: c => cls.push(c) } } };
    const win = { innerHeight: 844, addEventListener() {} };
    new Function('globalThis', 'document', 'window', src)({ MAINTENANCE_NOTICE: text }, doc, win);
    return Object.assign(added, { cls });
  };
  assert.equal(run('').length, 0);
  const shown = run('We are currently doing maintenance work');
  assert.equal(shown[0].textContent, 'We are currently doing maintenance work');
  // the page moves down by the banner's height, the table shrinks to fit
  assert.ok(shown.cls.includes('maint') && shown.cls.includes('maint-fit') && shown.cls.includes('--maint-h=36px'));
});
