import {TH_DEFAULTS,TH_VALUES,th,thChips} from './presentation-theme.js';
let theme=TH_DEFAULTS.scout;
export const getTheme=()=>theme;
export const suitColor=s=>theme.faces==='four'?({'♠':'#171B1B','♥':'#C0262D','♦':'#1F5FD1','♣':'#1E7A45'}[s]):['♥','♦'].includes(s)?'#AE2025':'#171B1B';
export function cardBackNodes(node,w,h){
 const t=theme,a=[node('rect',{x:-w/2,y:-h/2,width:w,height:h,rx:3,fill:t.cardBack,stroke:t.cardAccent,'stroke-width':.7})];
 if(['border','monogram'].includes(t.cardPattern))a.push(node('rect',{x:-w/2+6,y:-h/2+6,width:w-12,height:h-12,rx:2,fill:'none',stroke:t.cardAccent,'stroke-width':1.5}));
 if(t.cardPattern==='lines')for(let i=0;i<7;i++)a.push(node('line',{x1:-w/2+7+i*8,y1:-h/2+7,x2:-w/2+7+i*8,y2:h/2-7,stroke:t.cardAccent,'stroke-opacity':.35}));
 if(t.cardPattern==='monogram')a.push(node('text',{y:10,'text-anchor':'middle','font-size':30,fill:t.cardAccent},t.wordmark.trim().slice(0,1).toUpperCase()));
 if(t.cardPattern==='logo'&&(t.cardLogo||t.logo))a.push(node('image',{href:t.cardLogo||t.logo,x:-20,y:-20,width:40,height:40,preserveAspectRatio:'xMidYMid meet'}));
 return a;
}
export function createThemeBoundary(apply){
 let next=null,revision=null,state=null;
 const flush=()=>{if(next&&state?.phase==='bets'&&next.revision!==revision){apply(next);revision=next.revision;next=null;}};
 return {offer(value){next=value;flush();},state(value){state=value;flush();},pending:()=>Boolean(next&&next.revision!==revision)};
}
const $=s=>document.querySelector(s);
const node=(tag,attrs={},text)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
function applyDesign(design){
 theme={...TH_DEFAULTS[design.brand],...design.theme};
 try{sessionStorage.setItem('astrid-presentation:'+new URLSearchParams(location.search).get('session'),JSON.stringify(design));}catch{}
 const root=document.documentElement.style;
 for(const k of ['primary','surface','text','accent','secondary'])root.setProperty('--design-'+k,theme[k]);
 root.setProperty('--design-on-primary',th.on(theme.primary));root.setProperty('--design-on-secondary',th.on(theme.secondary));
 root.setProperty('--design-font',`'${theme.font}', sans-serif`);root.setProperty('--design-radius',({pill:20,rounded:8,square:3})[theme.radius]+'px');
 const id='game-font-'+theme.font.replaceAll(' ','');if(!document.getElementById(id)){const l=document.createElement('link');l.id=id;l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family='+encodeURIComponent(theme.font)+':wght@400;500;600;700&display=swap';document.head.append(l);}
 themeChips();
 $('#brandWordmark').textContent=theme.wordmark;const logo=$('.brand-name img');logo.src=theme.logo||'/brand/scout-mark.svg';
 $('#presentationBrand').value=design.brand;document.documentElement.dataset.presentationRevision=design.revision;
 document.documentElement.dataset.brand=design.brand;
 window.dispatchEvent(new CustomEvent('game-presentation',{detail:design}));
 $('#presentationStatus').textContent=design.local?'Default theme · BO connection unavailable':'Published design applied';
}
// Chips outside the theme's six denominations (Table Studio's Casual and High Roller racks) keep the
// studio's colours in the same drawing.
const EXTRA_CHIPS={1:{fill:'#e8e2d4',rim:'#5a554c',text:'#1c1a16'},1000:{fill:'#d6b46a',rim:'#fff5da',text:'#201c13'},5000:{fill:'#2f6496',rim:'#eee8da',text:'#ffffff'},
 10000:{fill:'#9a3443',rim:'#eee8da',text:'#ffffff'},25000:{fill:'#26282c',rim:'#dbc18a',text:'#dbc18a'}};
export const chipLabel=v=>v>=1000?`${v/1000}K`:String(v);
// Draws every chip in the rack and colours the wager stacks; runs again when the rack is rebuilt.
export function themeChips(){
 const root=document.documentElement.style,chips=thChips(theme);let css='';
 const values=[...new Set([...TH_VALUES,...[...document.querySelectorAll('.chip-picker [data-chip]')].map(b=>Number(b.dataset.chip))])];
 for(const v of values){const c=chips[v]??EXTRA_CHIPS[v];if(!c)continue;root.setProperty(`--chip-${v}-ink`,c.text);
  css+=`.chip-stack-layer[data-denomination="${v}"]{--chip-color:${c.fill};--chip-shade:${c.fill};--chip-rim:${c.rim};--chip-ink:${c.text}}\n`;
  const button=$(`.chip-picker [data-chip="${v}"]`);if(!button)continue;const label=chipLabel(v);
  const svg=node('svg',{viewBox:'-22 -22 44 44','aria-hidden':'true'});svg.append(node('circle',{r:21.5,fill:c.fill,stroke:th.lum(c.fill)<.2?'#f2f1ed77':'#0a0b0d59','stroke-width':1}));
  for(const a of [0,60,120,180,240,300])svg.append(node('rect',{x:-3,y:-21.5,width:6,height:7,rx:1,fill:c.rim,transform:`rotate(${a})`}));
  svg.append(node('circle',{r:14,fill:'none',stroke:c.rim,'stroke-opacity':.45}),node('text',{y:4.5,'text-anchor':'middle','font-weight':700,'font-size':label.length>2?11:13,fill:c.text},label));button.replaceChildren(svg);
 }
 let style=$('#chipTheme');if(!style){style=document.createElement('style');style.id='chipTheme';document.head.append(style);}style.textContent=css;
}
let boundary,brand='scout',request=0,knownRevision='';
export function presentationState(state){boundary?.state(state);}
export function initPresentation(){
 brand=new URLSearchParams(location.search).get('brand')||'scout';if(!TH_DEFAULTS[brand])brand='scout';
 boundary=createThemeBoundary(applyDesign);
 let initial={brand,theme:TH_DEFAULTS[brand],revision:'default-'+brand,local:true};
 try{const saved=JSON.parse(sessionStorage.getItem('astrid-presentation:'+new URLSearchParams(location.search).get('session')));if(saved&&TH_DEFAULTS[saved.brand])initial=saved;}catch{}
 applyDesign(initial);

 const refresh=async()=>{const id=++request;try{const r=await fetch('/api/presentation?brand='+encodeURIComponent(brand),{cache:'no-store',headers:knownRevision?{'If-None-Match':'"'+knownRevision+'"'}:{}});if(r.status===304)return;if(!r.ok)throw Error();const d=await r.json();if(id!==request)return;knownRevision=d.revision;boundary.offer(d);if(boundary.pending())$('#presentationStatus').textContent='Published design ready · applies next round';}catch{if(id===request)$('#presentationStatus').textContent='BO connection unavailable · keeping current design';}};
 $('#presentationBrand').addEventListener('change',e=>{brand=e.target.value;const u=new URL(location.href);u.searchParams.set('brand',brand);history.replaceState(null,'',u);void refresh();});
 void refresh();setInterval(()=>{if(!document.hidden)void refresh();},5000);
}
