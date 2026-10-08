// Phones: the side panel (chat, roster, Demo information) grows up from the bottom and used to cover
// the chips and the Deal/Undo/Repeat buttons while open (tester feedback #6). Its top now stops below
// the game controls; below the balance row too when there is room. The panel scrolls inside itself.
const side=document.querySelector('aside.side');
const controls=document.querySelector('#gameControls');
const wallet=document.querySelector('.table-wallet');
const phone=matchMedia('(max-width: 820px)');
const MIN_WITH_WALLET=220;
// Only write when something changes: classList.add() re-sets the attribute even when the class is
// already there, which would re-trigger the class observer below forever.
function apply(max){const on=max!=='';if(side.style.maxHeight!==max)side.style.maxHeight=max;if(side.classList.contains('dock-fit')!==on)side.classList.toggle('dock-fit',on);}
function bottomOf(el){if(!el||el.hidden||!el.offsetParent)return 0;return el.getBoundingClientRect().bottom;}
function fit(){
  if(!side)return;
  if(!phone.matches){apply('');return;}
  const ctl=bottomOf(controls),wal=bottomOf(wallet);
  const belowWallet=innerHeight-wal-8;
  const top=wal&&belowWallet>=MIN_WITH_WALLET?wal:ctl;
  if(!top){apply('');return;}
  apply(`${Math.max(120,Math.floor(innerHeight-top-8))}px`);
}
if(side&&controls){
  const ro=new ResizeObserver(fit);ro.observe(controls);if(wallet)ro.observe(wallet);ro.observe(side);
  new MutationObserver(fit).observe(side,{attributes:true,attributeFilter:['class']});
  new MutationObserver(fit).observe(controls,{attributes:true,attributeFilter:['hidden']});
  addEventListener('resize',fit);phone.addEventListener?.('change',fit);fit();
}
