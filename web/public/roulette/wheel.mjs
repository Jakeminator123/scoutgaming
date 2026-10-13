import {WHEEL,pocketColor} from '/roulette-rules.mjs';
import {createSpin,presentationForRound,TAU} from './wheel-motion.mjs';

// Calibrated only against catalog design roulette-anna-v1 (1708 x 920).
// This replaces the generated number ring; it never determines a game result.
export function mountRouletteWheel(host,{designId,placement},{
  now=()=>performance.now(),requestFrame=cb=>requestAnimationFrame(cb),cancelFrame=id=>cancelAnimationFrame(id),
  reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches,
}={}) {
  if(designId!=='roulette-anna-v1')return null;
  const canvas=document.createElement('canvas');canvas.width=1708;canvas.height=920;
  canvas.setAttribute('aria-hidden','true');canvas.dataset.rouletteWheel='';
  Object.assign(canvas.style,{inset:'auto',left:100*((1-placement.width)/2+placement.x)+'%',top:placement.y*100+'%',
    width:placement.width*100+'%',height:'auto',aspectRatio:'1708/920',pointerEvents:'none',zIndex:'1'});
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  let rotation=0,ball=null,frame,complete,timer,closed=false;
  function paint(){
    ctx.clearRect(0,0,1708,920);
    ctx.save();ctx.translate(848,480);ctx.scale(1,.315);
    for(let i=0;i<WHEEL.length;i++){
      const angle=-Math.PI/2+i*TAU/37+rotation,half=TAU/74;
      ctx.beginPath();ctx.arc(0,0,146,angle-half,angle+half);ctx.arc(0,0,80,angle+half,angle-half,true);ctx.closePath();
      ctx.fillStyle={red:'#b51f21',black:'#171919',green:'#087743'}[pocketColor(WHEEL[i])];ctx.fill();
      ctx.strokeStyle='#cabb94';ctx.lineWidth=.9;ctx.stroke();
      ctx.beginPath();ctx.arc(0,0,119,angle-half,angle+half);ctx.stroke();
      ctx.save();ctx.rotate(angle);ctx.translate(133,0);ctx.rotate(Math.PI/2);
      ctx.fillStyle='#fff4d6';ctx.font='bold 16px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(WHEEL[i]),0,0);ctx.restore();
    }
    for(const radius of [80,119,146]){ctx.beginPath();ctx.arc(0,0,radius,0,TAU);ctx.strokeStyle='#e0ca9c';ctx.lineWidth=1.5;ctx.stroke();}
    ctx.restore();
    if(ball&&ball.visible!==false){
      ctx.beginPath();ctx.ellipse(ball.x+1,ball.y+2,4.5,2,0,0,TAU);ctx.fillStyle='#0008';ctx.fill();
      const shine=ctx.createRadialGradient(ball.x-1,ball.y-1,0,ball.x,ball.y,3.5);shine.addColorStop(0,'#fff');shine.addColorStop(.5,'#fff7de');shine.addColorStop(1,'#b8a77d');
      ctx.beginPath();ctx.arc(ball.x,ball.y,3.5,0,TAU);ctx.fillStyle=shine;ctx.fill();
    }
    // The original brass spindle occludes the back of the rotor and passing ball.
    ctx.save();ctx.globalCompositeOperation='destination-out';ctx.beginPath();
    for(const [i,[x,y]] of [[824,339],[874,339],[874,403],[860,412],[857,433],[868,447],[876,460],[874,474],[865,481],[832,481],[823,473],[822,459],[833,444],[839,432],[840,409],[824,399]].entries())i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    ctx.closePath();ctx.fill();ctx.restore();
  }
  const stop=()=>{if(frame!==undefined)cancelFrame(frame);clearTimeout(timer);frame=undefined;const done=complete;complete=null;done?.();};
  function showOutcome(number,roundId){
    const index=WHEEL.indexOf(number);if(closed||index<0)return;
    stop();ball=createSpin(index,rotation,presentationForRound(roundId))(1);rotation=ball.rotation%TAU;paint();
  }
  function play(number,roundId,{clock,ballDelayMs=0}={}){
    const index=WHEEL.indexOf(number);if(closed||index<0)return Promise.resolve();
    stop();
    if(reducedMotion()){showOutcome(number,roundId);return Promise.resolve();}
    const profile=presentationForRound(roundId);profile.duration=Math.max(profile.duration,ballDelayMs*2+1000);
    const motion=createSpin(index,rotation,{...profile,ballDelay:Math.min(.5,ballDelayMs/profile.duration)}),start=now();
    return new Promise(resolve=>{
      complete=resolve;
      const finish=()=>{try{ball=motion(1);rotation=ball.rotation%TAU;paint();}catch{canvas.hidden=true;}finally{stop();}};
      const tick=()=>{
        try{
          ball=motion((clock?clock():now()-start)/profile.duration);rotation=ball.rotation;paint();
          if(ball.settled){rotation%=TAU;stop();}else frame=requestFrame(tick);
        }catch{stop();canvas.hidden=true;}
      };
      // RAF may stop in a background tab. A confirmed receipt must still unlock.
      timer=setTimeout(finish,profile.duration+(clock?5500:250));tick();
    });
  }
  paint();host.append(canvas);
  return {play,showOutcome,close(){closed=true;stop();canvas.remove();}};
}
