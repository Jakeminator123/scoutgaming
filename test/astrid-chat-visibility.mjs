import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../services/game/public/app.mjs', import.meta.url), 'utf8');
const visibility = app.slice(app.indexOf('function setChatOpen(open)'), app.indexOf('\n}', app.indexOf('function setChatOpen(open)')) + 2);

function harness(studioPreview = null) {
  let open = false;
  const chatToggle = { dataset: { unread: '1' }, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } };
  const context = vm.createContext({ studioPreview, chatToggle,
    $: () => ({ classList: { contains:()=>open, toggle: (_name, value) => { open = value; } } }) });
  vm.runInContext(visibility, context);
  const start=app.indexOf('function noteChatMessage(role)');
  vm.runInContext(app.slice(start,app.indexOf('\n}',start)+2),context);
  return { set: value => vm.runInContext(`setChatOpen(${value})`, context), isOpen: () => open, message:role=>vm.runInContext(`noteChatMessage(${JSON.stringify(role)})`,context), chatToggle };
}

test('conversation opens and closes on request with accessible state and cleared unread status', () => {
  const h = harness();
  for (const requested of [true, false, false, true, false]) {
    h.set(requested);
    assert.equal(h.isOpen(), requested);
    assert.equal(h.chatToggle.attributes['aria-expanded'], String(requested));
    assert.equal(h.chatToggle.dataset.unread, undefined);
  }
});

test('Studio preview cannot expose chat through ordinary open or close controls', () => {
  const h = harness({ sessionId: 'preview-fixture' });
  for (const requested of [true, false, true]) {
    h.set(requested);
    assert.equal(h.isOpen(), false);
    assert.deepEqual(h.chatToggle.attributes, {});
    assert.equal(h.chatToggle.dataset.unread, '1');
  }
});

test('every public dealer presentation mounts its own voice control; Studio stays isolated',()=>{
  const start=app.indexOf('const astridCamera ='),end=app.indexOf(' : null;',start)+8;
  const setup=app.slice(start,end);
  for(const dealer of ['astrid','vera','amira','mei','paow','dragge'])for(const local of [false,true])for(const preview of [null,{sessionId:'preview'}]){
    let mounted;
    const context=vm.createContext({studioPreview:preview,localPresentationEnabled:local,DEALER:{key:dealer,name:dealer.toUpperCase()},$:(selector)=>({selector}),createAstridCameraControl:options=>{mounted=options;return {};}});
    vm.runInContext(setup,context);
    if(preview){assert.equal(mounted,undefined);continue;}
    assert.equal(mounted.dealerName,dealer.toUpperCase());assert.ok(mounted.wakeNames.includes(dealer));
    context.chatBusy=false;context.speaking=false;context.busy=true;assert.equal(mounted.canStart(),true);
    context.speaking=true;assert.equal(mounted.canStart(),false);
  }
});

test('incoming replies preserve open conversations and mark closed conversations unread',()=>{
 const h=harness();h.set(true);h.message('dealer');assert.equal(h.isOpen(),true);assert.equal(h.chatToggle.dataset.unread,undefined);
 h.set(false);h.message('dealer');assert.equal(h.isOpen(),false);assert.equal(h.chatToggle.dataset.unread,'true');
 h.message('user');assert.equal(h.isOpen(),true);assert.equal(h.chatToggle.dataset.unread,undefined);
 const preview=harness({sessionId:'preview'});preview.message('user');assert.equal(preview.isOpen(),false);
});
