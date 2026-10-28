import {type ReactNode} from 'react';
import {Eye} from 'lucide-react';
import Link, {usePathname,useSearchParams} from '../../../runtime/navigation';
import type {AdminTab} from '../../lib/admin-navigation';
import {Badge,Card,cn,focusRing,type Tone} from './kit';
import {Sheet} from './dialog';
export {ActionMenu,type MenuAction} from './menu';
export {Card,type Tone};

// Page layout for the Admin pages: header with crumbs, title, status and actions; tab row; rows, empty
// state, key/value list, notes, steps and the preview panel. Built on the kit (kit.tsx); no data of its own.
// Content sits beside the sidebar with an even gutter and uses the width up to a readable maximum.
export const pageClass='w-full min-w-0 px-8 pb-16 pt-7 text-[14px] leading-normal max-md:px-4 max-md:pb-12 max-md:pt-5';
/** `wide` lets an editor below (the clip map) use the full width; `continued` drops the bottom padding before it. */
export function HubPage({eyebrow,title,chip,intro,actions,children,wide=false,continued=false}:{eyebrow?:ReactNode;title:ReactNode;chip?:ReactNode;intro?:ReactNode;actions?:ReactNode;children:ReactNode;wide?:boolean;continued?:boolean}) {
  return <div className={cn(pageClass,wide?'max-w-none':'max-w-[1640px]',continued&&'pb-3 max-md:pb-3')}>
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-[1_1_320px]">{eyebrow&&<div className="mb-2">{eyebrow}</div>}
        <h1 className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[26px] font-bold leading-tight tracking-[-0.02em] text-sg-text max-md:text-[22px]">{title}{chip&&<> {chip}</>}</h1>
        {intro&&<p className="mb-0 mt-1.5 max-w-[72ch] text-sg-muted">{intro}</p>}</div>
      {actions&&<div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
    {children}
  </div>;
}
export function Crumbs({items}:{items:{label:ReactNode;href?:string}[]}) {
  return <nav aria-label="Brödsmulor" className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-sg-muted">{items.map((item,index)=><span key={index} className="inline-flex items-center gap-1.5">{index>0&&<span className="text-sg-faint" aria-hidden="true">/</span>}{item.href?<Link href={item.href} className={cn('rounded text-inherit no-underline hover:text-sg-text hover:underline',focusRing)}>{item.label}</Link>:<span className="text-sg-text">{item.label}</span>}</span>)}</nav>;
}
// Only the shared Studio context travels between tabs; credentials, panels and tools never do.
const tabContext=new Set(['operator','table','room','composition','game','dealer','event','variant','situation','category']);
/** Tabs keep the navigation context (including ambiguous repeated selectors); `drop` names context keys that belong to a single tab. */
export function Tabs({items,active,param='flik',label='Flikar',drop=[],counts={}}:{items:readonly AdminTab[];active:string;param?:string;label?:string;drop?:string[];counts?:Record<string,ReactNode>}) {
  const path=usePathname(),query=useSearchParams();
  const href=(id:string)=>{const next=new URLSearchParams();for(const [key,value] of query)if(tabContext.has(key)&&!drop.includes(key))next.append(key,value);next.set(param,id);return path+'?'+next;};
  return <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-sg-border" aria-label={label}>{items.map(tab=><Link key={tab.id} href={href(tab.id)} aria-current={tab.id===active?'page':undefined}
    className={cn('-mb-px inline-flex items-center gap-1.5 whitespace-nowrap rounded-t-md border-b-2 border-transparent px-3 py-2.5 font-medium text-sg-muted no-underline transition-colors hover:text-sg-text aria-[current=page]:border-sg-text aria-[current=page]:font-semibold aria-[current=page]:text-sg-text',focusRing)}>
    {tab.label}{counts[tab.id]!==undefined&&<span className="rounded-full bg-sg-hover px-1.5 text-[11px] font-semibold tabular-nums text-sg-muted">{counts[tab.id]}</span>}</Link>)}</nav>;
}
export function Chip({tone='',dot,children,title}:{tone?:Tone;dot?:boolean;children:ReactNode;title?:string}) {
  return <Badge tone={tone} dot={dot} title={title}>{children}</Badge>;
}
export function Row({chip,title,text,href,action}:{chip?:ReactNode;title:ReactNode;text?:ReactNode;href?:string;action?:ReactNode}) {
  const body=<><div>{chip}</div><div className="min-w-0"><div className="font-semibold text-sg-text">{title}</div>{text&&<div className="text-[13px] text-sg-muted">{text}</div>}</div><div>{action??(href?<span className="text-[12.5px] font-semibold text-sg-muted group-hover/row:text-sg-text">Öppna →</span>:null)}</div></>;
  const cls='group/row grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-sg-line-2 py-3 text-inherit no-underline first:border-t-0 first:pt-0 last:pb-0 max-md:grid-cols-1 max-md:gap-1.5';
  return href?<Link href={href} className={cn(cls,'rounded-sm hover:[&_.font-semibold]:underline',focusRing)}>{body}</Link>:<div className={cls}>{body}</div>;
}
export function Rows({children,className}:{children:ReactNode;className?:string}) { return <div className={cn('grid',className)}>{children}</div>; }
/** Honest empty state. The default chip says the surface is not connected; pass `chip={null}` for an ordinary "nothing here". */
export function Empty({title,text,action,chip='Inte anslutet'}:{title:ReactNode;text?:ReactNode;action?:ReactNode;chip?:ReactNode|null}) {
  return <div className="rounded-xl border border-dashed border-sg-border bg-sg-surface-2 px-5 py-7 text-center text-sg-muted" role="status">{chip&&<div className="mb-2.5"><Badge tone="warn">{chip}</Badge></div>}<h3 className="m-0 mb-1 text-[14px] font-semibold text-sg-text">{title}</h3>{text&&<p className="m-0 text-[12.5px]">{text}</p>}{action&&<div className="mt-3 flex justify-center">{action}</div>}</div>;
}
export function KV({items}:{items:[ReactNode,ReactNode][]}) {
  return <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-1.5 text-[13.5px] max-md:grid-cols-1 max-md:gap-y-0.5">{items.map(([key,value],index)=><div key={index} className="contents"><dt className="text-sg-muted max-md:mt-2">{key}</dt><dd className="m-0 min-w-0 [overflow-wrap:anywhere]">{value}</dd></div>)}</dl>;
}
export function Note({tone='',children,className}:{tone?:''|'warn'|'accent';children:ReactNode;className?:string}) {
  return <p className={cn('m-0 rounded-lg px-3.5 py-2.5 text-[13px]',tone==='warn'?'bg-sg-warn-bg text-sg-warn':tone==='accent'?'bg-sg-accent-bg text-sg-text':'bg-sg-info-bg text-sg-info',className)}>{children}</p>;
}
export type Step={label:string;done:boolean;href?:string};
export function Steps({steps}:{steps:Step[]}) {
  const now=steps.findIndex(step=>!step.done);
  return <ol aria-label="Dealerflödet" className="mb-6 grid list-none auto-cols-fr grid-flow-col gap-1.5 p-0 max-md:auto-cols-[minmax(120px,1fr)] max-md:overflow-x-auto max-md:pb-1">{steps.map((step,index)=>{
    const state=step.done?'done':index===now?'now':'';
    const content=<><span className={cn('grid size-5 place-items-center rounded-full text-[11px] font-bold',state==='done'?'bg-sg-ok text-sg-surface':state==='now'?'bg-sg-ink text-sg-side-text':'bg-sg-hover text-sg-faint')} aria-hidden="true">{state==='done'?'✓':index+1}</span><span className="block font-semibold leading-snug">{step.label}</span></>;
    return <li key={step.label} aria-current={index===now?'step':undefined} className={cn('rounded-xl border text-[12.5px]',state==='done'?'border-transparent bg-sg-ok-bg':state==='now'?'border-sg-text bg-sg-surface shadow-[0_0_0_2px_var(--sg-lime)]':'border-sg-border bg-sg-surface')}>
      {step.href?<Link href={step.href} className={cn('flex h-full items-center gap-2 rounded-xl px-3 py-2.5 text-inherit no-underline',focusRing)}>{content}</Link>:<span className="flex items-center gap-2 px-3 py-2.5">{content}</span>}</li>;})}</ol>;
}
/** Preview as a panel sliding in from the right. The caller mounts the real preview component inside. */
export function PreviewFlyout({title='Förhandsvisning',children,open,onOpenChange}:{title?:string;children:ReactNode;open:boolean;onOpenChange:(open:boolean)=>void}) {
  return <>
    {!open&&<button type="button" aria-expanded="false" onClick={()=>onOpenChange(true)}
      className={cn('fixed right-0 top-[72%] z-30 inline-flex origin-bottom-right -translate-y-1/2 -rotate-90 items-center gap-2 rounded-t-lg border-0 bg-sg-ink px-3.5 py-2 text-[13px] font-semibold text-sg-side-text shadow-lg [&_svg]:size-4',focusRing)}><Eye aria-hidden="true"/>Förhandsvisning</button>}
    <Sheet open={open} title={title} onClose={()=>onOpenChange(false)}>{children}</Sheet>
  </>;
}
