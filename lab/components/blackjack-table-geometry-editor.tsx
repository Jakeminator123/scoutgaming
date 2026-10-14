'use client';
import {useState} from 'react';
import {defaultBlackjackTableGeometry,type BlackjackTableGeometry,type TablePoint} from '../../web/public/composition-settings.mjs';
import styles from './blackjack-table-geometry-editor.module.css';

export function BlackjackTableGeometryEditor({tableId,url,contentType,value,layout,disabled,onChange}:{tableId:string;url:string;contentType:string;value?:BlackjackTableGeometry;layout:'mobile'|'desktop';disabled:boolean;onChange:(value?:BlackjackTableGeometry)=>void}){
  const [target,setTarget]=useState('dealer');
  const count=layout==='mobile'?3:7;
  const followCards=value?.[layout].betMode==='under-cards';
  const targets=[{id:'dealer',label:'Dealer · kort'},...Array.from({length:count},(_,i)=>[
    {id:`card:${i}`,label:`Plats ${i+1} · kort`},...(!followCards?[{id:`bet:${i}`,label:`Plats ${i+1} · insatscirkel`}]:[]),
  ]).flat()];
  const selected=targets.find(row=>row.id===target)??targets[0];
  const geometry=value?.[layout],part=selected.id.split(':'),seat=Number(part[1]);
  const point=geometry?(part[0]==='dealer'?geometry.dealer:geometry.seats[seat][part[0] as 'card'|'bet']):undefined;
  function place(nextPoint:TablePoint){
    if(disabled||!value)return;
    const next=structuredClone(value),p={x:Math.round(Math.max(0,Math.min(1,nextPoint.x))*1000)/1000,y:Math.round(Math.max(0,Math.min(1,nextPoint.y))*1000)/1000};
    if(part[0]==='dealer')next[layout].dealer=p;else next[layout].seats[seat][part[0] as 'card'|'bet']=p;
    onChange(next);
  }
  return <fieldset className={styles.editor} disabled={disabled}><legend>Kort och insatsplatser · {layout==='mobile'?'mobil':'desktop'}</legend>
    <p>Placeringen hör bara till denna bordbild. Ett annat bord behöver egna platser.</p>
    {!value?<><p>Ingen egen placering sparad för detta bord. Spelet använder tidigare placering.</p><button type="button" className="sg-btn sg-btn-secondary" onClick={()=>onChange(defaultBlackjackTableGeometry(tableId))}>Placera på detta bord</button></>:geometry&&point?<>
      <p>{layout==='mobile'?'Mobil · tre synliga platser':'Desktop · sju platser'}. Välj kort eller insatscirkel under Flytta och klicka på bilden. Finjustera med piltangenter eller procentfälten. Spara och provspela båda formaten.</p>
      <div className="sg-tabs" role="group" aria-label="Insatscirklarnas placering">
        <button type="button" className="sg-btn sg-btn-secondary" aria-pressed={followCards} onClick={()=>{if(!value||followCards)return;const next=structuredClone(value);next[layout].betMode='under-cards';onChange(next);}}>Följ korten</button>{' '}
        <button type="button" className="sg-btn sg-btn-secondary" aria-pressed={!followCards} onClick={()=>{if(!value||!followCards)return;const next=structuredClone(value);delete next[layout].betMode;onChange(next);}}>Placera cirklar själv</button>
      </div>
      <p>{followCards?'Insatscirklarna följer kort och poäng i spelet. Välj Placera cirklar själv om du vill flytta dem var för sig.':'Välj en insatscirkel under Flytta och klicka på bordbilden. Dina manuella punkter finns kvar när du växlar tillbaka till Följ korten.'}</p>
      <label className="field">Flytta<select value={selected.id} onChange={event=>setTarget(event.target.value)}>{targets.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
      <button type="button" className={styles.board} aria-label={`Placera ${selected.label} på bordet`} onClick={event=>{
        if(!event.detail)return;const rect=event.currentTarget.getBoundingClientRect();
        if(rect.width&&rect.height)place({x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height});
      }} onKeyDown={event=>{const delta:Record<string,[number,number]>={ArrowLeft:[-.005,0],ArrowRight:[.005,0],ArrowUp:[0,-.005],ArrowDown:[0,.005]};if(delta[event.key]){event.preventDefault();place({x:point.x+delta[event.key][0],y:point.y+delta[event.key][1]});}}}>
        {contentType.startsWith('video/')?<video src={url} muted playsInline preload="metadata"/>:<img src={url} alt=""/>}
        {[{id:'dealer',point:geometry.dealer,kind:'card',label:'D'},...geometry.seats.flatMap((row,i)=>[
          {id:`card:${i}`,point:row.card,kind:'card',label:String(i+1)},...(!followCards?[{id:`bet:${i}`,point:row.bet,kind:'bet',label:String(i+1)}]:[]),
        ])].map(mark=><span key={mark.id} aria-hidden="true" data-selected={mark.id===selected.id} className={mark.kind==='card'?styles.card:styles.bet} style={{left:`${mark.point.x*100}%`,top:`${mark.point.y*100}%`,...(mark.kind==='card'?{width:`${geometry.cardWidth*100}%`}:{})}}>{mark.label}</span>)}
      </button>
      <div className={styles.numbers}>{(['x','y'] as const).map(axis=><label key={axis}>{axis==='x'?'Vågrätt':'Lodrätt'} %<input type="number" min="0" max="100" step="0.1" value={Math.round(point[axis]*1000)/10} onChange={event=>{if(event.target.value!==''&&Number.isFinite(event.target.valueAsNumber))place({...point,[axis]:event.target.valueAsNumber/100});}}/></label>)}</div>
      <label className="field">Kortbredd · % av bordbilden<input type="range" min="2" max="15" step="0.1" value={geometry.cardWidth*100} onChange={event=>{if(!value)return;const next=structuredClone(value);next[layout].cardWidth=Number(event.target.value)/100;onChange(next);}}/><output>{Math.round(geometry.cardWidth*1000)/10} %</output></label>
      <p>Visar stilla spelkort och insatser. Filmad givning kalibreras separat. Tar du bort placeringen används den tidigare placeringen igen.</p>
      <button type="button" className="sg-btn sg-btn-secondary" onClick={()=>onChange(undefined)}>Ta bort bordets placering</button>
    </>:null}
  </fieldset>;
}
