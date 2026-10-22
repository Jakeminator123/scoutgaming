import test from 'node:test';
import assert from 'node:assert/strict';
import {adminHref,adminPathname,hasAdminContext,isInternalAdminPathname,isStudioAdminRoute,withAdminContext,adminRoomHref} from './admin-routing.mjs';

test('plain admin root is home but old context bookmarks still open Studio',()=>{
  assert.equal(isStudioAdminRoute('/admin',''),false);
  assert.equal(isStudioAdminRoute('/admin','?view=registered'),false);
  for(const search of ['?dealer=anna','?operator=north&table=north-roulette','?composition=scene','?lane=legacy']){
    assert.equal(hasAdminContext(search),true);
    assert.equal(isStudioAdminRoute('/admin',search),true);
  }
  assert.equal(isStudioAdminRoute('/admin/clips',''),true);
});

test('rooms always opens room choices; old queries cannot turn it into a shared editor',()=>{
  for(const search of ['', '?view=registered&operator=north', '?operator=north&table=room-one', '?composition=shared&panel=layers']){
    assert.equal(isStudioAdminRoute('/admin/rooms',search),false);
  }
  assert.equal(isStudioAdminRoute('/admin/clips','?composition=shared&panel=layers'),true);
});

test('dealer library and imports do not inherit a room or its allowed dealers',()=>{
  assert.equal(isStudioAdminRoute('/admin/dealers','?dealer=dragan'),false);
  assert.equal(isStudioAdminRoute('/admin/dealers','?dealer=dragan&tool=import'),false);
  assert.equal(withAdminContext('/admin/dealers','?operator=north&table=room-one&dealer=astrid'),'/admin/dealers');
  assert.equal(withAdminContext('/admin/dealers?dealer=dragan&tool=import','?dealer=astrid&composition=shared'),'/admin/dealers?dealer=dragan&tool=import');
});

test('explicit home navigation clears context while deep links retain it',()=>{
  const context='?operator=north&table=room-one&dealer=anna';
  assert.equal(withAdminContext('/admin',context),'/admin');
  assert.equal(withAdminContext('/admin?dealer=bea',context),'/admin?dealer=bea');
  assert.equal(withAdminContext('/admin/rooms',context),'/admin/rooms?operator=north&table=room-one');
  assert.equal(withAdminContext('/admin/clips?dealer=bea#cards',context),'/admin/clips?dealer=bea&operator=north&table=room-one#cards');
  assert.equal(withAdminContext('https://outside.invalid/admin/clips',context),'https://outside.invalid/admin/clips');
});

test('admin home is an internal navigation target even when Studio is busy',()=>{
  assert.equal(isInternalAdminPathname('/admin'),true);
  assert.equal(isInternalAdminPathname('/admin/rooms'),true);
  assert.equal(isInternalAdminPathname('/admin/lobby'),false);
  assert.equal(isInternalAdminPathname('/control'),false);
});

test('explicit shared scene links win while a new room does not inherit the old template',()=>{
  const context='?operator=a&table=room-a&composition=scene-a&dealer=astrid&game=blackjack';
  const target=href=>new URL(withAdminContext(href,context),'https://admin.fixture.invalid').searchParams;
  const otherRoom=target('/admin/clips?operator=b&table=room-b&game=roulette');
  assert.equal(otherRoom.has('composition'),false);assert.equal(otherRoom.has('lane'),false);
  assert.equal(otherRoom.get('game'),'roulette');
  for(const href of ['/admin/clips?operator=b&table=room-b','/admin/clips?table=room-b','/admin/clips?operator=b']){
    const inherited=target(href);
    assert.equal(inherited.has('game'),false,'an omitted game belongs to the new room');
    assert.equal(inherited.has('composition'),false);
  }
  for(const field of ['composition','lane']){
    const explicit=target('/admin/clips?'+field+'=scene-b&panel=layers');
    assert.equal(explicit.get(field),'scene-b');assert.equal(explicit.has(field==='lane'?'composition':'lane'),false);
    assert.equal(explicit.get('table'),'room-a');assert.equal(explicit.get('operator'),'a');
  }
  assert.equal(target('/admin/clips?dealer=nora').get('composition'),'scene-a');
  assert.equal(target('/admin/clips?dealer=nora').get('game'),'blackjack');
});

test('old design links translate root queries and fragments without changing external or similar paths',()=>{
  for(const suffix of ['', '?dealer=astrid', '#clips']){
    assert.equal(adminHref('/control'+suffix),'/admin'+suffix);
  }
  assert.equal(adminHref('/control/clips?dealer=astrid#speech'),'/admin/dealer-studio?dealer=astrid#speech');
  for(const href of ['/admin/clips','/controller','https://outside.invalid/control','//outside.invalid/control']){
    assert.equal(adminHref(href),href);
  }
});

test('direct Studio mount resolves to Admin without inventing a Control pathname',()=>{
  for(const path of ['/admin','/admin/clips','/admin/admin/operators']){
    assert.equal(adminPathname(path),path);
    assert.equal(adminPathname('/studio'+path),path);
  }
  for(const path of ['/control/clips','/studio/control/clips','/studio/administrator']){
    assert.equal(adminPathname(path),path);
  }
});

test('saved player-account aliases use the player accounts page while retaining exact query, fragment and explicit context',()=>{
  const suffix='?operator=north&table=room-one&composition=scene&dealer=anna&game=roulette&tag=a&tag=b#history';
  for(const path of ['/admin/admin/players','/studio/admin/admin/players','/control/players','/studio/control/players']){
    assert.equal(adminHref(path+suffix),'/admin/players'+suffix);
  }
  for(const path of ['/admin/admin/players','/studio/admin/admin/players'])assert.equal(adminPathname(path),'/admin/players');
  assert.equal(withAdminContext(adminHref('/admin/admin/players?operator=north#history'),'?operator=other&dealer=anna'),'/admin/players?operator=north&dealer=anna#history');
  for(const href of ['/admin/admin/players-extra','/admin/admin/players/details','https://outside.invalid/admin/admin/players','//outside.invalid/admin/admin/players','/control/login?returnTo=%2Fadmin%2Fadmin%2Fplayers'])assert.equal(adminHref(href),href);
});


test('room addresses discard library dealers while preserving exact ownership, repeated query and fragment',()=>{
  const search='?dealer=astrid&operator=north&table=room-one&game=roulette&tag=a&tag=b';
  assert.equal(adminRoomHref(search,'#choices'),'/admin/rooms?operator=north&table=room-one&game=roulette&tag=a&tag=b#choices');
  assert.equal(adminRoomHref('?dealer=astrid'),'/admin/rooms');
  assert.equal(withAdminContext('/admin/rooms?dealer=wrong&operator=other&table=other-room#choices',search),'/admin/rooms?operator=other&table=other-room#choices');
  assert.equal(withAdminContext('/admin/clips?dealer=dragan',search).includes('dealer=dragan'),true);
});
