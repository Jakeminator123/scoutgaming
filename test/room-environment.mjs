import test from 'node:test';
import assert from 'node:assert/strict';
import { roomEnvironment } from '../packages/presentation/contracts/room-environment.mjs';

const a = { id: '11111111-1111-1111-1111-111111111111', label: 'Salongen' };
const b = { id: '22222222-2222-2222-2222-222222222222', label: 'Studion' };
const dealer = (allowed = [a], mode = 'image') => ({ independentLayers: true,
  background: { enabled: true, default: allowed[0]?.id ?? null, allowed, mode } });

test('all dealers must share a sole published background before it becomes the room image', () => {
  const value = roomEnvironment({ dealers: [dealer(), dealer()] }, 'nordic-bet');
  assert.deepEqual(value, { kind: 'image', fixed: true, label: 'Salongen',
    image: '/api/presentation/layers/nordic-bet/' + a.id });
  for (const dealers of [[dealer([a, b])], [dealer(), dealer([b])], [dealer(), dealer([a], 'video')]]) {
    assert.deepEqual(roomEnvironment({ dealers }, 'north'), { kind: 'variable', fixed: false, label: 'Flera publicerade miljöval' });
  }
});

test('video and baked environments never masquerade as background photographs', () => {
  const video = roomEnvironment({ dealers: [dealer([a], 'video')] }, 'north');
  assert.deepEqual(video, { kind: 'video', fixed: true, label: 'Salongen' });
  const baked = { independentLayers: false, background: { enabled: false, default: null, allowed: [], mode: 'baked' } };
  assert.deepEqual(roomEnvironment({ dealers: [baked] }, 'north'), { kind: 'baked', fixed: true, label: 'Miljö i dealerfilmen' });
  assert.deepEqual(roomEnvironment({ dealers: [baked, baked] }, 'north'), { kind: 'baked', fixed: false, label: 'Miljön följer vald dealer' });
  assert.equal(roomEnvironment({ dealers: [baked, dealer()] }, 'north').fixed, false);
});

test('a missing or selectable default cannot be advertised as a fixed environment', () => {
  const source = dealer(); source.background.default = null;
  assert.equal(roomEnvironment({ dealers: [source] }, 'north').fixed, false);
  assert.equal(roomEnvironment({ dealers: [dealer([])] }, 'north').fixed, false);
  const disabled = dealer([]); disabled.background.enabled = false;
  assert.deepEqual(roomEnvironment({ dealers: [disabled] }, 'north'), {
    kind: 'variable', fixed: false, label: 'Bakgrund saknas för minst en dealer',
  });
});
