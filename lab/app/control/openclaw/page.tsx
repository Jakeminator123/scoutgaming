import { headers } from 'next/headers';
import { authorizeUiPage } from '@/lib/ui-server';
import { OpenClawWorkspace } from '@/components/openclaw-workspace';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'OpenClaw · Croupier Studio' };

export default async function Page() {
  const h = await headers();
  await authorizeUiPage(new Request(`http://${h.get('host') || 'invalid'}/control/openclaw`, { headers: h }));
  return <OpenClawWorkspace />;
}
