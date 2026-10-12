import { useSyncExternalStore, type AnchorHTMLAttributes, type ImgHTMLAttributes } from 'react';

export function previewHref(href: string) {
  return href === '/control' || href.startsWith('/control/') ? '/admin' + href.slice(8) : href;
}
const subscribers = new Set<() => void>();
let previousHref = '';
const notifySubscribers = () => subscribers.forEach(notify => notify());
const changed = () => {
  const href = location.pathname + location.search;
  if (!window.dispatchEvent(new CustomEvent('scout:navigate', { cancelable:true,detail:{href} }))) {
    history.pushState(null,'',previousHref); return;
  }
  previousHref = href; notifySubscribers();
};
const subscribe = (notify: () => void) => {
  if (!subscribers.size) { previousHref = location.pathname + location.search; window.addEventListener('popstate',changed); }
  subscribers.add(notify);
  return () => { subscribers.delete(notify); if (!subscribers.size) window.removeEventListener('popstate',changed); };
};
export function replaceContext(href:string) { history.replaceState(null,'',href); previousHref = href; }
export function usePathname() {
  return useSyncExternalStore(subscribe, () => '/control' + window.location.pathname.slice(6), () => '/control');
}
export function useRouter() {
  return { push: (href: string) => navigate(previewHref(href)), replace: (href: string) => navigate(previewHref(href), true) };
}
export function navigate(href: string, replace = false) {
  if (['/admin','/admin/clips','/admin/structure','/admin/rooms','/admin/dealers','/admin/assets'].includes(href)) {
    const context = new URLSearchParams(location.search);
    const query = new URLSearchParams();
    for (const key of ['operator','table','dealer','composition','lane']) if (context.has(key)) query.set(key,context.get(key)!);
    if (query.size) href += `?${query}`;
  }
  if (!window.dispatchEvent(new CustomEvent('scout:navigate', { cancelable:true,detail:{href} }))) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', href);
  previousHref = href; notifySubscribers();
}
export default function Link({ href = '', onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const target = previewHref(href);
  return <a {...props} href={target} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
      && !props.target && target.startsWith('/admin/') && !target.startsWith('/admin/lobby')) {
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
