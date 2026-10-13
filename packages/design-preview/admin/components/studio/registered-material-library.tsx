import {useEffect,useRef,useState} from 'react';
import type {StudioProject} from '../../../../../lab/lib/studio-model.mjs';
import {validateProject} from '../../../../../lab/lib/studio-model.mjs';
import {LayerLibrary} from '../../../../../lab/components/layer-library';
import {LayerAssetManager} from '../../../../../lab/components/layer-asset-manager';
import {materialLabel} from '../../../../../web/public/material-catalog.mjs';
import {createStudioClient} from '../../lib/connected-studio.mjs';

const client=createStudioClient();
export function RegisteredMaterialLibrary({disabled,onChanged,refreshKey}:{disabled:boolean;onChanged:()=>void;refreshKey:string}){
  const [project,setProject]=useState<StudioProject|null>(null),[error,setError]=useState('');
  const [role,setRole]=useState<'table'|'background'>(()=>new URLSearchParams(location.search).get('tab')==='backgrounds'?'background':'table');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [reload,setReload]=useState(0);
  const active=useRef(new Set<string>()),busyRef=useRef(false);
  useEffect(()=>{if(busy)return;const controller=new AbortController();setLoading(true);setError('');void client.load(controller.signal).then(value=>{
    if(!controller.signal.aborted)setProject(value.project);
  }).catch(()=>{if(!controller.signal.aborted)setError('Biblioteket kunde inte läsas. Kontrollera N1-sessionen och läs om.');})
    .finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[refreshKey,busy,reload]);
  useEffect(()=>{const unload=(event:BeforeUnloadEvent)=>{if(busyRef.current){event.preventDefault();event.returnValue='';}};
    const leave=(event:Event)=>{if(busyRef.current)event.preventDefault();};
    window.addEventListener('beforeunload',unload);window.addEventListener('scout:navigate',leave);
    return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener('scout:navigate',leave);};},[]);
  const blocked=disabled||busy||loading||Boolean(error);
  function operation(key:string,value:boolean){if(value)active.current.add(key);else active.current.delete(key);busyRef.current=active.current.size>0;setBusy(busyRef.current);}
  function saved(remote:StudioProject){validateProject(remote);setProject(remote);setError('');onChanged();}
  return <section className="p-6 space-y-5" aria-label="Bord och bakgrunder">
    <h1 className="text-2xl font-semibold">Bord & bakgrunder</h1><p>Gemensamma original. Välj dem sedan i rummets sammansättning.</p>
    {disabled&&<p role="status">Spara eller lös ditt Studio-utkast innan du ändrar biblioteket.</p>}
    {error&&<p role="alert">{error} <button className="studio-button" disabled={busy||loading} onClick={()=>setReload(value=>value+1)}>Läs om biblioteket</button></p>}{loading&&<p role="status">Läser det skyddade biblioteket…</p>}
    <div role="tablist" aria-label="Bibliotekstyp">{(['table','background'] as const).map(value=><button key={value} role="tab" aria-selected={value===role} disabled={busy} className="studio-button" onClick={()=>setRole(value)}>{value==='table'?'Bord':'Bakgrunder'}</button>)}</div>
    {project&&<div className="space-y-5">
      <LayerLibrary role={role} disabled={blocked} onBusyChange={value=>operation('upload',value)} onRegistered={(remote,id)=>{
        if(!remote.layerAssets?.some(asset=>asset.id===id&&asset.role===role)){setError('Registreringen kunde inte bekräftas. Läs om innan du fortsätter.');return;}saved(remote);
      }}/>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{(project.layerAssets??[]).filter(asset=>asset.role===role).map(asset=><li key={asset.id} className="rounded border border-sg-line p-3">
        {asset.contentType.startsWith('video/')?<video src={'/studio/api/layer-assets/'+asset.id} controls playsInline preload="none" aria-label={materialLabel(asset)}/>:<img src={'/studio/api/layer-assets/'+asset.id} alt={materialLabel(asset)} loading="lazy" className="h-40 w-full object-contain"/>}
        <h2>{materialLabel(asset)}</h2><p>{asset.width} × {asset.height}</p>
      </li>)}</ul>
      <div className="studio-material-controls"><LayerAssetManager key={role} project={project} role={role} disabled={blocked} expanded onBusyChange={value=>operation('trash',value)} onSaved={saved}/></div>
    </div>}
  </section>;
}
