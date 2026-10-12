import {StudioPlayer} from './player.js';
import {attachScoutGamingBridge} from './bridge.js';
const $=s=>document.getElementById(s);let player,scene;
const guard=fn=>async()=>{try{await fn();}catch(e){$('error').textContent=e.message;}};
async function init(){
  if(location.protocol==='file:')throw Error('Servera webbpaketet över HTTP(S). Att dubbelklicka index.html kringgår inte webbläsarens filskydd.');
  const res=await fetch('./manifest.json');if(!res.ok)throw Error('manifest.json kunde inte hämtas.');const m=await res.json();scene=m.configuration;
  $('release').textContent=m.release==='preview'?'PROV · MANUELL KVALITETSKONTROLL ÅTERSTÅR':'MANUELLT GRANSKAT · DRIFTINTEGRATION EJ VERIFIERAD';
  player=new StudioPlayer($('stage'),{mediaURL:p=>new URL(p,location.href).href,onError:e=>$('error').textContent=e,
    onStatus:s=>$('status').textContent=s.state+(s.clip?' · '+s.clip+' · '+(s.frame+1)+'/'+s.frames:' · stillbild')+' · '+s.dropped+' tappade rutor'});
  const layout=l=>{scene.layout=l;document.body.classList.toggle('desktop',l==='desktop');player.setScene(scene);};
  layout(window.innerWidth<720?'mobile':'desktop');await player.setDealer(m.dealer,m.dealer.active_variant);await player.setAssets(m.assets);
  for(const target of ['1','2','3','4','5','6','7','dealer','hole']){const b=document.createElement('button');b.textContent=target==='dealer'?'Dealer':target==='hole'?'Hålkort':'P'+target;
    b.disabled=!m.dealer.clips['deal_pos'+target];b.onclick=guard(()=>player.enqueueDeal(target,{r:'A',s:'S',demo:true},true));$('actions').append(b);}
  $('ready').onclick=()=>player.enqueueState('ready');$('idle').onclick=()=>player.enqueueState('idle');$('stop').onclick=()=>player.stop();
  $('mobile').onclick=()=>layout('mobile');$('desktop').onclick=()=>layout('desktop');
  // Explicit integration surface: the host must feed authoritative presentation[] itself.
  window.croupierMedia={player,manifest:m,attachScoutGamingBridge};
}
init().catch(e=>$('error').textContent=e.message);
