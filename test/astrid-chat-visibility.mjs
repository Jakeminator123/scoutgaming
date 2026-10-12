import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../web/public/app.mjs', import.meta.url), 'utf8');
const visibility = app.slice(app.indexOf('function setChatOpen(open)'), app.indexOf('\n}', app.indexOf('function setChatOpen(open)')) + 2);

function harness(dealer, localPresentationEnabled = true, studioPreview = null) {
  let open = false;
  const chatToggle = { dataset: { unread: '1' }, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } };
  const context = vm.createContext({ studioPreview, DEALER: { key: dealer }, localPresentationEnabled, chatToggle,
    $: () => ({ classList: { toggle: (_name, value) => { open = value; } } }) });
  vm.runInContext(visibility, context);
  return { set: value => vm.runInContext(`setChatOpen(${value})`, context), isOpen: () => open, chatToggle };
}

test('Astrid conversation opens and closes on request, including a compact viewport', () => {
  const h = harness('astrid');
  for (const requested of [true, false, false, true, false]) {
    h.set(requested);
    assert.equal(h.isOpen(), requested);
    assert.equal(h.chatToggle.attributes['aria-expanded'], String(requested));
    assert.equal(h.chatToggle.dataset.unread, undefined);
  }
});

test('other dealer presentations retain their existing open/close behavior', () => {
  for (const dealer of ['vera', 'amira', 'mei', 'paow', 'dragge']) {
    const h = harness(dealer);
    h.set(true); assert.equal(h.isOpen(), true);
    h.set(false); assert.equal(h.isOpen(), false);
  }
});

test('chat controls never move into the hidden private camera panel', () => {
  assert.doesNotMatch(app, /debugContainer\.append\([^;]*(?:chat-input|chat-log)/);
  assert.doesNotMatch(app, /onLogToggle:\s*[^\n]*setChatOpen/);
  const init = app.match(/^if \(astridCamera\) setChatOpen\(false\);$/m)?.[0];
  assert.ok(init,'conversation starts folded alongside voice controls');
  const h = harness('astrid');
  vm.runInNewContext(init, { astridCamera: {}, chatToggle: h.chatToggle, setChatOpen: value => h.set(value) });
  assert.equal(h.isOpen(), false);
  assert.notEqual(h.chatToggle.hidden, true);
});

test('Studio preview cannot expose chat through ordinary open or close controls', () => {
  for (const dealer of ['astrid', 'vera', 'amira', 'mei']) {
    const h = harness(dealer, true, { sessionId: 'preview-fixture' });
    for (const requested of [true, false, true]) {
      h.set(requested);
      assert.equal(h.isOpen(), false);
      assert.deepEqual(h.chatToggle.attributes, {});
      assert.equal(h.chatToggle.dataset.unread, '1');
    }
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
