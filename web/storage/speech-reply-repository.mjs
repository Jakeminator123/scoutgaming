import { canonicalStudioJson, validateStudioScope } from './studio-contract.mjs';
import { isDealerId } from '../dealer-identity.mjs';
import { validateReplyCategories } from '../public/speech-reply-library.mjs';
import { SpeechReplyLibraryError, validateSpeechReplyRecord } from '../speech-reply-library.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const fail=(code='reply_library_unavailable',status=503)=>{throw new SpeechReplyLibraryError(code,status);};
export function createSpeechReplyRepository({sql,scope:inputScope}={}) {
  const scope=Object.freeze(validateStudioScope(inputScope));
  const query=typeof sql==='function'?sql:typeof sql?.query==='function'?sql.query.bind(sql):null;
  if(!query)fail('reply_library_repository_required');
  const prefix=[scope.environment,scope.workspaceId];
  async function rows(statement,values=[]) {
    try { const result=await query(statement,[...prefix,...values]);const rows=Array.isArray(result)?result:result?.rows;if(!Array.isArray(rows))fail();return rows; }
    catch(error){if(error instanceof SpeechReplyLibraryError)throw error;fail();}
  }
  function identity(dealerId,id){if(!isDealerId(dealerId)||id!==undefined&&!UUID.test(id))fail('reply_library_invalid_identity',400);}
  function record(row,dealerId,id){
    if(!row||row.environment_id!==scope.environment||row.workspace_id!==scope.workspaceId||row.dealer_id!==dealerId||row.id!==id
      ||row.value?.dealerId!==dealerId||row.value?.id!==id||row.revision!==row.value?.revision)fail('reply_library_corrupt',409);
    return structuredClone(validateSpeechReplyRecord(row.value,scope));
  }
  const columns='environment_id,workspace_id,dealer_id,id,revision,value';
  async function read(dealerId,id){
    identity(dealerId,id);
    const found=await rows(`SELECT ${columns} FROM croupier_studio.speech_reply_records WHERE environment_id=$1 AND workspace_id=$2 AND dealer_id=$3 AND id=$4`,[dealerId,id]);
    if(found.length>1)fail('reply_library_corrupt',409);
    return found.length?record(found[0],dealerId,id):null;
  }
  async function insert(value){
    const valid=validateSpeechReplyRecord(value,scope);
    return rows(`INSERT INTO croupier_studio.speech_reply_records (environment_id,workspace_id,dealer_id,id,revision,value)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT (environment_id,workspace_id,dealer_id,id) DO NOTHING RETURNING ${columns}`,
    [valid.dealerId,valid.id,valid.revision,JSON.stringify(valid)]);
  }
  return Object.freeze({scope,read,
    async list({dealerId,category,cursor}={}) {
      identity(dealerId);if(category!==undefined)validateReplyCategories([category]);
      let after=null;
      if(cursor!==undefined){
        try{if(typeof cursor!=='string'||cursor.length>2048||!/^[A-Za-z0-9_-]+$/.test(cursor))throw Error();
          const decoded=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));
          if(!Array.isArray(decoded)||decoded.length!==5||decoded[0]!==scope.environment||decoded[1]!==scope.workspaceId||decoded[2]!==dealerId||decoded[3]!== (category??null)||!UUID.test(decoded[4]))throw Error();after=decoded[4];
        }catch{fail('reply_library_invalid_cursor',400);}
      }
      const found=await rows(`SELECT ${columns} FROM croupier_studio.speech_reply_records
        WHERE environment_id=$1 AND workspace_id=$2 AND dealer_id=$3 AND ($4::uuid IS NULL OR id>$4::uuid)
        AND ($5::text IS NULL OR value->'categories' ? $5::text) ORDER BY id LIMIT 51`,[dealerId,after,category??null]);
      if(found.length>51)fail();
      const values=found.slice(0,50).map(row=>record(row,dealerId,row.id));
      return {values,nextCursor:found.length>50?Buffer.from(JSON.stringify([...prefix,dealerId,category??null,values.at(-1).id])).toString('base64url'):null};
    },
    async create(value){
      if(value?.revision!==1)fail('reply_library_invalid_revision',400);
      const found=await insert(value);if(found.length!==1)fail('reply_library_revision_conflict',409);
      return record(found[0],value.dealerId,value.id);
    },
    async update(value,expectedRevision){
      const valid=validateSpeechReplyRecord(value,scope);
      if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1||valid.revision!==expectedRevision+1)fail('reply_library_invalid_revision',400);
      const found=await rows(`UPDATE croupier_studio.speech_reply_records SET value=$6::jsonb,revision=$5+1,updated_at=now()
        WHERE environment_id=$1 AND workspace_id=$2 AND dealer_id=$3 AND id=$4 AND revision=$5
        AND (value-'categories'-'revision')=($6::jsonb-'categories'-'revision') RETURNING ${columns}`,
      [valid.dealerId,valid.id,expectedRevision,JSON.stringify(valid)]);
      if(found.length!==1)fail('reply_library_revision_conflict',409);
      return record(found[0],valid.dealerId,valid.id);
    },
    // Migration only: retain the source revision and never overwrite an existing reply.
    async importValue(value){
      const valid=validateSpeechReplyRecord(value,scope),found=await insert(valid);
      const current=found.length?record(found[0],valid.dealerId,valid.id):await read(valid.dealerId,valid.id);
      if(canonicalStudioJson(current)!==canonicalStudioJson(valid))fail('reply_library_import_conflict',409);
      return {created:found.length===1,value:current};
    },
  });
}
