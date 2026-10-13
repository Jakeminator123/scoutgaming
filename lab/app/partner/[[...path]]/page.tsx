import { WorkspaceSurfacePage } from '../../control/surface-page';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Partnerportal · Croupier', robots: { index: false, follow: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ path?: string[] }>; searchParams?:Promise<Record<string,string|string[]|undefined>> }) {
  return <WorkspaceSurfacePage surface="partner" path={(await params).path} initialRoomId={(await searchParams)?.room} />;
}
