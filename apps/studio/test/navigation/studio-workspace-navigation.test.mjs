import test from 'node:test';
import assert from 'node:assert/strict';
import {studioNavigationHref,studioScopedHref,studioNavigationContextFromQuery} from '../../lib/studio-navigation.mjs';

const selection={dealerId:'paow',eventId:'speak.goodluck',variantId:'paow.goodluck.alt-2',situation:'goodluck',laneId:'studio/main'};
const parse=href=>new URL(href,'https://scoutgaming.test');

test('navigation preserves clip context, explicit destination parameters and fragments',()=>{
  const url=parse(studioNavigationHref('/admin/probe?mode=recorded#settings',selection));
  assert.equal(url.pathname,'/admin/dealers/paow');assert.equal(url.searchParams.get('flik'),'tal');
  for(const [key,value] of Object.entries({event:selection.eventId,variant:selection.variantId,situation:selection.situation,composition:selection.laneId,mode:'recorded'}))assert.equal(url.searchParams.get(key),value,key);
  assert.equal(url.hash,'#settings');assert.equal(url.searchParams.has('dealer'),false);
});

test('dealer navigation never substitutes another dealer identity or accepts an external destination',()=>{
  for(const dealerId of ['astrid','paow','new-dealer'])assert.equal(parse(studioNavigationHref('/admin/replies',{dealerId})).pathname,'/admin/dealers/'+dealerId);
  const invalid=parse(studioNavigationHref('/admin/replies',{dealerId:'dealer & two'}));
  assert.equal(invalid.pathname,'/admin/dealers');assert.equal(invalid.searchParams.get('dealer'),'dealer & two');
  for(const path of ['https://outside.invalid','//outside.invalid','/admin\\outside','/admin\nexternal'])assert.throws(()=>studioNavigationHref(path),TypeError);
});

test('a selected company filters the company list and does not open the company nav',()=>{
  assert.equal(studioNavigationHref('/admin/companies',{operatorId:'north'}),'/admin/companies?tab=spelbord&operator=north');
  assert.equal(studioNavigationHref('/admin/companies?tab=papperskorg',{operatorId:'north'}),'/admin/companies?tab=papperskorg&operator=north');
  assert.equal(studioNavigationHref('/admin/companies'),'/admin/companies');
  assert.equal(studioNavigationHref('/control/lanes?tab=companies',{operatorId:'north'}),'/admin/companies/north');
});

test('scoped navigation preserves ambiguous company and room selectors for destination validation',()=>{
  const source=new URLSearchParams('dealer=paow&operator=north&operator=south&table=one&table=two&room=three&room=four&token=private');
  const url=parse(studioScopedHref('/admin/replies',source,selection));
  assert.deepEqual(url.searchParams.getAll('operator'),['north','south']);
  assert.deepEqual(url.searchParams.getAll('table'),['one','two']);
  assert.deepEqual(url.searchParams.getAll('room'),['three','four']);assert.equal(url.searchParams.has('token'),false);
});

test('query context reader omits credentials, page-specific filters and empty values',()=>{
  const query=new URLSearchParams({dealer:'paow',event:'speak.goodluck',variant:'paow.goodluck.alt-2',situation:'goodluck',lane:'studio/main',category:'player-kind',token:'private',tab:'triggers',cursor:'opaque'});
  assert.deepEqual(studioNavigationContextFromQuery(query),selection);
  assert.deepEqual(studioNavigationContextFromQuery(new URLSearchParams('dealer=&event=&token=x')),{});
  assert.equal(parse(studioNavigationHref('/admin/dealer-studio',{...selection,token:'private'})).searchParams.has('token'),false);
});
