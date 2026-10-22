"use client"
import { useState, useRef, type ReactNode } from 'react';
import type { StudioProject, StudioLane } from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import { validateProject } from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import { defaultCompositionSettings, validateCompositionSettings } from '../../../../../../packages/presentation/contracts/composition-settings.mjs';
import { LayerLibrary } from '../../../../components/layer-library';
import { LayerAssetSelect } from '../../../../components/layer-selectors';
import { LayerAssetManager } from '../../../../components/layer-asset-manager';
import { BlackjackScenePlacementEditor } from '../../../../components/blackjack-scene-placement-editor';
import {moveCompositionLayer} from '../../../../../../packages/presentation/runtime/composition-anchors.mjs';
import { CompositionPreview } from '../../../../components/composition-preview';
import { CompositionZoomControls } from '../../../../components/composition-zoom-controls';
import { BackgroundPlaybackEditor } from '../../../../components/background-playback-editor';
import { effectiveDealerCompositing } from '../../../../../../packages/presentation/contracts/dealer-compositing.mjs';
import { layerAssetFitsGame } from '../../../../../../packages/presentation/contracts/layer-asset-contract.mjs';
import { rouletteReferencePreview } from '../../lib/roulette-clip-map.mjs';
import type { CompositionUse, Room, VideoInventory } from '../../lib/connected-studio.mjs';
import { setTemplateDealers } from '../../lib/dealer-directory.mjs';

export function StudioCompositionPanel({localReferenceUrl,project,savedProject,inventory,room,compositionId,game:requestedGame,dealerId,uses,roomChoicesPath,blocked,projectDirty,onEdit,onRegistered,onSaved,onBusyChange}:{localReferenceUrl?:string;project:StudioProject;savedProject:StudioProject|null;inventory:VideoInventory;room?:Room;compositionId?:string;game?:'blackjack'|'roulette';dealerId:string;uses:CompositionUse[];roomChoicesPath:string|null;blocked:boolean;projectDirty:boolean;onEdit:(project:StudioProject)=>void;onRegistered:(project:StudioProject,id:string,role:'background'|'table')=>void;onSaved:(project:StudioProject)=>void;onBusyChange:(busy:boolean)=>void}) {
  const [selectedLayout,setLayout]=useState<'mobile'|'desktop'>('mobile'),[error,setError]=useState('');
  const [uploadBusy,setUploadBusy]=useState(false);
  const [moveTogether,setMoveTogether]=useState(false);
  const [editingCompositionId,setEditingCompositionId]=useState('');
  const [backgroundPreview,setBackgroundPreview]=useState<{id:string;request:number}>({id:'',request:0});
  const operations=useRef(new Set<string>());
  function uploading(role:string,value:boolean) {if(value)operations.current.add(role);else operations.current.delete(role);const active=operations.current.size>0;setUploadBusy(active);onBusyChange(active);}
  const lane=project.lanes?.find(row=>row.id===(compositionId||room?.compositionId)),assets=project.layerAssets??[];
  const editing=Boolean(lane&&editingCompositionId===lane.id),locked=blocked||uploadBusy||!editing;
  const settings=lane?.composition??defaultCompositionSettings();
  const game=requestedGame??(room?.game==='roulette'?'roulette':'blackjack');
  const layout=game==='roulette'?'desktop':selectedLayout;
  const baseline=project.lines.find(row=>row.dealerId===dealerId&&row.eventId==='idle.ready');
  const selected=game==='roulette'?rouletteReferencePreview(inventory,dealerId):inventory.videos.find(row=>row.id===baseline?.variants.find(item=>item.id===baseline.baselineVariantId)?.videoGenerationId&&row.available&&!row.classification?.archived&&row.classification?.game!=='roulette'&&row.integrity!=='unavailable');
  const video=selected&&['image/png','video/mp4','video/webm'].includes(selected.contentType??'')?selected:null;
  const media=(id:string|null|undefined)=>{const asset=assets.find(row=>row.id===id&&layerAssetFitsGame(row,game));return asset?{url:'/studio/api/layer-assets/'+asset.id,label:asset.label,contentType:asset.contentType}:null;};
  function change(next:StudioLane) { if(locked||!lane)return;try{onEdit(validateProject({...project,lanes:project.lanes?.map(row=>row.id===lane.id?next:row)}));setError('');}catch(cause){setError((cause as Error).message);} }
  function placement(role:'dealer'|'background'|'table',field:'x'|'y'|'scale'|'width',value:number) {
    if(!lane)return;
    try{change({...lane,composition:moveCompositionLayer(settings,layout,role,field,value,moveTogether),renderer:'layered'});}catch(cause){setError((cause as Error).message);}
  }
  const tableAsset=assets.find(row=>row.id===lane?.layers.table.default&&row.role==='table'&&layerAssetFitsGame(row,game));
  if(!lane)return <section className="studio-detail-panel"><h2>Delad mall</h2><p role={compositionId?'alert':undefined}>{compositionId?'Den valda sammansättningen finns inte. Välj ett annat rum eller öppna en sparad sammansättning.':'Välj ett registrerat rum med en sparad sammansättning.'}</p></section>;
  const preview=(overlay?:ReactNode)=><CompositionPreview dealer={game==='roulette'&&localReferenceUrl?{url:localReferenceUrl,label:'Lokal VILA · inte sparad',contentType:'image/png'}:video?{url:video.previewUrl,label:video.label,contentType:video.contentType!}:null} background={media(lane.layers.background.default)} table={media(lane.layers.table.default)} overlay={overlay} settings={settings} layout={layout} show={{dealer:true,background:true,table:true}} compositing={game==='roulette'&&localReferenceUrl?{mode:'alpha'}:video?effectiveDealerCompositing(video.classification?.compositing):undefined} backgroundPlayback={lane.backgroundPlayback} backgroundAssets={assets.filter(row=>row.role==='background'&&lane.layers.background.allowed.includes(row.id)).map(row=>({id:row.id,url:'/studio/api/layer-assets/'+row.id,label:row.label,contentType:row.contentType}))} previewBackgroundRuleId={backgroundPreview.id} previewBackgroundRequest={backgroundPreview.request}/>;
  return <section className="studio-detail-panel" aria-label="Gemensam sammansättningsmall"><h2>{lane.label}</h2>
    <p>Standardlager, placering, tillåtna alternativ och automatik delas av alla rum som använder denna mall. Ändringarna sparas i det gemensamma projektutkastet; publicerade versioner behålls.</p>
    <div className="studio-layer-summary" role="list" aria-label="Scenens tre lager">{([
      {id:'background',title:'Bakgrund',name:media(lane.layers.background.default)?.label??'Ingen separat bakgrund',count:lane.layers.background.allowed.length,media:media(lane.layers.background.default)},
      {id:'dealer',title:'Dealer',name:project.dealers.find(row=>row.id===lane.layers.dealer.default)?.label??'Ingen förvald dealer',count:lane.layers.dealer.allowed.length,media:video?{url:video.previewUrl,label:video.label,contentType:video.contentType!}:null},
      {id:'table',title:'Bord',name:media(lane.layers.table.default)?.label??'Inget separat bord',count:lane.layers.table.allowed.length,media:media(lane.layers.table.default)},
    ] as const).map((tile,index)=><div key={tile.id} role="listitem" className={'studio-layer-tile is-'+tile.id}>
      <div className="studio-layer-tile-media" aria-hidden="true">{tile.media?tile.media.contentType.startsWith('video/')?<video src={tile.media.url+'#t=0.1'} muted playsInline preload="metadata" tabIndex={-1}/>:<img src={tile.media.url} alt=""/>:<span>Inget valt</span>}</div>
      <span className="studio-card-eyebrow">{index+1} · {tile.title}</span><strong>{tile.name}</strong><small>{tile.count} {tile.count===1?'tillåtet val':'tillåtna val'}</small>
    </div>)}</div>
    <p><strong>Rum som använder mallen:</strong></p>
    <ul>{uses.length?uses.map(use=><li key={use.roomId}>{use.operatorName} · {use.roomName}</li>):<li>Inga registrerade rum.</li>}</ul>
    {roomChoicesPath?<a className="studio-button" href={roomChoicesPath}>Ändra bara {room?.name}</a>:<p>Välj ett aktivt rum för att öppna dess egna val.</p>}
    <button className="studio-button" disabled={blocked||uploadBusy} aria-pressed={editing} onClick={()=>setEditingCompositionId(editing?'':lane.id)}>{editing?'Avsluta mallredigering':'Redigera gemensam mall'}</button>
    <fieldset disabled={locked} className="space-y-2"><legend>Dealers i den gemensamma mallen</legend>
      {project.dealers.map(dealer=><label key={dealer.id} className="flex items-center gap-2"><input type="checkbox" checked={lane.layers.dealer.allowed.includes(dealer.id)} onChange={event=>{
        const ids=event.target.checked?[...lane.layers.dealer.allowed,dealer.id]:lane.layers.dealer.allowed.filter(id=>id!==dealer.id);
        try{onEdit(setTemplateDealers(project,lane.id,ids,ids.includes(lane.layers.dealer.default)?lane.layers.dealer.default:ids[0]));setError('');}catch(cause){setError((cause as Error).message);}
      }}/>{dealer.label}</label>)}
      <label className="studio-field">Förvald dealer<select value={lane.layers.dealer.default} onChange={event=>{try{onEdit(setTemplateDealers(project,lane.id,lane.layers.dealer.allowed,event.target.value));setError('');}catch(cause){setError((cause as Error).message);}}}>{project.dealers.filter(row=>lane.layers.dealer.allowed.includes(row.id)).map(dealer=><option key={dealer.id} value={dealer.id}>{dealer.label}</option>)}</select></label>
    </fieldset>
    <div className="studio-game-tabs" role="tablist" aria-label="Kompositionsstorlek">{(['mobile','desktop'] as const).filter(id=>game!=='roulette'||id==='desktop').map(id=><button key={id} role="tab" aria-selected={layout===id} onClick={()=>setLayout(id)}>{id==='mobile'?'Mobil':'Desktop'}</button>)}</div>
    {game==='roulette'&&<><p>Roulette använder Desktop 16:9 även på mobil.</p><CompositionZoomControls settings={settings} disabled={locked} onChange={composition=>change({...lane,composition})}/></>}
    {game==='roulette'?<p>Förhandsvisningen använder dealerns roulette-VILA, annars första tillgängliga roulette-idle. Detta är ett materialprov; spelkoppling och godkännande återstår.</p>:null}
    {game==='blackjack'&&tableAsset?<BlackjackScenePlacementEditor tableId={tableAsset.id} layout={layout} disabled={locked}
      scene={{settings,width:tableAsset.width,height:tableAsset.height}} renderPreview={preview}
      value={settings.blackjackTables?.find(row=>row.tableId===tableAsset.id)}
      savedValue={savedProject?.lanes?.find(row=>row.id===lane.id)?.composition?.blackjackTables?.find(row=>row.tableId===tableAsset.id)}
      onChange={value=>{const next=structuredClone(settings),rows=(next.blackjackTables??[]).filter(row=>row.tableId!==tableAsset.id);
        if(value)rows.push(value);if(rows.length)next.blackjackTables=rows;else delete next.blackjackTables;
        try{change({...lane,composition:validateCompositionSettings(next),renderer:'layered'});}catch(cause){setError((cause as Error).message);}
      }}>
        <label className="flex items-center gap-2"><input type="checkbox" checked={moveTogether} disabled={locked} onChange={event=>setMoveTogether(event.target.checked)}/> Flytta scenen tillsammans · dealer och bord</label>
        <fieldset disabled={locked}><legend>Dealer</legend><div className="grid grid-cols-3 gap-2">{(['scale','x','y'] as const).map(field=><label key={field}>Dealer · {field==='scale'?'Skala':field.toUpperCase()}<input type="number" step={.01} min={field==='scale'?.1:-2} max={field==='scale'?4:2} value={settings[layout].dealer[field]} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))placement('dealer',field,event.target.valueAsNumber);}}/></label>)}</div></fieldset>
    {game==='blackjack'&&tableAsset&&<section className="studio-detail-panel" aria-label="Bordsprofil">
      <h3>Bordsprofil · {layout==='mobile'?'mobil':'desktop'}</h3>
      <p>{tableAsset.label}. Storlek och placering sparas separat för mobil och desktop. Mobilen kan visa ett bredare bord med tre spelplatser.</p>
      <fieldset disabled={locked} className="grid grid-cols-3 gap-2">
        <label className="studio-field">Bordsbredd · %<input type="number" min="10" max="400" step="1" value={Math.round(settings[layout].table.width*100)} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))placement('table','width',event.target.valueAsNumber/100);}}/></label>
        <label className="studio-field">Bord vågrätt · %<input type="number" min="-200" max="200" step="1" value={Math.round(settings[layout].table.x*100)} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))placement('table','x',event.target.valueAsNumber/100);}}/></label>
        <label className="studio-field">Bord lodrätt · %<input type="number" min="-200" max="200" step="1" value={Math.round(settings[layout].table.y*100)} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))placement('table','y',event.target.valueAsNumber/100);}}/></label>
      </fieldset>

    </section>}
      </BlackjackScenePlacementEditor>:preview()}
    {!(game==='blackjack'&&tableAsset)&&<label className="flex items-center gap-2"><input type="checkbox" checked={moveTogether} disabled={locked} onChange={event=>setMoveTogether(event.target.checked)}/> Flytta scenen tillsammans · dealer och bord</label>}
    <details open={game==='roulette'||undefined}><summary>Storlek och placering · {layout==='mobile'?'mobil':'desktop'}</summary><fieldset disabled={locked}>{(game==='blackjack'&&tableAsset?(['background'] as const):(['dealer','background','table'] as const)).map(role=><div key={role} className="grid grid-cols-3 gap-2 py-2">{([role==='table'?'width':'scale','x','y'] as const).map(field=><label key={field} className="studio-field">{role==='dealer'?'Dealer':role==='background'?'Bakgrund':'Bord'} · {field==='width'?'Bredd':field==='scale'?'Skala':field.toUpperCase()}<input type="number" step={.01} min={field==='x'||field==='y'?-2:.1} max={field==='x'||field==='y'?2:4} value={(settings[layout][role] as unknown as Record<string,number>)[field]} onChange={event=>{try{placement(role,field,Number(event.target.value));}catch(cause){setError((cause as Error).message);}}}/></label>)}</div>)}<label><input type="checkbox" checked={settings.tableFront} onChange={event=>change({...lane,composition:{...settings,tableFront:event.target.checked}})}/> Bord framför dealer</label></fieldset></details>
    <fieldset disabled={locked} className="space-y-4">{(['background','table'] as const).map(role=><div key={role} className="space-y-3">
      <LayerAssetSelect role={role} lane={lane} assets={assets} game={game} permissions onChange={change}/>
      <LayerLibrary role={role} game={game} disabled={locked} onBusyChange={value=>uploading(role,value)} onRegistered={(remote,id)=>onRegistered(remote,id,role)}/>
      {projectDirty&&<p>Spara eller lös ditt utkast innan du använder papperskorgen.</p>}
      <div className="studio-material-controls"><LayerAssetManager project={project} role={role} disabled={locked||projectDirty} onSaved={onSaved} onBusyChange={value=>uploading('trash-'+role,value)}/></div>
    </div>)}</fieldset>

    <BackgroundPlaybackEditor policy={lane.backgroundPlayback} assets={assets} allowed={lane.layers.background.allowed} baseSelected={lane.layers.background.enabled&&Boolean(lane.layers.background.default)} disabled={locked} onChange={policy=>{const next=structuredClone(lane);if(policy)next.backgroundPlayback=policy;else delete next.backgroundPlayback;change(next);}} onPreview={id=>setBackgroundPreview(current=>({id,request:current.request+1}))}/>
    <details><summary>Automatik / OpenClaw</summary><fieldset disabled={locked} className="grid grid-cols-2 gap-3">{(['idle','deal','reveal','speak','probe'] as const).map(phase=><label key={phase} className="studio-field">{({idle:'Vänta',deal:'Deal',reveal:'Visa',speak:'Tal',probe:'Bildgranskning'})[phase]}<select value={lane.openclaw[phase]} onChange={event=>change({...lane,openclaw:{...lane.openclaw,[phase]:event.target.value}})}>{[['off','Av'],['rules','Regler'],['random','Slump'],['shadow','Skuggläge'],['active','Aktiv']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>)}</fieldset></details>
    {error&&<p role="alert">{error}</p>}
  </section>;
}
