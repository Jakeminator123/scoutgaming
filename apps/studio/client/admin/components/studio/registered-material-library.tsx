import {useEffect,useRef,useState} from 'react';
import {navigate,useSearchParams} from '../../../runtime/navigation';
import type {StudioProject,LayerAsset} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import {validateProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import {LayerLibrary} from '../../../../components/layer-library';
import {LayerAssetManager} from '../../../../components/layer-asset-manager';
import {layerAssetReferences} from '../../../../lib/layer-asset-removal.mjs';
import {materialLabel} from '../../../../../../packages/presentation/contracts/material-catalog.mjs';
import {layerAssetFitsGame} from '../../../../../../packages/presentation/contracts/layer-asset-contract.mjs';
import {createStudioClient} from '../../lib/connected-studio.mjs';

const client=createStudioClient();
// Mounted per tab under Scenmallar och material (Bakgrunder, Bordsgrafik); the trash per role sits at #material-trash.
export function RegisteredMaterialLibrary({role,base='/admin/scenes',disabled,onChanged,refreshKey,visible=true}:{role:'background'|'table';base?:string;disabled:boolean;onChanged:()=>void;refreshKey:string;visible?:boolean}){
  const [project,setProject]=useState<StudioProject|null>(null),[error,setError]=useState('');
  const query=useSearchParams();
  const game=query.get('game')==='roulette'?'roulette':'blackjack';
  function select(key:'game',value:string){const next=new URLSearchParams(query.toString());next.set(key,value);next.set('tab',role==='background'?'bakgrunder':'bordsgrafik');navigate(base+'?'+next);}
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [reload,setReload]=useState(0);
  const active=useRef(new Set<string>()),busyRef=useRef(false);
  const preview=useRef<HTMLMediaElement|null>(null);
  useEffect(()=>{if(!visible)preview.current?.pause();return()=>preview.current?.pause();},[visible]);
  useEffect(()=>{const hide=()=>{if(document.hidden)preview.current?.pause();};document.addEventListener('visibilitychange',hide);return()=>{document.removeEventListener('visibilitychange',hide);preview.current?.pause();};},[]);
  useEffect(()=>{if(busy)return;const controller=new AbortController();setLoading(true);setError('');void client.load(controller.signal).then(value=>{
    if(!controller.signal.aborted)setProject(value.project);
  }).catch(()=>{if(!controller.signal.aborted)setError('Biblioteket kunde inte läsas. Kontrollera inloggningen och läs om.');})
    .finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[refreshKey,busy,reload]);
  useEffect(()=>{const unload=(event:BeforeUnloadEvent)=>{if(busyRef.current){event.preventDefault();event.returnValue='';}};
    const leave=(event:Event)=>{if(busyRef.current)event.preventDefault();};
    window.addEventListener('beforeunload',unload);window.addEventListener('scout:navigate',leave);
    return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener('scout:navigate',leave);};},[]);
  const blocked=disabled||busy||loading||Boolean(error);
  function operation(key:string,value:boolean){if(value)active.current.add(key);else active.current.delete(key);busyRef.current=active.current.size>0;setBusy(busyRef.current);}
  function saved(remote:StudioProject){validateProject(remote);setProject(remote);setError('');onChanged();}
  return <section className="studio-material-workspace space-y-5" aria-label={role==='background'?'Bakgrunder':'Bordsgrafik'} onPlayCapture={event=>{const media=event.target as HTMLMediaElement;if(preview.current!==media)preview.current?.pause();preview.current=media;if(!visible||document.hidden)media.pause();}}>
    <p className="hub-muted">{role==='background'?'Bakgrunder':'Bordsgrafik'} är delat material: ladda upp här, tillåt i en scenmall och välj per spelbord. Ladda upp png, jpg, webp, mp4 eller webm, högst 128 MB.</p>
    {disabled&&<p role="status">Spara eller lös klippkartans utkast innan du ändrar biblioteket.</p>}
    {error&&<p role="alert">{error} <button className="studio-button" disabled={busy||loading} onClick={()=>setReload(value=>value+1)}>Läs om biblioteket</button></p>}{loading&&<p role="status">Läser det skyddade biblioteket…</p>}
    {role==='table'&&<label className="studio-field">Spelet som bordet tillhör<select aria-label="Bordets spel" value={game} disabled={blocked} onChange={event=>select('game',event.target.value)}><option value="blackjack">Blackjack</option><option value="roulette">Roulette</option></select></label>}
    {project&&<div className="space-y-5">
      <LayerLibrary role={role} game={game} disabled={blocked} onBusyChange={value=>operation('upload',value)} onRegistered={(remote,id)=>{
        if(!remote.layerAssets?.some(asset=>asset.id===id&&asset.role===role&&layerAssetFitsGame(asset,game))){setError('Registreringen kunde inte bekräftas för valt spel. Läs om innan du fortsätter.');return;}saved(remote);
      }}/>
      <div className="studio-material-controls material-library" id="material-trash"><LayerAssetManager key={role+game} project={project} role={role} disabled={blocked} expanded
        filterAsset={asset=>layerAssetFitsGame(asset,game)} onBusyChange={value=>operation('trash',value)} onSaved={saved}
        renderAsset={(asset,actions)=><MaterialCard asset={asset} references={layerAssetReferences(project,asset.id).map(row=>row.label)} {...actions}/>}/></div>
    </div>}
  </section>;
}

function MaterialCard({asset,references,disabled,onTrash}:{asset:LayerAsset;references:string[];disabled:boolean;onTrash:()=>void}){
  const video=useRef<HTMLVideoElement>(null);
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const [attempt,setAttempt]=useState(0),[playing,setPlaying]=useState(false),[playError,setPlayError]=useState('');
  const isVideo=asset.contentType.startsWith('video/'),src='/studio/api/layer-assets/'+asset.id;
  const label=materialLabel(asset).replace(/_+/g,' ').replace(/\s+/g,' ').trim();
  const format=asset.contentType.split('/')[1]?.toUpperCase()||'FIL';
  async function play(){
    const element=video.current;if(!element)return;
    setPlayError('');setPlaying(true);element.muted=false;
    try{await element.play();}catch{setPlaying(false);setPlayError('Uppspelningen kunde inte starta. Försök igen.');}
  }
  return <article className="material-card" aria-label={label}>
    <div className="material-preview">
      {isVideo?<video key={attempt} ref={video} src={src+'#t=0.1'} preload="metadata" playsInline controls={playing}
        aria-label={'Förhandsvisning: '+label} onLoadedMetadata={()=>setState('ready')} onLoadedData={()=>setState('ready')} onError={()=>setState('error')}
        onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} className={state==='ready'?'':'material-pending'}/>
        :<img key={attempt} src={src} alt={label} loading="lazy" onLoad={()=>setState('ready')} onError={()=>setState('error')}
          className={state==='ready'?'':'material-pending'}/>}
      {state==='loading'&&<span className="material-preview-status" role="status">Läser förhandsvisning…</span>}
      {state==='error'&&<div className="material-preview-status"><p role="alert">Förhandsvisningen kunde inte läsas.</p>
        <button type="button" onClick={()=>{setState('loading');setPlaying(false);setAttempt(value=>value+1);}}>Försök igen</button></div>}
      {isVideo&&state==='ready'&&!playing&&<button type="button" className="material-play" aria-label={'Spela '+label+' med ljud'} onClick={()=>void play()}>▶ Spela med ljud</button>}
      <span className="material-format">{format}</span>
    </div>
    <div className="material-card-body">
      <h2 title={label}>{label}</h2>
      <p className="material-usage">{references.length?'Vald i utkast: '+references.join(', '):'Inte vald i något utkast. Övrig användning kontrolleras före borttagning.'}</p>
      {playError&&<p role="alert">{playError}</p>}
      <details><summary>Detaljer</summary><dl>
        <dt>Filnamn</dt><dd>{asset.label}</dd>
        <dt>Storlek</dt><dd>{asset.width} × {asset.height} · {(asset.size/1024/1024).toLocaleString('sv-SE',{maximumFractionDigits:1})} MB</dd>
        <dt>Material-ID</dt><dd>{asset.id}</dd>
        <dt>SHA-256</dt><dd>{asset.sha256}</dd>
      </dl></details>
      <button type="button" className="material-trash" disabled={disabled} aria-label={'Flytta '+label+' till papperskorgen'} onClick={onTrash}>Flytta till papperskorgen…</button>
    </div>
  </article>;
}
