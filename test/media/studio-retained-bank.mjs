import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {RETAINED_BANK_PROVENANCE,RETAINED_BANK_VARIANTS,createRetainedStudioMedia,validateStudioMedia} from '../../packages/studio-registry/server/document-contract.mjs';
import {prepareRetainedBankImport,verifyRetainedBankSourceManifest} from '../../ops/neon-studio/retained-bank.mjs';

test('retention is exactly six frozen original identities and fresh records with fixed provenance',()=>{
  assert.equal(RETAINED_BANK_VARIANTS.length,6);assert.ok(Object.isFrozen(RETAINED_BANK_VARIANTS));
  assert.ok(Object.isFrozen(RETAINED_BANK_PROVENANCE));
  for(const row of RETAINED_BANK_VARIANTS){
    assert.ok(Object.isFrozen(row));assert.equal(row.id.replaceAll('-',''),row.sha256.slice(0,32));assert.equal(row.role,'variant');
    const record=createRetainedStudioMedia(row.id);assert.deepEqual(validateStudioMedia(record),record);
    assert.equal(record.pathname,`croupier/media/dealers/astrid/runtime/retained-bank/${row.id}/${row.sha256}.mp4`);
    assert.equal(record.retainedBank.sourceManifestSha256,RETAINED_BANK_PROVENANCE.sourceManifestSha256);
    record.classification.label='local mutation';assert.notEqual(createRetainedStudioMedia(row.id).classification.label,record.classification.label);
  }
  assert.throws(()=>createRetainedStudioMedia(randomUUID()),error=>error.code==='studio_invalid_retained_media');
});

test('reserved originals cannot change hash, path, family, source receipt, role or classification, or shed retention',()=>{
  const record=createRetainedStudioMedia(RETAINED_BANK_VARIANTS[0].id);
  const changes=[value=>{value.sha256='f'.repeat(64);},value=>{value.size++;},value=>{value.id=randomUUID();},
    value=>{value.contentType='video/webm';},value=>{value.pathname=value.pathname.replace('runtime/retained-bank','review/uploads');},
    value=>{delete value.retainedBank;},value=>{value.retainedBank=false;},
    ...['sourceCommit','sourceManifestSha256','originalRelativePath','familyId','role'].map(field=>value=>{value.retainedBank[field]='forged';}),
    ...['dealerId','eventId','kind','role','situation','familyId','label','notes'].map(field=>value=>{value.classification[field]='forged';})];
  for(const change of changes){const copy=structuredClone(record);change(copy);assert.throws(()=>validateStudioMedia(copy),error=>error.code==='studio_invalid_retained_media');}
  const other=structuredClone(record);other.id=randomUUID();other.pathname=other.pathname.replace(record.id,other.id);
  assert.throws(()=>validateStudioMedia(other),error=>error.code==='studio_invalid_retained_media');
});

test('the same bytes uploaded with a fresh review identity confer no retained bank identity',()=>{
  const record=createRetainedStudioMedia(RETAINED_BANK_VARIANTS[0].id);delete record.retainedBank;
  record.id=randomUUID();record.pathname=`croupier/media/dealers/astrid/review/uploads/${record.id}/${record.sha256}.mp4`;
  assert.deepEqual(validateStudioMedia(record),record);assert.equal(record.retainedBank,undefined);
});

test('all six exact originals accept only boolean archive state and the common monotone tombstone contract',()=>{
  const requestedAt='2026-11-02T10:00:00.000Z',completedAt='2026-11-02T10:00:01.000Z';
  for(const original of RETAINED_BANK_VARIANTS){
    const record=createRetainedStudioMedia(original.id);
    for(const archived of [false,true]){
      const copy={...record,classification:{...record.classification,archived}};
      assert.deepEqual(validateStudioMedia(copy),copy);
    }
    const archived={...record,classification:{...record.classification,archived:true}};
    for(const deletion of [{state:'pending',requestedAt},{state:'deleted',requestedAt,completedAt}]){
      const copy={...archived,deletion};assert.deepEqual(validateStudioMedia(copy),copy);
      assert.throws(()=>validateStudioMedia({...copy,classification:record.classification}),{code:'studio_invalid_retained_media'});
      assert.throws(()=>validateStudioMedia({...copy,classification:{...record.classification,archived:false}}),{code:'studio_invalid_retained_media'});
    }
    for(const value of [null,0,1,'true'])assert.throws(()=>validateStudioMedia({...record,classification:{...record.classification,archived:value}}),{code:'studio_invalid_retained_media'});
    for(const deletion of [null,{},[],{state:'ready',requestedAt},{state:'pending',requestedAt,completedAt},
      {state:'pending',requestedAt:'2026-11-02'},{state:'pending',requestedAt:'invalid'},
      {state:'pending',requestedAt,extra:true},{state:'deleted',requestedAt},
      {state:'deleted',requestedAt,completedAt:'2026-11-02T09:59:59.000Z'}]){
      assert.throws(()=>validateStudioMedia({...archived,deletion}),{code:'studio_invalid_retained_media'});
    }
  }
});

test('source preparation rejects missing, substituted or malformed manifest bytes before reading originals',async()=>{
  let reads=0;
  for(const bytes of [undefined,Buffer.from('{}'),Buffer.from([255,254])]){
    assert.throws(()=>verifyRetainedBankSourceManifest(bytes),error=>error.code==='studio_retained_source_invalid');
    await assert.rejects(prepareRetainedBankImport({sourceManifestBytes:bytes,readOriginal:()=>{reads++;return Buffer.alloc(0);}}),error=>error.code==='studio_retained_source_invalid');
  }
  assert.equal(reads,0);
});
