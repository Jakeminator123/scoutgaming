"use client";

import { useEffect, useRef, useState } from 'react';
import { suppliedDealerArtwork } from '../../lib/dealer-artwork.mjs';
import { createPortraitPlayback, type PortraitPlayback } from '../../lib/dealer-playback.mjs';

type DealerIdentityPortraitProps = { dealer: { id: string; label: string }; className?: string };
const mediaStyle = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 50%' } as const;

/** Identity artwork only: no catalogue mutation, speech take or room permission. */
export function DealerIdentityPortrait({ dealer, className = '' }: DealerIdentityPortraitProps) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const playback = useRef<PortraitPlayback | null>(null);
  const artwork = suppliedDealerArtwork({ id: dealer.id, name: dealer.label });
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const [failedVideo, setFailedVideo] = useState<string | null>(null);
  const [requestedSource, setRequestedSource] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const image = artwork?.image !== failedImage ? artwork?.image : undefined;
  const videoSource = image && artwork?.approvedVideo.src !== failedVideo ? artwork?.approvedVideo.src : undefined;
  const requested = Boolean(videoSource && requestedSource === videoSource);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio > 0));
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setReducedMotion(preference.matches);
    const syncVisibility = () => setPageVisible(!document.hidden);
    observer.observe(node); syncPreference(); syncVisibility();
    preference.addEventListener('change', syncPreference);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => { observer.disconnect(); preference.removeEventListener('change', syncPreference); document.removeEventListener('visibilitychange', syncVisibility); };
  }, []);

  useEffect(() => {
    if (!videoSource) return;
    const controller = createPortraitPlayback({ start: () => setRequestedSource(videoSource),
      stop: () => { video.current?.pause(); setPlaying(false); setRequestedSource(null); } });
    playback.current = controller;
    return () => { controller.dispose(); if (playback.current === controller) playback.current = null; };
  }, [videoSource]);

  const eligible = Boolean(videoSource && inView && pageVisible && !reducedMotion);
  useEffect(() => { playback.current?.setEligible(eligible); }, [eligible, videoSource]);
  useEffect(() => {
    const node = video.current;
    if (!node || !requested || !eligible || !videoSource) return;
    let disposed = false;
    node.muted = true;
    node.play().catch(() => { if (!disposed) { setFailedVideo(videoSource); playback.current?.finish(); } });
    return () => { disposed = true; node.pause(); };
  }, [requested, eligible, videoSource]);

  return <div ref={root} className={`relative overflow-hidden rounded-lg bg-sg-surface-2 ${className}`} style={{ aspectRatio: '1' }}>
    {image ? <img src={image} alt={`Porträtt av ${dealer.label}`} loading="lazy" style={mediaStyle} onError={() => setFailedImage(image)} />
      : <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white" style={{background:dealerTone(dealer.label)}} role="img" aria-label={`Porträtt saknas för ${dealer.label}`}>{dealerInitials(dealer.label)}</span>}
    {requested && eligible && videoSource && <video ref={video} src={videoSource} muted playsInline preload="auto" aria-hidden
      style={{ ...mediaStyle, opacity: playing ? 1 : 0, transition: 'opacity 250ms' }}
      onPlaying={() => setPlaying(true)} onEnded={() => playback.current?.finish()}
      onError={() => { setFailedVideo(videoSource); playback.current?.finish(); }} />}
  </div>;
}

// Card avatar: supplied artwork, else a still from the dealer's bound idle clip, else initials on a
// colour derived from the name. Pure presentation; reads no register of its own. `motion` lets the supplied
// portrait play its short clip (in view, visible tab, no reduced motion); lists pass false and show the still.
const avatarTones=['#7c8cff','#ff8f5a','#4fd1a5','#f5b83d','#c084fc','#5ec4ff','#f472b6'];
export const dealerInitials=(label:string)=>label.split(/\s+/).filter(Boolean).slice(0,2).map(word=>Array.from(word)[0]).join('').toUpperCase()||'?';
export const dealerTone=(label:string)=>avatarTones[[...label].reduce((sum,char)=>sum+char.charCodeAt(0),0)%avatarTones.length];
export function DealerAvatar({dealer,still,size=56,className='',motion=true,round=false}:{dealer:{id:string;label:string};still?:{url:string;image:boolean}|null;size?:number;className?:string;motion?:boolean;round?:boolean}) {
  const [failed,setFailed]=useState('');
  const artwork=suppliedDealerArtwork({id:dealer.id,name:dealer.label});
  const box={width:size,height:size,minWidth:size};
  const shape=round?'rounded-full':size<40?'rounded-lg':'rounded-xl';
  if(artwork&&motion)return <span className={`block overflow-hidden ${shape} ${className}`} style={box}><DealerIdentityPortrait dealer={dealer} className="size-full rounded-none"/></span>;
  const image=artwork?{url:artwork.image,image:true}:still;
  if(image&&failed!==image.url)return <span className={`relative block overflow-hidden bg-sg-ink ${shape} ${className}`} style={box}>
    {image.image?<img src={image.url} alt={artwork?`Porträtt av ${dealer.label}`:''} loading="lazy" className="absolute inset-0 size-full object-cover" onError={()=>setFailed(image.url)}/>
      :<video src={image.url+'#t=1'} muted playsInline preload="metadata" aria-hidden="true" className="absolute inset-0 size-full object-cover" onError={()=>setFailed(image.url)}/>}
  </span>;
  return <span aria-hidden="true" className={`grid place-items-center font-bold text-white ${shape} ${className}`} style={{...box,background:dealerTone(dealer.label),fontSize:Math.round(size*0.36)}}>{dealerInitials(dealer.label)}</span>;
}

/** A dealer list as overlapping round portraits followed by the names: rooms, scene templates and the package. */
export function DealerFaces({dealers,size=24,max=4,names=true,empty='–'}:{dealers:{id:string;label:string}[];size?:number;max?:number;names?:boolean;empty?:string}) {
  if(!dealers.length)return <span className="text-sg-muted">{empty}</span>;
  const shown=dealers.slice(0,max),rest=dealers.length-shown.length;
  return <span className="inline-flex min-w-0 items-center gap-2">
    <span className="flex shrink-0 items-center" aria-hidden="true">{shown.map((dealer,index)=><DealerAvatar key={dealer.id} dealer={dealer} size={size} motion={false} round className={index?'-ml-1.5 ring-2 ring-sg-surface':'ring-2 ring-sg-surface'}/>)}
      {rest>0&&<span className="-ml-1.5 grid place-items-center rounded-full bg-sg-hover text-[10.5px] font-semibold text-sg-muted ring-2 ring-sg-surface" style={{width:size,height:size}}>+{rest}</span>}</span>
    {names&&<span className="min-w-0 truncate">{dealers.map(dealer=>dealer.label).join(', ')}</span>}
  </span>;
}
