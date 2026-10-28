import {useEffect,useRef,useState} from 'react';
import {navigate,useSearchParams} from '../../../runtime/navigation';
import type {StudioProject,LayerAsset} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import {validateProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import {LayerLibrary} from '../../../../components/layer-library';
import {LayerAssetManager,type MaterialTrashPlanView} from '../../../../components/layer-asset-manager';
import {Play,Sparkles} from 'lucide-react';
import {ActionMenu} from '../ui/hub';
import {Button,buttonVariants,cn,plural} from '../ui/kit';
import {ConfirmDialog,Dialog} from '../ui/dialog';
import {layerAssetReferences} from '../../../../lib/layer-asset-removal.mjs';
import {materialLabel} from '../../../../../../packages/presentation/contracts/material-catalog.mjs';
import {layerAssetFitsGame} from '../../../../../../packages/presentation/contracts/layer-asset-contract.mjs';
import {createStudioClient} from '../../lib/connected-studio.mjs';

const client=createStudioClient();
// Mounted per tab under Scenmallar och material (Bakgrunder, Bordsgrafik); `trashOnly` is the role's part of the Papperskorg tab.
export function RegisteredMaterialLibrary({role,base='/admin/scenes',disabled,onChanged,refreshKey,visible=true,trashOnly=false}:{role:'background'|'table';base?:string;disabled:boolean;onChanged:()=>void;refreshKey:string;visible?:boolean;trashOnly?:boolean}){
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
  const noun=role==='background'?'bakgrunder':'bordsgrafik';
  const planDialog=(plan:MaterialTrashPlanView)=>{const impact=plan.impact,rooms=impact.rooms.map(room=>`${room.name} · ${impact.operators.find(operator=>operator.id===room.operatorId)?.name??'okänt bolag'}`);
    return <ConfirmDialog open title={impact.archived?`Flytta ${impact.label} till papperskorgen?`:`Återställ ${impact.label}?`} busy={plan.busy} busyLabel="Sparar…"
      description={impact.archived?'Filen kopplas loss där den används. Originalfilen och publicerad historik behålls.':'Filen blir valbar igen. Scenmallar och spelbord förblir oförändrade.'}
      consequences={impact.archived?[`Kopplas loss från ${plural(impact.compositions.length,'scenmall','scenmallar')}${impact.compositions.length?': '+impact.compositions.map(row=>row.label).join(', '):''}`,
        rooms.length?`${plural(rooms.length,'publicerat spelbord','publicerade spelbord')} avpubliceras och flyttas till papperskorgen: ${rooms.join(', ')}`:'Inga publicerade spelbord påverkas',
        ...(impact.operators.length?[`Publiceringen ändras hos ${impact.operators.map(row=>row.name).join(', ')}`]:[])]:[]}
      confirmLabel={impact.archived?'Flytta till papperskorgen':'Återställ'} danger={impact.archived} onConfirm={plan.onConfirm} onCancel={plan.onCancel}/>;};
  return <section className="grid gap-5" aria-label={trashOnly?'Papperskorg · '+noun:role==='background'?'Bakgrunder':'Bordsgrafik'} onPlayCapture={event=>{const media=event.target as HTMLMediaElement;if(preview.current!==media)preview.current?.pause();preview.current=media;if(!visible||document.hidden)media.pause();}}>
    {!trashOnly&&<p className="m-0 max-w-[72ch] text-sg-muted">{role==='background'?'Bakgrunder':'Bordsgrafik'} är delat material: ladda upp här, tillåt i en scenmall och välj per spelbord.</p>}
    {disabled&&<p role="status" className="m-0 rounded-lg bg-sg-warn-bg px-3.5 py-2.5 text-[13px] text-sg-warn">Spara klippkartans utkast innan du ändrar biblioteket.</p>}
    {error&&<p role="alert" className="m-0 flex flex-wrap items-center gap-3 rounded-lg bg-sg-warn-bg px-3.5 py-2.5 text-[13px] text-sg-warn">{error} <Button size="sm" disabled={busy||loading} onClick={()=>setReload(value=>value+1)}>Läs om biblioteket</Button></p>}
    {loading&&!project&&<div role="status" aria-label="Läser biblioteket…" className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">{[0,1,2,3].map(index=><div key={index} className="aspect-[4/3] animate-pulse rounded-xl border border-sg-border bg-sg-surface-2"/>)}</div>}
    {!trashOnly&&role==='table'&&<div className="flex flex-wrap items-center gap-2" role="group" aria-label="Bordets spel">{(['blackjack','roulette'] as const).map(value=><button key={value} type="button" aria-pressed={game===value} disabled={blocked} onClick={()=>select('game',value)}
      className={cn('inline-flex h-8 items-center rounded-full border px-3 text-[12.5px] font-semibold',game===value?'border-transparent bg-sg-ink text-sg-side-text':'border-sg-border bg-sg-surface text-sg-muted hover:text-sg-text')}>{value==='blackjack'?'Blackjack':'Roulette'}</button>)}</div>}
    {project&&<div className="grid gap-5">
      {!trashOnly&&<LayerLibrary role={role} game={game} disabled={blocked} onBusyChange={value=>operation('upload',value)} onRegistered={(remote,id)=>{
        if(!remote.layerAssets?.some(asset=>asset.id===id&&asset.role===role&&layerAssetFitsGame(asset,game))){setError('Registreringen kunde inte bekräftas för valt spel. Läs om innan du fortsätter.');return;}saved(remote);
      }} aside={<div className="grid min-w-[200px] place-content-center justify-items-center gap-1.5 rounded-xl border border-sg-border bg-sg-surface-2 px-5 py-4 text-center">
        <button type="button" disabled aria-describedby={'ai-'+role} className={buttonVariants({variant:'ink'})}><Sparkles aria-hidden="true"/>Skapa med AI</button>
        <span id={'ai-'+role} className="text-xs text-sg-faint">Kommer snart</span></div>}/>}
      <div className="material-library" id={trashOnly?'material-trash-'+role:undefined}><LayerAssetManager key={role+game+(trashOnly?':trash':'')} project={project} role={role} disabled={blocked} expanded view={trashOnly?'trash':'library'}
        filterAsset={trashOnly?undefined:asset=>layerAssetFitsGame(asset,game)} onBusyChange={value=>operation('trash',value)} onSaved={saved} renderPlan={planDialog}
        renderAsset={(asset,actions)=><MaterialCard asset={asset} references={layerAssetReferences(project,asset.id).map(row=>row.label)} {...actions}/>}/></div>
    </div>}
  </section>;
}

const checker={backgroundImage:'repeating-conic-gradient(var(--sg-hover) 0 25%, var(--sg-surface) 0 50%)',backgroundSize:'16px 16px'};
function MaterialCard({asset,references,disabled,onTrash}:{asset:LayerAsset;references:string[];disabled:boolean;onTrash:()=>void}){
  const video=useRef<HTMLVideoElement>(null);
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const [attempt,setAttempt]=useState(0),[playing,setPlaying]=useState(false),[playError,setPlayError]=useState('');
  const [panel,setPanel]=useState<''|'uses'|'details'>('');
  const isVideo=asset.contentType.startsWith('video/'),src='/studio/api/layer-assets/'+asset.id;
  const label=materialLabel(asset).replace(/_+/g,' ').replace(/\s+/g,' ').trim();
  const format=asset.contentType.split('/')[1]?.toUpperCase()||'FIL';
  async function play(){
    const element=video.current;if(!element)return;
    setPlayError('');setPlaying(true);element.muted=false;
    try{await element.play();}catch{setPlaying(false);setPlayError('Uppspelningen kunde inte starta. Försök igen.');}
  }
  return <article className="group grid min-w-0 overflow-hidden rounded-xl border border-sg-border bg-sg-surface shadow-sg transition-shadow hover:shadow-md" aria-label={label}>
    <div className="relative aspect-video overflow-hidden" style={checker}>
      {isVideo?<video key={attempt} ref={video} src={src+'#t=0.1'} preload="metadata" playsInline controls={playing}
        aria-label={'Förhandsvisning: '+label} onLoadedMetadata={()=>setState('ready')} onLoadedData={()=>setState('ready')} onError={()=>setState('error')}
        onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} className={cn('absolute inset-0 size-full object-contain transition-opacity',state==='ready'?'opacity-100':'opacity-0')}/>
        :<img key={attempt} src={src} alt={label} loading="lazy" onLoad={()=>setState('ready')} onError={()=>setState('error')}
          className={cn('absolute inset-0 size-full object-contain transition-opacity',state==='ready'?'opacity-100':'opacity-0')}/>}
      {state==='loading'&&<span className="absolute inset-0 grid place-items-center text-xs font-semibold text-sg-muted" role="status"><span className="absolute inset-0 animate-pulse bg-sg-surface-2"/><span className="relative">Läser förhandsvisning…</span></span>}
      {state==='error'&&<div className="absolute inset-0 grid place-content-center justify-items-center gap-2 bg-sg-surface-2 p-3 text-center"><p role="alert" className="m-0 text-[12.5px] text-sg-muted">Förhandsvisningen kunde inte läsas.</p>
        <button type="button" className={buttonVariants({size:'sm'})} onClick={()=>{setState('loading');setPlaying(false);setAttempt(value=>value+1);}}>Försök igen</button></div>}
      {isVideo&&state==='ready'&&!playing&&<button type="button" aria-label={'Spela '+label+' med ljud'} onClick={()=>void play()} className="absolute bottom-2.5 left-2.5 inline-flex h-8 items-center gap-1.5 rounded-full border-0 bg-[rgba(15,16,18,.72)] px-3 text-xs font-semibold text-white backdrop-blur hover:bg-[rgba(15,16,18,.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sg-lime"><Play className="size-3.5" aria-hidden="true"/>Spela med ljud</button>}
    </div>
    <div className="flex items-start gap-2 p-3.5">
      <div className="min-w-0 flex-1"><h2 title={label} className="m-0 truncate text-[14px] font-semibold text-sg-text">{label}</h2>
        <p className="m-0 text-[12.5px] text-sg-muted">{references.length?`Används i ${plural(references.length,'scenmall','scenmallar')}`:'Inte vald i någon scenmall'}</p>
        {playError&&<p role="alert" className="m-0 mt-1 text-[12.5px] text-sg-danger">{playError}</p>}</div>
      <ActionMenu small name={label} actions={[
        {id:'rename',label:'Byt namn',disabled:'Namnet sätts vid uppladdning; namnbyte sparas inte ännu.',onSelect:()=>{}},
        {id:'uses',label:'Visa var den används',onSelect:()=>setPanel('uses')},
        {id:'details',label:'Tekniska detaljer',onSelect:()=>setPanel('details')},
        {id:'trash',label:'Flytta till papperskorgen',tone:'danger',disabled:disabled?'Vänta tills den pågående ändringen är klar':undefined,onSelect:onTrash},
      ]}/>
    </div>
    <Dialog open={panel==='uses'} title={'Var '+label+' används'} onClose={()=>setPanel('')} footer={<Button onClick={()=>setPanel('')}>Stäng</Button>}>
      {references.length?<ul className="m-0 grid list-none gap-2 p-0">{references.map(name=><li key={name} className="rounded-lg bg-sg-surface-2 px-3 py-2 font-semibold">{name}</li>)}</ul>
        :<p className="m-0 text-sg-muted">Filen är inte vald i någon scenmall. Publicerade spelbord kontrolleras när du flyttar den till papperskorgen.</p>}
    </Dialog>
    <Dialog open={panel==='details'} title="Tekniska detaljer" description={label} onClose={()=>setPanel('')} footer={<Button onClick={()=>setPanel('')}>Stäng</Button>}>
      <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-1.5 text-[13px]">
        <dt className="text-sg-muted">Filnamn</dt><dd className="m-0 break-all">{asset.label}</dd>
        <dt className="text-sg-muted">Format</dt><dd className="m-0">{format}</dd>
        <dt className="text-sg-muted">Storlek</dt><dd className="m-0">{asset.width} × {asset.height} · {(asset.size/1024/1024).toLocaleString('sv-SE',{maximumFractionDigits:1})} MB</dd>
        <dt className="text-sg-muted">Material-id</dt><dd className="m-0 break-all font-mono text-xs">{asset.id}</dd>
        <dt className="text-sg-muted">SHA-256</dt><dd className="m-0 break-all font-mono text-xs">{asset.sha256}</dd>
      </dl>
    </Dialog>
  </article>;
}
