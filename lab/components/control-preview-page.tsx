'use client';
import {useRef,useState} from 'react';
import {labUrl} from '../lib/lab-url.mjs';
import {defaultPresentationLane,validateProject,type StudioProject,type StudioLane} from '../lib/studio-model.mjs';
import {PageTemplate} from './page-template.mjs';
import {useStudioSession} from './studio-session';
import {LayerAssetSelect} from './layer-selectors';
import {LayerLibrary} from './layer-library';
import {ProjectConflict} from './project-conflict';
import type {VideoInventory,ConnectionStatus} from './studio-types';

export function ControlPreviewPage({initialProject,initialVideos,initialStatus}:{initialProject:StudioProject;initialVideos:VideoInventory;initialStatus:ConnectionStatus}) {
  const session=useStudioSession({initialProject,initialVideos,initialStatus});
  const {project,modelEdit,dirty,saving,save,error,notice,savedJson,setSavedJson,setProject,setConflict,setError,setNotice,conflict}=session;
  const [laneId,setLaneId]=useState(project.lanes?.[0]?.id??'mobile-phone');
  const [clipId,setClipId]=useState(''),[plays,setPlays]=useState(0);
  const videoRef=useRef<HTMLVideoElement>(null);
  const lanes=project.lanes?.length?project.lanes:[defaultPresentationLane()];
  const lane=lanes.find(row=>row.id===laneId)??lanes[0];
  const clips=initialVideos.videos.filter(video=>video.available&&(video.dealer===lane.layers.dealer.default||video.classification?.dealerId===lane.layers.dealer.default));
  const clip=clips.find(video=>video.id===clipId)??clips[0];
  const edit=(next:StudioLane)=>modelEdit(current=>validateProject({...current,lanes:lanes.map(row=>row.id===lane.id?{...next,renderer:'layered'}:row)}));
  const stage={position:'relative',width:'100%',aspectRatio:'9 / 16',maxHeight:'70vh',background:'var(--sg-surface)',overflow:'hidden'} as const;
  function assetPlane(role:'background'|'table') {
    const asset=project.layerAssets?.find(row=>row.id===lane.layers[role].default);
    if(!lane.layers[role].enabled||!asset)return null;
    const style={position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain',zIndex:role==='background'?0:1} as const;
    return asset.contentType.startsWith('video/')?<video key={asset.id} src={labUrl(`/api/layer-assets/${asset.id}`)} style={style} playsInline muted loop autoPlay aria-label={asset.label}/>:<img src={labUrl(`/api/layer-assets/${asset.id}`)} alt={asset.label} style={style}/>;
  }
  return <PageTemplate eyebrow="// STUDIO" title="Förhandsvisning" intro="Välj dealer, bord och bakgrund. Spara lanen och exportera den till ett spelbolag under Lanes."
    primary={<button className="sg-btn sg-btn-primary" disabled={!dirty||saving} onClick={()=>void save()}>{saving?'Sparar…':'Spara lane'}</button>}>
    <div className="sg-page-body">
      {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
      {conflict?<ProjectConflict base={JSON.parse(savedJson)} draft={project} onResolve={(remote,merged)=>{setSavedJson(JSON.stringify(remote));setProject(merged);setConflict(false);setError('');setNotice('Granska sammanslagningen och spara.');}}/>:null}
      <label className="field">Lane<select value={lane.id} onChange={event=>{setLaneId(event.target.value);setClipId('');}}>{lanes.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:24}}>
        <section aria-label="Tre lager">
          <label className="field">Dealer<select value={lane.layers.dealer.default} onChange={event=>{const next=structuredClone(lane);next.layers.dealer.default=event.target.value;if(!next.layers.dealer.allowed.includes(event.target.value))next.layers.dealer.allowed.push(event.target.value);edit(next);setClipId('');}}>{lane.dealers.map(id=><option key={id} value={id}>{project.dealers.find(row=>row.id===id)?.label??id}</option>)}</select></label>
          <LayerAssetSelect role="table" lane={lane} assets={project.layerAssets??[]} onChange={edit}/>
          <LayerAssetSelect role="background" lane={lane} assets={project.layerAssets??[]} onChange={edit}/>
          <fieldset><legend>Synliga lager</legend>{(['dealer','table','background'] as const).map(role=><label className="check-field" key={role}><input type="checkbox" checked={lane.layers[role].enabled} onChange={event=>{const next=structuredClone(lane);next.layers[role].enabled=event.target.checked;edit(next);}}/>{role==='dealer'?'Dealer':role==='table'?'Bord':'Bakgrund'}</label>)}</fieldset>
          <p>Godkända fullbildsklipp innehåller bord och bakgrund. Separata val förändrar inte filmens inbakade pixlar. Frilagda dealerpaket provas nedan.</p>
          <a className="sg-btn sg-btn-secondary" href={labUrl('/control/lanes')}>Tillåtna val och export → Lanes</a>
        </section>
        <section aria-label="Komposition">
          <div style={stage}>{assetPlane('background')}{assetPlane('table')}{lane.layers.dealer.enabled&&clip?<video key={clip.id} ref={videoRef} src={labUrl(clip.previewUrl)} controls playsInline preload="metadata" onEnded={()=>{if(plays>1){setPlays(plays-1);if(videoRef.current){videoRef.current.currentTime=0;void videoRef.current.play();}}else setPlays(0);}} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain',zIndex:2}}/>:null}</div>
          <label className="field">Provklipp<select value={clip?.id??''} onChange={event=>{setClipId(event.target.value);setPlays(0);}}>{clips.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
          <button className="sg-btn sg-btn-secondary" disabled={!clip} onClick={()=>{setPlays(2);if(videoRef.current){videoRef.current.currentTime=0;void videoRef.current.play();}}}>Spela två gånger</button>
          <p>Visuellt prov. Godkänn även i spelets repetition innan ett nytt dealerpaket aktiveras.</p>
        </section>
      </div>
      <LayerLibrary available={initialStatus.provider==='neon'} project={project} dirty={dirty} onRegistered={next=>{setProject(next);setSavedJson(JSON.stringify(next));setNotice('Lagerfilen är sparad. Välj den i lanen och spara.');}}/>
      <details><summary>Frilagda dealerpaket · Paow och Dragge</summary><iframe title="Förhandsvisning · lagerprov" src={labUrl('/preview/index.html')} style={{display:'block',width:'100%',height:'88vh',minHeight:720,border:0}}/></details>
      <details><summary>Avancerade verktyg</summary><p><a href={labUrl('/control/videos')}>Klippbibliotek</a> · <a href={labUrl('/control/zones')}>Bakgrundszoner</a> · <a href={labUrl('/control/events')}>Händelser och villkor</a></p></details>
    </div>
  </PageTemplate>;
}
