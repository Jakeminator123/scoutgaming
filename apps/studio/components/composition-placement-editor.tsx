'use client';
import {cloneElement,useEffect,useRef,useState,type ReactElement,type ReactNode,type PointerEvent,type KeyboardEvent} from 'react';
import type {CompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {alignCompositionLayer,compositionLayerRect,restoreCompositionLayer,sizeCompositionLayer,translateCompositionLayer,type CompositionRole,type CompositionLayout,type CompositionAssetSize} from '../lib/composition-placement.mjs';
import {CompositionZoomControls} from './composition-zoom-controls';
import styles from './composition-placement-editor.module.css';

const roles:CompositionRole[]=['background','dealer','table'];
const names={background:'Bakgrund',dealer:'Dealer',table:'Bord'};
type Drag={pointer:number;x:number;y:number;width:number;height:number;settings:CompositionSettings;role:CompositionRole};

export function CompositionPlacementEditor({settings,savedSettings,layout,disabled,available,tableAsset,backgroundAsset,cardEditing=false,onCardEditingChange,onChange,children}:{
  settings:CompositionSettings;savedSettings?:CompositionSettings;layout:CompositionLayout;disabled:boolean;
  available:Record<CompositionRole,boolean>;tableAsset?:CompositionAssetSize;backgroundAsset?:CompositionAssetSize;
  cardEditing?:boolean;onCardEditingChange?:(value:boolean)=>void;onChange:(value:CompositionSettings)=>void;
  children:ReactElement<{overlay?:ReactNode}>;
}){
  const [selection,setSelection]=useState<CompositionRole>('dealer'),[together,setTogether]=useState(false),[keepBottom,setKeepBottom]=useState(false),[error,setError]=useState('');
  const drag=useRef<Drag|null>(null);
  const tableSizeKnown=Boolean(tableAsset&&Number.isFinite(tableAsset.width)&&tableAsset.width>0&&Number.isFinite(tableAsset.height)&&tableAsset.height>0);
  const editable={...available,table:available.table&&tableSizeKnown};
  const role=editable[selection]?selection:roles.find(item=>editable[item])??selection;
  const unavailable=!editable[role],locked=disabled||unavailable;
  const asset=role==='table'?tableAsset:role==='background'?backgroundAsset:undefined;
  const plane=settings[layout][role],size=role==='table'?settings[layout].table.width:settings[layout][role].scale;
  const dirty=Boolean(savedSettings&&JSON.stringify(savedSettings[layout][role])!==JSON.stringify(plane));
  const rect=unavailable?null:compositionLayerRect(settings,layout,role,asset);
  const clipped=rect?{x:Math.max(0,rect.x),y:Math.max(0,rect.y),right:Math.min(1,rect.x+rect.width),bottom:Math.min(1,rect.y+rect.height)}:null;
  const visible=clipped&&clipped.right>clipped.x&&clipped.bottom>clipped.y;
  useEffect(()=>{drag.current=null;},[disabled,layout,role,cardEditing]);

  function update(operation:()=>CompositionSettings){
    if(locked)return;
    try{onChange(operation());setError('');}catch{setError('Placeringen når scenens gräns. Prova ett mindre steg.');}
  }
  function move(dx:number,dy:number){update(()=>translateCompositionLayer(settings,layout,role,dx,dy,together));}
  function resize(value:number){if(Number.isFinite(value))update(()=>sizeCompositionLayer(settings,layout,role,value,{asset,keepBottom,together}));}
  function pointerMove(event:PointerEvent<HTMLDivElement>){
    const start=drag.current;if(locked||!start||event.pointerId!==start.pointer)return;
    update(()=>translateCompositionLayer(start.settings,layout,start.role,(event.clientX-start.x)/start.width,(event.clientY-start.y)/start.height,together));
  }
  function keyboard(event:KeyboardEvent<HTMLDivElement>){
    if(locked)return;
    if(event.key==='Escape'&&drag.current){const start=drag.current;drag.current=null;update(()=>start.settings);if(event.currentTarget.hasPointerCapture(start.pointer))event.currentTarget.releasePointerCapture(start.pointer);event.preventDefault();return;}
    const step=event.shiftKey?.01:.001;
    const delta:Record<string,[number,number]>={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
    if(delta[event.key]){event.preventDefault();move(...delta[event.key]);}
  }
  const overlay=rect&&visible&&clipped?<div className={styles.overlay}>
    <div className={styles.selection} role="group" aria-label={`Flytta ${names[role].toLowerCase()} i scenen`} aria-disabled={locked} tabIndex={locked?-1:0}
      style={{left:`${clipped.x*100}%`,top:`${clipped.y*100}%`,width:`${(clipped.right-clipped.x)*100}%`,height:`${(clipped.bottom-clipped.y)*100}%`}}
      onKeyDown={keyboard}
      onPointerDown={event=>{
        if(locked||!event.isPrimary||event.button!==0)return;
        const frame=event.currentTarget.parentElement!.getBoundingClientRect();if(!frame.width||!frame.height)return;
        event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);
        drag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,width:frame.width,height:frame.height,settings:structuredClone(settings),role};
      }}
      onPointerMove={pointerMove}
      onPointerUp={event=>{if(drag.current?.pointer!==event.pointerId)return;pointerMove(event);drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
      onPointerCancel={event=>{if(drag.current?.pointer!==event.pointerId)return;const start=drag.current;drag.current=null;update(()=>start.settings);}}
      onLostPointerCapture={()=>{drag.current=null;}}>
      <span className={styles.handle}>{names[role]} <span aria-hidden="true">✥</span></span>
      {role==='table'&&rect.y+rect.height<=1&&rect.y+rect.height>=0&&<span className={styles.bottom}>Bordets nederkant</span>}
    </div>
  </div>:undefined;

  return <div className={styles.editor}>
    {onCardEditingChange&&<div className={styles.modes} aria-label="Redigeringsläge">
      <button type="button" aria-pressed={!cardEditing} onClick={()=>onCardEditingChange(false)}>Scenens lager</button>
      <button type="button" aria-pressed={cardEditing} onClick={()=>onCardEditingChange(true)}>Kort och marker</button>
    </div>}
    {!cardEditing&&<div className={styles.layers} aria-label="Välj lager att placera">{roles.map((item,index)=><button type="button" key={item} disabled={!editable[item]} aria-label={`Välj ${names[item].toLowerCase()}`} aria-pressed={role===item} onClick={()=>{setSelection(item);setError('');}}><span aria-hidden="true">{index+1}</span>{names[item]}</button>)}</div>}
    {cloneElement(children,{overlay:cardEditing?children.props.overlay:overlay})}
    {!cardEditing&&<>
      {available.table&&!tableSizeKnown&&<p role="status" className={styles.hint}>Bordets bildstorlek saknas. Välj en annan bordsbild för att placera bordet.</p>}
      <p className={styles.hint}>{disabled?'Lås upp miljön med Redigera gemensam miljö för att placera lagren.':unavailable?'Välj material för att placera det i scenen.':visible?'Dra det valda lagret i bilden. Piltangenter finjusterar; Shift ger större steg.':'Lagret ligger utanför bilden. Använd placering och finjustering nedan för att ta tillbaka det.'}</p>
      <fieldset className={styles.controls} disabled={locked}>
        <legend>{names[role]} <span>{dirty?'· ändrat i utkastet':savedSettings?'· sparad placering':'· nytt utkast'}</span></legend>
        <div className={styles.size}><label><span className={styles.sizeCaption}>{role==='table'?'Bredd':'Storlek'} <output>{Math.round(size*1000)/10} %</output></span>
          <input aria-label={`${names[role]} storlek`} type="range" min="10" max="400" step="1" value={size*100} onChange={event=>resize(Number(event.target.value)/100)}/></label></div>
        <div className={styles.actions}>
          <button type="button" className="sg-btn sg-btn-secondary" onClick={()=>update(()=>alignCompositionLayer(settings,layout,role,'center',asset,together))}>Centrera vågrätt</button>
          {role==='table'&&<button type="button" className="sg-btn sg-btn-secondary" onClick={()=>update(()=>alignCompositionLayer(settings,layout,role,'bottom',asset,together))}>Lägg mot nederkanten</button>}
          <button type="button" className="sg-btn sg-btn-secondary" disabled={locked||!savedSettings||!dirty} onClick={()=>{if(savedSettings)update(()=>restoreCompositionLayer(settings,savedSettings,layout,role));}}>Återställ lagret</button>
        </div>
        <div className={styles.nudge} role="group" aria-label="Finjustera placeringen">{([
          ['Vänster','←',-.001,0],['Upp','↑',0,-.001],['Ned','↓',0,.001],['Höger','→',.001,0],
        ] as const).map(([label,icon,dx,dy])=><button key={label} type="button" aria-label={`Flytta ${label.toLowerCase()}`} onClick={()=>move(dx,dy)}>{icon}</button>)}<small>0,1 % per steg</small></div>
        {role==='table'&&<label className={styles.toggle}><input type="checkbox" checked={keepBottom} disabled={locked||together} onChange={event=>setKeepBottom(event.target.checked)}/> Behåll bordets nederkant när bredden ändras</label>}
        <label className={styles.toggle}><input type="checkbox" checked={together} onChange={event=>setTogether(event.target.checked)}/> Flytta och skala alla lager tillsammans</label>
        <details className={styles.precision}><summary>Exakta värden</summary><div className={styles.fields}>
          <label>{role==='table'?'Bredd':'Skala'} %<input type="number" min="10" max="400" step=".1" value={Math.round(size*10000)/100} onChange={event=>resize(event.target.valueAsNumber/100)}/></label>
          {(['x','y'] as const).map(axis=><label key={axis}>{axis==='x'?'Vågrätt':role==='table'?'Överkant':'Lodrätt'} %<input type="number" min="-200" max="200" step=".1" value={Math.round(plane[axis]*10000)/100} onChange={event=>{const value=event.target.valueAsNumber;if(Number.isFinite(value))move(axis==='x'?value/100-plane.x:0,axis==='y'?value/100-plane.y:0);}}/></label>)}
        </div>{role==='table'&&<small>Överkanten mäts från bildens topp. Nederkanten beror också på bordets bredd och bildformat.</small>}</details>
      </fieldset>
      <details className={styles.precision}><summary>Hela scenens storlek och lagerordning</summary>
        <CompositionZoomControls settings={settings} layout={layout} disabled={disabled} onChange={value=>{if(!disabled)onChange(value);}}/>
        <label className={styles.toggle}><input type="checkbox" checked={settings.tableFront} disabled={disabled} onChange={event=>{if(!disabled)onChange({...settings,tableFront:event.target.checked});}}/> Bord framför dealer</label>
      </details>
    </>}
    {error&&<p role="alert">{error}</p>}
  </div>;
}
