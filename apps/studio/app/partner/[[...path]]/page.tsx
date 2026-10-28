import { WorkspaceSurfacePage } from '@/components/workspace-surface-page';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Partnerportalen · Scoutgaming', robots: { index: false, follow: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ path?: string[] }>; searchParams?:Promise<Record<string,string|string[]|undefined>> }) {
  const query = await searchParams;
  return <WorkspaceSurfacePage surface="partner" path={(await params).path} initialRoomId={query?.room} initialRoomScope={query?.scope} />;
}
