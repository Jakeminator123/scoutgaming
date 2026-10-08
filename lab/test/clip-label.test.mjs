import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clipLabel } from '../lib/clip-label.mjs';

const manifest = JSON.parse(readFileSync(new URL('../../media/dealers/astrid/runtime/presentation/lab-video-manifest.json', import.meta.url), 'utf8'));

function manifestClip(familyId, role) {
  const item = manifest.items.find(row => row.familyId === familyId && row.role === role);
  assert.ok(item, `${familyId} ${role}`);
  return { id: item.id, familyId: item.familyId, role: item.role, relativePath: item.relativePath };
}

test('eight manifest families get stable Swedish names and keep the clip id', () => {
  const cases = [
    ['astrid/deal.player.left/box0', 'variant', 'Deal · spelare vänster · box 1 · variant'],
    ['astrid/reveal.dealer/dealer-hole', 'standard', 'Reveal · dealerns hålkort'],
    ['astrid/deal.dealer/dealer-up', 'standard', 'Deal · dealerns öppna kort'],
    ['astrid/deal.dealer/dealer-hole', 'standard', 'Deal · dealerns hålkort'],
    ['astrid/deal.player.right/box6', 'standard', 'Deal · spelare höger · box 7'],
    ['astrid/deal.player.centre/box2', 'variant', 'Deal · spelare mitten · box 3 · variant'],
    ['astrid/speak.goodluck/goodluck', 'standard', 'Tal · lycka till'],
    ['astrid/speak.other/placebets', 'standard', 'Tal · lägg insatser'],
    ['astrid/idle.ready/ready', 'variant', 'Idle · redo · variant'],
  ];
  for (const [familyId, role, expected] of cases) {
    const clip = manifestClip(familyId, role);
    assert.equal(clipLabel(clip), expected);
    assert.equal(clipLabel(clip), clipLabel({ ...clip }));
    assert.notEqual(expected, clip.id);
    assert.equal(clipLabel(clip, { [clip.id]: 'Eget namn' }), 'Eget namn');
  }
});

test('unknown tokens stay visible, path is only a fallback, and the label is never empty', () => {
  assert.equal(clipLabel({ familyId: 'astrid/wave.hand/hello', role: 'standard' }), 'wave · hand · hello');
  assert.equal(clipLabel({ familyId: 'astrid/deal.player.left/box9', role: 'standard' }), 'Deal · spelare vänster · box9');
  assert.equal(clipLabel({ relativePath: 'deal/deal_flip/deal_flip.mp4' }), 'Reveal · dealerns hålkort');
  assert.equal(clipLabel({ relativePath: 'deal/deal_pos1/variant/box_1_variant.mp4' }), 'Deal · spelare vänster · box 1 · variant');
  assert.equal(clipLabel({ relativePath: 'okand/mapp/fil.mp4', role: 'variant' }), 'fil.mp4 · variant');
  assert.equal(clipLabel({ id: 'bare-id' }), 'bare-id');
  assert.equal(clipLabel(null), 'Klipp');
  assert.equal(clipLabel({ id: 'bare-id', familyId: 'astrid/reveal.dealer/dealer-hole', role: 'standard' }, { 'bare-id': 'x'.repeat(81) }), 'Reveal · dealerns hålkort');
});
