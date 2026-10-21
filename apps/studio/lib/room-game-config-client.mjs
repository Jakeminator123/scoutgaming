import { labUrl } from './lab-url.mjs';

const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const revision = id;
const equal = (a,b) => a?.language === b?.language && a?.limitPreset === b?.limitPreset;
export const ROOM_GAME_DEFAULTS = Object.freeze({ language: 'en', limitPreset: 'prive' });
export function validRoomGameConfig(value) {
  return object(value) && Object.keys(value).length === 2 && ['en','sv'].includes(value.language) && ['casual','prive','high'].includes(value.limitPreset);
}
export class RoomGameConfigError extends Error {
  constructor(message, status=0) { super(message); this.status=status; this.name='RoomGameConfigError'; }
}
function receipt(value, context) {
  if (!object(value) || value.ok !== true || value.operatorId !== context.operatorId || value.roomId !== context.roomId
    || !id(value.administrationRevision) || !Number.isSafeInteger(value.packageRevision) || value.packageRevision < 1
    || !(value.draft === null || object(value.draft) && revision(value.draft.revision) && validRoomGameConfig(value.draft.gameConfig))
    || !(value.published === null || object(value.published) && revision(value.published.configVersion)
      && Number.isSafeInteger(value.published.packageRevision) && value.published.packageRevision > 0
      && validRoomGameConfig(value.published.gameConfig) && value.published.betMs === 20000 && value.published.actionMs === 15000)
    || !object(value.publication) || typeof value.publication.ready !== 'boolean') throw new RoomGameConfigError('Serverns kvitto stämmer inte med spelrummet. Läs in aktuella uppgifter.');
  return value;
}
export function createRoomGameConfigClient({fetchImpl=fetch}={}) {
  async function send(context, body, signal) {
    if (!id(context?.roomId) || !id(context?.operatorId)) throw new RoomGameConfigError('Välj ett registrerat spelrum.');
    const endpoint = labUrl('/api/admin/room-game-config');
    const url = body ? endpoint : endpoint+'?'+new URLSearchParams(context);
    let response;
    try { response = await fetchImpl(url, {method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal,
      headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}); }
    catch(error) { if(signal?.aborted)throw error; throw new RoomGameConfigError('Svaret kunde inte bekräftas. Läs in aktuella uppgifter innan du försöker igen.'); }
    if (!response.ok) throw new RoomGameConfigError(({401:'Logga in igen för att fortsätta.',403:'Du saknar åtkomst till spelrummet.',
      404:'Spelinställningarna är inte tillgängliga för det här rummet.',409:'Uppgifterna har ändrats. Läs in aktuella uppgifter; dina fält finns kvar.',
      422:'Valen kan inte publiceras. Kontrollera språk, insatsprofil och rummets inspelade material.',503:'Spelinställningarna är tillfälligt otillgängliga.'})[response.status] || 'Åtgärden kunde inte bekräftas.',response.status);
    let value; try {value=await response.json();}catch {throw new RoomGameConfigError('Serverns kvitto kunde inte läsas. Läs in aktuella uppgifter.');}
    return receipt(value,context);
  }
  return {
    read(context,{signal}={}) { return send(context,null,signal); },
    async save(context, previous, gameConfig, {signal}={}) {
      if(!validRoomGameConfig(gameConfig))throw new RoomGameConfigError('Välj ett giltigt språk och en insatsprofil.',422);
      const next=await send(context,{action:'save-draft',...context,expectedAdministrationRevision:previous.administrationRevision,
        expectedPackageRevision:previous.packageRevision,gameConfig},signal);
      if(!next.draft || !equal(next.draft.gameConfig,gameConfig) || next.packageRevision!==previous.packageRevision
        || next.administrationRevision===previous.administrationRevision)throw new RoomGameConfigError('Sparandet kunde inte verifieras. Läs in aktuella uppgifter.');
      return next;
    },
    async publish(context, previous,{signal}={}) {
      if(!previous.draft || !previous.publication.ready)throw new RoomGameConfigError('Spara ett giltigt utkast innan du publicerar.',409);
      const next=await send(context,{action:'publish',...context,expectedAdministrationRevision:previous.administrationRevision,
        expectedPackageRevision:previous.packageRevision,expectedDraftRevision:previous.draft.revision},signal);
      if(next.draft!==null || !next.published || !equal(next.published.gameConfig,previous.draft.gameConfig)
        || next.packageRevision!==previous.packageRevision+1 || next.published.packageRevision!==next.packageRevision
        || next.published.configVersion===previous.published?.configVersion)throw new RoomGameConfigError('Publiceringen kunde inte verifieras. Läs in aktuella uppgifter.');
      return next;
    },
  };
}
export function createRoomGameConfigController({client=createRoomGameConfigClient()}={}) {
  let state={context:null,receipt:null,fields:{...ROOM_GAME_DEFAULTS},busy:false,stale:true,message:'',error:''};
  let serial=0,abort=null,active=false; const listeners=new Set();
  const update=patch=>{state={...state,...patch};for(const notify of listeners)notify();};
  const dirty=()=>!equal(state.fields,state.receipt?.draft?.gameConfig ?? state.receipt?.published?.gameConfig ?? ROOM_GAME_DEFAULTS);
  async function run(action, preserveFields=false) {
    if(!state.context || state.busy)return null;
    const seq=++serial; abort?.abort(); abort=new AbortController();
    const context=state.context,previous=state.receipt,fields={...state.fields};
    update({busy:true,error:'',message:''});
    try {
      const next=action==='read'?await client.read(context,{signal:abort.signal}):action==='save'?await client.save(context,previous,fields,{signal:abort.signal}):await client.publish(context,previous,{signal:abort.signal});
      if(seq!==serial || !active)return null;
      update({receipt:next,fields:preserveFields?fields:{...(next.draft?.gameConfig ?? next.published?.gameConfig ?? ROOM_GAME_DEFAULTS)},stale:false,
        message:action==='save'?'Utkastet är sparat.':action==='publish'?'Spelinställningarna är publicerade. Nya insatsfönster använder den nya versionen.':''});
      return next;
    } catch(error) {if(seq===serial && active)update({stale:true,error:error.message||'Uppgifterna kunde inte hämtas.',...([401,403].includes(error.status)?{receipt:null,fields:{...ROOM_GAME_DEFAULTS}}:{})});return null;}
    finally {if(seq===serial && active)update({busy:false});}
  }
  return {
    getSnapshot:()=>state,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    configure(context) { ++serial;abort?.abort();active=true;update({context,receipt:null,fields:{...ROOM_GAME_DEFAULTS},busy:false,stale:true,error:'',message:''});return run('read');},
    cancel(){active=false;++serial;abort?.abort();},
    edit(field,value){if(state.busy || !['language','limitPreset'].includes(field))return;const fields={...state.fields,[field]:value};if(validRoomGameConfig(fields))update({fields,message:''});},
    refresh(){return run('read',true);},dirty,
    save(){return state.receipt&&!state.stale?run('save'):Promise.resolve(null);},
    publish(){return state.receipt?.draft&&!state.stale&&!dirty()&&state.receipt.publication.ready?run('publish'):Promise.resolve(null);},
  };
}
