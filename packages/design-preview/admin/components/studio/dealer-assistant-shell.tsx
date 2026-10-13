import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUpRight, MessageCircle, Minus } from 'lucide-react';
import { DealerImportAssistant } from './dealer-import-assistant';

// One mounted session moves between an inline, nonmodal dialog and the drawer.
// Changing presentation never clones files, aborts uploads or creates a second writer.
export function DealerAssistantShell({pageAvailable,onShowPage}:{pageAvailable:boolean;onShowPage:()=>boolean|void}) {
  const [drawerOpen,setDrawerOpen] = useState(false);
  const [started,setStarted] = useState(pageAvailable);
  const [busy,setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), launcher = useRef<HTMLButtonElement>(null), close = useRef<HTMLButtonElement>(null);
  const previousModal = useRef(false);
  const inline = pageAvailable && !drawerOpen;
  useEffect(()=>{if(pageAvailable)setStarted(true);},[pageAvailable]);
  useLayoutEffect(()=>{
    const element=dialog.current;if(!element)return;
    element.querySelectorAll('video,audio').forEach(media=>(media as HTMLMediaElement).pause());
    const wasModal=previousModal.current;
    if(element.open)element.close();
    if(drawerOpen){element.showModal();close.current?.focus();}
    else if(inline)element.setAttribute('open','');
    if(wasModal&&!drawerOpen)launcher.current?.focus();
    previousModal.current=drawerOpen;
  },[inline,drawerOpen]);
  function pausePreviews(){dialog.current?.querySelectorAll('video,audio').forEach(media=>(media as HTMLMediaElement).pause());}
  function minimize(){pausePreviews();setDrawerOpen(false);}
  function open(){setStarted(true);setDrawerOpen(true);}
  function showPage(){if(busy||onShowPage()===false)return;pausePreviews();setDrawerOpen(false);}
  function scrollTo(selector:string){dialog.current?.querySelector(selector)?.scrollIntoView({block:'start',behavior:'instant'});}
  function trapTab(event:KeyboardEvent<HTMLDialogElement>) {
    if(!drawerOpen||event.key!=='Tab')return;
    const targets=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]'))
      .filter(element=>element.getClientRects().length>0&&!element.closest('[hidden]'));
    const first=targets[0],last=targets.at(-1);
    if(!first){event.preventDefault();close.current?.focus();return;}
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  return <>
    {pageAvailable&&drawerOpen&&<div className="dealer-assistant-placeholder"><MessageCircle size={20}/><p>Importassistenten är öppen i panelen. Samma filer och samtal följer med.</p><button onClick={minimize}>Visa på sidan</button></div>}
    <dialog ref={dialog} id="studio-assistant-dialog" className={`dealer-assistant-dialog ${inline?'is-inline':'is-drawer'}`}
      aria-labelledby={drawerOpen?'studio-assistant-dialog-title':'dealer-import-title'} aria-modal={drawerOpen?true:undefined}
      role={inline?'region':'dialog'} onKeyDown={trapTab} onCancel={event=>{event.preventDefault();minimize();}}
      onClick={event=>{if(drawerOpen&&event.target===event.currentTarget)minimize();}}>
      <header className="dealer-assistant-drawer-header" hidden={!drawerOpen}>
        <div><MessageCircle size={18}/><h2 id="studio-assistant-dialog-title">Studioassistent</h2><span>Dealer & klippbank</span></div>
        <button ref={close} type="button" onClick={minimize} aria-label="Minimera assistenten"><Minus size={19}/></button>
        <nav aria-label="I assistenten"><button type="button" onClick={()=>scrollTo('#dealer-import-chat-title')}>Samtal</button><button type="button" onClick={()=>scrollTo('#dealer-import-files')}>Filer</button>
          <button type="button" disabled={busy} onClick={showPage}>Visa hela importvyn <ArrowUpRight size={13}/></button></nav>
      </header>
      <div className="dealer-assistant-body">{started&&<DealerImportAssistant active={inline||drawerOpen} onBusyChange={setBusy}/>}</div>
    </dialog>
    <button ref={launcher} className="dealer-assistant-launcher" type="button" aria-label="Öppna Studioassistenten" aria-haspopup="dialog"
      aria-controls="studio-assistant-dialog" aria-expanded={drawerOpen} hidden={drawerOpen} onClick={open}>
      <MessageCircle size={22}/><span>Studioassistent</span>{busy&&<span className="dealer-assistant-working" aria-label="Arbete pågår"/>}
    </button>
  </>;
}
