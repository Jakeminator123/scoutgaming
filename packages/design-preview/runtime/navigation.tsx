import { useSyncExternalStore, type AnchorHTMLAttributes, type ImgHTMLAttributes } from 'react';
import {adminHref,adminPathname,isInternalAdminPathname,withAdminContext} from './admin-routing.mjs';

export function previewHref(href: string) {
  return adminHref(href);
}
const subscribers = new Set<() => void>();
let previousHref = '';
const notifySubscribers = () => subscribers.forEach(notify => notify());
// Import uploads must veto first: Studio's context listener may update its draft.
const canNavigate = (href:string) => window.dispatchEvent(new CustomEvent('studio:before-navigate', {cancelable:true,detail:{href}}))
  && window.dispatchEvent(new CustomEvent('scout:navigate', {cancelable:true,detail:{href}}));
const changed = () => {
  const href = location.pathname + location.search + location.hash;
  if (!canNavigate(href)) {
    history.pushState(null,'',previousHref); return;
  }
  previousHref = href; notifySubscribers();
};
const subscribe = (notify: () => void) => {
  if (!subscribers.size) { previousHref = location.pathname + location.search + location.hash; window.addEventListener('popstate',changed); }
  subscribers.add(notify);
  return () => { subscribers.delete(notify); if (!subscribers.size) window.removeEventListener('popstate',changed); };
};
export function replaceContext(href:string) { history.replaceState(null,'',href); previousHref = href; }
export function usePathname() {
  return useSyncExternalStore(subscribe, () => adminPathname(window.location.pathname), () => '/admin');
}
export function useSearchParams() {
  const query=useSyncExternalStore(subscribe,()=>location.search,()=> '');
  return new URLSearchParams(query);
}
export function useRouter() {
  return { push: (href: string) => navigate(previewHref(href)), replace: (href: string) => navigate(previewHref(href), true) };
}
export function navigate(href: string, replace = false) {
  href=withAdminContext(previewHref(href),location.search);
  if (!canNavigate(href)) return false;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', href);
  previousHref = href; notifySubscribers();
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
