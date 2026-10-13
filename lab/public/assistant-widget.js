(() => {
  if (window.__scoutAssistant) return;
  window.__scoutAssistant = true;
  const source = new URL(document.currentScript.src);
  const endpoint = source.pathname.replace(/assistant-widget\.js$/, 'api/assistant');
  const host = document.createElement('div');
  host.id = 'scout-assistant';
  const root = host.attachShadow({mode:'open'});
  root.innerHTML = `<style>
    :host{position:fixed;bottom:20px;right:20px;z-index:9000;color:#eef3f5;font:14px/1.5 system-ui,sans-serif;color-scheme:dark}
    *{box-sizing:border-box}button,input,textarea,select{font:inherit}button,a{cursor:pointer}button{border:1px solid #45565d;border-radius:10px;background:#203139;color:#eef3f5;padding:9px 13px}button:disabled{opacity:.5;cursor:default}
    .launch{box-shadow:0 6px 32px #0006;display:flex;gap:9px;align-items:center;border-color:#5ae0b2}
    .robot{font-size:22px;color:#5ae0b2}.panel{width:min(430px,calc(100vw - 28px));height:min(650px,calc(100dvh - 38px));background:#101b22;border:1px solid #45565d;border-radius:18px;box-shadow:0 18px 80px #0009;display:flex;flex-direction:column;overflow:hidden}
    header{padding:14px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #35464e}header div{flex:1}h2{font-size:17px;margin:0}small{color:#b0c2cb}nav{padding:12px 16px 0}select{width:100%;border-radius:8px;padding:8px;background:#203139;color:inherit;border:1px solid #45565d}
    .intro{padding:8px 16px;color:#c1cfd5;font-size:12px;margin:0}.messages{flex:1;overflow:auto;padding:8px 16px;min-height:80px}.message{white-space:pre-wrap;overflow-wrap:anywhere;padding:10px 12px;background:#1c2b34;border-radius:10px;margin:0 0 10px}.user{background:#244239}.proposal{padding:12px;background:#29302a;border:1px solid #677644;border-radius:10px}
    form{padding:12px 16px;border-top:1px solid #35464e}textarea,input{background:#0c171e;color:inherit;border:1px solid #58717d;border-radius:8px;padding:9px;width:100%}textarea{resize:vertical;min-height:65px;max-height:180px}.row{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:8px}.status{padding:0 16px 10px;max-height:100px;overflow:auto;color:#d1dce1;font-size:12px}.send{background:#5ae0b2;color:#05261a;border-color:#5ae0b2}.links{padding:0 16px 8px}a{color:#84dfca}
    [hidden]{display:none!important}dialog{background:#14232b;color:inherit;border:1px solid #637883;border-radius:14px;width:min(590px,calc(100vw - 24px));max-height:88dvh;padding:20px}dialog::backdrop{background:#000a}dialog h3{font-size:18px;margin-top:0}.impact{white-space:pre-wrap;overflow-wrap:anywhere;max-height:30vh;overflow:auto;background:#0b171e;padding:12px;border-radius:8px}.accept{display:flex;gap:8px;margin:12px 0}.accept input{width:auto}.danger{background:#ae3333;border-color:#f19c92}
    @media(max-width:500px){:host{bottom:10px;right:10px}.launch span:last-child{font-size:12px}}@media(prefers-reduced-motion:no-preference){.robot{transition:transform .2s}.launch:hover .robot{transform:rotate(-12deg)}}
  </style>
  <button class="launch" aria-label="Öppna Scoutguiden"><span class="robot" aria-hidden="true">⌘</span><span>Scoutguiden</span></button>
  <section class="panel" hidden aria-labelledby="assistant-title"><header><span class="robot" aria-hidden="true">⌘</span><div><h2 id="assistant-title">Scoutguiden</h2><small class="model"></small></div><button class="close" aria-label="Minimera chatten">−</button></header>
    <nav><label>Välj hjälp<select><option value="help">Scoutguiden · hjälp på sajten</option></select></label></nav>
    <p class="intro"></p><div class="links" hidden><a href="/admin/clips?tool=import">Klippassistent · importera filer</a></div>
    <div class="messages" role="log" aria-live="polite"></div>
    <form><label>Meddelande<textarea maxlength="3000" rows="2" placeholder="Vad vill du ha hjälp med?"></textarea></label><div class="row"><button class="reset" type="button">Nytt samtal</button><button class="send" type="submit">Skicka</button></div></form>
    <div class="status" role="status"></div>
  </section>
  <dialog aria-labelledby="review-title"><h3 id="review-title"></h3><p class="expires"></p><div class="impact"></div><label class="confirm-label" for="assistant-confirmation"></label><input id="assistant-confirmation" class="confirmation" autocomplete="off" spellcheck="false"><label class="accept"><input type="checkbox"><span>Jag har läst konsekvenserna och godkänner denna åtgärd.</span></label><div class="row"><button class="cancel">Avbryt</button><button class="execute danger" disabled>Bekräfta åtgärden</button></div><p class="review-status" role="status"></p></dialog>`;
  document.body.append(host);
  const $ = selector => root.querySelector(selector);
  const panel=$('.panel'),launch=$('.launch'),messages=$('.messages'),input=$('textarea'),select=$('select'),dialog=$('dialog');
  let access='help',identity=null,mode='help',busy=false,abort=null,review=null,history=[],opened=false;
  const title=()=>mode==='help'?'Scoutguiden':mode==='openclaw'?'Adminroboten · OpenClaw':'Adminroboten';
  function status(value){$('.status').textContent=value;}
  function reset(){history=[];messages.replaceChildren();review=null;if(dialog.open)dialog.close();}
  function renderMode(){
    $('#assistant-title').textContent=title();launch.querySelector('span:last-child').textContent=access==='n1'?'Adminroboten':'Scoutguiden';
    launch.setAttribute('aria-label','Öppna '+(access==='n1'?'Adminroboten':'Scoutguiden'));
    $('.intro').textContent=mode==='help'?'Hjälp på sajten. Inga interna uppgifter eller administrationsverktyg.'
      :mode==='openclaw'?'Läser ansluten Gateway och agentmodeller. Modellbyte kräver din granskning. Status hämtas på begäran.'
      :'Nivå 1 · dealers, bord, bakgrunder, bolag, rum och drift. Alla ändringar kräver granskning och bekräftelse.';
    $('.links').hidden=access!=='n1';
  }
  function working(value){busy=value;$('.send').disabled=value;$('.reset').disabled=value;select.disabled=value;input.disabled=value;}
  const errors={
    assistant_n1_required:'Logga in som nivå 1 för intern åtkomst.',assistant_access_changed:'Din inloggning ändrades. Öppna chatten igen.',
    assistant_model_unavailable:'Den valda modellen svarar inte eller är inte tillgänglig i serverns modellkoppling. Ingen reservmodell används automatiskt.',
    assistant_review_changed:'Underlaget har ändrats. Granska åtgärden på nytt.',assistant_confirmation_expired:'Bekräftelsen har gått ut. Granska på nytt.',
    assistant_delete_blocked:'Radering blockeras av publicerad historik, skyddade filer eller ofullständig kontroll. Öppna resursens ordinarie vy.',
    assistant_busy:'För många anrop. Vänta en minut.',assistant_unavailable:'Assistentens serverkoppling är inte tillgänglig.',
    assistant_target_unavailable:'Resursen är inte tillgänglig för denna åtgärd.',assistant_model_not_in_gateway:'Modellen finns inte i Gateways verifierade modellista.',
    assistant_dependency_unavailable:'En nödvändig serverfunktion kunde inte nås. Ingen åtgärd bekräftades.',
  };
  async function api(body){
    const response=await fetch(endpoint,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',redirect:'error',
      headers:body?{'content-type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:abort?.signal});
    const value=await response.json();
    if(!response.ok)throw Object.assign(Error(errors[value.error]??'Begäran kunde inte slutföras. Läs om underlaget.'),{code:value.error});
    return value;
  }
  async function refresh(){
    const value=await api();
    const changed=identity!==null&&identity!==value.identity;
    if(changed){reset();input.value='';mode='help';status('Kontot eller sessionen ändrades. Samtalet har tömts.');}
    identity=value.identity;access=value.access;
    select.replaceChildren();
    for(const [value,label]of [['help','Scoutguiden · hjälp på sajten'],...(access==='n1'?[['admin','Adminroboten · administration'],['openclaw','Adminroboten · OpenClaw']]:[])]){
      const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);
    }
    if(access!=='n1'&&mode!=='help'){mode='help';reset();}
    select.value=mode;
    $('.model').textContent=value.models?.[mode]?.id??'Modell ej verifierad';renderMode();
    return !changed;
  }
  async function open(requested){
    if(busy)return;
    opened=true;panel.hidden=false;launch.hidden=true;
    try{if(!await refresh())return;
      const chosen=requested??(/^\/(admin|control)(\/|$)/.test(location.pathname)&&access==='n1'?'admin':mode);
      if(chosen!==mode){mode=access==='n1'?chosen:'help';reset();select.value=mode;renderMode();await refresh();}
      input.focus();
    }catch(error){status(error.message);}
  }
  launch.addEventListener('click',()=>void open());
  $('.close').addEventListener('click',()=>{opened=false;panel.hidden=true;launch.hidden=false;launch.focus();});
  $('.reset').addEventListener('click',()=>{reset();input.value='';status('Nytt samtal.');input.focus();});
  select.addEventListener('change',()=>{mode=select.value;reset();input.value='';renderMode();void refresh().catch(error=>status(error.message));});
  function add(role,text){
    const node=document.createElement('p');node.className='message '+(role==='user'?'user':'');node.textContent=(role==='user'?'Du\n':title()+'\n')+text;messages.append(node);messages.scrollTop=messages.scrollHeight;
  }
  async function showReview(proposal){
    if(busy)return;working(true);status('Läser aktuella beroenden…');
    try{
      if(!await refresh())return;
      const result=await api({operation:'prepare',proposal});review=result;
      $('#review-title').textContent=result.review.question;
      $('.expires').textContent='Gäller till '+new Date(result.review.expiresAt).toLocaleTimeString('sv-SE')+'. Ändrade beroenden kräver ny granskning.';
      // The preview is server-generated, never model HTML.
      const labels={rooms:'Berörda rum',operators:'Berörda bolag',compositions:'Berörda sammansättningar',before:'Före',after:'Efter',notice:'Konsekvens',mediaCount:'Antal filer',count:'Antal filer',speechEnabled:'Tal aktiverat',operatorId:'Bolag',label:'Namn',role:'Materialtyp',archived:'I papperskorgen',dealerId:'Dealer',id:'Resurs',allowed:'Radering tillåten'};
      const describe=value=>Array.isArray(value)?value.map(describe).join(', ')||'Inga':value&&typeof value==='object'?value.name??value.label??value.id??Object.entries(value).map(([key,item])=>(key==='primary'?'Modell':key==='fallbacks'?'Reservmodeller':key)+': '+describe(item)).join('; '):typeof value==='boolean'?(value?'Ja':'Nej'):String(value);
      $('.impact').textContent=Object.entries(result.review.impact).map(([key,value])=>(labels[key]??key)+': '+describe(value)).join('\n\n');
      $('.confirm-label').textContent='Skriv exakt: '+result.review.confirmation;
      $('.confirmation').value='';$('.accept input').checked=false;$('.execute').disabled=true;$('.review-status').textContent='';
      dialog.showModal();$('.confirmation').focus();status('');
    }catch(error){status(error.message);}finally{working(false);}
  }
  function confirmationReady(){return review&&$('.confirmation').value===review.review.confirmation&&$('.accept input').checked&&!busy;}
  $('.confirmation').addEventListener('input',()=>{$('.execute').disabled=!confirmationReady();});
  $('.accept input').addEventListener('change',()=>{$('.execute').disabled=!confirmationReady();});
  $('.cancel').addEventListener('click',()=>{review=null;dialog.close();});
  dialog.addEventListener('cancel',()=>{review=null;});
  $('.execute').addEventListener('click',async()=>{
    if(!confirmationReady())return;
    const receipt=review;working(true);$('.execute').disabled=true;$('.cancel').disabled=true;$('.review-status').textContent='Utför den granskade åtgärden…';
    try{
      if(!await refresh())return;
      const result=await api({operation:'execute',token:receipt.token,confirmation:$('.confirmation').value,accepted:true});
      if(result.completed!==true)throw Error('Servern har inte bekräftat åtgärden.');
      add('assistant','Servern bekräftade '+result.action+' för '+result.targetId+'. Läs om arbetsvyn för att se den sparade ändringen.');
      resetHistoryOnly();review=null;dialog.close();status('Åtgärden är genomförd. Osparade utkast i andra vyer laddas inte om automatiskt.');
    }catch(error){
      review=null;dialog.close();
      status(error.message+' Begäran försöks inte igen automatiskt. Kontrollera aktuell status före ett nytt försök.');
    }finally{working(false);$('.cancel').disabled=false;}
  });
  function resetHistoryOnly(){history=[];}
  $('form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!input.value.trim())return;
    working(true);abort=new AbortController();
    try{
      if(!await refresh())return;
      const text=input.value.trim(),sentMode=mode;
      add('user',text);status('Läser underlag och väntar på svar…');
      const value=await api({operation:'chat',mode,message:text,history});
      if(!await refresh()||mode!==sentMode)return;
      add('assistant',value.reply);input.value='';
      history=[...history,{role:'user',content:text},{role:'assistant',content:value.reply}].slice(-8);
      while(history.reduce((sum,row)=>sum+row.content.length,0)>18000)history.splice(0,2);
      $('.model').textContent=value.model.id;
      status(value.coverage?'Läst '+new Date(value.observedAt).toLocaleTimeString('sv-SE')+'. Saknad åtkomst: '+(Object.entries(value.coverage).filter(([,v])=>v!=='available').map(([k])=>k).join(', ')||'ingen i denna avgränsade läsning'):'');
      if(value.proposal&&access==='n1'){
        const box=document.createElement('div');box.className='proposal';
        const text=document.createElement('p');text.textContent='Förslag: '+value.proposal.action+' · '+value.proposal.targetId+(value.proposal.value?' → '+value.proposal.value:'');
        const button=document.createElement('button');button.textContent='Granska konsekvenser';button.addEventListener('click',()=>void showReview(value.proposal));
        box.append(text,button);messages.append(box);messages.scrollTop=messages.scrollHeight;
      }
    }catch(error){status(error.message);}finally{working(false);abort=null;input.focus();}
  });
  window.addEventListener('scout:assistant',event=>void open(['admin','openclaw','help'].includes(event.detail?.mode)?event.detail.mode:undefined));
  document.addEventListener('click',event=>{
    const trigger=event.target.closest?.('[data-scout-assistant]');if(trigger){event.preventDefault();void open(trigger.dataset.scoutAssistant);}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(dialog.open){review=null;dialog.close();}}else if(opened&&!busy)void refresh().catch(()=>{reset();status('Kontrollera inloggningen.');});});
  window.addEventListener('pagehide',()=>{abort?.abort();reset();});
  renderMode();
})();
