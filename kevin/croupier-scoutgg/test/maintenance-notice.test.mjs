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
    const added = [];
    const el = { style: {}, setAttribute() {} };
    const g = { MAINTENANCE_NOTICE: text };
    new Function('globalThis', 'document', src)(g, { createElement: () => el, body: { appendChild: e => added.push(e) } });
    return added;
  };
  assert.equal(run('').length, 0);
  const [el] = run('We are currently doing maintenance work');
  assert.equal(el.textContent, 'We are currently doing maintenance work');
});
