import test from 'node:test';
import assert from 'node:assert/strict';
import {hasAdminContext,isInternalAdminPathname,isRegisteredRoomListRoute,isStudioAdminRoute,withAdminContext} from './admin-routing.mjs';

test('plain admin root is home but old context bookmarks still open Studio',()=>{
  assert.equal(isStudioAdminRoute('/control',''),false);
  assert.equal(isStudioAdminRoute('/control','?view=registered'),false);
  for(const search of ['?dealer=anna','?operator=north&table=north-roulette','?composition=scene']){
    assert.equal(hasAdminContext(search),true);
    assert.equal(isStudioAdminRoute('/control',search),true);
  }
  assert.equal(isStudioAdminRoute('/control/clips',''),true);
});

test('registered room shortcut and legacy room editor have distinct routes',()=>{
  assert.equal(isRegisteredRoomListRoute('/control/rooms','?view=registered'),true);
  assert.equal(isStudioAdminRoute('/control/rooms','?view=registered&operator=north'),false);
  assert.equal(isStudioAdminRoute('/control/rooms','?operator=north&table=room-one'),true);
  assert.equal(isStudioAdminRoute('/control/rooms',''),true);
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
