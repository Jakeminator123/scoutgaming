'use client';
import {useEffect,useRef,useState} from 'react';
import {labUrl} from '../lib/lab-url.mjs';
import {compositionLabel} from '../lib/control-flow.mjs';
import {createStudioPreview} from '../lib/studio-preview-client.mjs';
import {clipLabel} from '../lib/clip-label.mjs';
import {validateProject,type StudioProject,type StudioLane} from '../lib/studio-model.mjs';
import {registerCompositionLayer} from '../lib/studio-composition.mjs';
import {defaultCompositionSettings} from '../../web/public/composition-settings.mjs';
import {layerAssetFitsGame} from '../../web/layer-asset-contract.mjs';
import {StudioNavigation} from './studio-navigation';
import {PageTemplate} from './page-template.mjs';
import {useStudioProjectSession} from './studio-session';
import {LayerAssetSelect} from './layer-selectors';
import {LayerLibrary} from './layer-library';
import {LayerAssetManager} from './layer-asset-manager';
import {BackgroundPlaybackEditor} from './background-playback-editor';
import {BlackjackTableGeometryEditor} from './blackjack-table-geometry-editor';
import {CompositionMetadata,CompositionSettings} from './lane-editor';
import {ProjectConflict} from './project-conflict';
import {CompositionPreview,type CompositionMedia,type VideoCompositing} from './composition-preview';
import {activeStudioDealers,studioHref,type VideoInventory,type ConnectionStatus} from './studio-types';
import styles from './control-preview-page.module.css';

type Role='dealer'|'table'|'background';
const roles:Role[]=['dealer','table','background'];
const labels={dealer:'Dealer',table:'Bord',background:'Bakgrund'};
const defaultKey:VideoCompositing={mode:'green-screen',threshold:0.23,softness:0.15,despill:0};

export function initialCompositionLaneId(project:StudioProject,laneId?:string,dealerId?:string) {
  const lanes=project.lanes??[];
  return lanes.find(row=>row.id===laneId)?.id
    ??lanes.find(row=>row.layers.dealer.default===dealerId)?.id
    ??lanes.find(row=>row.layers.dealer.allowed.includes(dealerId??''))?.id
    ??lanes[0]?.id??'';
}

export function ControlPreviewPage({initialProject,initialVideos,initialStatus,initialLaneId,initialDealerId,initialOperatorId,initialGame='blackjack'}:{initialProject:StudioProject;initialVideos:VideoInventory;initialStatus:ConnectionStatus;initialLaneId?:string;initialDealerId?:string;initialOperatorId?:string;initialGame?:'blackjack'|'roulette'}) {
  const session=useStudioProjectSession({initialProject,initialVideos,initialStatus});
  const {project,projectRef,videos,modelEdit:sessionEdit,dirty,saving,save,error,notice,savedJson,setSavedJson,setProject,setConflict,setError,setNotice,conflict}=session;
  const [laneId,setLaneId]=useState(()=>initialCompositionLaneId(project,initialLaneId,initialDealerId)),[clipId,setClipId]=useState('');
  const [game,setGame]=useState<'blackjack'|'roulette'>(initialGame);
  const [layout,setLayout]=useState<'mobile'|'desktop'>('mobile'),[uploading,setUploading]=useState(false),[continueHref,setContinueHref]=useState('');
  const [localMedia,setLocalMedia]=useState<Partial<Record<Role,CompositionMedia>>>({}),[localError,setLocalError]=useState('');
  const [previewBusy,setPreviewBusy]=useState(false),[previewError,setPreviewError]=useState('');
  const [previewBackgroundRuleId,setPreviewBackgroundRuleId]=useState<string>(),[previewBackgroundRequest,setPreviewBackgroundRequest]=useState(0);
  const previewAttempt=useRef<AbortController|null>(null);
  const modelEdit:typeof sessionEdit=change=>{if(!previewAttempt.current)sessionEdit(change);};
  const [activeRole,setActiveRole]=useState<Role>('dealer');
  const [labMode,setLabMode]=useState(false);
  const layerTabs=useRef<Partial<Record<Role,HTMLButtonElement>>>({});
  const objectUrls=useRef<Partial<Record<Role,string>>>({}),savedBaseline=useRef(savedJson),continuing=useRef(false),uploadLock=useRef(false),uploads=useRef(new Set<string>());
  savedBaseline.current=savedJson;
  const lanes=project.lanes??[];
  const lane=lanes.find(row=>row.id===laneId)??lanes[0]??{id:'',label:'',renderer:'layered',dealers:[],layers:{background:{enabled:false,mode:'baked',default:null,allowed:[]},table:{enabled:false,default:null,allowed:[]},dealer:{enabled:false,default:'',allowed:[]}},openclaw:{idle:'off',deal:'off',reveal:'off',speak:'off',probe:'off'},operatorAdjustable:[]} as StudioLane;
  const backgroundAssets=(project.layerAssets??[]).filter(asset=>asset.role==='background'&&lane.layers.background.allowed.includes(asset.id)).map(asset=>({id:asset.id,url:labUrl(`/api/layer-assets/${asset.id}`),label:asset.label,contentType:asset.contentType}));
  const dealers=activeStudioDealers(project);
  const contentDealer=dealers.find(row=>row.id===initialDealerId);
  const startDealer=dealers.find(row=>row.id===lane.layers.dealer.default);
  const navigationDealer=initialDealerId?contentDealer:startDealer;
  const invalidDealerIds=[...new Set([lane.layers.dealer.default,...lane.dealers,...lane.layers.dealer.allowed])].filter(id=>!dealers.some(row=>row.id===id));
  const invalidDealerLabel=(id:string)=>project.dealers.find(row=>row.id===id)?.label??id;
  const invalidDealerSelection=!startDealer||invalidDealerIds.length>0;
  const clips=videos.videos.filter(video=>Boolean(startDealer)&&video.available&&!video.classification?.archived
    &&(game==='roulette'?video.classification?.game==='roulette'&&video.classification.dealerId===lane.layers.dealer.default
      :video.classification?.game!=='roulette'&&(video.dealer===lane.layers.dealer.default||video.classification?.dealerId===lane.layers.dealer.default)));
  const idleFamily=videos.families?.find(row=>row.dealerId===lane.layers.dealer.default&&row.playbackType==='idle-pool');
  const idleIds=idleFamily&&project.idlePolicy?.familyId===idleFamily.id?project.idlePolicy.base.map(row=>row.videoId):idleFamily?.standardIds??[];
  const idleClip=game==='roulette'?clips.find(row=>row.id===startDealer?.rouletteIdle?.videoId)
    :idleIds.map(id=>clips.find(row=>row.id===id)).find(Boolean)
      ??clips.find(row=>row.classification?.eventId==='idle.ready'&&(row.classification.role==='standard'||row.role==='standard'));
  const clip=clips.find(video=>video.id===clipId)??idleClip??clips[0];
  const clipName=(video:typeof clips[number])=>clipLabel({id:video.id,label:video.label,familyId:video.familyId,role:video.role,relativePath:video.relativePath},project.clipLabels);
  const settings=lane.composition??defaultCompositionSettings();
  const temporary=Object.keys(localMedia).length>0;
  const hasSavedLane=Boolean(project.lanes?.some(row=>row.id===lane.id));
  const previewContext=useRef({laneId:lane.id,revision:project.revision,dirty,saving,conflict,temporary});
  previewContext.current={laneId:lane.id,revision:project.revision,dirty,saving,conflict,temporary};
  const previewBlocked=game==='roulette'||dirty||saving||uploading||conflict||temporary||!hasSavedLane||invalidDealerSelection||previewBusy;
  useEffect(()=>()=>{Object.values(objectUrls.current).forEach(url=>URL.revokeObjectURL(url));},[]);
  useEffect(()=>{
    if(!continueHref||dirty||saving||uploading||conflict||temporary)return;
    window.location.assign(continueHref);
  },[continueHref,dirty,saving,uploading,conflict,temporary]);
  useEffect(()=>{
    const guard=(event:BeforeUnloadEvent)=>{if(uploading||temporary){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);
  },[uploading,temporary]);
  useEffect(()=>()=>{previewAttempt.current?.abort();previewAttempt.current=null;},[]);
  useEffect(()=>{setPreviewBackgroundRuleId(undefined);setPreviewBackgroundRequest(0);},[lane.id]);
  async function startPreview(){
    if(previewBlocked||previewAttempt.current||continuing.current||uploadLock.current||projectRef.current!==project)return;
    const controller=new AbortController(),snapshot=projectRef.current,requestedLane=lane.id,revision=project.revision;
    previewAttempt.current=controller;setPreviewBusy(true);setPreviewError('');
    try {
      const result=await createStudioPreview({presentationLaneId:requestedLane,expectedProjectRevision:revision},{signal:controller.signal});
      const current=previewContext.current;
      if(controller.signal.aborted||previewAttempt.current!==controller)return;
      if(projectRef.current!==snapshot||current.laneId!==requestedLane||current.revision!==revision||current.dirty||current.saving||current.conflict||current.temporary||uploadLock.current){
        setPreviewError('Sammansättningen har ändrats. Spara och starta provspelningen igen.');return;
      }
      window.location.assign(result.entryUrl);
    } catch(cause) {
      if(!controller.signal.aborted&&previewAttempt.current===controller)setPreviewError(cause instanceof Error?cause.message:'Provspelningen kunde inte startas. Försök igen.');
    } finally {
      if(previewAttempt.current===controller){previewAttempt.current=null;setPreviewBusy(false);}
    }
  }
  function markUpload(role:Role,busy:boolean){if(busy)uploads.current.add(role);else uploads.current.delete(role);uploadLock.current=uploads.current.size>0;setUploading(uploadLock.current);}
  const edit=(next:StudioLane)=>modelEdit(current=>validateProject({...current,lanes:(current.lanes??[]).map(row=>row.id===lane.id?{...next,renderer:'layered',composition:next.composition??defaultCompositionSettings()}:row)}));
  function setPlacement(role:Role,key:'scale'|'width'|'x'|'y',value:number){
    const next=structuredClone(lane),composition=structuredClone(settings);
    const placement=composition[layout][role] as unknown as Record<string,number>;placement[key]=value;next.composition=composition;edit(next);
  }
  function savedMedia(role:'background'|'table'):CompositionMedia|null{
    const asset=project.layerAssets?.find(row=>row.role===role&&row.id===lane.layers[role].default&&layerAssetFitsGame(row,game));
    return asset?{url:labUrl(`/api/layer-assets/${asset.id}`),contentType:asset.contentType,label:asset.label}:null;
  }
  const dealer=localMedia.dealer??(clip?{url:labUrl(clip.previewUrl),label:clipName(clip),contentType:clip.classification?.mediaType==='image'?'image/png':clip.fileName?.endsWith('.webm')?'video/webm':'video/mp4'}:null);
  const background=localMedia.background??savedMedia('background'),table=localMedia.table??savedMedia('table');
  const storedCompositing=clip?.classification?.compositing;
  const [localAlpha,setLocalAlpha]=useState(false);
  const compositing=localMedia.dealer?(localAlpha?{mode:'alpha' as const}:defaultKey):storedCompositing&&storedCompositing.mode!=='opaque'?storedCompositing:defaultKey;
  const legacyBackground=!localMedia.dealer&&storedCompositing?.mode==='opaque';
  function chooseDealer(id:string){
    if(previewAttempt.current||saving||uploading||!dealers.some(row=>row.id===id))return;
    const next=structuredClone(lane);next.layers.dealer.default=id;
    if(!next.dealers.includes(id))next.dealers.push(id);
    if(!next.layers.dealer.allowed.includes(id))next.layers.dealer.allowed.push(id);
    clearRole('dealer');edit(next);setClipId('');
  }
  function clearRole(role:Role){
    const url=objectUrls.current[role];if(url)URL.revokeObjectURL(url);delete objectUrls.current[role];
    setLocalMedia(current=>{const next={...current};delete next[role];return next;});
  }
  function chooseLocal(role:Role,file:File|undefined){
    if(!file||previewAttempt.current)return;
    const valid=['video/mp4','video/webm','image/png','image/jpeg','image/webp'];
    if(!valid.includes(file.type)){setLocalError('Välj PNG, JPEG, WebP, MP4 eller WebM.');return;}
    const previous=objectUrls.current[role];if(previous)URL.revokeObjectURL(previous);
    const url=URL.createObjectURL(file);objectUrls.current[role]=url;setLocalMedia(current=>({...current,[role]:{url,label:file.name,contentType:file.type}}));setLocalError('');
  }
  function clearLocal(){Object.values(objectUrls.current).forEach(url=>URL.revokeObjectURL(url));objectUrls.current={};setLocalMedia({});setLocalError('');}
  function registered(remote:StudioProject,id:string,role:'table'|'background',targetLane:string){
    if(!remote.layerAssets?.some(asset=>asset.id===id&&asset.role===role&&layerAssetFitsGame(asset,game))){setError('Registreringen passar inte valt spel. Läs om biblioteket före koppling.');return;}
    const result=registerCompositionLayer(JSON.parse(savedBaseline.current),projectRef.current,remote,{id,role,laneId:targetLane});
    projectRef.current=result.project;setProject(result.project);clearRole(role);
    if(result.conflicts.length){setConflict(true);setError('Filen är registrerad och vald. Projektet har även ändrats i en annan vy; slå ihop ändringarna före sparning.');}
    else {savedBaseline.current=JSON.stringify(remote);setSavedJson(savedBaseline.current);setError('');setNotice('Lagerfilen är vald i förhandsvisningen.');}
  }
  async function continueTo(href:string){
    if(previewAttempt.current||continuing.current||saving||uploadLock.current||conflict)return;
    if(temporary){setLocalError('Lokala filprov följer inte med vid sparning. Välj Till sparade filer för att fortsätta.');return;}
    continuing.current=true;
    try {if(!dirty||await save())setContinueHref(href);}
    finally{continuing.current=false;}
  }
  function placementControls(role:Role){
    const placement=settings[layout][role],size=role==='table'?'width':'scale',values=placement as unknown as Record<string,number>;
    const sizeTable=(value:number)=>{if(!previewBusy&&!saving&&!uploading&&!conflict&&Number.isFinite(value))setPlacement('table','width',Math.round(Math.max(.1,Math.min(4,value))*100)/100);};
    return <fieldset className={styles.placementControls} key={role} disabled={previewBusy||saving||uploading||conflict}><legend>Storlek och placering <span>{layout==='mobile'?'Mobil 9:16':'Desktop 16:9'}</span></legend>{([size,'x','y'] as const).map(key=><div className="field" key={key}><label>
      <span className={styles.rangeLabel}><span>{key==='scale'?'Storlek':key==='width'?'Bordets storlek':key==='x'?'Sidled':'Upp/ned'}</span><output>{key==='scale'||key==='width'?Math.round(values[key]*100)+' %':values[key].toFixed(2)}</output></span>
      <input type="range" aria-label={`${labels[role]} ${key==='scale'?'storlek':key==='width'?'bredd':key==='x'?'sidled':'upp/ned'}`} min={key==='scale'||key==='width'?0.1:-2} max={key==='scale'||key==='width'?4:2} step="0.01" value={values[key]} onChange={event=>setPlacement(role,key,Number(event.target.value))}/>
    </label>{key==='width'?<div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
      <button type="button" className="sg-btn sg-btn-secondary" disabled={values.width<=.1} onClick={()=>sizeTable(values.width-.1)}>Förminska bord</button>
      <label>Procent<input aria-label="Bordets storlek i procent" type="number" min={10} max={400} step={1} value={Math.round(values.width*100)} style={{width:80}} onChange={event=>sizeTable(event.target.valueAsNumber/100)}/></label>
      <button type="button" className="sg-btn sg-btn-secondary" disabled={values.width>=4} onClick={()=>sizeTable(values.width+.1)}>Förstora bord</button>
    </div>:null}</div>)}<button className={'sg-btn sg-btn-secondary '+styles.reset} disabled={previewBusy||saving} onClick={()=>{const next=structuredClone(lane),composition=structuredClone(settings);Object.assign(composition[layout][role],defaultCompositionSettings()[layout][role]);next.composition=composition;edit(next);}}>Återställ {labels[role].toLowerCase()}</button></fieldset>;
  }
  function layerPanel(role:'table'|'background'){
    return <section className={styles.layer} key={role} id={`composition-panel-${role}`} role="tabpanel" aria-labelledby={`composition-tab-${role}`} hidden={activeRole!==role} tabIndex={0}>
      <fieldset disabled={previewBusy||saving||uploading||conflict}><LayerAssetSelect role={role} game={game} lane={lane} assets={project.layerAssets??[]} onChange={next=>{if(next.layers[role].default!==lane.layers[role].default){clearRole(role);if(next.layers[role].default)next.layers[role].enabled=true;}edit(next);}}/></fieldset>
      {role==='background'?<><p className={styles.hint}>En bild ligger stilla. MP4 och WebM spelas som ljudlös grundloop. Lägg till separata bakgrundsklipp nedan för händelser och automatik.</p>
        <BackgroundPlaybackEditor policy={lane.backgroundPlayback} assets={project.layerAssets??[]} allowed={lane.layers.background.allowed}
          baseSelected={lane.layers.background.enabled&&backgroundAssets.some(asset=>asset.id===lane.layers.background.default)}
          disabled={previewBusy||saving||uploading||conflict||temporary}
          onChange={policy=>{if(previewBusy||saving||uploading||conflict||temporary)return;const next=structuredClone(lane);if(policy)next.backgroundPlayback=policy;else delete next.backgroundPlayback;edit(next);}}
          onPreview={id=>{if(previewBusy||saving||uploading||conflict||temporary)return;setPreviewBackgroundRuleId(id);setPreviewBackgroundRequest(value=>value+1);}}/>
      </>:null}
      {placementControls(role)}
      {role==='table'&&game==='blackjack'&&lane.layers.table.default&&table&&!localMedia.table?<BlackjackTableGeometryEditor
        key={`${lane.id}:${lane.layers.table.default}:${layout}`} tableId={lane.layers.table.default} url={table.url} contentType={table.contentType} layout={layout}
        value={settings.blackjackTables?.find(row=>row.tableId===lane.layers.table.default)} disabled={previewBusy||saving||uploading||conflict||temporary}
        onChange={value=>{if(previewBusy||saving||uploading||conflict||temporary)return;const next=structuredClone(lane),composition=structuredClone(settings);
          const rows=(composition.blackjackTables??[]).filter(row=>row.tableId!==lane.layers.table.default);
          if(value)rows.push(value);if(rows.length)composition.blackjackTables=rows;else delete composition.blackjackTables;
          next.composition=composition;edit(next);
        }}/>:null}
      <details className={styles.upload}><summary>Ladda upp {labels[role].toLowerCase()}</summary><LayerLibrary role={role} game={game} available={initialStatus.provider==='neon'} disabled={previewBusy||saving||uploading||conflict} onBusyChange={busy=>markUpload(role,busy)} onRegistered={(remote,id)=>registered(remote,id,role,lane.id)}/></details>
      <LayerAssetManager project={project} role={role} disabled={previewBusy||saving||uploading||conflict} onEdit={modelEdit}/>
    </section>;
  }
  const publicationHref=labUrl('/control/rooms?'+new URLSearchParams({composition:lane.id,...(initialOperatorId?{operator:initialOperatorId}:{})}));
  const contentHref=studioHref('/control/clips',{dealerId:startDealer?.id,laneId:lane.id,operatorId:initialOperatorId});
  const uploadHref=studioHref('/control/videos',{dealerId:startDealer?.id,eventId:clip?.classification?.eventId??project.events[0]?.id,laneId:lane.id,operatorId:initialOperatorId});
  if (!lanes.length) return <PageTemplate eyebrow="// STUDIO" title="Sammansättningar" intro="Samla dealer, bord och bakgrund till en sammansättning som kan användas i flera spelrum."
    primary={<button className="sg-btn sg-btn-primary" disabled={!dirty||saving||conflict} onClick={()=>void save()}>{saving?'Sparar…':'Spara'}</button>}>
    <div className={styles.empty}><p>Inga sammansättningar finns i utkastet. Skapa en nedan för att börja.</p>
      {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
      {conflict?<ProjectConflict base={JSON.parse(savedJson)} draft={project} onResolve={(remote,merged)=>{setSavedJson(JSON.stringify(remote));setProject(merged);setConflict(false);setError('');setNotice('Granska sammanslagningen och spara.');}}/>:null}
      <CompositionMetadata project={project} onEdit={modelEdit} selectedId="" onSelect={setLaneId} disabled={saving||conflict}/>
      <p>{dirty?'Osparade ändringar. Spara för att bekräfta borttagningen.':'Inga sammansättningar sparade.'}</p>
      <a href={labUrl('/control/rooms'+(initialOperatorId?'?operator='+encodeURIComponent(initialOperatorId):''))}>Spelrum &amp; publicering →</a>
    </div></PageTemplate>;
  return <PageTemplate eyebrow="// STUDIO" title="Sammansättningar"
    primary={<><button className="sg-btn sg-btn-secondary" disabled={!dirty||previewBusy||saving||uploading||conflict} onClick={()=>{if(!uploadLock.current&&!previewAttempt.current)void save();}}>{saving?'Sparar…':'Spara'}</button><button type="button" className="sg-btn sg-btn-primary" disabled={previewBlocked} aria-describedby="studio-preview-help" onClick={()=>void startPreview()}>{previewBusy?'Startar provspelning…':'Provspela'}</button><a className="sg-btn sg-btn-secondary" aria-disabled={previewBusy||saving||uploading||conflict||invalidDealerSelection} href={publicationHref} onClick={event=>{event.preventDefault();if(!invalidDealerSelection)void continueTo(publicationHref);}}>{saving?'Sparar…':dirty?'Spara och fortsätt':'Fortsätt till publicering'}</a></>}>
    <div className="sg-page-body">
      <StudioNavigation dealerId={navigationDealer?.id} dealerLabel={navigationDealer?.label} active="scene" laneId={lane.id} operatorId={initialOperatorId} crumbs={[{label:compositionLabel(lane.label)}]} onNavigate={(event,href)=>{event.preventDefault();void continueTo(href);}} />
      {invalidDealerSelection?<p role="alert">Sammansättningen innehåller ett inaktivt dealerval: {invalidDealerIds.map(id=>invalidDealerLabel(id)||"saknas").join(", ")}. Välj en aktiv startdealer och ta bort inaktiva val innan du provspelar eller publicerar.</p>:null}
      {initialDealerId&&!contentDealer?<p role="alert">Dealern i länken är inte aktiv. Välj en aktiv dealer uttryckligen.</p>:null}
      {previewError?<p role="alert">{previewError}</p>:null}
      {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
      {conflict?<ProjectConflict base={JSON.parse(savedJson)} draft={project} onResolve={(remote,merged)=>{setSavedJson(JSON.stringify(remote));setProject(merged);setConflict(false);setError('');setNotice('Granska sammanslagningen och spara.');}}/>:null}
      <CompositionMetadata project={project} onEdit={modelEdit} selectedId={lane.id} disabled={previewBusy||saving||uploading||conflict} onSelect={id=>{
        if(previewAttempt.current||uploadLock.current||saving||conflict)return;setLaneId(id);setClipId('');
        const url=new URL(window.location.href);url.searchParams.set('composition',id);url.searchParams.delete('lane');window.history.replaceState(null,'',url.pathname+url.search);
      }}/>
      <p className={styles.saveState}>{saving?'Sparar…':dirty?'Osparade ändringar':'Sparad sammansättning'}</p>
      <label>Spel för materialval<select aria-label="Spel för materialval" value={game} disabled={previewBusy||saving||uploading||conflict} onChange={event=>{clearLocal();setClipId('');setGame(event.target.value as 'blackjack'|'roulette');}}><option value="blackjack">Blackjack</option><option value="roulette">Roulette</option></select></label>
      <p className={styles.hint}>Spelvalet filtrerar biblioteket och märker nya bordsfiler. Det byter inte rummets spel och ändrar inte sparade tillåtna val.</p>
      <p id="studio-preview-help" className={styles.hint}>{game==='roulette'?'Roulette provspelas i det publicerade demorummet. Den separata Provspela-knappen stöder ännu bara blackjack.':temporary?'Avsluta det tillfälliga filprovet före provspelning.':dirty||!hasSavedLane?'Spara sammansättningen först för att provspela.':'Provspela blackjack med sparade dealers, bord och bakgrunder från biblioteket. Ett separat provspel startas utan att publicera till ett bolag.'}</p>
      <p className={styles.hint}>En sammansättning samlar dealer, bord och bakgrund samt vilka val bolaget får göra. Provspela här och koppla den sedan till ett spelrum under Spelrum & publicering.</p>
      {contentDealer&&contentDealer.id!==lane.layers.dealer.default?<aside className={styles.hint} aria-label="Dealer från klippbiblioteket">
        <p>Du valde {contentDealer.label} i dealerbiblioteket. {lane.layers.dealer.allowed.includes(contentDealer.id)
          ? 'Dealern är tillåten i den här sammansättningen, men är inte startdealer.'
          : 'Dealern ingår inte i den här sammansättningen ännu. Välj en befintlig sammansättning ovan eller lägg till dealern här.'}</p>
        <button type="button" className="sg-btn sg-btn-secondary" disabled={previewBusy||saving||uploading} onClick={()=>chooseDealer(contentDealer.id)}>Använd {contentDealer.label} som startdealer</button>
      </aside>:null}
      <div className={styles.workspace}>
        <section className={styles.preview} aria-label="Komposition">
          <div className={styles.sceneHeader} style={{flexWrap:'wrap'}}><h2>Scen</h2><div className={styles.formats} role="group" aria-label="Format"><button aria-pressed={layout==='mobile'} onClick={()=>setLayout('mobile')}>Mobil 9:16</button><button aria-pressed={layout==='desktop'} onClick={()=>setLayout('desktop')}>Desktop 16:9</button></div><button type="button" className="sg-btn sg-btn-secondary" aria-expanded={labMode} aria-controls="composition-lab" onClick={()=>setLabMode(value=>!value)}>{labMode?'Till sammansättningen':'Labba'}</button></div>
          {legacyBackground?<p role="alert" className={styles.hint}>Äldre bakgrundsinställning behöver åtgärdas före publicering. Om en miljö är inbakad i dealerfilmen behöver den ersättas med en grön originalfilm.</p>:null}
          {temporary?<p className={styles.hint} role="status">Tillfälligt filprov · följer inte med vid sparning.</p>:null}
          <CompositionPreview dealer={dealer} background={background} table={table} settings={settings} layout={layout} show={{dealer:lane.layers.dealer.enabled,background:lane.layers.background.enabled,table:lane.layers.table.enabled}} compositing={compositing} framing={localMedia.dealer?undefined:clip?.classification?.framing} backgroundPlayback={temporary?undefined:lane.backgroundPlayback} backgroundAssets={backgroundAssets} previewBackgroundRuleId={previewBackgroundRuleId} previewBackgroundRequest={previewBackgroundRequest}/>
          {localError?<p role="alert">{localError}</p>:null}
        </section>
        <section className={styles.controls} aria-label="Tre lager">
          <div className={styles.layerTabs} role="tablist" aria-label="Välj lager">{roles.map(role=><button key={role} ref={element=>{layerTabs.current[role]=element??undefined;}} id={`composition-tab-${role}`} role="tab" aria-selected={activeRole===role} aria-controls={`composition-panel-${role}`} tabIndex={activeRole===role?0:-1} onClick={()=>setActiveRole(role)} onKeyDown={event=>{let index=roles.indexOf(role);if(event.key==='ArrowRight')index=(index+1)%roles.length;else if(event.key==='ArrowLeft')index=(index+roles.length-1)%roles.length;else if(event.key==='Home')index=0;else if(event.key==='End')index=roles.length-1;else return;event.preventDefault();setActiveRole(roles[index]);layerTabs.current[roles[index]]?.focus();}}>{labels[role]}</button>)}</div>
          <section className={styles.layer} id="composition-panel-dealer" role="tabpanel" aria-labelledby="composition-tab-dealer" hidden={activeRole!=='dealer'} tabIndex={0}>
            <label className="field">Dealer<select value={startDealer?.id??''} disabled={previewBusy||saving||uploading} onChange={event=>chooseDealer(event.target.value)}>{!startDealer?<option value="" disabled>Välj en aktiv dealer</option>:null}{dealers.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
            <p className={styles.hint}>Dealern börjar i grundloop. Publicerade händelseklipp avbryter den när spelet utlöser en händelse; sedan återgår dealern till grundloopen.</p>
            <fieldset disabled={previewBusy||saving||uploading}><legend>Tillåtna dealers i sammansättningen</legend>
              {dealers.map(row=><label className="check-field" key={row.id}><input type="checkbox" aria-label={`Tillåt ${row.label}`} checked={lane.layers.dealer.allowed.includes(row.id)} disabled={row.id===lane.layers.dealer.default} onChange={event=>{
                if(row.id===lane.layers.dealer.default)return;
                const next=structuredClone(lane);
                if(event.target.checked){if(!next.dealers.includes(row.id))next.dealers.push(row.id);if(!next.layers.dealer.allowed.includes(row.id))next.layers.dealer.allowed.push(row.id);}
                else {next.dealers=next.dealers.filter(id=>id!==row.id);next.layers.dealer.allowed=next.layers.dealer.allowed.filter(id=>id!==row.id);}
                edit(next);
              }}/>{row.label}{row.id===lane.layers.dealer.default?' · startdealer':''}</label>)}
              {invalidDealerIds.filter(Boolean).map(id=><div key={id}><span>{invalidDealerLabel(id)} · inaktivt val</span> <button type="button" className="sg-btn sg-btn-secondary" disabled={id===lane.layers.dealer.default} onClick={()=>{if(previewAttempt.current||saving||uploading||id===lane.layers.dealer.default)return;const next=structuredClone(lane);next.dealers=next.dealers.filter(value=>value!==id);next.layers.dealer.allowed=next.layers.dealer.allowed.filter(value=>value!==id);edit(next);}}>Ta bort inaktivt val</button>{id===lane.layers.dealer.default?<small> Välj först en aktiv startdealer.</small>:null}</div>)}
              <p className={styles.hint}>Startdealern ingår alltid. Avmarkera äldre dealers som inte ska följa med paketet. Byte av startdealer ändrar inte övriga tillåtna dealers.</p>
            </fieldset>
            {placementControls('dealer')}
            <label className="field">Förhandsvisa klipp<select value={clip?.id??''} disabled={!clips.length||previewBusy||saving||uploading} onChange={event=>{clearRole('dealer');setClipId(event.target.value);}}>{!clips.length?<option value="">Inga dealerklipp ännu</option>:clips.map(row=><option key={row.id} value={row.id}>{clipName(row)}</option>)}</select></label>
            <p className={styles.hint}>Klippvalet är bara ett prov.</p>
            <a className="sg-btn sg-btn-secondary" href={contentHref} onClick={event=>{event.preventDefault();void continueTo(contentHref);}}>Dealerklipp, grundloop och händelser →</a>
            <p className={styles.hint}>Ladda upp och ordna dealerns klipp i Dealers &amp; klipp. Här väljer du hur dealern visas tillsammans med bord och bakgrund.</p>
          </section>
          {(['table','background'] as const).map(layerPanel)}
        </section>
      </div>
      {project.lanes?.some(row=>row.id===lane.id)?<CompositionSettings key={lane.id} project={project} lane={lane} onEdit={modelEdit} disabled={previewBusy||saving||uploading||conflict}/>:null}
      <details id="composition-lab" className={styles.advanced} open={labMode} onToggle={event=>setLabMode(event.currentTarget.open)}><summary>Avancerat · lager och filprov</summary><div>
        <p>Prova VILA-/REDO-bilder och händelseklipp i samma scen. Lokala filer laddas inte upp. Storlek och placering ändrar utkastet; spara uttryckligen för att behålla dem. Du kan växla tillbaka utan att tappa filprovet.</p>
        <fieldset disabled={previewBusy||saving}><legend>Synliga lager</legend>{roles.map(role=><label className="check-field" key={role}><input type="checkbox" checked={lane.layers[role].enabled} disabled={role==='background'&&Boolean(lane.backgroundPlayback?.rules.length)} onChange={event=>{if(role==='background'&&lane.backgroundPlayback?.rules.length)return;const next=structuredClone(lane);next.layers[role].enabled=event.target.checked;edit(next);}}/>{labels[role]}</label>)}{lane.backgroundPlayback?.rules.length?<p>Ta bort bakgrundsklippen under Bakgrund innan du döljer bakgrundslagret.</p>:null}</fieldset>
        <label className="check-field"><input type="checkbox" checked={settings.tableFront} disabled={previewBusy||saving} onChange={event=>{const next=structuredClone(lane);next.composition={...structuredClone(settings),tableFront:event.target.checked};edit(next);}}/>Bord framför dealern</label>
        <details><summary>Klippets friläggning</summary>{localMedia.dealer?<label><input type="checkbox" checked={localAlpha} onChange={event=>setLocalAlpha(event.target.checked)}/>Lokalt prov med befintlig alfa · ingen grön nyckling</label>:null}{compositing.mode==='alpha'?<p>Originalets alfa bevaras utan grön nyckling.</p>:<p>Grön nyckling · Tröskel {compositing.threshold.toFixed(2)} · Mjukhet {compositing.softness.toFixed(2)} · Grön färgreduktion {compositing.despill.toFixed(2)}</p>}<a href={uploadHref} onClick={event=>{event.preventDefault();void continueTo(uploadHref);}}>Klippets filinställningar →</a></details>
        <section aria-label="Snabbprov med tre lokala filer"><h3>Snabbprov med tre lokala filer</h3><div>{roles.map(role=><label className="field" key={role}>{labels[role]} · lokal fil<input type="file" disabled={previewBusy||saving||uploading} accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" onChange={event=>chooseLocal(role,event.target.files?.[0])}/></label>)}</div><p>Dealer: bild eller video, frilagd eller med grön bakgrund. Grönt tas bort bara i dealerlagret. Filens marginaler behålls; stående och liggande källor visas höjdbaserat. Bord och miljö visas separat. Händelseklipp spelas en gång; Spela två gånger kontrollerar upprepning.</p><button className="sg-btn sg-btn-secondary" disabled={!temporary||saving||uploading} onClick={clearLocal}>Till sparade filer</button></section>
      </div></details>
    </div>
  </PageTemplate>;
}
