"use client"
import {useEffect,useRef,useState} from 'react';
import type {VideoEntry,VideoInventory} from '../../lib/connected-studio.mjs';
import {rouletteReviewForm,rouletteReviewMetadata,saveRouletteReview,type RouletteReviewForm} from '../../lib/roulette-media-review.mjs';

export function RouletteMediaReview({video,dealerId,blocked,onSaved,onBusyChange,onDirtyChange}:{video:VideoEntry;dealerId:string;blocked:boolean;
  onSaved:(inventory:VideoInventory)=>void;onBusyChange:(busy:boolean)=>void;onDirtyChange:(dirty:boolean)=>void}) {
  const [form,setForm]=useState(()=>rouletteReviewForm(video)),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const request=useRef<AbortController|null>(null);
  const dirty=JSON.stringify(form)!==JSON.stringify(rouletteReviewForm(video));
  useEffect(()=>{onDirtyChange(dirty);},[dirty,onDirtyChange]);
  useEffect(()=>()=>{request.current?.abort();onBusyChange(false);onDirtyChange(false);},[onBusyChange,onDirtyChange]);
  let validation='';try{rouletteReviewMetadata(video,dealerId,form);}catch(cause){validation=(cause as Error).message;}
  async function save(){
    if(request.current||blocked||validation)return;
    const controller=new AbortController();request.current=controller;setSaving(true);onBusyChange(true);setError('');setNotice('');
    try{const inventory=await saveRouletteReview(video,dealerId,form,{signal:controller.signal});if(!controller.signal.aborted){setForm(rouletteReviewForm(inventory.videos.find(row=>row.id===video.id)!));onSaved(inventory);setNotice('Filmgranskningen är sparad. Utkast och publicering ändras separat.');}}
    catch(cause){if(!controller.signal.aborted)setError((cause as Error).message);}
    finally{request.current=null;if(!controller.signal.aborted){setSaving(false);onBusyChange(false);}}
  }
  return <section className="space-y-2" aria-label="Granska roulettefilmens poser och inramning">
    <h3>Filmgranskning · {video.label}</h3><p>Granska första och sista bildrutan samt placeringen. Posevalen registrerar din bedömning av just dessa bytes; de godkänner inte en gest automatiskt.</p>
    <p className="break-all">Video {video.id} · SHA-256 {video.sha256??'saknas'}</p>
    <video key={video.id} src={video.previewUrl} controls muted playsInline preload="metadata" className="w-full max-h-64" aria-label="Granska filmens första och sista bildruta"/>
    <fieldset disabled={blocked||saving} className="space-y-2">
      {(['startPose','endPose'] as const).map(key=><label key={key} className="studio-field">{key==='startPose'?'Startpose':'Slutpose'}<select value={form[key]} onChange={event=>setForm(current=>({...current,[key]:event.target.value as RouletteReviewForm[typeof key]}))}><option value="unverified">Inte granskad</option><option value="VILA">VILA</option><option value="WHEEL">Vid hjulet</option></select></label>)}
      {(['scale','x','y'] as const).map(key=><label key={key} className="studio-field">Inramning · {key==='scale'?'skala':key}<input type="number" step="0.001" min={key==='scale' ? .25 : -2} max={key==='scale'?6:2} value={form[key]} onChange={event=>setForm(current=>({...current,[key]:event.target.value}))}/></label>)}
      <button type="button" className="studio-button" disabled={!dirty||Boolean(validation)} onClick={()=>void save()}>{saving?'Sparar granskning…':'Spara filmgranskning'}</button>
    </fieldset>
    {(error||validation)&&<p role="alert" className="text-sg-red">{error||validation}</p>}{notice&&<p role="status">{notice}</p>}
  </section>;
}
