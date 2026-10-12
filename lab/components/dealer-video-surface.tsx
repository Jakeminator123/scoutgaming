'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {drawDealerFrame,keyGreenPixels,type DealerFraming} from '../../web/public/dealer-framing.mjs';
import type {VideoCompositing} from '../lib/video-intake.mjs';
import {PresentationFrame} from './presentation-frame';

// The existing video remains the sole playback clock and owns all receipts.
// This canvas changes only the visible pixels, including while paused.
export function DealerVideoSurface({children,framing,compositing,removeGreen=false}:{children:ReactNode;framing?:DealerFraming;compositing?:VideoCompositing;removeGreen?:boolean}){
  const host=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    const root=host.current,output=canvas.current;if(!root||!output)return;
    const context=output.getContext('2d',{willReadFrequently:removeGreen});if(!context)return;
    output.width=960;output.height=540;
    let raf=0,lastVideo:HTMLVideoElement|null=null,lastTime=-1,lastWidth=0;
    setError('');
    const paint=()=>{
      const video=root.querySelector('video');
      try{
        if(video&&video.readyState>=2&&video.videoWidth&&(lastVideo!==video||lastTime!==video.currentTime||lastWidth!==video.videoWidth)){
          drawDealerFrame(context,video,960,540,framing,compositing?.mode==='green-screen'&&!removeGreen);
          if(removeGreen&&compositing?.mode==='green-screen'){
            const frame=context.getImageData(0,0,960,540);keyGreenPixels(frame.data,compositing);context.putImageData(frame,0,0);
          }
          lastVideo=video;lastTime=video.currentTime;lastWidth=video.videoWidth;
        }
      }catch{setError('Förhandsvisningen kunde inte friläggas. Kontrollera filen och försök igen.');return;}
      raf=requestAnimationFrame(paint);
    };
    raf=requestAnimationFrame(paint);return()=>cancelAnimationFrame(raf);
  },[framing?.scale,framing?.x,framing?.y,compositing,removeGreen]);
  return <div ref={host} className="stage-video dealer-video-surface" data-keyed={removeGreen&&compositing?.mode==='green-screen'} style={{position:'relative'}}>
    {children}<canvas ref={canvas} aria-label="Anpassad dealerbild"/>{error?<p role="alert">{error}</p>:null}
  </div>;
}

export function DealerClipPreview({url,framing,compositing}:{url:string;framing?:DealerFraming;compositing?:VideoCompositing}){
  const video=useRef<HTMLVideoElement>(null),[removeGreen,setRemoveGreen]=useState(false),[error,setError]=useState('');
  return <div><PresentationFrame label="Dealerklipp"><DealerVideoSurface framing={framing} compositing={compositing} removeGreen={removeGreen}>
    <video ref={video} src={url} playsInline preload="auto" aria-label="Förhandsvisa vald fil" onError={()=>setError('Videon kunde inte läsas.')}/>
  </DealerVideoSurface></PresentationFrame>
    <button type="button" onClick={()=>{const element=video.current;if(element?.paused)void element.play().catch(()=>setError('Videon kunde inte starta.'));else element?.pause();}}>Spela / pausa</button>
    {compositing?.mode==='green-screen'?<label><input type="checkbox" checked={removeGreen} onChange={event=>setRemoveGreen(event.target.checked)}/>Visa utan grön bakgrund</label>:null}
    {error?<p role="alert">{error}</p>:null}
  </div>;
}
