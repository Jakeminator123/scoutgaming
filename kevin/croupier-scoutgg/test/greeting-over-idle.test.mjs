import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSharedTable} from '../server/shared-table.mjs';
import {personalizedGreeting} from '../server/dealer-responses-localized.mjs';

// Kevin 23 Oct: the greeting says the player's nickname (never "Guest 465"), and Dragan and Paow speak it in their own
// voice over their idle takes on the moving clips (the talk track), like their chat answers. Private lines stay as before.
const server = readFileSync(new URL('../server/server.mjs', import.meta.url), 'utf8');

test('a greeting at the table goes on the talk track over the dealer\'s idle chain, between rounds', () => {
  const take = {'-':39,'-i':60,'-u':60,'-iu':81,'-v':39,'-iv':60}, frames = Object.fromEntries(['1','2','3','4','5','6','7','dealer'].map(k => [k, take]));
  frames.hole = {'-':39,'-i':60,'-u':39,'-iu':60}; frames.flip = {'-':56,'-i':56,'-u':56,'-iu':56};
  const idle = [{take:'andas',frames:39,vikt:20,calm:true},{take:'djupandetag',frames:39,vikt:8,calm:true},{take:'fingrar',frames:39,vikt:4,calm:true}];
  const ready = {frames, restEnd:['hole','flip'], restStart:['flip'], idle, variants:{}, durs:{}};
  const manifest = {deal:[1,2,3,4,5,6,7,'dealer'].map(i => ({id:`deal_pos${i}`,url:`/media/deal/pos${i}.mp4`,dur:.1})), repliker:[{id:'goodluck_1',event:'goodluck',url:'/x.mp4',dur:1}], idle:[]};
  const dir = mkdtempSync(join(tmpdir(), 'greet-'));
  const welcomes = [];
  const s = createSharedTable(join(dir, 't.sqlite'), {manifest, now:()=>100000, readyFor:()=>ready, talk:()=>({idle:idle.map(i=>i.take), line:()=>null}), onWelcome:w=>welcomes.push(w)});
  try {
    s.run('dragge', {session:'v', op:'join', name:'Anna', seats:[3], requestId:'r1', version:0});
    const text = personalizedGreeting('Anna', 'en');
    const {talk} = s.addTalk('dragge', {text, lang:'en', dur:2.5});
    assert.equal(talk.text, 'Hi Anna, welcome, how are you today?');
    assert.ok(talk.idle?.length > 0, 'the greeting runs over a chain of idle takes, not the still');
    for (const c of talk.idle) assert.ok(['andas','djupandetag','fingrar'].includes(c.take), c.take);
  } finally { s.close(); rmSync(dir, {recursive:true, force:true}); }
});

test('the server greets in the dealer\'s own voice: moving over his idles when warm, else his own clip; Astrid classic as before', () => {
  const body = server.slice(server.indexOf('async function welcomeGuest'), server.indexOf('function randomId'));
  assert.match(body, /dealer=dealerOf\(session\)/);
  assert.match(body, /if\(canTalkMoving\(dealer\)\)\{[\s\S]*speakOnTalkTrack\(session,dealer,text,lang\)[\s\S]*broadcast\(\{t:'answer',id,to:name,text,dealer,talk:spoken\.id\},session\)/);
  assert.match(body, /if\(hasVoice\(dealer\)&&draggeVoiceReady\(dealer\)\)\{[\s\S]*draggeSay\(text,lang,ANSWERS,\{dealer\}\)/, 'cold worker: his own clip, never Astrid\'s');
  assert.match(body, /astrid\.enqueue\(\{kind:'greeting',name,lang\}\)/, 'Astrid classic keeps her pipeline');
  // staging runs with RUNPOD_API_KEY=local-qa-disabled (localQA): that switches off only Astrid's pipeline, so Dragan and Paow still greet
  assert.ok(body.indexOf('if(localQA)') > body.indexOf('speakOnTalkTrack(session'), 'localQA is checked only after the moving and own-clip paths');
});

test('chat answers share the same moving path; private hand facts and the mixed round result are unchanged', () => {
  const talk = server.slice(server.indexOf('async function talkReply'), server.indexOf('// "Grattis Anders'));
  assert.match(talk, /if\(!fid&&talk&&canTalkMoving\(dealer\)\)\{[\s\S]*speakOnTalkTrack\(ws\.session,dealer,reply,language\)/);
  const result = server.slice(server.indexOf('async function roundResultReply'), server.indexOf('/** Exakt text'));
  assert.doesNotMatch(result, /speakOnTalkTrack|addTalk/, 'a player\'s own round result is never said to the whole table');
  assert.match(result, /draggeSay\(text, language, ANSWERS, \{ dealer: alt \}\)/);
});

test('Dragan and Paow are greeted by the server only: the recorded greet_guest is not played on top (they met at the table at once)', async () => {
  const { DEALERS } = await import('../public/dealers.js');
  assert.equal(DEALERS.dragge.serverGreets, true); assert.equal(DEALERS.paow.serverGreets, true);
  assert.ok(!DEALERS.astrid2.serverGreets && !DEALERS.marten.serverGreets, 'the others keep their recorded greeting');
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /if\(!greeted\)\{greeted=true;if\(!dealer\.serverGreets\)remarkNow\(greetingFor\(name\)\);\}/);
});
