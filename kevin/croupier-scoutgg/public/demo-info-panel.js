// Demo information opens inside the side panel, in place of the chat log, instead of a new tab
// (tester feedback 8 Oct). The link keeps working as a plain page when scripts do not run.
const link=document.querySelector('a[href="/demo-information.html"]');
const log=document.querySelector('#log');
if(link&&log){
  const panel=document.createElement('section');
  panel.id='demoInfo';panel.className='demo-info';panel.hidden=true;panel.setAttribute('aria-label','Demo information');
  const close=document.createElement('button');
  close.type='button';close.className='ghost demo-info-close';close.textContent='Back to chat';
  const body=document.createElement('div');body.className='demo-info-body';
  panel.append(close,body);log.before(panel);
  link.setAttribute('role','button');link.setAttribute('aria-expanded','false');link.setAttribute('aria-controls','demoInfo');
  let loaded=false;
  const show=async open=>{
    if(open&&!loaded){
      try{
        const html=await (await fetch(link.getAttribute('href'))).text();
        const main=new DOMParser().parseFromString(html,'text/html').querySelector('main');
        if(!main)throw new Error('no content');
        main.querySelectorAll('a[href="/"]').forEach(x=>x.remove());   // the page's own 'back' link has no job here
        body.replaceChildren(...main.childNodes);loaded=true;
      }catch{location.href=link.href;return;}   // fall back to the page itself
    }
    panel.hidden=!open;log.hidden=open;link.setAttribute('aria-expanded',String(open));
    if(open)close.focus();
  };
  link.addEventListener('click',e=>{e.preventDefault();show(panel.hidden);});
  close.addEventListener('click',()=>{show(false);link.focus();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)show(false);});
}
