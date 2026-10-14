import { useSyncExternalStore, type AnchorHTMLAttributes, type ImgHTMLAttributes } from 'react';
import {adminHref,adminPathname,isInternalAdminPathname,withAdminContext,adminToolName} from './admin-routing.mjs';

export function previewHref(href: string) {
  return adminHref(href);
}
const subscribers = new Set<() => void>();
const historyKey = '__scoutAdminHistory';
type HistoryEntry = {session:string; index:number; href:string};
let previousHref = '', previousEntry:HistoryEntry|null = null, previousState:unknown = null;
let restoring = false, deferredContext:string|null = null;
const currentHref = () => location.pathname + location.search + location.hash;
// A draft may rerender before history.go completes. Snapshots must keep its
// accepted route throughout compensation, even without a store notification.
const snapshotLocation = () => new URL(restoring ? previousHref : currentHref(),location.origin);
const canonicalHref = (href:string) => {const url=new URL(href,location.href);return url.pathname+url.search+url.hash;};
const isStateRecord = (state:unknown):state is Record<string,unknown> => Object.prototype.toString.call(state)==='[object Object]';
const readEntry = ():HistoryEntry|null => {
  const entry = isStateRecord(history.state) ? history.state[historyKey] : null;
  return isStateRecord(entry) && typeof entry.session==='string' && Number.isSafeInteger(entry.index)
    && entry.href===currentHref() ? entry as HistoryEntry : null;
};
const newEntry = (href:string):HistoryEntry => ({session:crypto.randomUUID(),index:0,href});
// Non-record state belongs to its consumer. Leave its type and value untouched;
// it cannot carry our index and therefore uses the conservative fallback below.
const withEntry = (state:unknown,entry:HistoryEntry) => state==null || isStateRecord(state) ? {...(state as object|null),[historyKey]:entry} : state;
const rememberCurrent = () => {
  previousHref=currentHref(); previousEntry=readEntry();
  if(!previousEntry){history.replaceState(withEntry(history.state,newEntry(previousHref)),'',previousHref);previousEntry=readEntry();}
  previousState=history.state;
};
const notifySubscribers = () => subscribers.forEach(notify => notify());
// Import uploads must veto first: Studio's context listener may update its draft.
const canNavigate = (href:string) => window.dispatchEvent(new CustomEvent('studio:before-navigate', {cancelable:true,detail:{href}}))
  && window.dispatchEvent(new CustomEvent('scout:navigate', {cancelable:true,detail:{href}}));
const finishRestore = () => {
  restoring=false;
  if(deferredContext!==null){
    const href=deferredContext,restoredHref=previousHref;deferredContext=null;replaceContext(href);
    // Publish a queued context change after the accepted snapshots unlock.
    if(previousHref!==restoredHref)notifySubscribers();
  }
};
const restorePrevious = (entry:HistoryEntry|null) => {
  if(entry && previousEntry && entry.session===previousEntry.session && entry.index!==previousEntry.index){
    restoring=true; history.go(previousEntry.index-entry.index); return;
  }
  // History API exposes no direction for older/external same-document entries.
  // Keep the draft and forward stack, but this unknown destination is replaced.
  // A fresh session prevents its unknown position from corrupting later deltas.
  history.replaceState(withEntry(previousState,newEntry(previousHref)),'',previousHref);
  previousEntry=readEntry();previousState=history.state;finishRestore();
};
const changed = () => {
  const href=currentHref(), entry=readEntry();
  if(restoring){
    if(entry && previousEntry && entry.session===previousEntry.session && entry.index===previousEntry.index && href===previousHref){
      previousState=history.state;finishRestore();
    }else restorePrevious(entry);
    return;
  }
  if(!canNavigate(href)){restorePrevious(entry);return;}
  rememberCurrent();notifySubscribers();
};
const subscribe = (notify: () => void) => {
  if (!subscribers.size) {restoring=false;deferredContext=null;rememberCurrent();window.addEventListener('popstate',changed);}
  subscribers.add(notify);
  return () => { subscribers.delete(notify); if (!subscribers.size) window.removeEventListener('popstate',changed); };
};
export function replaceContext(href:string) {
  if(restoring){deferredContext=href;return;}
  const entry=readEntry()??newEntry(currentHref());
  history.replaceState(withEntry(history.state,{...entry,href:canonicalHref(href)}),'',href);
  rememberCurrent();
}
export function usePathname() {
  return useSyncExternalStore(subscribe, () => adminPathname(snapshotLocation().pathname), () => '/admin');
}
export function useSearchParams() {
  const query=useSyncExternalStore(subscribe,()=>snapshotLocation().search,()=> '');
  return new URLSearchParams(query);
}
export function useRouter() {
  return { push: (href: string) => navigate(previewHref(href)), replace: (href: string) => navigate(previewHref(href), true) };
}
export function navigate(href: string, replace = false) {
  if(restoring)return false;
  href=withAdminContext(previewHref(href),location.search);
  if (!canNavigate(href)) return false;
  // The established editors own beforeunload guards for project/media drafts.
  // Cross-editor navigation must go through those guards, never unmount silently.
  if(adminToolName(location.pathname)||adminToolName(new URL(href,location.origin).pathname)){
    if(replace)location.replace(href);else location.assign(href);return true;
  }
  const current=readEntry(), target=canonicalHref(href);
  const entry=current ? {...current,index:current.index+(replace?0:1),href:target} : newEntry(target);
  window.history[replace ? 'replaceState' : 'pushState'](withEntry(replace?history.state:null,entry), '', href);
  rememberCurrent();notifySubscribers();
  return true;
}
export default function Link({ href = '', onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const target = previewHref(href);
  return <a {...props} href={target} data-studio-navigation={!props.target && target.startsWith('/admin') && isInternalAdminPathname(new URL(target,location.origin).pathname) ? 'true' : undefined} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
      && !props.target && target.startsWith('/admin') && isInternalAdminPathname(new URL(target,location.origin).pathname)) {
      event.preventDefault(); navigate(target);
    }
  }} />;
}
export function Image({ fill, priority, quality, unoptimized, ...props }: ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean; priority?: boolean; quality?: number; unoptimized?: boolean;
}) {
  return <img {...props} loading={priority ? 'eager' : props.loading ?? 'lazy'} style={fill
    ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...props.style } : props.style} />;
}
