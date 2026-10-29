import test from 'node:test';
import assert from 'node:assert/strict';
import {adminHref,adminPathname,hasAdminContext,isInternalAdminPathname,isStudioAdminRoute,withAdminContext,parseAdminPath} from './admin-routing.mjs';

test('the six menu pages and the three navs parse from the path; anything else is unknown',()=>{
  assert.deepEqual(parseAdminPath('/admin'),{page:'home',id:''});
  assert.deepEqual(parseAdminPath('/studio/admin/'),{page:'home',id:''});
  for(const [path,page] of [['/admin/dealers','dealers'],['/admin/scenes','scenes'],['/admin/companies','companies'],['/admin/system','system'],['/admin/guide','guide'],['/admin/demo','demo'],['/admin/lobby','lobby']])assert.deepEqual(parseAdminPath(path),{page,id:''},path);
  assert.deepEqual(parseAdminPath('/admin/dealers/dragan'),{page:'dealer',id:'dragan'});
  assert.deepEqual(parseAdminPath('/admin/companies/johns-bet'),{page:'company',id:'johns-bet'});
  assert.deepEqual(parseAdminPath('/studio/admin/rooms/room-1'),{page:'room',id:'room-1'});
  for(const path of ['/admin/rooms','/admin/clips','/admin/dealers/a/b','/admin/system/x','/admin/demo/x','/control/clips','/partner'])assert.equal(parseAdminPath(path).page,'unknown',path);
});

test('the clip map is a Studio route only under the dealer nav and under Miljöer',()=>{
  for(const search of ['','?view=registered','?dealer=anna','?operator=north&table=north-roulette','?composition=scene','?lane=legacy']){
    assert.equal(isStudioAdminRoute('/admin',search),false);
    assert.equal(isStudioAdminRoute('/admin/dealers',search),false,'the dealer list never mounts the map');
    assert.equal(isStudioAdminRoute('/admin/companies',search),false);
  }
  for(const search of ['?dealer=anna','?operator=north&table=north-roulette'])assert.equal(hasAdminContext(search),true);
  assert.equal(isStudioAdminRoute('/admin/dealers/dragan','?flik=klipp'),true);
  assert.equal(isStudioAdminRoute('/admin/dealers/dragan','?flik=tal'),true);
  assert.equal(isStudioAdminRoute('/admin/scenes','?tab=mallar'),true);
  assert.equal(isStudioAdminRoute('/admin/rooms/room-1',''),false,'the room editor is not the clip map');
  assert.equal(isStudioAdminRoute('/admin/clips',''),false,'the retired address redirects instead');
});

test('only the clip map inherits room and template context; the dealer sits in the path',()=>{
  const context='?operator=north&table=room-one&dealer=anna&game=blackjack';
  assert.equal(withAdminContext('/admin',context),'/admin');
  assert.equal(withAdminContext('/admin/dealers',context),'/admin/dealers');
  assert.equal(withAdminContext('/admin/companies/north?flik=team',context),'/admin/companies/north?flik=team');
  assert.equal(withAdminContext('/admin/rooms/room-one?flik=spel',context),'/admin/rooms/room-one?flik=spel');
  assert.equal(withAdminContext('/admin/system?flik=drift',context),'/admin/system?flik=drift');
  assert.equal(withAdminContext('/admin/dealers/bea?flik=klipp#cards',context),'/admin/dealers/bea?flik=klipp&operator=north&table=room-one&game=blackjack#cards');
  assert.equal(withAdminContext('/admin/scenes?tab=mallar',context),'/admin/scenes?tab=mallar&operator=north&table=room-one&game=blackjack');
  assert.equal(new URLSearchParams(withAdminContext('/admin/dealers/bea?flik=klipp',context).split('?')[1]).has('dealer'),false,'a query dealer is never inherited');
  assert.equal(withAdminContext('https://outside.invalid/admin/dealers/bea',context),'https://outside.invalid/admin/dealers/bea');
});

test('explicit scene links win while a new room does not inherit the old template',()=>{
  const context='?operator=a&table=room-a&composition=scene-a&dealer=astrid&game=blackjack';
  const target=href=>new URL(withAdminContext(href,context),'https://admin.fixture.invalid').searchParams;
  const otherRoom=target('/admin/dealers/nora?flik=klipp&operator=b&table=room-b&game=roulette');
  assert.equal(otherRoom.has('composition'),false);assert.equal(otherRoom.has('lane'),false);
  assert.equal(otherRoom.get('game'),'roulette');
  for(const href of ['/admin/dealers/nora?flik=klipp&operator=b&table=room-b','/admin/dealers/nora?flik=klipp&table=room-b','/admin/dealers/nora?flik=klipp&operator=b']){
    const inherited=target(href);
    assert.equal(inherited.has('game'),false,'an omitted game belongs to the new room');
    assert.equal(inherited.has('composition'),false);
  }
  for(const field of ['composition','lane']){
    const explicit=target('/admin/scenes?tab=mallar&'+field+'=scene-b');
    assert.equal(explicit.get(field),'scene-b');assert.equal(explicit.has(field==='lane'?'composition':'lane'),false);
    assert.equal(explicit.get('table'),'room-a');assert.equal(explicit.get('operator'),'a');
  }
  assert.equal(target('/admin/dealers/nora?flik=klipp').get('composition'),'scene-a');
  assert.equal(target('/admin/dealers/nora?flik=klipp').get('game'),'blackjack');
});

test('admin home is an internal navigation target even when Studio is busy',()=>{
  assert.equal(isInternalAdminPathname('/admin'),true);
  assert.equal(isInternalAdminPathname('/admin/rooms/room-1'),true);
  assert.equal(isInternalAdminPathname('/admin/lobby'),false);
  assert.equal(isInternalAdminPathname('/control'),false);
});

test('old design links translate root queries and fragments without changing external or similar paths',()=>{
  for(const suffix of ['', '?dealer=astrid', '#clips']){
    assert.equal(adminHref('/control'+suffix),'/admin'+suffix);
  }
  assert.equal(adminHref('/control/clips?dealer=astrid#speech'),'/admin/dealers/astrid?flik=klipp#speech');
  for(const href of ['/admin/dealers/astrid?flik=klipp','/controller','https://outside.invalid/control','//outside.invalid/control']){
    assert.equal(adminHref(href),href);
  }
});

test('direct Studio mount resolves to Admin without inventing a Control pathname',()=>{
  for(const path of ['/admin','/admin/dealers/dragan','/admin/system']){
    assert.equal(adminPathname(path),path);
    assert.equal(adminPathname('/studio'+path),path);
  }
  for(const path of ['/control/clips','/studio/control/clips','/studio/administrator']){
    assert.equal(adminPathname(path),path);
  }
});

test('the retired company register opens the company nav with the same company and fragment',()=>{
  for(const prefix of ['','/studio'])assert.equal(adminHref(prefix+'/admin/admin/operators?operator=b#team'),'/admin/companies/b#team');
  assert.equal(adminHref('/admin/admin/operators'),'/admin/companies');
  for(const href of ['/admin/admin/operators-extra','/admin/admin/operators/details'])assert.equal(adminHref(href),href);
});

test('saved player-account aliases open System › Spelarkonton with exact query and fragment',()=>{
  const suffix='?operator=north&table=room-one&composition=scene&dealer=anna&game=roulette&tag=a&tag=b#history';
  for(const path of ['/admin/admin/players','/studio/admin/admin/players','/control/players','/studio/control/players']){
    assert.equal(adminHref(path+suffix),'/admin/system?flik=spelare'+suffix.replace('?','&'));
  }
  for(const href of ['/admin/admin/players-extra','/admin/admin/players/details','https://outside.invalid/admin/admin/players','//outside.invalid/admin/admin/players','/control/login?returnTo=%2Fadmin%2Fadmin%2Fplayers'])assert.equal(adminHref(href),href);
});
