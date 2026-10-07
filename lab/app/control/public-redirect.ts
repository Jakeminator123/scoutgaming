import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { publicAbsoluteUrl } from '@/lib/lab-url.mjs';

export async function redirectToPublicControl(pathname: string) {
  redirect(publicAbsoluteUrl(await headers(), pathname));
}
