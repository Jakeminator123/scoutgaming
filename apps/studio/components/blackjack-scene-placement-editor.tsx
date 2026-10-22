'use client';
import {useState,useRef,useEffect,type ReactNode,type PointerEvent} from 'react';
import {defaultBlackjackTableGeometry,defaultBlackjackAutoScale,type BlackjackTableGeometry,type BlackjackAutoScale,type TablePoint,type CompositionSettings,type AnchorTarget} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {compositionAnchorFrames,resolveAnchorRect,rebindAnchor,restoreGeometryGroup,projectAnchorRects,type AnchorFrames} from '../../../packages/presentation/runtime/composition-anchors.mjs';
import {layoutGameOverlay} from '../../../packages/presentation/runtime/game-overlay-layout.mjs';
import styles from './blackjack-scene-placement-editor.module.css';
type Layout='mobile'|'desktop';
type Scene={settings:CompositionSettings;width:number;height:number};
type Mark={id:string;x:number;y:number;width:number;label:string;kind:'card'|'bet'};
// Filmed landings and automatic chips are not dragged; manual points are kept.
const locked=(geometry:BlackjackTableGeometry[Layout],id:string)=>id.startsWith('bet')?geometry.betMode==='under-cards'||!!geometry.autoScale?.chips:!!geometry.autoScale?.landing;
// Absent stays manual. Neutral adjustments are dropped; no part chosen removes it.
function withAutoScale(value:BlackjackTableGeometry,layout:Layout,choice?:BlackjackAutoScale){
  const next=structuredClone(value),auto=choice&&structuredClone(choice),adjust=auto?.adjust;
  if(adjust?.cards?.scale===1)delete adjust.cards;
  if(adjust?.chips&&!adjust.chips.dx&&!adjust.chips.dy&&adjust.chips.scale===1)delete adjust.chips;
  if(auto&&adjust&&!Object.keys(adjust).length)delete auto.adjust;
  if(auto&&(auto.landing||auto.cardSize||auto.chips))next[layout].autoScale=auto;else delete next[layout].autoScale;
  return next;
}

function SceneOverlay({value,layout,frames,selected,disabled,onSelect,onPlace}:{value:BlackjackTableGeometry;layout:Layout;frames:AnchorFrames;selected:string;disabled:boolean;onSelect:(id:string)=>void;onPlace:(id:string,p:TablePoint)=>void}){
  const svg=useRef<SVGSVGElement>(null),drag=useRef<string|null>(null);
  const [viewport,setViewport]=useState({width:layout==='mobile'?390:960,height:layout==='mobile'?693:540});
  useEffect(()=>{const node=svg.current;if(!node)return;const read=()=>{const r=node.getBoundingClientRect();if(r.width&&r.height)setViewport({width:r.width,height:r.height});};read();const observer=new ResizeObserver(read);observer.observe(node);return()=>observer.disconnect();},[layout]);
  const planes=projectAnchorRects(value[layout],frames,viewport),boxes=layout==='mobile'?[2,3,4]:[0,1,2,3,4,5,6];
  const result=layoutGameOverlay({tableGeometry:value,tableLayout:layout,rect:planes.cardsRect,...planes},boxes,{left:0,right:viewport.width,top:0,bottom:viewport.height},{compact:layout==='mobile'});
  // 63 = the calibration card width that the layout scale refers to.
  const cardWidth=result.scale*63;
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
    onPointerDown={event=>{if(disabled)return;const id=(event.target as Element).closest('[data-mark]')?.getAttribute('data-mark');if(id&&!locked(value[layout],id)){onSelect(id);drag.current=id;event.currentTarget.setPointerCapture(event.pointerId);}}}
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
  const geometry=value?.[layout],auto=geometry?.autoScale,followCards=geometry?.betMode==='under-cards'||!!auto?.chips,filmedCards=!!auto?.landing;
  const seatLabel=(i:number)=>`${layout==='mobile'?'Synlig plats':'Plats'} ${i+1}`;
  const targets=[...(filmedCards?[]:[{id:'dealer',label:'Dealer · kort'}]),...Array.from({length:layout==='mobile'?3:7},(_,i)=>[
    ...(filmedCards?[]:[{id:`card:${i}`,label:`${seatLabel(i)} · kort`}]),...(!followCards?[{id:`bet:${i}`,label:`${seatLabel(i)} · marker`}]:[])]).flat()];
  const selected=targets.find(row=>row.id===target)??targets[0],part=selected?.id.split(':')??[],seat=Number(part[1]);
  const point=geometry&&selected?(part[0]==='dealer'?geometry.dealer:geometry.seats[seat][part[0] as 'card'|'bet']):undefined;
  const adjustChips=(field:'dx'|'dy'|'scale',percent:number)=>{if(!value||!auto||!Number.isFinite(percent))return;
    update(withAutoScale(value,layout,{...auto,adjust:{...auto.adjust,chips:{dx:0,dy:0,scale:1,...auto.adjust?.chips,[field]:percent/100}}}));};
  const frames=compositionAnchorFrames(scene.settings,layout,scene);
  function update(next:BlackjackTableGeometry|undefined){if(disabled)return;try{onChange(next);setError('');}catch(cause){setError((cause as Error).message);}}
  function place(id:string,p:TablePoint){
    if(disabled||!value||locked(value[layout],id))return;const next=structuredClone(value),[kind,index]=id.split(':');
    const bounded={x:Math.round(Math.max(0,Math.min(1,p.x))*10000)/10000,y:Math.round(Math.max(0,Math.min(1,p.y))*10000)/10000};
    if(kind==='dealer')next[layout].dealer=bounded;else next[layout].seats[Number(index)][kind as 'card'|'bet']=bounded;
    update(next);
  }
  function placeInScene(id:string,p:TablePoint){if(!geometry)return;const rect=resolveAnchorRect(geometry.anchors?.[id.startsWith('bet')?'bets':'cards'],frames);place(id,{x:(p.x-rect.x)/rect.width,y:(p.y-rect.y)/rect.height});}
  return <div className={styles.editor}>
    <div className={styles.preview}>{renderPreview(value?<SceneOverlay value={value} frames={frames} layout={layout} selected={selected?.id??''} disabled={disabled} onSelect={setTarget} onPlace={placeInScene}/>:undefined)}</div>
    <div className={styles.controls}>{children}
    <fieldset disabled={disabled}><legend>Kort och marker · {layout==='mobile'?'mobil':'desktop'}</legend>
    {!value?<><p>Ingen egen placering sparad för detta bord. Spelet använder tidigare placering.</p><button type="button" className="sg-btn sg-btn-secondary" onClick={()=>{
      // New geometry starts with autoScale in both formats.
      const next=defaultBlackjackTableGeometry(tableId);for(const format of ['mobile','desktop'] as const)next[format].autoScale=defaultBlackjackAutoScale();update(next);
    }}>Placera på detta bord</button></>:geometry?<>
      <p>{layout==='mobile'?'Mobil · tre synliga platser, här visas 3–5':'Desktop · sju platser'}. Placeringen hör till denna borddesign och detta format.</p>
      <fieldset className={styles.group}><legend>Autoskala efter dealern</legend>
        <label className={styles.toggle}><input type="checkbox" aria-label="Autoskala efter dealern" checked={!!auto} onChange={event=>update(withAutoScale(value,layout,event.target.checked?defaultBlackjackAutoScale():undefined))}/> Autoskala efter dealern</label>
        {auto?<>
          {([['landing','Korten landar där filmen visar'],['cardSize','Kortstorlek som dealerns rekvisitakort'],['chips','Marker under korten, skalade med dealern']] as const).map(([key,label])=>
            <label key={key} className={styles.toggle}><input type="checkbox" aria-label={label} checked={auto[key]} onChange={event=>update(withAutoScale(value,layout,{...auto,[key]:event.target.checked}))}/> {label}</label>)}
          <div className={styles.numbers}>
            {auto.cardSize&&<label>Kortstorlek %<input type="number" min="50" max="200" step="1" aria-label="Kortstorlek ovanpå autoskalan" value={Math.round((auto.adjust?.cards?.scale??1)*100)} onChange={event=>{
              if(Number.isFinite(event.target.valueAsNumber))update(withAutoScale(value,layout,{...auto,adjust:{...auto.adjust,cards:{scale:event.target.valueAsNumber/100}}}));}}/></label>}
            {auto.chips&&([['dx','Marker vågrätt'],['dy','Marker lodrätt'],['scale','Markerstorlek']] as const).map(([field,label])=><label key={field}>{label} %<input type="number" step={field==='scale'?1:.5} min={field==='scale'?50:-50} max={field==='scale'?200:50}
              aria-label={`${label} ovanpå autoskalan`} value={Math.round((auto.adjust?.chips?.[field]??(field==='scale'?1:0))*10000)/100} onChange={event=>adjustChips(field,event.target.valueAsNumber)}/></label>)}
          </div>
          <small>Kort och marker följer dealerns skala och läge. Landningen följer alltid filmen; bord, dealer och bakgrund justeras var för sig. Marker flyttas i % av dealerns bild.</small>
        </>:<small>Av: korten och markerna följer punkterna nedan, även när dealern flyttas.</small>}
      </fieldset>
      <div className={styles.groups}>{(['cards','bets'] as const).map(kind=>{
        const anchor=geometry.anchors?.[kind],rect=resolveAnchorRect(anchor,frames),linked=kind==='bets'?followCards:filmedCards;
        return <fieldset key={kind} className={styles.group}><legend>{kind==='cards'?'Kort':'Marker'}</legend>
          <label>Följer<select disabled={disabled||linked} aria-label={kind==='cards'?'Korten följer':'Markerna följer'} value={anchor?.target??'table'} onChange={event=>{const next=structuredClone(value);next[layout].anchors??={};next[layout].anchors![kind]=rebindAnchor(anchor,event.target.value as AnchorTarget,frames);update(next);}}>
            <option value="table">Bordet</option><option value="dealer">Dealern</option><option value="scene">Ligg still i scenen</option>
          </select></label>
          {linked?<small>{kind==='cards'?'Landar där filmen visar. De manuella punkterna sparas.':'Följer korten. Det manuella markerläget sparas.'}</small>:<div className={styles.numbers}>{(['x','y'] as const).map(axis=><label key={axis}>{axis==='x'?'Flytta grupp vågrätt':'Flytta grupp lodrätt'} %<input type="number" step="0.5" aria-label={`${kind==='cards'?'Kort':'Marker'} grupp ${axis}`} value={Math.round(rect[axis]/frames.scene[axis==='x'?'width':'height']*10000)/100} onChange={event=>{
            if(!Number.isFinite(event.target.valueAsNumber))return;const next=structuredClone(value),bound=rebindAnchor(anchor,anchor?.target??'table',frames),base=frames[bound.target],dimension=axis==='x'?'width':'height';
            bound.rect[axis]=(event.target.valueAsNumber/100*frames.scene[dimension]-base[axis])/base[dimension];next[layout].anchors??={};next[layout].anchors![kind]=bound;update(next);
          }}/></label>)}</div>}
          <button type="button" className="sg-btn sg-btn-secondary" disabled={!savedValue} onClick={()=>{if(savedValue)update(restoreGeometryGroup(value,savedValue,layout,kind));}}>Återställ sparade {kind==='cards'?'kort':'marker'}</button>
        </fieldset>;
      })}</div>
      <label className={styles.toggle}><input type="checkbox" aria-label="Markerna följer korten" disabled={!!auto?.chips} checked={!!followCards} onChange={event=>{const next=structuredClone(value);if(event.target.checked)next[layout].betMode='under-cards';else delete next[layout].betMode;update(next);}}/> Markerna följer korten</label>
      {selected&&point?<>
        <label>Flytta punkt<select value={selected.id} onChange={event=>setTarget(event.target.value)}>{targets.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
        <div className={styles.numbers}>{(['x','y'] as const).map(axis=><label key={axis}>{axis==='x'?'Punkt vågrätt':'Punkt lodrätt'} %<input type="number" min="0" max="100" step="0.5" value={Math.round(point[axis]*10000)/100} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))place(selected.id,{...point,[axis]:event.target.valueAsNumber/100});}}/></label>)}</div>
      </>:null}
      {auto?.cardSize?<p>Kortbredden följer dealerns rekvisitakort.</p>:<label>Kortbredd · % av kortramen<input type="range" min="2" max="15" step="0.1" value={geometry.cardWidth*100} onChange={event=>{const next=structuredClone(value);next[layout].cardWidth=Number(event.target.value)/100;update(next);}}/><output>{Math.round(geometry.cardWidth*1000)/10} %</output></label>}
      <p>Dra en punkt i scenen eller använd procentfälten. Gruppens läge kan flyttas separat. Filmens handrörelse och kortspår ändras inte.</p>
      <button type="button" className="sg-btn sg-btn-secondary" onClick={()=>update(undefined)}>Ta bort bordets placering</button>
    </>:null}
    {error&&<p role="alert">{error}</p>}
    </fieldset>
    </div>
  </div>;
}
