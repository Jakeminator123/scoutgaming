import {useEffect,useRef,useState,type ReactNode} from 'react';
import Link, {usePathname,useSearchParams} from '../../../runtime/navigation';
import type {AdminTab} from '../../lib/admin-navigation';

// Shared building blocks for the six Admin pages: hub header, tab row, chips, cards,
// rows, empty state, action menu, steps and the preview flyout. No data of their own.
export type Tone=''|'ok'|'warn'|'danger'|'info'|'accent'|'ink';

export function HubPage({eyebrow,title,chip,intro,actions,children,wide=false}:{eyebrow?:ReactNode;title:ReactNode;chip?:ReactNode;intro?:ReactNode;actions?:ReactNode;children:ReactNode;wide?:boolean}) {
  return <div className={'hub-page'+(wide?' is-wide':'')}>
    <header className="hub-head"><div className="hub-head-copy">{eyebrow&&<div className="hub-eyebrow">{eyebrow}</div>}<h1>{title}{chip&&<> {chip}</>}</h1>{intro&&<p className="hub-intro">{intro}</p>}</div>{actions&&<div className="hub-actions">{actions}</div>}</header>
    {children}
  </div>;
}
export function Crumbs({items}:{items:{label:ReactNode;href?:string}[]}) {
  return <nav aria-label="Brödsmulor" className="hub-crumbs">{items.map((item,index)=><span key={index}>{index>0&&<span className="hub-faint"> / </span>}{item.href?<Link href={item.href}>{item.label}</Link>:<span>{item.label}</span>}</span>)}</nav>;
}
// Only the shared Studio context travels between tabs; credentials, panels and tools never do.
const tabContext=new Set(['operator','table','room','composition','game','dealer','event','variant','situation','category']);
/** Tabs keep the navigation context (including ambiguous repeated selectors); `drop` names context keys that belong to a single tab. */
export function Tabs({items,active,param='flik',label='Flikar',drop=[],counts={}}:{items:readonly AdminTab[];active:string;param?:string;label?:string;drop?:string[];counts?:Record<string,ReactNode>}) {
  const path=usePathname(),query=useSearchParams();
  const href=(id:string)=>{const next=new URLSearchParams();for(const [key,value] of query)if(tabContext.has(key)&&!drop.includes(key))next.append(key,value);next.set(param,id);return path+'?'+next;};
  return <nav className="hub-tabs" aria-label={label}>{items.map(tab=><Link key={tab.id} href={href(tab.id)} aria-current={tab.id===active?'page':undefined}>{tab.label}{counts[tab.id]!==undefined&&<span className="hub-count">{counts[tab.id]}</span>}</Link>)}</nav>;
}
export function Chip({tone='',dot,children,title}:{tone?:Tone;dot?:boolean;children:ReactNode;title?:string}) {
  return <span className={'hub-chip '+tone} title={title}>{dot&&<span className="hub-dot" aria-hidden="true"/>}{children}</span>;
}
export function Card({title,aside,children,className='',id,as:Tag='section'}:{title?:ReactNode;aside?:ReactNode;children:ReactNode;className?:string;id?:string;as?:'section'|'article'|'div'}) {
  return <Tag className={'hub-card '+className} id={id}>{title&&<div className="hub-card-head"><h2>{title}</h2>{aside&&<div className="hub-aside">{aside}</div>}</div>}{children}</Tag>;
}
export function Row({chip,title,text,href,action}:{chip?:ReactNode;title:ReactNode;text?:ReactNode;href?:string;action?:ReactNode}) {
  const body=<><div>{chip}</div><div className="hub-row-copy"><div className="hub-row-title">{title}</div>{text&&<div className="hub-row-text">{text}</div>}</div><div>{action??(href?<span className="hub-btn small">Öppna</span>:null)}</div></>;
  return href?<Link href={href} className="hub-row is-link">{body}</Link>:<div className="hub-row">{body}</div>;
}
/** Honest empty state. The default chip says the surface is not connected; pass `chip={null}` for an ordinary "nothing here". */
export function Empty({title,text,action,chip='Inte anslutet'}:{title:ReactNode;text?:ReactNode;action?:ReactNode;chip?:ReactNode|null}) {
  return <div className="hub-empty" role="status">{chip&&<Chip tone="warn">{chip}</Chip>}<h3>{title}</h3>{text&&<p className="hub-small">{text}</p>}{action&&<div className="hub-mt">{action}</div>}</div>;
}
export function KV({items}:{items:[ReactNode,ReactNode][]}) {
  return <dl className="hub-kv">{items.map(([key,value],index)=><div key={index} className="hub-kv-row"><dt>{key}</dt><dd>{value}</dd></div>)}</dl>;
}
export function Note({tone='',children}:{tone?:''|'warn'|'accent';children:ReactNode}) {
  return <p className={'hub-note '+tone}>{children}</p>;
}
export type Step={label:string;done:boolean;href?:string};
export function Steps({steps}:{steps:Step[]}) {
  const now=steps.findIndex(step=>!step.done);
  return <ol className="hub-steps" aria-label="Dealerflödet">{steps.map((step,index)=>{const state=step.done?'done':index===now?'now':'';const content=<><span className="hub-step-n">{index+1}</span><span className="hub-step-t">{step.label}</span></>;return <li key={step.label} className={'hub-step '+state} aria-current={index===now?'step':undefined}>{step.href?<Link href={step.href}>{content}</Link>:content}</li>;})}</ol>;
}
export type MenuAction={id:string;label:string;tone?:'danger'|'';disabled?:string;onSelect:()=>void};
/** The ⋯ menu per object. Confirmation and consequence belong to the caller's ConfirmDialog. */
export function ActionMenu({name,actions,small=false}:{name:string;actions:MenuAction[];small?:boolean}) {
  const [open,setOpen]=useState(false),root=useRef<HTMLSpanElement>(null);
  useEffect(()=>{if(!open)return;const close=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};document.addEventListener('click',close,true);document.addEventListener('keydown',key);return()=>{document.removeEventListener('click',close,true);document.removeEventListener('keydown',key);};},[open]);
  return <span ref={root} className="hub-menu">
    <button type="button" className={'hub-btn'+(small?' small':'')} aria-haspopup="menu" aria-expanded={open} aria-label={'Åtgärder för '+name} title={'Åtgärder för '+name} onClick={()=>setOpen(value=>!value)}>⋯</button>
    {open&&<div role="menu" className="hub-menu-list">{actions.map(action=><button key={action.id} type="button" role="menuitem" className={'hub-btn ghost '+(action.tone??'')} disabled={Boolean(action.disabled)} title={action.disabled} onClick={()=>{setOpen(false);action.onSelect();}}>{action.label}{action.disabled&&<span className="hub-small hub-faint">spärrad</span>}</button>)}</div>}
  </span>;
}
/** Preview as a panel sliding in from the right. The caller mounts the real preview component inside. */
export function PreviewFlyout({title='Förhandsvisning',children,open,onOpenChange}:{title?:string;children:ReactNode;open:boolean;onOpenChange:(open:boolean)=>void}) {
  return <>
    {!open&&<button type="button" className="hub-btn ink hub-flyout-btn" aria-expanded="false" onClick={()=>onOpenChange(true)}>Förhandsvisning</button>}
    <aside className="hub-flyout" data-open={open?'true':'false'} aria-hidden={!open} aria-label={title}>
      <div className="hub-flyout-head"><h2>{title}</h2><button type="button" className="hub-btn ghost small" aria-label="Stäng förhandsvisningen" onClick={()=>onOpenChange(false)}>✕</button></div>
      {open&&children}
    </aside>
  </>;
}
