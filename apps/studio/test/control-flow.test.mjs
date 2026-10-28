import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalControlHref, compositionLabel } from '../../../packages/navigation/control-flow.mjs';
import { studioNavigationHref, studioNavigationContextFromQuery } from '../lib/studio-navigation.mjs';

test('older workspace links keep company and room context', () => {
  assert.equal(canonicalControlHref('/control/lanes?tab=companies&operator=op-one#team'), '/admin/companies/op-one#team');
  assert.equal(canonicalControlHref('/control/activity?dealer=paow&operator=north&table=room-one'), "/admin/rooms/room-one?operator=north", 'the room nav owns its dealer selection');
  assert.equal(canonicalControlHref('/control/preview?composition=current'), "/admin/scenes?tab=mallar&composition=current");
});

test('ambiguous or external document paths never become a navigation destination', () => {
  for (const value of ['https://evil.test/control', '//evil.test', '/control/../play', '/control/%2e%2e/play', '/control/%2froom', '/control//rooms', '/control\\rooms']) assert.throws(()=>canonicalControlHref(value));
});

test('Clips editor bookmarks preserve selection and fragments without changing the zoomable Admin map', () => {
  for(const prefix of ['/control','/studio/control'])for(const view of ['idle','clips','generate','speech','settings']) {
    const path=canonicalControlHref(prefix+'/clips?dealerId=saga&lane=portrait&view='+view+'&operator=north&room=one&room=two&table=three&game=roulette&category=speech&event=speak.goodluck#clip');
    const url=new URL(path,'https://studio.invalid');assert.equal(url.pathname,'/admin/dealers/saga');
    assert.equal(url.searchParams.has('dealer'),false,'the dealer sits in the path');assert.equal(url.searchParams.get('composition'),'portrait');
    assert.equal(url.searchParams.get('flik'),view==='speech'?'tal':view==='settings'?'installningar':'klipp');
    assert.equal(url.searchParams.get('panel'),view==='generate'?'generera':null);assert.equal(url.searchParams.has('view'),false);assert.deepEqual(url.searchParams.getAll('room'),['one','two']);
    assert.equal(url.searchParams.get('table'),'three');assert.equal(url.searchParams.get('game'),'roulette');
    assert.equal(url.searchParams.get('category'),'speech');assert.equal(url.searchParams.get('event'),'speak.goodluck');
    assert.equal(url.searchParams.has('dealerId'),false);assert.equal(url.searchParams.has('lane'),false);assert.equal(url.hash,'#clip');
  }
  assert.equal(canonicalControlHref('/admin/clips?dealer=saga#map'),'/admin/dealers/saga?flik=klipp#map');
  assert.equal(canonicalControlHref('/admin/dealers/saga?flik=klipp#map'),'/admin/dealers/saga?flik=klipp#map');
});

test('AI bookmarks open their resource and keep exact navigation context', () => {
  for (const base of ['', '/studio']) for (const [path,query,tab] of [
    ['openclaw','','models'],['openclaw','tab=chat&','agent'],
    ['openclaw','tab=models&','models'],['operator-chat','','agent'],['ops','tab=chat&','drift'],
  ]) assert.equal(canonicalControlHref(base+'/control/'+path+'?'+query+'dealer=saga&event=idle.ready&operator=north&room=room-1&table=room-1&game=roulette&lane=portrait#selection'),
    ({models:'/admin/system?flik=agenter&dealer=saga&',agent:'/admin/dealers/saga?flik=tal&verktyg=dialog&',drift:'/admin/dealers/saga?flik=tal&'}[tab])+'event=idle.ready&operator=north&room=room-1&table=room-1&game=roulette&composition=portrait#selection');
});

test('navigation keeps company and real room identity but never copies auth or diagnostic query', () => {
  const context=studioNavigationContextFromQuery(new URLSearchParams('operator=north&table=room-one&composition=scene-a&dealer=paow&token=private&debug=1'));
  const link=new URL(studioNavigationHref('/admin/rehearsal', context),'https://studio.invalid');
  assert.equal(link.searchParams.get('operator'),'north');
  assert.equal(link.searchParams.get('table'),'room-one');
  assert.equal(link.searchParams.get('composition'),'scene-a');
  assert.equal(link.searchParams.get('dealer'),'paow');
  assert.equal(link.searchParams.has('token'),false);
  assert.equal(link.searchParams.has('debug'),false);
  assert.equal(link.searchParams.has('lane'),false);
});

test('chosen composition names remain unchanged', () => {
  assert.equal(compositionLabel('Norrsken'),'Norrsken');
});
