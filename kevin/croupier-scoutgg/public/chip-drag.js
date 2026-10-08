// CH: "open a box by simply dragging my stake into it - as you do at a real table". Drag a chip
// from the chip row onto any box: it selects that chip and bets on the box, the same as a tap.
// A free box is opened for a seated player by the server. A short tap on a chip still only selects it.
let drag=null;
document.addEventListener('pointerdown',e=>{
  const chip=e.target.closest?.('[data-chip]');
  if(!chip||chip.disabled||e.button>0)return;
  drag={chip,x:e.clientX,y:e.clientY,ghost:null,id:e.pointerId};
});
document.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  if(!drag.ghost){
    if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<8)return;
    // the chip's look lives under .chip-picker, so the floating copy goes inside one
    const r=drag.chip.getBoundingClientRect(),g=document.createElement('div');
    g.className=drag.chip.parentElement.className;g.setAttribute('aria-hidden','true');
    Object.assign(g.style,{position:'fixed',zIndex:50,pointerEvents:'none',transform:'translate(-50%,-50%) scale(1.1)',opacity:'.92',margin:0,padding:0,background:'none',border:0,boxShadow:'none',width:`${r.width}px`,height:`${r.height}px`});
    const c=drag.chip.cloneNode(true);c.removeAttribute('id');Object.assign(c.style,{width:`${r.width}px`,height:`${r.height}px`,margin:0});
    g.append(c);document.body.append(g);drag.ghost=g;
  }
  drag.ghost.style.left=`${e.clientX}px`;drag.ghost.style.top=`${e.clientY}px`;
  e.preventDefault();
},{passive:false});
function end(e){
  if(!drag||e.pointerId!==drag.id)return;
  const {chip,ghost}=drag;drag=null;
  if(!ghost)return;   // a tap: the chip button's own click selects it
  ghost.remove();
  const box=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('[data-deal-id]');
  const target=box?.querySelector('.main-bet')??box;
  if(!target)return;
  chip.click();
  target.dispatchEvent(new MouseEvent('click',{bubbles:true}));
}
document.addEventListener('pointerup',end);
document.addEventListener('pointercancel',e=>{if(drag?.ghost)drag.ghost.remove();drag=null;});
