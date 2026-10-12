'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {drawDealerFrame,keyGreenPixels,type DealerFraming} from '../../web/public/dealer-framing.mjs';
import {effectiveDealerCompositing} from '../../web/public/dealer-compositing.mjs';
import type {VideoCompositing} from '../lib/video-intake.mjs';
import {PresentationFrame} from './presentation-frame';
import styles from './dealer-video-surface.module.css';

// The existing video remains the sole playback clock and owns all receipts.
// This canvas changes only the visible pixels, including while paused.
export function DealerVideoSurface({children,framing,compositing}:{children:ReactNode;framing?:DealerFraming;compositing?:VideoCompositing}){
  const host=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);
  const [error,setError]=useState('');
  const keyed=effectiveDealerCompositing(compositing);
  useEffect(()=>{
    const root=host.current,output=canvas.current;if(!root||!output)return;
    const context=output.getContext('2d',{willReadFrequently:true});if(!context){setError('Förhandsvisningen kan inte friläggas i den här webbläsaren.');return;}
    output.width=960;output.height=540;
    let raf=0,lastVideo:HTMLVideoElement|null=null,lastTime=-1,lastWidth=0,lastSource='',failedSource='';
    setError('');
    const reset=()=>{context.clearRect(0,0,960,540);lastVideo=null;lastTime=-1;lastWidth=0;lastSource='';failedSource='';setError('');};
    root.addEventListener('loadstart',reset,true);root.addEventListener('emptied',reset,true);
    const paint=()=>{
      const video=root.querySelector('video');
      const source=video?.src??'';
      if(source!==lastSource&&failedSource){failedSource='';setError('');}
      try{
        if(!video||video.readyState<2){context.clearRect(0,0,960,540);lastVideo=null;lastTime=-1;}
        else if(video.videoWidth&&source!==failedSource&&(lastVideo!==video||lastTime!==video.currentTime||lastWidth!==video.videoWidth||lastSource!==source)){
          drawDealerFrame(context,video,960,540,framing,false);
          const frame=context.getImageData(0,0,960,540);keyGreenPixels(frame.data,keyed);context.putImageData(frame,0,0);
          lastVideo=video;lastTime=video.currentTime;lastWidth=video.videoWidth;lastSource=source;
        }
      }catch{failedSource=source;lastSource=source;context.clearRect(0,0,960,540);video?.pause();setError('Förhandsvisningen kunde inte friläggas. Kontrollera filen och försök igen.');}
      raf=requestAnimationFrame(paint);
    };
    raf=requestAnimationFrame(paint);return()=>{cancelAnimationFrame(raf);root.removeEventListener('loadstart',reset,true);root.removeEventListener('emptied',reset,true);};
  },[framing?.scale,framing?.x,framing?.y,keyed.threshold,keyed.softness,keyed.despill]);
  return <div ref={host} className={`stage-video dealer-video-surface ${styles.surface}`} data-keyed="true">
    {children}<canvas ref={canvas} aria-label="Anpassad dealerbild"/>{error?<p role="alert">{error}</p>:null}
    {compositing?.mode==='opaque'?<p role="alert" className={styles.legacy}>Äldre klipp behöver uppdateras före publicering. Om filmen har en inbakad miljö: ersätt den med en grön originalfilm.</p>:null}
  </div>;
}

export function DealerClipPreview({url,framing,compositing,label='Förhandsvisa vald fil',muted=false,onError}:{url:string;framing?:DealerFraming;compositing?:VideoCompositing;label?:string;muted?:boolean;onError?:()=>void}){
  const video=useRef<HTMLVideoElement>(null),[error,setError]=useState('');
  return <div><PresentationFrame label="Dealerklipp"><DealerVideoSurface framing={framing} compositing={compositing}>
    <video ref={video} src={url} playsInline muted={muted} preload="metadata" aria-label={label} onError={()=>{setError('Videon kunde inte läsas.');onError?.();}}/>
  </DealerVideoSurface></PresentationFrame>
    <button type="button" onClick={()=>{const element=video.current;if(element?.paused)void element.play().catch(()=>setError('Videon kunde inte starta.'));else element?.pause();}}>Spela / pausa</button>
    {error?<p role="alert">{error}</p>:null}
  </div>;
}
