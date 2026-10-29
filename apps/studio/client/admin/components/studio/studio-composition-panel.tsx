"use client"
import { useState, useRef, type ReactNode } from 'react';
import type { StudioProject, StudioLane } from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import { validateProject } from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import { defaultCompositionSettings, validateCompositionSettings } from '../../../../../../packages/presentation/contracts/composition-settings.mjs';
import { ScenePublication } from './scene-publication';
import { CompositionMetadata } from '../../../../components/lane-editor';
import { LayerLibrary } from '../../../../components/layer-library';
import { LayerAssetSelect } from '../../../../components/layer-selectors';
import { LayerAssetManager } from '../../../../components/layer-asset-manager';
import { BlackjackScenePlacementEditor } from '../../../../components/blackjack-scene-placement-editor';
import {moveCompositionLayer} from '../../../../../../packages/presentation/runtime/composition-anchors.mjs';
import { CompositionPreview } from '../../../../components/composition-preview';
import { CompositionZoomControls } from '../../../../components/composition-zoom-controls';
import { BackgroundPlaybackEditor, LayerPlaybackEditor } from '../../../../components/background-playback-editor';
import { effectiveDealerCompositing } from '../../../../../../packages/presentation/contracts/dealer-compositing.mjs';
import { useScenePreviewMedia } from '../../lib/scene-preview-media.mjs';
import type { CompositionUse, Room, VideoInventory } from '../../lib/connected-studio.mjs';
import { setTemplateDealers } from '../../lib/dealer-directory.mjs';

export function StudioCompositionPanel({operatorId,operatorSlug,operatorName,localReferenceUrl,project,savedProject,inventory,room,compositionId,onSelect,game:requestedGame,dealerId,uses,roomChoicesPath,blocked,projectDirty,onEdit,onRegistered,onSaved,onBusyChange,inEnvironment=false}:{inEnvironment?:boolean;operatorId?:string;operatorSlug?:string;operatorName?:string;localReferenceUrl?:string;project:StudioProject;savedProject:StudioProject|null;inventory:VideoInventory;room?:Room;compositionId?:string;onSelect?:(id:string)=>void;game?:'blackjack'|'roulette';dealerId:string;uses:CompositionUse[];roomChoicesPath:string|null;blocked:boolean;projectDirty:boolean;onEdit:(project:StudioProject)=>void;onRegistered:(project:StudioProject,id:string,role:'background'|'table'|'illustration')=>void;onSaved:(project:StudioProject)=>void;onBusyChange:(busy:boolean)=>void}) {
  const [selectedLayout,setLayout]=useState<'mobile'|'desktop'>('mobile'),[error,setError]=useState('');
  const [uploadBusy,setUploadBusy]=useState(false);
  const [moveTogether,setMoveTogether]=useState(false);
  const [copyTable,setCopyTable]=useState('');
  const [editingCompositionId,setEditingCompositionId]=useState('');
  const [backgroundPreview,setBackgroundPreview]=useState<{id:string;request:number}>({id:'',request:0});
  const [tablePreview,setTablePreview]=useState<{id:string;request:number}>({id:'',request:0});
  const [previewSelection,setPreviewSelection]=useState({compositionId:'',table:'',background:'',dealer:''});
  const operations=useRef(new Set<string>());
  function uploading(role:string,value:boolean) {if(value)operations.current.add(role);else operations.current.delete(role);const active=operations.current.size>0;setUploadBusy(active);onBusyChange(active);}
  const lane=project.lanes?.find(row=>row.id===(compositionId||room?.compositionId)),assets=project.layerAssets??[];
  const editing=Boolean(lane&&editingCompositionId===lane.id),locked=blocked||uploadBusy||!editing;
  const settings=lane?.composition??defaultCompositionSettings();
  const game=requestedGame??(room?.game==='roulette'?'roulette':'blackjack');
  const layout=game==='roulette'?'desktop':selectedLayout;
  const choices=previewSelection.compositionId===lane?.id?previewSelection:{table:'',background:'',dealer:''};
  // Dealer idle, background and table graphics for the preview; shared with the dealer and room previews.
  const {dealerId:previewDealer,backgroundId:previewBackground,backgroundBases,tables:editableTables,tableAsset,video,media}=useScenePreviewMedia({project,inventory,lane,game,dealerId,choices});
  const selectPreview=(role:'table'|'background'|'dealer',id:string)=>setPreviewSelection({...choices,compositionId:lane?.id??'',[role]:id});
  function change(next:StudioLane) { if(locked||!lane)return;try{onEdit(validateProject({...project,lanes:project.lanes?.map(row=>row.id===lane.id?next:row)}));setError('');}catch(cause){setError((cause as Error).message);} }
  function placement(role:'dealer'|'background'|'table',field:'x'|'y'|'scale'|'width',value:number) {
    if(!lane)return;
    try{change({...lane,composition:moveCompositionLayer(settings,layout,role,field,value,moveTogether),renderer:'layered'});}catch(cause){setError((cause as Error).message);}
  }
  const copyChoices=editableTables.filter(row=>row.id!==tableAsset?.id&&settings.blackjackTables?.some(profile=>profile.tableId===row.id));
  const copySource=copyChoices.some(row=>row.id===copyTable)?copyTable:copyChoices[0]?.id??'';
  const ui=settings[layout].gameUi??{actions:null,chat:{x:1,y:0,width:layout==='mobile'?.95:.28,height:.45}};
  function changeUi(value:typeof ui){if(!lane)return;const next=structuredClone(settings);next[layout].gameUi=structuredClone(value);change({...lane,composition:next,renderer:'layered'});}
  const clipAssets=(role:'background'|'table')=>lane?assets.filter(row=>row.role===role&&lane.layers[role].allowed.includes(row.id)).map(row=>({id:row.id,url:'/studio/api/layer-assets/'+row.id,label:row.label,contentType:row.contentType})):[];
  const metadata=onSelect?<CompositionMetadata project={project} selectedId={lane?.id??''} showSelector={false} canRename={!locked} disabled={blocked||uploadBusy} onSelect={onSelect} onEdit={change=>{try{onEdit(change(project));setError('');}catch(cause){setError((cause as Error).message);}}}/>:null;
  if(!lane)return <section className="studio-detail-panel"><h2>Scen &amp; lager</h2>{metadata}<p>{compositionId||room?.compositionId?'Den valda miljön finns inte. Välj en annan miljö eller skapa en ny.':'Välj eller skapa en miljö för bakgrund, dealer och bord.'}</p>{error&&<p role="alert">{error}</p>}</section>;
  const localDealerReference=game==='roulette'&&previewDealer===dealerId?localReferenceUrl:undefined;
  const framing=localDealerReference?undefined:video?.classification?.framing;
  const preview=(overlay?:ReactNode)=><CompositionPreview dealer={localDealerReference?{url:localDealerReference,label:'Lokal VILA · inte sparad',contentType:'image/png'}:video?{url:video.previewUrl,label:video.label,contentType:video.contentType!}:null} background={media(previewBackground)} table={media(tableAsset?.id)} overlay={overlay} framing={framing} settings={settings} layout={layout} show={{dealer:true,background:true,table:true}} compositing={localDealerReference?{mode:'alpha'}:video?effectiveDealerCompositing(video.classification?.compositing):undefined} backgroundPlayback={previewBackground!==lane.layers.background.default?undefined:lane.backgroundPlayback} backgroundAssets={clipAssets('background')} previewBackgroundRuleId={backgroundPreview.id} previewBackgroundRequest={backgroundPreview.request} tablePlayback={game==='blackjack'&&tableAsset?.id!==lane.layers.table.default?undefined:lane.tablePlayback} tableAssets={clipAssets('table')} previewTableRuleId={tablePreview.id} previewTableRequest={tablePreview.request}/>;
  return <section className="studio-detail-panel" aria-label="Gemensam miljö">{metadata}<h2>{lane.label}</h2>
    {room&&room.compositionId!==lane.id&&<p role="status">Du visar miljön {lane.label}. Rummet {room.name} använder en annan miljö. {onSelect&&<button type="button" className="studio-button" onClick={()=>onSelect(room.compositionId)}>Visa rummets miljö</button>}</p>}
    {!inEnvironment&&<ScenePublication project={project} savedProject={savedProject} compositionId={lane.id} operatorId={operatorId} operatorSlug={operatorSlug} operatorName={operatorName} blocked={blocked||uploadBusy} dirty={projectDirty} onEdit={onEdit} onBusyChange={value=>uploading('publication',value)}/>}
    <p>Standardlager, placering, tillåtna alternativ och automatik delas av alla spelbord som använder denna miljö. Ändringarna sparas i det gemensamma projektutkastet; publicerade versioner behålls.</p>
    <div className="studio-layer-summary" role="list" aria-label="Scenens tre lager">{([
      {id:'background',title:'Bakgrund',name:media(lane.layers.background.default)?.label??'Ingen separat bakgrund',count:lane.layers.background.allowed.length,media:media(lane.layers.background.default)},
      {id:'dealer',title:'Dealer',name:project.dealers.find(row=>row.id===lane.layers.dealer.default)?.label??'Ingen förvald dealer',count:lane.layers.dealer.allowed.length,media:video?{url:video.previewUrl,label:video.label,contentType:video.contentType!}:null},
      {id:'table',title:'Bord',name:media(lane.layers.table.default)?.label??'Inget separat bord',count:lane.layers.table.allowed.length,media:media(lane.layers.table.default)},
    ] as const).map((tile,index)=><div key={tile.id} role="listitem" className={'studio-layer-tile is-'+tile.id}>
      <div className="studio-layer-tile-media" aria-hidden="true">{tile.media?tile.media.contentType.startsWith('video/')?<video src={tile.media.url+'#t=0.1'} muted playsInline preload="metadata" tabIndex={-1}/>:<img src={tile.media.url} alt=""/>:<span>Inget valt</span>}</div>
      <span className="studio-card-eyebrow">{index+1} · {tile.title}</span><strong>{tile.name}</strong><small>{tile.count} {tile.count===1?'tillåtet val':'tillåtna val'}</small>
    </div>)}</div>
    {!inEnvironment&&<><p><strong>Rum som använder miljön:</strong></p>
    <ul>{uses.length?uses.map(use=><li key={use.roomId}>{use.operatorName} · {use.roomName}</li>):<li>Inga registrerade rum.</li>}</ul>
    {roomChoicesPath?<a className="studio-button" href={roomChoicesPath}>Välj material för {room?.name}</a>:<p>Välj ett aktivt rum för att öppna dess egna val.</p>}</>}
    <button className="studio-button" disabled={blocked||uploadBusy} aria-pressed={editing} onClick={()=>setEditingCompositionId(editing?'':lane.id)}>{editing?'Avsluta miljöredigering':'Redigera gemensam miljö'}</button>
    <fieldset disabled={locked} className="space-y-2"><legend>Dealers i den gemensamma miljön</legend>
      {project.dealers.map(dealer=><label key={dealer.id} className="flex items-center gap-2"><input type="checkbox" checked={lane.layers.dealer.allowed.includes(dealer.id)} onChange={event=>{
        const ids=event.target.checked?[...lane.layers.dealer.allowed,dealer.id]:lane.layers.dealer.allowed.filter(id=>id!==dealer.id);
        try{onEdit(setTemplateDealers(project,lane.id,ids,ids.includes(lane.layers.dealer.default)?lane.layers.dealer.default:ids[0]));setError('');}catch(cause){setError((cause as Error).message);}
      }}/>{dealer.label}</label>)}
      <label className="studio-field">Förvald dealer<select value={lane.layers.dealer.default} onChange={event=>{try{onEdit(setTemplateDealers(project,lane.id,lane.layers.dealer.allowed,event.target.value));setError('');}catch(cause){setError((cause as Error).message);}}}>{project.dealers.filter(row=>lane.layers.dealer.allowed.includes(row.id)).map(dealer=><option key={dealer.id} value={dealer.id}>{dealer.label}</option>)}</select></label>
    </fieldset>
    <div className="studio-game-tabs" role="tablist" aria-label="Kompositionsstorlek">{(['mobile','desktop'] as const).filter(id=>game!=='roulette'||id==='desktop').map(id=><button key={id} role="tab" aria-selected={layout===id} onClick={()=>setLayout(id)}>{id==='mobile'?'Mobil':'Desktop'}</button>)}</div>
    {game==='roulette'&&<><p>Roulette använder Desktop 16:9 även på mobil.</p><CompositionZoomControls settings={settings} disabled={locked} onChange={composition=>change({...lane,composition})}/></>}
    {game==='roulette'?<p>Förhandsvisningen använder dealerns roulette-VILA, annars första tillgängliga roulette-idle. Detta är ett materialprov; spelkoppling och godkännande återstår.</p>:null}
    <div className="studio-detail-panel" role="group" aria-label="Material i förhandsvisningen"><h3>Förhandsvisa och placera</h3>
      <p>Växla mellan miljöns tillåtna material här. Valen används i editorn; standardval och publicerade rum ändras inte.</p>
      <div className="grid gap-3 md:grid-cols-3"><label className="studio-field">Bakgrund<select aria-label="Bakgrund att förhandsvisa" value={previewBackground??''} onChange={event=>selectPreview('background',event.target.value)}>{!previewBackground&&<option value="">Ingen bakgrund</option>}{assets.filter(asset=>asset.role==='background'&&backgroundBases.includes(asset.id)).map(asset=><option key={asset.id} value={asset.id}>{asset.label}{asset.id===lane.layers.background.default?' · standard':''}</option>)}</select></label>
      <label className="studio-field">Dealer<select aria-label="Dealer att förhandsvisa" value={previewDealer} onChange={event=>selectPreview('dealer',event.target.value)}>{project.dealers.filter(dealer=>lane.layers.dealer.allowed.includes(dealer.id)).map(dealer=><option key={dealer.id} value={dealer.id}>{dealer.label}{dealer.id===lane.layers.dealer.default?' · standard':''}</option>)}</select></label>
      <label className="studio-field">Bord<select aria-label="Bord att placera kort på" value={tableAsset?.id??''} onChange={event=>selectPreview('table',event.target.value)}>{!tableAsset&&<option value="">Inget bord</option>}{editableTables.map(asset=><option key={asset.id} value={asset.id}>{asset.label}{asset.id===lane.layers.table.default?' · standard':''}</option>)}</select></label></div>
      <small>Kort och marker sparas per bord och format. Dealer, bakgrund och bordsstorlek delas av miljöns material inom samma format.</small>
      {game==='blackjack'&&tableAsset&&copyChoices.length>0&&<div className="flex flex-wrap items-end gap-2"><label className="studio-field">Återanvänd kort och marker<select aria-label="Kopiera kortplacering från" disabled={locked} value={copySource} onChange={event=>setCopyTable(event.target.value)}>{copyChoices.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label><button className="studio-button" disabled={locked||!copySource} onClick={()=>{if(locked||!lane)return;const source=settings.blackjackTables?.find(row=>row.tableId===copySource);if(!source)return;change({...lane,composition:{...structuredClone(settings),blackjackTables:[...(settings.blackjackTables??[]).filter(row=>row.tableId!==tableAsset.id),{...structuredClone(source),tableId:tableAsset.id}]}});}}>Kopiera båda formaten till valt bord</button></div>}
    </div>
    {game==='blackjack'&&<details><summary>Spelknappar och chatt · {layout==='mobile'?'mobil':'desktop'}</summary><fieldset disabled={locked} className="studio-detail-panel"><legend>Placering i spelytan</legend>
      <p>Önskad placering i spelytan. Spelet håller kontrollerna innanför skärmen och flyttar dem när kort eller menyer behöver plats. Saldo och menyer ryms automatiskt i nederkanten.</p>
      <label><input type="checkbox" checked={ui.actions===null} onChange={event=>changeUi({...ui,actions:event.target.checked?null:{x:.5,y:.7}})}/> Placera spelknappar automatiskt vid handen</label>
      {ui.actions&&(['x','y'] as const).map(axis=><label key={axis}>Spelknappar · {axis==='x'?'vågrätt':'lodrätt'} %<input type="number" min="0" max="100" step="1" aria-label={`Spelknappar ${axis}`} value={Math.round(ui.actions![axis]*100)} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))changeUi({...ui,actions:{...ui.actions!,[axis]:event.target.valueAsNumber/100}});}}/></label>)}
      {(['x','y','width','height'] as const).map(field=><label key={field}>Chatt · {{x:'vågrätt',y:'lodrätt',width:'bredd',height:'maxhöjd'}[field]} %<input type="number" min={['width','height'].includes(field)?15:0} max="100" step="1" aria-label={`Chatt ${field}`} value={Math.round(ui.chat[field]*100)} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))changeUi({...ui,chat:{...ui.chat,[field]:event.target.valueAsNumber/100}});}}/></label>)}
      <button type="button" className="studio-button" onClick={()=>{const next=structuredClone(settings);delete next[layout].gameUi;change({...lane,composition:next});}}>Återställ automatisk placering</button>
    </fieldset></details>}
    {game==='blackjack'&&tableAsset?<BlackjackScenePlacementEditor tableId={tableAsset.id} layout={layout} disabled={locked}
      scene={{dealerId:previewDealer,settings,framing,width:tableAsset.width,height:tableAsset.height}} renderPreview={preview}
      value={settings.blackjackTables?.find(row=>row.tableId===tableAsset.id)}
      savedValue={savedProject?.lanes?.find(row=>row.id===lane.id)?.composition?.blackjackTables?.find(row=>row.tableId===tableAsset.id)}
      onChange={value=>{const next=structuredClone(settings),rows=(next.blackjackTables??[]).filter(row=>row.tableId!==tableAsset.id);
        if(value)rows.push(value);if(rows.length)next.blackjackTables=rows;else delete next.blackjackTables;
        try{change({...lane,composition:validateCompositionSettings(next),renderer:'layered'});}catch(cause){setError((cause as Error).message);}
      }}>
        <label className="flex items-center gap-2"><input type="checkbox" checked={moveTogether} disabled={locked} onChange={event=>setMoveTogether(event.target.checked)}/> Flytta scenen tillsammans · bakgrund, dealer och bord</label>
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
    {!(game==='blackjack'&&tableAsset)&&<label className="flex items-center gap-2"><input type="checkbox" checked={moveTogether} disabled={locked} onChange={event=>setMoveTogether(event.target.checked)}/> Flytta scenen tillsammans · bakgrund, dealer och bord</label>}
    <details open={game==='roulette'||undefined}><summary>Storlek och placering · {layout==='mobile'?'mobil':'desktop'}</summary><fieldset disabled={locked}>{(game==='blackjack'&&tableAsset?(['background'] as const):(['dealer','background','table'] as const)).map(role=><div key={role} className="grid grid-cols-3 gap-2 py-2">{([role==='table'?'width':'scale','x','y'] as const).map(field=><label key={field} className="studio-field">{role==='dealer'?'Dealer':role==='background'?'Bakgrund':'Bord'} · {field==='width'?'Bredd':field==='scale'?'Skala':field.toUpperCase()}<input type="number" step={.01} min={field==='x'||field==='y'?-2:.1} max={field==='x'||field==='y'?2:4} value={(settings[layout][role] as unknown as Record<string,number>)[field]} onChange={event=>{try{placement(role,field,Number(event.target.value));}catch(cause){setError((cause as Error).message);}}}/></label>)}</div>)}<label><input type="checkbox" checked={settings.tableFront} onChange={event=>change({...lane,composition:{...settings,tableFront:event.target.checked}})}/> Bord framför dealer</label></fieldset></details>
    <fieldset disabled={locked} className="space-y-4">{(['background','table'] as const).map(role=><div key={role} className="space-y-3">
      <LayerAssetSelect role={role} lane={lane} assets={assets} game={game} permissions onChange={change}/>
      <LayerLibrary role={role} game={game} disabled={locked} onBusyChange={value=>uploading(role,value)} onRegistered={(remote,id)=>onRegistered(remote,id,role)}/>
      {projectDirty&&<p>Spara eller lös ditt utkast innan du använder papperskorgen.</p>}
      <div className="studio-material-controls"><LayerAssetManager project={project} role={role} disabled={locked||projectDirty} onSaved={onSaved} onBusyChange={value=>uploading('trash-'+role,value)}/></div>
    </div>)}</fieldset>

    <BackgroundPlaybackEditor policy={lane.backgroundPlayback} assets={assets} allowed={lane.layers.background.allowed} baseSelected={lane.layers.background.enabled&&Boolean(lane.layers.background.default)} disabled={locked} onChange={policy=>{const next=structuredClone(lane);if(policy)next.backgroundPlayback=policy;else delete next.backgroundPlayback;change(next);}} onPreview={id=>{selectPreview('background',lane.layers.background.default??'');setBackgroundPreview(current=>({id,request:current.request+1}));}}/>
    <LayerPlaybackEditor role="table" policy={lane.tablePlayback} assets={assets} allowed={lane.layers.table.allowed} baseSelected={lane.layers.table.enabled&&Boolean(lane.layers.table.default)} disabled={locked} onChange={policy=>{const next=structuredClone(lane);if(policy)next.tablePlayback=policy;else delete next.tablePlayback;change(next);}} onPreview={id=>{selectPreview('table',lane.layers.table.default??'');setTablePreview(current=>({id,request:current.request+1}));}}/>
    <details><summary>Automatik / OpenClaw</summary><fieldset disabled={locked} className="grid grid-cols-2 gap-3">{(['idle','deal','reveal','speak','probe'] as const).map(phase=><label key={phase} className="studio-field">{({idle:'Vänta',deal:'Deal',reveal:'Visa',speak:'Tal',probe:'Bildgranskning'})[phase]}<select value={lane.openclaw[phase]} onChange={event=>change({...lane,openclaw:{...lane.openclaw,[phase]:event.target.value}})}>{[['off','Av'],['rules','Regler'],['random','Slump'],['shadow','Skuggläge'],['active','Aktiv']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>)}</fieldset></details>
    {error&&<p role="alert">{error}</p>}
  </section>;
}
