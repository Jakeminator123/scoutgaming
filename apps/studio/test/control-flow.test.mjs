import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalControlHref, compositionLabel } from '../../../packages/navigation/control-flow.mjs';
import { studioNavigationHref, studioNavigationContextFromQuery } from '../lib/studio-navigation.mjs';

test('older workspace links keep company and room context', () => {
  assert.equal(canonicalControlHref('/control/lanes?tab=companies&operator=op-one#team'), '/admin/companies?operator=op-one#team');
  assert.equal(canonicalControlHref('/control/activity?dealer=paow&operator=north&table=room-one'), '/control/rehearsal?dealer=paow&operator=north&table=room-one');
  assert.equal(canonicalControlHref('/control/preview?composition=current'), '/control/compositions?composition=current');
});

test('ambiguous or external document paths never become a navigation destination', () => {
  for (const value of ['https://evil.test/control', '//evil.test', '/control/../play', '/control/%2e%2e/play', '/control/%2froom', '/control//rooms', '/control\\rooms']) assert.throws(()=>canonicalControlHref(value));
});

test('navigation keeps company and real room identity but never copies auth or diagnostic query', () => {
  const context=studioNavigationContextFromQuery(new URLSearchParams('operator=north&table=room-one&composition=scene-a&dealer=paow&token=private&debug=1'));
  const link=new URL(studioNavigationHref('/control/rehearsal', context),'https://studio.invalid');
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
