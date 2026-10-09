import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTableColor, choicesStorageKey, lobbyChoiceText, mountPlayerChoices, parseStoredChoices,
  readChoices, resolvePlayerSelection, writeChoices,
} from '../web/public/player-choices.mjs';

const colors = ['#112233', '#aabbcc'];
const choices = {
  dealers: ['astrid', 'mei'],
  dealerDefault: 'astrid',
  tableColors: colors,
  tableDefault: '#aabbcc',
  background: { enabled: true, mode: 'baked', allowed: [], default: null },
};
const imageChoices = {
  ...choices,
  background: { enabled: true, mode: 'image', allowed: ['stad'], default: 'stad' },
};

function memory(initial = {}) {
  const data = { ...initial };
  return {
    getItem: key => (Object.hasOwn(data, key) ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: key => { delete data[key]; },
    data,
  };
}

function element() {
  return {
    tag: 'element', children: [], textContent: '', className: '', disabled: false, dataset: {},
    style: { props: {}, setProperty(name, value) { this.props[name] = value; } },
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    append(...nodes) { this.children.push(...nodes); },
    querySelectorAll(selector) {
      return this.children.filter(child => selector === '.swatch' ? child.className === 'swatch' : child.tag === 'button');
    },
  };
}

function dom() {
  const anchor = { before(node) { anchor.panel = node; } };
  return {
    anchor,
    documentElement: element(),
    querySelector(selector) { return selector === '#table-pick' ? anchor : null; },
    createElement(tag) { const node = element(); node.tag = tag; return node; },
  };
}

test('a choice outside gameChoices is dropped and the priority is URL, player, company, lane', () => {
  const key = choicesStorageKey('sg-test');
  assert.equal(key, 'croupier.choices.sg-test');
  assert.equal(choicesStorageKey('play'), 'croupier.choices.default');
  const storage = memory({ [key]: JSON.stringify({ dealer: 'vera', tableColor: '#ffffff', background: 'stad' }) });
  const dropped = resolvePlayerSelection({
    choices, search: '', stored: readChoices(storage, 'sg-test'), branding: { color: '#112233' }, currentDealer: 'astrid',
  });
  assert.equal(dropped.navigateDealer, null);
  assert.equal(dropped.tableColor, '#112233');
  assert.deepEqual(dropped.nextStored, {});
  assert.equal(dropped.backgroundDisabled, true);
  assert.equal(dropped.applyBackground, false);
  writeChoices(storage, 'sg-test', dropped.nextStored);
  assert.equal(storage.getItem(key), null);

  const url = resolvePlayerSelection({
    choices, search: '?dealer=mei&table=%23aabbcc', stored: { dealer: 'astrid', tableColor: '#112233' },
    branding: { color: '#112233' }, currentDealer: 'astrid',
  });
  assert.equal(url.navigateDealer, 'mei');
  assert.equal(url.tableColor, '#aabbcc');
  assert.deepEqual(url.nextStored, { dealer: 'mei', tableColor: '#aabbcc' });

  const player = resolvePlayerSelection({
    choices, search: '?table=classic', stored: { dealer: 'mei', tableColor: '#112233' },
    branding: { color: '#aabbcc' }, currentDealer: 'mei',
  });
  assert.equal(player.navigateDealer, null);
  assert.equal(player.tableColor, '#112233');
  assert.equal(player.dealer, 'mei');

  const company = resolvePlayerSelection({
    choices, search: '', stored: {}, branding: { color: '#112233' }, currentDealer: 'astrid',
  });
  assert.equal(company.tableColor, '#112233');

  const lane = resolvePlayerSelection({
    choices, search: '', stored: {}, branding: { color: '#00ff00' }, currentDealer: 'astrid',
  });
  assert.equal(lane.tableColor, '#aabbcc');

  const openList = resolvePlayerSelection({
    choices: { ...choices, tableColors: [], tableDefault: null },
    search: '', stored: { tableColor: '#ffffff' }, branding: { color: '#112233' }, currentDealer: 'astrid',
  });
  assert.equal(openList.tableColor, '#112233');
  assert.equal(openList.nextStored.tableColor, undefined);

  const kept = resolvePlayerSelection({
    choices: imageChoices, search: '', stored: { background: 'stad', dealer: 'nope' }, currentDealer: 'astrid',
  });
  assert.equal(kept.backgroundDisabled, false);
  assert.equal(kept.backgroundValue, 'stad');
  assert.equal(kept.applyBackground, false);
  assert.deepEqual(kept.nextStored, { background: 'stad' });
  assert.equal(parseStoredChoices('{').dealer, undefined);
});

test('baked background is disabled and an empty colour list hides the swatches', () => {
  const page = dom();
  const panel = mountPlayerChoices(page, {
    choices, currentDealer: 'astrid', tableColor: '#112233', onDealer() {}, onTableColor() {}, onBackground() {},
  });
  assert.equal(panel.children[0].textContent, 'Ditt bord');
  const rows = panel.children.filter(child => child.className === 'choice-row');
  assert.deepEqual(rows.map(row => row.children[0].textContent), ['Dealer', 'Bordsfärg', 'Bakgrund']);
  const backgroundButtons = rows[2].children.filter(child => child.tag === 'button');
  assert.equal(backgroundButtons.length, 1);
  assert.equal(backgroundButtons[0].disabled, true);
  assert.equal(backgroundButtons[0].textContent, 'Kommer med nya dealerpaket');
  assert.equal(rows[0].children.filter(child => child.tag === 'button').length, 2);

  const hidden = dom();
  mountPlayerChoices(hidden, { choices: { ...choices, tableColors: [] }, currentDealer: 'astrid' });
  const labels = hidden.anchor.panel.children.filter(child => child.className === 'choice-row').map(row => row.children[0].textContent);
  assert.deepEqual(labels, ['Dealer', 'Bakgrund']);
});

test('table colour paints the felt mark, wallet and chip row and leaves the film alone', () => {
  const nodes = {};
  const make = () => ({ style: { props: {}, setProperty(name, value) { this.props[name] = value; } }, dataset: {} });
  for (const selector of ['#felt-brand', '#wallet', '#chip-row', '#table-pick', 'video.local-presentation-film']) nodes[selector] = make();
  const document = {
    documentElement: make(),
    querySelector(selector) { return nodes[selector] ?? null; },
  };
  assert.equal(applyTableColor(document, 'green'), false);
  assert.equal(applyTableColor(document, '#112233'), true);
  assert.equal(document.documentElement.dataset.tableColor, '#112233');
  assert.equal(document.documentElement.style.props['--table-felt'], '#112233');
  assert.equal(nodes['#felt-brand'].style.props.color, '#112233');
  assert.equal(nodes['#wallet'].style.props['border-left-color'], '#112233');
  assert.equal(nodes['#chip-row'].style.props['box-shadow'], 'inset 0 0 0 2px #112233');
  assert.equal(nodes['video.local-presentation-film'].style.props.color, undefined);
});

test('the dealer row follows the lane only when an operator package is active', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('../web/public/app.mjs', import.meta.url), 'utf8');
  // Same source-level guard style as test/dealer-version-switcher.mjs: the row must gate on
  // entrySelection.operator AND choices.dealers, keep the current dealer, and skip the rest.
  assert.match(source, /const allowedDealerKeys = entrySelection\.operator && Array\.isArray\(entrySelection\.choices\?\.dealers\)/);
  assert.match(source, /new Set\(\[\.\.\.entrySelection\.choices\.dealers, DEALER\.key\]\) : null;/);
  assert.match(source, /if \(allowedDealerKeys && !allowedDealerKeys\.has\(dealer\.key\)\) continue;/);
});

test('the lobby text names the last dealer and table colour', () => {
  assert.equal(lobbyChoiceText(parseStoredChoices(JSON.stringify({ dealer: 'astrid', tableColor: '#112233' }))), 'Dealer Astrid · bord #112233');
  assert.equal(lobbyChoiceText({ dealer: 'mei' }), 'Dealer Mei');
  assert.equal(lobbyChoiceText({ dealer: 'paow' }), 'Dealer Paow');
  assert.equal(lobbyChoiceText({ dealer: 'ghost', tableColor: 'green', background: 'stad' }), '');
});
