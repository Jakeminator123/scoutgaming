import {resolveMediaAbsolutePath} from '../tools/media-layout.mjs';
const mediaUrl=(value,base)=>{const old=new URL(value,base),result=pathToFileURL(resolveMediaAbsolutePath(fileURLToPath(old)));if(old.pathname.endsWith('/')&&!result.pathname.endsWith('/'))result.pathname+='/';return result;};
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { clipMapping } from '../services/game/clip-mapping.mjs';
import { buildAssetsManifest } from '../services/game/partner-presentation.mjs';

const root = fileURLToPath(mediaUrl('../web/public/', import.meta.url));
const read = file => JSON.parse(readFileSync(mediaUrl(`../web/public/${file}`, import.meta.url)));

test('mapping keeps native speech and lists no V2 speech after its manifest left the tree', () => {
  const mapping = clipMapping({ root, revision: 'test' });
  assert.equal(mapping.version, 2);
  assert.equal(mapping.actualPlayback, false);
  assert.equal(mapping.revision, 'test');
  for (const dealer of ['vera', 'mei', 'amira', 'johanna']) {
    assert.equal(mapping.dealers[dealer], undefined, 'retired material must not synthesize a dealer');
    assert.throws(() => buildAssetsManifest(root, dealer), /unknown dealer/);
  }
  for (const dealer of ['astrid']) {
    // The V2 speech manifest (review/<dealer>-green-speak/speak.json) left with the presentation bank (2026-10-28).
    assert.deepEqual(mapping.dealers[dealer].greenSpeech, []);
    const speech = (mapping.dealers[dealer].engine ?? []).filter(row => row.kind === 'speech');
    if (speech.length) {
      const bank = read(`dealers/${dealer}/audio/en/bank.json`);
      for (const row of speech) {
        assert.equal(row.text, bank[row.line]?.text ?? null);
        assert.equal(row.route, `/?dealer=${dealer}`);
      }
    }
  }
  const native = mapping.dealers.astrid.nativeSpeech.find(row => row.line === 'win');
  assert.equal(native.text, read('speech-media.json').astrid.win.text);
  assert.equal(native.audioSource, 'embedded');
  assert.equal(typeof native.fileAvailable, 'boolean');
});

test('paused V2 dealing and explicit staged candidates are not playback claims', () => {
  const mapping = clipMapping({ root });
  // The V2 table takes (review/astrid-table-v2) were removed from the tree (ren start).
  assert.deepEqual(mapping.dealers.astrid.greenTakes, []);
  assert.equal(mapping.dealers.astrid.stagedTakes.length, 0);
  assert.equal(mapping.dealers.astrid.manifestStatus, null);
  for (const row of mapping.dealers.astrid.stagedTakes) {
    assert.equal(row.route, '/?dealer=astrid&performance=staged');
    assert.equal(row.candidate, true);
    assert.equal(row.actualPlayback, false);
  }
});
