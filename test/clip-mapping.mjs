import {resolveMediaAbsolutePath} from '../tools/media-layout.mjs';
const mediaUrl=(value,base)=>{const old=new URL(value,base),result=pathToFileURL(resolveMediaAbsolutePath(fileURLToPath(old)));if(old.pathname.endsWith('/')&&!result.pathname.endsWith('/'))result.pathname+='/';return result;};
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { clipMapping } from '../web/clip-mapping.mjs';
import { buildAssetsManifest } from '../web/partner-presentation.mjs';

const root = fileURLToPath(mediaUrl('../web/public/', import.meta.url));
const read = file => JSON.parse(readFileSync(mediaUrl(`../web/public/${file}`, import.meta.url)));

test('mapping preserves original and V2 speech as distinct exact media sets', () => {
  const mapping = clipMapping({ root, revision: 'test' });
  assert.equal(mapping.version, 2);
  assert.equal(mapping.actualPlayback, false);
  assert.equal(mapping.revision, 'test');
  for (const dealer of ['vera', 'mei', 'amira', 'johanna']) {
    assert.equal(mapping.dealers[dealer], undefined, 'retired material must not synthesize a dealer');
    assert.throws(() => buildAssetsManifest(root, dealer), /unknown dealer/);
  }
  for (const dealer of ['astrid']) {
    const manifest = read(`review/${dealer}-green-speak/speak.json`);
    const rows = mapping.dealers[dealer].greenSpeech;
    assert.equal(rows.length, Object.keys(manifest.lines).length);
    for (const row of rows) {
      const line = manifest.lines[row.line];
      assert.equal(row.text, line.text);
      assert.equal(row.file, line.media.src);
      assert.equal(row.sha256, line.media.sha256);
      assert.equal(row.audio, line.audio);
      assert.equal(row.audioSha256, line.audioSha256);
      assert.equal(row.audioDelayMs, line.audioOffsetSeconds * 1000);
      assert.equal(row.route, `/v2/?dealer=${dealer}`);
      assert.equal(row.status, manifest.status);
      assert.equal(row.actualPlayback, false);
    }
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
  const green = mapping.dealers.astrid.greenSpeech.find(row => row.line === 'win');
  assert.equal(native.text, read('speech-media.json').astrid.win.text);
  assert.notEqual(native.text, green.text, 'different recordings must not share an invented caption');
  assert.equal(native.audioSource, 'embedded');
  assert.equal(typeof native.fileAvailable, 'boolean');
});

test('paused V2 dealing and explicit staged candidates are not playback claims', () => {
  const mapping = clipMapping({ root });
  assert.ok(mapping.dealers.astrid.greenTakes.length > 0);
  for (const row of mapping.dealers.astrid.greenTakes) {
    assert.equal(row.active, false);
    assert.equal(row.paused, true);
    assert.equal(row.route, '/v2/?dealer=astrid');
    assert.equal(row.actualPlayback, false);
  }
  assert.equal(mapping.dealers.astrid.stagedTakes.length, 0);
  assert.equal(mapping.dealers.astrid.manifestStatus, null);
  for (const row of mapping.dealers.astrid.stagedTakes) {
    assert.equal(row.route, '/?dealer=astrid&performance=staged');
    assert.equal(row.candidate, true);
    assert.equal(row.actualPlayback, false);
  }
});

test('BO choices expose consumer limits, rejection and review annotations', () => {
  const clipLandings = { selected: { part: 'box4', note: 'human annotation' } };
  const genLandings = { generation: { part: 'idle', note: 'candidate' } };
  const mapping = clipMapping({ root, bo: {
    clipAssignments: {
      astrid: { box4: { clip: 'selected' }, return: { clip: 'return-candidate' }, idle: { clip: 'astrid:idle-1/idle/idle' } },
      amira: { box1: { clip: 'stored-only' } },
    },
    neverAgain: { selected: { reason: 'rejected' } }, clipLandings, genLandings,
  } });
  const astrid = mapping.backofficePicks.astrid;
  assert.equal(astrid['show.deal.box4'].route, null);
  assert.equal(astrid['show.deal.box4'].formerRoute, '/?dealer=astrid&performance=staged');
  assert.equal(astrid['show.deal.box4'].consumed, false);
  assert.equal(astrid['show.deal.box4'].excluded, true);
  assert.equal(astrid['show.return'].consumed, false);
  assert.equal(astrid['show.return'].route, null);
  assert.equal(astrid['show.idle'].route, null);
  assert.equal(astrid['show.idle'].formerRoute, '/?dealer=astrid');
  assert.equal(mapping.clipControl.source, 'lab/project.json');
  assert.equal(mapping.backofficePicks.amira['show.deal.box1'].consumed, false);
  assert.deepEqual(mapping.clipLandings, clipLandings);
  assert.deepEqual(mapping.genLandings, genLandings);
});
