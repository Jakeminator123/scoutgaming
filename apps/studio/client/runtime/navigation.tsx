import { useSyncExternalStore, type AnchorHTMLAttributes, type ImgHTMLAttributes } from 'react';
import {studioHistory} from '../../lib/studio-history.mjs';
import {adminHref,adminPathname,isInternalAdminPathname,withAdminContext,adminToolName} from './admin-routing.mjs';

export function previewHref(href: string) {
  return adminHref(href);
}
const nativeFormPaths = new Set(['/admin/admin/accounts', '/admin/admin/api', '/admin/ai/models']);
const needsDocumentNavigation = (pathname: string) => adminToolName(pathname) || nativeFormPaths.has(adminPathname(pathname));
const historyOwner = () => studioHistory(window);
const snapshotLocation = () => new URL(historyOwner().snapshotHref(), location.origin);
const subscribe = (notify: () => void) => historyOwner().subscribe(notify);
export function replaceContext(href:string) {
  historyOwner().replaceContext(href);
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
  if(historyOwner().isRestoring())return false;
  href=withAdminContext(previewHref(href),location.search);
  if (!historyOwner().canNavigate(href)) return false;
  // Editors and native service forms own beforeunload guards for unsaved changes.
  // Use document entries in both directions so Back/Forward also uses those guards.
  if(needsDocumentNavigation(location.pathname)||needsDocumentNavigation(new URL(href,location.origin).pathname)){
    if(replace)location.replace(href);else location.assign(href);return true;
  }
  return historyOwner().push(href, replace);
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
