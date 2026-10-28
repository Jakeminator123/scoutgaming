import test from 'node:test';
import assert from 'node:assert/strict';
import { applyClipLabel, assignClipLabel, clipLabel } from '../lib/clip-label.mjs';
import { createSeedProject, validateProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { syntheticPresentationManifest } from '../../../test/fixtures/presentation-bank.mjs';

const manifest = syntheticPresentationManifest();

test('filmed variants keep their distinct original identities under the same situation',()=>{
  const names=['pos1','pos1-i','pos1-u','pos1-iu','pos1-v','pos1-iv'];
  const labels=names.map(label=>clipLabel({id:label,label,familyId:'paow/deal.player.left/box0',role:'alternative'}));
  assert.equal(new Set(labels).size,6);
  assert.ok(labels.every((label,i)=>label.endsWith(names[i])));
  assert.equal(clipLabel({id:'take',label:'pos1-iv',familyId:'paow/deal.player.left/box0'},{take:'Eget namn'}),'Eget namn');
});

function manifestClip(familyId, role) {
  const item = manifest.items.find(row => row.familyId === familyId && row.role === role);
  assert.ok(item, `${familyId} ${role}`);
  return { id: item.id, familyId: item.familyId, role: item.role, relativePath: item.relativePath };
}

test('eight manifest families get stable Swedish names and keep the clip id', () => {
  const cases = [
    ['astrid/deal.player.left/box0', 'variant', 'Ge kort · Spelarplats 1 · variant'],
    ['astrid/reveal.dealer/dealer-hole', 'standard', 'Vänd dolt kort · Dealer'],
    ['astrid/deal.dealer/dealer-up', 'standard', 'Ge öppet kort · Dealer'],
    ['astrid/deal.dealer/dealer-hole', 'standard', 'Ge dolt kort · Dealer'],
    ['astrid/deal.player.right/box6', 'standard', 'Ge kort · Spelarplats 7'],
    ['astrid/deal.player.centre/box2', 'variant', 'Ge kort · Spelarplats 3 · variant'],
    ['astrid/speak.goodluck/goodluck', 'standard', 'Lycka till'],
    ['astrid/speak.other/placebets', 'standard', 'Lägg insatser'],
    ['astrid/idle.ready/ready', 'variant', 'Variation'],
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
  assert.equal(clipLabel({ familyId: 'astrid/deal.player.left/box9', role: 'standard' }), 'Ge kort · spelare vänster · box9');
  assert.equal(clipLabel({ relativePath: 'deal/deal_flip/deal_flip.mp4' }), 'Vänd dolt kort · Dealer');
  assert.equal(clipLabel({ relativePath: 'deal/deal_pos1/variant/box_1_variant.mp4' }), 'Ge kort · Spelarplats 1 · variant');
  assert.equal(clipLabel({ relativePath: 'okand/mapp/fil.mp4', role: 'variant' }), 'fil.mp4 · variant');
  assert.equal(clipLabel({ id: 'bare-id' }), 'bare-id');
  assert.equal(clipLabel(null), 'Klipp');
  assert.equal(clipLabel({ id: 'bare-id', familyId: 'astrid/reveal.dealer/dealer-hole', role: 'standard' }, { 'bare-id': 'x'.repeat(81) }), 'Vänd dolt kort · Dealer');
  assert.equal(clipLabel({ id: 'bare-id', label: 'Arkivnamn' }), 'Arkivnamn');
  assert.equal(clipLabel({ id: 'bare-id', label: 'Arkivnamn' }, { 'bare-id': 'Eget' }), 'Eget');
  assert.equal(clipLabel({ id: 'bare-id', label: 'Arkivnamn', familyId: 'astrid/reveal.dealer/dealer-hole', role: 'standard' }), 'Vänd dolt kort · Dealer');
});

test('assignClipLabel stores a name, drops a blank override, and rejects text over 80', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const project = createSeedProject();
  const before = structuredClone(project);
  const named = applyClipLabel(project, id, 'Min tagning');
  assert.equal(named.clipLabels[id], 'Min tagning');
  assert.equal(Object.hasOwn(project, 'clipLabels'), false);
  assert.deepEqual(project, before);
  assert.equal(validateProject(named).clipLabels[id], 'Min tagning');
  const kept = applyClipLabel(named, id, 'x'.repeat(80));
  assert.equal(kept.clipLabels[id].length, 80);
  assert.equal(validateProject(kept).clipLabels[id].length, 80);
  const both = applyClipLabel(kept, other, 'Andra');
  const cleared = applyClipLabel(both, id, '   ');
  assert.equal(Object.hasOwn(cleared.clipLabels, id), false);
  assert.equal(cleared.clipLabels[other], 'Andra');
  assert.equal(kept.clipLabels[id].length, 80);
  const gone = applyClipLabel(cleared, other, '');
  assert.equal(Object.hasOwn(gone, 'clipLabels'), false);
  assert.throws(() => applyClipLabel(named, id, 'x'.repeat(81)), /clipLabels\..*: ska vara text med 1–80 tecken/);
  assert.equal(named.clipLabels[id], 'Min tagning');
  assert.throws(() => assignClipLabel(named.clipLabels, 'astrid/deal.player.left/box0', 'Namn'), /ogiltigt klipp-id/);
  assert.throws(() => applyClipLabel(named, id, 'rad\nbyte'), /ska vara text med 1–80 tecken/);
  const full = {};
  for (let index = 0; index < 2048; index += 1) full[`n${index}`] = 'Namn';
  const packed = createSeedProject();
  packed.clipLabels = full;
  assert.throws(() => applyClipLabel(packed, 'extra-id', 'Ny'), /högst 2048 namn/);
  assert.equal(applyClipLabel(packed, 'n0', 'Annat').clipLabels.n0, 'Annat');
  assert.equal(Object.keys(packed.clipLabels).length, 2048);
});
