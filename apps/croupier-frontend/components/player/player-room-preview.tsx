'use client';
import {useState} from 'react';
import {PlayerSceneCanvas,type PlayerSceneCompositing} from './player-scene-canvas';
import {defaultCompositionSettings} from '../../../../packages/presentation/contracts/composition-settings.mjs';
import {dealerPortrait,type RoomPreviewResult} from '@/lib/player-room-preview.mjs';
import type {PublicPreviewLayer} from '../../../../web/public/operator-preview-contract.mjs';

type Media={src:string;contentType:string;compositing?:PlayerSceneCompositing};
export function PreviewImage({media,portrait,label,className=''}:{media?:Media|null;portrait?:string|null;label:string;className?:string}){
 const [portraitFailed,setPortraitFailed]=useState(false);
 const [mediaFailed,setMediaFailed]=useState(false);
 if(portrait&&!portraitFailed)return <img src={portrait} alt="" loading="lazy" decoding="async" className={className} onError={()=>setPortraitFailed(true)}/>;
 if(media&&!mediaFailed){
  if(media.compositing)return <div className={className+' relative overflow-hidden'}><div className="absolute inset-x-0 top-0"><PlayerSceneCanvas dealer={media} background={null} table={null} settings={defaultCompositionSettings()} compositing={media.compositing} label={label} still controls={false} onFailure={()=>setMediaFailed(true)}/></div></div>;
  return media.contentType.startsWith('video/')?<video src={media.src} muted playsInline preload="metadata" aria-label={label} className={className} onLoadedMetadata={event=>{const video=event.currentTarget;if(video.duration>0)video.currentTime=Math.min(.04,video.duration/2);}} onError={()=>setMediaFailed(true)}/>:<img src={media.src} alt="" loading="lazy" decoding="async" className={className} onError={()=>setMediaFailed(true)}/>;
 }
 return <div className={className+' flex items-center justify-center bg-[radial-gradient(ellipse_at_top,#263932,#101615)]'} aria-hidden="true"><svg viewBox="0 0 120 120" className="h-24 w-24 text-white/15" fill="currentColor"><circle cx="60" cy="40" r="22"/><path d="M20 112c0-31 16-46 40-46s40 15 40 46z"/></svg></div>;
}

const assetId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A published layer may still carry its storage ID as label; players get a neutral name.
export function choiceLabel(label:string,fallback:string){return assetId.test(label.trim())?fallback:label;}

export function SelectedMark(){
 return <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-2.5 z-[1] grid h-6 w-6 place-items-center rounded-full bg-lime text-ink shadow-[0_2px_10px_rgba(0,0,0,.5)]"><svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 10.5l3 3 6-7"/></svg></span>;
}

export function StepHeading({step,title,value}:{step:string;title:string;value?:string}){
 return <span className="flex items-baseline justify-between gap-4">
  <span className="font-mono text-[11px] uppercase tracking-[.16em] text-lime"><span aria-hidden="true">{'// '+step+' · '}</span>{title}</span>
  {value?<span aria-hidden="true" className="min-w-0 truncate font-mono text-[11px] text-white/55">{value}</span>:null}
 </span>;
}

export function PlayerRoomPreview({result,dealerId,dealerLabel,roomName,operatorName,tableAsset,background,game='blackjack'}:{result?:RoomPreviewResult;dealerId:string;dealerLabel:string;roomName:string;operatorName:string;game?:'blackjack'|'roulette';tableAsset?:string;background?:string}){
 const ready=result?.status==='ready'?result.preview:null;
 const table=ready?.media.tables.find(row=>row.id===tableAsset)??null;
 const back=ready?.media.backgrounds.find(row=>row.id===background)??null;
 const portrait=dealerPortrait(dealerId);
 // Mixed idle policies can prohibit independent layers even when this one clip
 // is green-screen. Keep the portrait until a complete scene can be represented.
 const scene=ready?.media.dealer&&(!ready.media.dealer.compositing||ready.independentLayers)?ready:null;
 const layers=[table?choiceLabel(table.label,'Valt bord'):null,back?choiceLabel(back.label,'Vald bakgrund'):null].filter(Boolean).join(' · ');
 return <div className="relative min-w-0 overflow-clip bg-[#0b0c0e]">
  <div aria-hidden="true" className="bg-grid absolute inset-0"/>
  <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_50%_42%,rgba(214,255,58,.11),transparent_62%)]"/>
  <div className="relative flex flex-col gap-5 px-4 py-6 sm:px-8 sm:py-8 lg:sticky lg:top-16">
   <div className="flex items-center justify-between gap-3">
    <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-lime/40 bg-ink/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.2em] text-lime"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-lime shadow-[0_0_0_4px_rgba(214,255,58,.18)]"/>Spelarvy</span>
    <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[.18em] text-white/45">{operatorName}</span>
   </div>
   <div className="mx-auto w-full max-w-[min(400px,calc(62svh*0.5625))] overflow-hidden rounded-[22px] bg-[#07090c] shadow-[0_30px_80px_rgba(0,0,0,.8),0_0_0_1px_rgba(255,255,255,.08)] lg:max-w-[min(440px,calc((100svh-14rem)*0.5625))]">
    {scene?.media.dealer?<PlayerSceneCanvas key={scene.media.dealer.src+':'+tableAsset+':'+background} dealer={scene.media.dealer} background={scene.independentLayers?back:null} table={scene.independentLayers?table:null} settings={scene.independentLayers?scene.settings:null} compositing={scene.media.dealer.compositing} label={dealerLabel+' i '+roomName}/>:<div className="relative aspect-[9/16]">
     <PreviewImage key={dealerId} portrait={portrait} media={ready?.media.dealer} label={dealerLabel} className="h-full w-full object-cover"/>
     <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-5 pb-5 pt-20"><p className="inline-flex rounded-full border border-white/15 bg-ink/70 px-3 py-1.5 text-xs text-white/75 backdrop-blur">{!result?'Hämtar rummets förhandsvisning…':ready?.media.dealer?'Dealerförhandsvisning · rummet visas i spelet':portrait?'Dealerporträtt · rummet visas i spelet':'Förhandsvisning saknas för denna dealer'}</p></div>
    </div>}
   </div>
   <div className="mx-auto w-full max-w-[440px]">
    <div className="flex flex-wrap items-end justify-between gap-3">
     <div className="min-w-0"><p className="text-2xl font-medium tracking-[-0.02em]">{dealerLabel}</p><p className="mt-1 truncate text-sm text-white/55">{roomName}</p></div>
     <span className="rounded-full border border-white/15 bg-ink/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[.16em] text-white/55">{game==='roulette'?'Roulette':'Blackjack'} · Demo</span>
    </div>
    {scene?.media.dealer?<p className="mt-3 text-xs leading-relaxed text-white/45">{scene.independentLayers?layers||'Dealern utan valbara miljölager':'Bord och bakgrund ingår i dealerfilmen.'}</p>:null}
    {result?.status==='changed'?<p role="status" className="mt-3 text-xs text-amber-200">Bolagets utbud har uppdaterats. Ladda om sidan för aktuella val.</p>:result?.status==='unavailable'?<p role="status" className="mt-3 text-xs text-white/50">Förhandsvisningen kan inte hämtas just nu.</p>:null}
   </div>
  </div>
 </div>;
}

export function EnvironmentChoices({step,legend,name,items,media,selected,allowEmpty,onChange}:{step:string;legend:string;name:string;items:{id:string;label:string}[];media?:PublicPreviewLayer[];selected?:string;allowEmpty:boolean;onChange:(id:string)=>void}){
 const tableLayer=legend==='Bordets utseende';
 const named=items.map((row,index)=>({id:row.id,label:choiceLabel(row.label,(tableLayer?'Bord ':'Bakgrund ')+(index+1))}));
 const options=allowEmpty?[{id:'',label:legend==='Bakgrund'?'Ingen bakgrund':'Inget bord'},...named]:named;
 const current=options.find(row=>row.id===(selected??''));
 return <fieldset className="py-7"><legend className="float-left w-full"><StepHeading step={step} title={legend} value={current?.label}/></legend>
  <div className="clear-both grid grid-cols-2 gap-3 pt-4" role="radiogroup" aria-label={legend}>
  {options.map(row=>{const asset=media?.find(item=>item.id===row.id),active=(selected??'')===row.id;return <label key={row.id} className={'group relative min-w-0 cursor-pointer overflow-hidden rounded-2xl border transition-[border-color,background-color,box-shadow] duration-200 focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-lime '+(active?'border-lime bg-lime/[.06] shadow-[0_0_0_1px_var(--color-lime)]':'border-white/10 bg-white/[.03] hover:border-white/30')}>
   {row.id?<PreviewImage key={asset?.src??row.id} media={asset} label={row.label} className={'aspect-[16/9] w-full '+(tableLayer?'bg-[radial-gradient(ellipse_at_center,#1d2320,#0c0f0e)] object-contain p-2':'object-cover')}/>:<div className="flex aspect-[16/9] items-center justify-center bg-[repeating-linear-gradient(135deg,rgba(255,255,255,.03)_0_8px,transparent_8px_16px)] text-3xl text-white/25" aria-hidden="true">∅</div>}
   {active?<SelectedMark/>:null}
   <span className="flex min-h-12 items-center gap-2 px-3 py-2.5"><span className={'min-w-0 break-words text-xs leading-snug '+(active?'text-off':'text-white/70')}>{row.label}</span><input type="radio" name={name} value={row.id} checked={active} onChange={()=>onChange(row.id)} className="sr-only"/></span>
  </label>})}
 </div></fieldset>;
}
