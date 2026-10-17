import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
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
  assert.equal(backgroundButtons[0].textContent, 'Bakgrund saknas i paketet');
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

test('both dealer pickers offer only the active lane dealers even without an operator', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('../web/public/app.mjs', import.meta.url), 'utf8');
  const row = source.slice(source.indexOf('const allowedDealerKeys ='), source.indexOf('buildChips();', source.indexOf('const allowedDealerKeys =')));
  const rehearsal = source.slice(source.indexOf('  for (const d of Object.values(DEALERS))'), source.indexOf('  dealerSelect.value = DEALER.key;'));
  assert.ok(row && rehearsal);
  const DEALERS = Object.fromEntries(['vera','astrid','amira','mei'].map(key => [key,{key,name:key,base:key}]));
  for (const operator of [undefined,'north']) {
    for (const offered of [['astrid'], ['amira','mei']]) {
      const actual = [], rehearsed = [];
      const document = {createElement(){return {dataset:{},setAttribute(){},append(){}};}};
      vm.runInNewContext(row + rehearsal, {previewSession:null,entrySelection:{operator,choices:{dealers:offered}},DEALER:DEALERS[offered[0]],DEALERS,document,
        $:() => ({appendChild(button){actual.push(button.dataset.dealer);}}),dealerSelect:{add(option){rehearsed.push(option.value);}},
        Option:class {constructor(name,value){this.value=value;}}});
      assert.deepEqual(actual, offered); assert.deepEqual(rehearsed, offered);
    }
  }
});

test('the lobby text names the last dealer and table colour', () => {
  assert.equal(lobbyChoiceText(parseStoredChoices(JSON.stringify({ dealer: 'astrid', tableColor: '#112233' }))), 'Dealer Astrid · bord #112233');
  assert.equal(lobbyChoiceText({ dealer: 'mei' }), 'Dealer Mei');
  assert.equal(lobbyChoiceText({ dealer: 'paow' }), 'Dealer Paow');
  assert.equal(lobbyChoiceText({ dealer: 'ghost', tableColor: 'green', background: 'stad' }), '');
});

test('legacy full-frame dealer scenes retain their authorized table and background controls',()=>{
  const composition={dealer:{enabled:true,compatibility:'full-frame'},table:{allowed:['table-one'],default:'table-one'},
    assets:[{id:'table-one',label:'Independent table'},{id:'stad',label:'Independent background'}]};
  const selected=resolvePlayerSelection({choices:imageChoices,currentDealer:'astrid',composition,stored:{tableAsset:'table-one',background:'stad'}});
  assert.equal(selected.tableValue,'table-one');assert.equal(selected.backgroundValue,'stad');
  assert.deepEqual(selected.nextStored,{tableAsset:'table-one',background:'stad'});
  const page=dom(),panel=mountPlayerChoices(page,{choices:imageChoices,composition,currentDealer:'astrid',tableValue:selected.tableValue,backgroundValue:selected.backgroundValue});
  const rows=panel.children.filter(row=>row.className==='choice-row');
  for(const label of ['Bord','Bakgrund']){
    const controls=rows.find(row=>row.children[0].textContent===label).children.filter(row=>row.tag==='button');
    assert.ok(controls.length>=1);assert.ok(controls.every(button=>!button.disabled));
  }
});
test('dealer footer labels its real action and returns to the same operator lobby',async()=>{
  const {readFile}=await import('node:fs/promises');
  const html=await readFile(new URL('../web/public/index.html',import.meta.url),'utf8');
  assert.match(html,/aria-label="Välj dealer"/);assert.match(html,/>Välj dealer<\/span>/);
  assert.match(html,/class="casino-return" href="\/play">Till lobbyn/);
  const app=await readFile(new URL('../web/public/app.mjs',import.meta.url),'utf8');
  const code=app.slice(app.indexOf('const lobbyReturn ='),app.indexOf('for (const {id,label}'));
  for(const [entrySelection,expected] of [
    [{},'/lobby'],
    [{operator:'sg-test'},'/lobby?operator=sg-test'],
    [{operator:'sg-test',roomId:'room-evening'},'/lobby?operator=sg-test&room=room-evening'],
  ]){
    const link={};vm.runInNewContext(code,{studioPreview:null,entrySelection,document:{querySelector:()=>link},URLSearchParams});
    assert.equal(link.href,expected);
  }
});

test('preview keeps an incomplete registered dealer visible and disabled',()=>{
 const page=dom(),chosen=[];
 const panel=mountPlayerChoices(page,{choices:{...choices,dealers:['astrid','johanna']},currentDealer:'astrid',
  dealerAvailability:[{id:'astrid',playable:true},{id:'johanna',playable:false,reason:'studio_preview_idle_required'}],onDealer:id=>chosen.push(id)});
 const row=panel.children.find(child=>child.className==='choice-row'),buttons=row.children.filter(child=>child.tag==='button');
 assert.equal(buttons.length,2);assert.equal(buttons[1].dataset.dealer,'johanna');assert.equal(buttons[1].disabled,true);
 assert.match(buttons[1].textContent,/grundklipp saknas/);buttons[1].onclick();assert.deepEqual(chosen,[]);
});
test('preview footer returns to its saved composition without an operator link',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../web/public/app.mjs',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('const lobbyReturn ='),source.indexOf('for (const {id,label}'));
 const window={};window.parent=window;
 const link={};vm.runInNewContext(code,{window,studioPreview:{presentationLaneId:'evening'},entrySelection:{lane:'evening',dealer:'astrid',presentation:'local'},document:{querySelector:()=>link},URLSearchParams});
 assert.equal(link.href,'/admin/compositions?composition=evening&dealer=astrid');assert.equal(link.textContent,'Till Sammansättning');
 // Real document validation requires a dealer; a partial caller must not serialize undefined.
 const partialLink={};vm.runInNewContext(code,{window,studioPreview:{presentationLaneId:'evening'},entrySelection:{},document:{querySelector:()=>partialLink},URLSearchParams});
 assert.equal(partialLink.href,'/admin/compositions?composition=evening');
});

test('the existing layer panel accepts a clear preview label and keeps the ordinary label',()=>{
 const ordinary=dom(),preview=dom();
 const base=mountPlayerChoices(ordinary,{choices,currentDealer:'astrid'});
 const configured=mountPlayerChoices(preview,{choices,currentDealer:'astrid',summaryLabel:'Bord och bakgrund'});
 assert.equal(base.children[0].textContent,'Ditt bord');
 assert.equal(configured.children[0].textContent,'Bord och bakgrund');
 assert.equal(configured.id,'player-choices');
});
