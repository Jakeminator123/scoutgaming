'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Building2,LayoutDashboard,Search,Table2,UserRound,type LucideIcon} from 'lucide-react';
import {navigate} from '../../../runtime/navigation';
import {adminMenuLinks} from '../../lib/admin-navigation';
import {cn,Kbd} from './kit';

// ⌘K / Ctrl+K: search dealers, companies, tables and pages and jump there. Reads the same registered
// catalog as the pages (GET /admin/_data/catalog) the first time it opens; nothing is written.
type Entry={id:string;group:string;label:string;hint:string;href:string;icon:LucideIcon};
type Catalog={administration?:{dealers?:{id:string;name:string;archived?:boolean}[];operators?:{id:string;name:string;archivedAt?:string|null}[];rooms?:{id:string;name:string;operatorId:string;state:string;game?:string}[]}};
export const COMMAND_EVENT='scout:command-palette';
export function openCommandPalette() { window.dispatchEvent(new Event(COMMAND_EVENT)); }
export function commandEntries(catalog:Catalog|null):Entry[] {
  const admin=catalog?.administration,operators=admin?.operators??[];
  return [
    {id:'page:/admin',group:'Sidor',label:'Översikt',hint:'Det som väntar',href:'/admin',icon:LayoutDashboard},
    ...adminMenuLinks.map(link=>({id:'page:'+link.href,group:'Sidor',label:link.label,hint:'Sida',href:link.href,icon:LayoutDashboard})),
    ...(admin?.dealers??[]).filter(row=>!row.archived).map(row=>({id:'dealer:'+row.id,group:'Dealers',label:row.name,hint:'Dealer',href:'/admin/dealers/'+encodeURIComponent(row.id)+'?flik=klipp',icon:UserRound})),
    ...operators.filter(row=>!row.archivedAt).map(row=>({id:'operator:'+row.id,group:'Bolag',label:row.name,hint:'Bolag',href:'/admin/companies/'+encodeURIComponent(row.id)+'?flik=tilldelning',icon:Building2})),
    ...(admin?.rooms??[]).filter(row=>row.state!=='archived').map(row=>({id:'room:'+row.id,group:'Spelbord',label:row.name,hint:(operators.find(op=>op.id===row.operatorId)?.name??'Spelbord')+(row.state==='live'?' · öppet':' · pausat'),href:'/admin/rooms/'+encodeURIComponent(row.id)+'?flik=utseende',icon:Table2})),
  ];
}
export function filterEntries(entries:Entry[],query:string) {
  const words=query.trim().toLocaleLowerCase('sv').split(/\s+/).filter(Boolean);
  return words.length?entries.filter(entry=>{const text=(entry.label+' '+entry.hint+' '+entry.group).toLocaleLowerCase('sv');return words.every(word=>text.includes(word));}):entries;
}

// Webbläsaren skickar en stängd dialogs close-händelse först vid nästa bildruta. Har paletten öppnats igen
// emellan (Enter hoppar, Ctrl+K direkt efter) får den sena händelsen inte stänga den nya paletten, så
// onClose gör bara något när dialogen verkligen är stängd.
export function CommandPalette() {
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0);
  const [catalog,setCatalog]=useState<Catalog|null>(null),[failed,setFailed]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null),list=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&!event.altKey&&event.key.toLowerCase()==='k'){event.preventDefault();setOpen(value=>!value);}};
    const show=()=>setOpen(true);
    window.addEventListener('keydown',key);window.addEventListener(COMMAND_EVENT,show);
    return()=>{window.removeEventListener('keydown',key);window.removeEventListener(COMMAND_EVENT,show);};
  },[]);
  useEffect(()=>{
    const node=dialog.current;if(!node)return;
    if(open&&!node.open){const previous=document.activeElement as HTMLElement|null;node.showModal();input.current?.focus();setQuery('');setActive(0);
      return()=>{if(node.open)node.close();if(previous?.isConnected)previous.focus();};}
    return undefined;
  },[open]);
  useEffect(()=>{
    if(!open||catalog)return;
    const controller=new AbortController();setFailed(false);
    void fetch('/admin/_data/catalog',{credentials:'same-origin',cache:'no-store',redirect:'error',headers:{accept:'application/json'},signal:controller.signal})
      .then(response=>response.ok?response.json():Promise.reject(Error('catalog')))
      .then(value=>{if(!controller.signal.aborted)setCatalog(value);}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return()=>controller.abort();
  },[open,catalog]);
  const entries=useMemo(()=>filterEntries(commandEntries(catalog),query),[catalog,query]);
  const current=Math.min(active,Math.max(entries.length-1,0));
  useEffect(()=>{list.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({block:'nearest'});},[current]);
  const go=(entry:Entry|undefined)=>{if(!entry)return;setOpen(false);navigate(entry.href);};
  const groups=[...new Set(entries.map(entry=>entry.group))];
  return <dialog ref={dialog} aria-label="Sök i Admin" onCancel={event=>{event.preventDefault();setOpen(false);}} onClose={event=>{if(!event.currentTarget.open)setOpen(false);}} onClick={event=>{if(event.target===event.currentTarget)setOpen(false);}}
    className="mx-auto mt-[12vh] w-[min(620px,calc(100vw-32px))] overflow-hidden rounded-xl border border-sg-border bg-sg-surface p-0 text-sg-text shadow-sg backdrop:bg-sg-overlay backdrop:backdrop-blur-[2px] open:animate-in open:fade-in-0 open:zoom-in-95 open:duration-150">
    {open&&<>
      <div className="flex items-center gap-2.5 border-b border-sg-line-2 px-4"><Search className="size-4 text-sg-faint" aria-hidden="true"/>
        <input ref={input} role="combobox" aria-expanded="true" aria-controls="command-list" aria-activedescendant={entries[current]?'command-'+entries[current].id:undefined} aria-autocomplete="list"
          aria-label="Sök dealers, bolag, spelbord och sidor" placeholder="Sök dealers, bolag, spelbord och sidor…" value={query}
          onChange={event=>{setQuery(event.target.value);setActive(0);}}
          onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();setActive(Math.min(current+1,entries.length-1));}else if(event.key==='ArrowUp'){event.preventDefault();setActive(Math.max(current-1,0));}else if(event.key==='Enter'){event.preventDefault();go(entries[current]);}}}
          className="h-12 flex-1 border-0 bg-transparent text-[15px] text-sg-text outline-none placeholder:text-sg-faint"/><Kbd>Esc</Kbd></div>
      <div ref={list} id="command-list" role="listbox" aria-label="Träffar" className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
        {groups.map(group=><div key={group} role="group" aria-label={group}><div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-sg-faint">{group}</div>
          {entries.map((entry,index)=>entry.group!==group?null:<div key={entry.id} id={'command-'+entry.id} role="option" aria-selected={index===current} data-index={index}
            onMouseMove={()=>setActive(index)} onClick={()=>go(entry)}
            className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px]',index===current&&'bg-sg-hover')}>
            <entry.icon className="size-4 shrink-0 text-sg-muted" aria-hidden="true"/><span className="min-w-0 flex-1 truncate font-medium">{entry.label}</span><span className="truncate text-xs text-sg-faint">{entry.hint}</span></div>)}
        </div>)}
        {!entries.length&&<p className="m-0 px-3 py-6 text-center text-[13.5px] text-sg-muted">Inget matchar ”{query}”.</p>}
        {failed&&<p role="alert" className="m-0 px-3 py-2 text-xs text-sg-warn">Registret kunde inte läsas; bara sidorna visas.</p>}
      </div>
      <div className="flex items-center gap-3 border-t border-sg-line-2 bg-sg-surface-2 px-4 py-2 text-[11.5px] text-sg-faint"><span className="inline-flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> välj</span><span className="inline-flex items-center gap-1"><Kbd>↵</Kbd> öppna</span><span className="ml-auto inline-flex items-center gap-1"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span></div>
    </>}
  </dialog>;
}
