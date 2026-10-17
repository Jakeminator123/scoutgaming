'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {drawDealerFrame,keyGreenPixels,type DealerFraming} from '../../packages/presentation/contracts/dealer-framing.mjs';
import {effectiveDealerCompositing} from '../../packages/presentation/contracts/dealer-compositing.mjs';
import type {VideoCompositing} from '../../packages/presentation/contracts/video-intake.mjs';
import {PresentationFrame} from './presentation-frame';
import styles from './dealer-video-surface.module.css';
function isDealerImage(source:HTMLVideoElement|HTMLImageElement|null):source is HTMLImageElement{
  return source?.tagName==='IMG';
}

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
    let raf=0,lastVideo:HTMLVideoElement|HTMLImageElement|null=null,lastTime=-1,lastWidth=0,lastSource='',failedSource='';
    setError('');
    const reset=()=>{context.clearRect(0,0,960,540);lastVideo=null;lastTime=-1;lastWidth=0;lastSource='';failedSource='';setError('');};
    root.addEventListener('loadstart',reset,true);root.addEventListener('emptied',reset,true);
    const paint=()=>{
      const video=root.querySelector('video,img') as HTMLVideoElement|HTMLImageElement|null;
      const source=video?.src??'';
      const width=isDealerImage(video)?video.naturalWidth:video?.videoWidth??0;
      const time=isDealerImage(video)?0:video?.currentTime??0;
      const ready=isDealerImage(video)?video.complete&&width>0:(video?.readyState??0)>=2;
      if(source!==lastSource&&failedSource){failedSource='';setError('');}
      try{
        if(!video||!ready){context.clearRect(0,0,960,540);lastVideo=null;lastTime=-1;}
        else if(width&&source!==failedSource&&(lastVideo!==video||lastTime!==time||lastWidth!==width||lastSource!==source)){
          drawDealerFrame(context,video,960,540,framing,false);
          const frame=context.getImageData(0,0,960,540);keyGreenPixels(frame.data,keyed);context.putImageData(frame,0,0);
          lastVideo=video;lastTime=time;lastWidth=width;lastSource=source;
        }
      }catch{failedSource=source;lastSource=source;context.clearRect(0,0,960,540);if(video&&!isDealerImage(video))video.pause();setError('Förhandsvisningen kunde inte friläggas. Kontrollera filen och försök igen.');}
      raf=requestAnimationFrame(paint);
    };
    raf=requestAnimationFrame(paint);return()=>{cancelAnimationFrame(raf);root.removeEventListener('loadstart',reset,true);root.removeEventListener('emptied',reset,true);};
  },[framing?.scale,framing?.x,framing?.y,JSON.stringify(keyed)]);
  return <div ref={host} className={`stage-video dealer-video-surface ${styles.surface}`} data-keyed="true">
    {children}<canvas ref={canvas} aria-label="Anpassad dealerbild"/>{error?<p role="alert">{error}</p>:null}
    {compositing?.mode==='opaque'?<p role="alert" className={styles.legacy}>Äldre klipp behöver uppdateras före publicering. Om filmen har en inbakad miljö: ersätt den med en grön originalfilm.</p>:null}
  </div>;
}

export function DealerClipPreview({url,framing,compositing,label='Förhandsvisa vald fil',muted=false,onError,mediaType}:{url:string;framing?:DealerFraming;compositing?:VideoCompositing;label?:string;muted?:boolean;onError?:()=>void;mediaType?:'image'}){
  const video=useRef<HTMLVideoElement>(null),[error,setError]=useState('');
  return <div><PresentationFrame label="Dealerklipp"><DealerVideoSurface framing={framing} compositing={compositing}>
    {mediaType==='image'?<img src={url} alt={label} style={{visibility:'hidden',position:'absolute',width:1,height:1}} onError={()=>{setError('Bilden kunde inte läsas.');onError?.();}}/>:<video ref={video} src={url} playsInline muted={muted} preload="metadata" aria-label={label} onError={()=>{setError('Videon kunde inte läsas.');onError?.();}}/>}
  </DealerVideoSurface></PresentationFrame>
    {mediaType!=='image'?<button type="button" onClick={()=>{const element=video.current;if(element?.paused)void element.play().catch(()=>setError('Videon kunde inte starta.'));else element?.pause();}}>Spela / pausa</button>:null}
    {error?<p role="alert">{error}</p>:null}
  </div>;
}
