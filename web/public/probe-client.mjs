// Presence is a UI veto. Authenticated server state and the durable reservation
// decide whether an initiative is allowed; the timer never chooses one itself.
export function probePresentationQuiet({busy,round,chatBusy,speaking,pending,gate,ownJobId}) {
  if(busy || round || chatBusy || gate.state.actionOwner!=='none')return false;
  const ownSpeech=ownJobId && ['displaying','speaking'].includes(gate.get(ownJobId)?.status);
  // The gate invokes beforeDisplay from inside the existing speech queue.
  // That one owned job must not veto itself; any second queued job does.
  return ownSpeech ? pending===1 : !speaking && pending===0 && gate.state.dealerPose==='standard-idle';
}
export function createProbeClient({ identity, flags, deliver, cancelDelivery, report, mount, fetchImpl=fetch }) {
  const tab=crypto.randomUUID();
  let active=null, stopped=false, sending=false, activityPending=false, lastActivity=0;
  let enabled=localStorage.getItem('croupier-proactive-speech')!=='off';
  const labels={off:'Probe är avstängt',text:'Textprov är valt',inactive:'Väntar på inaktivitet',quiet:'Väntar på lugnt läge',absent:'Fliken är inte aktiv',muted:'Proaktivt tal eller ljud är avstängt',sampled:'Tillfället är redan prövat',chance:'Slumpen valde tystnad',cooldown:'Paus mellan repliker',hourly:'Timtaket är nått',busy:'Förbereder ett initiativ',reserved:'Förbereder ett initiativ',no_memory:'Saknar relevant minne',silence:'Astrid valde tystnad',repeated:'Redan sagt',generated:'Tal klart',playing:'Spelar probe',played:'Spelade probe',cancelled:'Initiativ avbrutet',failed:'Provet misslyckades',interrupted:'Förra försöket avbröts'};
  const status=document.createElement('p');status.setAttribute('role','status');
  const list=document.createElement('ul');
  const label=document.createElement('label'),toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=enabled;
  label.style.cssText='display:flex;align-items:center;gap:8px';toggle.style.cssText='width:auto;flex:0 0 auto;margin:0';
  label.append(toggle,document.createTextNode('Tillåt Astrids egna talinitiativ'));
  mount.append(label,status,list);
  function show(reason){status.textContent=labels[reason]??reason;}
  const snapshot=()=>({...flags(active?.id??null),enabled});
  async function post(path,body={},signal){
    const response=await fetchImpl(`/api/probe/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tab,...identity(),...body}),signal});
    const result=await response.json();if(!response.ok)throw new Error(result.error??'probe_failed');return result;
  }
  function cancel(reason='player_activity'){
    const job=active;if(!job)return;
    job.controller.abort(reason);cancelDelivery(job.id,reason);active=null;
    if(job.result?.ticket)void post('receipt',{ticket:job.result.ticket,state:'cancelled',synthetic:Boolean(job.result.synthetic)}).catch(()=>{});
  }
  function activity(){
    cancel();activityPending=true;lastActivity=Date.now();
    void heartbeat(false);
  }
  function renderFacts(facts){
    list.replaceChildren();
    for(const fact of facts){
      const item=document.createElement('li'),text=document.createElement('p'),meta=document.createElement('small'),forget=document.createElement('button');
      text.textContent=fact.content;
      meta.textContent=`${fact.type==='hand'?'Avslutade händer':'Spelarens uppgift'} · ${fact.source.messageId??fact.source.rounds?.map(row=>row.roundId).join(', ')??''} · ${new Date(fact.createdAt).toLocaleDateString('sv-SE')} → ${new Date(fact.expiresAt).toLocaleDateString('sv-SE')}`;
      forget.type='button';forget.textContent='Glöm';
      forget.onclick=async()=>{cancel('memory_forgotten');try{const response=await post('forget',{factId:fact.id});renderFacts(response.facts);show('cancelled');}catch{show('Minnet kunde inte raderas.');}};
      item.append(text,meta,forget);list.append(item);
    }
  }
  async function receipt(job,state){return post('receipt',{ticket:job.result.ticket,state,synthetic:Boolean(job.result.synthetic)});}
  async function run(test){
    if(active||stopped)return;
    const state=snapshot();if(!state.present||!state.quiet||state.typing||!state.sound||!state.enabled){show('quiet');return;}
    const job={id:crypto.randomUUID(),controller:new AbortController(),playing:false,result:null};active=job;
    const started=performance.now();
    try{
      const result=await post(test?'test':'decide',{requestId:job.id,...test},job.controller.signal);job.result=result;
      if(active!==job||job.controller.signal.aborted)return;
      show(result.reason);
      if(result.ticket||test)report({state:'decision',requestId:job.id,source:'probe',synthetic:Boolean(test),reason:result.reason,choice:result.choice,metrics:result.metrics,policyRevision:result.policyRevision});
      if(!result.decision)return;
      if(!result.decision.speechPackage)throw new Error('probe_package_missing');
      const authorize=async()=>{
        const latest=snapshot();if(active!==job||!latest.present||!latest.quiet||latest.typing||!latest.sound||!latest.enabled)throw new Error('stale_probe');
        const accepted=await receipt(job,'playing');if(!accepted.accepted)throw new Error('stale_probe');job.playing=true;
      };
      const delivery=await deliver(result.decision,{controller:job.controller,synthetic:Boolean(test),beforeDisplay:authorize,beforeStart:authorize});
      if(active!==job||delivery.status!=='completed'||delivery.playback?.state!=='end'||!delivery.playback.started)throw new Error('probe_playback_incomplete');
      await receipt(job,'played');show('played');
      report({state:'played',source:'probe',requestId:job.id,synthetic:Boolean(test),packageId:delivery.playback.packageId,totalMs:Math.round(performance.now()-started),metrics:result.metrics});
    }catch(error){
      cancelDelivery(job.id,'probe_failed');
      if(job.result?.ticket)await receipt(job,job.controller.signal.aborted?'cancelled':'failed').catch(()=>{});
      if(!job.controller.signal.aborted){show(error.message);report({state:'failed',source:'probe',requestId:job.id,reason:error.message});}
    }finally{if(active===job)active=null;}
  }
  async function heartbeat(allowRun=true){
    if(stopped||sending)return;
    sending=true;const activity=activityPending;activityPending=false;
    try{
      const state=snapshot();
      if(active&&(!state.present||!state.quiet||state.typing||!state.sound||!state.enabled))cancel('presence_changed');
      const response=await post('presence',{flags:state,activity});
      if(active?.result?.policyRevision && active.result.policyRevision!==response.revision)cancel('policy_changed');
      renderFacts(response.facts);
      if(!active)show(response.policy.mode==='automatic'?response.reason:response.policy.mode);
      if(allowRun&&!active&&response.policy.mode==='automatic'&&Date.now()-lastActivity>=response.policy.inactivityMs)void run();
    }catch{cancel('connection_lost');show('Probe saknar anslutning.');}
    finally{sending=false;if(activityPending)void heartbeat(false);}
  }
  toggle.onchange=()=>{enabled=toggle.checked;localStorage.setItem('croupier-proactive-speech',enabled?'on':'off');cancel('preference_changed');void heartbeat(false);};
  const visibility=()=>{if(document.hidden)cancel('hidden');void heartbeat(false);};
  document.addEventListener('visibilitychange',visibility);
  const timer=setInterval(()=>void heartbeat(),5000);
  void heartbeat(false);
  return {activity,cancel,refresh:()=>heartbeat(false),async test(options){await heartbeat(false);return run(options);},close(){
    cancel('navigation');stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',visibility);
    navigator.sendBeacon('/api/probe/presence',new Blob([JSON.stringify({tab,flags:{...snapshot(),present:false}})],{type:'application/json'}));
  }};
}
