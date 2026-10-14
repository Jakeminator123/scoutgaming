export function installPublicAssistant({source,authorize,loadSdk=()=>import('@d-id/client-sdk')}){
 const host=document.createElement('div');host.id='scout-public-assistant';const root=host.attachShadow({mode:'open'});
 root.innerHTML=`<style>
 :host{position:fixed;bottom:20px;right:20px;z-index:9000;color:#eef3f5;font:14px/1.5 system-ui,sans-serif;color-scheme:dark}*{box-sizing:border-box}[hidden]{display:none!important}
 button,textarea{font:inherit}button{cursor:pointer;border:1px solid #52665e;border-radius:10px;background:#21382f;color:inherit;padding:9px 13px}button:disabled{opacity:.5;cursor:default}.launch{border-color:#69dab2;box-shadow:0 6px 30px #0006}
 section{width:min(410px,calc(100vw - 24px));height:min(690px,calc(100dvh - 28px));display:flex;flex-direction:column;overflow:hidden;background:#101e1a;border:1px solid #536960;border-radius:18px;box-shadow:0 18px 70px #0009}
 header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px}h2{font-size:17px;margin:0}.avatar{height:180px;flex-shrink:0;background:#172a23;position:relative}video{width:100%;height:100%;object-fit:contain}.avatar button{position:absolute;bottom:8px;right:8px}
 .messages{padding:12px 16px;overflow:auto;flex:1;min-height:70px}.message{white-space:pre-wrap;overflow-wrap:anywhere;border-radius:10px;background:#20382e;padding:10px;margin:0 0 10px}.user{background:#344039}form{padding:12px 16px;border-top:1px solid #3c5449}textarea{display:block;background:#0e1915;color:inherit;border:1px solid #678476;border-radius:8px;padding:8px;width:100%;resize:vertical;max-height:130px}.row{display:flex;justify-content:space-between;gap:8px;margin-top:8px}.status{font-size:12px;padding:0 16px 10px;color:#bcd1c5}.send{background:#69dab2;color:#10261c}details{padding:0 16px 8px;font-size:12px;color:#bcd1c5}summary{cursor:pointer}a{color:#8ce2bd}.links{padding:0 16px 6px;font-size:12px;display:flex;gap:14px}@media(max-width:500px){:host{bottom:10px;right:10px}.avatar{height:140px}}
 </style><button class="launch" aria-label="Öppna Scoutguiden">Scoutguiden</button>
 <section hidden aria-label="Scoutguiden"><header><h2>Scoutguiden</h2><button class="close" aria-label="Minimera chatten">−</button></header>
 <div class="avatar" hidden><video autoplay muted playsinline aria-label="Scoutguidens avatar"></video><button class="audio" hidden>Slå på ljud</button></div>
 <div class="messages" role="log" aria-live="polite"></div><div class="links"><a href="/lobby">Spellobbyn</a><a href="/partner/login">Partnerinloggning</a></div>
 <details><summary>Detaljer</summary><p>Publik hjälp · <span class="model"></span>. Avataren och rösten levereras av D-ID. Dina meddelanden skickas till modellleverantören och svaren till D-ID när avatar är på.</p><button class="toggle">Stäng av avatar</button></details>
 <form><label>Meddelande<textarea rows="2" maxlength="3000" placeholder="Vad vill du veta om sajten?"></textarea></label><div class="row"><button class="reset" type="button">Nytt samtal</button><button class="send" type="submit">Skicka</button></div></form><div class="status" role="status"></div></section>`;
 document.body.append(host);const $=s=>root.querySelector(s),video=$('video'),panel=$('section'),input=$('textarea');
 const endpoint=new URL('api/public-assistant',source).href;
 let disposed=false,opened=false,history=[],manager=null,connecting=null,generation=0,controller=null,avatarEnabled=true,busy=false,config=null,idleTimer;
 const status=text=>{$('.status').textContent=text;};
 function stopAvatar(){generation++;clearTimeout(idleTimer);const old=manager;manager=null;connecting=null;void old?.disconnect().catch(()=>{});video.pause();video.srcObject=null;video.removeAttribute('src');$('.avatar').hidden=true;}
 function idle(){clearTimeout(idleTimer);idleTimer=setTimeout(()=>{stopAvatar();status('Avataren är pausad. Den startar igen när du skickar ett meddelande.');},120000);}
 async function play(){try{await video.play();$('.audio').hidden=true;}catch{$('.audio').hidden=false;}}
 async function connect(){
  if(disposed||!opened||!avatarEnabled||document.hidden)return null;if(connecting)return connecting;if(manager)return manager;
  const current=++generation;let streamObject=null;
  connecting=(async()=>{let candidate;
   try{
    if(!config){const r=await fetch(endpoint,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();config=await r.json();$('.model').textContent=config.model.id;}
    if(current!==generation)return null;
    const {createAgentManager,ChatMode}=await loadSdk();
    if(current!==generation)return null;
    candidate=await createAgentManager(config.avatar.agentId,{auth:{type:'key',clientKey:config.avatar.clientKey},mode:ChatMode.DirectPlayback,
     streamOptions:{compatibilityMode:'auto',streamWarmup:true},callbacks:{
      onSrcObjectReady(stream){streamObject=stream;if(current===generation){video.muted=true;video.srcObject=stream;$('.avatar').hidden=false;void play();}return stream;},
      onVideoStateChange(state){if(current!==generation)return;if(state==='START'){video.removeAttribute('src');video.srcObject=streamObject;video.muted=false;void play();}else if(candidate?.agent?.idle_video){video.srcObject=null;video.src=candidate.agent.idle_video;video.loop=true;video.muted=true;void play();}idle();},
      onError(){if(current===generation)status('Avataren kunde inte ansluta. Du kan fortsätta med text.');},
     }});
    if(current!==generation){await candidate.disconnect();return null;}
    manager=candidate;await candidate.connect();
    if(current!==generation){await candidate.disconnect();return null;}idle();return candidate;
   }catch{if(current===generation){stopAvatar();status('Avataren kunde inte ansluta. Du kan fortsätta med text.');}else void candidate?.disconnect().catch(()=>{});return null;}
   finally{if(current===generation)connecting=null;}
  })();return connecting;
 }
 async function permitted(){const ok=await authorize();return ok&&!disposed;}
 async function open(){try{if(!await permitted())return;opened=true;panel.hidden=false;$('.launch').hidden=true;input.focus();void connect();}catch{status('Chatten kunde inte öppnas. Försök igen strax.');}}
 function close(){opened=false;panel.hidden=true;$('.launch').hidden=false;controller?.abort();stopAvatar();$('.launch').focus();}
 function add(role,text){const node=document.createElement('p');node.className='message '+role;node.textContent=(role==='user'?'Du':'Scoutguiden')+'\n'+text;$('.messages').append(node);$('.messages').scrollTop=$('.messages').scrollHeight;}
 $('.launch').addEventListener('click',()=>void open());$('.close').addEventListener('click',close);
 $('.audio').addEventListener('click',()=>{video.muted=false;void play();});
 $('.toggle').addEventListener('click',()=>{avatarEnabled=!avatarEnabled;$('.toggle').textContent=avatarEnabled?'Stäng av avatar':'Slå på avatar';if(avatarEnabled)void connect();else stopAvatar();});
 $('.reset').addEventListener('click',()=>{controller?.abort();history=[];$('.messages').replaceChildren();input.value='';stopAvatar();status('Nytt samtal.');});
 $('form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!input.value.trim())return;busy=true;$('.send').disabled=true;$('.reset').disabled=true;controller=new AbortController();const signal=controller.signal;
  try{
   if(!await permitted())return;const message=input.value.trim();add('user',message);status('Väntar på svar…');
   const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({message,history}),signal});
   const value=await response.json();if(!response.ok)throw Error(value.error==='busy'?'Vänta en minut och försök igen.':'Chatten kunde inte svara. Försök igen strax.');
   if(!await permitted()||signal.aborted)return;add('assistant',value.reply);input.value='';$('.model').textContent=value.model.id;status('');
   history=[...history,{role:'user',content:message},{role:'assistant',content:value.reply}].slice(-8);while(history.reduce((sum,row)=>sum+row.content.length,0)>9000)history.splice(0,2);
   const speaker=await connect();if(speaker&&!signal.aborted&&opened){try{await speaker.speak({type:'text',input:value.reply});idle();}catch{stopAvatar();status('Svaret finns i text. Avataren kunde inte läsa upp det.');}}
  }catch(error){if(!signal.aborted&&!disposed)status(error.message);}finally{busy=false;$('.send').disabled=false;$('.reset').disabled=false;controller=null;}
 });
 function visibility(){if(document.hidden){controller?.abort();stopAvatar();}}
 document.addEventListener('visibilitychange',visibility);
 return {open,dispose(){if(disposed)return;disposed=true;controller?.abort();stopAvatar();history=[];host.remove();document.removeEventListener('visibilitychange',visibility);}};
}
