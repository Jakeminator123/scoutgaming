import test from 'node:test';
import assert from 'node:assert/strict';
import { studioScopedHref } from '../lib/studio-navigation.mjs';

const href = (path, query, context = {dealerId: 'elin'}) => new URL(studioScopedHref(path, new URLSearchParams(query), context), 'https://studio.invalid');

test('tvetydiga spelrum öppnar bolagets Spelbord med alla val kvar, aldrig det första spelrummet', () => {
  for (const query of ['table=room-a&table=room-b&room=room-c&operator=operator-a', 'table=room-a&room=room-c&operator=operator-a', 'table=room-a&table=room-b&operator=operator-a']) {
    const url = href('/admin/rooms', query);
    assert.equal(url.pathname, '/admin/companies', query);
    assert.equal(url.searchParams.get('tab'), 'spelbord');
    assert.equal(url.searchParams.get('operator'), 'operator-a');
    assert.equal(url.searchParams.get('dealer'), 'elin');
    const source = new URLSearchParams(query);
    assert.deepEqual(url.searchParams.getAll('table'), source.getAll('table'));
    assert.deepEqual(url.searchParams.getAll('room'), source.getAll('room'));
  }
});

test('ett entydigt spelrum öppnar sin nav precis som den delade dokumentmappningen', () => {
  for (const query of ['table=room-a', 'room=room-a', 'table=room-a&table=room-a', 'table=room-a&room=room-a', 'table=room-a&operator=operator-a']) {
    const url = href('/admin/rooms', query), source = new URLSearchParams(query);
    assert.equal(url.pathname, '/admin/rooms/room-a', query);
    // Sidans val följer med oförändrade så att spelrummets nav själv prövar dem.
    for (const key of ['operator', 'table', 'room']) assert.deepEqual(url.searchParams.getAll(key), source.getAll(key), query);
  }
});

test('tvetydiga bolag följer med oförändrade och inget spelrum ger bolagslistan', () => {
  const url = href('/admin/rooms', 'operator=operator-a&operator=other&table=room-a');
  assert.equal(url.pathname, '/admin/rooms/room-a');
  assert.deepEqual(url.searchParams.getAll('operator'), ['operator-a', 'other']);
  assert.deepEqual(url.searchParams.getAll('table'), ['room-a']);
  assert.equal(studioScopedHref('/admin/rooms', null, {dealerId: 'elin'}), '/admin/companies?tab=spelbord&dealer=elin');
  assert.equal(studioScopedHref('/admin/rooms', new URLSearchParams(), {dealerId: 'elin'}), '/admin/companies?tab=spelbord&dealer=elin');
});
