// Settings closes like a normal panel (tester feedback 8 Oct): a close button, Escape, a tap outside,
// and a downward swipe on touch screens. Before this the only way out was pressing Settings again.
const panel=document.querySelector('details.audio-settings');
const pop=panel?.querySelector('.settings-popover');
if(panel&&pop){
  const close=()=>{panel.open=false;};
  const btn=document.createElement('button');
  btn.type='button';btn.className='settings-close';btn.setAttribute('aria-label','Close settings');btn.textContent='×';
  btn.addEventListener('click',close);
  pop.prepend(btn);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.open)close();});
  document.addEventListener('pointerdown',e=>{if(panel.open&&!panel.contains(e.target))close();});
  let y0=null;
  pop.addEventListener('touchstart',e=>{y0=pop.scrollTop<=0?e.touches[0].clientY:null;},{passive:true});
  pop.addEventListener('touchend',e=>{if(y0!==null&&e.changedTouches[0].clientY-y0>60)close();y0=null;},{passive:true});
}
