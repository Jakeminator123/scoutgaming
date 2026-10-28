'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {X} from 'lucide-react';
import {Button,cn,focusRing} from './kit';

// One dialog system for Admin: the native <dialog>. showModal() puts it in the top layer, makes the
// page behind inert (focus stays inside), and Esc arrives as the cancel event. The parent owns `open`;
// a dialog never closes itself silently. Content renders only while open, so a closed dialog costs
// nothing and tests can tell the two states apart. Sheet is the same element as a side panel.
let sequence=0;
type Base={open:boolean;children?:ReactNode;onClose:()=>void;busy?:boolean;className?:string;labelledBy?:string;describedBy?:string;ariaBusy?:boolean;danger?:boolean;initialFocus?:'first'|'cancel'};
function useNativeDialog({open,busy=false,onClose,modal=true}:{open:boolean;busy?:boolean;onClose:()=>void;modal?:boolean}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const latest=useRef({open,busy,onClose});
  latest.current={open,busy,onClose};
  useEffect(()=>{
    const node=dialog.current;
    if(!open||!node||typeof node.showModal!=='function')return undefined;
    const previous=typeof document==='undefined'?null:document.activeElement as HTMLElement|null;
    if(!node.open){if(modal)node.showModal();else node.show();}
    return ()=>{
      if(node.open)node.close();
      if(previous&&typeof previous.focus==='function'&&previous.isConnected)previous.focus();
    };
  },[open,modal]);
  const dismiss=()=>{if(!latest.current.busy)latest.current.onClose();};
  return {dialog,dismiss,handlers:{
    onCancel:(event:{preventDefault:()=>void})=>{event.preventDefault();dismiss();},
    onClose:()=>{if(latest.current.open)latest.current.onClose();},
    onKeyDown:(event:{key:string;preventDefault:()=>void})=>{if(!modal&&event.key==='Escape'){event.preventDefault();dismiss();}},
  }};
}

function DialogShell({open,children,onClose,busy,className,labelledBy,describedBy,ariaBusy,danger,initialFocus='first'}:Base) {
  const {dialog,dismiss,handlers}=useNativeDialog({open,busy,onClose});
  useEffect(()=>{
    if(!open)return;
    const node=dialog.current;
    const target=initialFocus==='cancel'?node?.querySelector<HTMLElement>('[data-dialog-cancel]'):node?.querySelector<HTMLElement>('[data-autofocus],input:not([type=hidden]):not(:disabled),select,textarea');
    target?.focus();
  },[open,initialFocus]);
  return <dialog ref={dialog} aria-labelledby={labelledBy} aria-describedby={describedBy} aria-busy={ariaBusy||undefined} data-danger={danger||undefined} {...handlers}
    onClick={event=>{if(event.target===event.currentTarget)dismiss();}}
    className={cn('m-auto max-h-[calc(100dvh-32px)] w-[min(520px,calc(100vw-32px))] overflow-visible rounded-2xl border border-sg-border bg-sg-surface p-0 text-sg-text shadow-2xl backdrop:bg-[rgba(15,16,18,.55)] backdrop:backdrop-blur-[2px] open:animate-in open:fade-in-0 open:zoom-in-95 open:duration-150',className)}>
    {children}
  </dialog>;
}

/** A modal with a title, a short description, a body and the footer's actions. */
export function Dialog({open,title,description,children,footer,onClose,busy=false,size='md',ariaBusy,danger,initialFocus,closeLabel='Stäng'}:{open:boolean;title:ReactNode;description?:ReactNode;children?:ReactNode;footer?:ReactNode;onClose:()=>void;busy?:boolean;size?:'md'|'lg'|'xl';ariaBusy?:boolean;danger?:boolean;initialFocus?:'first'|'cancel';closeLabel?:string}) {
  const [id]=useState(()=>'dialog-'+(++sequence));
  return <DialogShell open={open} onClose={onClose} busy={busy} labelledBy={id+'-title'} describedBy={id+'-body'} ariaBusy={ariaBusy} danger={danger} initialFocus={initialFocus}
    className={size==='lg'?'w-[min(760px,calc(100vw-32px))]':size==='xl'?'w-[min(1080px,calc(100vw-32px))]':undefined}>
    {open?<div className="relative flex max-h-[calc(100dvh-34px)] flex-col">
      <div className="min-w-0 px-6 pb-2 pr-14 pt-5"><h2 id={id+'-title'} className="m-0 text-lg font-semibold tracking-[-0.01em]">{title}</h2>{description&&<p className="mb-0 mt-1 text-[13.5px] text-sg-muted">{description}</p>}</div>
      <div id={id+'-body'} className="min-h-0 flex-1 overflow-y-auto px-6 py-3 text-[14px]">{children}</div>
      {footer&&<div className="flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-sg-line-2 bg-sg-surface-2 px-6 py-3.5">{footer}</div>}
      {/* Last in the tab order, so the dialog opens on its first field or action, not on the close button. */}
      <Button variant="ghost" size="icon-sm" aria-label={closeLabel} disabled={busy} onClick={onClose} className="absolute right-3 top-3.5"><X aria-hidden="true"/></Button>
    </div>:null}
  </DialogShell>;
}

/** The step row of a guided dialog: where you are and what comes next. */
export function DialogSteps({steps,current,onSelect}:{steps:string[];current:number;onSelect?:(index:number)=>void}) {
  return <ol aria-label="Steg" className="mb-4 flex flex-wrap items-center gap-1.5 p-0 text-[12.5px]">{steps.map((label,index)=>{
    const state=index<current?'done':index===current?'now':'next';
    const content=<><span className={cn('grid size-5 place-items-center rounded-full text-[11px] font-bold',state==='done'?'bg-sg-ok text-sg-surface':state==='now'?'bg-sg-ink text-sg-side-text':'bg-sg-hover text-sg-faint')}>{state==='done'?'✓':index+1}</span><span className={cn('font-semibold',state==='next'?'text-sg-faint':'text-sg-text')}>{label}</span></>;
    return <li key={label} className="flex items-center gap-1.5" aria-current={state==='now'?'step':undefined}>
      {index>0&&<span className="h-px w-4 bg-sg-border" aria-hidden="true"/>}
      {onSelect&&state==='done'?<button type="button" className={cn('flex items-center gap-1.5 rounded-md border-0 bg-transparent p-0.5',focusRing)} onClick={()=>onSelect(index)}>{content}</button>:<span className="flex items-center gap-1.5 p-0.5">{content}</span>}
    </li>;})}</ol>;
}

/** A panel sliding in from the right (preview, assistant). Non-modal: the page stays usable beside it. */
export function Sheet({open,title,children,onClose,width='min(720px,100vw)',actions}:{open:boolean;title:ReactNode;children?:ReactNode;onClose:()=>void;width?:string;actions?:ReactNode}) {
  const [id]=useState(()=>'sheet-'+(++sequence));
  const {dialog,handlers}=useNativeDialog({open,onClose,modal:false});
  return <dialog ref={dialog} aria-labelledby={id+'-title'} {...handlers} style={{width}}
    className="fixed inset-y-0 left-auto right-0 z-40 m-0 h-dvh max-h-none max-w-none border-0 border-l border-sg-border bg-sg-surface p-0 text-sg-text shadow-[-16px_0_40px_-24px_rgba(0,0,0,.45)] open:animate-in open:slide-in-from-right open:duration-200">
    {open?<div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-sg-line-2 px-5 py-3.5"><h2 id={id+'-title'} className="m-0 truncate text-[15px] font-semibold">{title}</h2><div className="flex items-center gap-1">{actions}<Button variant="ghost" size="icon-sm" aria-label="Stäng panelen" onClick={onClose}><X aria-hidden="true"/></Button></div></div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </div>:null}
  </dialog>;
}

export type ConfirmDialogProps={
  open:boolean;title:string;
  /** One short sentence that states the consequence. */
  description?:ReactNode;
  /** Concrete consequences, one row each. */
  consequences?:ReactNode[];
  children?:ReactNode;
  /** A server check is running inside the dialog; the confirm button waits. */
  checking?:boolean;checkingLabel?:string;error?:string;
  /** The confirmed action is running; the dialog cannot be closed. */
  busy?:boolean;busyLabel?:string;
  /** Without a label the dialog only informs and offers the cancel button. */
  confirmLabel?:string;confirmDisabled?:boolean;cancelLabel?:string;
  /** Destructive styling for the primary button. Default on. */
  danger?:boolean;
  onConfirm:()=>void;onCancel:()=>void;
};
/** Confirmation with consequence rows. A destructive dialog starts on the safe choice. */
export function ConfirmDialog({open,title,description,consequences=[],children,checking=false,checkingLabel='Kontrollerar…',error='',busy=false,busyLabel='Sparar…',confirmLabel,confirmDisabled=false,cancelLabel='Avbryt',danger=true,onConfirm,onCancel}:ConfirmDialogProps) {
  const [id]=useState(()=>'confirm-dialog-'+(++sequence));
  return <DialogShell open={open} onClose={onCancel} busy={busy} labelledBy={id+'-title'} describedBy={id+'-body'} ariaBusy={busy||checking} danger={danger} initialFocus="cancel">
    {open?<div className="px-6 pb-5 pt-5">
      <h2 id={id+'-title'} className="m-0 text-lg font-semibold tracking-[-0.01em]">{title}</h2>
      <div id={id+'-body'} className="mt-2 grid gap-3 text-[14px] text-sg-muted">
        {checking?<p role="status" className="m-0 flex items-center gap-2.5"><span className="size-4 animate-spin rounded-full border-2 border-sg-border border-t-sg-text" aria-hidden="true"/>{checkingLabel}</p>:<>
          {description?<p className="m-0">{description}</p>:null}
          {consequences.length>0&&<ul className="m-0 grid gap-1.5 rounded-lg bg-sg-surface-2 px-4 py-3 text-[13.5px] text-sg-text marker:text-sg-faint">{consequences.map((row,index)=><li key={index} className="ml-3 list-disc">{row}</li>)}</ul>}
          {children}
        </>}
        {error?<p role="alert" className="m-0 rounded-lg bg-sg-danger-bg px-3 py-2 text-[13.5px] text-sg-danger">{error}</p>:null}
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button data-dialog-cancel="" disabled={busy} onClick={onCancel}>{cancelLabel}</Button>
        {confirmLabel?<Button variant={danger?'destructive':'primary'} disabled={busy||checking||confirmDisabled} onClick={onConfirm}>{busy?busyLabel:confirmLabel}</Button>:null}
      </div>
    </div>:null}
  </DialogShell>;
}

/** Extra acknowledgement for irreversible actions that delete files. */
export function ConfirmAcknowledgement({checked,label,disabled=false,onChange}:{checked:boolean;label:string;disabled?:boolean;onChange:(checked:boolean)=>void}) {
  return <label className="flex items-start gap-2.5 rounded-lg border border-sg-danger-line bg-sg-danger-bg px-3 py-2.5 text-[13.5px] text-sg-text"><input type="checkbox" className="mt-0.5 size-4 accent-[var(--sg-danger-text)]" checked={checked} disabled={disabled} onChange={event=>onChange(event.target.checked)}/><span>{label}</span></label>;
}
