import {assistantFailure as fail} from './assistant-model.mjs';
import {assistantServices} from './assistant-context.mjs';

export const ASSISTANT_SOURCES = ['dealers','materials','compositions','media','companies','rooms'];
export const ASSISTANT_PAGES = {studio:'/admin/clips',import:'/admin/clips?tool=import',materials:'/admin/assets',structure:'/admin/structure',operations:'/admin/drift',models:'/admin/ai/models',companies:'/admin/companies',audit:'/admin/companies'};
const scalar = value => typeof value === 'string' ? value.slice(0,500) : typeof value === 'boolean' || Number.isFinite(value) ? value : null;
const pick = (row, keys) => Object.fromEntries(keys.filter(key => row?.[key] !== undefined).map(key => [key, scalar(row[key])]));
export function validateAssistantRead(value) {
  if (!value || Object.keys(value).sort().join(',') !== 'offset,query,source' || !ASSISTANT_SOURCES.includes(value.source)
    || typeof value.query !== 'string' || value.query.length > 120 || !Number.isSafeInteger(value.offset) || value.offset < 0 || value.offset > 5000) fail('assistant_invalid_read');
  return value;
}
export function assistantNavigation(value) {
  if (value === null || value === undefined) return null;
  if (!value || Object.keys(value).sort().join(',') !== 'page,targetId' || !Object.hasOwn(ASSISTANT_PAGES,value.page)
    || value.targetId !== null && (typeof value.targetId !== 'string' || !/^[-a-zA-Z0-9._:]{1,100}$/.test(value.targetId))) fail('assistant_invalid_navigation');
  const labels = {studio:'Öppna Studio',import:'Ladda upp klipp',materials:'Öppna bord och bakgrunder',structure:'Öppna strukturen',operations:'Öppna drift',models:'Öppna agentmodeller',companies:'Öppna spelbolag',audit:'Öppna ändringsloggen'};
  let href = ASSISTANT_PAGES[value.page];
  if (value.targetId && ['studio','import'].includes(value.page)) href += (href.includes('?')?'&':'?') + 'dealer=' + encodeURIComponent(value.targetId);
  return {href,label:labels[value.page]};
}
export async function readAssistantData(runtime,request,input,{services=assistantServices(runtime)}={}) {
  const {source,query,offset} = validateAssistantRead(input);
  let rows, complete=true;
  if (source === 'media') {
    // Registry rows only; no Blob credentials, signed URLs, filesystem paths or bytes.
    const media = await runtime.repository.listMedia({limit:5000});
    complete = media.length < 5000;
    rows = media.map(row => ({...pick(row,['id','size','contentType','revision','createdAt','updatedAt']),
      ...pick(row.classification,['dealerId','eventId','situation','kind','role','label','notes','archived','mediaType','familyId']),
      retained: Boolean(row.retainedBank), deletionPending: Boolean(row.deletion),
    }));
  } else if (source === 'companies' || source === 'rooms') {
    const saved = await services.admin(request,'resource-lifecycle');
    rows = (source === 'companies' ? saved.operators : saved.rooms).map(row => pick(row,source==='companies'
      ? ['id','slug','name','status','roomCount','archivedRoomCount','packageRevision','archivedAt']
      : ['id','name','operatorId','state','presentationLaneId','packageRevision','archivedAt','canArchive','canRestore']));
  } else {
    const saved = await runtime.repository.readDocument('project');
    if (!saved) fail('assistant_dependency_unavailable',503);
    const p=saved.value;
    if(source==='dealers') rows=[...(p.dealers??[]).map(row=>({...row,archived:false})),...(p.dealerTrash??[]).map(row=>({...row.dealer,archived:true}))]
      .map(row=>({...pick(row,['id','label','archived']),speechEnabled:row.speechProfile?.state==='enabled',
        bindingsSummary:true,clipBindings:(p.lines??[]).filter(line=>line.dealerId===row.id).map(line=>({eventId:scalar(line.eventId),clips:(line.variants??[]).filter(v=>v.videoGenerationId).slice(0,20).map(v=>({id:scalar(v.id),mediaId:scalar(v.videoGenerationId)}))})).slice(0,100)}));
    if(source==='materials') rows=[...(p.layerAssets??[]).map(row=>({...row,archived:false})),...(p.layerAssetTrash??[]).map(row=>({...row.asset,archived:true}))]
      .map(row=>pick(row,['id','label','role','archived','mediaId','width','height']));
    if(source==='compositions') rows=(p.lanes??[]).map(row=>({...pick(row,['id','label']),dealerIds:(row.dealers??[]).map(id=>typeof id==='string'?id:scalar(id.id)).slice(0,40)}));
  }
  const search=query.trim().toLocaleLowerCase('sv');
  const matches=rows.filter(row=>!search || JSON.stringify(row).toLocaleLowerCase('sv').includes(search)).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const items=[];let size=0;
  for(const row of matches.slice(offset,offset+40)) {const length=JSON.stringify(row).length;if(items.length&&size+length>60000)break;items.push(row);size+=length;}
  return {source,query,offset,items,total:matches.length,complete,nextOffset:offset+items.length<matches.length?offset+items.length:null,
    observedAt:new Date().toISOString(),notice:complete?'Lästa sparade registerposter.':'Endast de första 5000 filposterna kunde sökas; påstå inte att en sak saknas utanför urvalet.'};
}
