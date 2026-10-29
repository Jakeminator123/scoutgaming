import {createStudioClient,roomChoicesPath} from './connected-studio.mjs';

const list=value=>Array.isArray(value)?value:[];
const unique=values=>[...new Set(values.filter(value=>typeof value==='string'&&value))];
const sort=values=>values.sort((a,b)=>a.label.localeCompare(b.label,'sv')||a.id.localeCompare(b.id));
const ref=(kind,id,label,relation='')=>({kind,id,label:label||id,relation});
const addRef=(rows,value)=>{if(!rows.some(row=>row.kind===value.kind&&row.id===value.id&&row.relation===value.relation))rows.push(value);};
export const resourceAnchor=(kind,id)=>'resource-'+kind+'-'+Array.from(id,char=>char.codePointAt(0).toString(16)).join('-');

function validLifecycle(value){
  return value&&typeof value.administrationRevision==='string'&&value.administrationRevision
    &&Array.isArray(value.operators)&&value.operators.every(row=>row&&typeof row.id==='string'&&typeof row.name==='string'
      &&typeof row.status==='string'&&(row.archivedAt===null||typeof row.archivedAt==='string'))
    &&Array.isArray(value.rooms)&&value.rooms.every(row=>row&&typeof row.id==='string'&&typeof row.operatorId==='string'
      &&typeof row.name==='string'&&typeof row.presentationLaneId==='string'&&(row.archivedAt===null||typeof row.archivedAt==='string'));
}
export function createResourceDeletionClient({workspaceClient=createStudioClient(),fetchImpl=fetch}={}){
  return {async load(signal){
    const lifecycle=fetchImpl('/studio/api/admin/resource-lifecycle',{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',
      headers:{accept:'application/json'},signal}).then(async response=>{
      if(!response.ok)throw Error('Bolagens och rummens arkiv kunde inte läsas.');
      const value=await response.json();
      if(!validLifecycle(value))throw Error('Arkivregistret gav ett ogiltigt svar.');
      return value;
    });
    const [workspaceResult,lifecycleResult]=await Promise.allSettled([workspaceClient.load(signal),lifecycle]);
    if(workspaceResult.status==='rejected')throw workspaceResult.reason;
    return buildResourceDeletionTree(workspaceResult.value,lifecycleResult.status==='fulfilled'?lifecycleResult.value:null);
  }};
}

// A view of exact references in current registries. No ownership is inferred
// from names or filenames, and absence here is never permission to delete.
export function buildResourceDeletionTree(workspace,lifecycle=null){
  const {catalog,project,inventory}=workspace;
  if(!project||catalog?.source!=='registered'||catalog.administration?.revisions?.project!==project.revision
    ||!Array.isArray(inventory?.videos))throw Error('Registren ändrades under läsningen. Uppdatera för att läsa samma revision.');
  const administration=catalog.administration;
  if(lifecycle){
    if(!validLifecycle(lifecycle)||lifecycle.administrationRevision!==administration.revisions.administration)
      throw Error('Rumsregistret ändrades under läsningen. Uppdatera för att läsa samma revision.');
    const published=new Map(administration.operators.map(row=>[row.id,row]));
    if(published.size!==lifecycle.operators.length||lifecycle.operators.some(row=>{
      const current=published.get(row.id);
      return !current||current.packageRevision!==row.packageRevision||current.status!==row.status||current.archivedAt!==row.archivedAt;
    }))throw Error('Bolagens publicering ändrades under läsningen. Uppdatera innan du granskar beroenden.');
  }
  const warnings=[],operators=new Map(),rooms=new Map(),compositions=new Map(),dealers=new Map(),materials=new Map(),media=new Map();
  const node=(id,label,archived=false,missing=false)=>({id,label:label||id,archived,missing,publishedOnly:false,uses:[]});
  for(const row of administration.operators)operators.set(row.id,{...node(row.id,row.name,Boolean(row.archivedAt)),status:row.status,roomIds:[]});
  for(const row of project.dealers)dealers.set(row.id,{...node(row.id,row.label),mediaIds:[]});
  for(const entry of list(project.dealerTrash))if(!dealers.has(entry.dealer.id))
    dealers.set(entry.dealer.id,{...node(entry.dealer.id,entry.dealer.label,true),mediaIds:[]});
  const ensureDealer=id=>{
    if(!dealers.has(id))dealers.set(id,{...node(id,id,false,true),mediaIds:[]});
    return dealers.get(id);
  };
  for(const row of list(project.layerAssets))materials.set(row.id,{...node(row.id,row.label),role:row.role,game:row.game||null,contentType:row.contentType||null});
  for(const {asset} of list(project.layerAssetTrash))if(!materials.has(asset.id))
    materials.set(asset.id,{...node(asset.id,asset.label,true),role:asset.role,game:asset.game||null,contentType:asset.contentType||null});
  const ensureMaterial=(id,role)=>{
    if(!materials.has(id))materials.set(id,{...node(id,id,false,true),role,game:null,contentType:null});
    return materials.get(id);
  };
  const ensureMedia=id=>{
    if(!media.has(id))media.set(id,{...node(id,id,false,true),kind:'video',ownerIds:[],primaryOwnerId:null,eventId:'',situation:'',game:null,available:false});
    return media.get(id);
  };
  for(const row of inventory.videos){
    const classification=row.classification??{},ownerIds=unique([classification.dealerId,row.dealer]);
    const value={...node(row.id,row.label||classification.label,Boolean(classification.archived)),
      kind:classification.mediaType==='image'||row.contentType?.startsWith('image/')?'image':classification.mediaType==='audio'||row.contentType?.startsWith('audio/')?'audio':'video',
      ownerIds,primaryOwnerId:ownerIds[0]??null,eventId:classification.eventId??row.eventId??row.suggestedEventId??'',situation:classification.situation??row.situation??'',
      game:classification.game??null,available:row.available===true&&row.integrity!=='unavailable'};
    media.set(row.id,value);
    for(const id of ownerIds)ensureDealer(id).mediaIds.push(row.id);
    if(ownerIds.length>1)warnings.push('Klippet '+value.label+' har motstridiga dealer-ID:n i registret.');
  }
  function addComposition(row,archived){
    if(compositions.has(row.id))return;
    const layers={};
    for(const role of ['background','dealer','table']){
      const layer=row.layers?.[role]??{};
      const ids=unique([...list(layer.allowed),layer.default]);
      layers[role]={enabled:layer.enabled===true,defaultId:layer.default||null,ids};
      for(const id of ids){
        const target=role==='dealer'?ensureDealer(id):ensureMaterial(id,role);
        addRef(target.uses,ref('composition',row.id,row.label,(archived?'Arkiverad':'Sparad')+' miljö · '+(layer.enabled?'tillåtet val':'inaktiverat lager')));
      }
    }
    // The miljöbild is the environment's picture, not a layer; it is still a use of that material.
    if(typeof row.illustration==='string')addRef(ensureMaterial(row.illustration,'illustration').uses,ref('composition',row.id,row.label,(archived?'Arkiverad':'Sparad')+' miljö · miljöbild'));
    compositions.set(row.id,{...node(row.id,row.label,archived),layers,publishedTo:null,historicalPackageReferences:null});
  }
  for(const row of list(project.lanes))addComposition(row,false);
  for(const entry of list(project.dealerTrash))for(const row of list(entry.compositions))addComposition(row,true);
  const lifecycleRooms=new Map(list(lifecycle?.rooms).map(row=>[row.id,row]));
  const sourceRooms=[...administration.rooms,...list(lifecycle?.rooms).filter(row=>!administration.rooms.some(current=>current.id===row.id))];
  for(const row of sourceRooms){
    const stored=lifecycleRooms.get(row.id),compositionId=row.compositionId??row.presentationLaneId??null;
    if(stored&&(stored.operatorId!==row.operatorId||stored.presentationLaneId!==compositionId))
      throw Error('Ett rum ändrades under läsningen. Uppdatera för att läsa samma revision.');
    const room={...node(row.id,row.name,Boolean(stored?.archivedAt||row.archivedAt||row.state==='archived')),
      // presentation-room-contract.mjs defines schema-v2 rooms without game as Blackjack.
      operatorId:row.operatorId,game:row.game??(row.schemaVersion===2||stored?.schemaVersion===2?'blackjack':null),compositionId,published:row.published===true,playable:row.playable===true,state:row.state||stored?.state||'',publication:null,
      publishedDealerIds:row.published?unique(row.dealerIds??list(row.dealers).map(dealer=>dealer.id)):[],choicesPath:null};
    rooms.set(room.id,room);
    const operator=operators.get(room.operatorId);
    if(operator)operator.roomIds.push(room.id);
    // The room's own choices use the existing room editor; archived or unowned rooms have none.
    room.choicesPath=room.archived?null:roomChoicesPath(administration.operators.find(current=>current.id===room.operatorId),{id:room.id,operatorId:room.operatorId,state:room.state,compositionId,game:room.game});
    if(compositionId){
      if(!compositions.has(compositionId))compositions.set(compositionId,{...node(compositionId,compositionId,false,true),layers:null,publishedTo:null,historicalPackageReferences:null});
      addRef(compositions.get(compositionId).uses,ref('room',room.id,room.label,room.archived?'Arkiverat rum':'Rummets sparade miljö'));
    }
    for(const id of room.publishedDealerIds)addRef(ensureDealer(id).uses,ref('room',room.id,room.label,'Publicerat dealerval'));
  }
  // The public catalog is produced by the real game selector from the frozen
  // package and resolved room overrides. Never replace these with draft defaults.
  for(const published of list(catalog.lobby?.catalogs)){
    const operator=administration.operators.find(row=>row.slug===published.operator?.slug);
    if(!operator||operator.packageRevision!==published.packageRevision)
      throw Error('Bolagets publicering ändrades under läsningen. Uppdatera trädet.');
    for(const source of list(published.rooms)){
      const room=rooms.get(source.id);
      if(!room||room.operatorId!==operator.id||room.compositionId!==source.presentation?.id
        ||room.game!==(source.game??'blackjack')||room.archived||!room.published)
        throw Error('Rummets publicerade val stämmer inte med rumsregistret. Uppdatera trädet.');
      const choices=[];
      for(const sourceDealer of list(source.dealers)){
        const dealer=ensureDealer(sourceDealer.id);
        if(dealer.missing){dealer.label=sourceDealer.label;dealer.missing=false;dealer.publishedOnly=true;}
        addRef(dealer.uses,ref('room',room.id,room.label,'Publicerat spelval'));
        const layers={};
        for(const role of ['background','table']){
          const layer=sourceDealer[role],allowed=list(layer?.allowed).map(asset=>({id:asset.id,label:asset.label}));
          layers[role]={enabled:layer?.enabled===true,defaultId:layer?.default??null,allowed,...role==='background'?{mode:layer?.mode??'baked'}:{}};
          for(const asset of allowed){
            const material=ensureMaterial(asset.id,role);
            if(material.missing){material.label=asset.label;material.missing=false;material.publishedOnly=true;}
            addRef(material.uses,ref('room',room.id,room.label,'Publicerat '+(role==='background'?'bakgrundsval':'bordsval')+' · '+sourceDealer.label));
          }
        }
        choices.push({id:sourceDealer.id,label:sourceDealer.label,independentLayers:sourceDealer.independentLayers===true,...layers});
      }
      room.publication={packageRevision:published.packageRevision,dealerDefault:source.dealerDefault,dealers:choices};
    }
  }
  const historyCoverage=lifecycle&&Array.isArray(lifecycle.presentations)&&['complete','incomplete'].includes(lifecycle.historyCoverage)
    ?lifecycle.historyCoverage:'unavailable';
  for(const presentation of list(lifecycle?.presentations)){
    const composition=compositions.get(presentation.id);
    if(!composition)continue;
    composition.publishedTo=list(presentation.publishedTo).map(row=>{
      if(!operators.has(row.id))operators.set(row.id,{...node(row.id,row.name,false,true),status:'unknown',roomIds:[]});
      return ref('operator',row.id,row.name,'Aktuellt publicerat paket');
    });
    const count=presentation.historicalPackageReferences;
    composition.historicalPackageReferences=historyCoverage==='complete'&&Number.isSafeInteger(count)&&count>=0?count:null;
  }
  if(historyCoverage==='incomplete')warnings.push('Miljöernas historiska paketreferenser kunde inte räknas fullständigt.');
  function useMedia(id,dealerId,relation){
    if(!id)return;
    const value=ensureMedia(id);
    if(dealerId){
      const dealer=ensureDealer(dealerId);
      addRef(value.uses,ref('dealer',dealerId,dealer.label,relation));
    }else addRef(value.uses,ref('project','saved','Gemensam projektinställning',relation));
  }
  function dealerReferences(dealer,lines,idlePolicy,archived=false){
    const label=(archived?'Arkiverat · ':'');
    for(const line of list(lines))for(const variant of list(line.variants))
      useMedia(variant.videoGenerationId,line.dealerId,label+'Klippval · '+line.eventId+' · '+(variant.label||variant.id));
    if(dealer?.speechProfile?.reference)useMedia(dealer.speechProfile.reference.videoId,dealer.id,label+'Referens för AI-tal');
    for(const base of list(idlePolicy?.base))useMedia(base.videoId,dealer?.id,label+'Grundloop');
    for(const variant of list(idlePolicy?.variants))useMedia(variant.videoId,dealer?.id,label+'Variant av grundloop');
  }
  for(const dealer of project.dealers)dealerReferences(dealer,project.lines.filter(row=>row.dealerId===dealer.id),
    list(project.dealerIdlePolicies).find(row=>row.dealerId===dealer.id)?.policy);
  for(const entry of list(project.dealerTrash))dealerReferences(entry.dealer,entry.lines,entry.idlePolicy,true);
  dealerReferences(null,[],project.idlePolicy);
  for(const family of list(project.mediaPolicy))for(const variant of list(family.variants))
    useMedia(variant.videoId,null,'Urvalsregel · '+family.familyId);
  for(const entry of list(project.dealerTrash)){
    for(const id of list(entry.activeMediaIds))useMedia(id,entry.dealer.id,'Arkiverad mediakoppling');
    for(const family of list(entry.mediaPolicy))for(const variant of list(family.variants))
      useMedia(variant.videoId,entry.dealer.id,'Arkiverad urvalsregel · '+family.familyId);
    for(const base of list(entry.globalIdlePolicy?.base))useMedia(base.videoId,entry.dealer.id,'Arkiverad gemensam grundloop');
    for(const variant of list(entry.globalIdlePolicy?.variants))useMedia(variant.videoId,entry.dealer.id,'Arkiverad gemensam grundloopvariant');
  }
  const all=[...operators.values(),...rooms.values(),...compositions.values(),...dealers.values(),...materials.values(),...media.values()];
  const missingCount=all.filter(row=>row.missing).length;
  if(missingCount)warnings.push(missingCount+' referenser saknar en egen post i de lästa registren.');
  return {readAt:catalog.readAt,projectRevision:project.revision,lifecycleAvailable:Boolean(lifecycle),historyCoverage,warnings,
    operators:sort([...operators.values()]),rooms:sort([...rooms.values()]),compositions:sort([...compositions.values()]),
    dealers:sort([...dealers.values()]),materials:sort([...materials.values()]),media:sort([...media.values()]),
    unownedRoomIds:[...rooms.values()].filter(row=>!operators.has(row.operatorId)).map(row=>row.id),
    coverage:[
      'Sparad miljö och publicerade spelval visas separat. Rummens egna förval ingår i publicerade spelval för spelbara rum. Pausade och arkiverade rums publicerade lagerval ingår inte.',
      'Miljöernas historiska paketreferenser visas som antal med täckningsstatus. Historiska paketens fullständiga filinnehåll ingår inte.',
      'Råa filer i Blob och statiska lobbybilder ingår inte i denna läsning. Äldre filbaserade klippbindningar ingår inte heller.',
      'Klippimporten tar för närvarande emot MP4 och WebM. Bord och bakgrundsbilder visas i materialbiblioteket.',
      'Inga synliga kopplingar betyder inte att ett objekt kan raderas permanent.',
    ]};
}
