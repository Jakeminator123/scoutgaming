'use client';
import {useEffect,useRef,useState} from 'react';
import {labUrl} from '../lib/lab-url.mjs';
import {defaultPresentationLane,validateProject,type StudioProject,type StudioLane} from '../lib/studio-model.mjs';
import {defaultCompositionSettings,type CompositionSettings} from '../../web/public/composition-settings.mjs';
import {PageTemplate} from './page-template.mjs';
import {useStudioSession} from './studio-session';
import {LayerAssetSelect} from './layer-selectors';
import {LayerLibrary} from './layer-library';
import {ProjectConflict} from './project-conflict';
import {CompositionPreview,type CompositionMedia,type VideoCompositing} from './composition-preview';
import {studioHref,type VideoInventory,type ConnectionStatus} from './studio-types';

type Role='dealer'|'table'|'background';
const roles:Role[]=['dealer','table','background'];
const labels={dealer:'Dealer',table:'Bord',background:'Bakgrund'};
const defaultKey:VideoCompositing={mode:'green-screen',threshold:0.23,softness:0.15,despill:0};

export function ControlPreviewPage({initialProject,initialVideos,initialStatus}:{initialProject:StudioProject;initialVideos:VideoInventory;initialStatus:ConnectionStatus}) {
  const session=useStudioSession({initialProject,initialVideos,initialStatus});
  const {project,modelEdit,dirty,saving,save,error,notice,savedJson,setSavedJson,setProject,setConflict,setError,setNotice,conflict}=session;
  const [laneId,setLaneId]=useState(project.lanes?.[0]?.id??'mobile-phone'),[clipId,setClipId]=useState('');
  const [layout,setLayout]=useState<'mobile'|'desktop'>('mobile');
  const [localMedia,setLocalMedia]=useState<Partial<Record<Role,CompositionMedia>>>({}),[localError,setLocalError]=useState(''),[localKey,setLocalKey]=useState(true);
  const objectUrls=useRef<Partial<Record<Role,string>>>({});
  useEffect(()=>()=>{Object.values(objectUrls.current).forEach(url=>URL.revokeObjectURL(url));},[]);
  const lanes=project.lanes?.length?project.lanes:[defaultPresentationLane()];
  const lane=lanes.find(row=>row.id===laneId)??lanes[0];
  const clips=initialVideos.videos.filter(video=>video.available&&(video.dealer===lane.layers.dealer.default||video.classification?.dealerId===lane.layers.dealer.default));
  const clip=clips.find(video=>video.id===clipId)??clips[0];
  const settings=lane.composition??defaultCompositionSettings();
  const edit=(next:StudioLane)=>modelEdit(current=>validateProject({...current,lanes:lanes.map(row=>row.id===lane.id?{...next,renderer:'layered',composition:next.composition??defaultCompositionSettings()}:row)}));
  function setPlacement(role:Role,key:'scale'|'width'|'x'|'y',value:number){
    const next=structuredClone(lane),composition=structuredClone(settings);
    const placement=composition[layout][role] as unknown as Record<string,number>;placement[key]=value;next.composition=composition;edit(next);
  }
  function savedMedia(role:'background'|'table'):CompositionMedia|null{
    const asset=project.layerAssets?.find(row=>row.id===lane.layers[role].default);
    return asset?{url:labUrl(`/api/layer-assets/${asset.id}`),contentType:asset.contentType,label:asset.label}:null;
  }
  const dealer=localMedia.dealer??(clip?{url:labUrl(clip.previewUrl),label:clip.label,contentType:'video/mp4'}:null);
  const background=localMedia.background??savedMedia('background'),table=localMedia.table??savedMedia('table');
  const storedCompositing=clip?.classification?.compositing;
  const compositing=localMedia.dealer?(localKey?defaultKey:undefined):storedCompositing?.mode==='green-screen'?storedCompositing:undefined;
  const temporary=Object.keys(localMedia).length>0;
  function chooseLocal(role:Role,file:File|undefined){
    if(!file)return;
    const valid=role==='dealer'?['video/mp4','video/webm']:['video/mp4','video/webm','image/png','image/jpeg','image/webp'];
    if(!valid.includes(file.type)){setLocalError(role==='dealer'?'Välj en dealerfilm i MP4 eller WebM.':'Välj PNG, JPEG, WebP, MP4 eller WebM.');return;}
    const previous=objectUrls.current[role];if(previous)URL.revokeObjectURL(previous);
    const url=URL.createObjectURL(file);objectUrls.current[role]=url;setLocalMedia(current=>({...current,[role]:{url,label:file.name,contentType:file.type}}));setLocalError('');
  }
  function clearLocal(){Object.values(objectUrls.current).forEach(url=>URL.revokeObjectURL(url));objectUrls.current={};setLocalMedia({});setLocalError('');}
  function placementControls(role:Role){
    const placement=settings[layout][role],size=role==='table'?'width':'scale';
    const values=placement as unknown as Record<string,number>;
    return <fieldset key={role}><legend>{labels[role]} · placering</legend>{([size,'x','y'] as const).map(key=><label className="field" key={key}>
      {key==='scale'?'Skala':key==='width'?'Bredd':key==='x'?'Sidled':'Höjd'} · {values[key].toFixed(2)}
      <input type="range" aria-label={`${labels[role]} ${key==='scale'?'skala':key==='width'?'bredd':key==='x'?'sidled':'höjd'}`} min={key==='scale'||key==='width'?0.1:-2} max={key==='scale'||key==='width'?4:2} step="0.01" value={values[key]} onChange={event=>setPlacement(role,key,Number(event.target.value))}/>
    </label>)}</fieldset>;
  }
  const uploadHref=studioHref('/control/videos',{dealerId:lane.layers.dealer.default,eventId:clip?.classification?.eventId??project.events[0]?.id});
  return <PageTemplate eyebrow="// STUDIO" title="Förhandsvisning" intro="Sätt ihop dealer, bord och bakgrund. Varje klipp behåller sina händelser, OpenClaw-val och automatiken."
    primary={<button className="sg-btn sg-btn-primary" disabled={!dirty||saving} onClick={()=>void save()}>{saving?'Sparar…':'Spara lane'}</button>}>
    <div className="sg-page-body">
      {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
      {conflict?<ProjectConflict base={JSON.parse(savedJson)} draft={project} onResolve={(remote,merged)=>{setSavedJson(JSON.stringify(remote));setProject(merged);setConflict(false);setError('');setNotice('Granska sammanslagningen och spara.');}}/>:null}
      <label className="field">Lane<select value={lane.id} onChange={event=>{setLaneId(event.target.value);setClipId('');}}>{lanes.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%, 320px),1fr))',gap:24}}>
        <section aria-label="Tre lager">
          <label className="field">Dealer<select value={lane.layers.dealer.default} onChange={event=>{const next=structuredClone(lane),id=event.target.value;next.layers.dealer.default=id;if(!next.dealers.includes(id))next.dealers.push(id);if(!next.layers.dealer.allowed.includes(id))next.layers.dealer.allowed.push(id);edit(next);setClipId('');}}>{project.dealers.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
          <p><a href={studioHref('/control/clips',{dealerId:lane.layers.dealer.default})}>Lägg till eller konfigurera en dealer</a> · <a href={uploadHref}>Ladda upp dealerklipp</a></p>
          {lane.layers.dealer.default==='nora'?<p role="status">Nora behöver en egen spellane med dealer-id nora under <a href={labUrl('/control/administration?tab=tables')}>Administration → Bord</a>. Välj sedan den lanen här. Publiceringen kontrollerar att spelaren använder Nora.</p>:null}
          <LayerAssetSelect role="table" lane={lane} assets={project.layerAssets??[]} onChange={edit}/>
          <LayerAssetSelect role="background" lane={lane} assets={project.layerAssets??[]} onChange={edit}/>
          <fieldset><legend>Synliga lager</legend>{roles.map(role=><label className="check-field" key={role}><input type="checkbox" checked={lane.layers[role].enabled} onChange={event=>{const next=structuredClone(lane);next.layers[role].enabled=event.target.checked;edit(next);}}/>{labels[role]}</label>)}</fieldset>
          <label className="check-field"><input type="checkbox" checked={settings.tableFront} onChange={event=>{const next=structuredClone(lane);next.composition={...structuredClone(settings),tableFront:event.target.checked};edit(next);}}/>Bord framför dealern</label>
          <p>{compositing?'Greenscreen nycklas för detta klipp. Bord och bakgrund spelas som egna kanaler.':'Fullbildsklippet behåller sin bild. För separata lager väljer du greenscreen i dealerklippets filinställningar.'}</p>
          <details><summary>Greenscreen · klippets inställningar</summary>{compositing?<p>Tröskel {compositing.threshold.toFixed(2)} · Mjukhet {compositing.softness.toFixed(2)} · Grön färgreduktion {compositing.despill.toFixed(2)}</p>:<p>Fullbild utan nyckling.</p>}<a href={uploadHref}>Ändra i klippbiblioteket</a></details>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'16px 0'}}><button className="sg-btn sg-btn-secondary" aria-pressed={layout==='mobile'} onClick={()=>setLayout('mobile')}>Mobil 9:16</button><button className="sg-btn sg-btn-secondary" aria-pressed={layout==='desktop'} onClick={()=>setLayout('desktop')}>Desktop 16:9</button></div>
          <details><summary>Placering · {layout==='mobile'?'Mobil':'Desktop'}</summary>{roles.map(placementControls)}<button className="sg-btn sg-btn-secondary" onClick={()=>{const next=structuredClone(lane);next.composition={...structuredClone(settings),[layout]:defaultCompositionSettings()[layout]};edit(next);}}>Återställ placering</button></details>
          <p><a className="sg-btn sg-btn-secondary" href={labUrl('/control/lanes')}>Tillåtna val och publicering → Lanes</a></p>
        </section>
        <section aria-label="Komposition">
          <label className="field">Provklipp<select value={clip?.id??''} disabled={!clips.length} onChange={event=>setClipId(event.target.value)}>{!clips.length?<option value="">Inga dealerklipp ännu</option>:clips.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
          {!clips.length&&!localMedia.dealer?<p>Ladda upp ett klipp för {project.dealers.find(row=>row.id===lane.layers.dealer.default)?.label??lane.layers.dealer.default}, eller prova en lokal film nedan.</p>:null}
          {temporary?<p role="status"><strong>Tillfälligt filprov.</strong> Lokala filer finns bara i denna flik och följer inte med när lanen sparas eller publiceras.</p>:null}
          <CompositionPreview dealer={dealer} background={background} table={table} settings={settings} layout={layout} show={{dealer:lane.layers.dealer.enabled,background:lane.layers.background.enabled,table:lane.layers.table.enabled}} compositing={compositing}/>
          <p>Granska även två uppspelningar i spelets repetition innan ett nytt dealerpaket godkänns.</p>
        </section>
      </div>
      <details><summary>Snabbprov med tre lokala filer</summary><p>Prova dealerfilm, bord och bakgrund direkt. Registrera sedan filerna i klippbiblioteket och lagerbiblioteket för att använda dem i spelet.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16}}>{roles.map(role=><label className="field" key={role}>{labels[role]} · lokal fil<input type="file" accept={role==='dealer'?'video/mp4,video/webm':'image/png,image/jpeg,image/webp,video/mp4,video/webm'} onChange={event=>chooseLocal(role,event.target.files?.[0])}/></label>)}</div><label className="check-field"><input type="checkbox" checked={localKey} onChange={event=>setLocalKey(event.target.checked)}/>Nyckla grön bakgrund i lokal dealerfilm</label><button className="sg-btn sg-btn-secondary" disabled={!temporary} onClick={clearLocal}>Till sparade filer</button>{localError?<p role="alert">{localError}</p>:null}</details>
      <LayerLibrary available={initialStatus.provider==='neon'} project={project} dirty={dirty} onRegistered={next=>{setProject(next);setSavedJson(JSON.stringify(next));setNotice('Lagerfilen är sparad. Välj den i lanen och spara.');}}/>
      <details><summary>Frilagda dealerpaket · Paow och Dragge</summary><iframe loading="lazy" title="Förhandsvisning · lagerprov" src={labUrl('/preview/index.html')} style={{display:'block',width:'100%',height:'88vh',minHeight:720,border:0}}/></details>
      <details><summary>Avancerade verktyg</summary><p><a href={labUrl('/control/videos')}>Klippbibliotek</a> · <a href={labUrl('/control/zones')}>Bakgrundszoner</a> · <a href={labUrl('/control/events')}>Händelser och villkor</a></p></details>
    </div>
  </PageTemplate>;
}
