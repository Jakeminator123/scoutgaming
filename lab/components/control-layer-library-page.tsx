'use client';

import {useEffect,useRef,useState} from 'react';
import type {StudioProject} from '../lib/studio-model.mjs';
import {labUrl} from '../lib/lab-url.mjs';
import {registerLibraryLayer,validateLibraryDraft} from '../lib/layer-library-draft.mjs';
import {layerAssetReferences} from '../lib/layer-asset-removal.mjs';
import {PageTemplate} from './page-template.mjs';
import {LayerLibrary} from './layer-library';
import {LayerAssetManager} from './layer-asset-manager';
import {ProjectConflict} from './project-conflict';
import {StudioMessages,useStudioProjectSession} from './studio-session';
import type {ConnectionStatus,VideoInventory} from './studio-types';
import styles from './control-layer-library-page.module.css';

type Role='table'|'background';
const roles:Role[]=['table','background'];
const labels={table:'Bord',background:'Bakgrunder'};

export function ControlLayerLibraryPage({initialProject,initialVideos,initialStatus,initialRole='table'}:{initialProject:StudioProject;initialVideos:VideoInventory;initialStatus:ConnectionStatus;initialRole?:Role}) {
  const session=useStudioProjectSession({initialProject,initialVideos,initialStatus});
  const {project,projectRef,dirty,saving,save,error,notice,setError,setNotice,conflict,setConflict,savedJson,setSavedJson,setProject}=session;
  const [role,setRole]=useState<Role>(initialRole),[uploading,setUploading]=useState(false);
  const uploadingRef=useRef(false),savedBaseline=useRef(savedJson);savedBaseline.current=savedJson;
  const blocked=saving||uploading||conflict;
  useEffect(()=>{
    const guard=(event:BeforeUnloadEvent)=>{if(uploadingRef.current){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);
  },[]);
  function busyChanged(busy:boolean){uploadingRef.current=busy;setUploading(busy);}
  function registered(remote:StudioProject,id:string,assetRole:Role){
    try {
      const result=registerLibraryLayer(JSON.parse(savedBaseline.current),projectRef.current,remote,{id,role:assetRole});
      projectRef.current=result.project;setProject(result.project);
      if(result.conflicts.length){setConflict(true);setError('Filen är registrerad. Projektet har också ändrats i en annan vy; granska sammanslagningen innan du sparar.');}
      else {savedBaseline.current=JSON.stringify(remote);setSavedJson(savedBaseline.current);setError('');setNotice('Filen finns i biblioteket. Välj den i en sammansättning när du vill använda den.');}
    } catch {
      setConflict(true);setError('Uppladdningen behöver kontrolleras mot den senaste projektversionen. Ditt utkast är kvar; hämta och granska ändringarna innan du sparar.');
    }
  }
  function chooseRole(next:Role){
    if(saving||uploadingRef.current)return;setRole(next);
    if(typeof window!=='undefined'){
      const url=new URL(window.location.href);url.searchParams.set('tab',next==='table'?'tables':'backgrounds');
      window.history.replaceState(null,'',url.pathname+url.search+url.hash);
    }
  }
  return <PageTemplate eyebrow="// STUDIO" title="Bord & bakgrunder" intro="Gemensamma filer för dina sammansättningar. Ladda upp, granska användning och hantera papperskorgen här."
    primary={<button type="button" className="sg-btn sg-btn-primary" disabled={!dirty||blocked} onClick={()=>{if(!uploadingRef.current&&!saving&&!conflict)void save();}}>{saving?'Sparar…':'Spara bibliotek'}</button>}>
    <div className="sg-page-body">
      <nav className={styles.breadcrumbs} aria-label="Brödsmulor i Studio"><a href={labUrl('/control/clips')}>Studio</a><span aria-hidden="true">/</span><span aria-current="page">Bord & bakgrunder</span></nav>
      <StudioMessages error={error} notice={notice} setError={setError} setNotice={setNotice}/>
      {conflict?<ProjectConflict base={JSON.parse(savedJson)} draft={project} onResolve={(remote,merged)=>{
        try {validateLibraryDraft(merged,JSON.parse(savedBaseline.current),remote);}
        catch(cause){setError(cause instanceof Error?cause.message:'Biblioteket kunde inte slås ihop. Ditt utkast är kvar.');return;}
        savedBaseline.current=JSON.stringify(remote);setSavedJson(savedBaseline.current);projectRef.current=merged;setProject(merged);setConflict(false);setError('');setNotice('Utkastet är sammanslaget. Granska biblioteket och spara.');
      }}/>:null}
      <div className={styles.tabs} role="tablist" aria-label="Typ av biblioteksfil">{roles.map(item=><button key={item} type="button" role="tab" id={`library-tab-${item}`} aria-controls={`library-panel-${item}`} aria-selected={role===item} tabIndex={role===item?0:-1} disabled={saving||uploading} className={role===item?styles.activeTab:styles.tab} onClick={()=>chooseRole(item)} onKeyDown={event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||saving||uploadingRef.current)return;
        event.preventDefault();const next=event.key==='Home'?'table':event.key==='End'?'background':item==='table'?'background':'table';
        chooseRole(next);document.getElementById(`library-tab-${next}`)?.focus();
      }}>{labels[item]} <span>{(project.layerAssets??[]).filter(asset=>asset.role===item).length}</span></button>)}</div>
      {roles.map(item=>{
        const assets=(project.layerAssets??[]).filter(asset=>asset.role===item);
        return <section key={item} id={`library-panel-${item}`} role="tabpanel" aria-labelledby={`library-tab-${item}`} tabIndex={0} hidden={role!==item} className={styles.panel}>
          <div className={styles.upload}><h2>{labels[item]}</h2><p>Uppladdade filer sparas direkt i biblioteket. Dina val av bord och bakgrund görs i Sammansättningar.</p><LayerLibrary role={item} available={initialStatus.provider==='neon'} disabled={blocked} onBusyChange={busyChanged} onRegistered={(remote,id)=>registered(remote,id,item)}/></div>
          {assets.length?<ul className={styles.assets}>{assets.map(asset=>{
            const uses=layerAssetReferences(project,asset.id),src=labUrl(`/api/layer-assets/${encodeURIComponent(asset.id)}`);
            return <li className={styles.asset} key={asset.id}><div className={styles.preview}>{asset.contentType.startsWith('video/')?<video src={src} controls playsInline preload="none" aria-label={asset.label}/>:<img src={src} alt={asset.label} loading="lazy"/>}</div><div className={styles.assetInfo}><h3>{asset.label}</h3><p>{asset.contentType.startsWith('video/')?'Video':'Bild'} · {asset.width} × {asset.height}</p>{uses.length?<p>Används i {uses.map((use,index)=><span key={use.id}>{index?', ':''}<a href={labUrl(`/control/compositions?composition=${encodeURIComponent(use.id)}`)}>{use.label}</a></span>)}</p>:<p>Ledig att välja i en sammansättning.</p>}</div></li>;
          })}</ul>:<p className={styles.empty}>Inga {item==='table'?'bord':'bakgrunder'} ännu. Ladda upp den första filen ovan.</p>}
          <div className={styles.management}>{dirty?<p>Spara eller lös ditt utkast innan du använder papperskorgen.</p>:null}<LayerAssetManager project={project} role={item} disabled={blocked||dirty} expanded onBusyChange={busyChanged} onSaved={remote=>{
            savedBaseline.current=JSON.stringify(remote);setSavedJson(savedBaseline.current);projectRef.current=remote;setProject(remote);setConflict(false);
          }}/></div>
        </section>;
      })}
    </div>
  </PageTemplate>;
}
