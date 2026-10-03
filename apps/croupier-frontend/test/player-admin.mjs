import test from 'node:test';
import assert from 'node:assert/strict';
import {playerAdministrationHtml, changePlayerStatus} from '../../../web/public/bo/player-admin.mjs';

const player = {id: 'fixture-player', username: 'demo', name: '<img src=x onerror=alert(1)>', currency: 'USD', balance: 1000, status: 'active', created_at: '2026-10-02'};

test('reader sees escaped demo data without account mutation controls; closed accounts cannot reactivate', () => {
  const html = playerAdministrationHtml([player], 'reader');
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/); assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /data-player=|player-create/); assert.match(html, /Read-only/);
  assert.doesNotMatch(playerAdministrationHtml([player], 'admin', false), /data-player=|player-create/);
  const closed = playerAdministrationHtml([{...player, status: 'closed'}], 'admin');
  assert.match(closed, /CLOSED/); assert.doesNotMatch(closed, /data-player=|REACTIVATE/);
});

test('permanent close requires meaningful confirmation and reason, preserves identity, and propagates server rejection', async () => {
  const calls = [];
  const api = async (...args) => {calls.push(args); return {ok: true};};
  const command = {player, status: 'closed', reason: ' Operator request ', role: 'admin'};
  assert.equal(await changePlayerStatus(command, {api, confirmClose: message => {assert.match(message, /cannot be undone/); assert.match(message, /history and balances remain/); return false;}}), false);
  assert.equal(calls.length, 0);
  await assert.rejects(changePlayerStatus({...command, reason: ' '}, {api, confirmClose: () => true}), /reason/);
  await assert.rejects(changePlayerStatus({...command, role: 'staff'}, {api, confirmClose: () => true}), /ADMIN/);
  await assert.rejects(changePlayerStatus({...command, player: {...player, status: 'closed'}, status: 'active'}, {api, confirmClose: () => true}), /cannot be changed/);
  assert.equal(calls.length, 0);
  assert.equal(await changePlayerStatus(command, {api, confirmClose: () => true}), true);
  assert.deepEqual(calls, [['/api/bo/players/status', {playerId: player.id, status: 'closed', reason: 'Operator request'}]]);
  await assert.rejects(changePlayerStatus(command, {api: async () => ({ok: false, error: 'Collect the ongoing hand first.'}), confirmClose: () => true}), /Collect the ongoing hand/);
});

import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {canOpenLab} from '../../../web/public/bo/workspace-navigation.mjs';

async function legacyBoFixture(role,section){
  const requests=[],elements=new Map(),promotion={dataset:{roleUser:'legacy-player'}};
  const element=key=>{if(!elements.has(key))elements.set(key,{textContent:'',innerHTML:'',hidden:true,value:key==='#inv-role'?'admin':'',classList:{toggle(){},add(){},remove(){}},querySelectorAll:selector=>selector==='button[data-role-user]'?[promotion]:[]});return elements.get(key);};
  const context={
    document:{querySelector:element,querySelectorAll:()=>[],body:{classList:{toggle(){}}},referrer:''},
    location:{href:'https://game.example.invalid/bo/#'+section,hash:'#'+section},parent:null,window:{},
    createSinglePreviewController:()=>({release(){},bind(){}}),canOpenLab,workspaceUrl:()=>null,isEmbeddedWorkspace:()=>false,mountPlayerAdministration(){},
    addEventListener(){},setTimeout:()=>0,clearTimeout(){},confirm:()=>true,
    fetch:async(url,init)=>{requests.push([url,init]);const body=url==='/api/bo/me'?{user:'operator',role}:url==='/api/bo/overview'?{tx:[]}:url==='/api/bo/users'?{users:[
      {username:'operator',role,email:'operator@example.invalid',active:true},{username:'legacy-player',role:'reader',active:true},{username:'other-admin',role:'superadmin',active:true},
    ]}:url==='/api/bo/apikeys'?{scopes:['launch'],keys:[]}:{ok:true};return{json:async()=>body};},
  };
  const source=(await readFile(new URL('../../../web/public/bo/bo.mjs',import.meta.url),'utf8'))
    .replace(/^import .*;\r?$/gm,'').replace(/^render\(location\.hash\.slice\(1\)\|\|'ops'\);/m,"globalThis.initialRender=render(location.hash.slice(1)||'ops');");
  runInNewContext(source,context);await context.initialRender;await new Promise(resolve=>setImmediate(resolve));
  return{html:element('#content').innerHTML,requests,promotion,elements};
}

test('legacy BO admin and superadmin have identical users/partner controls; game-only roles stay barred',async()=>{
  for(const section of ['users','apikeys']){
    const admin=await legacyBoFixture('admin',section),superadmin=await legacyBoFixture('superadmin',section);
    assert.equal(admin.html,superadmin.html);assert.equal(admin.elements.get('#account-role').textContent,'ADMIN');
    assert.match(admin.html,section==='users'?/INVITE BY EMAIL/:/CREATE PARTNER KEY/);
    assert.doesNotMatch(admin.html,/SUPERADMIN ONLY|value="reader"|value="staff"|value="superadmin"/);
    assert.ok(admin.requests.some(([url])=>url==='/api/bo/'+section));assert.equal(admin.requests.filter(([,init])=>init?.method==='POST').length,0);
    for(const role of ['reader','staff','player',undefined,'constructor']){
      const rejected=await legacyBoFixture(role,section);assert.match(rejected.html,/ADMIN ONLY/);
      assert.equal(rejected.requests.some(([url])=>url==='/api/bo/'+section),false);
      assert.doesNotMatch(rejected.html,/INVITE BY EMAIL|CREATE PARTNER KEY/);
    }
  }
  const admin=await legacyBoFixture('admin','users');assert.match(admin.html,/PLAYER/);assert.match(admin.html,/MAKE ADMIN/);
  await admin.promotion.onclick();
  const writes=admin.requests.filter(([,init])=>init?.method==='POST');assert.equal(writes.length,1);
  assert.equal(writes[0][0],'/api/bo/users/role');assert.deepEqual(JSON.parse(writes[0][1].body),{username:'legacy-player',role:'admin'});
});
