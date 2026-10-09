'use client';
import {useEffect,useRef,useState} from 'react';
import {labUrl} from '../lib/lab-url.mjs';
import {clipLabel} from '../lib/clip-label.mjs';
import {defaultPresentationLane,validateProject,type StudioProject,type StudioLane} from '../lib/studio-model.mjs';
import {registerCompositionLayer} from '../lib/studio-composition.mjs';
import {defaultCompositionSettings} from '../../web/public/composition-settings.mjs';
import {PageTemplate} from './page-template.mjs';
import {useStudioSession} from './studio-session';
import {LayerAssetSelect} from './layer-selectors';
import {LayerLibrary} from './layer-library';
import {FamilyVideoUpload} from './family-video-upload';
import {VideoUpload} from './video-upload';
import {ProjectConflict} from './project-conflict';
import {CompositionPreview,type CompositionMedia,type VideoCompositing} from './composition-preview';
import {studioHref,type VideoInventory,type ConnectionStatus} from './studio-types';
import styles from './control-preview-page.module.css';

type Role='dealer'|'table'|'background';
const roles:Role[]=['dealer','table','background'];
const labels={dealer:'Dealer',table:'Bord',background:'Bakgrund'};
const defaultKey:VideoCompositing={mode:'green-screen',threshold:0.23,softness:0.15,despill:0};

export function ControlPreviewPage({initialProject,initialVideos,initialStatus,initialLaneId}:{initialProject:StudioProject;initialVideos:VideoInventory;initialStatus:ConnectionStatus;initialLaneId?:string}) {
  const session=useStudioSession({initialProject,initialVideos,initialStatus});
  const {project,projectRef,videos,setVideos,modelEdit,dirty,saving,save,error,notice,savedJson,setSavedJson,setProject,setConflict,setError,setNotice,conflict}=session;
  const [laneId,setLaneId]=useState(initialLaneId??project.lanes?.[0]?.id??'mobile-phone'),[clipId,setClipId]=useState('');
  const [layout,setLayout]=useState<'mobile'|'desktop'>('mobile'),[uploading,setUploading]=useState(false),[continueHref,setContinueHref]=useState('');
  const [localMedia,setLocalMedia]=useState<Partial<Record<Role,CompositionMedia>>>({}),[localError,setLocalError]=useState(''),[localKey,setLocalKey]=useState(true);
  const [activeRole,setActiveRole]=useState<Role>('dealer');
  const layerTabs=useRef<Partial<Record<Role,HTMLButtonElement>>>({});
  const objectUrls=useRef<Partial<Record<Role,string>>>({}),savedBaseline=useRef(savedJson),continuing=useRef(false),uploadLock=useRef(false),uploads=useRef(new Set<string>());
  savedBaseline.current=savedJson;
  const lanes=project.lanes?.length?project.lanes:[defaultPresentationLane()];
  const lane=lanes.find(row=>row.id===laneId)??lanes[0];
  const clips=videos.videos.filter(video=>video.available&&(video.dealer===lane.layers.dealer.default||video.classification?.dealerId===lane.layers.dealer.default));
  const idleFamily=videos.families?.find(row=>row.dealerId===lane.layers.dealer.default&&row.playbackType==='idle-pool');
  const idleIds=idleFamily&&project.idlePolicy?.familyId===idleFamily.id?project.idlePolicy.base.map(row=>row.videoId):idleFamily?.standardIds??[];
  const idleClip=idleIds.map(id=>clips.find(row=>row.id===id)).find(Boolean)
    ??clips.find(row=>row.classification?.eventId==='idle.ready'&&(row.classification.role==='standard'||row.role==='standard'));
  const clip=clips.find(video=>video.id===clipId)??idleClip??clips[0];
  const clipName=(video:typeof clips[number])=>clipLabel({id:video.id,label:video.label,familyId:video.familyId,role:video.role,relativePath:video.relativePath},project.clipLabels);
  const settings=lane.composition??defaultCompositionSettings();
  const temporary=Object.keys(localMedia).length>0;
  useEffect(()=>()=>{Object.values(objectUrls.current).forEach(url=>URL.revokeObjectURL(url));},[]);
  useEffect(()=>{
    if(!continueHref||dirty||saving||uploading||conflict||temporary)return;
    window.location.assign(continueHref);
  },[continueHref,dirty,saving,uploading,conflict,temporary]);
  useEffect(()=>{
    const guard=(event:BeforeUnloadEvent)=>{if(uploading||temporary){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);
  },[uploading,temporary]);
  function markUpload(role:Role,busy:boolean){if(busy)uploads.current.add(role);else uploads.current.delete(role);uploadLock.current=uploads.current.size>0;setUploading(uploadLock.current);}
  const edit=(next:StudioLane)=>modelEdit(current=>validateProject({...current,lanes:(current.lanes?.length?current.lanes:[defaultPresentationLane()]).map(row=>row.id===lane.id?{...next,renderer:'layered',composition:next.composition??defaultCompositionSettings()}:row)}));
  function setPlacement(role:Role,key:'scale'|'width'|'x'|'y',value:number){
    const next=structuredClone(lane),composition=structuredClone(settings);
    const placement=composition[layout][role] as unknown as Record<string,number>;placement[key]=value;next.composition=composition;edit(next);
  }
  function savedMedia(role:'background'|'table'):CompositionMedia|null{
    const asset=project.layerAssets?.find(row=>row.id===lane.layers[role].default);
    return asset?{url:labUrl(`/api/layer-assets/${asset.id}`),contentType:asset.contentType,label:asset.label}:null;
  }
  const dealer=localMedia.dealer??(clip?{url:labUrl(clip.previewUrl),label:clipName(clip),contentType:'video/mp4'}:null);
  const background=localMedia.background??savedMedia('background'),table=localMedia.table??savedMedia('table');
  const storedCompositing=clip?.classification?.compositing;
  const compositing=localMedia.dealer?(localKey?defaultKey:undefined):storedCompositing?.mode==='green-screen'?storedCompositing:undefined;
  const fullFrame=Boolean(dealer&&!compositing&&lane.layers.dealer.enabled);
  function clearRole(role:Role){
    const url=objectUrls.current[role];if(url)URL.revokeObjectURL(url);delete objectUrls.current[role];
    setLocalMedia(current=>{const next={...current};delete next[role];return next;});
  }
  function chooseLocal(role:Role,file:File|undefined){
    if(!file)return;
    const valid=role==='dealer'?['video/mp4','video/webm']:['video/mp4','video/webm','image/png','image/jpeg','image/webp'];
    if(!valid.includes(file.type)){setLocalError(role==='dealer'?'Välj en dealerfilm i MP4 eller WebM.':'Välj PNG, JPEG, WebP, MP4 eller WebM.');return;}
    const previous=objectUrls.current[role];if(previous)URL.revokeObjectURL(previous);
    const url=URL.createObjectURL(file);objectUrls.current[role]=url;setLocalMedia(current=>({...current,[role]:{url,label:file.name,contentType:file.type}}));setLocalError('');
  }
  function clearLocal(){Object.values(objectUrls.current).forEach(url=>URL.revokeObjectURL(url));objectUrls.current={};setLocalMedia({});setLocalError('');}
  function registered(remote:StudioProject,id:string,role:'table'|'background',targetLane:string){
    const result=registerCompositionLayer(JSON.parse(savedBaseline.current),projectRef.current,remote,{id,role,laneId:targetLane});
    projectRef.current=result.project;setProject(result.project);clearRole(role);
    if(result.conflicts.length){setConflict(true);setError('Filen är registrerad och vald. Projektet har även ändrats i en annan vy; slå ihop ändringarna före sparning.');}
    else {savedBaseline.current=JSON.stringify(remote);setSavedJson(savedBaseline.current);setError('');setNotice('Lagerfilen är vald i förhandsvisningen.');}
  }
  async function continueTo(href:string){
    if(continuing.current||saving||uploadLock.current||conflict)return;
    if(temporary){setLocalError('Lokala filprov följer inte med vid sparning. Välj Till sparade filer för att fortsätta.');return;}
    continuing.current=true;
    try {if(!dirty||await save())setContinueHref(href);}
    finally{continuing.current=false;}
  }
  function placementControls(role:Role){
    const placement=settings[layout][role],size=role==='table'?'width':'scale',values=placement as unknown as Record<string,number>;
    return <fieldset className={styles.placementControls} key={role} disabled={saving}><legend>Storlek och placering <span>{layout==='mobile'?'Mobil 9:16':'Desktop 16:9'}</span></legend>{([size,'x','y'] as const).map(key=><label className="field" key={key}>
      <span className={styles.rangeLabel}><span>{key==='scale'?'Storlek':key==='width'?'Bredd':key==='x'?'Sidled':'Upp/ned'}</span><output>{key==='scale'||key==='width'?Math.round(values[key]*100)+' %':values[key].toFixed(2)}</output></span>
      <input type="range" aria-label={`${labels[role]} ${key==='scale'?'storlek':key==='width'?'bredd':key==='x'?'sidled':'upp/ned'}`} min={key==='scale'||key==='width'?0.1:-2} max={key==='scale'||key==='width'?4:2} step="0.01" value={values[key]} onChange={event=>setPlacement(role,key,Number(event.target.value))}/>
    </label>)}<button className={'sg-btn sg-btn-secondary '+styles.reset} disabled={saving} onClick={()=>{const next=structuredClone(lane),composition=structuredClone(settings);Object.assign(composition[layout][role],defaultCompositionSettings()[layout][role]);next.composition=composition;edit(next);}}>Återställ {labels[role].toLowerCase()}</button></fieldset>;
  }
  function layerPanel(role:'table'|'background'){
    return <section className={styles.layer} key={role} id={`composition-panel-${role}`} role="tabpanel" aria-labelledby={`composition-tab-${role}`} hidden={activeRole!==role} tabIndex={0}>
      <fieldset disabled={saving}><LayerAssetSelect role={role} lane={lane} assets={project.layerAssets??[]} onChange={next=>{if(next.layers[role].default!==lane.layers[role].default){clearRole(role);if(next.layers[role].default)next.layers[role].enabled=true;}edit(next);}}/></fieldset>
      {fullFrame?<p className={styles.hint}>Inbakat i dealerklippet · välj ett frilagt klipp för att placera {labels[role].toLowerCase()}.</p>:placementControls(role)}
      <details className={styles.upload}><summary>Ladda upp {labels[role].toLowerCase()}</summary><LayerLibrary role={role} available={initialStatus.provider==='neon'} disabled={saving||uploading||conflict} onBusyChange={busy=>markUpload(role,busy)} onRegistered={(remote,id)=>registered(remote,id,role,lane.id)}/></details>
    </section>;
  }
  const publicationHref=labUrl(`/control/lanes?lane=${encodeURIComponent(lane.id)}`);
  const contentHref=studioHref('/control/clips',{dealerId:lane.layers.dealer.default});
  const uploadHref=studioHref('/control/videos',{dealerId:lane.layers.dealer.default,eventId:clip?.classification?.eventId??project.events[0]?.id});
  const ownFamilies=videos.families?.some(row=>row.dealerId===lane.layers.dealer.default)??false;
  const uploadEventId=clip?.classification?.eventId??project.events.find(row=>row.id==='idle.ready')?.id??project.events[0].id;
  const initialFamilyId=clip?.familyId??videos.families?.find(row=>row.dealerId===lane.layers.dealer.default&&row.playbackType==='idle-pool')?.id;
  return <PageTemplate eyebrow="// STUDIO" title="Sammansättning"
    primary={<><button className="sg-btn sg-btn-secondary" disabled={!dirty||saving||uploading||conflict} onClick={()=>{if(!uploadLock.current)void save();}}>{saving?'Sparar…':'Spara'}</button><a className="sg-btn sg-btn-primary" aria-disabled={saving||uploading||conflict} href={publicationHref} onClick={event=>{event.preventDefault();void continueTo(publicationHref);}}>{saving?'Sparar…':dirty?'Spara och fortsätt':'Fortsätt till publicering'}</a></>}>
    <div className="sg-page-body">
      {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
      {conflict?<ProjectConflict base={JSON.parse(savedJson)} draft={project} onResolve={(remote,merged)=>{setSavedJson(JSON.stringify(remote));setProject(merged);setConflict(false);setError('');setNotice('Granska sammanslagningen och spara.');}}/>:null}
      <div className={styles.toolbar}>
        <label className="field">Presentation<select value={lane.id} disabled={saving||uploading} onChange={event=>{setLaneId(event.target.value);setClipId('');const url=new URL(window.location.href);url.searchParams.set('lane',event.target.value);window.history.replaceState(null,'',url.pathname+url.search);}}>{lanes.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
        <span className={styles.saveState}>{saving?'Sparar…':dirty?'Osparade ändringar':'Sparad sammansättning'}</span>
      </div>
      <div className={styles.workspace}>
        <section className={styles.preview} aria-label="Komposition">
          <div className={styles.sceneHeader}><h2>Scen</h2><div className={styles.formats} role="group" aria-label="Format"><button aria-pressed={layout==='mobile'} onClick={()=>setLayout('mobile')}>Mobil 9:16</button><button aria-pressed={layout==='desktop'} onClick={()=>setLayout('desktop')}>Desktop 16:9</button></div></div>
          {fullFrame?<p className={styles.hint}>Inbakat bord och bakgrund · välj frilagt klipp för separata lager.</p>:null}
          {temporary?<p className={styles.hint} role="status">Tillfälligt filprov · följer inte med vid sparning.</p>:null}
          <CompositionPreview dealer={dealer} background={background} table={table} settings={settings} layout={layout} show={{dealer:lane.layers.dealer.enabled,background:lane.layers.background.enabled,table:lane.layers.table.enabled}} compositing={compositing}/>
          {localError?<p role="alert">{localError}</p>:null}
        </section>
        <section className={styles.controls} aria-label="Tre lager">
          <div className={styles.layerTabs} role="tablist" aria-label="Välj lager">{roles.map(role=><button key={role} ref={element=>{layerTabs.current[role]=element??undefined;}} id={`composition-tab-${role}`} role="tab" aria-selected={activeRole===role} aria-controls={`composition-panel-${role}`} tabIndex={activeRole===role?0:-1} onClick={()=>setActiveRole(role)} onKeyDown={event=>{let index=roles.indexOf(role);if(event.key==='ArrowRight')index=(index+1)%roles.length;else if(event.key==='ArrowLeft')index=(index+roles.length-1)%roles.length;else if(event.key==='Home')index=0;else if(event.key==='End')index=roles.length-1;else return;event.preventDefault();setActiveRole(roles[index]);layerTabs.current[roles[index]]?.focus();}}>{labels[role]}</button>)}</div>
          <section className={styles.layer} id="composition-panel-dealer" role="tabpanel" aria-labelledby="composition-tab-dealer" hidden={activeRole!=='dealer'} tabIndex={0}>
            <label className="field">Dealer<select value={lane.layers.dealer.default} disabled={saving||uploading} onChange={event=>{const next=structuredClone(lane),id=event.target.value;next.layers.dealer.default=id;if(!next.dealers.includes(id))next.dealers.push(id);if(!next.layers.dealer.allowed.includes(id))next.layers.dealer.allowed.push(id);clearRole('dealer');edit(next);setClipId('');}}>{project.dealers.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
            <p className={styles.hint}>Startdealer · sparas i presentationen.</p>
            {placementControls('dealer')}
            <label className="field">Förhandsvisa klipp<select value={clip?.id??''} disabled={!clips.length||saving||uploading} onChange={event=>{clearRole('dealer');setClipId(event.target.value);}}>{!clips.length?<option value="">Inga dealerklipp ännu</option>:clips.map(row=><option key={row.id} value={row.id}>{clipName(row)}</option>)}</select></label>
            <p className={styles.hint}>Klippvalet är bara ett prov.</p>
            <details className={styles.upload}><summary>Ladda upp dealerklipp</summary>{ownFamilies?<FamilyVideoUpload key={lane.layers.dealer.default} project={project} inventory={videos} disabled={saving||uploading||conflict} dealerId={lane.layers.dealer.default} initialFamilyId={initialFamilyId} onBusyChange={busy=>markUpload('dealer',busy)} onUploaded={(next,id)=>{setVideos(next);if(id)setClipId(id);clearRole('dealer');}}/>:<VideoUpload key={lane.layers.dealer.default} project={project} dealerId={lane.layers.dealer.default} eventId={uploadEventId} initialSituation={clip?.classification?.situation} disabled={saving||uploading||conflict} onBusyChange={busy=>markUpload('dealer',busy)} lockDealer previewOnly open onUploaded={(next,video)=>{setVideos(next);setClipId(video.id);clearRole('dealer');}}/>}</details>
            <a href={contentHref} onClick={event=>{event.preventDefault();void continueTo(contentHref);}}>Grundloop och klipp →</a>
          </section>
          {(['table','background'] as const).map(layerPanel)}
        </section>
      </div>
      <details className={styles.advanced}><summary>Avancerat</summary><div>
        <fieldset disabled={saving}><legend>Synliga lager</legend>{roles.map(role=><label className="check-field" key={role}><input type="checkbox" checked={lane.layers[role].enabled} onChange={event=>{const next=structuredClone(lane);next.layers[role].enabled=event.target.checked;edit(next);}}/>{labels[role]}</label>)}</fieldset>
        <label className="check-field"><input type="checkbox" checked={settings.tableFront} disabled={saving} onChange={event=>{const next=structuredClone(lane);next.composition={...structuredClone(settings),tableFront:event.target.checked};edit(next);}}/>Bord framför dealern</label>
        <details><summary>Klippets greenscreen</summary>{compositing?<p>Tröskel {compositing.threshold.toFixed(2)} · Mjukhet {compositing.softness.toFixed(2)} · Grön färgreduktion {compositing.despill.toFixed(2)}</p>:<p>Fullbildsklippet behåller sin bild.</p>}<a href={uploadHref} onClick={event=>{event.preventDefault();void continueTo(uploadHref);}}>Klippets filinställningar →</a></details>
        <details><summary>Snabbprov med tre lokala filer</summary><div>{roles.map(role=><label className="field" key={role}>{labels[role]} · lokal fil<input type="file" disabled={saving||uploading} accept={role==='dealer'?'video/mp4,video/webm':'image/png,image/jpeg,image/webp,video/mp4,video/webm'} onChange={event=>chooseLocal(role,event.target.files?.[0])}/></label>)}</div><label className="check-field"><input type="checkbox" checked={localKey} disabled={saving||uploading} onChange={event=>setLocalKey(event.target.checked)}/>Nyckla grön bakgrund i lokal dealerfilm</label><button className="sg-btn sg-btn-secondary" disabled={!temporary||saving||uploading} onClick={clearLocal}>Till sparade filer</button></details>
        <details><summary>Presentationens tekniska ID</summary><code>{lane.id}</code></details>
        <details><summary>Frilagda dealerpaket · Paow och Dragge</summary><iframe loading="lazy" title="Förhandsvisning · lagerprov" src={labUrl('/preview/index.html')} style={{display:'block',width:'100%',height:'88vh',minHeight:720,border:0}}/></details>
      </div></details>
    </div>
  </PageTemplate>;
}
