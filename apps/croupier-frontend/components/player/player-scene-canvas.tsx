'use client';

import {useEffect, useRef, useState} from 'react';
import {type CompositionSettings} from '../../../../packages/presentation/contracts/composition-settings.mjs';
import type {PublicPreviewCompositing} from '../../../../web/public/operator-preview-contract.mjs';

import {mountPublishedScene} from '../../../../web/public/published-scene.mjs';

export type PlayerSceneSource = {src:string; contentType:string};
export type PlayerSceneCompositing = PublicPreviewCompositing;
type Props = {
  dealer:PlayerSceneSource|null;
  background:PlayerSceneSource|null;
  table:PlayerSceneSource|null;
  settings:CompositionSettings|null;
  compositing?:PlayerSceneCompositing;
  label:string;
  still?:boolean;
  controls?:boolean;
  onReady?:()=>void;
  onFailure?:()=>void;
};
const failureMessage = 'Förhandsvisningen kunde inte visas. Du kan fortfarande välja dealer och öppna spelet.';

export function PlayerSceneCanvas(props:Props) {
  // A replacement canvas removes the previous dealer synchronously, before decoding
  // the next selection. Source URLs belong to the published preview projection.
  const sourceKey = JSON.stringify([props.dealer, props.background, props.table, props.settings, props.compositing, props.still ?? false]);
  return <Scene key={sourceKey} {...props}/>;
}

function Scene({dealer, background, table, settings, compositing, label, still=false, controls=true, onReady, onFailure}:Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const toggleMotion = useRef<()=>void>(()=>{});
  const callbacks = useRef({onReady,onFailure});
  callbacks.current = {onReady,onFailure};
  const [status,setStatus] = useState<'loading'|'ready'|'error'>('loading');
  const [playing,setPlaying] = useState(false);
  const hasVideo = [dealer, ...(settings ? [background,table] : [])].some(source=>source?.contentType.startsWith('video/'));

  useEffect(()=>{
    const currentCanvas = canvas.current;
    if (!currentCanvas || !dealer) return;
    const scene = mountPublishedScene(currentCanvas, {dealer,background,table,settings,compositing,still,
      onReady:()=>{setStatus('ready');callbacks.current.onReady?.();},
      onFailure:()=>{setStatus('error');callbacks.current.onFailure?.();},onPlaying:setPlaying,
    });
    toggleMotion.current=scene.toggle;
    return ()=>{scene.close();toggleMotion.current=()=>{};};
    // The keyed parent remounts this whole lifecycle for any media/settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  if (!dealer) return <div role="status" style={{display:'grid',placeItems:'center',aspectRatio:'9 / 16',padding:24,textAlign:'center',color:'#a9adb4'}}>Ingen dealerpreview är publicerad för detta val.</div>;
  return <div style={{position:'relative',width:'100%',aspectRatio:'9 / 16',overflow:'hidden',background:'#07090c'}}>
    <canvas ref={canvas} width={720} height={1280} role="img" aria-label={label}
      style={{display:'block',width:'100%',height:'100%',visibility:status==='ready'?'visible':'hidden'}}/>
    {status !== 'ready' ? <div role="status" aria-live="polite" style={{position:'absolute',inset:0,display:'grid',placeItems:'center',padding:28,textAlign:'center',color:'#c4c7cd',fontSize:14}}>
      {status==='error' ? failureMessage : 'Laddar dealerpreview…'}
    </div> : null}
    {controls && !still && status==='ready' && hasVideo ? <button type="button" onClick={()=>toggleMotion.current()} aria-label={playing?'Pausa dealerpreview':'Spela dealerpreview'}
      style={{position:'absolute',bottom:16,right:16,zIndex:2,border:'1px solid #ffffff45',borderRadius:999,padding:'9px 15px',background:'#080a0de6',color:'#fff',fontSize:13,cursor:'pointer'}}>
      <span aria-hidden="true">{playing?'Ⅱ':'▶'}</span> {playing?'Pausa':'Spela'}
    </button> : null}
  </div>;
}
