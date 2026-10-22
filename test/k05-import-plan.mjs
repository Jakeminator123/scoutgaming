import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyRow, parseMatrix, gitPathFor, headFor, planRow, summarize, defaultOutputPath, KEVIN_HEAD, V1_HEAD, REPORTED_POST_FREEZE} from '../tools/k05-import-plan.mjs';

const SHA = 'a'.repeat(64), OTHER = 'b'.repeat(64), BLOB = 'c'.repeat(40), ID = '609fe7b4-bda6-49d1-9063-775fadecc41e';
const HEADER = ['kalla_sokvag', 'kalla_gitblob', 'bytes', 'sha256', 'k04_lika', 'kevin_dealer', 'k04_kalla', 'main_fack', 'kevin_variant', 'sprak', 'replik', 'urval',
  'registrerad_dealer', 'neon_media_id', 'neon_fack', 'fack_overens', 'katalog_logicalPath', 'blob_identitet', 'paket', 'projekt', 'status', 'acceptans', 'anmarkning'];
const row = (over = {}) => ({kalla_sokvag: 'media/dealers/dragge/v2/pos1.mp4', kalla_gitblob: BLOB, bytes: '1000', sha256: SHA, k04_lika: 'ja', kevin_dealer: 'dragge',
  k04_kalla: 'deal-tagning', main_fack: 'deal.player.left/box0', kevin_variant: 'bas', sprak: '', replik: '', urval: 'vald', registrerad_dealer: 'planerad',
  neon_media_id: 'saknas', neon_fack: '-', fack_overens: 'n.a.', katalog_logicalPath: 'planerad', blob_identitet: 'planerad', paket: 'inget paket', projekt: '-',
  status: 'ny-post-planerad', acceptans: 'ej accepterad (saknar registerpost)', anmarkning: '-', ...over});
const tsv = rows => [HEADER.join('\t'), ...rows.map(r => HEADER.map(k => r[k] ?? '').join('\t'))].join('\n') + '\n';

test('planerad rad utan registerpost blir ny; ett påhittat media-ID avvisas', () => {
  assert.deepEqual(classifyRow(row()).klass, 'ny');
  const forged = classifyRow(row({neon_media_id: ID}));
  assert.equal(forged.klass, 'avvisad'); assert.equal(forged.orsak, 'planerad_med_media_id');
});

test('befintlig identitet kräver exakt UUID och en Blob-sökväg som bär samma sha256; review/uploads kräver promotion', () => {
  const existing = classifyRow(row({status: 'befintlig-identitet', registrerad_dealer: 'dragan', neon_media_id: ID,
    blob_identitet: `croupier/media/dealers/dragan/review/uploads/${ID}/${SHA}.mp4`, paket: 'dragan-test@1-6'}));
  assert.equal(existing.klass, 'befintlig'); assert.equal(existing.mal.typ, 'neon-media'); assert.equal(existing.mal.mediaId, ID);
  assert.equal(existing.mal.kraverPromotion, true); assert.equal(existing.mal.paket, 'dragan-test@1-6');
  const runtime = classifyRow(row({status: 'befintlig-identitet', registrerad_dealer: 'dragan', neon_media_id: ID,
    blob_identitet: `croupier/media/dealers/dragan/runtime/presentation/${ID}/${SHA}.mp4`}));
  assert.equal(runtime.mal.kraverPromotion, false);
  // A Blob object with other bytes under the same id is not this row's identity.
  const mismatch = classifyRow(row({status: 'befintlig-identitet', neon_media_id: ID, blob_identitet: `croupier/media/dealers/dragan/review/uploads/${ID}/${OTHER}.mp4`}));
  assert.equal(mismatch.klass, 'avvisad'); assert.equal(mismatch.orsak, 'blobidentitet_saknar_hash');
  const catalog = classifyRow(row({kalla_sokvag: 'media/startbild.png', k04_kalla: 'still', status: 'befintlig-identitet', registrerad_dealer: '-',
    katalog_logicalPath: 'dealers/astrid/runtime/presentation/astrid_startbild_spel_1080x1920.png',
    blob_identitet: `croupier/media/dealers/astrid/runtime/presentation/eda87f9e-877b-00db-d2f0-2479db44ae5f/${SHA}.png`}));
  assert.equal(catalog.klass, 'befintlig'); assert.equal(catalog.mal.typ, 'katalog'); assert.equal(catalog.mal.mediaId, null);
  const bare = classifyRow(row({status: 'befintlig-identitet'}));
  assert.equal(bare.klass, 'avvisad'); assert.equal(bare.orsak, 'befintlig_utan_identitet');
});

test('bortvald V1, ej valda, uppskjutna och källbevis är aldrig import- eller identitetskandidater', () => {
  assert.deepEqual([classifyRow(row({urval: 'avvisad:V1 (c4818f51)', status: 'v1-avvisad'})).klass, classifyRow(row({urval: 'avvisad:V1 (c4818f51)'})).orsak], ['avvisad', 'v1_bortvald']);
  const notSelected = classifyRow(row({urval: 'ej-vald:sprak-utanfor-en/sv', status: 'ej-vald', sprak: 'pt'}));
  assert.equal(notSelected.klass, 'ej-vald'); assert.equal(notSelected.orsak, 'sprak-utanfor-en/sv'); assert.equal(notSelected.mal.typ, 'ingen');
  assert.equal(classifyRow(row({urval: 'uppskjuten:G13', status: 'uppskjuten'})).klass, 'uppskjuten');
  assert.equal(classifyRow(row({kalla_sokvag: 'public/dealers.js', urval: 'kallbevis:versionsbunden', status: 'kallbevis'})).klass, 'kallbevis');
  assert.equal(classifyRow(row({urval: 'kanske'})).orsak, 'okant_urval');
  assert.equal(classifyRow(row({status: 'andrad-hash'})).orsak, 'okand_status:andrad-hash');
});

test('källverifiering slår klassningen: saknad blob, ändrad hash eller ändrad storlek avvisar en vald rad', () => {
  const ok = {gitblob: 'ok', bytes: 'ok', sha256: 'ok'};
  assert.equal(classifyRow(row(), ok).klass, 'ny');
  assert.equal(classifyRow(row(), {...ok, gitblob: 'saknas'}).orsak, 'kallblob_saknas');
  assert.equal(classifyRow(row(), {...ok, gitblob: 'avviker'}).orsak, 'gitblob_avviker');
  assert.equal(classifyRow(row(), {...ok, sha256: 'avviker'}).orsak, 'sha256_avviker');
  assert.equal(classifyRow(row(), {...ok, bytes: 'avviker'}).orsak, 'bytes_avviker');
  // Name-alike path with other bytes: nothing in the classification looks at the name.
  const alike = classifyRow(row({kalla_sokvag: 'media/dealers/dragan/v2/pos1.mp4', sha256: OTHER}), {...ok, sha256: 'avviker'});
  assert.equal(alike.klass, 'avvisad');
});

test('ogiltiga matrisvärden avvisas före varje annan regel', () => {
  assert.equal(classifyRow(row({sha256: 'xyz'})).orsak, 'ogiltig_matrisrad');
  assert.equal(classifyRow(row({kalla_gitblob: '123'})).orsak, 'ogiltig_matrisrad');
  assert.equal(classifyRow(row({bytes: '0'})).orsak, 'ogiltig_matrisrad');
  assert.equal(classifyRow(null).orsak, 'ogiltig_matrisrad');
});

test('källvägar binds till den frysta källan: public/ under kevin/croupier-scoutgg/, V1-rader till c4818f51^', () => {
  assert.equal(gitPathFor('media/dealers/dragge/v2/pos1.mp4'), 'kevin/croupier-scoutgg/public/media/dealers/dragge/v2/pos1.mp4');
  assert.equal(gitPathFor('public/dealers.js'), 'kevin/croupier-scoutgg/public/dealers.js');
  assert.throws(() => gitPathFor('../x.mp4'));
  assert.equal(headFor(row()), KEVIN_HEAD);
  assert.equal(headFor(row({urval: 'avvisad:V1 (c4818f51)'})), V1_HEAD);
});

test('matrisen parsas med LF och CRLF, kräver kolumnerna och nekar dubblerade sökvägar', () => {
  const rows = parseMatrix(tsv([row(), row({kalla_sokvag: 'media/dealers/dragge/v2/pos2.mp4'})]).replace(/\n/g, '\r\n'));
  assert.equal(rows.length, 2); assert.equal(rows[1].kalla_sokvag, 'media/dealers/dragge/v2/pos2.mp4');
  assert.throws(() => parseMatrix(tsv([row(), row()])), /Dubblerad/);
  assert.throws(() => parseMatrix('kalla_sokvag\tsha256\nx\ty\n'), /saknar kolumnen/);
});

test('sammanräkningen räknar rader, unika bytes, promotion och rapporterade registreringar per klass', () => {
  const reportedPath = Object.keys(REPORTED_POST_FREEZE)[0];
  const planned = [
    planRow(row(), 0), planRow(row({kalla_sokvag: 'media/dealers/dragge/v2/pos1-u.mp4', kevin_variant: 'u'}), 1), // same bytes as pos1
    planRow(row({kalla_sokvag: 'media/dealers/dragge/v2/pos2.mp4', sha256: OTHER, status: 'befintlig-identitet', registrerad_dealer: 'dragan', neon_media_id: ID,
      blob_identitet: `croupier/media/dealers/dragan/review/uploads/${ID}/${OTHER}.mp4`}), 2),
    planRow(row({kalla_sokvag: reportedPath, k04_kalla: 'replik', main_fack: 'speak.other/dealerbust', sprak: 'sv', replik: 'dealerbust_1', sha256: 'd'.repeat(64), bytes: '500'}), 3),
    planRow(row({kalla_sokvag: 'media/dealers/dragge/green/flip.mp4', urval: 'avvisad:V1 (c4818f51)', status: 'v1-avvisad', sha256: 'e'.repeat(64)}), 4),
  ];
  const s = summarize(planned);
  assert.equal(s.rader, 5);
  assert.equal(s.perKlass.ny.rader, 3); assert.equal(s.perKlass.ny.unikaSha256, 2); assert.equal(s.perKlass.ny.unikaBytes, 1500);
  assert.equal(s.perKlass.befintlig.rader, 1); assert.equal(s.perKlass.avvisad.rader, 1);
  assert.equal(s.valda.rader, 4); assert.equal(s.valda.kraverPromotion, 1);
  assert.equal(s.bytedubbletter.sha256MedFleraRader, 1); assert.equal(s.bytedubbletter.raderSomDelarBytes, 2);
  assert.equal(s.rapporteradeEfterFrysning, 1);
  assert.equal(planned[3].rapporterad.mediaId, REPORTED_POST_FREEZE[reportedPath]);
  assert.equal(planned[4].head, V1_HEAD);
  assert.equal(planned[0].verifiering.sha256, 'ej-kontrollerad');
});

test('körresultatet hamnar som standard under det Git-ignorerade arkiv/<datum>/, aldrig i det spårade trädet', () => {
  const out = defaultOutputPath(new Date('2026-10-22T18:00:00Z'));
  assert.equal(out, 'arkiv/2026-10-22/migrering/kevin-ks-migrering/K05/importplan.json');
  assert.ok(!out.startsWith('migrering/'));
});
