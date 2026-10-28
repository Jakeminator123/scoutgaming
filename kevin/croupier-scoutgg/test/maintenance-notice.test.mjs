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

// A page as maintenance-notice.js sees it: the banner lands in `added`, class and style changes in `cls`,
// the polls' URLs in `urls`; answer(json) resolves the latest poll.
const run = (text, { dealer = '' } = {}) => {
  const added = [], removed = [], cls = [], urls = []; let resolve = null, every = 0;
  const make = () => ({ style: {}, setAttribute() {}, getBoundingClientRect: () => ({ height: 36 }), remove() { removed.push(this); } });
  const root = { appendChild: e => added.push(e), dataset: { dealer }, classList: { add: (...c) => cls.push(...c), remove: (...c) => cls.push(...c.map(x => '-' + x)) }, style: { setProperty: (k, v) => cls.push(k + '=' + v), removeProperty() {} } };
  const doc = { documentElement: root, createElement: make, head: { appendChild() {} }, querySelector: () => ({}), body: { classList: { add: c => cls.push(c), remove() {} } }, readyState: 'complete', hidden: false, addEventListener() {} };
  const win = { innerHeight: 844, addEventListener() {}, removeEventListener() {} };
  const fetchImpl = url => { urls.push(url); return new Promise(r => { resolve = r; }); };
  let tick = () => {}; const setInterval = (fn, ms) => { tick = fn; every = ms; return 1; };
  new Function('globalThis', 'document', 'window', 'fetch', 'setInterval', 'location', src)({ MAINTENANCE_NOTICE: text }, doc, win, fetchImpl, setInterval, { search: '' });
  const answer = async json => { if (!resolve) tick(); const r = resolve; resolve = null; r({ ok: true, json: async () => json }); await new Promise(x => setTimeout(x, 0)); await new Promise(x => setTimeout(x, 0)); };
  return { added, removed, cls, urls, answer, get every() { return every; } };
};
const src = readFileSync(new URL('../public/maintenance-notice.js', import.meta.url), 'utf8');

test('the banner shows the text and stays away without one', () => {
  assert.equal(run('').added.length, 0);
  const shown = run('We are currently doing maintenance work');
  assert.equal(shown.added[0].textContent, 'We are currently doing maintenance work');
  // the page moves down by the banner's height, the table shrinks to fit
  assert.ok(shown.cls.includes('maint') && shown.cls.includes('maint-fit') && shown.cls.includes('--maint-h=36px'));
});

test('Kevin 28 Oct: the banner follows RunPod: the page asks /api/notice for its dealer every 30 s, shows the text it answers and takes the banner down on an empty one', async () => {
  const page = run('', { dealer: 'paow' });
  assert.equal(page.added.length, 0);
  assert.equal(page.urls[0], '/api/notice?dealer=paow', 'asked at load, for the table\'s dealer');
  assert.equal(page.every, 30000);
  await page.answer({ text: 'The dealer may not speak for a while.' });
  assert.equal(page.added[0].textContent, 'The dealer may not speak for a while.');
  await page.answer({ text: 'The dealer may not speak for a while.' });
  assert.equal(page.added.length, 1, 'the same text is not re-added');
  await page.answer({ text: '' });
  assert.equal(page.removed.length, 2, 'the banner and its style are removed when RunPod is green again');
  assert.ok(page.cls.includes('-maint'), 'the page moves back up');
  await page.answer({ text: 'Back.' });
  assert.equal(page.added.length, 2, 'and comes back on the next trouble');
});
