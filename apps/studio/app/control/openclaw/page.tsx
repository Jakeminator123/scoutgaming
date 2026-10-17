import { headers } from 'next/headers';
import { authorizeUiPage } from '@/lib/ui-server';
import { OpenClawWorkspace } from '@/components/openclaw-workspace';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'OpenClaw · Croupier Studio' };

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = props?.searchParams ? await props.searchParams : {};
  if (queryValue(query.tab) === 'chat') {
    const [{ loadControlStudio }, { ControlOpenClawChat }, { firstQueryValue }] = await Promise.all([
      import('../../control-studio-data'),
      import('@/components/control-openclaw-chat'),
      import('@/components/studio-types'),
    ]);
    const data = await loadControlStudio('/control/openclaw');
    const standaloneVoicePreviewAvailable = process.env.CROUPIER_STUDIO_NATIVE_ADMIN !== '1' && process.env.CROUPIER_STUDIO_NEON_POLICY !== '1';
    return <ControlOpenClawChat initialProject={data.project} initialVideos={data.videos} initialStatus={data.status} initialDealerId={firstQueryValue(query.dealer)} initialEventId={firstQueryValue(query.event)} standaloneVoicePreviewAvailable={standaloneVoicePreviewAvailable} />;
  }
  const h = await headers();
  await authorizeUiPage(new Request(`http://${h.get('host') || 'invalid'}/control/openclaw`, { headers: h }));
  return <OpenClawWorkspace />;
}
