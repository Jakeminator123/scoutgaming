import { useSyncExternalStore, type AnchorHTMLAttributes, type ImgHTMLAttributes } from 'react';

export function previewHref(href: string) {
  return href === '/control' || href.startsWith('/control/') ? '/admin' + href.slice(8) : href;
}
const subscribe = (notify: () => void) => {
  window.addEventListener('popstate', notify);
  return () => window.removeEventListener('popstate', notify);
};
export function usePathname() {
  return useSyncExternalStore(subscribe, () => '/control' + window.location.pathname.slice(6), () => '/control');
}
export function useRouter() {
  return { push: (href: string) => navigate(previewHref(href)), replace: (href: string) => navigate(previewHref(href), true) };
}
export function navigate(href: string, replace = false) {
  if (!window.dispatchEvent(new CustomEvent('studio:before-navigate', { cancelable: true, detail: { href } }))) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', href);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
export default function Link({ href = '', onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const target = previewHref(href);
  return <a {...props} href={target} data-studio-navigation={!props.target && target.startsWith('/admin/') && !target.startsWith('/admin/lobby') ? 'true' : undefined} onClick={event => {
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
