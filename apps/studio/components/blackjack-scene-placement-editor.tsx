'use client';
import {useState,useRef,useEffect,type ReactNode,type PointerEvent} from 'react';
import {defaultBlackjackTableGeometry,type BlackjackTableGeometry,type TablePoint,type CompositionSettings,type AnchorTarget} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {compositionAnchorFrames,resolveAnchorRect,rebindAnchor,restoreGeometryGroup,projectAnchorRects,type AnchorFrames} from '../../../packages/presentation/runtime/composition-anchors.mjs';
import {layoutGameOverlay} from '../../../packages/presentation/runtime/game-overlay-layout.mjs';
import styles from './blackjack-scene-placement-editor.module.css';
type Layout='mobile'|'desktop';
type Scene={settings:CompositionSettings;width:number;height:number};
type Mark={id:string;x:number;y:number;width:number;label:string;kind:'card'|'bet'};

function SceneOverlay({value,layout,frames,selected,disabled,onSelect,onPlace}:{value:BlackjackTableGeometry;layout:Layout;frames:AnchorFrames;selected:string;disabled:boolean;onSelect:(id:string)=>void;onPlace:(id:string,p:TablePoint)=>void}){
  const svg=useRef<SVGSVGElement>(null),drag=useRef<string|null>(null);
  const [viewport,setViewport]=useState({width:layout==='mobile'?390:960,height:layout==='mobile'?693:540});
  useEffect(()=>{const node=svg.current;if(!node)return;const read=()=>{const r=node.getBoundingClientRect();if(r.width&&r.height)setViewport({width:r.width,height:r.height});};read();const observer=new ResizeObserver(read);observer.observe(node);return()=>observer.disconnect();},[layout]);
  const planes=projectAnchorRects(value[layout],frames,viewport),boxes=layout==='mobile'?[2,3,4]:[0,1,2,3,4,5,6];
  const result=layoutGameOverlay({tableGeometry:value,tableLayout:layout,rect:planes.cardsRect,...planes},boxes,{left:0,right:viewport.width,top:0,bottom:viewport.height},{compact:layout==='mobile'});
  const cardWidth=planes.cardsRect.width*value[layout].cardWidth;
  const positions=(result as {positions:Record<string,{cx:number;cy:number}>}).positions;
  const marks:Mark[]=[{id:'dealer',...result.dealer,width:cardWidth,label:'D',kind:'card'},...boxes.flatMap((box,i)=>{
    const p=positions[String(box+1)],bet=result.seats[i];return [
      {id:`card:${i}`,x:result.x+p.cx*result.scale,y:result.y+p.cy*result.scale,width:cardWidth,label:String(box+1),kind:'card' as const},
      {id:`bet:${i}`,x:bet.x,y:bet.y,width:Math.max(16,28*result.controlScale),label:String(box+1),kind:'bet' as const}];
  })];
  function place(event:PointerEvent<SVGSVGElement>){
    if(!drag.current)return;const r=event.currentTarget.getBoundingClientRect(),fit=Math.min(r.width/frames.scene.width,r.height/frames.scene.height);
    onPlace(drag.current,{x:(event.clientX-r.left-(r.width-frames.scene.width*fit)/2)/fit,y:(event.clientY-r.top-(r.height-frames.scene.height*fit)/2)/fit});
  }
  return <svg ref={svg} className={styles.overlay} viewBox={`0 0 ${viewport.width} ${viewport.height}`} aria-label="Kort och marker i scenen"
    onPointerDown={event=>{if(disabled)return;const id=(event.target as Element).closest('[data-mark]')?.getAttribute('data-mark');if(id&&!(id.startsWith('bet')&&value[layout].betMode==='under-cards')){onSelect(id);drag.current=id;event.currentTarget.setPointerCapture(event.pointerId);}}}
    onPointerMove={event=>{if(!disabled&&drag.current)place(event);}}
    onPointerUp={event=>{if(!disabled&&drag.current)place(event);drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
    onPointerCancel={()=>{drag.current=null;}}>
    {marks.map(mark=><g key={mark.id} data-mark={mark.id} transform={`translate(${mark.x} ${mark.y})`}>
      {mark.kind==='card'?<rect x={-mark.width/2} y={-mark.width*85/126} width={mark.width} height={mark.width*85/63} rx={3} fill="#f8fafc" stroke={selected===mark.id?'#22d3ee':'#475569'} strokeWidth={selected===mark.id?3:1}/>:<ellipse rx={mark.width/2} ry={mark.width*.34} fill="#fbbf24" stroke={selected===mark.id?'#22d3ee':'#78350f'} strokeWidth={selected===mark.id?3:1}/>}
      <text textAnchor="middle" dominantBaseline="central" fontSize={Math.max(8,Math.min(12,mark.width*.6))} fill="#0f172a">{mark.label}</text>
    </g>)}
  </svg>;
}

export function BlackjackScenePlacementEditor({tableId,value,savedValue,layout,disabled,onChange,scene,renderPreview,children}:{tableId:string;value?:BlackjackTableGeometry;savedValue?:BlackjackTableGeometry;layout:Layout;disabled:boolean;onChange:(value?:BlackjackTableGeometry)=>void;scene:Scene;renderPreview:(overlay?:ReactNode)=>ReactNode;children?:ReactNode}){
  const [target,setTarget]=useState('dealer'),[error,setError]=useState('');
  const geometry=value?.[layout],followCards=geometry?.betMode==='under-cards';
  const targets=[{id:'dealer',label:'Dealer · kort'},...Array.from({length:layout==='mobile'?3:7},(_,i)=>[{id:`card:${i}`,label:`${layout==='mobile'?'Synlig plats':'Plats'} ${i+1} · kort`},...(!followCards?[{id:`bet:${i}`,label:`${layout==='mobile'?'Synlig plats':'Plats'} ${i+1} · marker`}]:[])]).flat()];
  const selected=targets.find(row=>row.id===target)??targets[0],part=selected.id.split(':'),seat=Number(part[1]);
  const point=geometry?(part[0]==='dealer'?geometry.dealer:geometry.seats[seat][part[0] as 'card'|'bet']):undefined;
  const frames=compositionAnchorFrames(scene.settings,layout,scene);
  function update(next:BlackjackTableGeometry|undefined){if(disabled)return;try{onChange(next);setError('');}catch(cause){setError((cause as Error).message);}}
  function place(id:string,p:TablePoint){
    if(disabled||!value)return;const next=structuredClone(value),[kind,index]=id.split(':');
    if(kind==='bet'&&followCards)return;
    const bounded={x:Math.round(Math.max(0,Math.min(1,p.x))*10000)/10000,y:Math.round(Math.max(0,Math.min(1,p.y))*10000)/10000};
    if(kind==='dealer')next[layout].dealer=bounded;else next[layout].seats[Number(index)][kind as 'card'|'bet']=bounded;
    update(next);
  }
  function placeInScene(id:string,p:TablePoint){if(!geometry)return;const rect=resolveAnchorRect(geometry.anchors?.[id.startsWith('bet')?'bets':'cards'],frames);place(id,{x:(p.x-rect.x)/rect.width,y:(p.y-rect.y)/rect.height});}
  return <div className={styles.editor}>
    <div className={styles.preview}>{renderPreview(value?<SceneOverlay value={value} frames={frames} layout={layout} selected={selected.id} disabled={disabled} onSelect={setTarget} onPlace={placeInScene}/>:undefined)}</div>
    <div className={styles.controls}>{children}
    <fieldset disabled={disabled}><legend>Kort och marker · {layout==='mobile'?'mobil':'desktop'}</legend>
    {!value?<><p>Ingen egen placering sparad för detta bord. Spelet använder tidigare placering.</p><button type="button" className="sg-btn sg-btn-secondary" onClick={()=>update(defaultBlackjackTableGeometry(tableId))}>Placera på detta bord</button></>:geometry&&point?<>
      <p>{layout==='mobile'?'Mobil · tre synliga platser, här visas 3–5':'Desktop · sju platser'}. Placeringen hör till denna borddesign och detta format.</p>
      <div className={styles.groups}>{(['cards','bets'] as const).map(kind=>{
        const anchor=geometry.anchors?.[kind],rect=resolveAnchorRect(anchor,frames),linked=kind==='bets'&&followCards;
        return <fieldset key={kind} className={styles.group}><legend>{kind==='cards'?'Kort':'Marker'}</legend>
          <label>Följer<select disabled={disabled||linked} aria-label={kind==='cards'?'Korten följer':'Markerna följer'} value={anchor?.target??'table'} onChange={event=>{const next=structuredClone(value);next[layout].anchors??={};next[layout].anchors![kind]=rebindAnchor(anchor,event.target.value as AnchorTarget,frames);update(next);}}>
            <option value="table">Bordet</option><option value="dealer">Dealern</option><option value="scene">Ligg still i scenen</option>
          </select></label>
          {linked?<small>Följer korten. Det manuella markerläget sparas.</small>:<div className={styles.numbers}>{(['x','y'] as const).map(axis=><label key={axis}>{axis==='x'?'Flytta grupp vågrätt':'Flytta grupp lodrätt'} %<input type="number" step="0.5" aria-label={`${kind==='cards'?'Kort':'Marker'} grupp ${axis}`} value={Math.round(rect[axis]/frames.scene[axis==='x'?'width':'height']*10000)/100} onChange={event=>{
            if(!Number.isFinite(event.target.valueAsNumber))return;const next=structuredClone(value),bound=rebindAnchor(anchor,anchor?.target??'table',frames),base=frames[bound.target],dimension=axis==='x'?'width':'height';
            bound.rect[axis]=(event.target.valueAsNumber/100*frames.scene[dimension]-base[axis])/base[dimension];next[layout].anchors??={};next[layout].anchors![kind]=bound;update(next);
          }}/></label>)}</div>}
          <button type="button" className="sg-btn sg-btn-secondary" disabled={!savedValue} onClick={()=>{if(savedValue)update(restoreGeometryGroup(value,savedValue,layout,kind));}}>Återställ sparade {kind==='cards'?'kort':'marker'}</button>
        </fieldset>;
      })}</div>
      <label className={styles.toggle}><input type="checkbox" checked={!!followCards} onChange={event=>{const next=structuredClone(value);if(event.target.checked)next[layout].betMode='under-cards';else delete next[layout].betMode;update(next);}}/> Markerna följer korten</label>
      <label>Flytta punkt<select value={selected.id} onChange={event=>setTarget(event.target.value)}>{targets.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
      <div className={styles.numbers}>{(['x','y'] as const).map(axis=><label key={axis}>{axis==='x'?'Punkt vågrätt':'Punkt lodrätt'} %<input type="number" min="0" max="100" step="0.5" value={Math.round(point[axis]*10000)/100} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))place(selected.id,{...point,[axis]:event.target.valueAsNumber/100});}}/></label>)}</div>
      <label>Kortbredd · % av kortramen<input type="range" min="2" max="15" step="0.1" value={geometry.cardWidth*100} onChange={event=>{const next=structuredClone(value);next[layout].cardWidth=Number(event.target.value)/100;update(next);}}/><output>{Math.round(geometry.cardWidth*1000)/10} %</output></label>
      <p>Dra en punkt i scenen eller använd procentfälten. Gruppens läge kan flyttas separat. Filmens handrörelse och kortspår ändras inte.</p>
      <button type="button" className="sg-btn sg-btn-secondary" onClick={()=>update(undefined)}>Ta bort bordets placering</button>
    </>:null}
    {error&&<p role="alert">{error}</p>}
    </fieldset>
    </div>
  </div>;
}
