import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { publicAbsoluteUrl } from '@/lib/lab-url.mjs';
import { adminDocumentHref } from '../../lib/admin-workspace-routes.mjs';

export async function redirectToPublicControl(pathname: string) {
  return redirect(publicAbsoluteUrl(await headers(), pathname));
}

// Retired page shells share the same document mapping as the public router.
export async function redirectControlPage(pathname: string, searchParams: Promise<Record<string, string | string[] | undefined>> = Promise.resolve({})) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (!['dealer','dealerId','operator','room','table','game','composition','lane','tab','role','event','variant','situation','view','category'].includes(key)) continue;
    for (const item of Array.isArray(value) ? value : [value]) if (typeof item === 'string') query.append(key, item);
  }
  const target = adminDocumentHref(pathname + (query.size ? '?' + query : ''));
  if (!/^\/admin(?:[/?#]|$)/.test(target)) throw new Error('control_redirect_rejected');
  return redirect(new URL(target, publicAbsoluteUrl(await headers(), '/control')).href);
}
