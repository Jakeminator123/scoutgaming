'use client';
import {useState} from 'react';
import {PlayerSceneCanvas,type PlayerSceneCompositing} from './player-scene-canvas';
import {defaultCompositionSettings} from '../../../../web/public/composition-settings.mjs';
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
export function PlayerRoomPreview({result,dealerId,dealerLabel,roomName,operatorName,tableAsset,background}:{result?:RoomPreviewResult;dealerId:string;dealerLabel:string;roomName:string;operatorName:string;tableAsset?:string;background?:string}){
 const ready=result?.status==='ready'?result.preview:null;
 const table=ready?.media.tables.find(row=>row.id===tableAsset)??null;
 const back=ready?.media.backgrounds.find(row=>row.id===background)??null;
 const portrait=dealerPortrait(dealerId);
 // Mixed idle policies can prohibit independent layers even when this one clip
 // is green-screen. Keep the portrait until a complete scene can be represented.
 const scene=ready?.media.dealer&&(!ready.media.dealer.compositing||ready.independentLayers)?ready:null;
 return <div className="relative min-w-0 rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top,#20362f,#0c1210_75%)] p-4 sm:p-6 lg:sticky lg:top-6 lg:self-start">
  <div className="mb-5 flex items-center justify-between gap-3"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#d4f83a]">Ditt bord</p><span className="truncate text-xs text-white/45">{operatorName}</span></div>
  <div className="mx-auto max-w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#080c0a] shadow-2xl sm:max-w-[400px] lg:max-w-[450px]">
   {scene?.media.dealer?<PlayerSceneCanvas key={scene.media.dealer.src+':'+tableAsset+':'+background} dealer={scene.media.dealer} background={scene.independentLayers?back:null} table={scene.independentLayers?table:null} settings={scene.independentLayers?scene.settings:null} compositing={scene.media.dealer.compositing} label={dealerLabel+' i '+roomName}/>:<div className="relative aspect-[9/16]">
     <PreviewImage key={dealerId} portrait={portrait} media={ready?.media.dealer} label={dealerLabel} className="h-full w-full object-cover"/>
     <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-6 pb-7 pt-24"><p className="text-3xl font-medium tracking-tight">{dealerLabel}</p><p className="mt-2 text-sm text-white/65">{!result?'Hämtar rummets förhandsvisning…':ready?.media.dealer?'Dealerförhandsvisning · rummet visas i spelet':portrait?'Dealerporträtt · rummet visas i spelet':'Förhandsvisning saknas för denna dealer'}</p></div>
    </div>}
  </div>
  <div className="mt-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xl font-medium tracking-tight">{dealerLabel}</p><p className="mt-1 text-sm text-white/55">{roomName}</p></div><span className="rounded-full border border-white/15 px-3 py-1 text-[10px] text-white/50">Blackjack · Demo</span></div>
  {scene?.media.dealer?<p className="mt-3 text-xs leading-relaxed text-white/45">{scene.independentLayers?[table?.label,back?.label].filter(Boolean).join(' · ')||'Dealern utan valbara miljölager':'Bord och bakgrund ingår i dealerfilmen.'}</p>:null}
  {result?.status==='changed'?<p role="status" className="mt-3 text-xs text-amber-200">Bolagets utbud har uppdaterats. Ladda om sidan för aktuella val.</p>:result?.status==='unavailable'?<p role="status" className="mt-3 text-xs text-white/50">Förhandsvisningen kan inte hämtas just nu.</p>:null}
 </div>;
}
export function EnvironmentChoices({legend,name,items,media,selected,allowEmpty,onChange}:{legend:string;name:string;items:{id:string;label:string}[];media?:PublicPreviewLayer[];selected?:string;allowEmpty:boolean;onChange:(id:string)=>void}){
 const options=allowEmpty?[{id:'',label:legend==='Bakgrund'?'Ingen bakgrund':'Inget bord'},...items]:items;
 return <fieldset className="mt-7"><legend className="text-base font-medium">{legend}</legend><div className="mt-3 grid grid-cols-2 gap-3" role="radiogroup" aria-label={legend}>
  {options.map(row=>{const asset=media?.find(item=>item.id===row.id);return <label key={row.id} className={'relative min-w-0 cursor-pointer overflow-hidden rounded-xl border transition-colors focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-[#d4f83a] '+((selected??'')===row.id?'border-[#d4f83a] bg-[#d4f83a]/5':'border-white/10 bg-white/[.025] hover:border-white/35')}>
   {row.id?<PreviewImage key={asset?.src??row.id} media={asset} label={row.label} className={'aspect-[16/9] w-full '+(legend==='Bordets utseende'?'object-contain p-2':'object-cover')}/>:<div className="flex aspect-[16/9] items-center justify-center text-3xl text-white/25" aria-hidden="true">∅</div>}
   <span className="flex min-h-14 items-center justify-between gap-2 p-3"><span className="min-w-0 break-words text-xs leading-relaxed text-white/80">{row.label}</span><input type="radio" name={name} value={row.id} checked={(selected??'')===row.id} onChange={()=>onChange(row.id)} className="h-4 w-4 shrink-0 accent-[#d4f83a]"/></span>
  </label>})}
 </div></fieldset>;
}
