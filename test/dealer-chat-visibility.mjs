import test from 'node:test';
import assert from 'node:assert/strict';
import { createDealerChatVisibility, mountDealerVoiceControl } from '../services/game/public/dealer-chat-controls.mjs';

function harness(studioPreview = null) {
  let open = false, layouts = 0;
  const chatToggle = { dataset: { unread: '1' }, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } };
  const controls = createDealerChatVisibility({ studioPreview, getToggle:()=>chatToggle, scheduleInterfaceLayout:()=>{layouts++;},
    document:{querySelector:() => ({ classList: { contains:()=>open, toggle: (_name, value) => { open = value; } } })} });
  return { set: controls.setChatOpen, isOpen: () => open, message:controls.noteChatMessage, chatToggle, get layouts(){return layouts;} };
}

test('conversation opens and closes on request with accessible state and cleared unread status', () => {
  const h = harness();
  for (const requested of [true, false, false, true, false]) {
    h.set(requested);
    assert.equal(h.isOpen(), requested);
    assert.equal(h.chatToggle.attributes['aria-expanded'], String(requested));
    assert.equal(h.chatToggle.dataset.unread, undefined);
  }
  assert.equal(h.layouts,5,'opening and closing the chat requests fresh control placement');
});

test('Studio preview cannot expose chat through ordinary open or close controls', () => {
  const h = harness({ sessionId: 'preview-fixture' });
  for (const requested of [true, false, true]) {
    h.set(requested);
    assert.equal(h.isOpen(), false);
    assert.deepEqual(h.chatToggle.attributes, {});
    assert.equal(h.chatToggle.dataset.unread, '1');
  }
  assert.equal(h.layouts,0);
});

test('public dealer presentations prepare voice controls and wait for server readiness before changing the shell',()=>{
  for(const dealer of ['vera','amira','mei','paow','dragge'])for(const preview of [null,{sessionId:'preview'}]){
    let mounted; const classes=[],styles=[],chatStates=[];
    const chatState={busy:false,speaking:false},identity=()=>({dealerId:dealer}),send=()=>{},container={};
    const control=mountDealerVoiceControl({document:{body:{classList:{add:name=>classes.push(name)}},createElement:()=>({}),head:{append:node=>styles.push(node)},querySelector:()=>container},
      setChatOpen:value=>chatStates.push(value),studioPreview:preview,dealer:{key:dealer,name:dealer.toUpperCase()},getChatState:()=>chatState,identity,send},
      options=>{mounted=options;return {ready:Promise.resolve(false)};});
    if(preview){assert.equal(control,null);assert.equal(mounted,undefined);continue;}
    assert.deepEqual(classes,[]);assert.deepEqual(styles,[]);assert.deepEqual(chatStates,[]);
    mounted.onReady();assert.deepEqual(classes,['astrid-voice-ui']);assert.equal(styles[0].href,'/astrid-voice-shell.css');assert.deepEqual(chatStates,[false]);
    assert.equal(mounted.dealerName,dealer.toUpperCase());assert.ok(mounted.wakeNames.includes(dealer));
    assert.equal(mounted.identity,identity);assert.equal(mounted.send,send);assert.equal(mounted.container,container);
    assert.equal(mounted.canStart(),true);
    chatState.busy=true;assert.equal(mounted.canStart(),false);
    chatState.busy=false;chatState.speaking=true;assert.equal(mounted.canStart(),false);
    chatState.speaking=false;assert.equal(mounted.canStart(),true);
  }
});

test('incoming replies preserve open conversations and mark closed conversations unread',()=>{
 const h=harness();h.set(true);h.message('dealer');assert.equal(h.isOpen(),true);assert.equal(h.chatToggle.dataset.unread,undefined);
 h.set(false);h.message('dealer');assert.equal(h.isOpen(),false);assert.equal(h.chatToggle.dataset.unread,'true');
 h.message('user');assert.equal(h.isOpen(),true);assert.equal(h.chatToggle.dataset.unread,undefined);
 const preview=harness({sessionId:'preview'});preview.message('user');assert.equal(preview.isOpen(),false);
});
