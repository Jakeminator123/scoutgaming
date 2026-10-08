import {createGameCards} from '/game-cards.js';
import {createTableBoxes} from '/table-boxes.js';
import {DEAL_CONTACT,SLIDE_SECONDS} from '/card-table-layout.js';
import {firstFaceTime} from '/card-face-projection.js';
const $=s=>document.querySelector(s),film=$('#film');
const manifest=await(await fetch('/media/manifest.json')).json();
const cards=createGameCards($('#cards'),manifest);
const boxes=createTableBoxes($('#boxes'),manifest,()=>{});boxes.setEnabled(false);
let round,draw,seat,track,backgroundDraws=[];
function update(t){
 const visible=new Set([...backgroundDraws,...Array.from({length:draw-1},(_,i)=>i+1)]);
 if(track==='flip'||t+1e-6>=firstFaceTime(track))visible.add(draw);
 cards.advanceDeal(t);cards.render(round,visible,track==='flip'?t>=firstFaceTime('flip'):track==='hole'?false:!$('#hole').checked,0);
 $('#scrub').value=Math.floor(t*24+1e-5);
 $('#frame').textContent=`${t.toFixed(3)} s · bildruta ${Math.floor(t*24+1e-5)} · kontakt ${DEAL_CONTACT[track].contact.toFixed(3)} s`;
}
function setup(){
 film.pause();track=$('#seat').value;seat=['hole','flip'].includes(track)?'dealer':track;draw=['hole','flip'].includes(track)?2:Number($('#count').value);
 const hand=Array.from({length:draw},(_,i)=>({r:['4','7','2','3','A','2'][i],s:['♣','♥','♠','♦','♣','♥'][i],shoeDraw:i+1}));
 round={phase:'decisions',active:0, dealer:seat==='dealer'?hand:[],holeDraw:null,hands:seat==='dealer'?[]:[{box:Number(seat)-1,cards:hand}]};
 if(seat==='dealer' && ($('#hole').checked||['hole','flip'].includes(track))) round.holeDraw=draw;
 backgroundDraws=[];
 if($('#neighbors').checked){
  const chosen=Number(seat)-1;
  round.hands=Array.from({length:7},(_,box)=>{
   if(box===chosen)return {box,cards:hand};
   const cards=hand.map((card,i)=>({...card,shoeDraw:100+box*10+i}));
   backgroundDraws.push(...cards.map(c=>c.shoeDraw));return {box,cards};
  });
 }
 const id=['hole','flip'].includes(track)?'deal_'+track:'deal_pos'+seat;
 const anchor=manifest.deal.find(c=>c.id===id).kort;
 $('main').style.setProperty('--cx',`${anchor.cx/1080*100}%`);$('main').style.setProperty('--cy',`${anchor.cy/1920*100}%`);
 cards.sourceStarted(id);cards.beginDeal(seat,draw,track);
 boxes.setBets(Array.from({length:7},(_,i)=>({main:i===Number(seat)-1?5:0})));
 film.src=manifest.deal.find(c=>c.id===id).url;update(0);
}
function tick(_n,f){update(f.mediaTime);film.requestVideoFrameCallback(tick)}
film.requestVideoFrameCallback(tick);film.addEventListener('seeked',()=>update(film.currentTime));
$('#seat').onchange=$('#count').onchange=$('#neighbors').onchange=$('#hole').onchange=setup;
$('#step').onclick=()=>{film.pause();film.currentTime=(Math.floor(film.currentTime*24+1e-5)+1.5)/24};
$('#scrub').oninput=()=>{film.pause();film.currentTime=(Number($('#scrub').value)+.5)/24};
film.onloadedmetadata=()=>{$('#scrub').max=Math.round(film.duration*24)-1};
$('#detail').onchange=()=>{$('main').classList.toggle('detail',$('#detail').checked)};
$('#speed').onchange=()=>{film.playbackRate=Number($('#speed').value)};
$('#play').onclick=()=>{film.currentTime=0;film.play()};$('#pause').onclick=()=>film.pause();
for(const b of document.querySelectorAll('[data-check]'))b.onclick=()=>{film.pause();const c=DEAL_CONTACT[track];film.currentTime={before:c.contact-.08,contact:c.contact,middle:c.contact+SLIDE_SECONDS/2,white:firstFaceTime(track),whiteNext:firstFaceTime(track)+1/24,clear:c.clear,after:c.contact+SLIDE_SECONDS+.08}[b.dataset.check]+.5/24};
setup();
