import { redirectControlPage } from '../public-redirect';

export const dynamic = 'force-dynamic';

export default async function Page({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  await redirectControlPage('/control/library', searchParams);
}
