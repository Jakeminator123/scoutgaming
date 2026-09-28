import { installDealerVersionSwitcher, dealerVersionPath, V2_DEALERS } from './dealer-version-switcher.mjs';
import { createNativeObservation } from './native-observation.mjs';
import { SPEECH_LINES } from './speech-lines.mjs';
import { createSpeechQueue } from './speech-queue.mjs';
import { createProbeClient, probePresentationQuiet } from './probe-client.mjs';
import { createAstridCameraControl } from './astrid-camera-control.mjs';
import { createSpeechPoseGate } from './speech-pose-gate.mjs';
import { CHAT_STAGES, readChatResponse, chatFailureMessage } from './chat-response.mjs';
import { playGeneratedSpeech, loadGeneratedSpeech } from './generated-speech-player.mjs';
import { createNativeSpeechBridge } from './lab-speech-bridge.mjs';
import { createTableAudio } from './table-audio.mjs';
import { requestLogin } from './auth-modal.mjs';
import { DealerEngine } from './dealer-engine.mjs';
import { playSpeech, abortableDelay, waitForAudio } from './speech-playback.mjs';
import { handValue } from './blackjack.mjs';
import { placeActions } from './action-placement.mjs';
import { packedSpeechCanvas } from './packed-speech.mjs';
import { cardFaceArt } from './card-art.mjs';
import {shouldUseGreenDealerCard,selectGreenTake,loadGreenTakes,greenShoeOutlet,layoutGreenDealerCards,installGreenRestFrame,installGreenIdle,quadMatrix} from './astrid-green-dealer.mjs';
import {loadGreenWaiting,installGreenWaiting} from './astrid-green-waiting.mjs';
import {installFoldedRest} from './astrid-folded-rest.mjs';
import {loadGreenSpeak,installGreenSpeak} from './astrid-green-speak.mjs';
import {installEdgeHud} from './actor-edge-blend.mjs';
import {loadActorComposite,createCompositeEnvironment} from './actor-composite-scene.mjs';
let astridWaiting=null,astridSpeak=null; // Shared keyed player; populated for the selected green dealer.

const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CURRENCIES = { USD: 'en-US', EUR: 'de-DE', SEK: 'sv-SE' };
let currency = 'USD';
const fmt = n => n.toLocaleString(CURRENCIES[currency], { style: 'currency', currency, minimumFractionDigits: 2 });

// ---------- dealer engine ----------
const CLIP = {
  idle: 'idle-1/idle/idle',
  headTilt: 'idle-1/idle/idle-breathe-head-tilt',
  deal: 'idle-1/actions/action-deal',
  dealWatch: 'idle-1/actions/action-deal-watch',
  think: 'idle-1/actions/action-think',
  gest: 'idle-1/actions/gesticulate1',
};
// ---------- dealers: EVERY FACE ----------
// Each dealer is a complete asset set (streams, voice, scene, table art) and
// a rail anchor: the v-fraction where her table's rail top sits in her video.
const DEALERS = {
  vera:   { key: 'vera',   base: 'dealer',         anchor: 0.855, name: 'Vera' },
  astrid: { key: 'astrid', base: 'dealers/astrid', anchor: 0.878, name: 'Astrid',
            scene: 'dealers/astrid/scene.png', sceneWK: 2.63602, sceneHK: 1.11831,
            table: 'dealers/astrid/table.png', dealingCues: 'dealers/astrid/dealing-cues.json' },
  amira:  { key: 'amira', base: 'dealers/amira', anchor: 0.87, name: 'Amira',
            scene: 'dealers/amira/scene-clear-v2.png', sceneWK: 3.468, sceneHK: 1.47126,
            table: 'dealers/amira/table.png' },
  mei:    { key: 'mei', base: 'dealers/mei', anchor: 0.87, name: 'Mei',
            scene: 'dealers/mei/scene.png', sceneWK: 3.468, sceneHK: 1.47126,
            table: 'dealers/mei/table.png' },
};
const DEALER = DEALERS[new URLSearchParams(location.search).get('dealer')] ?? DEALERS.vera;
const localPresentationEnabled = DEALER.key === 'astrid' && new URLSearchParams(location.search).get('presentation') === 'local';
let localPresentation = null;
if (localPresentationEnabled) {
  document.documentElement.dataset.presentation = 'local';
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/local-presentation.css'; document.head.append(css);
  $('#supervisor')?.removeAttribute('src');
  $('#supervisor')?.load();
}
const clientSessionRevision = crypto.randomUUID();
let tableVersion = 0;
let speechPoseGate = null;
let probeClient = null;
let idlePresentationSequence = 0;
const dealerV2Route = location.pathname === '/v2' || location.pathname.startsWith('/v2/');
const nativeObservation = createNativeObservation({ href: location.href, opener: window.opener });
nativeObservation.emit('status', { state: 'attached', dealer: DEALER.key, route: dealerV2Route ? 'v2' : 'original', presentationOwner: localPresentationEnabled ? 'web-local' : 'legacy' });
if (!dealerV2Route && DEALER.key === 'amira') DEALER.scene = 'dealers/amira/scene.png';
if (dealerV2Route && !V2_DEALERS.includes(DEALER.key)) location.replace(dealerVersionPath(DEALER.key, 'original', location.search));
{
  document.documentElement.dataset.dealer = DEALER.key;
  const rs = document.documentElement.style;
  rs.setProperty('--rail-anchor', DEALER.anchor);
  if (DEALER.scene) {
    rs.setProperty('--scene-url', `url('${DEALER.scene}')`);
    rs.setProperty('--room-plate', `url('${DEALER.scene}')`);
    rs.setProperty('--scene-w-k', DEALER.sceneWK);
    rs.setProperty('--scene-h-k', DEALER.sceneHK);
  }
  if (DEALER.table) $('#tableimg')?.setAttribute('src', DEALER.table);
  $('#chat-input')?.setAttribute('placeholder', `Talk to ${DEALER.name}…`);
  const disclosure = document.querySelector('#gate-panel p');
  if (disclosure) disclosure.textContent = disclosure.textContent.replace('Vera', DEALER.name);
}

const riggedReview=DEALER.key==='astrid'&&new URLSearchParams(location.search).get('scene')==='rigged-review';
// Astrid's replacement waiting loop uses the approved elevated green camera.
// Old frontal idle, speech and dealing fallbacks stay retired.
const astridRestart=!localPresentationEnabled&&dealerV2Route&&DEALER.key==='astrid'&&!riggedReview;
const amiraBlender=dealerV2Route&&DEALER.key==='amira';
const amiraComposite=amiraBlender&&new URLSearchParams(location.search).get('composite')!=='off'?await loadActorComposite().catch(error=>{console.warn('[composite]',error.message);return null;}):null;
const amiraSpeakTake=amiraBlender?await loadGreenSpeak('review/amira-green-speak/speak.json','amira'):null;
const greenActor=astridRestart||!!amiraSpeakTake;
// Temporary recalibration pause: retain actor idle/speech and card placement,
// but use the table's shoe-to-felt animation instead of filmed dealing takes.
const astridDealingPaused=astridRestart;
if(astridRestart){
  document.documentElement.dataset.astridRebuild='true';
  document.documentElement.dataset.actorIsolated='true';
  document.documentElement.dataset.astridDealing='paused';
}
const speechMedia = (greenActor||localPresentationEnabled)?{}:await fetch('speech-media.json').then(r=>r.ok?r.json():{}).catch(()=>({}));
const performanceStaged=!localPresentationEnabled&&(astridRestart||(!riggedReview&&DEALER.key==='astrid'&&new URLSearchParams(location.search).get('performance')==='staged'));
const performanceContinuity=performanceStaged&&new URLSearchParams(location.search).get('continuity')==='review';
const performanceMotion=new URLSearchParams(location.search).get('motion');
const astridGreenReview=astridRestart;
const astridBlender=astridRestart;
const blenderTable=astridBlender||amiraBlender;
// One review directory may hold several green takes: the dealer's first upcard
// and the first card of one specific box. Each is selected by action and box.
const astridGreenTakes=astridGreenReview?await loadGreenTakes(`review/${astridBlender?'astrid-table-v2':'astrid-elevated-table'}`):[];
// Explicitly requested live experiment. The ordinary table keeps its takes.
if(astridBlender&&new URLSearchParams(location.search).get('astridBlue')==='box4'){
  const preview=await loadGreenTakes('review/astrid-blue-box4');
  const dealer=preview.find(t=>t.action==='deal-dealer');
  if(dealer){const index=astridGreenTakes.findIndex(t=>t.action==='deal-dealer');if(index>=0)astridGreenTakes.splice(index,1,dealer);else astridGreenTakes.push(dealer);}
  astridGreenTakes.push(...preview.filter(t=>t.box===4));
}
const astridGreenTake=astridGreenTakes.find(t=>t.action==='deal-dealer')??null;
const astridGreenBoxTakes=astridGreenTakes.filter(t=>Number.isInteger(t.box));
const performanceRhythm=performanceStaged&&['rhythm','smooth60'].includes(performanceMotion);
const actorProvenance=performanceStaged&&!astridRestart?await fetch('dealers/astrid/actor/provenance.json').then(r=>r.ok?r.json():null).catch(()=>null):null;
let performanceManifest=null,performancePlayer=null,selectPerformance=null,selectPlayerPerformance=null,selectSequencePerformance=null,performanceCardCorners=null;
if(performanceStaged&&!astridDealingPaused) {
  try {
    const [{PerformancePlayer,cardLandingCorners},{selectContactTake,selectPlayerDelivery,selectSequenceTake},manifest]=await Promise.all([
      import('./performance-player.mjs'),import('./performance-contact.mjs'),
      astridRestart?Promise.resolve({status:'review',takes:[],reviewCandidates:[]}):fetch(`dealers/astrid/performance/${performanceRhythm?`${performanceMotion}/`:''}manifest.json`).then(r=>{if(!r.ok)throw new Error('No staged capture');return r.json();}),
    ]);
    performanceManifest=manifest;selectPerformance=selectContactTake;performanceCardCorners=cardLandingCorners;
    selectPlayerPerformance=selectPlayerDelivery;
    selectSequencePerformance=selectSequenceTake;
    const sceneJoins=!astridRestart&&performanceMotion==='smooth60'&&new URLSearchParams(location.search).get('joins')!=='off'
      ?await fetch('dealers/astrid/performance/joins/manifest.json').then(r=>r.ok?r.json():null):null;
    let readyMotion=null;
    if(sceneJoins&&new URLSearchParams(location.search).get('ready')!=='off'){
      const candidate=await fetch('dealers/astrid/performance/joins/ready/manifest.json').then(r=>r.ok?r.json():null).catch(()=>null);
      if(candidate){const {readyMotionErrors}=await import('./ready-motion.mjs');const errors=readyMotionErrors(candidate,manifest.takes,actorProvenance?.sources?.['idle-1/idle/idle']);
        if(!errors.length)readyMotion=candidate;else console.warn('[performance] ready motion unavailable',errors.join('; '));}
    }
    performancePlayer=new PerformancePlayer({host:$('#scene'),staged:performanceStaged,joins:sceneJoins,ready:readyMotion,
      idle:actorProvenance?.sources?.['idle-1/idle/idle'],prepareIdle:async()=>{
        if(!engineUp)return;
        await engine.fetchClip(CLIP.idle);
        const cycle=engine.presentation?.cycle??-1;engine.interrupt(CLIP.idle);
        if(!await engine.waitForFrame(CLIP.idle,0,{afterCycle:cycle,timeoutMs:3000}))throw new Error('Matched idle frame did not arrive');
      },onState:text=>{
      const status=$('#performance-status');if(status)status.textContent=text;
      console.info('[performance]',text);
    }});
    performancePlayer.preload([...manifest.takes,...(performanceContinuity?manifest.continuations??[]:[])]).catch(error=>console.warn('[performance] preload',error.message));
    if(readyMotion)performancePlayer.preload([readyMotion.loop,readyMotion.speech,...readyMotion.joins]).catch(error=>console.warn('[performance] ready preload',error.message));
    if(sceneJoins)performancePlayer.preload(sceneJoins.joins).catch(error=>console.warn('[performance] transition preload',error.message));
  }catch(error){console.info('[performance]',error.message);}
}
let dealingCues = null;
if (!localPresentationEnabled&&!astridRestart&&DEALER.dealingCues) {
  try {
    const response = await fetch(DEALER.dealingCues);
    if (response.ok) dealingCues = await response.json();
  } catch (error) { console.warn('[deal] hand cues unavailable', error.message); }
}

let tableScene = null;
// Resize the camera even while the dealer's asynchronous media load is still
// pending. Waiting for gameplay controls leaves the shoe at the old viewport.
addEventListener('resize', () => tableScene?.resize());
try {
  if(localPresentationEnabled){
    // The portrait film already contains its table. DOM cards remain authoritative.
  }else if(riggedReview){
    const {createRiggedTableScene}=await import('./rigged-table-scene.mjs');
    tableScene=await createRiggedTableScene($('#table-canvas'),{faceStudy:new URLSearchParams(location.search).get('face')==='anatomical'});
    const css=document.createElement('link');css.rel='stylesheet';css.href='rigged-review.css';document.head.append(css);
    document.documentElement.classList.add('rigged-review');
    const status=document.createElement('div');status.id='rig-review-status';status.textContent=tableScene.facial?'Astrid likeness review · measured speech, visual acceptance pending':'3D contact review · face and speech animation unfinished';$('#scene').append(status);
  }else if(blenderTable){
    const {createBlenderTableScene}=await import('./blender-table-scene.mjs');
    tableScene=await createBlenderTableScene($('#table-canvas'),{frame:astridGreenTake?.camera.placement??{framingScale:.85},dealer:DEALER.key,composite:amiraComposite});
  }else{
  const { createTableScene } = await import('./table-scene.mjs');
  tableScene = createTableScene($('#table-canvas'), DEALER.key, {
    contactProof: performanceStaged,
    shoeRegistration:astridGreenTake?()=>greenShoeOutlet(astridGreenTake):null,
  });
  }
  document.documentElement.classList.add('table-3d');
} catch (error) { console.warn('[table] Using image fallback:', error.message); }
if(astridGreenTake){
  document.documentElement.dataset.astridGreen='dealer-upcard';
  installGreenRestFrame($('#scene'),astridGreenTake);
  addEventListener('resize',()=>layoutGreenDealerCards($('#dealer-cards'),astridGreenTake));
  performancePlayer?.preload([astridGreenTake]).catch(error=>console.warn('[green upcard]',error.message));
  const replay=document.createElement('button');replay.id='green-upcard-replay';replay.textContent='Replay Astrid’s first card';replay.disabled=true;
  Object.assign(replay.style,{position:'absolute',right:'16px',top:'72px',zIndex:70,padding:'10px 14px',border:'1px solid #d6ff3a',borderRadius:'18px',background:'#111c',color:'#d6ff3a',font:'12px Arial'});
  $('#scene').append(replay);
  replay.hidden=astridDealingPaused;
  replay.onclick=async()=>{
    const el=$('#dealer-cards .card:not(.back)');
    if(astridDealingPaused||busy||speaking||!el||!round?.dealer?.[0]||!performancePlayer)return;
    busy=true;replay.disabled=true;await astridWaiting?.holdAtBoundary();el.style.visibility='hidden';
    try{await performancePlayer.play(astridGreenTake,{card:round.dealer[0],target:el.getBoundingClientRect(),corners:performanceCardCorners(el),onCue:phase=>sfx.play(phase),onLand:()=>{el.style.visibility='';}});}
    catch(error){console.warn('[green upcard]',error.message);}
    finally{el.style.visibility='';try{await performancePlayer.finish();}finally{busy=false;replay.disabled=false;}}
  };
}
// The filmed landing spot is that box's first-card position: its DOM fan is
// registered to the landed quad, exactly as the dealer's upcard is. Takes
// enabled for split hands retain that registration for each separate hand.
function layoutGreenBoxCards(){
  for(const take of astridGreenBoxTakes){
    const container=$(`.seat[data-box="${take.box}"] .cards`);
    if(container&&(take.tracking?.deliveries==='all-box-cards'||!container.querySelector(':scope > .subhand')))layoutGreenDealerCards(container,take);
  }
}
if(astridGreenTake)installEdgeHud($('#scene'));
if(astridGreenBoxTakes.length){
  document.documentElement.dataset.astridGreen=[astridGreenTake?'dealer-upcard':null,...astridGreenBoxTakes.map(t=>`box${t.box}`)].filter(Boolean).join('+');
  performancePlayer?.preload(astridGreenBoxTakes).catch(error=>console.warn('[green box]',error.message));
  addEventListener('resize',layoutGreenBoxCards);
  if(tableScene?.layoutCards){const feltLayout=tableScene.layoutCards.bind(tableScene);tableScene.layoutCards=()=>{feltLayout();layoutGreenBoxCards();};}
  astridGreenBoxTakes.forEach((take,i)=>{
    const openingCards=take.tracking?.openingCards===2?2:1;
    const replay=document.createElement('button');replay.id=`green-box${take.box}-replay`;replay.textContent=`Replay box ${take.box} ${openingCards===2?'both cards':'first card'}`;replay.disabled=true;
    Object.assign(replay.style,{position:'absolute',right:'16px',top:`${112+i*40}px`,zIndex:70,padding:'10px 14px',border:'1px solid #d6ff3a',borderRadius:'18px',background:'#111c',color:'#d6ff3a',font:'12px Arial'});
    $('#scene').append(replay);
    replay.hidden=astridDealingPaused;
    replay.onclick=async()=>{
      const elements=[...document.querySelectorAll(`.seat[data-box="${take.box}"] .cards > .card`)].slice(0,openingCards);
      const cards=round?.live?.().find(h=>h.box===take.box)?.cards??[];
      if(astridDealingPaused||busy||speaking||!elements.length||!cards[0]||!performancePlayer)return;
      busy=true;replay.disabled=true;
      try{
        await astridWaiting?.holdAtBoundary();
        elements.forEach(el=>{el.style.visibility='hidden';});
        for(const [index,el] of elements.entries()){
          await performancePlayer.play(take,{card:cards[index],target:el.getBoundingClientRect(),corners:performanceCardCorners(el),onCue:phase=>sfx.play(phase),onLand:()=>{el.style.visibility='';}});
        }
      }
      catch(error){console.warn('[green box]',error.message);}
      finally{elements.forEach(el=>{el.style.visibility='';});try{await performancePlayer.finish();}finally{busy=false;replay.disabled=false;}}
    };
  });
}
if(amiraBlender&&tableScene?.layoutCards){
  const layout=tableScene.layoutCards.bind(tableScene);
  tableScene.layoutCards=()=>{
    layout();
    const container=$('#dealer-cards'),host=container.parentElement.getBoundingClientRect();
    Object.assign(container.style,{left:`${-host.left}px`,top:`${-host.top}px`,transform:'none'});
    const cards=[...container.querySelectorAll(':scope > .card')];
    cards.forEach((el,i)=>{
      const quad=tableScene.dealerCardQuad(i,cards.length).map(p=>[p.x,p.y]);
      Object.assign(el.style,{left:'0px',top:'0px',width:'100px',height:'140px',transformOrigin:'0 0',animation:'none',transform:`matrix3d(${quadMatrix(quad,100,140).join(',')})`});
      el.dataset.feltCard='true';el.dataset.feltCorners=JSON.stringify(quad);
    });
  };
}
const greenBoxReplays=(enabled)=>{for(const take of astridGreenBoxTakes){const button=$(`#green-box${take.box}-replay`);if(button)button.disabled=!enabled||!$(`.seat[data-box="${take.box}"] .cards > .card:first-child`);}};

// a dealer without clips still stands at her table: her canonical poster
// fills the dealer frame instead of an empty room
function showPoster() {
  const c = $('#dealer');
  const img = new Image();
  img.onload = () => { const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height); };
  img.src = `${DEALER.base}/poster.jpg`;
}

const poseIdentity = () => ({ dealerId: DEALER.key, sessionRevision: clientSessionRevision, roundRevision: String(tableVersion) });
function updatePoseState(next, reason) {
  return speechPoseGate?.updateRendererState({ ...poseIdentity(), ...next }, reason);
}
function presentStandardIdle(source = 'renderer') {
  if (!speechPoseGate) return;
  const presentationId = `${source}:${++idlePresentationSequence}`;
  updatePoseState({ dealerPose: 'standard-idle' }, 'standard-idle');
  speechPoseGate.presentStandardIdle({ ...poseIdentity(), presentationId });
}

const engine = new DealerEngine($('#dealer'), DEALER.base, {
  log: m => console.info('[dealer]', m),
  handsCanvas: $('#dealer-hands'),
  actorMatteBase:actorProvenance?'dealers/astrid/actor':null,handsCut:DEALER.anchor,
});
engine.onPresentClip = (clip, playbackRequestId) => {
  nativeObservation.clip(clip, playbackRequestId, DEALER.key);
  if (clip === CLIP.idle) presentStandardIdle(`engine-${playbackRequestId ?? 'cycle'}`);
  else updatePoseState({ dealerPose: clip.includes('/speak/') ? 'speech' : 'action', idlePresented: null }, 'clip-presented');
};
let engineUp = false;
let speaking = false;
let dealingActive = false;
const canUseDealingTake = () => !amiraBlender && !astridDealingPaused && !riggedReview && engineUp && dealingCues?.status !== 'rejected' && !!engine.index?.clips?.[CLIP.deal];
// Speaking clips with their real lengths. Cutting between different clips
engine.onIdlePick = () => {
  // A recorded sentence is a single take. Decode-ahead must never replay its
  // first words over the end of the audio. The roster audit checks coverage.
  if (speaking) return CLIP.idle;
  if (performanceStaged) return CLIP.idle;
  if (dealingActive && canUseDealingTake()) return CLIP.deal;
  const extras = [CLIP.headTilt, CLIP.gest].filter(k => engine.index.clips[k]);
  if (extras.length && Math.random() < 0.25) return extras[Math.floor(Math.random() * extras.length)];
  return CLIP.idle;
};
const trigger = k => { if (!performanceStaged && engineUp && !speaking && speechQueue.pending === 0 && engine.index.clips[k]) engine.trigger(k); };

if(astridRestart){
  // The green waiting clip with its randomized scheduler is preferred; the
  // plain elevated loop stays as the fallback when it is absent or fails.
  if(astridGreenTake)try{
    const waiting=await loadGreenWaiting();
    if(waiting){
      astridWaiting=await installGreenWaiting($('#scene'),waiting,{externalLifecycle:!!waiting.rest});
      if(waiting.rest)try{astridWaiting=await installFoldedRest($('#scene'),waiting.rest,astridWaiting);}
      catch(error){astridWaiting.restoreLifecycle();astridWaiting.resume();throw error;}
    }
  }catch(error){console.warn('[waiting idle]',error.message);}
  if(astridGreenTake&&!astridWaiting)try{await installGreenIdle($('#scene'),astridGreenTake);}
  catch(error){console.warn('[elevated idle]',error.message);}
  // Keyed green speak takes (Blender table only): the greeting plays over the
  // held idle with its recorded line; other lines stay silent as before.
  if(astridGreenTake&&astridBlender)try{const speak=await loadGreenSpeak();if(speak){astridSpeak=await installGreenSpeak($('#scene'),speak,{waiting:()=>astridWaiting});
    // Review hook, like window.astridEdge: window.astridSay('win') plays a line.
    window.astridSay=id=>voice.say(id,{force:true});}}
  catch(error){console.warn('[speak]',error.message);}
}else if(amiraSpeakTake){
  document.documentElement.dataset.greenDealer='amira';
  const composite=amiraComposite?createCompositeEnvironment($('#scene'),amiraComposite):null;
  const line=amiraSpeakTake.lines.greeting;
  const waiting=await loadGreenWaiting('review/amira-green-waiting/idle.json');
  if(waiting)astridWaiting=await installGreenWaiting($('#scene'),waiting,{composite});
  else installGreenRestFrame($('#scene'),{...line,rest:amiraSpeakTake.rest,dealerName:DEALER.name});
  astridSpeak=await installGreenSpeak($('#scene'),amiraSpeakTake,{waiting:()=>astridWaiting,composite});
}else if(!localPresentationEnabled)try {
  await engine.init();
  if(engine.fullActor){
    document.documentElement.dataset.actorIsolated='true';
    document.documentElement.style.setProperty('--hands-band-y',engine.bandY/engine.index.height);
    document.documentElement.style.setProperty('--hands-band-h',engine.bandH/engine.index.height);
  }
  if (!engine.index?.clips?.['idle-1/idle/idle']) throw new Error('no playable clips');
  await engine.start();
  engineUp = true;
} catch (e) {
  console.warn('dealer engine offline:', e.message);
  const ctx = $('#dealer').getContext('2d');
  const img = new Image();
  img.onload = () => { $('#dealer').width = 1440; $('#dealer').height = 1440; ctx.drawImage(img, 0, 0, 1440, 1440); };
  // THIS dealer's own poster; the generic fallback only as a last resort
  img.onerror = () => { img.onerror = null; img.src = 'dealer-fallback.png'; };
  img.src = `${DEALER.base}/poster.jpg`;
}

// debug HUD (?debug)
if (!astridRestart&&location.search.includes('debug')) {
  document.body.classList.add('debug');
  setInterval(() => {
    $('#engine-hud').textContent =
      `clip ${engine.currentClip ?? '-'}\nsubmitted ${engine.stats.submitted} decoded ${engine.stats.decoded}` +
      `\nqueue ${engine.decoder?.decodeQueueSize ?? '-'} display ${engine.display.length}` +
      `\nsplices ${engine.stats.splices} errors ${engine.stats.errors}`;
  }, 500);
}

// ---------- dealer voice ----------
const LINES = { ...SPEECH_LINES };
const VOICE_LINES = Object.keys(LINES);
// ---------- global speech gate ----------
// One voice, one caption, one mouth at a time. Every speaker (game-flow
// lines, chat takes, chat commentary) runs as a queued turn; without this
// they overlap at round settle and the captions stomp each other.
const speechQueue = createSpeechQueue({
  canPlay: () => !voice.muted && !document.hidden,
  beforePlay: () => { if(!performancePlayer?.ready)performancePlayer?.cancel(); },
});
const rawSpeechTurn = fn => speechQueue.enqueue(fn);
const speechTurn = fn => rawSpeechTurn(async signal => {
  localPresentation?.state({ speech: true });
  updatePoseState({ dealerPose: 'speech', speechOwner: 'game', idlePresented: null }, 'game-speech-started');
  try { return await fn(signal); }
  finally {
    updatePoseState({ dealerPose: 'unknown', speechOwner: 'none', idlePresented: null }, 'game-speech-completed');
    localPresentation?.state({ speech: false });
    if (greenActor || engine.presentedClip === CLIP.idle) presentStandardIdle('game-speech-return');
  }
});

const voice = {
  muted: localStorage.getItem('croupier-muted') === '1',
  audio: new Map(),
  playing: false,
  greeted: false,
  dead: new Set(),
  load() {
    if(greenActor||localPresentationEnabled)return;
    for (const t of VOICE_LINES) {
      const a = new Audio(`${DEALER.base}/audio/en/${t}.mp3`);
      a.preload = 'auto';
      // a 404 fires 'error' exactly once - THAT is the only reliable signal
      // that this dealer has no take for the line
      a.addEventListener('error', () => this.dead.add(t), { once: true });
      this.audio.set(t, a);
    }
  },
  say(t, { force = false } = {}) {
    if(localPresentationEnabled){
      if(this.muted || speechQueue.pending > 0 && !force)return;
      return speechTurn(signal => localPresentation?.present({ type: 'speak', line: t }, { signal }));
    }
    if(greenActor){
      if(!astridSpeak?.has(t)||this.muted||speechQueue.pending>0&&!force)return;
      console.info('[voice]', t, 'green speak take', 'muted=' + this.muted, 'force=' + force);
      const correlation=nativeObservation.context();
      nativeObservation.emit('playback',{event:'speech',state:'selected',line:t,renderer:'green'},correlation);
      return speechTurn(async signal=>{
        speaking=true;
        try { await astridSpeak.say(t,{signal,
          onStart:text=>showCaption(text,Math.min(13000,3500+text.length*70)),
          onPresent:details=>nativeObservation.emit('playback',{event:'speech',state:'start',line:t,...details,evidence:'presented-frame'},correlation),
          onFinish:result=>{nativeObservation.emit('playback',{event:'speech',state:result?.completed?'end':'interrupted',line:t},correlation);speaking=false;$('#caption').classList.remove('show');}
        }); } catch(error) { nativeObservation.emit('playback',{event:'speech',state:'error',line:t,error:error.message},correlation); }
        finally { speaking=false; }
      });
    }
    // one honest line per decision - silence must never be a mystery again
    console.info('[voice]', t, 'muted=' + this.muted, 'dead=' + this.dead.has(t), 'busy=' + speechQueue.pending, 'force=' + force);
    if (this.muted) return;
    const a = this.audio.get(t);
    if (!a) return;
    if (this.dead.has(t)) return; // dealer has no take for this line: stay silent, no orphan caption
    if (speechQueue.pending > 0 && !force) return;   // something's talking: drop optional chatter
    return speechTurn(async signal => { await bankReady; return playRecorded(t, a, LINES[t] ?? '', signal); });
  },
};
voice.load();
speechPoseGate = createSpeechPoseGate({
  enqueue: rawSpeechTurn,
  holdWhileHidden: localPresentationEnabled,
  initialState: {
    ...poseIdentity(), dealerPose: 'unknown', actionOwner: 'none', speechOwner: 'none', idlePresented: null,
    visible: !document.hidden, muted: voice.muted,
  },
  onDisplay: async (decision, job) => {
    const pending = pendingChatReplies.get(job.jobId);
    if (!pending || decision.kind === 'silence') return;
    await pending.beforeDisplay?.();
    if (pending.controller.signal.aborted) return;
    const text = decision.exactText;
    if (pending.previewRow?.isConnected && pending.previewText === text) pending.previewRow.classList.remove('pending');
    else chatLog('vera', text);
    nativeObservation.emit('chat', { role: 'assistant', text, line: decision.lineId ?? null,
      source: pending.probe ? 'probe' : 'openclaw-chat', synthetic: Boolean(pending.synthetic), speechKind: decision.kind }, pending.correlation);
    if (!pending.synthetic && !pending.probe) chatHistory.push({ role: 'assistant', text });
  },
  onSpeech: async (decision, { signal, job }) => playChatDecision(decision, signal, job.jobId),
  onCancel: (job, reason) => {
    const pending = pendingChatReplies.get(job.jobId);
    if (pending?.previewRow?.classList.contains('pending')) pending.previewRow.remove();
    pending?.controller?.abort(reason);
    nativeObservation.emit('chat', { role: 'assistant', state: 'cancelled', reason,
      requestId: job.jobId, source: 'openclaw-chat' });
  },
  onTrace: entry => nativeObservation.emit('status', { state: 'chat-pose', ...entry }),
});
if (localPresentationEnabled) {
  try {
    const [{ PerformancePlayer }, { createLocalPresentation }] = await Promise.all([import('./performance-player.mjs'), import('./local-presentation.mjs')]);
    performancePlayer = new PerformancePlayer({ host: $('#scene') });
    localPresentation = await createLocalPresentation({ player: performancePlayer, host: $('#scene'), dealerId: DEALER.key,
      version: () => tableVersion, muted: () => voice.muted,
      receipt: entry => nativeObservation.emit('playback', entry),
      onIdle: () => presentStandardIdle('local-primary-frame'),
      onBusy: () => updatePoseState({ dealerPose: 'action', idlePresented: null }, 'local-film-owner'),
    });
    localPresentation.start();
    window.addEventListener('pagehide', () => localPresentation.close(), { once: true });
  } catch (error) {
    console.error('[local presentation]', error.message);
    const status = document.createElement('div'); status.className = 'local-presentation-status'; status.setAttribute('role', 'status');
    status.textContent = 'Lokal video kunde inte startas · 2D-reserv'; $('#scene').append(status);
  }
}
queueMicrotask(() => {
  if (greenActor || engine.presentedClip === CLIP.idle) presentStandardIdle('initial-ready');
});
// ---- live keyframe debug overlay: ?kf=1 (or press K). Draws the gate's
// measured keyframes on the LIVE dealer while she speaks: mouth box, nose
// anchor, and a lane where audio phrases (shifted by the shipped delay) sit
// against mouth waves - aligned bars = the sync proof, live at the table. ----
const kfDebug = (() => {
  let enabled = new URLSearchParams(location.search).has('kf');
  let data = null, cur = null, cv = null;
  const ensure = async () => {
    if (!cv) {
      cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;pointer-events:none;z-index:60';
      $('#dealer-wrap').appendChild(cv);
    }
    if (!data) {
      try { data = await (await fetch(`${DEALER.base}/streams/kf.json`)).json(); }
      catch { data = { clips: {} }; }
    }
  };
  addEventListener('keydown', e => { if (e.key === 'k' || e.key === 'K') { enabled = !enabled; if (cv) cv.getContext('2d').clearRect(0,0,cv.width,cv.height); } });
  const draw = () => {
    requestAnimationFrame(draw);
    if (!enabled || !data || !cv) return;
    const dc = $('#dealer'); if (!dc) return;
    const r = dc.getBoundingClientRect(), wr = $('#dealer-wrap').getBoundingClientRect();
    if (!r.width) return;
    if (cv.width !== (r.width|0)) { cv.width = r.width|0; cv.height = r.height|0; }
    cv.style.left = (r.left - wr.left) + 'px'; cv.style.top = (r.top - wr.top) + 'px';
    cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
    const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height);
    const sc = cv.width / 1440;
    const f = Math.max(10, 12 * sc * 2); ctx.font = `${f}px Menlo, monospace`;
    if (data.noseRect) { const [x,y,w,h] = data.noseRect; ctx.strokeStyle='#59c8ff'; ctx.lineWidth=1.5; ctx.strokeRect(x*sc,y*sc,w*sc,h*sc); }
    if (data.mouthRect) { const [x,y,w,h] = data.mouthRect; ctx.strokeStyle='#D6FF3A'; ctx.lineWidth=2.5; ctx.strokeRect(x*sc,y*sc,w*sc,h*sc); }
    ctx.fillStyle='#D6FF3A'; ctx.fillText('KEYFRAMES ON (K)', 10, 10 + f);
    const kd = cur && data.clips[cur.k];
    if (!kd) return;
    const aDur = kd.env10ms.length * 10, total = kd.delayMs + aDur;
    const LH = Math.max(56, cv.height * 0.13), y0 = cv.height * 0.56, W = cv.width - 20, X = 10;
    ctx.fillStyle='rgba(10,11,13,.72)'; ctx.fillRect(X, y0, W, LH);
    kd.phrases.forEach(ph => {  // audio time + shipped delay (green, lower half)
      const x0 = X + (ph.startMs + kd.delayMs) / total * W, x1 = X + (ph.endMs + kd.delayMs) / total * W;
      ctx.fillStyle='rgba(120,220,120,.30)'; ctx.fillRect(x0, y0 + LH/2, x1-x0, LH/2 - 4);
      ctx.fillStyle='#8ee08e'; ctx.fillText(ph.id, x0 + 3, y0 + LH - 6);
    });
    kd.waves.forEach(wv => {    // mouth motion, video time (lime, upper half)
      const x0 = X + wv.startMs / total * W, x1 = X + wv.endMs / total * W;
      ctx.fillStyle='rgba(214,255,58,.30)'; ctx.fillRect(x0, y0 + 4, x1-x0, LH/2 - 4);
      ctx.fillStyle='#D6FF3A'; ctx.fillText(wv.id, x0 + 3, y0 + 4 + f);
    });
    ctx.strokeStyle='#4f9f4f';
    kd.env10ms.forEach((e, i) => { if (i % 2) return;
      const x = X + (kd.delayMs + i*10) / total * W, h = e * (LH/2 - 6);
      ctx.beginPath(); ctx.moveTo(x, y0 + LH*0.75 - h); ctx.lineTo(x, y0 + LH*0.75 + h); ctx.stroke(); });
    const t = kd.delayMs + (cur.audio?.currentTime ?? 0) * 1000;
    const px = X + Math.min(1, t/total) * W;
    ctx.strokeStyle='#F2F1ED'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(px,y0); ctx.lineTo(px,y0+LH); ctx.stroke();
    ctx.fillStyle='#F2F1ED';
    ctx.fillText(`${cur.k}  delay=${kd.delayMs}ms  waves=${kd.waves.length} phrases=${kd.phrases.length}`, X, y0 - 6);
  };
  ensure().then(() => requestAnimationFrame(draw));
  return {
    start(clip, audio) { cur = { k: clip.split('/').pop(), audio }; },
    stop() { cur = null; },
  };
})();

const soundBtn = $('#sound-btn');
const renderSound = () => { soundBtn.classList.toggle('muted', voice.muted); soundBtn.textContent = voice.muted ? '🔇' : '🔊'; soundBtn.setAttribute('aria-label',voice.muted?'Turn sound on':'Mute sound'); };
function setMuted(muted) {
  if (muted) { speechQueue.cancel(); activeSpeech?.abort(); bankAudio?.pause(); speaking = false; }
  voice.muted = muted; localStorage.setItem('croupier-muted', muted ? '1' : '0'); renderSound();
  updatePoseState({ muted }, muted ? 'muted' : 'unmuted');
  if (muted) { tableAudio.reset(); sfx.stopAmbience(); }
  else { tableAudio.unlock(); sfx.startAmbience(); }
}
soundBtn.onclick = () => setMuted(!voice.muted);
const tableAudio=createTableAudio({createContext:()=>new AudioContext(),canPlay:()=>!voice.muted&&!document.hidden,
  onState:state=>{soundBtn.dataset.audioState=state;}});
renderSound();
// Automatic small talk is paused while the core gameplay is being finished.

// ---------- sound system ----------
const sfx = {
  files: {},
  load() {
    const el = new Audio('sfx/ambience.mp3'); el.preload = 'auto';
    el.loop = true; el.volume = 0.16; this.files.ambience = el;
  },
  // everything except the ambience loop is synthesized: generated foley assets
  // were noise-washes (or, boosted, pure hiss), and synthesis has zero latency
  play(n) {
    if (voice.muted || document.hidden) return;
    if (n === 'chip') return synthChip();
    if (n === 'pickup' || n === 'land' || n === 'gather') return synthDeal(n);
    if (n === 'knock') return synthKnock();
    if (n === 'win') return synthWin();
    if (n === 'bigwin') return synthBigWin();
  },
  startAmbience() { if (!voice.muted) this.files.ambience?.play().catch(() => {}); },
  stopAmbience() { this.files.ambience?.pause(); },
  // The room tone kept dying: autoplay can refuse it before the first gesture,
  // a hidden tab or another app taking audio focus pauses it, and nothing ever
  // restarted it. Nudge it back on any gesture and whenever the tab returns.
  keepAmbience() {
    const a = this.files.ambience;
    if (!a || voice.muted) return;
    if (a.paused || a.ended) { a.currentTime = a.currentTime || 0; a.play().catch(() => {}); }
  },
};
sfx.load();
document.addEventListener('visibilitychange', () => {
  updatePoseState({ visible: !document.hidden }, document.hidden ? 'hidden' : 'visible');
  if(document.hidden){speechQueue.cancel();activeSpeech?.abort();sfx.stopAmbience();tableAudio.reset();}
});
addEventListener('pagehide', () => speechPoseGate?.navigate(), { once: true });
for (const ev of ['pointerdown', 'keydown', 'visibilitychange']) {
  document.addEventListener(ev, () => { if (!document.hidden) {tableAudio.unlock();sfx.keepAmbience();} }, { passive: true });
}
setInterval(() => { if (!document.hidden) sfx.keepAmbience(); }, 4000);
// hover ticks: tiny synth click, no asset needed
let actx = null;
function hoverTick() {
  if (voice.muted) return;
  try {
    actx = tableAudio.context; if (!actx) return;
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = 1400; o.type = 'sine';
    g.gain.setValueAtTime(0.045, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.05);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.06);
  } catch { /* ignore */ }
}
document.addEventListener('mouseover', e => {
  if (e.target.closest?.('button, .chip, .spot, .side')) hoverTick();
});

// tabletop foley, synthesized so every hit is instant and dry
function noiseBurst(t, { dur, gain, type, freq, q = 1.5, decay = 2 }) {
  const len = Math.max(8, Math.floor(actx.sampleRate * dur));
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  const src = actx.createBufferSource(); src.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = actx.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(actx.destination); src.start(t);
}
function synthChip() {
  // ceramic chip landing on a stack: bright click + softer settle click
  try {
    actx = tableAudio.context; if (!actx) return;
    const t0 = actx.currentTime;
    const f = 3600 + Math.random() * 1400;
    noiseBurst(t0, { dur: 0.045, gain: 0.75, type: 'bandpass', freq: f, q: 2.5, decay: 2.6 });
    noiseBurst(t0 + 0.04 + Math.random() * 0.025, { dur: 0.035, gain: 0.35, type: 'bandpass', freq: f * 0.85, q: 2.5, decay: 2.6 });
  } catch { /* ignore */ }
}
function synthDeal(phase) {
  // card snapped onto felt: short high snap + faint slide
  try {
    actx = tableAudio.context; if (!actx) return;
    const t0 = actx.currentTime;
    if (phase === 'pickup') {
      noiseBurst(t0, { dur: .06, gain: .12, type: 'bandpass', freq: 2400, q: .7, decay: 2 });
    } else if (phase === 'gather') {
      noiseBurst(t0, { dur: .16, gain: .07, type: 'bandpass', freq: 1500, q: .45, decay: 1.4 });
    } else {
      noiseBurst(t0, { dur: .024, gain: .25, type: 'lowpass', freq: 1800, q: .7, decay: 2 });
      noiseBurst(t0, { dur: .04, gain: .08, type: 'bandpass', freq: 3200, q: .8, decay: 3 });
    }
  } catch { /* ignore */ }
}
function synthKnock() {
  // knuckles on the table edge. No pitch sweep and no long tail (that reads as
  // a kick drum): a hard lowpassed contact click plus inharmonic wood modes
  // with <60ms decay, second knock slightly softer and earlier-damped.
  try {
    actx = tableAudio.context; if (!actx) return;
    const knock = (t, vel) => {
      noiseBurst(t, { dur: 0.011, gain: 0.55 * vel, type: 'lowpass', freq: 800, q: 0.7, decay: 1.1 });
      for (const [freq, gain, dec] of [[97, 0.34, 0.06], [176, 0.24, 0.05], [287, 0.13, 0.04], [520, 0.06, 0.03]]) {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = freq * (0.97 + Math.random() * 0.06);
        g.gain.setValueAtTime(gain * vel, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dec);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dec + 0.01);
      }
    };
    const t0 = actx.currentTime;
    knock(t0, 1);
    knock(t0 + 0.125 + Math.random() * 0.03, 0.8);
  } catch { /* ignore */ }
}
function chime(t, freq, dur, gain) {
  // soft bell: fundamental + quiet detuned octave partial, exponential decay
  const o = actx.createOscillator(), o2 = actx.createOscillator();
  const g = actx.createGain(), g2 = actx.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  o2.type = 'sine'; o2.frequency.value = freq * 2.01; g2.gain.value = 0.16;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); o2.connect(g2).connect(g); g.connect(actx.destination);
  o.start(t); o.stop(t + dur); o2.start(t); o2.stop(t + dur);
}
function synthWin() {
  // two-note payout chime
  try {
    actx = tableAudio.context; if (!actx) return;
    const t0 = actx.currentTime;
    chime(t0, 880, 0.5, 0.28);
    chime(t0 + 0.1, 1174.7, 0.7, 0.28);
  } catch { /* ignore */ }
}
function synthBigWin() {
  // ascending E-major arpeggio with a sparkle on top
  try {
    actx = tableAudio.context; if (!actx) return;
    const t0 = actx.currentTime;
    [659.3, 830.6, 987.8, 1318.5].forEach((f, i) => chime(t0 + i * 0.1, f, 0.8, 0.3));
    chime(t0 + 0.52, 1661.2, 1.2, 0.2);
  } catch { /* ignore */ }
}

// hint(): one short transient line explaining what a control just did (or why
// it stopped). Cheaper than a toast and it never covers the felt.
let hintTimer = null;
function hint(tag, text) {
  let el = document.querySelector('#hint');
  if (!el) { el = document.createElement('div'); el.id = 'hint'; document.body.appendChild(el); }
  el.innerHTML = `<b>${tag}</b><span>${text}</span>`;
  el.classList.add('show');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// Round summary: what went in, what came back, per box and in total. The seat
// badges alone were ambiguous - a badge reading "WIN $100" on a $50 stake is a
// $50 profit, not a $100 one - so the money is spelled out here.
function showSettlement(rows, staked, back) {
  if (!rows.length) return;
  let el = document.querySelector('#settlement');
  if (!el) { el = document.createElement('div'); el.id = 'settlement'; document.body.appendChild(el); }
  const net = back - staked;
  const line = r => {
    const parts = [`<span class="s-box">BOX ${r.box + 1}</span>`,
                   `<span class="s-stake">${fmt(r.stake)}</span>`];
    parts.push('<span class="s-side"></span>');   // sides get their own row below
    const mainCls = r.outcome === 'win' ? 'up' : r.outcome === 'push' ? 'flat' : 'down';
    const label = r.outcome === 'push' ? 'push' : (r.net > 0 ? '+' : '') + fmt(r.net);
    parts.push(`<span class="s-net ${mainCls}">${label}</span>`);
    return `<div class="s-row">${parts.join('')}</div>`;
  };
  const sideRows = rows.filter(r => r.sides).map(r =>
    `<div class="s-row sub"><span class="s-box">side ${r.box + 1}</span><span class="s-stake">${fmt(r.sides)}</span><span class="s-side"></span>` +
    `<span class="s-net ${r.sideNet > 0 ? 'up' : 'down'}">${r.sideNet > 0 ? '+' : ''}${fmt(r.sideNet)}</span></div>`).join('');
  el.innerHTML = `
    <div class="s-head"><b>ROUND</b><span>staked ${fmt(staked)} &middot; returned ${fmt(back)}</span></div>
    ${rows.map(line).join('')}${sideRows}
    <div class="s-row total"><span class="s-box">NET</span><span class="s-stake"></span><span class="s-side"></span>
      <span class="s-net ${net > 0 ? 'up' : net === 0 ? 'flat' : 'down'}">${net > 0 ? '+' : ''}${fmt(net)}</span></div>`;
  el.classList.add('show');
  clearTimeout(showSettlement.t);
  showSettlement.t = setTimeout(() => el.classList.remove('show'), 7000);
}

// win toasts: stacked notifications so wins and their amounts are unmissable
function toast(title, amount, big = false) {
  let stack = document.querySelector('#toasts');
  if (!stack) { stack = document.createElement('div'); stack.id = 'toasts'; document.body.appendChild(stack); }
  const t = document.createElement('div');
  t.className = big ? 'toast big' : 'toast';
  t.innerHTML = `<b>${title}</b><span>+${fmt(amount)}</span>`;
  stack.appendChild(t);
  setTimeout(() => t.classList.add('out'), 4200);
  setTimeout(() => t.remove(), 4800);
}

// celebration bursts
function burstAt(x, y, big = false) {
  const b = document.createElement('div');
  b.className = 'burst'; b.style.left = `${x}px`; b.style.top = `${y}px`;
  const n = big ? 26 : 14;
  const colors = ['#d9c06a', '#f0dfa8', '#D6FF3A', '#fff'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    const ang = Math.random() * Math.PI * 2, r = (big ? 130 : 80) * (0.5 + Math.random() * 0.8);
    p.style.setProperty('--bx', `${Math.cos(ang) * r}px`);
    p.style.setProperty('--by', `${Math.sin(ang) * r - 30}px`);
    p.style.setProperty('--bc', colors[i % colors.length]);
    p.style.animationDelay = `${Math.random() * 0.12}s`;
    b.appendChild(p);
  }
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 1400);
}
function bjFlash(text) {
  const el = document.createElement('div');
  el.className = 'bj-flash'; el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

// ---------- clock ----------
setInterval(() => { $('#clock').textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }, 1000);

// ---------- state ----------
const SEATS = 7;
// Table tiers. Picking a table sets both the limits and the chip ladder, so a
// VIP box is bet in 250K chips rather than 250 clicks of a 1K chip.
const TABLES = [
  { id: 'classic', name: 'CLASSIC',     min: 5,    max: 2000,      chips: [1, 5, 10, 25, 50, 100, 500, 1000], dealer: 'vera' },
  // Astrid returns as a tier when her clip set is complete (2 of ~10 speaking
  // clips survived the sync gate - a dealer who barely moves her lips is
  // worse than no dealer). She stays reachable at ?dealer=astrid for review.
  { id: 'high',    name: 'HIGH ROLLER', min: 100,  max: 50000,     chips: [25, 100, 500, 1000, 5000, 10000, 25000], dealer: 'vera' },
  { id: 'vip',     name: 'VIP SALON',   min: 1000, max: 1000000,   chips: [500, 1000, 5000, 25000, 100000, 250000, 500000], dealer: 'vera' },
];
let table = TABLES[0];
const clipAssignments = {};
// the backoffice owns tier->dealer assignment; apply it before anyone switches
fetch('/api/bo/config').then(r => r.ok ? r.json() : null).then(cfg => {
  if (!cfg) return;
  // Dealing Clips page: the clip picked per table part for this dealer (Never again never plays)
  const picked = cfg.clipAssignments?.[DEALER.key] ?? {};
  if(!astridRestart)for (const [part, a] of Object.entries(picked)) if (a?.clip && !cfg.neverAgain?.[a.clip]) clipAssignments[part] = a.clip;
  const idle = clipAssignments.idle?.startsWith(DEALER.key + ':') ? clipAssignments.idle.slice(DEALER.key.length + 1) : null;
  if (idle?.includes("/idle/") && !performanceStaged) CLIP.idle = idle;
  if (!cfg.tiers) return;
  for (const t of TABLES) if (cfg.tiers[t.id]) t.dealer = cfg.tiers[t.id];
}).catch(() => {});
let CHIPS = table.chips;
const LIMITS = { get min() { return table.min; }, get max() { return table.max; } };
let balance = 1000;

// ---------- player account: server-persisted demo money (SQLite) ----------
let player = null;
async function api(path, payload) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if(r.status===401) { player=null; throw new Error('Sign in required'); }
  const out = await r.json().catch(() => ({}));
  if (!r.ok || out.error) throw new Error(out.error ?? `api ${r.status}`);
  return out;
}
async function loadPlayer() {
  try {
    player = await api('/api/player', {  });
    // Identity is resolved from the server's HttpOnly session cookie.
    balance = player.balance; currency = player.currency;
    renderBets(); renderCurrency();
  } catch { /* server db unavailable: play on with the local demo balance */ }
}
function syncBalance() { /* Server table commands now persist the wallet. */ }
let shoeState = null, observedTableView = null;
function showShoe(state) {
  if (!state) return;
  shoeState = state; tableScene?.setShoe(state);
  const label = $('#shoe-status');
  if (label) { label.dataset.remaining=state.remaining; label.textContent = state.cutReached ? 'CUT CARD · SHUFFLE AFTER ROUND' : `${state.decks} DECK SHOE`; }
}
function roundView(data) {
  return data && { ...data, live() { return this.hands; }, legal() { return this.legalActions; } };
}
async function tableCommand(op, extra = {}) {
  if (op !== 'state') probeClient?.activity();
  if (!player) await loadPlayer();
  if (!player) throw new Error('Cannot connect to the game server');
  if (op !== 'state') localPresentation?.state({ action: true });
  if (op !== 'state') updatePoseState({ dealerPose: 'action', actionOwner: `table-${op}`, idlePresented: null }, 'table-command-started');
  const payload = { id: player.id, op, version: tableVersion, requestId: crypto.randomUUID(), dealer: DEALER.key, ...extra };
  let out;
  for (let attempt=0; attempt<2; attempt++) {
    try { out = await api('/api/table', payload); break; }
    catch (e) {
      if (attempt || !/fetch|network|load failed/i.test(e.message)) {
        if (op !== 'state') updatePoseState({ dealerPose: 'unknown', actionOwner: 'none', idlePresented: null }, 'table-command-failed');
        throw e;
      }
    }
  }
  tableVersion = out.version;
  updatePoseState({ roundRevision: String(tableVersion),
    ...(op === 'state' ? { actionOwner: 'none' } : {}) }, 'table-version-committed');
  if (op === 'state' && greenActor) presentStandardIdle('state-restored');
  if (op === 'state') localPresentation?.state({ action: false });
  nativeObservation.command(payload, out, observedTableView, DEALER.key);
  observedTableView = out;
  tableScene?.setTableSnapshot?.(out,{collecting:op==='collect'});
  return out;
}
async function ensureLogin(purpose) {
  await tableReady;
  const session=await fetch('/api/auth/session').then(r=>r.json());
  if((session.authenticated || session.guest) && player)return true;
  player=null;
  if(!session.authenticated && !session.guest && !await requestLogin(purpose))return false;
  await prepareTable();return !!player;
}
function tableError(e) { busy = true; document.querySelectorAll('#actions button,#actions-top button').forEach(b=>b.disabled=true); setBanner(e.message + ' · Reload to resume'); renderBets(); }
async function prepareTable() {
  const session=await fetch('/api/auth/session').then(r=>r.json());
  $('#sign-out').hidden=!session.authenticated;
  if(!session.authenticated && !session.guest){player=null;busy=false;renderBets();return null;}
  const out = await tableCommand('state'); showShoe(out.shoe);
  if (out.round) {
    bets = out.round.boxes.map(b => ({main:b.stake,pp:b.pp,tp:b.tp}));
    round = roundView(out.round); balance = out.balance;
    document.body.classList.add('in-round'); setBanner(null); clearTable();
    [...new Set(round.hands.map(h=>h.box))].forEach(renderBoxHands);
    const dc = $('#dealer-cards');
    round.dealer.forEach((c,i)=>{ const el=cardEl(c); el.style.setProperty('--ci',i); dc.appendChild(el); });
    if (round.dealer.length === 1) { const el=cardEl(null,true); el.style.setProperty('--ci',1); dc.appendChild(el); }
    if(astridGreenTake){layoutGreenDealerCards(dc,astridGreenTake);$('#green-upcard-replay').disabled=false;}
    greenBoxReplays(true);
    updateBadge(dc,round.dealer); renderBets();
    if (round.phase === 'insurance') { $('#insurance').hidden=false; busy=false; }
    else if (round.phase === 'settled') { busy=true; await finish(); }
    else { busy=false; activeBoxHighlight(); }
  }
  if (!out.round) { busy=false; renderBets(); }
  return out;
}

// Automatic event speech is intentionally disabled until it can use the same
// request/revision/pose contract as explicit player chat.
function showCaption(text, ms = 6500) {
  const cap = $('#caption');
  cap.textContent = text; cap.classList.add('show');
  clearTimeout(showCaption.t);
  showCaption.t = setTimeout(() => cap.classList.remove('show'), ms);
}
const AUTO_COMMENTARY = false; // Re-enable after core gameplay acceptance.
async function veraEvent() { if (!AUTO_COMMENTARY) return; }
const ledger = (why, delta) => console.info('[ledger]', why, delta, '->', balance);
let selected = 5;
let bets = Array.from({ length: SEATS }, () => ({ main: 0, pp: 0, tp: 0 }));
let undoStack = []; // [{box, field, value}]
let round = null;
let busy = true; // opens after the server table has loaded

const betTotal = () => bets.reduce((a, b) => a + b.main + b.pp + b.tp, 0);
const mains = () => bets.map(b => b.main);

// ---------- seat layout on the oval ----------
const seatsEl = $('#seats');
const seatEls = [];
for (let i = 0; i < SEATS; i++) {
  const el = document.createElement('div');
  el.className = 'seat';
  el.dataset.box = i;
  el.innerHTML = `<div class="seat-inner">
    <div class="cards"></div>
    <button class="clear-box" hidden>×</button>
    <svg class="sidearcs" viewBox="-64 -50 128 100" aria-hidden="false">
      <g class="arc-g">
        <path class="side pp" d="M -26.9 -26.9 A 38 38 0 0 0 -26.9 26.9 L -36.8 36.8 A 52 52 0 0 1 -36.8 -36.8 Z"><title>Perfect Pairs — needs a main bet</title></path>
        <path class="side tp" d="M 26.9 -26.9 A 38 38 0 0 1 26.9 26.9 L 36.8 36.8 A 52 52 0 0 0 36.8 -36.8 Z"><title>21+3 — needs a main bet</title></path>
      </g>
      <g class="label-g">
        <text class="side-label pp-label" x="-45" y="0" text-anchor="middle" dominant-baseline="middle">PP</text>
        <text class="side-label tp-label" x="45" y="0" text-anchor="middle" dominant-baseline="middle">21+3</text>
      </g>
    </svg>
    <div class="spot">+</div>
    <div class="side-chip pp-chip" hidden></div>
    <div class="side-chip tp-chip" hidden></div>
    <div class="stake"></div>
    <div class="sideresult"></div>
    <div class="result"></div>
  </div>`;
  seatsEl.appendChild(el);
  if(tableScene?.setBettingBoxes){
    const controls=document.createElement('div');controls.className='felt-bet-controls';
    for(const node of el.querySelectorAll('.sidearcs,.spot,.side-chip'))controls.append(node);
    el.append(controls);
  }
  seatEls.push(el);
}
// screen-space seat positions measured from the expected-results screenshot:
// x fractions of the viewport, y on a shallow arc bowing toward the player
// Seats live on the TABLE IMAGE, not the viewport: equal angular spacing
// along an ellipse concentric with the felt's near rail, constant inset.
// Narrow viewports play the three centre boxes only: seven boxes on a phone
// leaves ~50px each, which cannot hold a chip stack and two cards.
const COMPACT_BOXES = [2, 3, 4];
const compactQuery = matchMedia('(max-width: 860px) and (orientation: portrait)');
let compactSeats = compactQuery.matches;
const playedBoxes = () => {
  if(!compactSeats)return seatEls.map((_,i)=>i);
  // A fixed 3D camera retains every server card on the felt. Retain its
  // occupied betting marker too, including completed hands and a resumed
  // desktop round, instead of sliding a three-marker window over the cards.
  if(tableScene?.rigged&&round)return [...new Set(round.live().map(hand=>hand.box))].sort((a,b)=>a-b);
  // A seven-seat desktop hand may be resumed on a phone. Keep the current
  // server-owned hand in view instead of hiding seats 0, 1, 5 and 6 forever.
  const active=round?.live()?.[round.active]?.box;
  if(Number.isInteger(active)){
    const start=Math.max(0,Math.min(SEATS-3,active-1));return [start,start+1,start+2];
  }
  return COMPACT_BOXES;
};

function layoutSeats() {
  if (localPresentationEnabled) {
    const width = Math.min(innerWidth, innerHeight * 9 / 16), height = width * 16 / 9;
    const left = (innerWidth - width) / 2, top = (innerHeight - height) / 2;
    const table = $('#table2d').getBoundingClientRect(), boxes = playedBoxes();
    seatEls.forEach((el, i) => el.classList.toggle('seat-off', !boxes.includes(i)));
    boxes.forEach((box, k) => {
      const x = .13 + .74 * k / Math.max(1, boxes.length - 1);
      const y = .68 + .035 * Math.sin(Math.PI * k / Math.max(1, boxes.length - 1));
      Object.assign(seatEls[box].style, { left: (left + x * width - table.left) + 'px', top: (top + y * height - table.top) + 'px' });
    });
    Object.assign($('#dealer-cards').style, { left: (left + width * .5 - table.left) + 'px', top: (top + height * .58 - table.top) + 'px' });
    return;
  }
  const imgEl = document.querySelector('#tableimg');
  const img = imgEl?.getBoundingClientRect();
  const table = document.querySelector('#table2d').getBoundingClientRect();
  if (!img || !img.width) return;
  // compact mode flattens the arc so the centre box's cards stay on the felt
  const num = (name, fb) => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)); return Number.isFinite(v) ? v : fb; };
  const CX = num('--arc-cx', 0.5), CY = num('--arc-cy', compactSeats ? 0.17 : 0.13);
  const RX = num('--arc-rx', 0.365), RY = num('--arc-ry', compactSeats ? 0.33 : 0.445);
  const boxes = playedBoxes();
  const span = compactSeats && tableScene ? 40 : num('--arc-span', compactSeats ? 84 : 110);   // leave room for the outer card fans on phones
  const step = span / (boxes.length - 1);
  tableScene?.setBettingBoxes?.(boxes.map((i,k)=>{
    const phi=(90+span/2-k*step)*Math.PI/180;
    return {id:i,x:.83*Math.cos(phi),z:.78*Math.sin(phi),rotation:(phi-Math.PI/2)*.65};
  }));
  seatEls.forEach((el, i) => el.classList.toggle('seat-off', !boxes.includes(i)));
  boxes.forEach((i, k) => {
    const phi = (90 + span / 2 - k * step) * Math.PI / 180;
    const fx = CX + RX * Math.cos(phi);
    const fy = CY + RY * Math.sin(phi);
    const p = tableScene?.seatScreen?.(i,boxes) ?? tableScene?.project(.83 * Math.cos(phi), .78 * Math.sin(phi));
    if (tableScene) seatEls[i].style.setProperty('--arc-rot', `${(phi * 180 / Math.PI - 90) * .65}deg`);
    seatEls[i].style.left = `${(p?.x ?? img.left + fx * img.width) - table.left}px`;
    seatEls[i].style.top = `${(p?.y ?? img.top + fy * img.height) - table.top}px`;
    seatEls[i].querySelector('.seat-inner').style.setProperty('--tang', `${(fx - 0.5) * 61}deg`);
    const quad=tableScene?.bettingBoxQuad?.(i),controls=seatEls[i].querySelector('.felt-bet-controls');
    if(quad&&controls){
      controls.style.transform=`matrix3d(${quadMatrix(quad.map(v=>[v.x-p.x,v.y-p.y]),128,100).join(',')})`;
    }
  });
  tableScene?.layoutCards?.();
  layoutHandTotals();
}
layoutSeats();
compactQuery.addEventListener('change', e => {
  compactSeats = e.matches;
  // boxes that just left the table must not keep money on them
  if (!round && !busy) {
    const boxes = playedBoxes();
    bets = bets.map((b, i) => (boxes.includes(i) ? b : { main: 0, pp: 0, tp: 0 }));
    undoStack = undoStack.filter(u => boxes.includes(u.box));
  }
  layoutSeats(); renderBets(); activeBoxHighlight();
});
addEventListener('resize', () => { layoutSeats(); activeBoxHighlight(); });
document.querySelector('#tableimg')?.addEventListener('load', layoutSeats);

// ---------- chip picker ----------
const chipsEl = $('#chips');
// chip colours cycle through the eight painted denominations, so a VIP ladder
// still reads as a normal rack instead of eight identical discs
const CHIP_SKINS = [1, 5, 10, 25, 50, 100, 500, 1000];
let chipSkin = new Map();
function buildChips() {
  chipsEl.innerHTML = '';
  chipSkin = new Map(CHIPS.map((v, i) => [v, CHIP_SKINS[i % CHIP_SKINS.length]]));
  if (!CHIPS.includes(selected)) selected = CHIPS[0];
  for (const v of CHIPS) {
    const el = document.createElement('div');
    el.className = `chip c${chipSkin.get(v)}` + (v === selected ? ' sel' : '');
    el.textContent = chipFace(v);
    el.dataset.v = v;
    el.onclick = () => {
      selected = v;
      chipsEl.querySelectorAll('.chip').forEach(c => c.classList.remove('sel'));
      el.classList.add('sel');
    };
    chipsEl.appendChild(el);
  }
}
const chipClassFor = v => `c${chipSkin.get([...CHIPS].reverse().find(c => c <= v) ?? CHIPS[0]) ?? 1}`;

function flyChip(value, targetEl) {
  const src = chipsEl.querySelector(`.chip[data-v="${value}"]`) ?? chipsEl.firstChild;
  const a = src.getBoundingClientRect();
  const b = targetEl.getBoundingClientRect();
  const ghost = src.cloneNode(true);
  ghost.classList.add('chip-fly');
  ghost.style.left = `${a.x}px`; ghost.style.top = `${a.y}px`;
  document.body.appendChild(ghost);
  requestAnimationFrame(() => {
    ghost.style.transform = `translate(${b.x + b.width / 2 - a.x - a.width / 2}px, ${b.y + b.height / 2 - a.y - a.height / 2}px) scale(.72)`;
    ghost.style.opacity = '0.9';
  });
  setTimeout(() => ghost.remove(), 480);
}

// ---------- betting ----------
let allSides = false;
function placeBet(i, field, targetEl) {
  console.info('[bet]', i, field, 'round=', !!round, 'busy=', busy);
  if (round || busy) return;
  // ALL SEATS mode: one click on any side-bet crescent bets it on every staked box
  if (field !== 'main' && allSides && !placeBet.bulk) {
    placeBet.bulk = true;
    for (let j = 0; j < SEATS; j++) {
      if (bets[j].main > 0) placeBet(j, field, seatEls[j].querySelector(field === 'pp' ? '.side.pp' : '.side.tp'));
    }
    placeBet.bulk = false;
    return;
  }
  if (field !== 'main' && bets[i].main === 0) return; // side bets ride on a main bet
  const cap = field === 'main' ? LIMITS.max : LIMITS.max / 2;
  const next = bets[i][field] + selected;
  if (next > cap) { hint('LIMIT', `${field === 'main' ? 'box' : 'side bet'} caps at ${fmt(cap)}`); return; }
  if (betTotal() + selected > balance) { hint('BALANCE', `${fmt(selected)} more than you have — add funds`); return; }
  flyChip(selected, targetEl);
  sfx.play('chip');
  bets[i][field] = next;
  undoStack.push({ box: i, field, value: selected });
  renderBets();
}
seatEls.forEach((seat, i) => {
  seat.querySelector('.spot').onclick = e => { console.info('[click-src]', i, 'trusted=', e.isTrusted); placeBet(i, 'main', e.currentTarget); };
  seat.querySelector('.side.pp').onclick = e => placeBet(i, 'pp', e.currentTarget);
  seat.querySelector('.side.tp').onclick = e => placeBet(i, 'tp', e.currentTarget);
  seat.querySelector('.clear-box').onclick = () => {
    if (round || busy) return;
    bets[i] = { main: 0, pp: 0, tp: 0 };
    undoStack = undoStack.filter(u => u.box !== i);
    renderBets();
  };
});
$('#undo-btn').onclick = () => {
  if (round || busy || !undoStack.length) return;
  const u = undoStack.pop();
  bets[u.box][u.field] = Math.max(0, bets[u.box][u.field] - u.value);
  if (bets[u.box].main === 0) { bets[u.box].pp = 0; bets[u.box].tp = 0; undoStack = undoStack.filter(x => x.box !== u.box); }
  renderBets();
};
$('#double-btn').onclick = () => {
  if (round || busy) return;
  const add = betTotal();
  if (!add || add * 2 > balance + add - add || betTotal() * 2 > balance || bets.some(b => b.main * 2 > LIMITS.max)) return;
  for (const [i, b] of bets.entries()) {
    if (b.main) undoStack.push({ box: i, field: 'main', value: b.main });
    if (b.pp) undoStack.push({ box: i, field: 'pp', value: b.pp });
    if (b.tp) undoStack.push({ box: i, field: 'tp', value: b.tp });
  }
  bets = bets.map(b => ({ main: b.main * 2, pp: b.pp * 2, tp: b.tp * 2 }));
  renderBets();
};
// MAX: fill the boxes you have chosen with the chip you have selected, as many
// as fit inside the table cap and your balance. The chip sets the granularity
// (pick 1K and boxes fill in 1K steps), and the hint says what stopped it so
// the button never looks like it did nothing.
$('#max-btn').onclick = () => {
  if (round || busy) return;
  const step = selected;
  const perBox = Math.floor(LIMITS.max / step) * step;   // biggest whole-chip stack inside the cap
  let idx = bets.map((_, i) => i).filter(i => bets[i].main > 0);
  if (!idx.length) idx = [playedBoxes()[Math.floor(playedBoxes().length / 2)]];  // none chosen -> centre box
  if (!perBox) { hint('MAX', `${fmt(step)} chip is over this table's ${fmt(LIMITS.max)} cap`); return; }
  if (balance < step) { hint('MAX', `balance is under one ${fmt(step)} chip — add funds`); return; }

  const next = bets.map(b => ({ ...b }));
  for (const i of idx) next[i].main = 0;                 // recompute the maximum from scratch
  let total = next.reduce((a, b) => a + b.main + b.pp + b.tp, 0);

  // round-robin so several chosen boxes fill evenly rather than front to back
  let stop = null, moved = true;
  while (moved) {
    moved = false;
    for (const i of idx) {
      if (next[i].main + step > perBox) { stop = stop ?? 'table'; continue; }
      if (total + step > balance) { stop = 'balance'; continue; }
      next[i].main += step; total += step; moved = true;
    }
  }

  const before = betTotal();
  bets = next;
  for (const [i, b] of bets.entries()) {
    const delta = b.main - (idx.includes(i) ? 0 : b.main);
    if (idx.includes(i) && b.main) undoStack.push({ box: i, field: 'main', value: b.main });
  }
  if (betTotal() !== before) sfx.play('chip');
  hint('MAX', stop === 'balance' ? 'all in — balance spent'
     : stop === 'table' ? `table cap ${fmt(LIMITS.max)} a box`
     : `${fmt(betTotal())} staked`);
  renderBets();
};

$('#clear-btn').onclick = () => {
  if (round || busy) return;
  bets = bets.map(() => ({ main: 0, pp: 0, tp: 0 }));
  undoStack = [];
  renderBets();
};

const chipFace = v => v >= 1e6 ? (v / 1e6) + 'M' : v >= 1000 ? (v / 1000) + 'K' : String(v);
// A bet is shown as the chips it is actually made of: break it into
// denominations from the current rack, biggest at the bottom, so adding money
// visibly grows the stack instead of just changing a number on one disc.
function chipBreakdown(total) {
  const out = [];
  let left = Math.round(total * 100) / 100;
  for (const d of [...CHIPS].sort((a, b) => b - a)) {
    while (left >= d - 1e-9 && out.length < 9) { out.push(d); left = Math.round((left - d) * 100) / 100; }
  }
  if (left > 0 && out.length < 9) out.push(CHIPS[0]);   // remainder under the smallest chip
  return out;
}
function stackChip(v) {
  const chips = chipBreakdown(v);
  if (!chips.length) return '';
  const discs = chips.map((d, i) => `<i class="c${chipSkin.get(d) ?? 1}" style="--n:${i}"></i>`).join('');
  return `<div class="chipstack" style="--h:${chips.length}">${discs}<b>${chipFace(v)}</b></div>`;
}
function renderBets() {
  if (!round && !busy) $('#dealer-switch-status').textContent = '';
  seatEls.forEach((seat, i) => {
    const b = round ? {...bets[i],main:round.hands.filter(h=>h.box===i).reduce((sum,h)=>sum+h.stake,0)} : bets[i];
    const spot = seat.querySelector('.spot');
    if (b.main) { spot.classList.add('staked'); spot.innerHTML = stackChip(b.main); }
    else { spot.classList.remove('staked'); spot.innerHTML = '<svg width="24" height="22" viewBox="-11 -12 27 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="-2" cy="-5" r="4.2"/><path d="M -9.5 8 c 1 -4.4 4 -6.8 7.5 -6.8 s 6.5 2.4 7.5 6.8"/><path d="M 8 -6 h 7 M 11.5 -9.5 v 7"/></svg>'; }
    for (const f of ['pp', 'tp']) {
      const arc = seat.querySelector(`.side.${f}`);
      const chip = seat.querySelector(`.${f}-chip`);
      arc.classList.toggle('staked', !!b[f]);
      chip.hidden = !b[f];
      if (b[f]) chip.innerHTML = stackChip(b[f]);
    }
    const parts = [];
    if (b.main) parts.push(fmt(b.main));
    if (b.pp || b.tp) parts.push(`+${fmt(b.pp + b.tp)} side`);
    seat.querySelector('.stake').textContent = parts.join(' ');
    seat.querySelector('.clear-box').hidden = !(b.main || b.pp || b.tp) || !!round || busy;
  });
  // Splits/doubles change server hand stakes, not the original betting draft.
  $('#total-bet').textContent = fmt(round ? round.hands.reduce((sum,h)=>sum+h.stake+(h.pp??0)+(h.tp??0)+(h.insured??0),0) : betTotal());
  $('#balance').textContent = fmt(balance);
  const staked = bets.filter(b => b.main > 0);
  const playable = staked.length > 0 && staked.every(b => b.main >= LIMITS.min);
  $('#deal-now').disabled = !playable || !!round || busy;
  $('#clear-btn').disabled = betTotal() === 0 || !!round || busy;
  $('#undo-btn').disabled = !undoStack.length || !!round || busy;
  $('#double-btn').disabled = !betTotal() || betTotal() * 2 > balance || bets.some(b => b.main * 2 > LIMITS.max) || !!round || busy;
  $('#max-btn').disabled = balance < LIMITS.min || !!round || busy;
}

// ---------- demo cashier ----------
let depositAmt = 500;
const setDeposit = amt => {
  depositAmt = amt;
  $('#cashier-pay').textContent = Number.isFinite(amt) && amt >= 1 ? `ADD ${fmt(amt)}` : 'ADD FUNDS';
};
$('#add-funds').onclick = async () => { try { if(!await ensureLogin('Sign in to add demo funds.'))return; refreshCashierAmounts(); $('#cashier').hidden = false; } catch(e){hint('SIGN IN',e.message);} };
$('#cashier-close').onclick = () => { $('#cashier').hidden = true; };
$('#cashier').onclick = e => { if (e.target.id === 'cashier') $('#cashier').hidden = true; };
// deposit presets scale with the table: a VIP box cannot be funded $500 at a time
function refreshCashierAmounts() {
  const base = table.max;
  const presets = [base / 2, base * 2, base * 10, base * 50].map(v => Math.max(100, Math.round(v / 100) * 100));
  document.querySelectorAll('#cashier .amt').forEach((b, i) => {
    b.dataset.amt = presets[i];
    b.textContent = chipFace(presets[i]);
  });
  const sel = document.querySelector('#cashier .amt.sel') ?? document.querySelector('#cashier .amt');
  document.querySelectorAll('#cashier .amt').forEach(x => x.classList.remove('sel'));
  sel.classList.add('sel');
  depositAmt = Number(sel.dataset.amt);
  $('#cashier-pay').textContent = `ADD ${fmt(depositAmt)}`;
}

document.querySelectorAll('#cashier .amt').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#cashier .amt').forEach(x => x.classList.remove('sel'));
    b.classList.add('sel');
    $('#cc-amount').value = '';
    setDeposit(Number(b.dataset.amt));
  };
});
$('#cc-amount').addEventListener('input', e => {
  e.target.classList.remove('bad');
  document.querySelectorAll('#cashier .amt').forEach(x => x.classList.remove('sel'));
  setDeposit(Math.floor(Number(e.target.value.replace(',', '.'))));
});
function renderCurrency() {
  document.querySelectorAll('#cashier .cur').forEach(b => b.classList.toggle('sel', b.dataset.cur === currency));
  setDeposit(depositAmt);
}
document.querySelectorAll('#cashier .cur').forEach(b => {
  b.onclick = async () => {
    if (b.dataset.cur === currency || round || busy) return;
    try {
      if (player) {
        const out = await api('/api/currency', { id: player.id, currency: b.dataset.cur });
        balance = out.balance; currency = out.currency;
      } else currency = b.dataset.cur;
      renderCurrency(); renderBets();
      toast('CURRENCY', balance, false);
    } catch { /* keep current currency */ }
  };
});
$('#cc-num').addEventListener('input', e => {
  e.target.classList.remove('bad');
  const d = e.target.value.replace(/\D/g, '').slice(0, 16);
  e.target.value = d.replace(/(.{4})/g, '$1 ').trim();
});
$('#cashier-pay').onclick = async () => {
  try {if(!await ensureLogin('Sign in to add demo funds.'))return;}catch(e){hint('SIGN IN',e.message);return;}
  if ($('#cc-num').value.replace(/\D/g, '').length < 12) { $('#cc-num').classList.add('bad'); return; }
  const depositCap = Math.max(100000, table.max * 100);   // must be able to fund the table you chose
  if (!(Number.isFinite(depositAmt) && depositAmt >= 1 && depositAmt <= depositCap)) {
    $('#cc-amount').classList.add('bad');
    hint('CASHIER', `deposits up to ${fmt(depositCap)}`);
    return;
  }
  const amt = depositAmt;
  try {
    balance = (await api('/api/deposit', { amount: amt })).balance;
  } catch(e) {hint('FUNDS NOT ADDED',e.message);return;}
  ledger('deposit', amt);
  $('#cashier').hidden = true;
  sfx.play('chip');
  toast('FUNDS ADDED', amt, amt >= 5000);
  void veraEvent(`${player?.name ?? 'The player'} just added ${fmt(amt)} at the cashier.`, { minGap: 30000 });
  renderBets();
};

// ---------- card rendering ----------
function cardEl(card, faceDown = false) {
  const el = document.createElement('div');
  if(!faceDown){el.dataset.rank=card.r;el.dataset.suit=card.s;}
  if (faceDown) { el.className = 'card back'; return el; }
  const red = card.s === '♥' || card.s === '♦';
  el.className = 'card' + (red ? ' red' : '');
  if(performancePlayer||blenderTable){
    el.style.backgroundImage=`url('${cardFaceArt(card,{jumbo:amiraBlender}).url}')`;el.style.backgroundSize='100% 100%';
    el.style.backgroundColor='transparent';el.setAttribute('aria-label',`${card.r}${card.s}`);return el;
  }
  el.innerHTML = `<div class="corner">${card.r}<br>${card.s}</div><div class="pip">${card.s}</div>`;
  return el;
}
function flyFromShoe(el, card, faceDown, cardMotion) {
  if (localPresentationEnabled && arguments[3]?.localCompleted) return Promise.resolve();
  if(tableScene?.rigged)return tableScene.dealCard({element:el,onCue:phase=>sfx.play(phase)});
  if(cardMotion?.performance && performancePlayer && tableScene) {
    const target=el.getBoundingClientRect();el.style.visibility='hidden';
    const corners=performanceCardCorners(el);
    const box=el.closest('[data-box]')?.dataset.box;
    const part=box!=null?'box'+box:faceDown?'dealer-hole':'dealer-up';
    const assigned=!cardMotion.green&&[...(performanceManifest.takes??[]),...(performanceManifest.continuations??[])].find(t=>t.id===clipAssignments[part]);
    const delivery=cardMotion.performance.action==='deal-dealer'?cardMotion.performance:
      selectPlayerPerformance(performanceManifest,{x:target.x+target.width/2,y:target.y+target.height/2},{width:innerWidth,height:innerHeight},{staged:performanceStaged})??cardMotion.performance;
    const take=cardMotion.green?cardMotion.performance:assigned??selectSequencePerformance(performanceManifest,delivery,{staged:performanceContinuity,continues:cardMotion.continues});
    const correlation=nativeObservation.context();
    nativeObservation.emit('playback',{event:'deal',state:'selected',part,takeId:take.id,media:take.media?.src,card:faceDown?null:card,faceDown},correlation);
    if(assigned)console.info('[performance] backoffice pick',part,assigned.id);
    return performancePlayer.play(take,{target,card,faceDown,corners,
      origin:tableScene.shoeOutlet(),onCue:phase=>sfx.play(phase),onLand:()=>{el.style.visibility='';nativeObservation.emit('playback',{event:'deal',state:'landed',part,takeId:take.id,evidence:'player-onLand'},correlation);}})
      .catch(error=>{console.warn('[performance]',error.message);const status=$('#performance-status');if(status)status.textContent=error.message;})
      .finally(()=>{el.style.visibility='';});
  }
  if (tableScene && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const target=el.getBoundingClientRect();
    const dealerRect=$('#dealer').getBoundingClientRect();
    el.style.visibility='hidden';
    const handoff = canUseDealingTake()
      ? cardMotion?.handoff ?? {x:dealerRect.x+dealerRect.width*.55,y:dealerRect.y+dealerRect.height*.93}
      : null;
    return tableScene.dealCard({target,element:el,card,faceDown,handoff,onCue:phase=>sfx.play(phase),duration:cardMotion?.duration,releaseFraction:cardMotion?.releaseFraction})
      .catch(error=>console.warn('[deal]',error.message)).finally(()=>{el.style.visibility='';});
  }
  const fallback = $('#shoe2d').getBoundingClientRect();
  const origin = tableScene?.shoeOutlet() ?? { x:fallback.x+fallback.width/2, y:fallback.y+fallback.height/2 };
  const r = el.getBoundingClientRect();
  // Animate a viewport-level card, avoiding seat rotation/perspective changing
  // the meaning of the shoe's screen coordinates.
  const flying = el.cloneNode(true); flying.classList.add('dealing-card');
  Object.assign(flying.style, { left:`${r.x}px`, top:`${r.y}px`, width:`${r.width}px`, height:`${r.height}px` });
  document.body.appendChild(flying); el.style.visibility = 'hidden';
  const dx=origin.x-(r.x+r.width/2), dy=origin.y-(r.y+r.height/2);
  const motion = flying.animate([
    { transform:`translate(${dx}px,${dy}px) rotate(-28deg) scale(.72)` },
    { transform:`translate(${dx*.85}px,${dy*.86}px) rotate(-20deg) scale(.85)`, offset:.22 },
    { transform:'translate(0,0) rotate(0deg) scale(1)' }
  ], { duration:matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 460, easing:'cubic-bezier(.2,.65,.3,1)' });
  return new Promise(resolve => {
    let finished=false;
    const done=()=>{ if(finished)return; finished=true; flying.remove(); el.style.visibility=''; resolve(); };
    motion.onfinish=()=>{if(!finished)sfx.play('land');done();}; motion.oncancel=done;
  });
}
function updateBadge(container, cards) {
  tableScene?.layoutCards?.();
  // the badge is parented OUTSIDE the cards container: inside it, it inherited
  // the hand's rotation and flattening and drifted whenever the hand was posed
  const isSub = container.classList?.contains('subhand');
  const host = isSub ? container.closest('.seat-inner') ?? container.parentNode.parentNode : container.parentNode;
  const key = isSub ? container.dataset.h : '';
  let badge = host.querySelector(`:scope > .hand-total[data-h="${key}"]`);
  if (!cards.length) { badge?.remove(); return; }
  if (!badge) { badge = document.createElement('div'); badge.className = 'hand-total'; badge.dataset.h = key; }
  if (isSub) badge.style.setProperty('--badge-x', container.style.getPropertyValue('--shx') || '0px');
  host.appendChild(badge);
  badge.style.setProperty('--cn', Math.max(0, container.querySelectorAll('.card').length - 1));
  const { total, soft } = handValue(cards);
  badge.textContent = soft && total <= 21 ? `${total - 10}/${total}` : String(total);
  layoutHandTotals();
}
function layoutHandTotals(){
  if(blenderTable){
    const badge=$('#table2d > .hand-total');
    const cards=[...document.querySelectorAll('#dealer-cards > .card')].map(el=>el.getBoundingClientRect());
    if(badge&&cards.length){
      const host=badge.parentElement.getBoundingClientRect();
      const left=Math.min(...cards.map(r=>r.left));
      const top=Math.min(...cards.map(r=>r.top)),bottom=Math.max(...cards.map(r=>r.bottom));
      // Anchor the right edge so soft/two-digit totals expand away from cards.
      Object.assign(badge.style,{left:`${left-host.left-10}px`,top:`${(top+bottom)/2-host.top}px`,transform:'translate(-100%,-50%)'});
    }
  }
  if(tableScene?.layoutHandTotals){tableScene.layoutHandTotals();return;}
  const badges=[...document.querySelectorAll('.seat:not(.seat-off) .hand-total')];
  for(const badge of badges)badge.style.setProperty('--badge-clear-y','0px');
  const obstacles=[...document.querySelectorAll('.seat:not(.seat-off) .sidearcs,.seat:not(.seat-off) .card')].map(el=>el.getBoundingClientRect());
  // A split fan can reach beneath a neighbouring seat's side-bet arc. Clear
  // that arc as well as the split's own chip, then keep each total separate.
  for(const parent of new Set(badges.map(b=>b.parentElement))){
    const group=badges.filter(b=>b.parentElement===parent),bounds=group.map(b=>b.getBoundingClientRect());
    const left=Math.min(...bounds.map(r=>r.left)),right=Math.max(...bounds.map(r=>r.right));
    let top=Math.max(...bounds.map(r=>r.top));
    for(const o of obstacles)if(left<o.right+6&&right>o.left-6)top=Math.max(top,o.bottom+8);
    const scale=parent.getBoundingClientRect().width/parent.offsetWidth||1;
    group.forEach((badge,i)=>badge.style.setProperty('--badge-clear-y',`${(top-bounds[i].top)/scale}px`));
    obstacles.push(...group.map(b=>b.getBoundingClientRect()));
  }
}
function seatOfLive(liveIdx) {
  // hands carry .box = the SEAT index (the engine is handed all seven boxes);
  // live indices shift when a box splits, so the seat must come from the box
  const boxIdx = round?.live()?.[liveIdx]?.box;
  if (boxIdx !== undefined) return seatEls[boxIdx] ?? null;
  let n = -1;
  for (let i = 0; i < SEATS; i++) if (bets[i].main) { n++; if (n === liveIdx) return seatEls[i]; }
  return null;
}
function boxContainer(liveIdx) {
  const seat = seatOfLive(liveIdx);
  if (!seat || !round) return seat?.querySelector('.cards') ?? null;
  let hand = round.live()[liveIdx];
  const sibs = round.live().filter(h => h.box === hand.box);
  const cardsEl = seat.querySelector('.cards');
  if (sibs.length === 1) return cardsEl;
  return subhandEl(cardsEl, sibs.indexOf(hand), sibs.length);
}
// a split box shows its hands side by side: each hand gets its own fan,
// offset around the seat centre
function subhandEl(cardsEl, k, count) {
  let sub = cardsEl.querySelector(`:scope > .subhand[data-h="${k}"]`);
  if (!sub) { sub = document.createElement('div'); sub.className = 'subhand'; sub.dataset.h = k; cardsEl.appendChild(sub); }
  const shift = (k - (count - 1) / 2) * 64;
  sub.style.setProperty('--shx', `${shift}px`);
  return sub;
}
// A split, paced like a table: the pair separates into single-card fans
// first, then the dealer deals each new hand its second card - without this
// the cards appear instantly and it reads as the game hitting for you.
async function animateSplit(bHand) {
  const boxIdx = bHand.box;
  const sibs = round.live().filter(h => h.box === boxIdx);
  const nh = sibs[sibs.indexOf(bHand) + 1];
  const seat = seatEls[boxIdx];
  const cardsEl = seat.querySelector('.cards');
  tableScene?.rememberBoxCards?.(boxIdx);
  cardsEl.innerHTML = '';
  seat.querySelectorAll('.hand-total').forEach(b => b.remove());
  const conts = sibs.map((h, k) => subhandEl(cardsEl, k, sibs.length));
  sibs.forEach((h, k) => {
    const upto = (h === bHand || h === nh) ? 1 : h.cards.length;
    h.cards.slice(0, upto).forEach((card, ci) => { const el = cardEl(card); el.style.setProperty('--ci', ci); conts[k].appendChild(el); });
    updateBadge(conts[k], h.cards.slice(0, upto));
  });
  await sleep(550);
  await beginDealingTake();
  for (const h of [bHand, nh]) {
    const k = sibs.indexOf(h);
    if (!h.cards[1]) continue;
    await deliverCard(conts[k], h.cards[1], {continues:h===bHand&&!!nh.cards[1]});
    updateBadge(conts[k], h.cards);
    await sleep(80);
  }
  await endDealingTake();
}

// rebuild one box's card DOM from round state (used right after a split: the
// dealer visibly separates the pair into two fans)
function renderBoxHands(boxIdx) {
  const hands = round.live().filter(h => h.box === boxIdx);
  const firstLive = round.live().findIndex(h => h.box === boxIdx);
  const seat = seatOfLive(firstLive);
  if (!seat) return;
  const cardsEl = seat.querySelector('.cards');
  cardsEl.innerHTML = '';
  seat.querySelectorAll('.hand-total').forEach(b => b.remove());
  hands.forEach((hand, k) => {
    const cont = hands.length === 1 ? cardsEl : subhandEl(cardsEl, k, hands.length);
    hand.cards.forEach((card, ci) => {
      const el = cardEl(card, false);
      el.style.setProperty('--ci', ci);
      cont.appendChild(el);
    });
    updateBadge(cont, hand.cards);
  });
}
function dealCardTo(container, card, { faceDown = false, shoeDraw = card?.shoeDraw, motion } = {}) {
  if (shoeState && shoeDraw) showShoe({ ...shoeState, dealt:shoeDraw, remaining:shoeState.total-shoeDraw, cutReached:shoeDraw>=shoeState.cutAfter });
  const el = cardEl(card, faceDown);
  const n = container.querySelectorAll('.card').length;
  el.style.setProperty('--ci', n);
  // squeeze the fan once a hand runs long, so it stays over its own box
  const total = n + 1;
  container.style.setProperty('--cn', total);
  container.style.setProperty('--fan', Math.min(1, 3.2 / Math.max(2, total)).toFixed(3));
  container.appendChild(el);
  if(astridGreenTake&&container.id==='dealer-cards')layoutGreenDealerCards(container,astridGreenTake);
  if(astridGreenBoxTakes.length)layoutGreenBoxCards();
  tableScene?.layoutCards?.();
  el.dealt = flyFromShoe(el, card, faceDown, motion);
  return el;
}
async function deliverCard(container, card, options={}) {
  const correlation=nativeObservation.context();
  let motion;
  const seatBox=container.closest('[data-box]')?.dataset.box;
  if (localPresentationEnabled) {
    const event = { type: 'deal', to: container.id === 'dealer-cards' ? 'dealer' : 'box',
      box: seatBox == null ? null : Number(seatBox), shoeDraw: options.shoeDraw ?? card?.shoeDraw };
    const played = await localPresentation?.present(event);
    const element = dealCardTo(container, card, { ...options, motion: { localCompleted: played } });
    await element.dealt;
    nativeObservation.emit('playback', { event: 'deal', state: 'landed', ...event, type: undefined, renderer: '2d', evidence: 'DOM-card-presented', calibratedContact: false }, correlation);
    return;
  }
  const greenTake=selectGreenTake(astridGreenTakes,{dealer:DEALER.key,enabled:!astridDealingPaused,containerId:container.id,box:seatBox==null?null:Number(seatBox),split:container.classList.contains('subhand'),faceDown:options.faceDown===true,existingCards:container.querySelectorAll('.card').length});
  const green=!!greenTake;
  const centre=container.getBoundingClientRect().x+container.getBoundingClientRect().width/2;
  const action=container.id==='dealer-cards'?'deal-dealer':centre<innerWidth*.42?'deal-left':centre>innerWidth*.58?'deal-right':'deal-centre';
  const performanceTake=green?greenTake:selectPerformance?.(performanceManifest,action,{staged:performanceStaged});
  if(performanceTake && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    motion={performance:performanceTake,continues:options.continues===true,green};
  } else if (dealingActive && dealingCues && canUseDealingTake() && !document.hidden) {
    const current=engine.presentation;
    const lead=dealingCues.leadFrames;
    const cue=dealingCues.cues.find(c => current?.key===CLIP.deal && c.frame-lead > current.frame)
      ?? dealingCues.cues[0];
    const afterCycle=current?.key===CLIP.deal && cue.frame-lead<=current.frame ? current.cycle : -1;
    const shown=await engine.waitForFrame(CLIP.deal,cue.frame-lead,{afterCycle});
    if (shown) {
      console.info('[deal] hand cue', cue.frame, 'prepared at', shown.frame, 'cycle', shown.cycle);
      const r=$('#dealer').getBoundingClientRect();
      motion={handoff:{x:r.x+r.width*cue.x,y:r.y+r.height*cue.y},duration:dealingCues.durationMs,releaseFraction:dealingCues.releaseFraction};
    }
  }
  // A filmed take hides the waiting idle; ask for the hold first so the cut
  // lands on a ready-pose frame, never mid-glance.
  if(motion?.green)await astridWaiting?.holdAtBoundary();
  const observedCard={event:'deal',to:container.id==='dealer-cards'?'dealer':'box',box:seatBox==null?null:Number(seatBox),card:options.faceDown?null:card,faceDown:options.faceDown===true};
  nativeObservation.emit('playback',{...observedCard,state:'start',renderer:motion?.performance?'performance':'table-motion',evidence:'animation-request'},correlation);
  try { await dealCardTo(container,card,{...options,motion}).dealt;
    nativeObservation.emit('playback',{...observedCard,state:'end',evidence:'animation-promise'},correlation);
  } catch(error) { nativeObservation.emit('playback',{...observedCard,state:'error',error:error.message},correlation);throw error; }
}

async function endDealingTake({ deferIdle = false } = {}) {
  dealingActive=false;
  // The filmed return owns the actor until its final pose and the matching
  // idle frame have both been presented. Speech/decisions wait for this.
  try {await performancePlayer?.finish({wait:['decisions','insurance'].includes(round?.phase)});}catch(error){console.warn('[performance] return',error.message);}
  if(engineUp && !speaking && engine.presentedClip===CLIP.deal) {
    const returning='idle-1/actions/action-return';
    engine.interrupt(engine.index.clips[returning] ? returning : CLIP.idle);
  }
  if (!deferIdle) {
    updatePoseState({ dealerPose: 'unknown', actionOwner: 'none', idlePresented: null }, 'action-completed');
    if (!localPresentationEnabled && (greenActor || performancePlayer || engine.presentedClip === CLIP.idle)) presentStandardIdle('action-return');
    localPresentation?.state({ action: false });
  }
  if(astridGreenTake&&$('#dealer-cards .card:not(.back)'))$('#green-upcard-replay').disabled=false;
  greenBoxReplays(true);
}
async function revealHole(container, card) {
  const back = container.querySelector('.card.back');
  if (!back) return;
  if(tableScene?.revealCard)await tableScene.revealCard({element:back,card,onCue:phase=>sfx.play(phase)});
  const el = cardEl(card);
  el.style.setProperty('--ci', back.style.getPropertyValue('--ci') || 1);
  el.classList.add('flip');
  back.replaceWith(el);
  nativeObservation.emit('playback',{event:'reveal',state:'presented',card,evidence:'DOM-replacement'});
  if(astridGreenTake&&container.id==='dealer-cards')layoutGreenDealerCards(container,astridGreenTake);
}
function clearTable() {
  if(astridGreenTake)$('#green-upcard-replay').disabled=true;
  greenBoxReplays(false);
  document.querySelectorAll('.cards').forEach(c => (c.innerHTML = ''));
  document.querySelectorAll('.hand-total').forEach(b => b.remove());
  document.querySelectorAll('.result, .sideresult').forEach(r => { r.textContent = ''; r.className = r.className.split(' ')[0]; });
}

// ---------- round flow ----------
function setBanner(text) { const b = $('#banner'); if (!text) b.classList.add('hidden'); else { b.classList.remove('hidden'); b.textContent = text; } }
function activeBoxHighlight() {
  tableScene?.setActiveHand?.(null);
  if(compactSeats)layoutSeats();
  seatEls.forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.subhand').forEach(su => su.classList.remove('waiting'));
  $('#actions').hidden = true;
  $('#actions-top').hidden = true;
  if (!round || round.phase !== 'decisions') return;
  const seat = seatOfLive(round.active);
  if (!seat) return;
  seat.classList.add('active');
  // on a split box, dim the hands that are waiting so HIT visibly belongs
  // to one fan
  const cont = boxContainer(round.active);
  tableScene?.setActiveHand?.(cont);
  if (cont?.classList.contains('subhand')) {
    cont.parentNode.querySelectorAll(':scope > .subhand').forEach(su => { if (su !== cont) su.classList.add('waiting'); });
  }
  showActions(seat);
}
function showActions(seat) {
  const legal = round?.legal() ?? [];
  const bar = $('#actions');
  bar.hidden = legal.length === 0;
  const top = $('#actions-top');
  top.hidden = legal.length === 0;
  const stake = round?.live()[round.active]?.stake ?? Infinity;
  for (const b of [...bar.querySelectorAll('button'), ...top.querySelectorAll('button')]) {
    b.disabled = !legal.includes(b.dataset.act) ||
      ((b.dataset.act === 'double' || b.dataset.act === 'split') && balance < stake);
  }
  if (bar.hidden) return;
  const activeSeat=seat ?? seatOfLive(round.active),r=activeSeat.getBoundingClientRect();
  const compact=getComputedStyle(bar).display!=='none';
  // Only one action panel is needed. Both layouts keep the same legal moves.
  top.hidden=compact;
  const controls=compact?bar:top;
  if(tableScene?.rigged){
    for(const panel of [bar,top]){
      let readout=panel.querySelector('.rig-hand-readout');
      if(!readout){readout=document.createElement('div');readout.className='rig-hand-readout';panel.prepend(readout);}
      const hand=round.live()[round.active],siblings=round.live().filter(h=>h.box===hand.box);
      const label=siblings.length>1?`Hand ${siblings.indexOf(hand)+1} of ${siblings.length}`:'Your hand';
      readout.textContent=`${label} · ${hand.cards.map(c=>`${c.r}${c.s}`).join(' ')}`;
    }
  }
  const visible=el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
  const protectedEls=[...document.querySelectorAll('.card,.hand-total,.seat .spot.staked,.seat .sidearcs,.sideresult,#wallet,#bottom-right,#table-pick,#rehearsal')].filter(visible);
  const obstacles=protectedEls.map(el=>el.classList.contains('card')?(tableScene?.cardBounds?.(el)??el.getBoundingClientRect()):el.getBoundingClientRect());
  const totals=[...activeSeat.querySelectorAll('.hand-total')].map(el=>el.getBoundingClientRect());
  const fan=tableScene?.handBounds?.(boxContainer(round.active));
  const anchor={x:fan?(fan.left+fan.right)/2:r.x,bottom:Math.max(fan?.bottom??r.y,...totals.map(b=>b.bottom))};
  const placement=placeActions({width:controls.offsetWidth,height:controls.offsetHeight,
    viewport:{width:innerWidth,top:Math.min(innerHeight*.35,$('#table2d').getBoundingClientRect().top),bottom:$('#dealer-picker').getBoundingClientRect().top},anchor,obstacles,belowAnchor:true});
  if(placement){
    controls.style.position='fixed';controls.style.transform='none';controls.style.bottom='auto';
    controls.style.left=`${placement.x}px`;controls.style.top=`${placement.y}px`;
    controls.style.setProperty('--action-pointer-x',`${Math.max(16,Math.min(controls.offsetWidth-16,r.x-placement.x))}px`);
    controls.classList.toggle('above-hand',placement.y<r.y);
  }
}

$('#deal-now').onclick = async () => { if(round||busy)return; try { if(!await ensureLogin('Sign in to start this round. Your selected bets will stay in place.'))return; if(betTotal()>balance){hint('BALANCE','Add funds or reduce your bet.');renderBets();return;} if(!round&&!busy)void dealSequence(); } catch(e){hint('SIGN IN',e.message);} };

async function beginDealingTake() {
  try {
  const currentOwner = speechPoseGate?.state.actionOwner ?? 'none';
  updatePoseState({ dealerPose: 'action', actionOwner: currentOwner === 'none' ? 'dealer-action' : currentOwner,
    idlePresented: null }, 'action-started');
  await speechQueue.idle;
  if(tableScene?.rigged){console.info('[deal] Rigged contact review sequence');return;}
  if(performancePlayer){if(performancePlayer.joins)performancePlayer.beginSequence();console.info('[deal] Presented-frame performance sequence');return;}
  dealingActive = canUseDealingTake();
  if (!dealingActive) {
    console.info('[deal] No usable filmed action; direct shoe delivery');
    return;
  }
  await engine.fetchClip(CLIP.deal);
  const request=engine.interrupt(CLIP.deal);
  await new Promise(resolve=>{
    const previous=engine.onPresentClip;
    const finish=()=>{clearTimeout(timer);if(engine.onPresentClip===listener)engine.onPresentClip=previous;resolve();};
    const listener=(key,id)=>{previous?.(key,id);if(key===CLIP.deal&&id===request)finish();};
    engine.onPresentClip=listener;
    const timer=setTimeout(finish,3000);
  });
  await sleep(350);
  } catch (error) { console.warn('[deal] Filmed action unavailable:', error.message); }
}

async function dealSequence() {
  busy = true;
  document.body.classList.add('in-round');
  let out;
  try {
    await tableReady;
    out = await tableCommand('start', {bets:bets.map(b=>({...b}))});
  } catch (e) { document.body.classList.remove('in-round'); tableError(e); return; }
  balance=out.balance; ledger('deal',-betTotal());
  if (out.shuffled) {
    clearTable(); setBanner('CHANGING SHOE · SHUFFLING');
    showShoe({...out.shoe,dealt:0,remaining:out.shoe.total,cutReached:false});
    await sleep(1800);
  }
  round = roundView(out.round);
  renderBets(); setBanner(null); clearTable();
  // Speech and action share a filmed body: wait for the actual sentence,
  // then begin the dealing take before releasing any server-issued cards.
  await voice.say('goodluck', { force: true });
  await beginDealingTake();

  const live = round.live();
  const PACE = 80;
  for (let i = live.length - 1; i >= 0; i--) {
    await deliverCard(boxContainer(i), live[i].cards[0], {continues:true});
    updateBadge(boxContainer(i), live[i].cards.slice(0, 1));
    await sleep(PACE);
  }
  await deliverCard($('#dealer-cards'), round.dealer[0], {continues:true});
  updateBadge($('#dealer-cards'), [round.dealer[0]]);
  await sleep(PACE);
  for (let i = live.length - 1; i >= 0; i--) {
    await deliverCard(boxContainer(i), live[i].cards[1], {continues:true});
    updateBadge(boxContainer(i), live[i].cards.slice(0, 2));
    await sleep(PACE);
  }
  await deliverCard($('#dealer-cards'), null, { faceDown: true, shoeDraw:round.holeDraw });
  await sleep(PACE);

  await endDealingTake();
  // side bets resolve on the deal, like the real game
  let sideWin = false;
  live.forEach((b, i) => {
    if (!(b.pp || b.tp)) return;
    const el = seatOfLive(i).querySelector('.sideresult');
    if (b.sideReturn > 0) {
      sideWin = true;
      el.textContent = `${b.sideLabels.join(' · ')} +${fmt(b.sideReturn)}`;
      const seatEl = seatOfLive(i);
      const r = seatEl.getBoundingClientRect();
      burstAt(r.x, r.y, b.sideReturn >= b.stake * 10);
      const seatNo = seatEls.indexOf(seatEl) + 1;
      toast(`SEAT ${seatNo} · ${b.sideLabels.join(' + ')}`, b.sideReturn, b.sideReturn >= b.stake * 10);
    }
    else el.textContent = 'side lost';
  });
  if (sideWin) { sfx.play('bigwin'); voice.say('sidebet', { force: true }); }

  trigger(CLIP.dealWatch);

  if (round.phase === 'insurance') {
    const cost = round.live().reduce((a, b) => a + b.stake / 2, 0);
    $('#ins-yes').disabled = balance < cost;
    $('#insurance').hidden = false; busy = false; renderBets();
    voice.say('insurance', { force: true });
    return;
  }
  await afterDealChoreo();
}

$('#ins-yes').onclick = () => resolveIns(true);
$('#ins-no').onclick = () => resolveIns(false);
async function resolveIns(yes) {
  if (!round || round.phase !== 'insurance') return;
  const beforeBalance=balance;
  $('#insurance').hidden = true;
  busy = true;
  if (yes) {
    const cost = round.live().reduce((a, b) => a + b.stake / 2, 0);
    if (balance < cost) yes = false;
    else { balance -= cost; ledger('insurance', -cost); }
  }
  try { const out=await tableCommand('insurance',{take:yes}); round=roundView(out.round); balance=out.balance; }
  catch(e) { balance=beforeBalance; tableError(e); return; }
  renderBets();
  void afterDealChoreo();
}

async function afterDealChoreo() {
  if (round.phase === 'settled') { await dealerRevealChoreo(); await finish(); return; }
  busy = false;
  renderBets(); activeBoxHighlight();
  if (round.phase === 'decisions') trigger(CLIP.think);
}

document.querySelectorAll('#actions button, #actions-top button').forEach(btn => {
  btn.onclick = async e => {
    console.info('[act]', btn.dataset.act, 'trusted=', e?.isTrusted, 'phase=', round?.phase, 'busy=', busy);
    if (!round || round.phase !== 'decisions' || busy) return;
    const beforeBalance = balance;
    const liveIdx = round.active;
    let hand = round.live()[liveIdx];
    const before = hand.cards.length;
    if (btn.dataset.act === 'double') {
      if (balance < hand.stake) return;
      balance -= hand.stake; ledger('double', -hand.stake);
    }
    if (btn.dataset.act === 'split') {
      if (balance < hand.stake) return;
      balance -= hand.stake; ledger('split', -hand.stake);
      sfx.play('chip');
    }
    document.querySelectorAll('#actions button, #actions-top button').forEach(b => { b.disabled = true; });
    // A hit request has no filmed table knock; sound follows card contact.
    busy=true;
    try { const out=await tableCommand('act',{action:btn.dataset.act}); round=roundView(out.round); balance=out.balance; hand=round.live()[liveIdx]; }
    catch(e) { balance=beforeBalance; tableError(e); return; }
    if (btn.dataset.act === 'double') await voice.say('double', { force: true });
    if (btn.dataset.act === 'split') { await animateSplit(hand); syncBalance('split'); }
    else if (hand.cards.length > before) {
      await beginDealingTake();
      await deliverCard(boxContainer(liveIdx), hand.cards.at(-1));
      updateBadge(boxContainer(liveIdx), hand.cards);
      await endDealingTake();
      if (handValue(hand.cards).total > 21) await voice.say('bust', { force:true });
      await sleep(80);
    }
    renderBets();
    if (round.phase === 'decisions') {
      localPresentation?.state({ action: false });
      updatePoseState({ actionOwner: 'none' }, 'player-action-completed');
      busy=false;
      trigger(CLIP.think);
      setTimeout(() => { if (round && round.phase === 'decisions' && !busy) activeBoxHighlight(); }, 280);
      activeBoxHighlight();
    } else {
      $('#actions').hidden = true;
      $('#actions-top').hidden = true;
      seatEls.forEach(s => s.classList.remove('active'));
      busy = true;
      await dealerRevealChoreo();
      await finish();
    }
  };
});

async function dealerRevealChoreo() {
  const dc = $('#dealer-cards');
  trigger(CLIP.dealWatch);
  await sleep(500);
  if (round.dealer.length >= 2) {
    await revealHole(dc, round.dealer[1]);
    updateBadge(dc, round.dealer.slice(0, 2));
    await sleep(650);
  }
  if (round.dealer.length > 2) await beginDealingTake();
  for (let i = 2; i < round.dealer.length; i++) {
    await deliverCard(dc, round.dealer[i], {continues:i<round.dealer.length-1});
    updateBadge(dc, round.dealer.slice(0, i + 1));
    await sleep(80);
  }
  await endDealingTake();
}

async function finish() {
  $('#actions').hidden = true;
  $('#actions-top').hidden = true;
  seatEls.forEach(s => s.classList.remove('active'));
  const live = round.live();
  let ret = 0, sideRet = 0, anyWin = false, anyPush = false, anyLose = false, anyPlayerBJ = false;
  let n = -1;
  const rows = [];
  seatEls.forEach((seat, i) => {
    const b = bets[i];
    if (!b.main) return;
    n++;
    // a split box settles as the SUM of its hands - live[] can hold several
    // hands per box, and every one of them pays or loses
    const handsHere = live.filter(h => h.box === i);
    let stakeSum = 0, backSum = 0, insSum = 0;
    handsHere.forEach((hand, k) => {
      ret += hand.result;
      stakeSum += hand.stake; backSum += hand.result; insSum += hand.insured;
      if (hand.splitFrom === null && hand.cards.length === 2 && handValue(hand.cards).total === 21) anyPlayerBJ = true;
      // on a split box every hand shows its own verdict - the combined net
      // below can read as "my 21 didn't pay" when a sibling busted
      if (handsHere.length > 1) {
        const hnet = hand.result - hand.stake - hand.insured;
        const badge = seat.querySelector(`.hand-total[data-h="${k}"]`);
        if (badge) {
          const t = handValue(hand.cards).total;
          badge.textContent = `${t > 21 ? 'BUST' : t} ${hnet > 0 ? '+' : ''}${fmt(hnet)}`;
          badge.classList.add(hnet > 0 ? 'win' : hnet === 0 ? 'push' : 'lose');
        }
      }
    });
    sideRet += handsHere[0]?.sideReturn ?? 0;   // side bets ride the original hand only
    const el = seat.querySelector('.result');
    const net = backSum - stakeSum - insSum;
    // show the NET, signed: "WIN $100" used to mean the total returned, which
    // reads as profit and is not
    const sideNet = (handsHere[0]?.sideReturn ?? 0) - (b.pp + b.tp);
    rows.push({ box: i, stake: stakeSum, sides: b.pp + b.tp, back: backSum, net, sideNet,
                outcome: net > 0 ? 'win' : net === 0 ? 'push' : 'lose' });
    if (net > 0) {
      el.textContent = '+' + fmt(net); el.classList.add('win'); anyWin = true;
      el.title = `staked ${fmt(stakeSum)}, returned ${fmt(backSum)}`;
      const r = seat.getBoundingClientRect();
      burstAt(r.x, r.y, backSum >= stakeSum * 2.4);
    }
    else if (net === 0) { el.textContent = 'PUSH ' + fmt(stakeSum); el.classList.add('push'); anyPush = true; el.title = 'stake returned'; }
    else { el.textContent = fmt(net); el.classList.add('lose'); anyLose = true; el.title = `staked ${fmt(stakeSum)}`; }
  });
  // Include extra double/split stakes and insurance, not just opening bets.
  const staked = live.reduce((sum,h) => sum + h.stake + (h.insured ?? 0), 0)
    + bets.reduce((sum,b) => sum + b.pp + b.tp, 0);
  let collected;
  try { collected=await tableCommand('collect'); } catch(e) { tableError(e); return; }
  balance += ret; ledger('settle', ret);
  if (sideRet) { balance += sideRet; ledger('sidebets', sideRet); }
  balance=collected.balance; showShoe(collected.shoe);
  const totalWin = ret + sideRet;
  const lw = $('#last-win');
  lw.textContent = fmt(totalWin);
  lw.classList.toggle('won', totalWin > 0);
  showSettlement(rows, staked, totalWin);
  if (totalWin > 0) toast('TOTAL WIN', totalWin, anyPlayerBJ || totalWin >= 500);
  syncBalance('settle');
  renderBets();
  const dealerTotal = handValue(round.dealer).total;
  const dealerBJ = round.dealer.length === 2 && dealerTotal === 21;
  const allBusted = live.length > 0 && live.every(h => h.busted || handValue(h.cards).total > 21);
  if (dealerBJ) voice.say('dealerblackjack', { force: true });
  else if (anyPlayerBJ && anyWin) { sfx.play('bigwin'); bjFlash('BLACKJACK'); voice.say('blackjack', { force: true }); }
  else if (allBusted) { /* already voiced on the hit; never celebrate a dealer bust the player didn't beat */ }
  else if (dealerTotal > 21 && anyWin) { sfx.play('win'); voice.say('dealerbust', { force: true }); }
  else if (anyWin) { sfx.play('win'); voice.say('win', { force: true }); }
  else if (anyPush && !anyLose) voice.say('push', { force: true });
  else voice.say('lose', { force: true });
  trigger(anyWin ? CLIP.gest : CLIP.headTilt);
  // Automatic floor visits wait until core gameplay is accepted.
  const who = player?.name ?? 'the player';
  if (totalWin > 0) void veraEvent(`Round settled: ${who} collected ${fmt(totalWin)} this round${anyPlayerBJ ? ' including a natural blackjack' : ''}.`);
  else void veraEvent(`Round settled: the house took this one; ${who} won nothing back.`, { minGap: 45000 });
  await Promise.all([sleep(1800), speechQueue.idle]);
  await endDealingTake({ deferIdle: true });
  if(tableScene?.collectCards)await tableScene.collectCards({onCue:phase=>sfx.play(phase)});
  updatePoseState({ dealerPose: 'unknown', actionOwner: 'none', idlePresented: null }, 'table-cleared');
  if (!localPresentationEnabled && (greenActor || performancePlayer || engine.presentedClip === CLIP.idle)) presentStandardIdle('table-cleared');
  localPresentation?.state({ action: false });
  round = null; busy = false;
  bets = bets.map(() => ({ main: 0, pp: 0, tp: 0 }));
  undoStack = [];
  clearTable();
  document.body.classList.remove('in-round');
  layoutSeats();
  renderBets(); setBanner('PLEASE PLACE BETS');
  voice.say('placebets');
}

// ---------- chat: OpenClaw decision + renderer-owned pose gate ----------
let chatHistory = [];
let chatBusy = false;
const pendingChatReplies = new Map();
const compactChat = () => localPresentationEnabled && matchMedia('(max-width: 860px)').matches;
let chatToggle, chatStatus, chatElapsed;
function setChatOpen(open) {
  $('#chat-log').classList.toggle('open', open);
  chatToggle?.setAttribute('aria-expanded', String(open));
  if (open && chatToggle) delete chatToggle.dataset.unread;
}
function setChatStatus(text) {
  if (!chatStatus) return;
  chatElapsed.textContent = '';
  chatStatus.replaceChildren(...(text ? [document.createTextNode(text), chatElapsed] : []));
}
if (localPresentationEnabled) {
  chatToggle = document.createElement('button'); chatToggle.id = 'chat-log-toggle';
  chatToggle.type = 'button'; chatToggle.textContent = 'Chatt';
  chatToggle.setAttribute('aria-label', 'Visa eller dölj chattloggen');
  chatToggle.setAttribute('aria-controls', 'chat-log'); chatToggle.setAttribute('aria-expanded', 'false');
  chatToggle.onclick = () => { clearTimeout(chatLog.t); setChatOpen(!$('#chat-log').classList.contains('open')); };
  $('#chat').append(chatToggle);
  chatStatus = document.createElement('span'); chatStatus.id = 'chat-status';
  chatElapsed = document.createElement('span'); chatElapsed.setAttribute('aria-hidden', 'true');
  chatStatus.setAttribute('role', 'status'); $('#chat').append(chatStatus);
  $('#chat').addEventListener('keydown', event => { if (event.key === 'Escape') setChatOpen(false); });
  matchMedia('(max-width: 860px)').addEventListener('change', event => { if (event.matches) setChatOpen(false); });
}

function chatLog(role, text, pending = false) {
  const panel = $('#chat-log');
  const row = document.createElement('div');
  row.className = `msg ${role}` + (pending ? ' pending' : '');
  const name = document.createElement('b');
  name.textContent = role === 'user' ? (player?.name ?? 'You') : DEALER.name;
  const message = document.createElement('p'); message.textContent = text;
  row.append(name, message);
  panel.appendChild(row);
  setChatOpen(!compactChat());
  if (compactChat() && role !== 'user' && chatToggle) chatToggle.dataset.unread = 'true';
  panel.scrollTop = panel.scrollHeight;
  while (panel.children.length > 24) panel.firstChild.remove();
  clearTimeout(chatLog.t);
  chatLog.t = setTimeout(() => setChatOpen(false), 26000);
  return row;
}

const VERA_BANK_URL = `${DEALER.base}/audio/en`;
let veraBank = {};
const bankReady = fetch(`${VERA_BANK_URL}/bank.json`).then(r => r.ok ? r.json() : {}).then(b => {
  delete b.rules_decks; delete b.fair_rng;
  veraBank = b;
  // the caption must show what THIS dealer actually says
  for (const [k, v] of Object.entries(b)) if (LINES[k] && v.text) LINES[k] = v.text;
}).catch(() => {});

let bankAudio = null;
// The one synced way to cut to a recorded take. Sync order matters: the VIDEO
// leads. Fetch and decode first, wait for the clip's first frame to be
// PAINTED (the engine buffers up to 24 frames between decode and paint), then
// wait that clip's measured voice delay. Only after all that may audio start.
async function cutToTake(clip, signal) {
  await engine.fetchClip(clip);
  signal.throwIfAborted();
  speaking = true;
  await new Promise((resolve, reject) => {
    const prev = engine.onPresentClip;
    let timer;
    const cleanup = () => {
      if (engine.onPresentClip === listener) engine.onPresentClip = prev;
      clearTimeout(timer); signal.removeEventListener('abort', cancelled);
    };
    const cancelled = () => { cleanup(); reject(new DOMException('Speech cancelled', 'AbortError')); };
    const request = engine.interrupt(clip);
    const listener = (key, requestId) => {
      prev?.(key, requestId);
      if (key === clip && requestId === request) { cleanup(); resolve(); }
    };
    engine.onPresentClip = listener;
    signal.addEventListener('abort', cancelled, { once: true });
    // Failure must not start an unpaired voice over a frozen/wrong take.
    timer = setTimeout(() => { cleanup(); reject(new Error('Dealer frame did not arrive')); }, 3000);
  });
  const delay = engine.index?.clips?.[clip]?.audioDelayMs
    ?? (Number(getComputedStyle(document.documentElement).getPropertyValue('--lipsync-offset')) || 0);
  if (delay > 0) await abortableDelay(delay, signal);
}

let activeSpeech = null;
async function playRecorded(id, audio, text, signal) {
  if (localPresentationEnabled) return localPresentation?.present({ type: 'speak', line: id }, { signal });
  if (greenActor || voice.muted || document.hidden || signal?.aborted) return Promise.resolve();
  if(performancePlayer?.joins)await performancePlayer.prepareSpeech(signal);
  if(voice.muted||document.hidden||signal?.aborted)return;
  const originalNative = speechMedia[DEALER.key]?.[id];
  const packed=engine.fullActor&&originalNative?actorProvenance?.nativeSpeech?.[id]:null;
  const native=packed?{...originalNative,...packed}:originalNative;
  let video,packedPlayer,faceToken;
  if (native) {
    video=document.createElement('video');
    if(!packed)video.src=native.src; video.playsInline=true; video.preload='auto'; video.volume=audio.volume;
    video.className='dealer-speech-video'; video.setAttribute('aria-hidden','true');
    video.style.visibility='hidden';
    $('#dealer-wrap').appendChild(video);
    if(packed){
      video.style.display='none';packedPlayer=packedSpeechCanvas(video,{...packed,bandY:engine.bandY});
      $('#dealer-wrap').append(packedPlayer.canvas);$('#dealer-hands-wrap').append(packedPlayer.hands);
      packedPlayer.canvas.style.visibility=packedPlayer.hands.style.visibility='hidden';
    }
    audio=video; text=native.text;
  }
  const clip = `idle-1/speak/${id}`;
  const matched = !native && engineUp && !!engine.index?.clips?.[clip];
  const correlation=nativeObservation.context();
  const observedSpeech={event:'speech',line:id,text,clip:matched?clip:null,media:native?.src??`${DEALER.base}/audio/en/${id}.mp3`,renderer:native?'embedded':matched?'indexed':'audio-only'};
  let observedSpeechStarted=false;
  const observedPlaying=()=>{observedSpeechStarted=true;nativeObservation.emit('playback',{...observedSpeech,state:'start',evidence:'media-playing'},correlation);};
  audio.addEventListener('playing',observedPlaying,{once:true});
  nativeObservation.emit('playback',{...observedSpeech,state:'selected'},correlation);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, {once:true});
  activeSpeech = controller;
  bankAudio = audio;
  voice.playing = true;
  return playSpeech({
    audio, signal: controller.signal,
    prepare: async signal => {
      if(packed)video.src=await performancePlayer.source({media:packed},signal);
      await waitForAudio(audio, signal);
      if(packed&&(video.videoWidth!==packed.width||video.videoHeight!==packed.height*2))throw new Error('Packed speech dimensions changed');
      if (matched) await cutToTake(clip, signal);
      if(tableScene?.facial)faceToken=await tableScene.prepareFacialSpeech({id,media:audio,text,kind:native?'embedded-video':'indexed-audio',audioDelayMs:native?0:(engine.index?.clips?.[clip]?.audioDelayMs??(Number(getComputedStyle(document.documentElement).getPropertyValue('--lipsync-offset'))||0))},signal);
    },
    onStart: () => {
      if(faceToken)tableScene.startFacialSpeech(faceToken);
      performancePlayer?.release();
      if(video) {
        $('#dealer-wrap').querySelectorAll('.dealer-speech-transition').forEach(node=>node.remove());
        video.style.visibility='';
        if(packedPlayer){
          packedPlayer.start();packedPlayer.canvas.style.visibility=packedPlayer.hands.style.visibility='';
          document.documentElement.classList.add('packed-speech-playing');
        }
        else if(performanceStaged)video.animate([{opacity:0},{opacity:1}],{duration:120});
      }
      clearTimeout(showCaption.t);
      $('#caption').textContent = text;
      $('#caption').classList.add('show');
      console.info('[speech] start', id, native ? 'embedded audio/video' : matched ? 'matched' : 'voice-over');
      if (matched) kfDebug.start(clip, audio);
      // Unmatched lines remain voice-over; never reuse a mouth saying other words.
    },
    onFinish: () => {
      audio.removeEventListener('playing',observedPlaying);
      nativeObservation.emit('playback',{...observedSpeech,state:audio.error?'error':observedSpeechStarted&&audio.ended?'end':'interrupted',evidence:'media-lifecycle'},correlation);
      if(faceToken)tableScene.endFacialSpeech(faceToken);
      signal?.removeEventListener('abort', cancel);
      if(video) {
        if(!packedPlayer&&performanceStaged&&video.ended&&!document.hidden&&video.videoWidth){
          const still=document.createElement('canvas');still.width=video.videoWidth;still.height=video.videoHeight;
          still.className='dealer-speech-video dealer-speech-transition';
          still.getContext('2d').drawImage(video,0,0);$('#dealer-wrap').append(still);
          still.animate([{opacity:1},{opacity:0}],{duration:180,fill:'forwards'}).finished.finally(()=>still.remove());
        }
        packedPlayer?.stop();
        if(packedPlayer&&activeSpeech===controller)document.documentElement.classList.remove('packed-speech-playing');
        video.removeAttribute('src'); video.load(); video.remove();
      }
      if (activeSpeech !== controller) return;
      activeSpeech = null;
      console.info('[speech] end', id);
      voice.playing = false; speaking = false;
      $('#caption').classList.remove('show');
      kfDebug.stop();
      if (matched && engine.presentedClip === clip) engine.interrupt(CLIP.idle);
    },
  });
}

function playNeutralTts(exactText, signal) {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance !== 'function') {
    throw new Error('Exact browser speech is unavailable');
  }
  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(exactText);
    utterance.lang = document.documentElement.lang || navigator.language || 'en';
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const abort = () => { speechSynthesis.cancel(); cleanup(); reject(new DOMException('Speech cancelled', 'AbortError')); };
    utterance.onstart = () => showCaption(exactText, Math.min(13000, 3500 + exactText.length * 70));
    utterance.onend = () => { cleanup(); $('#caption').classList.remove('show'); resolve(); };
    utterance.onerror = event => {
      cleanup(); $('#caption').classList.remove('show');
      reject(signal?.aborted ? new DOMException('Speech cancelled', 'AbortError') : new Error(event.error || 'Speech failed'));
    };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    speechSynthesis.speak(utterance);
  });
}

async function playChatDecision(decision, signal, jobId) {
  if (decision.kind === 'silence') return;
  localPresentation?.state({ speech: true, ready: false });
  updatePoseState({ dealerPose: decision.kind === 'generatedText' && !decision.speechPackage ? 'standard-idle' : 'speech',
    speechOwner: `chat-${jobId}`, idlePresented: null }, 'chat-speech-started');
  try {
    if (decision.kind === 'generatedText') {
      speaking = true;
      try {
        if (decision.visualMode === 'generated-lipsync-preview' && decision.speechPackage) {
          await playGeneratedSpeech(decision.speechPackage, { exactText: decision.exactText, dealerId: DEALER.key, mount: $('#scene'), signal,
            beforeStart: pendingChatReplies.get(jobId)?.beforeStart,
            onStart: text => {
              const pending = pendingChatReplies.get(jobId);
              if (chatStatus && pending) chatStatus.dataset.playbackMs = String(Math.round(performance.now() - pending.requestedAt));
              setChatStatus(`${DEALER.name} svarar`); showCaption(text, 27000);
            },
            onReceipt: receipt => {
              const pending=pendingChatReplies.get(jobId);if(pending)pending.playbackReceipt=receipt;
              nativeObservation.emit('playback', { event: 'speech', source: pending?.probe ? 'probe' : 'generated-lipsync', synthetic: Boolean(pending?.synthetic), ...receipt });
            },
          });
        } else await playNeutralTts(decision.exactText, signal);
      }
      finally { speaking = false; }
      return;
    }
    if (localPresentationEnabled) {
      showCaption(decision.exactText, 5000);
      nativeObservation.emit('playback', { event: 'speech', state: 'fallback', reason: 'recorded-chat-exact-text-unverified', renderer: 'text-only' });
      return;
    }
    await bankReady;
    const line = veraBank[decision.lineId];
    if (!line || line.text !== decision.exactText) throw new Error('Recorded speech package changed');
    if (astridSpeak?.has(decision.lineId)) {
      speaking = true;
      await astridSpeak.say(decision.lineId, {
        signal,
        onStart: text => showCaption(text, Math.min(13000, 3500 + text.length * 70)),
        onPresent: details => nativeObservation.emit('playback', { event: 'speech', state: 'start', line: decision.lineId,
          ...details, evidence: 'presented-frame', source: 'openclaw-chat' }),
        onFinish: () => { speaking = false; $('#caption').classList.remove('show'); },
      });
      return;
    }
    if (greenActor) throw new Error('Recorded line has no approved synchronized take in this renderer');
    const audio = new Audio(`${VERA_BANK_URL}/${decision.lineId}.mp3`); audio.volume = .95;
    await playRecorded(decision.lineId, audio, decision.exactText, signal);
  } finally {
    $('#caption').classList.remove('show');
    updatePoseState({ dealerPose: 'unknown', speechOwner: 'none', idlePresented: null }, 'chat-speech-completed');
    localPresentation?.state({ speech: false, ready: false });
    if (greenActor || engine.presentedClip === CLIP.idle) presentStandardIdle('chat-speech-return');
  }
}

function sayLine(id) {
  if(greenActor)return false;
  const line = veraBank[id];
  if (!line) return false;
  if (voice.muted) { showCaption(line.text, Math.min(13000, 3500 + line.text.length * 70)); return true; }
  speechTurn(signal => {
    const audio = new Audio(`${VERA_BANK_URL}/${id}.mp3`);
    audio.volume = .95;
    return playRecorded(id, audio, line.text, signal);
  });
  return true;
}

$('#chat-send').onclick = () => void sendChat();
$('#chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') void sendChat(); });
const astridCamera = DEALER.key === 'astrid' && localPresentationEnabled
  ? createAstridCameraControl({ container: $('#chat'), identity: () => ({ ...poseIdentity(), playerId: player?.id }),
    canStart: () => !chatBusy && !speaking && !busy,
    onActivity: () => probeClient?.activity(),
    send: ({ message, images, profileRevision }) => sendChat({ message, images, profileRevision }) }) : null;

// Memory belongs to the authenticated server player, not this tab's display log.
const chatMemory = document.createElement('details');
chatMemory.id = 'chat-memory';
const memorySummary = document.createElement('summary'); memorySummary.textContent = 'Minne';
const memoryPanel = document.createElement('div');
const memoryInfo = document.createElement('p');
memoryInfo.textContent = 'Upp till 30 chattinlägg, totalt 8 000 tecken per spelare och dealer, högst 30 dagar utan nya meddelanden. Sparade chattsvar kan ha genererats utan att spelas upp. Probes sparas först efter uppspelning. Belagda fakta har en separat livslängd på högst 30 dagar.';
const memoryStatus = document.createElement('p'); memoryStatus.setAttribute('role', 'status');
const memoryForget = document.createElement('button'); memoryForget.type = 'button'; memoryForget.textContent = 'Radera mitt minne hos denna dealer';
const memoryLimit = document.createElement('small'); memoryLimit.textContent = 'Raderar lokalt spelarchattminne, inte leverantörernas loggar. Stoppar ett pågående svar.';
memoryPanel.append(memoryInfo, memoryStatus, memoryForget, memoryLimit); chatMemory.append(memorySummary, memoryPanel); $('#chat').append(chatMemory);
chatMemory.addEventListener('toggle', async () => {
  if (!chatMemory.open) return;
  try {
    await tableReady;
    const response = await fetch(`/api/chat/memory?dealer=${encodeURIComponent(DEALER.key)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const profile = await response.json();
    memoryStatus.textContent = `${profile.history.length} sparade inlägg för ${DEALER.name}.`;
  } catch { memoryStatus.textContent = 'Minnet kunde inte läsas.'; }
});
memoryForget.onclick = async () => {
  probeClient?.cancel('memory_forgotten');
  memoryForget.disabled = true;
  try {
    const response = await fetch('/api/chat/memory/forget', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealer: DEALER.key }) });
    if (!response.ok) throw new Error();
    for (const [requestId] of pendingChatReplies) speechPoseGate.cancel(requestId, 'chat-memory-forgotten');
    chatHistory = []; $('#chat-log').replaceChildren();
    memoryStatus.textContent = 'Minnet hos denna dealer är raderat.';
  } catch { memoryStatus.textContent = 'Minnet kunde inte raderas. Försök igen.'; }
  finally { memoryForget.disabled = false; }
};

async function sendChat({ message: reviewedMessage, images = [], profileRevision = null } = {}) {
  const input = $('#chat-input');
  const message = (reviewedMessage ?? input.value).trim();
  if (!message || chatBusy) return false;
  probeClient?.activity();
  if (reviewedMessage === undefined) input.value = '';
  chatBusy = true;
  $('#chat-send').disabled = true;
  if (compactChat()) input.blur();
  const requestedAt = performance.now();
  setChatStatus('Förbereder svar…');
  if (chatStatus) { chatStatus.dataset.stages = '[]'; delete chatStatus.dataset.playbackMs; delete chatStatus.dataset.providerMetrics; chatStatus.title = ''; }
  const waitTimer = localPresentationEnabled ? setInterval(() => { chatElapsed.textContent = ` ${Math.floor((performance.now() - requestedAt) / 1000)} s`; }, 1000) : null;
  const chatCorrelation=nativeObservation.context();
  const history = chatHistory.slice(-30).map(({ role, text }) => ({ role, text }));
  const requestId = crypto.randomUUID();
  const identity = poseIdentity();
  nativeObservation.emit('chat',{role:'user',text:message,source:'openclaw-chat',contextMessages:history},chatCorrelation);
  localPresentation?.observeChat(message);
  chatLog('user', message);
  chatHistory.push({ role: 'user', text: message });
  const received = speechPoseGate.receive({ jobId: requestId, ...identity, requestFingerprint: requestId });
  const controller = new AbortController();
  pendingChatReplies.set(requestId, { correlation: chatCorrelation, message, controller, requestedAt });
  const stages = [];
  let previewRow = null;
  try {
    if (received.record.status === 'cancelled') throw new Error(received.record.reason);
    const r = await fetch('/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: localPresentationEnabled ? 'application/x-ndjson' : 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ requestId, message, history, dealer: DEALER.key,
        sessionRevision: identity.sessionRevision, roundRevision: identity.roundRevision,
        ...(images.length ? { observation: { version: 1, turnId: requestId, consentTurnId: requestId, profileRevision, images } } : {}) }),
    });
    const decision = await readChatResponse(r, progress => {
      stages.push({ stage: progress.stage, elapsedMs: progress.elapsedMs, ...(progress.metrics ? { metrics: progress.metrics } : {}) });
      if (chatStatus) {
        chatStatus.dataset.stages = JSON.stringify(stages);
        if (progress.metrics) chatStatus.dataset.providerMetrics = JSON.stringify(progress.metrics);
        chatStatus.title = stages.map(item => `${CHAT_STAGES[item.stage]} ${(item.elapsedMs / 1000).toFixed(1)} s`).join('\n');
        if (chatStatus.dataset.providerMetrics) {
          const { runpodDelayMs, runpodExecutionMs } = JSON.parse(chatStatus.dataset.providerMetrics);
          if (runpodDelayMs !== undefined) chatStatus.title += `\nRunPod-kö ${(runpodDelayMs / 1000).toFixed(1)} s`;
          if (runpodExecutionMs !== undefined) chatStatus.title += `\nRunPod-körning ${(runpodExecutionMs / 1000).toFixed(1)} s`;
        }
      }
      setChatStatus(CHAT_STAGES[progress.stage]);
      nativeObservation.emit('status', { state: 'chat-progress', requestId, stage: progress.stage, elapsedMs: progress.elapsedMs,
        ...(progress.metrics ? { metrics: progress.metrics } : {}) }, chatCorrelation);
    }, exactText => {
      previewRow = chatLog('vera', exactText, true);
      previewRow.title = 'Svarstext klar · förbereder röst och läppsynk';
      const pending = pendingChatReplies.get(requestId);
      if (pending) { pending.previewRow = previewRow; pending.previewText = exactText; }
    });
    clearInterval(waitTimer);
    setChatStatus(decision.kind === 'silence' ? '' : 'Svar klart · väntar på ledigt bord');
    if (decision.kind !== 'silence') localPresentation?.state({ ready: true });
    speechPoseGate.responseReady(requestId, decision);
    const receipt = await received.completion;
    if (receipt.status === 'failed') throw new Error(receipt.reason || 'Speech failed');
    if (receipt.status === 'cancelled') setChatStatus(chatFailureMessage(receipt.reason));
    else setChatStatus(decision.kind === 'silence' ? 'Astrid valde att inte svara på det meddelandet.' : '');
    return true;
  } catch (error) {
    if (previewRow?.classList.contains('pending')) previewRow.remove();
    const reason = speechPoseGate.get(requestId)?.reason || error.message || 'chat-failed';
    speechPoseGate.cancel(requestId, reason);
    setChatStatus(chatFailureMessage(reason));
    nativeObservation.emit('status', { state: 'chat-failed', requestId, reason }, chatCorrelation);
    return false;
  } finally {
    pendingChatReplies.delete(requestId);
    chatBusy = false;
    clearInterval(waitTimer);
    $('#chat-send').disabled = false;
  }
}

$('#gate-enter').onclick = () => {
  $('#gate').classList.add('hidden');
  voice.greeted = true;
  sfx.startAmbience();
  voice.say('greeting', { force: true })?.catch(error=>console.warn('[speak] greeting',error.message));
  // personalized follow-up once the generic voice greeting has landed
  setTimeout(() => {
    void veraEvent(`${player?.name ?? 'A player'} just sat down at your table with a balance of ${fmt(balance)}. Greet them by name.`, { minGap: 0 });
  }, 5000);
};

$('#all-sides').onclick = () => {
  allSides = !allSides;
  $('#all-sides').classList.toggle('on', allSides);
};

function setTable(id) {
  const next = TABLES.find(x => x.id === id);
  if (!next || next === table || round || busy) return;
  // a different table can mean a different dealer in a different room
  if ((next.dealer ?? 'vera') !== DEALER.key) {
    const q = new URLSearchParams({ dealer: next.dealer ?? 'vera', table: id });
    for (const key of ['labObserverOrigin','labObserverChannel']) {
      const value=new URLSearchParams(location.search).get(key);if(value)q.set(key,value);
    }
    location.search = q.toString();
    return;
  }
  table = next; CHIPS = table.chips;
  bets = bets.map(() => ({ main: 0, pp: 0, tp: 0 }));   // old stakes are off-limits here
  undoStack = [];
  buildChips();
  document.querySelectorAll('#table-pick .tbl').forEach(b => b.classList.toggle('on', b.dataset.id === id));
  $('#limits').textContent = `${fmt(table.min)} \u2013 ${fmt(table.max)}`;
  hint(table.name, balance < table.min
    ? `min is ${fmt(table.min)} — add funds to play here`
    : `${fmt(table.min)} to ${fmt(table.max)} a box`);
  renderBets();
}
document.querySelectorAll('#table-pick .tbl').forEach(b => { b.onclick = () => setTable(b.dataset.id); });

// Dealer tables are available in the main controls, without a rehearsal URL.
for (const dealer of Object.values(DEALERS)) {
  const button = document.createElement('button');
  button.type = 'button'; button.dataset.dealer = dealer.key;
  button.setAttribute('aria-label', `${dealer.name}'s table`);
  button.setAttribute('aria-pressed', String(dealer.key === DEALER.key));
  const portrait = document.createElement('img'); portrait.src = `${dealer.base}/poster.jpg`; portrait.alt = '';
  const name = document.createElement('span'); name.textContent = dealer.name;
  button.append(portrait, name);
  button.onclick = () => {
    if (dealer.key === DEALER.key) return;
    if (round || busy) {
      $('#dealer-switch-status').textContent = 'Finish this round to change tables.';
      return;
    }
    const query = new URLSearchParams(location.search);
    query.set('dealer', dealer.key); query.delete('table');
    location.search = query.toString();
  };
  $('#dealer-options').appendChild(button);
}
installDealerVersionSwitcher({ dealer: DEALER.key, version: dealerV2Route ? 'v2' : 'original', isBusy: () => !!round || busy });


buildChips();
// arriving via a dealer switch: land on the tier that was picked
{
  const wanted = new URLSearchParams(location.search).get('table');
  const t = wanted && TABLES.find(x => x.id === wanted);
  if (t && (t.dealer ?? 'vera') === DEALER.key && t !== table) {
    table = t; CHIPS = table.chips; buildChips();
    document.querySelectorAll('#table-pick .tbl').forEach(b => b.classList.toggle('on', b.dataset.id === t.id));
  }
}
$('#limits').textContent = `${fmt(table.min)} \u2013 ${fmt(table.max)}`;
// calibration overlay: applies any saved tweaks, then lies dormant until `C`
import('./calibrate.mjs').then(m => { m.applySavedSeats?.(); if (m.applySaved()) layoutSeats(); }).catch(() => {});

// ---------- floor supervisor ----------
// Kevin walks the pit: he looks in between rounds, never mid-hand, on a loose
// schedule plus straight after an unusually large payout - which is exactly
// when a real pit boss appears.
let roundsSinceLook = 0, nextLookAfter = 4 + Math.floor(Math.random() * 4);
const supEl = $('#supervisor');
let supBusy = false;
function supervisorMayLook({ force = false } = {}) {
  if (localPresentationEnabled) return false;
  if (round || busy || supBusy || !supEl) return false;
  if (!force && ++roundsSinceLook < nextLookAfter) return false;
  roundsSinceLook = 0;
  nextLookAfter = 4 + Math.floor(Math.random() * 4);
  supBusy = true;
  supEl.currentTime = 0;
  supEl.classList.add('show');
  const done = () => {
    supEl.classList.remove('show');
    supBusy = false;
    setTimeout(() => { try { supEl.pause(); } catch { /* ignore */ } }, 600);
  };
  supEl.onended = done;
  clearTimeout(supervisorMayLook.t);
  supervisorMayLook.t = setTimeout(done, 12000);   // safety if 'ended' never fires
  supEl.play().catch(done);
  showCaption(force
    ? 'Floor supervisor checking the table.'
    : 'Floor supervisor on his rounds.', 4200);
  return true;
}

// Call him over on demand. Warm the clip first so the first press does not
// sit on a cold 1.2MB fetch and look like nothing happened.
const pitBtn = $('#pitboss');
if (pitBtn) {
  // the cutout is a normal <video>; preload="auto" already warms it
  pitBtn.onclick = () => {
    if (round || busy) { hint('PIT BOSS', 'he waits for the hand to finish'); return; }
    pitBtn.disabled = true;
    const ok = supervisorMayLook({ force: true });
    if (!ok) hint('PIT BOSS', 'he is already at the table');
    setTimeout(() => { pitBtn.disabled = false; }, 9000);
  };
}

// QA hook: lets a test drive the table without playing 20 rounds first
window.__croupier = { engine, CLIP, supervisorMayLook, supEl, sayLine, veraBank, speechPoseGate,
  get round() { return round; } };

renderBets();
setBanner('PLEASE PLACE BETS');
// prepareTable loads the player before opening the server-owned table.


// Optional rehearsal uses the exact in-game playback path, with no generation
// or chat request. This lets every dealer and recorded line be checked locally.
if ((!greenActor||astridSpeak)&&new URLSearchParams(location.search).has('rehearsal')) {
  const panel = document.createElement('details'); panel.id = 'rehearsal'; panel.open = true;
  panel.addEventListener('toggle', () => { if(round&&!busy)activeBoxHighlight(); });
  panel.innerHTML = `<summary>Dealer rehearsal</summary>
    <label>Dealer<select id="rehearsal-dealer" aria-label="Rehearsal dealer"></select></label>
    <label>Recorded line<select id="rehearsal-line" aria-label="Recorded line"></select></label>
    <p id="rehearsal-status" aria-live="polite">Choose a line to review.</p>
    <button id="rehearsal-play">Play line</button><button id="rehearsal-repeat">Play twice</button>`;
  $('#scene').appendChild(panel);
  const dealerSelect = panel.querySelector('#rehearsal-dealer');
  for (const d of Object.values(DEALERS)) dealerSelect.add(new Option(d.name, d.key));
  dealerSelect.value = DEALER.key;
  dealerSelect.onchange = () => { location.href = `?dealer=${dealerSelect.value}&rehearsal=1`; };
  const lineSelect = panel.querySelector('#rehearsal-line');
  const bank = await fetch(`${DEALER.base}/audio/en/bank.json`).then(r => r.json());
  for (const id of new Set([...VOICE_LINES, ...Object.keys(bank)])) {
    if (astridSpeak&&!astridSpeak.has(id)) continue;
    if (voice.dead.has(id) && !bank[id]) continue;
    lineSelect.add(new Option(id.replaceAll('_', ' '), id));
  }
  const status = panel.querySelector('#rehearsal-status');
  const update = () => {
    const id = lineSelect.value;
    const matched = !!engine.index?.clips?.[`idle-1/speak/${id}`];
    const native=speechMedia[DEALER.key]?.[id];
    status.textContent = (astridSpeak?.text(id) ?? native?.text ?? bank[id]?.text ?? LINES[id] ?? id) + (astridSpeak?.has(id) ? ' — green-screen take used in gameplay.' : native ? ' — video with embedded audio.' : matched ? ' — matching clip available.' : ' — voice only; matching clip missing.');
  };
  lineSelect.onchange = update; update();
  const play = async () => {
    const id = lineSelect.value;
    setMuted(false);
    if (astridSpeak?.has(id)) return voice.say(id,{force:true});
    return speechTurn(signal => playRecorded(id, new Audio(`${DEALER.base}/audio/en/${id}.mp3`), bank[id]?.text ?? LINES[id] ?? id, signal));
  };
  const review = async count => {
    const controls=[...panel.querySelectorAll('button,select')];
    controls.forEach(control=>control.disabled=true);
    try { for(let i=0;i<count;i++){
      // The first gesture can unlock the automatic greeting. Queue the
      // requested review behind it instead of silently dropping both plays.
      while(speaking)await new Promise(resolve=>setTimeout(resolve,50));
      await play();
    } }
    catch(error){status.textContent=`Playback failed: ${error.message}`;}
    finally{controls.forEach(control=>control.disabled=false);}
  };
  panel.querySelector('#rehearsal-play').onclick = () => review(1);
  panel.querySelector('#rehearsal-repeat').onclick = () => review(2);
  if (DEALER.key === 'astrid'&&!astridRestart) {
    const { installPerformanceAuthoring } = await import('./performance-authoring.mjs');
    installPerformanceAuthoring({panel,tableScene});
    if(performanceStaged){const stage=document.createElement('div');stage.id='performance-stage-banner';stage.textContent='ASTRID · STAGED GAMEPLAY';$('#scene').append(stage);
      const status=document.createElement('p');status.id='performance-status';
      status.textContent=performanceManifest?.summary??'Contact capture is not approved. Existing gameplay remains available.';panel.append(status);}
  }
}

const tableReady = prepareTable().catch(e=>{ tableError(e); throw e; });
tableReady.catch(()=>{});
if (localPresentationEnabled) tableReady.then(async () => {
  const { installLissabonProfileUi } = await import('./lissabon-profile.mjs');
  await installLissabonProfileUi({ canSwitch: () => !round && !busy && !chatBusy, beforeSwitch: () => astridCamera?.stop('Profilbyte · Av') });
}).catch(error => console.warn('[Lissabon profile]', error.message));
// The guest table has no entry gate. Astrid greets once her table is ready;
// when the browser refuses autoplay, the greeting waits for the first gesture.
if(astridSpeak)tableReady.then(()=>{
  const greet=()=>{voice.greeted=true;return voice.say('greeting',{force:true});};
  return Promise.resolve(greet()).catch(error=>{
    console.info('[speak] greeting deferred to the first gesture:',error.message);
    const once=()=>{removeEventListener('pointerdown',once);removeEventListener('keydown',once);greet()?.catch(e=>console.warn('[speak] greeting',e.message));};
    addEventListener('pointerdown',once);addEventListener('keydown',once);
  });
}).catch(()=>{});

document.querySelector('#sign-out').onclick=async()=>{astridCamera?.stop('Utloggad · Av');await api('/api/auth/logout',{});location.reload();};

// Separate explicit chat capability for the bound local lab. It cannot issue
// table commands or supply cards/identity. Only this authenticated native server
// produces the response; the lab owns its own presentation/standard-idle gate.
const labSpeechBridge = createNativeSpeechBridge({ href: location.href, opener: window.opener,
  loadMedia: loadGeneratedSpeech,
  onSubmit: async ({ requestId, text, signal }) => {
    if (chatBusy) throw new Error('A chat request is already active');
    await tableReady;
    if (signal.aborted) return;
    if (chatBusy) throw new Error('A chat request is already active');
    chatBusy = true;
    const identity = poseIdentity();
    nativeObservation.emit('chat', { role: 'user', text, source: 'linked-lab-chat', requestId });
    try {
      const response = await fetch('/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
        body: JSON.stringify({ requestId, message: text, history: [], dealer: DEALER.key,
          sessionRevision: identity.sessionRevision, roundRevision: identity.roundRevision }),
      });
      if (!response.ok) throw new Error('Linked chat unavailable');
      const decision = await response.json();
      const current = poseIdentity();
      if (signal.aborted || current.dealerId !== identity.dealerId || current.sessionRevision !== identity.sessionRevision || current.roundRevision !== identity.roundRevision) throw new Error('Stale linked chat');
      await labSpeechBridge.ready(decision);
    } finally { chatBusy = false; }
  },
});
window.addEventListener('message', event => labSpeechBridge.accept(event));
window.addEventListener('pagehide', () => labSpeechBridge.close(), { once: true });

if (DEALER.key === 'astrid') {
  await tableReady;
  probeClient = createProbeClient({
    identity: poseIdentity,
    flags: ownJobId => ({ present: !document.hidden, sound: !voice.muted,
      // Focus already starts a fresh inactivity period. An empty field must
      // not veto every later initiative just because focus remained after Send.
      typing: Boolean($('#chat-input').value.trim()) || Boolean(astridCamera?.busy),
      quiet: probePresentationQuiet({busy,round,chatBusy,speaking,pending:speechQueue.pending,gate:speechPoseGate,ownJobId,idleBackground:localPresentation?.idleBackground}) }),
    mount: memoryPanel,
    report: ({state,...entry}) => nativeObservation.emit('status', { ...entry, state:'probe', stage:state }),
    cancelDelivery: (id,reason) => speechPoseGate.cancel(id,reason),
    deliver: async (decision, options) => {
      const id=decision.requestId;
      const received=speechPoseGate.receive({jobId:id,...poseIdentity(),requestFingerprint:id});
      const pending={...options,probe:true,correlation:nativeObservation.context(),requestedAt:performance.now(),playbackReceipt:null};
      pendingChatReplies.set(id,pending);
      try {
        localPresentation?.state({ ready: true });
        speechPoseGate.responseReady(id,decision);
        const result=await received.completion;
        return {...result,playback:pending.playbackReceipt};
      }finally{pendingChatReplies.delete(id);if(!pendingChatReplies.size)localPresentation?.state({ready:false});}
    },
  });
  $('#chat-input').addEventListener('input',()=>probeClient.activity());
  $('#chat-input').addEventListener('focus',()=>probeClient.activity());
  $('#chat-input').addEventListener('blur',()=>void probeClient.refresh());
  window.addEventListener('pagehide',()=>probeClient.close(),{once:true});
  const params=new URLSearchParams(location.search);
  if(params.has('probeCase') && ['127.0.0.1','localhost','[::1]'].includes(location.hostname)) {
    const trial=document.createElement('details');trial.open=true;
    const title=document.createElement('summary');title.textContent='Probe · syntetiskt talprov';
    const description=document.createElement('p');description.textContent='Provet använder en påhittad spelare och skapar Victoria-ljud och läppsynkvideo. Inga provminnen sparas hos din profil. Avsluta handen och aktivera ljudet först.';
    const play=document.createElement('button');play.type='button';play.textContent='Generera och spela ett talprov';
    play.onclick=async()=>{play.disabled=true;try{await probeClient.test({caseId:params.get('probeCase'),model:params.get('probeModel')??'gateway-default'});}finally{play.disabled=false;}};
    trial.append(title,description,play);memoryPanel.append(trial);chatMemory.open=true;
  }
}
