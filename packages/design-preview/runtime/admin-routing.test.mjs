import test from 'node:test';
import assert from 'node:assert/strict';
import {adminHref,adminPathname,hasAdminContext,isInternalAdminPathname,isRegisteredRoomListRoute,isStudioAdminRoute,withAdminContext} from './admin-routing.mjs';

test('plain admin root is home but old context bookmarks still open Studio',()=>{
  assert.equal(isStudioAdminRoute('/admin',''),false);
  assert.equal(isStudioAdminRoute('/admin','?view=registered'),false);
  for(const search of ['?dealer=anna','?operator=north&table=north-roulette','?composition=scene','?lane=legacy']){
    assert.equal(hasAdminContext(search),true);
    assert.equal(isStudioAdminRoute('/admin',search),true);
  }
  assert.equal(isStudioAdminRoute('/admin/clips',''),true);
});

test('registered room shortcut and legacy room editor have distinct routes',()=>{
  assert.equal(isRegisteredRoomListRoute('/admin/rooms','?view=registered'),true);
  assert.equal(isStudioAdminRoute('/admin/rooms','?view=registered&operator=north'),false);
  assert.equal(isStudioAdminRoute('/admin/rooms','?operator=north&table=room-one'),true);
  assert.equal(isStudioAdminRoute('/admin/rooms',''),true);
});

test('explicit home navigation clears context while deep links retain it',()=>{
  const context='?operator=north&table=room-one&dealer=anna';
  assert.equal(withAdminContext('/admin',context),'/admin');
  assert.equal(withAdminContext('/admin?dealer=bea',context),'/admin?dealer=bea');
  assert.equal(withAdminContext('/admin/rooms?view=registered',context),'/admin/rooms?view=registered&operator=north&table=room-one&dealer=anna');
  assert.equal(withAdminContext('/admin/clips?dealer=bea#cards',context),'/admin/clips?dealer=bea&operator=north&table=room-one#cards');
  assert.equal(withAdminContext('https://outside.invalid/admin/clips',context),'https://outside.invalid/admin/clips');
});

test('admin home is an internal navigation target even when Studio is busy',()=>{
  assert.equal(isInternalAdminPathname('/admin'),true);
  assert.equal(isInternalAdminPathname('/admin/rooms'),true);
  assert.equal(isInternalAdminPathname('/admin/lobby'),false);
  assert.equal(isInternalAdminPathname('/control'),false);
});

test('old design links translate root queries and fragments without changing external or similar paths',()=>{
  for(const suffix of ['', '?dealer=astrid', '#clips', '/clips?dealer=astrid#speech']){
    assert.equal(adminHref('/control'+suffix),'/admin'+suffix);
  }
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
