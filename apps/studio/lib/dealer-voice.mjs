import {validateProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {applyDealerVoiceProfile} from '../../../packages/presentation/contracts/dealer-voice-profile.mjs';
import {StudioStorageError,validateRevision} from '../../../packages/studio-registry/server/document-contract.mjs';

const fail=(code,status=409)=>{throw new StudioStorageError(code,status);};
// Admin › Dealers › Röst och tal: writes only dealers[].speechProfile.voice in
// the saved project document. Same journal as every project save:
// document_history keeps the previous value and audit_events gets
// save_document with the actor. No provider call, no publication.
export async function changeDealerVoice({repository,gamePolicy,mutationTransaction,stillAuthorized,body}){
  if(typeof mutationTransaction!=='function'||typeof repository?.readDocument!=='function')fail('studio_mutation_transaction_required',503);
  if(!body||Object.keys(body).sort().join(',')!=='dealerId,expectedRevision,voice'||typeof body.dealerId!=='string')fail('studio_invalid_request',400);
  validateRevision(body.expectedRevision);
  const before=await repository.readDocument('project');
  if(!before||before.revision!==body.expectedRevision)fail('studio_conflict');
  let next;
  try{next=validateProject(applyDealerVoiceProfile(before.value,body.dealerId,body.voice),{allowIncompatibleAnimations:true});}
  catch(error){fail(error?.code==='studio_dealer_missing'?'studio_dealer_missing':'studio_dealer_voice_invalid',error?.code==='studio_dealer_missing'?409:422);}
  return mutationTransaction(async()=>{
    const actor=await stillAuthorized();
    if(gamePolicy)return gamePolicy.projectStore({actor}).save(next,before.revision);
    return (await repository.saveDocument('project',{value:next,expectedRevision:before.revision,actor})).value;
  },{presentationMutation:{kind:'project',value:next}});
}
