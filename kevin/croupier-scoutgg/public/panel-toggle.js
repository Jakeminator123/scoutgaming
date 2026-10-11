// The side panel (players, chat, info) can be closed completely and reopened from a small button
// (tester feedback: many players have no interest in chat). The choice is remembered per browser.
const app=document.querySelector('.app'),head=document.querySelector('.side-head');
if(app&&head){
  const KEY='croupier-panel-closed';
  const hide=document.createElement('button');hide.type='button';hide.id='hidePanel';hide.className='ghost panel-hide';hide.title='Close chat';hide.textContent='Close chat';   // a bare × read as nothing (Emil)
  const show=document.createElement('button');show.type='button';show.id='showPanel';show.className='panel-show';show.textContent='Chat & table';show.hidden=true;
  head.append(hide);app.append(show);
  const set=closed=>{app.classList.toggle('panel-closed',closed);show.hidden=!closed;try{localStorage.setItem(KEY,closed?'1':'0');}catch{}dispatchEvent(new Event('resize'));};
  hide.addEventListener('click',()=>{set(true);show.focus();});
  show.addEventListener('click',()=>{set(false);hide.focus();});
  let saved=false;try{saved=localStorage.getItem(KEY)==='1';}catch{}
  if(saved)set(true);
}
