import { redirectToPublicControl } from '../public-redirect';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const key of ['dealer', 'operator', 'table', 'composition']) {
    const value = query[key];
    if (typeof value === 'string' && value) params.set(key, value);
  }
  if (!params.has('composition') && typeof query.lane === 'string' && query.lane) params.set('composition', query.lane);
  const search = params.toString();
  await redirectToPublicControl('/control/rehearsal' + (search ? '?' + search : ''));
}
